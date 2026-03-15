import type { Client } from "colyseus";
import {
  RiskState,
  TerritoryState,
  RiskPlayerState,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
} from "@eschaton/shared";
import {
  calculateReinforcements,
  getCardTradeInValue,
  resolveCombat,
  canAttackFrom,
  canAttackTerritory,
  canFortifyBetween,
  getOwnedTerritories,
  updatePlayerTerritoryCount,
  checkWinCondition,
  getNextPhase,
  initializeSetup,
  calculateInitialArmies,
} from "./riskLogic.js";
import { TERRITORIES, areTerritoriesAdjacent } from "./territoryData.js";

type PickTerritoryPayload = {
  territoryId: string;
};

type PlaceArmyPayload = {
  territoryId: string;
  count?: number;
};

type AttackPayload = {
  from: string;
  to: string;
  attackerDice: number;
};

type FortifyPayload = {
  from: string;
  to: string;
  count: number;
};

type TradeCardsPayload = {
  cardCount: number;
};

type EndPhasePayload = Record<string, never>;

function isPickTerritoryPayload(payload: unknown): payload is PickTerritoryPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return typeof candidate.territoryId === "string";
}

function isPlaceArmyPayload(payload: unknown): payload is PlaceArmyPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.territoryId === "string" &&
    (candidate.count === undefined || typeof candidate.count === "number")
  );
}

function isAttackPayload(payload: unknown): payload is AttackPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.from === "string" &&
    typeof candidate.to === "string" &&
    typeof candidate.attackerDice === "number"
  );
}

function isFortifyPayload(payload: unknown): payload is FortifyPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.from === "string" &&
    typeof candidate.to === "string" &&
    typeof candidate.count === "number"
  );
}

function isTradeCardsPayload(payload: unknown): payload is TradeCardsPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return typeof candidate.cardCount === "number";
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const riskPlugin: GamePlugin<RiskState> = {
  id: "risk",
  name: "Risk",
  metadata: {
    playerCount: [2, 6],
    estimatedDuration: 120,
    complexity: 4,
    description: "Classic world domination strategy game with armies, territories, and continents.",
    hasHiddenInformation: true,
  },
  createState() {
    return new RiskState();
  },
  turnConfig: {
    mode: "phased",
    turnOrder: { type: "round-robin" },
    allowPass: false,
    phases: [
      { id: "reinforce", name: "Reinforce", allowedActions: ["placeArmy", "tradeCards"], optional: false },
      { id: "attack", name: "Attack", allowedActions: ["attack", "endPhase"], optional: true },
      { id: "fortify", name: "Fortify", allowedActions: ["fortify", "endPhase"], optional: true },
    ],
  },
  lifecycle: {
    onPlayerJoin(state, client, playerIndex) {
      const existingPlayer = state.players.get(client.sessionId);
      if (!existingPlayer) {
        const player = new PlayerInfo();
        player.sessionId = client.sessionId;
        player.displayName = `Player ${playerIndex + 1}`;
        player.playerIndex = playerIndex;
        player.isSpectator = false;
        player.isConnected = true;
        state.players.set(client.sessionId, player);
      }

      if (!state.riskPlayers.has(client.sessionId)) {
        const riskPlayer = new RiskPlayerState();
        riskPlayer.sessionId = client.sessionId;
        riskPlayer.cardsHeld = 0;
        riskPlayer.territoriesOwned = 0;
        riskPlayer.armiesToPlace = 0;
        state.riskPlayers.set(client.sessionId, riskPlayer);
      }
    },
    onGameStart(state) {
      for (const territory of TERRITORIES) {
        const territoryState = new TerritoryState();
        territoryState.owner = "";
        territoryState.armyCount = 0;
        state.territories.set(territory.id, territoryState);
      }

      initializeSetup(state);

      const activePlayers = Array.from(state.players.values())
        .filter((p) => !p.isSpectator)
        .sort((a, b) => a.playerIndex - b.playerIndex);

      const initialArmies = calculateInitialArmies(activePlayers.length);

      const shuffledTerritories = shuffleArray([...TERRITORIES]);
      let playerIdx = 0;

      for (const territory of shuffledTerritories) {
        const player = activePlayers[playerIdx];
        const territoryState = state.territories.get(territory.id);
        if (territoryState && player) {
          territoryState.owner = player.sessionId;
          territoryState.armyCount = 1;
        }
        playerIdx = (playerIdx + 1) % activePlayers.length;
      }

      for (const player of activePlayers) {
        updatePlayerTerritoryCount(state, player.sessionId);
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        if (riskPlayer) {
          riskPlayer.armiesToPlace = initialArmies - riskPlayer.territoriesOwned;
        }
      }

      state.gamePhase = "setup";
      state.turnPhase = "setup-place";
      state.setupTerritoryIndex = 0;
      state.cardTradeInCount = 0;
      state.earnedCardThisTurn = false;
    },
  },
  actions: {
    placeArmy(state, client, payload): ActionResult {
      if (!isPlaceArmyPayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      const territory = state.territories.get(payload.territoryId);
      const riskPlayer = state.riskPlayers.get(client.sessionId);

      if (!territory || !riskPlayer) {
        return { success: false, error: "Territory or player not found." };
      }

      if (territory.owner !== client.sessionId) {
        return { success: false, error: "You don't own this territory." };
      }

      const count = payload.count ?? 1;
      if (count < 1 || count > riskPlayer.armiesToPlace) {
        return { success: false, error: "Invalid army count." };
      }

      territory.armyCount += count;
      riskPlayer.armiesToPlace -= count;

      if (state.gamePhase === "setup" && riskPlayer.armiesToPlace === 0) {
        return { success: true, endsTurn: true };
      }

      if (state.gamePhase === "playing" && state.turnPhase === "reinforce" && riskPlayer.armiesToPlace === 0) {
        state.turnPhase = "attack";
        state.earnedCardThisTurn = false;
      }

      return { success: true };
    },
    attack(state, client, payload): ActionResult {
      if (!isAttackPayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      if (state.turnPhase !== "attack") {
        return { success: false, error: "Not in attack phase." };
      }

      const { from, to, attackerDice } = payload;

      if (!canAttackTerritory(state, from, to, client.sessionId)) {
        return { success: false, error: "Invalid attack." };
      }

      const fromTerritory = state.territories.get(from);
      const toTerritory = state.territories.get(to);

      if (!fromTerritory || !toTerritory) {
        return { success: false, error: "Territory not found." };
      }

      const maxAttackerDice = Math.min(3, fromTerritory.armyCount - 1);
      if (attackerDice < 1 || attackerDice > maxAttackerDice) {
        return { success: false, error: "Invalid number of attacker dice." };
      }

      const defenderDice = Math.min(2, toTerritory.armyCount);
      const result = resolveCombat(
        fromTerritory.armyCount,
        toTerritory.armyCount,
        attackerDice,
        defenderDice,
      );

      fromTerritory.armyCount -= result.attackerLosses;
      toTerritory.armyCount -= result.defenderLosses;

      if (result.conquered) {
        const previousOwner = toTerritory.owner;
        toTerritory.owner = client.sessionId;
        toTerritory.armyCount = attackerDice;
        fromTerritory.armyCount -= attackerDice;

        updatePlayerTerritoryCount(state, client.sessionId);
        updatePlayerTerritoryCount(state, previousOwner);

        if (!state.earnedCardThisTurn) {
          const riskPlayer = state.riskPlayers.get(client.sessionId);
          if (riskPlayer) {
            riskPlayer.cardsHeld += 1;
            state.earnedCardThisTurn = true;
          }
        }

        const winnerId = checkWinCondition(state);
        if (winnerId) {
          return { success: true, endsGame: true };
        }
      }

      return { success: true };
    },
    fortify(state, client, payload): ActionResult {
      if (!isFortifyPayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      if (state.turnPhase !== "fortify") {
        return { success: false, error: "Not in fortify phase." };
      }

      const { from, to, count } = payload;

      if (!canFortifyBetween(state, from, to, client.sessionId)) {
        return { success: false, error: "Invalid fortify move." };
      }

      const fromTerritory = state.territories.get(from);
      const toTerritory = state.territories.get(to);

      if (!fromTerritory || !toTerritory) {
        return { success: false, error: "Territory not found." };
      }

      if (count < 1 || count >= fromTerritory.armyCount) {
        return { success: false, error: "Invalid army count." };
      }

      fromTerritory.armyCount -= count;
      toTerritory.armyCount += count;

      return { success: true, endsTurn: true };
    },
    tradeCards(state, client, payload): ActionResult {
      if (!isTradeCardsPayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      if (state.turnPhase !== "reinforce") {
        return { success: false, error: "Can only trade cards during reinforce phase." };
      }

      const riskPlayer = state.riskPlayers.get(client.sessionId);
      if (!riskPlayer) {
        return { success: false, error: "Player not found." };
      }

      if (payload.cardCount !== 3) {
        return { success: false, error: "Must trade exactly 3 cards." };
      }

      if (riskPlayer.cardsHeld < 3) {
        return { success: false, error: "Not enough cards." };
      }

      riskPlayer.cardsHeld -= 3;
      const bonusArmies = getCardTradeInValue(state.cardTradeInCount);
      riskPlayer.armiesToPlace += bonusArmies;
      state.cardTradeInCount += 1;

      return { success: true };
    },
    endPhase(state, client, _payload): ActionResult {
      if (state.gamePhase === "setup") {
        const activePlayers = Array.from(state.players.values()).filter((p) => !p.isSpectator);
        const allPlayersReady = activePlayers.every((p) => {
          const riskPlayer = state.riskPlayers.get(p.sessionId);
          return riskPlayer && riskPlayer.armiesToPlace === 0;
        });

        if (allPlayersReady) {
          state.gamePhase = "playing";
          state.turnPhase = "reinforce";

          const riskPlayer = state.riskPlayers.get(client.sessionId);
          if (riskPlayer) {
            const ownedTerritories = getOwnedTerritories(state, client.sessionId);
            const reinforcements = calculateReinforcements(
              riskPlayer.territoriesOwned,
              ownedTerritories,
            );
            riskPlayer.armiesToPlace = reinforcements;
          }
        }
        return { success: true, endsTurn: true };
      }

      if (state.turnPhase === "attack") {
        state.turnPhase = "fortify";
        return { success: true };
      }

      if (state.turnPhase === "fortify") {
        state.turnPhase = "reinforce";
        state.earnedCardThisTurn = false;

        const riskPlayer = state.riskPlayers.get(client.sessionId);
        if (riskPlayer && riskPlayer.cardsHeld >= 5) {
          return { success: false, error: "Must trade in cards before ending turn (5+ cards)." };
        }

        return { success: true, endsTurn: true };
      }

      return { success: false, error: "Cannot end phase." };
    },
  },
  conditions: {
    checkGameEnd(state) {
      const winnerId = checkWinCondition(state);
      if (!winnerId) return null;

      const activePlayers = Array.from(state.players.values()).filter((p) => !p.isSpectator);
      return {
        type: "win",
        winnerId,
        scores: Object.fromEntries(
          activePlayers.map((p) => [p.sessionId, p.sessionId === winnerId ? 1 : 0]),
        ),
        metadata: {
          territoriesOwned: state.riskPlayers.get(winnerId)?.territoriesOwned ?? 0,
        },
      };
    },
    validateAction(state, client, actionType, payload) {
      if (state.currentTurn !== client.sessionId) {
        return false;
      }

      if (actionType === "placeArmy") {
        if (state.gamePhase === "setup" && state.turnPhase === "setup-place") {
          return isPlaceArmyPayload(payload);
        }
        if (state.gamePhase === "playing" && state.turnPhase === "reinforce") {
          return isPlaceArmyPayload(payload);
        }
        return false;
      }

      if (actionType === "attack") {
        return state.turnPhase === "attack" && isAttackPayload(payload);
      }

      if (actionType === "fortify") {
        return state.turnPhase === "fortify" && isFortifyPayload(payload);
      }

      if (actionType === "tradeCards") {
        return state.turnPhase === "reinforce" && isTradeCardsPayload(payload);
      }

      if (actionType === "endPhase") {
        return true;
      }

      return false;
    },
  },
};

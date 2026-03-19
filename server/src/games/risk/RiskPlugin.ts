/**
 * Risk Game Plugin
 * 
 * Classic world domination strategy game implementation for Eschaton playgrid.
 * 
 * ## Phase 1 Limitations
 * 
 * This is a simplified Phase 1 implementation with the following intentional scope cuts:
 * 
 * - **Cards are counters only**: No card types or visual representation. Cards are tracked
 *   as a simple integer count per player. Trade-ins follow standard Risk escalation rules.
 * 
 * - **Fortification is adjacency-only**: Players can only fortify between directly adjacent
 *   territories they own. Path-based fortification (moving armies through a chain of owned
 *   territories) is not supported in Phase 1.
 * 
 * These simplifications were made to ship a playable version quickly while maintaining
 * core Risk gameplay mechanics (combat, reinforcements, continent bonuses, win conditions).
 */

import type { Client } from "colyseus";
import {
  RiskState,
  TerritoryState,
  RiskPlayerState,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
  TERRITORIES,
  areTerritoriesAdjacent,
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
  performQuickstartSetup,
} from "./riskLogic.js";

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

type CaptureMovePayload = {
  count: number;
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

function isCaptureMovePayload(payload: unknown): payload is CaptureMovePayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return typeof candidate.count === "number";
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
      { id: "capture-move", name: "Capture Move", allowedActions: ["captureMove"], optional: true },
      { id: "fortify", name: "Fortify", allowedActions: ["fortify", "endPhase"], optional: true },
    ],
    turnTimerConfig: {
      enabled: true,
      turnDurationMs: 90_000,
      warningThresholdMs: 15_000,
      penalties: [
        { type: "warning", message: "Time's up! This is your first warning — timer reset." },
        { type: "warning", message: "Final warning! Timer reset one last time." },
        { type: "auto-pass" },
      ],
    },
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
    onTurnStarted(state, newPlayerId) {
      if (state.gamePhase !== "playing") return;

      state.turnPhase = "reinforce";
      state.earnedCardThisTurn = false;

      const riskPlayer = state.riskPlayers.get(newPlayerId);
      if (riskPlayer) {
        const ownedTerritories = getOwnedTerritories(state, newPlayerId);
        const reinforcements = calculateReinforcements(
          riskPlayer.territoriesOwned,
          ownedTerritories,
        );
        riskPlayer.armiesToPlace = reinforcements;
      }
    },
    onCreate(state, options) {
      state.quickstart = options.quickstart === true;
    },
    onGameStart(state) {
      for (const territory of TERRITORIES) {
        const territoryState = new TerritoryState();
        territoryState.owner = "";
        territoryState.armyCount = 0;
        state.territories.set(territory.id, territoryState);
      }

      if (state.quickstart) {
        performQuickstartSetup(state);
        state.gamePhase = "playing";
        state.turnPhase = "reinforce";
        state.cardTradeInCount = 0;
        state.earnedCardThisTurn = false;

        // Derive first player from sorted player list (currentTurn not set yet)
        const sortedPlayers = Array.from(state.players.values()).sort(
          (a, b) => a.playerIndex - b.playerIndex,
        );
        if (sortedPlayers.length > 0) {
          const firstPlayerId = sortedPlayers[0].sessionId;
          const firstPlayer = state.riskPlayers.get(firstPlayerId);
          if (firstPlayer) {
            const ownedTerritories = getOwnedTerritories(state, firstPlayerId);
            const reinforcements = calculateReinforcements(
              firstPlayer.territoriesOwned,
              ownedTerritories,
            );
            firstPlayer.armiesToPlace = reinforcements;
          }
        }
      } else {
        initializeSetup(state);
        state.gamePhase = "setup";
        state.turnPhase = "setup-pick";
        state.setupTerritoryIndex = 0;
        state.cardTradeInCount = 0;
        state.earnedCardThisTurn = false;
      }
    },
    onAutoPass(state, sessionId) {
      if (state.gamePhase === "setup") {
        // During setup, auto-pass just advances to the next player
        return false;
      }

      // During playing phase: auto-place remaining armies if in reinforce,
      // then skip attack/fortify and end the turn.
      const riskPlayer = state.riskPlayers.get(sessionId);
      if (riskPlayer && riskPlayer.armiesToPlace > 0) {
        // Auto-place remaining armies on the first owned territory
        for (const territory of state.territories.values()) {
          if (territory.owner === sessionId) {
            territory.armyCount += riskPlayer.armiesToPlace;
            riskPlayer.armiesToPlace = 0;
            break;
          }
        }
      }

      // Clear any in-progress capture-move state
      if (state.turnPhase === "capture-move") {
        const fromTerritory = state.territories.get(state.captureFromId);
        const toTerritory = state.territories.get(state.captureToId);
        if (fromTerritory && toTerritory) {
          // Auto-move minimum armies
          const minMove = state.captureDiceCount;
          toTerritory.armyCount = minMove;
          fromTerritory.armyCount -= minMove;
        }
        state.captureFromId = "";
        state.captureToId = "";
        state.captureDiceCount = 0;
      }

      state.turnPhase = "reinforce";
      return false;
    },
  },
  actions: {
    pickTerritory(state, client, payload): ActionResult {
      if (!isPickTerritoryPayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      if (state.turnPhase !== "setup-pick") {
        return { success: false, error: "Not in territory pick phase." };
      }

      const territory = state.territories.get(payload.territoryId);
      if (!territory) {
        return { success: false, error: "Territory not found." };
      }

      if (territory.owner !== "") {
        return { success: false, error: "Territory already claimed." };
      }

      territory.owner = client.sessionId;
      territory.armyCount = 1;
      updatePlayerTerritoryCount(state, client.sessionId);

      // Check if all territories are now claimed
      let allClaimed = true;
      state.territories.forEach((t) => {
        if (t.owner === "") {
          allClaimed = false;
        }
      });

      if (allClaimed) {
        const activePlayers = Array.from(state.players.values())
          .filter((p) => !p.isSpectator);
        const initialArmies = calculateInitialArmies(activePlayers.length);

        for (const player of activePlayers) {
          const riskPlayer = state.riskPlayers.get(player.sessionId);
          if (riskPlayer) {
            riskPlayer.armiesToPlace = initialArmies - riskPlayer.territoriesOwned;
          }
        }

        state.turnPhase = "setup-place";
      }

      return { success: true, endsTurn: true };
    },
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
        // Check if ALL players have finished placing — transition to playing phase
        const activePlayers = Array.from(state.players.values()).filter((p) => !p.isSpectator);
        const allDone = activePlayers.every((p) => {
          const rp = state.riskPlayers.get(p.sessionId);
          return rp && rp.armiesToPlace === 0;
        });

        if (allDone) {
          state.gamePhase = "playing";
          state.turnPhase = "reinforce";
        }

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

        updatePlayerTerritoryCount(state, client.sessionId);
        updatePlayerTerritoryCount(state, previousOwner);

        if (!state.earnedCardThisTurn) {
          const riskPlayer = state.riskPlayers.get(client.sessionId);
          if (riskPlayer) {
            riskPlayer.cardsHeld += 1;
            state.earnedCardThisTurn = true;
          }
        }

        // Transfer cards from eliminated player
        const eliminatedPlayer = state.riskPlayers.get(previousOwner);
        if (eliminatedPlayer && eliminatedPlayer.territoriesOwned === 0 && eliminatedPlayer.cardsHeld > 0) {
          const attacker = state.riskPlayers.get(client.sessionId);
          if (attacker) {
            attacker.cardsHeld += eliminatedPlayer.cardsHeld;
            eliminatedPlayer.cardsHeld = 0;
          }
        }

        const winnerId = checkWinCondition(state);
        if (winnerId) {
          // Auto-move armies on game-winning conquest
          toTerritory.armyCount = attackerDice;
          fromTerritory.armyCount -= attackerDice;
          return { success: true, endsGame: true };
        }

        // Enter capture-move phase so player can choose how many armies to move
        const maxMove = fromTerritory.armyCount - 1;
        if (attackerDice >= maxMove) {
          // Only one valid choice — auto-move
          toTerritory.armyCount = maxMove;
          fromTerritory.armyCount = 1;
        } else {
          state.captureFromId = from;
          state.captureToId = to;
          state.captureDiceCount = attackerDice;
          state.turnPhase = "capture-move";
        }
      }

      return { success: true };
    },
    captureMove(state, client, payload): ActionResult {
      if (!isCaptureMovePayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      if (state.turnPhase !== "capture-move") {
        return { success: false, error: "Not in capture-move phase." };
      }

      const fromTerritory = state.territories.get(state.captureFromId);
      const toTerritory = state.territories.get(state.captureToId);

      if (!fromTerritory || !toTerritory) {
        return { success: false, error: "Capture territories not found." };
      }

      const minMove = state.captureDiceCount;
      const maxMove = fromTerritory.armyCount - 1;
      const { count } = payload;

      if (count < minMove || count > maxMove) {
        return { success: false, error: `Must move between ${minMove} and ${maxMove} armies.` };
      }

      toTerritory.armyCount = count;
      fromTerritory.armyCount -= count;

      state.captureFromId = "";
      state.captureToId = "";
      state.captureDiceCount = 0;
      state.turnPhase = "attack";

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
      if (state.turnPhase === "capture-move") {
        return { success: false, error: "Must move armies into captured territory first." };
      }

      if (state.gamePhase === "setup") {
        const activePlayers = Array.from(state.players.values()).filter((p) => !p.isSpectator);
        const allPlayersReady = activePlayers.every((p) => {
          const riskPlayer = state.riskPlayers.get(p.sessionId);
          return riskPlayer && riskPlayer.armiesToPlace === 0;
        });

        if (allPlayersReady) {
          state.gamePhase = "playing";
        }
        return { success: true, endsTurn: true };
      }

      if (state.turnPhase === "attack") {
        state.turnPhase = "fortify";
        return { success: true };
      }

      if (state.turnPhase === "fortify") {
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
      if (state.gamePhase === "setup") return null;
      const winnerId = checkWinCondition(state);
      if (!winnerId) return null;

      const activePlayers = Array.from(state.players.values()).filter((p) => !p.isSpectator);

      const playerStats: Record<string, unknown> = {};
      for (const player of activePlayers) {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        let armies = 0;
        for (const territory of state.territories.values()) {
          if (territory.owner === player.sessionId) {
            armies += territory.armyCount;
          }
        }
        playerStats[player.sessionId] = {
          territories: riskPlayer?.territoriesOwned ?? 0,
          armies,
        };
      }

      return {
        type: "win",
        winnerId,
        scores: Object.fromEntries(
          activePlayers.map((p) => [p.sessionId, p.sessionId === winnerId ? 1 : 0]),
        ),
        metadata: {
          territoriesOwned: state.riskPlayers.get(winnerId)?.territoriesOwned ?? 0,
          ...playerStats,
        },
      };
    },
    validateAction(state, client, actionType, payload) {
      if (state.currentTurn !== client.sessionId) {
        return false;
      }

      if (actionType === "pickTerritory") {
        return state.gamePhase === "setup" && state.turnPhase === "setup-pick" && isPickTerritoryPayload(payload);
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

      if (actionType === "captureMove") {
        return state.turnPhase === "capture-move" && isCaptureMovePayload(payload);
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

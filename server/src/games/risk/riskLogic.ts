import type { RiskState } from "@eschaton/shared";
import { CONTINENTS, TERRITORIES, areTerritoriesAdjacent } from "@eschaton/shared";

type TurnPhase = "setup-pick" | "setup-place" | "reinforce" | "attack" | "capture-move" | "fortify";

export function calculateReinforcements(
  territoriesOwned: number,
  ownedTerritories: string[],
): number {
  let reinforcements = Math.max(3, Math.floor(territoriesOwned / 3));

  for (const continent of CONTINENTS) {
    const ownsContinent = continent.territories.every((t) => ownedTerritories.includes(t));
    if (ownsContinent) {
      reinforcements += continent.bonusArmies;
    }
  }

  return reinforcements;
}

export function getCardTradeInValue(tradeInCount: number): number {
  if (tradeInCount === 0) return 4;
  if (tradeInCount === 1) return 6;
  if (tradeInCount === 2) return 8;
  if (tradeInCount === 3) return 10;
  if (tradeInCount === 4) return 12;
  if (tradeInCount === 5) return 15;
  return 15 + (tradeInCount - 5) * 5;
}

export function rollDice(count: number): number[] {
  const dice: number[] = [];
  for (let i = 0; i < count; i++) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }
  return dice.sort((a, b) => b - a);
}

export interface AttackResult {
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
}

export function resolveCombat(
  attackerArmies: number,
  defenderArmies: number,
  attackDiceCount: number,
  defenseDiceCount: number,
): AttackResult {
  const attackerDice = rollDice(attackDiceCount);
  const defenderDice = rollDice(defenseDiceCount);

  let attackerLosses = 0;
  let defenderLosses = 0;

  const comparisons = Math.min(attackerDice.length, defenderDice.length);

  for (let i = 0; i < comparisons; i++) {
    if (attackerDice[i] > defenderDice[i]) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }

  const newDefenderArmies = defenderArmies - defenderLosses;
  const conquered = newDefenderArmies === 0;

  return { attackerLosses, defenderLosses, conquered };
}

export function canAttackFrom(
  state: RiskState,
  territoryId: string,
  sessionId: string,
): boolean {
  const territory = state.territories.get(territoryId);
  if (!territory) return false;
  if (territory.owner !== sessionId) return false;
  if (territory.armyCount <= 1) return false;
  return true;
}

export function canAttackTerritory(
  state: RiskState,
  fromId: string,
  toId: string,
  sessionId: string,
): boolean {
  const from = state.territories.get(fromId);
  const to = state.territories.get(toId);

  if (!from || !to) return false;
  if (from.owner !== sessionId) return false;
  if (to.owner === sessionId) return false;
  if (from.armyCount <= 1) return false;
  if (!areTerritoriesAdjacent(fromId, toId)) return false;

  return true;
}

export function canFortifyBetween(
  state: RiskState,
  fromId: string,
  toId: string,
  sessionId: string,
): boolean {
  const from = state.territories.get(fromId);
  const to = state.territories.get(toId);

  if (!from || !to) return false;
  if (from.owner !== sessionId) return false;
  if (to.owner !== sessionId) return false;
  if (from.armyCount <= 1) return false;
  if (!areTerritoriesAdjacent(fromId, toId)) return false;

  return true;
}

export function getOwnedTerritories(state: RiskState, sessionId: string): string[] {
  const owned: string[] = [];
  state.territories.forEach((territory, id) => {
    if (territory.owner === sessionId) {
      owned.push(id);
    }
  });
  return owned;
}

export function updatePlayerTerritoryCount(state: RiskState, sessionId: string): void {
  const count = getOwnedTerritories(state, sessionId).length;
  const riskPlayer = state.riskPlayers.get(sessionId);
  if (riskPlayer) {
    riskPlayer.territoriesOwned = count;
  }
}

export function checkWinCondition(state: RiskState): string | null {
  const owners = new Set<string>();
  state.territories.forEach((territory) => {
    if (territory.owner) {
      owners.add(territory.owner);
    }
  });

  if (owners.size === 1) {
    return Array.from(owners)[0];
  }

  return null;
}

export function getNextPhase(currentPhase: TurnPhase): TurnPhase {
  if (currentPhase === "setup-pick") return "setup-place";
  if (currentPhase === "setup-place") return "setup-place";
  if (currentPhase === "reinforce") return "attack";
  if (currentPhase === "attack") return "fortify";
  if (currentPhase === "fortify") return "reinforce";
  return "reinforce";
}

export function initializeSetup(state: RiskState): void {
  for (const territory of TERRITORIES) {
    const territoryState = state.territories.get(territory.id);
    if (territoryState) {
      territoryState.owner = "";
      territoryState.armyCount = 0;
    }
  }

  const activePlayers = Array.from(state.players.values()).filter((p) => !p.isSpectator);
  for (const player of activePlayers) {
    const riskPlayer = state.riskPlayers.get(player.sessionId);
    if (riskPlayer) {
      riskPlayer.cardsHeld = 0;
      riskPlayer.territoriesOwned = 0;
      riskPlayer.armiesToPlace = 0;
    }
  }
}

export function calculateInitialArmies(playerCount: number): number {
  if (playerCount === 2) return 40;
  if (playerCount === 3) return 35;
  if (playerCount === 4) return 30;
  if (playerCount === 5) return 25;
  if (playerCount === 6) return 20;
  return 20;
}

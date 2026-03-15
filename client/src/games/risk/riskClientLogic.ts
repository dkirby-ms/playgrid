import type { RiskState } from "@eschaton/shared";

export function canPlaceArmy(
  state: RiskState,
  territoryId: string,
  sessionId: string,
): boolean {
  const territory = state.territories.get(territoryId);
  if (!territory) return false;

  if (state.turnPhase === "setup-pick") {
    return territory.owner === "";
  }

  if (state.turnPhase === "setup-place" || state.turnPhase === "reinforce") {
    return territory.owner === sessionId;
  }

  return false;
}

export function canSelectForAttack(
  state: RiskState,
  territoryId: string,
  sessionId: string,
): boolean {
  if (state.turnPhase !== "attack") return false;
  const territory = state.territories.get(territoryId);
  if (!territory) return false;
  if (territory.owner !== sessionId) return false;
  if (territory.armyCount <= 1) return false;
  return true;
}

export function canSelectForFortify(
  state: RiskState,
  territoryId: string,
  sessionId: string,
): boolean {
  if (state.turnPhase !== "fortify") return false;
  const territory = state.territories.get(territoryId);
  if (!territory) return false;
  if (territory.owner !== sessionId) return false;
  if (territory.armyCount <= 1) return false;
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

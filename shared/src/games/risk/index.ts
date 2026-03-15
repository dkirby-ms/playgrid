export { RiskState, TerritoryState, RiskPlayerState } from "./RiskState.js";
export type { TurnPhase, GamePhase } from "./RiskState.js";
export {
  TERRITORIES,
  CONTINENTS,
  TERRITORY_COUNT,
  getTerritoryById,
  areTerritoriesAdjacent,
  getContinentByTerritoryId,
} from "./territoryData.js";
export type { Territory, Continent } from "./territoryData.js";

import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";
import { BaseGameState } from "../../BaseGameState.js";

export class TerritoryState extends Schema {
  declare owner: string;
  declare armyCount: number;

  constructor() {
    super();
    this.owner = "";
    this.armyCount = 0;
  }
}

defineTypes(TerritoryState, {
  owner: "string",
  armyCount: "number",
});

export class RiskPlayerState extends Schema {
  declare sessionId: string;
  declare cardsHeld: number;
  declare territoriesOwned: number;
  declare armiesToPlace: number;

  constructor() {
    super();
    this.sessionId = "";
    this.cardsHeld = 0;
    this.territoriesOwned = 0;
    this.armiesToPlace = 0;
  }
}

defineTypes(RiskPlayerState, {
  sessionId: "string",
  cardsHeld: "number",
  territoriesOwned: "number",
  armiesToPlace: "number",
});

export type TurnPhase = "setup-pick" | "setup-place" | "reinforce" | "attack" | "capture-move" | "fortify";
export type GamePhase = "setup" | "playing";

export class RiskState extends BaseGameState {
  declare territories: MapSchema<TerritoryState>;
  declare riskPlayers: MapSchema<RiskPlayerState>;
  declare turnPhase: TurnPhase;
  declare gamePhase: GamePhase;
  declare setupTerritoryIndex: number;
  declare cardTradeInCount: number;
  declare earnedCardThisTurn: boolean;
  declare captureFromId: string;
  declare captureToId: string;
  declare captureDiceCount: number;

  constructor() {
    super();
    this.territories = new MapSchema<TerritoryState>();
    this.riskPlayers = new MapSchema<RiskPlayerState>();
    this.turnPhase = "setup-pick";
    this.gamePhase = "setup";
    this.setupTerritoryIndex = 0;
    this.cardTradeInCount = 0;
    this.earnedCardThisTurn = false;
    this.captureFromId = "";
    this.captureToId = "";
    this.captureDiceCount = 0;
  }
}

defineTypes(RiskState, {
  territories: { map: TerritoryState },
  riskPlayers: { map: RiskPlayerState },
  turnPhase: "string",
  gamePhase: "string",
  setupTerritoryIndex: "number",
  cardTradeInCount: "number",
  earnedCardThisTurn: "boolean",
  captureFromId: "string",
  captureToId: "string",
  captureDiceCount: "number",
});

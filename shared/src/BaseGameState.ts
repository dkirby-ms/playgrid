import { Schema, defineTypes, MapSchema } from "@colyseus/schema";

export class PlayerInfo extends Schema {
  declare sessionId: string;
  declare displayName: string;
  declare playerIndex: number;
  declare isSpectator: boolean;
  declare isConnected: boolean;

  constructor() {
    super();
    this.sessionId = "";
    this.displayName = "";
    this.playerIndex = 0;
    this.isSpectator = false;
    this.isConnected = true;
  }
}
defineTypes(PlayerInfo, {
  sessionId: "string",
  displayName: "string",
  playerIndex: "number",
  isSpectator: "boolean",
  isConnected: "boolean",
});

export class BaseGameState extends Schema {
  declare phase: string;
  declare currentTurn: string;
  declare turnNumber: number;
  declare players: MapSchema<PlayerInfo>;

  constructor() {
    super();
    this.phase = "waiting";
    this.currentTurn = "";
    this.turnNumber = 0;
    this.players = new MapSchema<PlayerInfo>();
  }
}
defineTypes(BaseGameState, {
  phase: "string",
  currentTurn: "string",
  turnNumber: "number",
  players: { map: PlayerInfo },
});

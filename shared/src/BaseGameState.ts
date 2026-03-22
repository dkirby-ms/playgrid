import { Schema, defineTypes, MapSchema } from "@colyseus/schema";

export class PlayerInfo extends Schema {
  declare sessionId: string;
  declare displayName: string;
  declare playerIndex: number;
  declare isSpectator: boolean;
  declare isConnected: boolean;
  declare controllerSessionId: string;

  constructor() {
    super();
    this.sessionId = "";
    this.displayName = "";
    this.playerIndex = 0;
    this.isSpectator = false;
    this.isConnected = true;
    this.controllerSessionId = "";
  }
}
defineTypes(PlayerInfo, {
  sessionId: "string",
  displayName: "string",
  playerIndex: "number",
  isSpectator: "boolean",
  isConnected: "boolean",
  controllerSessionId: "string",
});

export class BaseGameState extends Schema {
  declare phase: string;
  declare currentTurn: string;
  declare turnNumber: number;
  declare players: MapSchema<PlayerInfo>;
  declare turnTimeRemaining: number;
  declare timerWarningActive: boolean;
  declare turnTimeoutCount: number;
  declare player1TimeRemainingMs: number;
  declare player2TimeRemainingMs: number;

  constructor() {
    super();
    this.phase = "waiting";
    this.currentTurn = "";
    this.turnNumber = 0;
    this.players = new MapSchema<PlayerInfo>();
    this.turnTimeRemaining = 0;
    this.timerWarningActive = false;
    this.turnTimeoutCount = 0;
    this.player1TimeRemainingMs = 0;
    this.player2TimeRemainingMs = 0;
  }
}
defineTypes(BaseGameState, {
  phase: "string",
  currentTurn: "string",
  turnNumber: "number",
  players: { map: PlayerInfo },
  turnTimeRemaining: "number",
  timerWarningActive: "boolean",
  turnTimeoutCount: "number",
  player1TimeRemainingMs: "number",
  player2TimeRemainingMs: "number",
});

import { Schema, defineTypes, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  declare sessionId: string;
  declare x: number;
  declare y: number;

  constructor() {
    super();
    this.sessionId = "";
    this.x = 0;
    this.y = 0;
  }
}
defineTypes(Player, {
  sessionId: "string",
  x: "number",
  y: "number",
});

export class GameState extends Schema {
  declare players: MapSchema<Player>;
  declare tick: number;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
    this.tick = 0;
  }
}
defineTypes(GameState, {
  players: { map: Player },
  tick: "number",
});

export { BaseGameState, PlayerInfo } from "./BaseGameState.js";

// Shared constants
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TICK_RATE = 4;

export * from "./lobbyTypes.js";
export type {
  ActionHandler,
  ActionResult,
  GameActionHandlers,
  GameConditions,
  GameLifecycle,
  GameMetadata,
  GameOptions,
  GamePlugin,
  GameResult,
  StateFilter,
  TurnConfiguration,
  TurnMode,
  TurnOrderStrategy,
  TurnPhase,
} from "./gamePlugin.js";
export * from "./games/checkers/index.js";
export { BackgammonState } from "./games/backgammon/index.js";

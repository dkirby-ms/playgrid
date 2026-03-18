import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";
import { BaseGameState } from "../../BaseGameState.js";

export class DominoTile extends Schema {
  declare id: number;
  declare highPips: number;
  declare lowPips: number;

  constructor() {
    super();
    this.id = 0;
    this.highPips = 0;
    this.lowPips = 0;
  }
}
defineTypes(DominoTile, {
  id: "number",
  highPips: "number",
  lowPips: "number",
});

export class BoardTile extends Schema {
  declare id: number;
  declare highPips: number;
  declare lowPips: number;
  /** Which pip value faces the left/top end of the chain */
  declare exposedEnd: number;
  /** Which arm this tile belongs to: "a", "b", "c", "d", "spinner", or "" (pre-spinner linear) */
  declare arm: string;
  /** Whether this tile is a double */
  declare isDouble: boolean;

  constructor() {
    super();
    this.id = 0;
    this.highPips = 0;
    this.lowPips = 0;
    this.exposedEnd = -1;
    this.arm = "";
    this.isDouble = false;
  }
}
defineTypes(BoardTile, {
  id: "number",
  highPips: "number",
  lowPips: "number",
  exposedEnd: "number",
  arm: "string",
  isDouble: "boolean",
});

export class DominosPlayerState extends Schema {
  /** Number of tiles in this player's hand (actual tiles are server-side only) */
  declare handCount: number;
  declare score: number;
  declare passed: boolean;

  constructor() {
    super();
    this.handCount = 0;
    this.score = 0;
    this.passed = false;
  }
}
defineTypes(DominosPlayerState, {
  handCount: "number",
  score: "number",
  passed: "boolean",
});

export class DominosState extends BaseGameState {
  /** Tiles played on the board in order, forming a chain */
  declare board: ArraySchema<BoardTile>;
  /** Open pip value on one end of the chain (-1 if board is empty) */
  declare openEndA: number;
  /** Open pip value on the other end of the chain (-1 if board is empty) */
  declare openEndB: number;
  /** Open pip value on perpendicular arm C (-1 if inactive) */
  declare openEndC: number;
  /** Open pip value on perpendicular arm D (-1 if inactive) */
  declare openEndD: number;
  /** Per-player game state keyed by sessionId */
  declare playerStates: MapSchema<DominosPlayerState>;
  /** Number of tiles remaining in the boneyard (hidden from clients) */
  declare boneyardCount: number;
  /** ID of the last tile played (-1 if none) */
  declare lastPlayedTileId: number;
  /** Which end the last tile was placed on: "a", "b", or "" */
  declare lastPlayedEnd: string;
  /** ID of the spinner tile (-1 if no spinner yet) */
  declare spinnerTileId: number;
  /** Number of tiles placed on arm A (after spinner exists) */
  declare armACount: number;
  /** Number of tiles placed on arm B (after spinner exists) */
  declare armBCount: number;

  constructor() {
    super();
    this.board = new ArraySchema<BoardTile>();
    this.openEndA = -1;
    this.openEndB = -1;
    this.openEndC = -1;
    this.openEndD = -1;
    this.playerStates = new MapSchema<DominosPlayerState>();
    this.boneyardCount = 0;
    this.lastPlayedTileId = -1;
    this.lastPlayedEnd = "";
    this.spinnerTileId = -1;
    this.armACount = 0;
    this.armBCount = 0;
  }
}
defineTypes(DominosState, {
  board: [BoardTile],
  openEndA: "number",
  openEndB: "number",
  openEndC: "number",
  openEndD: "number",
  playerStates: { map: DominosPlayerState },
  boneyardCount: "number",
  lastPlayedTileId: "number",
  lastPlayedEnd: "string",
  spinnerTileId: "number",
  armACount: "number",
  armBCount: "number",
});

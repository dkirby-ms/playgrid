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

  constructor() {
    super();
    this.id = 0;
    this.highPips = 0;
    this.lowPips = 0;
    this.exposedEnd = -1;
  }
}
defineTypes(BoardTile, {
  id: "number",
  highPips: "number",
  lowPips: "number",
  exposedEnd: "number",
});

export class DominosPlayerState extends Schema {
  declare hand: ArraySchema<DominoTile>;
  declare score: number;
  declare passed: boolean;

  constructor() {
    super();
    this.hand = new ArraySchema<DominoTile>();
    this.score = 0;
    this.passed = false;
  }
}
defineTypes(DominosPlayerState, {
  hand: [DominoTile],
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
  /** Per-player game state keyed by sessionId */
  declare playerStates: MapSchema<DominosPlayerState>;
  /** Number of tiles remaining in the boneyard (hidden from clients) */
  declare boneyardCount: number;
  /** ID of the last tile played (-1 if none) */
  declare lastPlayedTileId: number;
  /** Which end the last tile was placed on: "a", "b", or "" */
  declare lastPlayedEnd: string;

  constructor() {
    super();
    this.board = new ArraySchema<BoardTile>();
    this.openEndA = -1;
    this.openEndB = -1;
    this.playerStates = new MapSchema<DominosPlayerState>();
    this.boneyardCount = 0;
    this.lastPlayedTileId = -1;
    this.lastPlayedEnd = "";
  }
}
defineTypes(DominosState, {
  board: [BoardTile],
  openEndA: "number",
  openEndB: "number",
  playerStates: { map: DominosPlayerState },
  boneyardCount: "number",
  lastPlayedTileId: "number",
  lastPlayedEnd: "string",
});

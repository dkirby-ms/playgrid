import { ArraySchema, defineTypes } from "@colyseus/schema";
import { BaseGameState } from "../../BaseGameState.js";

export const EMPTY = 0;
export const BLACK = 1;
export const RED = 2;
export const BLACK_KING = 3;
export const RED_KING = 4;

export class CheckersState extends BaseGameState {
  declare board: ArraySchema<number>;
  declare mustCaptureFrom: number;

  constructor() {
    super();
    this.board = new ArraySchema<number>(...Array.from({ length: 64 }, () => EMPTY));
    this.mustCaptureFrom = -1;
  }
}

defineTypes(CheckersState, {
  board: ["number"],
  mustCaptureFrom: "number",
});

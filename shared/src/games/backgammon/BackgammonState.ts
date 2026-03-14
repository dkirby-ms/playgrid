import { ArraySchema, defineTypes } from "@colyseus/schema";
import { BaseGameState } from "../../BaseGameState.js";

export const EMPTY = 0;
export const BLACK = 1;
export const RED = 2;

export class BackgammonState extends BaseGameState {
  declare points: ArraySchema<number>;
  declare blackBar: number;
  declare redBar: number;
  declare blackBorneOff: number;
  declare redBorneOff: number;
  declare dice: ArraySchema<number>;
  declare usedDice: ArraySchema<boolean>;

  constructor() {
    super();
    this.points = new ArraySchema<number>(...Array.from({ length: 24 }, () => 0));
    this.blackBar = 0;
    this.redBar = 0;
    this.blackBorneOff = 0;
    this.redBorneOff = 0;
    this.dice = new ArraySchema<number>(0, 0);
    this.usedDice = new ArraySchema<boolean>(false, false);
  }
}

defineTypes(BackgammonState, {
  points: ["number"],
  blackBar: "number",
  redBar: "number",
  blackBorneOff: "number",
  redBorneOff: "number",
  dice: ["number"],
  usedDice: ["boolean"],
});

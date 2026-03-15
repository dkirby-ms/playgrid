import { BLACK, EMPTY, RED } from "@eschaton/shared";
import { describe, expect, it } from "vitest";
import {
  getPlayerColorFromPlayerIndex,
  getValidMoves,
  NO_FORCED_CAPTURE,
} from "./checkersClientLogic";

function createEmptyBoard(): number[] {
  return Array.from({ length: 64 }, () => EMPTY);
}

describe("checkersClientLogic", () => {
  it("maps player indexes to colors", () => {
    expect(getPlayerColorFromPlayerIndex(0)).toBe(BLACK);
    expect(getPlayerColorFromPlayerIndex(1)).toBe(RED);
    expect(getPlayerColorFromPlayerIndex(2)).toBeNull();
  });

  it("returns simple diagonal moves when no captures exist", () => {
    const board = createEmptyBoard();
    board[17] = BLACK;

    expect(getValidMoves(board, 17, NO_FORCED_CAPTURE).map((move) => move.to).sort((a, b) => a - b)).toEqual([
      24,
      26,
    ]);
  });

  it("only allows capture moves when any capture is available", () => {
    const board = createEmptyBoard();
    board[10] = BLACK;
    board[19] = BLACK;
    board[26] = RED;

    expect(getValidMoves(board, 10, NO_FORCED_CAPTURE)).toEqual([]);
    expect(getValidMoves(board, 19, NO_FORCED_CAPTURE)).toEqual([
      { from: 19, to: 33, captures: 26 },
    ]);
  });

  it("restricts moves to the forced capture square during jump chains", () => {
    const board = createEmptyBoard();
    board[19] = BLACK;
    board[26] = RED;

    expect(getValidMoves(board, 17, 19)).toEqual([]);
    expect(getValidMoves(board, 19, 19)).toEqual([
      { from: 19, to: 33, captures: 26 },
    ]);
  });
});

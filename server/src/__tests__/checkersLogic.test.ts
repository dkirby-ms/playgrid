import { describe, expect, it } from "vitest";

import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED,
  RED_KING,
} from "@eschaton/playgrid-shared";

import {
  applyMove,
  checkWinCondition,
  getAllMovesForPlayer,
  getValidMoves,
  initializeBoard,
  isValidMove,
} from "../games/checkers/checkersLogic";

function createEmptyBoard(): number[] {
  return Array.from({ length: 64 }, () => EMPTY);
}

describe("checkersLogic", () => {
  it("initializes a standard checkers board", () => {
    const board = initializeBoard();

    expect(board).toHaveLength(64);
    expect(board.filter((piece) => piece === BLACK)).toHaveLength(12);
    expect(board.filter((piece) => piece === RED)).toHaveLength(12);
    expect(board.filter((piece) => piece === EMPTY)).toHaveLength(40);
    expect(board[1]).toBe(BLACK);
    expect(board[17]).toBe(BLACK);
    expect(board[40]).toBe(RED);
    expect(board[62]).toBe(RED);
    expect(board[0]).toBe(EMPTY);
    expect(board[27]).toBe(EMPTY);
  });

  it("returns simple forward diagonal moves for a regular piece", () => {
    const board = initializeBoard();

    expect(getValidMoves(board, 17, -1)).toEqual([
      { from: 17, to: 24 },
      { from: 17, to: 26 },
    ]);
    expect(isValidMove(board, 17, 26, BLACK, -1)).toBe(true);
    expect(isValidMove(board, 17, 10, BLACK, -1)).toBe(false);
  });

  it("enforces forced captures across the whole player move set", () => {
    const board = createEmptyBoard();
    board[17] = BLACK;
    board[26] = RED;
    board[21] = BLACK;

    expect(getValidMoves(board, 17, -1)).toEqual([
      { from: 17, to: 35, captures: 26 },
    ]);
    expect(getValidMoves(board, 21, -1)).toEqual([]);
    expect(getAllMovesForPlayer(board, BLACK, -1)).toEqual([
      { from: 17, to: 35, captures: 26 },
    ]);
    expect(isValidMove(board, 21, 28, BLACK, -1)).toBe(false);
  });

  it("continues forced capture chains after a jump", () => {
    const board = createEmptyBoard();
    board[17] = BLACK;
    board[26] = RED;
    board[44] = RED;

    const firstMove = applyMove(board, 17, 35);

    expect(firstMove.captured).toBe(26);
    expect(firstMove.continuesChain).toBe(true);
    expect(firstMove.board[17]).toBe(EMPTY);
    expect(firstMove.board[26]).toBe(EMPTY);
    expect(firstMove.board[35]).toBe(BLACK);
    expect(getValidMoves(firstMove.board, 35, 35)).toEqual([
      { from: 35, to: 53, captures: 44 },
    ]);
    expect(getAllMovesForPlayer(firstMove.board, BLACK, 35)).toEqual([
      { from: 35, to: 53, captures: 44 },
    ]);
  });

  it("promotes pieces that reach the back row and lets kings move backward", () => {
    const board = createEmptyBoard();
    board[49] = BLACK;

    const result = applyMove(board, 49, 56);

    expect(result.isKingPromotion).toBe(true);
    expect(result.board[56]).toBe(BLACK_KING);

    const kingBoard = createEmptyBoard();
    kingBoard[35] = BLACK_KING;

    expect(getValidMoves(kingBoard, 35, -1)).toEqual([
      { from: 35, to: 42 },
      { from: 35, to: 44 },
      { from: 35, to: 26 },
      { from: 35, to: 28 },
    ]);
  });

  it("recognizes win conditions when the opponent has no pieces or no legal moves", () => {
    const noPiecesBoard = createEmptyBoard();
    noPiecesBoard[17] = BLACK;

    expect(checkWinCondition(noPiecesBoard, BLACK)).toBe(BLACK);

    const blockedBoard = createEmptyBoard();
    blockedBoard[62] = BLACK;
    blockedBoard[1] = RED;

    expect(checkWinCondition(blockedBoard, BLACK)).toBe(BLACK);
  });

  it("supports red movement and red king promotion", () => {
    const board = createEmptyBoard();
    board[46] = RED;

    expect(getValidMoves(board, 46, -1)).toEqual([
      { from: 46, to: 37 },
      { from: 46, to: 39 },
    ]);

    const promotionBoard = createEmptyBoard();
    promotionBoard[14] = RED;
    const result = applyMove(promotionBoard, 14, 7);

    expect(result.isKingPromotion).toBe(true);
    expect(result.board[7]).toBe(RED_KING);
  });
});

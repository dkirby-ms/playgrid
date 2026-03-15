import { describe, expect, it } from "vitest";

import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED,
  RED_KING,
} from "@eschaton/shared";

import {
  applyMove,
  checkWinCondition,
  getAllMovesForPlayer,
  getValidMoves,
  initializeBoard,
  isValidMove,
} from "../checkersLogic";

const BOARD_WIDTH = 8;
const NO_FORCED_CAPTURE = -1;

function createEmptyBoard(): number[] {
  return Array.from({ length: BOARD_WIDTH * BOARD_WIDTH }, () => EMPTY);
}

function toIndex(row: number, col: number): number {
  return (row * BOARD_WIDTH) + col;
}

describe("checkersLogic", () => {
  describe("initializeBoard", () => {
    it("creates the standard opening layout on the correct squares", () => {
      const board = initializeBoard();

      expect(board).toHaveLength(64);
      expect(board.filter((piece) => piece === BLACK)).toHaveLength(12);
      expect(board.filter((piece) => piece === RED)).toHaveLength(12);
      expect(board.filter((piece) => piece === EMPTY)).toHaveLength(40);

      for (let row = 0; row < BOARD_WIDTH; row += 1) {
        for (let col = 0; col < BOARD_WIDTH; col += 1) {
          const index = toIndex(row, col);
          const isDarkSquare = (row + col) % 2 === 1;

          if (row <= 2 && isDarkSquare) {
            expect(board[index]).toBe(BLACK);
          } else if (row >= 5 && isDarkSquare) {
            expect(board[index]).toBe(RED);
          } else {
            expect(board[index]).toBe(EMPTY);
          }
        }
      }
    });
  });

  describe("getValidMoves", () => {
    it("returns forward diagonal moves for a regular black piece", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;

      expect(getValidMoves(board, toIndex(2, 1), NO_FORCED_CAPTURE)).toEqual([
        { from: toIndex(2, 1), to: toIndex(3, 0) },
        { from: toIndex(2, 1), to: toIndex(3, 2) },
      ]);
    });

    it("does not allow a regular piece to move backward", () => {
      const board = createEmptyBoard();
      board[toIndex(5, 6)] = RED;

      expect(getValidMoves(board, toIndex(5, 6), NO_FORCED_CAPTURE)).toEqual([
        { from: toIndex(5, 6), to: toIndex(4, 5) },
        { from: toIndex(5, 6), to: toIndex(4, 7) },
      ]);
    });

    it("lets kings move in all four diagonal directions", () => {
      const board = createEmptyBoard();
      board[toIndex(4, 3)] = BLACK_KING;

      expect(getValidMoves(board, toIndex(4, 3), NO_FORCED_CAPTURE)).toEqual([
        { from: toIndex(4, 3), to: toIndex(5, 2) },
        { from: toIndex(4, 3), to: toIndex(5, 4) },
        { from: toIndex(4, 3), to: toIndex(3, 2) },
        { from: toIndex(4, 3), to: toIndex(3, 4) },
      ]);
    });

    it("returns jump moves when a capture is available", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;

      expect(getValidMoves(board, toIndex(2, 1), NO_FORCED_CAPTURE)).toEqual([
        {
          from: toIndex(2, 1),
          to: toIndex(4, 3),
          captures: toIndex(3, 2),
        },
      ]);
    });

    it("returns multiple capture options when they exist", () => {
      const board = createEmptyBoard();
      board[toIndex(3, 2)] = BLACK;
      board[toIndex(4, 1)] = RED;
      board[toIndex(4, 3)] = RED;

      expect(getValidMoves(board, toIndex(3, 2), NO_FORCED_CAPTURE)).toEqual([
        {
          from: toIndex(3, 2),
          to: toIndex(5, 0),
          captures: toIndex(4, 1),
        },
        {
          from: toIndex(3, 2),
          to: toIndex(5, 4),
          captures: toIndex(4, 3),
        },
      ]);
    });

    it("enforces forced capture by excluding non-jump moves", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;
      board[toIndex(2, 5)] = BLACK;

      expect(getValidMoves(board, toIndex(2, 1), NO_FORCED_CAPTURE)).toEqual([
        {
          from: toIndex(2, 1),
          to: toIndex(4, 3),
          captures: toIndex(3, 2),
        },
      ]);
      expect(getValidMoves(board, toIndex(2, 5), NO_FORCED_CAPTURE)).toEqual([]);
    });

    it("does not wrap moves around the board edges", () => {
      const board = createEmptyBoard();
      board[toIndex(0, 7)] = BLACK;

      expect(getValidMoves(board, toIndex(0, 7), NO_FORCED_CAPTURE)).toEqual([
        { from: toIndex(0, 7), to: toIndex(1, 6) },
      ]);
    });
  });

  describe("isValidMove", () => {
    it("accepts a legal regular move", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;

      expect(isValidMove(board, toIndex(2, 1), toIndex(3, 2), BLACK, NO_FORCED_CAPTURE)).toBe(true);
    });

    it("rejects moves in the wrong direction, onto occupied squares, or with the wrong player", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 0)] = BLACK;

      expect(isValidMove(board, toIndex(2, 1), toIndex(1, 0), BLACK, NO_FORCED_CAPTURE)).toBe(false);
      expect(isValidMove(board, toIndex(2, 1), toIndex(3, 0), BLACK, NO_FORCED_CAPTURE)).toBe(false);
      expect(isValidMove(board, toIndex(2, 1), toIndex(3, 2), RED, NO_FORCED_CAPTURE)).toBe(false);
    });

    it("requires a capture when any capture is available", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;
      board[toIndex(2, 5)] = BLACK;

      expect(isValidMove(board, toIndex(2, 1), toIndex(4, 3), BLACK, NO_FORCED_CAPTURE)).toBe(true);
      expect(isValidMove(board, toIndex(2, 5), toIndex(3, 4), BLACK, NO_FORCED_CAPTURE)).toBe(false);
    });
  });

  describe("applyMove", () => {
    it("updates the board for a regular move without mutating the original board", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      const originalBoard = [...board];

      const result = applyMove(board, toIndex(2, 1), toIndex(3, 2));

      expect(result.board).not.toBe(board);
      expect(board).toEqual(originalBoard);
      expect(result.board[toIndex(2, 1)]).toBe(EMPTY);
      expect(result.board[toIndex(3, 2)]).toBe(BLACK);
      expect(result.captured).toBeNull();
      expect(result.isKingPromotion).toBe(false);
      expect(result.continuesChain).toBe(false);
    });

    it("removes the jumped piece when applying a capture", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;

      const result = applyMove(board, toIndex(2, 1), toIndex(4, 3));

      expect(result.board[toIndex(2, 1)]).toBe(EMPTY);
      expect(result.board[toIndex(3, 2)]).toBe(EMPTY);
      expect(result.board[toIndex(4, 3)]).toBe(BLACK);
      expect(result.captured).toBe(toIndex(3, 2));
      expect(result.continuesChain).toBe(false);
    });

    it("promotes a piece that reaches the opposite end", () => {
      const board = createEmptyBoard();
      board[toIndex(6, 1)] = BLACK;

      const result = applyMove(board, toIndex(6, 1), toIndex(7, 0));

      expect(result.board[toIndex(7, 0)]).toBe(BLACK_KING);
      expect(result.isKingPromotion).toBe(true);
    });

    it("detects when a multi-jump chain must continue", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;
      board[toIndex(5, 4)] = RED;

      const result = applyMove(board, toIndex(2, 1), toIndex(4, 3));

      expect(result.captured).toBe(toIndex(3, 2));
      expect(result.continuesChain).toBe(true);
      expect(getValidMoves(result.board, toIndex(4, 3), toIndex(4, 3))).toEqual([
        {
          from: toIndex(4, 3),
          to: toIndex(6, 5),
          captures: toIndex(5, 4),
        },
      ]);
    });

    it("throws when asked to move an empty square", () => {
      expect(() => applyMove(createEmptyBoard(), toIndex(2, 1), toIndex(3, 2))).toThrow(
        "Cannot move an empty square.",
      );
    });
  });

  describe("checkWinCondition", () => {
    it("returns no winner while the game is still ongoing", () => {
      expect(checkWinCondition(initializeBoard(), BLACK)).toBeNull();
    });

    it("returns the current player when the opponent has no pieces left", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;

      expect(checkWinCondition(board, BLACK)).toBe(BLACK);
    });

    it("returns the current player when the opponent has no legal moves", () => {
      const board = createEmptyBoard();
      board[toIndex(7, 6)] = BLACK;
      board[toIndex(0, 1)] = RED;

      expect(checkWinCondition(board, BLACK)).toBe(BLACK);
    });
  });

  describe("getAllMovesForPlayer", () => {
    it("returns all legal moves for the requested player", () => {
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(2, 5)] = BLACK;

      expect(getAllMovesForPlayer(board, BLACK, NO_FORCED_CAPTURE)).toEqual([
        { from: toIndex(2, 1), to: toIndex(3, 0) },
        { from: toIndex(2, 1), to: toIndex(3, 2) },
        { from: toIndex(2, 5), to: toIndex(3, 4) },
        { from: toIndex(2, 5), to: toIndex(3, 6) },
      ]);
    });

    it("returns an empty list when the player has no legal moves", () => {
      const board = createEmptyBoard();
      board[toIndex(0, 1)] = RED;
      board[toIndex(7, 6)] = BLACK;

      expect(getAllMovesForPlayer(board, RED, NO_FORCED_CAPTURE)).toEqual([]);
    });

    it("restricts moves to the forced capture piece during a jump chain", () => {
      const board = createEmptyBoard();
      board[toIndex(4, 3)] = BLACK;
      board[toIndex(5, 4)] = RED;
      board[toIndex(2, 5)] = BLACK;

      expect(getAllMovesForPlayer(board, BLACK, toIndex(4, 3))).toEqual([
        {
          from: toIndex(4, 3),
          to: toIndex(6, 5),
          captures: toIndex(5, 4),
        },
      ]);
    });
  });

  describe("color normalization", () => {
    it("treats kings as their base color for player-based APIs", () => {
      const board = createEmptyBoard();
      board[toIndex(4, 3)] = RED_KING;

      expect(getAllMovesForPlayer(board, RED, NO_FORCED_CAPTURE)).toEqual([
        { from: toIndex(4, 3), to: toIndex(5, 2) },
        { from: toIndex(4, 3), to: toIndex(5, 4) },
        { from: toIndex(4, 3), to: toIndex(3, 2) },
        { from: toIndex(4, 3), to: toIndex(3, 4) },
      ]);
      expect(isValidMove(board, toIndex(4, 3), toIndex(3, 2), RED, NO_FORCED_CAPTURE)).toBe(true);
    });
  });
});

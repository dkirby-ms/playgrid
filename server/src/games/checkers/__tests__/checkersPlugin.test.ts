import type { Client } from "colyseus";
import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../../../shared/src/index.ts"));

const shared = await import("../../../../../shared/src/index.ts");
const { BLACK, CheckersState, EMPTY, RED } = shared;
const { checkersPlugin } = await import("../CheckersPlugin");

const BOARD_WIDTH = 8;
const NO_FORCED_CAPTURE = -1;

const mockClient = (sessionId: string) => ({ sessionId } as Client);

type CheckersStateInstance = InstanceType<typeof CheckersState>;

function toIndex(row: number, col: number): number {
  return (row * BOARD_WIDTH) + col;
}

function createEmptyBoard(): number[] {
  return Array.from({ length: BOARD_WIDTH * BOARD_WIDTH }, () => EMPTY);
}

function joinPlayers(state: CheckersStateInstance) {
  checkersPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-1"), 0);
  checkersPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-2"), 1);
}

function createGameState(): CheckersStateInstance {
  const state = checkersPlugin.createState();
  joinPlayers(state);
  return state;
}

function setBoard(state: CheckersStateInstance, pieces: number[]) {
  for (const [index, piece] of pieces.entries()) {
    state.board[index] = piece;
  }

  state.mustCaptureFrom = NO_FORCED_CAPTURE;
}

function expectOpeningLayout(board: number[]) {
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
}

describe("checkersPlugin", () => {
  describe("metadata", () => {
    it("describes the checkers plugin", () => {
      expect(checkersPlugin.id).toBe("checkers");
      expect(checkersPlugin.name).toBe("Checkers");
      expect(checkersPlugin.metadata.playerCount).toEqual([2, 2]);
      expect(checkersPlugin.metadata.hasHiddenInformation).toBe(false);
    });
  });

  describe("createState", () => {
    it("creates a waiting CheckersState with board and players containers", () => {
      const state = checkersPlugin.createState();

      expect(state).toBeInstanceOf(CheckersState);
      expect(state.phase).toBe("waiting");
      expect(Array.from(state.board)).toEqual(createEmptyBoard());
      expect(Array.from(state.players.values())).toEqual([]);
      expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    });
  });

  describe("lifecycle.onGameStart", () => {
    it("initializes the board to the standard opening layout", () => {
      const state = createGameState();

      checkersPlugin.lifecycle.onGameStart(state);

      expect(state.phase).toBe("waiting");
      expectOpeningLayout(Array.from(state.board));
      expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
      expect(state.players.get("player-1")?.playerIndex).toBe(0);
      expect(state.players.get("player-2")?.playerIndex).toBe(1);
    });
  });

  describe("actions.move", () => {
    it("applies a valid move and updates the board", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(5, 6)] = RED;
      setBoard(state, board);

      const result = checkersPlugin.actions.move(state, mockClient("player-1"), {
        from: toIndex(2, 1),
        to: toIndex(3, 2),
      });

      expect(result).toEqual({ success: true, endsTurn: true, endsGame: false });
      expect(state.board[toIndex(2, 1)]).toBe(EMPTY);
      expect(state.board[toIndex(3, 2)]).toBe(BLACK);
      expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    });

    it("rejects an invalid move without changing the board", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(5, 6)] = RED;
      setBoard(state, board);
      const originalBoard = Array.from(state.board);

      const result = checkersPlugin.actions.move(state, mockClient("player-1"), {
        from: toIndex(2, 1),
        to: toIndex(1, 0),
      });

      expect(result).toEqual({ success: false, error: "Invalid move." });
      expect(Array.from(state.board)).toEqual(originalBoard);
      expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    });

    it("removes captured pieces and lands on the destination square", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;
      board[toIndex(7, 6)] = RED;
      setBoard(state, board);

      const result = checkersPlugin.actions.move(state, mockClient("player-1"), {
        from: toIndex(2, 1),
        to: toIndex(4, 3),
      });

      expect(result).toEqual({ success: true, endsTurn: true, endsGame: false });
      expect(state.board[toIndex(2, 1)]).toBe(EMPTY);
      expect(state.board[toIndex(3, 2)]).toBe(EMPTY);
      expect(state.board[toIndex(4, 3)]).toBe(BLACK);
      expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    });
  });

  describe("conditions.validateAction", () => {
    it("accepts legal moves only for the current player and move action type", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(5, 6)] = RED;
      setBoard(state, board);
      state.currentTurn = "player-1";

      expect(
        checkersPlugin.conditions.validateAction(state, mockClient("player-1"), "move", {
          from: toIndex(2, 1),
          to: toIndex(3, 2),
        }),
      ).toBe(true);
      expect(
        checkersPlugin.conditions.validateAction(state, mockClient("player-2"), "move", {
          from: toIndex(5, 6),
          to: toIndex(4, 5),
        }),
      ).toBe(false);
      expect(
        checkersPlugin.conditions.validateAction(state, mockClient("player-1"), "jump", {
          from: toIndex(2, 1),
          to: toIndex(3, 2),
        }),
      ).toBe(false);
    });
  });

  describe("conditions.checkGameEnd", () => {
    it("returns null while the game is still in progress", () => {
      const state = createGameState();
      state.currentTurn = "player-1";

      checkersPlugin.lifecycle.onGameStart(state);

      expect(checkersPlugin.conditions.checkGameEnd(state)).toBeNull();
    });

    it("returns a win result when the opponent has been eliminated", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      setBoard(state, board);
      state.currentTurn = "player-1";

      expect(checkersPlugin.conditions.checkGameEnd(state)).toEqual({
        type: "win",
        winnerId: "player-1",
        scores: {
          "player-1": 1,
          "player-2": 0,
        },
        metadata: {
          winnerColor: BLACK,
          "player-1": { pieces: 1, kings: 0 },
          "player-2": { pieces: 0, kings: 0 },
        },
      });
    });
  });

  describe("turn flow", () => {
    it("lets the next player act after a move that ends the turn", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(5, 6)] = RED;
      setBoard(state, board);
      state.currentTurn = "player-1";

      const result = checkersPlugin.actions.move(state, mockClient("player-1"), {
        from: toIndex(2, 1),
        to: toIndex(3, 2),
      });

      expect(result.endsTurn).toBe(true);

      state.currentTurn = "player-2";

      expect(
        checkersPlugin.conditions.validateAction(state, mockClient("player-2"), "move", {
          from: toIndex(5, 6),
          to: toIndex(4, 5),
        }),
      ).toBe(true);
    });

    it("keeps the turn with the same player during a multi-jump chain", () => {
      const state = createGameState();
      const board = createEmptyBoard();
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED;
      board[toIndex(5, 4)] = RED;
      board[toIndex(7, 6)] = RED;
      setBoard(state, board);
      state.currentTurn = "player-1";

      const firstJump = checkersPlugin.actions.move(state, mockClient("player-1"), {
        from: toIndex(2, 1),
        to: toIndex(4, 3),
      });

      expect(firstJump).toEqual({ success: true, endsTurn: false, endsGame: false });
      expect(state.mustCaptureFrom).toBe(toIndex(4, 3));
      expect(
        checkersPlugin.conditions.validateAction(state, mockClient("player-1"), "move", {
          from: toIndex(4, 3),
          to: toIndex(6, 5),
        }),
      ).toBe(true);
      expect(
        checkersPlugin.conditions.validateAction(state, mockClient("player-2"), "move", {
          from: toIndex(7, 6),
          to: toIndex(6, 5),
        }),
      ).toBe(false);

      const secondJump = checkersPlugin.actions.move(state, mockClient("player-1"), {
        from: toIndex(4, 3),
        to: toIndex(6, 5),
      });

      expect(secondJump).toEqual({ success: true, endsTurn: true, endsGame: false });
      expect(state.board[toIndex(5, 4)]).toBe(EMPTY);
      expect(state.board[toIndex(6, 5)]).toBe(BLACK);
      expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    });
  });
});

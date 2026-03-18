import type { Client } from "colyseus";
import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../shared/src/index.ts"));

const shared = await import("../../../shared/src/index.ts");
const { BLACK, CheckersState, EMPTY, PlayerInfo, RED } = shared;
const { checkersPlugin } = await import("../games/checkers/CheckersPlugin");

const BOARD_WIDTH = 8;
const NO_FORCED_CAPTURE = -1;

type CheckersStateInstance = InstanceType<typeof CheckersState>;
type MovePayload = {
  from: number;
  to: number;
};

const mockClient = (sessionId: string) => ({ sessionId } as Client);

function toIndex(row: number, col: number): number {
  return (row * BOARD_WIDTH) + col;
}

function createEmptyBoard(): number[] {
  return Array.from({ length: BOARD_WIDTH * BOARD_WIDTH }, () => EMPTY);
}

function setBoard(state: CheckersStateInstance, pieces: Array<[number, number]>) {
  const board = createEmptyBoard();
  for (const [index, piece] of pieces) {
    board[index] = piece;
  }

  for (const [index, piece] of board.entries()) {
    state.board[index] = piece;
  }

  state.mustCaptureFrom = NO_FORCED_CAPTURE;
}

function createStartedGame() {
  const state = checkersPlugin.createState();

  checkersPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-1"), 0);
  checkersPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-2"), 1);
  checkersPlugin.lifecycle.onGameStart(state);

  state.phase = "playing";
  state.currentTurn = "player-1";
  state.turnNumber = 1;

  return state;
}

function advanceTurn(state: CheckersStateInstance) {
  state.currentTurn = state.currentTurn === "player-1" ? "player-2" : "player-1";
  state.turnNumber += 1;
}

function performRoomMove(
  state: CheckersStateInstance,
  client: Client,
  payload: MovePayload,
) {
  expect(checkersPlugin.conditions.validateAction(state, client, "move", payload)).toBe(true);

  const actionResult = checkersPlugin.actions.move(state, client, payload);
  expect(actionResult.success).toBe(true);

  const gameResult = checkersPlugin.conditions.checkGameEnd(state);

  if (actionResult.endsTurn && !actionResult.endsGame) {
    advanceTurn(state);
  }

  return { actionResult, gameResult };
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

describe("Checkers E2E — full game flow", () => {
  it("creates players, starts the game, and plays an opening exchange with turn alternation", () => {
    const state = createStartedGame();

    expect(state).toBeInstanceOf(CheckersState);
    expect(state.players.get("player-1")).toBeInstanceOf(PlayerInfo);
    expect(state.players.get("player-2")).toBeInstanceOf(PlayerInfo);
    expect(state.players.get("player-1")).toMatchObject({
      sessionId: "player-1",
      displayName: "Player 1",
      playerIndex: 0,
      isConnected: true,
      isSpectator: false,
    });
    expect(state.players.get("player-2")).toMatchObject({
      sessionId: "player-2",
      displayName: "Player 2",
      playerIndex: 1,
      isConnected: true,
      isSpectator: false,
    });
    expect(state.phase).toBe("playing");
    expect(state.currentTurn).toBe("player-1");
    expect(state.turnNumber).toBe(1);
    expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    expectOpeningLayout(Array.from(state.board));

    const firstMove = performRoomMove(state, mockClient("player-1"), {
      from: toIndex(2, 1),
      to: toIndex(3, 0),
    });

    expect(firstMove.actionResult).toEqual({ success: true, endsTurn: true, endsGame: false });
    expect(firstMove.gameResult).toBeNull();
    expect(state.board[toIndex(2, 1)]).toBe(EMPTY);
    expect(state.board[toIndex(3, 0)]).toBe(BLACK);
    expect(state.currentTurn).toBe("player-2");
    expect(state.turnNumber).toBe(2);
    expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);

    const secondMove = performRoomMove(state, mockClient("player-2"), {
      from: toIndex(5, 2),
      to: toIndex(4, 1),
    });

    expect(secondMove.actionResult).toEqual({ success: true, endsTurn: true, endsGame: false });
    expect(secondMove.gameResult).toBeNull();
    expect(state.board[toIndex(5, 2)]).toBe(EMPTY);
    expect(state.board[toIndex(4, 1)]).toBe(RED);
    expect(state.currentTurn).toBe("player-1");
    expect(state.turnNumber).toBe(3);
  });

  it("rejects invalid moves and forced-capture violations without changing the board", () => {
    const state = createStartedGame();

    setBoard(state, [
      [toIndex(2, 1), BLACK],
      [toIndex(5, 6), RED],
    ]);

    const invalidBoard = Array.from(state.board);
    const backwardsMove = {
      from: toIndex(2, 1),
      to: toIndex(1, 0),
    };

    expect(checkersPlugin.conditions.validateAction(state, mockClient("player-1"), "move", backwardsMove))
      .toBe(false);
    expect(checkersPlugin.actions.move(state, mockClient("player-1"), backwardsMove)).toEqual({
      success: false,
      error: "Invalid move.",
    });
    expect(Array.from(state.board)).toEqual(invalidBoard);

    setBoard(state, [
      [toIndex(2, 1), BLACK],
      [toIndex(2, 5), BLACK],
      [toIndex(3, 2), RED],
    ]);

    const forcedCaptureBoard = Array.from(state.board);
    const nonJumpMove = {
      from: toIndex(2, 5),
      to: toIndex(3, 4),
    };

    expect(checkersPlugin.conditions.validateAction(state, mockClient("player-1"), "move", nonJumpMove))
      .toBe(false);
    expect(checkersPlugin.actions.move(state, mockClient("player-1"), nonJumpMove)).toEqual({
      success: false,
      error: "Invalid move.",
    });
    expect(Array.from(state.board)).toEqual(forcedCaptureBoard);
  });

  it("keeps the same player during a multi-jump capture chain and clears captured pieces", () => {
    const state = createStartedGame();

    setBoard(state, [
      [toIndex(2, 1), BLACK],
      [toIndex(3, 2), RED],
      [toIndex(5, 4), RED],
      [toIndex(7, 6), RED],
    ]);

    const firstJump = performRoomMove(state, mockClient("player-1"), {
      from: toIndex(2, 1),
      to: toIndex(4, 3),
    });

    expect(firstJump.actionResult).toEqual({ success: true, endsTurn: false, endsGame: false });
    expect(firstJump.gameResult).toBeNull();
    expect(state.board[toIndex(2, 1)]).toBe(EMPTY);
    expect(state.board[toIndex(3, 2)]).toBe(EMPTY);
    expect(state.board[toIndex(4, 3)]).toBe(BLACK);
    expect(state.currentTurn).toBe("player-1");
    expect(state.turnNumber).toBe(1);
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

    const secondJump = performRoomMove(state, mockClient("player-1"), {
      from: toIndex(4, 3),
      to: toIndex(6, 5),
    });

    expect(secondJump.actionResult).toEqual({ success: true, endsTurn: true, endsGame: false });
    expect(secondJump.gameResult).toBeNull();
    expect(state.board[toIndex(5, 4)]).toBe(EMPTY);
    expect(state.board[toIndex(6, 5)]).toBe(BLACK);
    expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    expect(state.currentTurn).toBe("player-2");
    expect(state.turnNumber).toBe(2);
  });

  it("returns a win result after a winning capture in a near-endgame position", () => {
    const state = createStartedGame();

    setBoard(state, [
      [toIndex(2, 1), BLACK],
      [toIndex(3, 2), RED],
    ]);

    const winningMove = performRoomMove(state, mockClient("player-1"), {
      from: toIndex(2, 1),
      to: toIndex(4, 3),
    });

    expect(winningMove.actionResult).toEqual({ success: true, endsTurn: true, endsGame: true });
    expect(state.board[toIndex(2, 1)]).toBe(EMPTY);
    expect(state.board[toIndex(3, 2)]).toBe(EMPTY);
    expect(state.board[toIndex(4, 3)]).toBe(BLACK);
    expect(state.mustCaptureFrom).toBe(NO_FORCED_CAPTURE);
    expect(winningMove.gameResult).toEqual({
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

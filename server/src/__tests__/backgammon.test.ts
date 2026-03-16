import type { Client } from "colyseus";
import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../shared/src/index.ts"));

const shared = await import("../../../shared/src/index.ts");
const { BLACK, RED, BackgammonState, PlayerInfo } = shared;
const { backgammonPlugin } = await import("../games/backgammon/BackgammonPlugin");
const {
  initializeBoard,
  isValidMove,
  applyMove,
  canBearOff,
  checkWinCondition,
  hasValidMoves,
  getAvailableDice,
  getPlayerColor,
} = await import("../games/backgammon/backgammonLogic");

type BackgammonStateInstance = InstanceType<typeof BackgammonState>;
type MovePayload = {
  from: number | "bar";
  to: number | "off";
  die: number;
};

const mockClient = (sessionId: string) => ({ sessionId } as Client);

function createStartedGame() {
  const state = backgammonPlugin.createState();

  backgammonPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-1"), 0);
  backgammonPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-2"), 1);
  backgammonPlugin.lifecycle.onGameStart(state);

  state.phase = "playing";
  state.currentTurn = "player-1";
  state.turnNumber = 1;

  return state;
}

function advanceTurn(state: BackgammonStateInstance) {
  state.currentTurn = state.currentTurn === "player-1" ? "player-2" : "player-1";
  state.turnNumber += 1;
}

function performRoomMove(
  state: BackgammonStateInstance,
  client: Client,
  payload: MovePayload,
) {
  expect(backgammonPlugin.conditions.validateAction(state, client, "move", payload)).toBe(true);

  const actionResult = backgammonPlugin.actions.move(state, client, payload);
  expect(actionResult.success).toBe(true);

  const gameResult = backgammonPlugin.conditions.checkGameEnd(state);

  if (actionResult.endsTurn && !actionResult.endsGame) {
    advanceTurn(state);
  }

  return { actionResult, gameResult };
}

function setBoard(
  state: BackgammonStateInstance,
  points: number[],
  blackBar = 0,
  redBar = 0,
  blackBorneOff = 0,
  redBorneOff = 0,
) {
  for (const [index, count] of points.entries()) {
    state.points[index] = count;
  }
  state.blackBar = blackBar;
  state.redBar = redBar;
  state.blackBorneOff = blackBorneOff;
  state.redBorneOff = redBorneOff;
}

function setDice(state: BackgammonStateInstance, die1: number, die2: number) {
  state.dice[0] = die1;
  state.dice[1] = die2;
  state.usedDice[0] = false;
  state.usedDice[1] = false;
}

describe("Backgammon Logic — Pure Functions", () => {
  describe("initializeBoard", () => {
    it("creates standard opening position with 15 pieces per player", () => {
      const board = initializeBoard();

      expect(board).toHaveLength(24);
      expect(board[0]).toBe(2);
      expect(board[11]).toBe(5);
      expect(board[16]).toBe(3);
      expect(board[18]).toBe(5);
      expect(board[23]).toBe(-2);
      expect(board[12]).toBe(-5);
      expect(board[7]).toBe(-3);
      expect(board[5]).toBe(-5);

      const blackTotal = board.reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
      const redTotal = board.reduce((sum, count) => sum + (count < 0 ? -count : 0), 0);
      expect(blackTotal).toBe(15);
      expect(redTotal).toBe(15);
    });
  });

  describe("getPlayerColor", () => {
    it("maps player index to color constants", () => {
      expect(getPlayerColor(0)).toBe(BLACK);
      expect(getPlayerColor(1)).toBe(RED);
      expect(getPlayerColor(2)).toBe(null);
      expect(getPlayerColor(-1)).toBe(null);
    });
  });

  describe("getAvailableDice", () => {
    it("returns both dice when neither used", () => {
      expect(getAvailableDice([3, 5], [false, false])).toEqual([3, 5]);
    });

    it("returns one die when the other is used", () => {
      expect(getAvailableDice([3, 5], [true, false])).toEqual([5]);
      expect(getAvailableDice([3, 5], [false, true])).toEqual([3]);
    });

    it("returns empty array when both dice used", () => {
      expect(getAvailableDice([3, 5], [true, true])).toEqual([]);
    });

    it("returns 4 moves for doubles when unused", () => {
      expect(getAvailableDice([4, 4], [false, false])).toEqual([4, 4, 4, 4]);
    });

    it("returns 2 moves for doubles when one index used", () => {
      expect(getAvailableDice([4, 4], [true, false])).toEqual([4, 4]);
    });

    it("returns no moves for doubles when both indices used", () => {
      expect(getAvailableDice([4, 4], [true, true])).toEqual([]);
    });
  });

  describe("Movement validation", () => {
    it("allows valid forward moves for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;
      board[11] = 5;
      expect(isValidMove(board, 0, 0, 0, 0, 0, 3, 3, BLACK)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 11, 14, 3, BLACK)).toBe(true);
    });

    it("allows valid backward moves for Red", () => {
      const board = initializeBoard();
      expect(isValidMove(board, 0, 0, 0, 0, 23, 20, 3, RED)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 12, 9, 3, RED)).toBe(true);
    });

    it("rejects moves from empty points", () => {
      const board = initializeBoard();
      expect(isValidMove(board, 0, 0, 0, 0, 1, 4, 3, BLACK)).toBe(false);
      expect(isValidMove(board, 0, 0, 0, 0, 22, 19, 3, RED)).toBe(false);
    });

    it("rejects moves from opponent's pieces", () => {
      const board = initializeBoard();
      expect(isValidMove(board, 0, 0, 0, 0, 23, 26, 3, BLACK)).toBe(false);
      expect(isValidMove(board, 0, 0, 0, 0, 0, 3, 3, RED)).toBe(false);
    });

    it("rejects moves with wrong direction", () => {
      const board = initializeBoard();
      expect(isValidMove(board, 0, 0, 0, 0, 11, 8, 3, BLACK)).toBe(false);
      expect(isValidMove(board, 0, 0, 0, 0, 12, 15, 3, RED)).toBe(false);
    });

    it("rejects moves with wrong distance", () => {
      const board = initializeBoard();
      expect(isValidMove(board, 0, 0, 0, 0, 0, 4, 3, BLACK)).toBe(false);
      expect(isValidMove(board, 0, 0, 0, 0, 23, 19, 3, RED)).toBe(false);
    });

    it("rejects moves to blocked points (2+ opponent pieces)", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;
      board[3] = -2;
      expect(isValidMove(board, 0, 0, 0, 0, 0, 3, 3, BLACK)).toBe(false);

      board[23] = -2;
      board[20] = 2;
      expect(isValidMove(board, 0, 0, 0, 0, 23, 20, 3, RED)).toBe(false);
    });

    it("allows capturing single opponent piece (blot)", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;
      board[3] = -1;
      expect(isValidMove(board, 0, 0, 0, 0, 0, 3, 3, BLACK)).toBe(true);

      board[23] = -2;
      board[20] = 1;
      expect(isValidMove(board, 0, 0, 0, 0, 23, 20, 3, RED)).toBe(true);
    });

    it("allows moving to empty points", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;
      expect(isValidMove(board, 0, 0, 0, 0, 0, 3, 3, BLACK)).toBe(true);
    });

    it("allows moving to own points", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;
      board[3] = 1;
      expect(isValidMove(board, 0, 0, 0, 0, 0, 3, 3, BLACK)).toBe(true);
    });
  });

  describe("Bar re-entry", () => {
    it("forces bar re-entry before other moves for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[10] = 3;
      expect(isValidMove(board, 1, 0, 0, 0, 10, 13, 3, BLACK)).toBe(false);
    });

    it("forces bar re-entry before other moves for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[10] = -3;
      expect(isValidMove(board, 0, 1, 0, 0, 10, 7, 3, RED)).toBe(false);
    });

    it("allows bar entry to open point for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      expect(isValidMove(board, 1, 0, 0, 0, "bar", 2, 3, BLACK)).toBe(true);
    });

    it("allows bar entry to open point for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      expect(isValidMove(board, 0, 1, 0, 0, "bar", 21, 3, RED)).toBe(true);
    });

    it("allows bar entry with capture for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[2] = -1;
      expect(isValidMove(board, 1, 0, 0, 0, "bar", 2, 3, BLACK)).toBe(true);
    });

    it("allows bar entry with capture for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[21] = 1;
      expect(isValidMove(board, 0, 1, 0, 0, "bar", 21, 3, RED)).toBe(true);
    });

    it("blocks bar entry to opponent blocked point for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[2] = -2;
      expect(isValidMove(board, 1, 0, 0, 0, "bar", 2, 3, BLACK)).toBe(false);
    });

    it("blocks bar entry to opponent blocked point for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[21] = 2;
      expect(isValidMove(board, 0, 1, 0, 0, "bar", 21, 3, RED)).toBe(false);
    });

    it("validates correct entry point based on die for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      expect(isValidMove(board, 1, 0, 0, 0, "bar", 2, 3, BLACK)).toBe(true);
      expect(isValidMove(board, 1, 0, 0, 0, "bar", 3, 3, BLACK)).toBe(false);
    });

    it("validates correct entry point based on die for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      expect(isValidMove(board, 0, 1, 0, 0, "bar", 21, 3, RED)).toBe(true);
      expect(isValidMove(board, 0, 1, 0, 0, "bar", 20, 3, RED)).toBe(false);
    });

    it("rejects bar entry when no pieces on bar", () => {
      const board = Array.from({ length: 24 }, () => 0);
      expect(isValidMove(board, 0, 0, 0, 0, "bar", 2, 3, BLACK)).toBe(false);
      expect(isValidMove(board, 0, 0, 0, 0, "bar", 21, 3, RED)).toBe(false);
    });
  });

  describe("Bearing off", () => {
    it("allows bearing off when all pieces in home board for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[18] = 2;
      board[19] = 3;
      board[20] = 4;
      board[21] = 3;
      board[22] = 2;
      board[23] = 1;
      expect(isValidMove(board, 0, 0, 0, 0, 23, "off", 1, BLACK)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 22, "off", 2, BLACK)).toBe(true);
    });

    it("allows bearing off when all pieces in home board for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = -2;
      board[1] = -3;
      board[2] = -4;
      board[3] = -3;
      board[4] = -2;
      board[5] = -1;
      expect(isValidMove(board, 0, 0, 0, 0, 0, "off", 1, RED)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 1, "off", 2, RED)).toBe(true);
    });

    it("blocks bearing off when pieces outside home board for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[17] = 1;
      board[18] = 14;
      expect(isValidMove(board, 0, 0, 0, 0, 18, "off", 6, BLACK)).toBe(false);
    });

    it("blocks bearing off when pieces outside home board for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[6] = -1;
      board[5] = -14;
      expect(isValidMove(board, 0, 0, 0, 0, 5, "off", 6, RED)).toBe(false);
    });

    it("blocks bearing off when pieces on bar for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[18] = 14;
      expect(isValidMove(board, 1, 0, 0, 0, 18, "off", 6, BLACK)).toBe(false);
    });

    it("blocks bearing off when pieces on bar for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[5] = -14;
      expect(isValidMove(board, 0, 1, 0, 0, 5, "off", 6, RED)).toBe(false);
    });

    it("allows bearing off with exact die for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[20] = 5;
      board[21] = 5;
      board[22] = 5;
      expect(isValidMove(board, 0, 0, 0, 0, 20, "off", 4, BLACK)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 21, "off", 3, BLACK)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 22, "off", 2, BLACK)).toBe(true);
    });

    it("allows bearing off with exact die for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[3] = -5;
      board[2] = -5;
      board[1] = -5;
      expect(isValidMove(board, 0, 0, 0, 0, 3, "off", 4, RED)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 2, "off", 3, RED)).toBe(true);
      expect(isValidMove(board, 0, 0, 0, 0, 1, "off", 2, RED)).toBe(true);
    });

    it("allows bearing off with higher die when no higher pieces for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[18] = 5;
      board[19] = 5;
      board[20] = 5;
      expect(isValidMove(board, 0, 0, 0, 0, 20, "off", 6, BLACK)).toBe(true);
    });

    it("allows bearing off with higher die when no higher pieces for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[3] = -5;
      board[4] = -5;
      board[5] = -5;
      expect(isValidMove(board, 0, 0, 0, 0, 3, "off", 6, RED)).toBe(true);
    });

    it("blocks bearing off from lower point when higher pieces exist for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[18] = 5;
      board[19] = 5;
      board[23] = 5;
      expect(isValidMove(board, 0, 0, 0, 0, 18, "off", 1, BLACK)).toBe(false);
    });

    it("blocks bearing off from higher point when lower pieces exist for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = -5;
      board[4] = -5;
      board[5] = -5;
      expect(isValidMove(board, 0, 0, 0, 0, 5, "off", 1, RED)).toBe(false);
    });
  });

  describe("applyMove", () => {
    it("moves piece from source to destination", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;

      const result = applyMove(board, 0, 0, 0, 0, 0, 3, BLACK);

      expect(result.points[0]).toBe(1);
      expect(result.points[3]).toBe(1);
      expect(result.captured).toBe(false);
    });

    it("captures opponent blot and sends to bar for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 2;
      board[3] = -1;

      const result = applyMove(board, 0, 0, 0, 0, 0, 3, BLACK);

      expect(result.points[0]).toBe(1);
      expect(result.points[3]).toBe(1);
      expect(result.blackBar).toBe(0);
      expect(result.redBar).toBe(1);
      expect(result.captured).toBe(true);
    });

    it("captures opponent blot and sends to bar for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[23] = -2;
      board[20] = 1;

      const result = applyMove(board, 0, 0, 0, 0, 23, 20, RED);

      expect(result.points[23]).toBe(-1);
      expect(result.points[20]).toBe(-1);
      expect(result.redBar).toBe(0);
      expect(result.blackBar).toBe(1);
      expect(result.captured).toBe(true);
    });

    it("enters from bar for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);

      const result = applyMove(board, 1, 0, 0, 0, "bar", 2, BLACK);

      expect(result.blackBar).toBe(0);
      expect(result.points[2]).toBe(1);
      expect(result.captured).toBe(false);
    });

    it("enters from bar for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);

      const result = applyMove(board, 0, 1, 0, 0, "bar", 21, RED);

      expect(result.redBar).toBe(0);
      expect(result.points[21]).toBe(-1);
      expect(result.captured).toBe(false);
    });

    it("bears off piece for Black", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[23] = 5;

      const result = applyMove(board, 0, 0, 0, 0, 23, "off", BLACK);

      expect(result.points[23]).toBe(4);
      expect(result.blackBorneOff).toBe(1);
      expect(result.redBorneOff).toBe(0);
    });

    it("bears off piece for Red", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = -5;

      const result = applyMove(board, 0, 0, 0, 0, 0, "off", RED);

      expect(result.points[0]).toBe(-4);
      expect(result.redBorneOff).toBe(1);
      expect(result.blackBorneOff).toBe(0);
    });
  });

  describe("canBearOff", () => {
    it("returns true when all Black pieces in home board", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[18] = 5;
      board[22] = 10;
      expect(canBearOff(board, 0, BLACK)).toBe(true);
    });

    it("returns true when all Red pieces in home board", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = -5;
      board[5] = -10;
      expect(canBearOff(board, 0, RED)).toBe(true);
    });

    it("returns false when Black has pieces outside home board", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[17] = 1;
      board[18] = 14;
      expect(canBearOff(board, 0, BLACK)).toBe(false);
    });

    it("returns false when Red has pieces outside home board", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[6] = -1;
      board[5] = -14;
      expect(canBearOff(board, 0, RED)).toBe(false);
    });

    it("returns false when Black has pieces on bar", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[18] = 15;
      expect(canBearOff(board, 1, BLACK)).toBe(false);
    });

    it("returns false when Red has pieces on bar", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = -15;
      expect(canBearOff(board, 1, RED)).toBe(false);
    });
  });

  describe("checkWinCondition", () => {
    it("returns Black when all 15 Black pieces borne off", () => {
      expect(checkWinCondition(15, 0)).toBe(BLACK);
    });

    it("returns Red when all 15 Red pieces borne off", () => {
      expect(checkWinCondition(0, 15)).toBe(RED);
    });

    it("returns null when neither player has won", () => {
      expect(checkWinCondition(14, 14)).toBe(null);
      expect(checkWinCondition(0, 0)).toBe(null);
      expect(checkWinCondition(10, 5)).toBe(null);
    });
  });

  describe("hasValidMoves", () => {
    it("returns false when no dice available", () => {
      const board = initializeBoard();
      expect(hasValidMoves(board, 0, 0, 0, 0, [], BLACK)).toBe(false);
    });

    it("returns true when valid normal moves exist", () => {
      const board = initializeBoard();
      expect(hasValidMoves(board, 0, 0, 0, 0, [3, 5], BLACK)).toBe(true);
    });

    it("returns true when valid bar entry exists", () => {
      const board = Array.from({ length: 24 }, () => 0);
      expect(hasValidMoves(board, 1, 0, 0, 0, [3], BLACK)).toBe(true);
    });

    it("returns false when bar entry blocked and no other moves", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[2] = -2;
      board[4] = -2;
      expect(hasValidMoves(board, 1, 0, 0, 0, [3, 5], BLACK)).toBe(false);
    });

    it("returns true when bearing off moves available", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[23] = 15;
      expect(hasValidMoves(board, 0, 0, 0, 0, [1], BLACK)).toBe(true);
    });

    it("returns false when all moves blocked", () => {
      const board = Array.from({ length: 24 }, () => 0);
      board[0] = 1;
      board[3] = -2;
      board[5] = -2;
      expect(hasValidMoves(board, 0, 0, 0, 0, [3, 5], BLACK)).toBe(false);
    });
  });
});

describe("Backgammon Plugin — Integration", () => {
  describe("Game initialization", () => {
    it("creates players and starts with standard board setup", () => {
      const state = createStartedGame();

      expect(state).toBeInstanceOf(BackgammonState);
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

      const points = Array.from(state.points);
      expect(points[0]).toBe(2);
      expect(points[11]).toBe(5);
      expect(points[23]).toBe(-2);
      expect(points[12]).toBe(-5);

      expect(state.blackBar).toBe(0);
      expect(state.redBar).toBe(0);
      expect(state.blackBorneOff).toBe(0);
      expect(state.redBorneOff).toBe(0);

      expect(state.dice[0]).toBe(0);
      expect(state.dice[1]).toBe(0);
    });
  });

  describe("Move action and turn progression", () => {
    it("executes valid move and advances turn when no moves remain", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[0] = 2;
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      const move1 = performRoomMove(state, mockClient("player-1"), {
        from: 0,
        to: 3,
        die: 3,
      });

      expect(move1.actionResult.success).toBe(true);
      expect(move1.actionResult.endsTurn).toBe(false);
      expect(state.points[0]).toBe(1);
      expect(state.points[3]).toBe(1);
      expect(state.currentTurn).toBe("player-1");
      expect(state.usedDice[0]).toBe(true);

      const move2 = performRoomMove(state, mockClient("player-1"), {
        from: 0,
        to: 5,
        die: 5,
      });

      expect(move2.actionResult.success).toBe(true);
      expect(move2.actionResult.endsTurn).toBe(true);
      expect(state.points[0]).toBe(0);
      expect(state.points[5]).toBe(1);
      expect(state.currentTurn).toBe("player-2");
    });

    it("ends turn when no more valid moves exist", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[0] = 1;
      state.points[8] = -5;
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      const move = performRoomMove(state, mockClient("player-1"), {
        from: 0,
        to: 3,
        die: 3,
      });

      expect(move.actionResult.endsTurn).toBe(true);
      expect(state.currentTurn).toBe("player-2");
    });

    it("handles doubles with four moves", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[0] = 4;
      state.currentTurn = "player-1";
      setDice(state, 2, 2);

      expect(getAvailableDice(Array.from(state.dice), Array.from(state.usedDice))).toEqual([2, 2, 2, 2]);

      performRoomMove(state, mockClient("player-1"), { from: 0, to: 2, die: 2 });
      expect(state.currentTurn).toBe("player-1");
      expect(getAvailableDice(Array.from(state.dice), Array.from(state.usedDice)).length).toBe(2);

      performRoomMove(state, mockClient("player-1"), { from: 0, to: 2, die: 2 });
      // Turn should end after using both dice indices (which gives 4 total moves with doubles)
      expect(state.currentTurn).toBe("player-2");
      // New dice rolled for next player's turn
      expect(state.usedDice[0]).toBe(false);
      expect(state.usedDice[1]).toBe(false);
    });
  });

  describe("Move validation and rejection", () => {
    it("rejects moves when not player's turn", () => {
      const state = createStartedGame();
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      expect(
        backgammonPlugin.conditions.validateAction(state, mockClient("player-2"), "move", {
          from: 23,
          to: 20,
          die: 3,
        }),
      ).toBe(false);
    });

    it("rejects invalid move payloads", () => {
      const state = createStartedGame();
      state.currentTurn = "player-1";

      const result = backgammonPlugin.actions.move(state, mockClient("player-1"), {
        from: "invalid",
        to: "invalid",
        die: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid move payload.");
    });

    it("rejects moves using unavailable dice", () => {
      const state = createStartedGame();
      state.currentTurn = "player-1";
      setDice(state, 3, 5);
      state.usedDice[0] = true;

      const result = backgammonPlugin.actions.move(state, mockClient("player-1"), {
        from: 0,
        to: 3,
        die: 3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Die not available.");
    });

    it("rejects moves to blocked points", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[0] = 2;
      state.points[3] = -2;
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      expect(
        backgammonPlugin.conditions.validateAction(state, mockClient("player-1"), "move", {
          from: 0,
          to: 3,
          die: 3,
        }),
      ).toBe(false);

      const result = backgammonPlugin.actions.move(state, mockClient("player-1"), {
        from: 0,
        to: 3,
        die: 3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid move.");
    });
  });

  describe("Capturing and bar re-entry", () => {
    it("captures opponent blot and sends to bar", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[0] = 2;
      state.points[3] = -1;
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      performRoomMove(state, mockClient("player-1"), {
        from: 0,
        to: 3,
        die: 3,
      });

      expect(state.points[3]).toBe(1);
      expect(state.redBar).toBe(1);
    });

    it("forces bar re-entry before other moves", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0), 1, 0);
      state.points[10] = 3;
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      expect(
        backgammonPlugin.conditions.validateAction(state, mockClient("player-1"), "move", {
          from: 10,
          to: 13,
          die: 3,
        }),
      ).toBe(false);

      expect(
        backgammonPlugin.conditions.validateAction(state, mockClient("player-1"), "move", {
          from: "bar",
          to: 2,
          die: 3,
        }),
      ).toBe(true);
    });

    it("allows bar entry and continuation", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0), 1, 0);
      state.points[10] = 1;
      state.currentTurn = "player-1";
      setDice(state, 3, 5);

      performRoomMove(state, mockClient("player-1"), {
        from: "bar",
        to: 2,
        die: 3,
      });

      expect(state.blackBar).toBe(0);
      expect(state.points[2]).toBe(1);
      expect(state.currentTurn).toBe("player-1");

      performRoomMove(state, mockClient("player-1"), {
        from: 2,
        to: 7,
        die: 5,
      });

      expect(state.points[2]).toBe(0);
      expect(state.points[7]).toBe(1);
      expect(state.currentTurn).toBe("player-2");
    });
  });

  describe("Bearing off", () => {
    it("allows bearing off when all pieces in home board", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[23] = 5;
      state.points[22] = 5;
      state.points[21] = 5;
      state.currentTurn = "player-1";
      setDice(state, 1, 2);

      performRoomMove(state, mockClient("player-1"), {
        from: 23,
        to: "off",
        die: 1,
      });

      expect(state.points[23]).toBe(4);
      expect(state.blackBorneOff).toBe(1);
    });

    it("prevents bearing off when pieces outside home board", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[17] = 1;
      state.points[23] = 14;
      state.currentTurn = "player-1";
      setDice(state, 1, 2);

      expect(
        backgammonPlugin.conditions.validateAction(state, mockClient("player-1"), "move", {
          from: 23,
          to: "off",
          die: 1,
        }),
      ).toBe(false);
    });

    it("allows bearing off with higher die when no higher pieces", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[20] = 5;
      state.points[19] = 5;
      state.points[18] = 5;
      state.currentTurn = "player-1";
      setDice(state, 6, 6);

      performRoomMove(state, mockClient("player-1"), {
        from: 20,
        to: "off",
        die: 6,
      });

      expect(state.points[20]).toBe(4);
      expect(state.blackBorneOff).toBe(1);
    });
  });

  describe("Win condition", () => {
    it("detects win when player bears off all 15 pieces", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0), 0, 0, 14, 0);
      state.points[23] = 1;
      state.currentTurn = "player-1";
      setDice(state, 1, 2);

      const move = performRoomMove(state, mockClient("player-1"), {
        from: 23,
        to: "off",
        die: 1,
      });

      expect(move.actionResult.endsGame).toBe(true);
      expect(move.gameResult).not.toBeNull();
      expect(move.gameResult?.type).toBe("win");
      expect(move.gameResult?.winnerId).toBe("player-1");
      expect(state.blackBorneOff).toBe(15);
    });

    it("does not end game before all pieces borne off", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0), 0, 0, 13, 0);
      state.points[23] = 2;
      state.currentTurn = "player-1";
      setDice(state, 1, 2);

      const move = performRoomMove(state, mockClient("player-1"), {
        from: 23,
        to: "off",
        die: 1,
      });

      expect(move.actionResult.endsGame).toBe(false);
      expect(move.gameResult).toBeNull();
      expect(state.blackBorneOff).toBe(14);
    });
  });

  describe("Edge cases", () => {
    it("handles forced pass when no valid moves exist", () => {
      const state = createStartedGame();
      setBoard(state, Array.from({ length: 24 }, () => 0));
      state.points[0] = 1;
      state.points[5] = -2;
      state.points[6] = -2;
      state.currentTurn = "player-1";
      setDice(state, 5, 6);

      const availableDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice));
      expect(hasValidMoves(state.points, 0, 0, 0, 0, availableDice, BLACK)).toBe(false);
    });

    it("validates initial board setup correctness", () => {
      const state = createStartedGame();
      const points = Array.from(state.points);

      const blackCount = points.reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
      const redCount = points.reduce((sum, count) => sum + (count < 0 ? -count : 0), 0);

      expect(blackCount).toBe(15);
      expect(redCount).toBe(15);
      expect(points[0]).toBe(2);
      expect(points[11]).toBe(5);
      expect(points[16]).toBe(3);
      expect(points[18]).toBe(5);
      expect(points[23]).toBe(-2);
      expect(points[12]).toBe(-5);
      expect(points[7]).toBe(-3);
      expect(points[5]).toBe(-5);
    });

    it("handles player disconnect", () => {
      const state = createStartedGame();

      backgammonPlugin.lifecycle.onPlayerLeave?.(state, "player-1");

      const player = state.players.get("player-1");
      expect(player?.isConnected).toBe(false);
    });

    it("marks game as ended on game end", () => {
      const state = createStartedGame();
      state.phase = "playing";

      backgammonPlugin.lifecycle.onGameEnd?.(state);

      expect(state.phase).toBe("ended");
    });
  });
});

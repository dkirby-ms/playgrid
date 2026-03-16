import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../../../shared/src/index.ts"));

const shared = await import("../../../../../shared/src/index.ts");
const { BackgammonState, PlayerInfo } = shared;
const { selectCpuAction } = await import("../CpuOpponent");

const CPU_SESSION_ID = "cpu-opponent";
const BOARD_SIZE = 24;

type BackgammonStateInstance = InstanceType<typeof BackgammonState>;

function createState(): BackgammonStateInstance {
  const state = new BackgammonState();

  const human = new PlayerInfo();
  human.sessionId = "player-1";
  human.displayName = "Player 1";
  human.playerIndex = 0;
  state.players.set(human.sessionId, human);

  const cpu = new PlayerInfo();
  cpu.sessionId = CPU_SESSION_ID;
  cpu.displayName = "CPU Opponent";
  cpu.playerIndex = 1;
  state.players.set(cpu.sessionId, cpu);

  state.currentTurn = CPU_SESSION_ID;
  state.phase = "playing";

  // Initialize dice to 0,0 (need to roll)
  state.dice[0] = 0;
  state.dice[1] = 0;
  state.usedDice[0] = false;
  state.usedDice[1] = false;

  return state;
}

function setBoard(state: BackgammonStateInstance, points: number[]) {
  for (const [index, count] of points.entries()) {
    state.points[index] = count;
  }
}

function emptyBoard(): number[] {
  return Array.from({ length: BOARD_SIZE }, () => 0);
}

describe("selectCpuAction", () => {
  it("returns a roll action when dice are unrolled", () => {
    const state = createState();
    setBoard(state, emptyBoard());
    state.dice[0] = 0;
    state.dice[1] = 0;

    const action = selectCpuAction(state);
    expect(action).toEqual({ actionType: "roll" });
  });

  it("returns a move action when dice are rolled", () => {
    const state = createState();
    const board = emptyBoard();
    // Red piece on point 23 (Red moves 23→0)
    board[23] = -2;
    setBoard(state, board);

    state.dice[0] = 3;
    state.dice[1] = 1;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action?.actionType).toBe("move");
  });

  it("returns a pass action when no valid moves remain", () => {
    const state = createState();
    const board = emptyBoard();
    // Red piece blocked: single red piece, all landing spots blocked by black
    board[23] = -1;
    board[22] = 2;
    board[21] = 2;
    board[20] = 2;
    board[19] = 2;
    board[18] = 2;
    board[17] = 2;
    setBoard(state, board);

    state.dice[0] = 3;
    state.dice[1] = 5;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).toEqual({ actionType: "pass" });
  });

  it("prefers bearing off when possible", () => {
    const state = createState();
    const board = emptyBoard();
    // Red pieces in home board (points 0-5), ready to bear off
    board[0] = -2;
    board[1] = -2;
    board[3] = -1;
    setBoard(state, board);
    state.redBorneOff = 10;

    state.dice[0] = 2;
    state.dice[1] = 4;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action?.actionType).toBe("move");
    if (action?.actionType === "move") {
      expect(action.payload.to).toBe("off");
    }
  });

  it("handles bar entry moves", () => {
    const state = createState();
    const board = emptyBoard();
    setBoard(state, board);
    state.redBar = 1;

    state.dice[0] = 3;
    state.dice[1] = 5;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action?.actionType).toBe("move");
    if (action?.actionType === "move") {
      expect(action.payload.from).toBe("bar");
    }
  });

  it("prefers hitting an opponent blot", () => {
    const state = createState();
    const board = emptyBoard();
    // Red piece on point 10, black blot on point 7 (3 away)
    board[10] = -2;
    board[7] = 1;
    // Another safe destination on point 6
    board[6] = -1;
    setBoard(state, board);

    state.dice[0] = 3;
    state.dice[1] = 4;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action?.actionType).toBe("move");
    if (action?.actionType === "move") {
      // Should hit the blot at point 7
      expect(action.payload.from).toBe(10);
      expect(action.payload.to).toBe(7);
      expect(action.payload.die).toBe(3);
    }
  });

  it("prefers making a point (stacking) over leaving a blot", () => {
    const state = createState();
    const board = emptyBoard();
    // Red has 2 pieces on point 10 and 1 on point 7
    board[10] = -2;
    board[7] = -1;
    setBoard(state, board);

    state.dice[0] = 3;
    state.dice[1] = 5;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action?.actionType).toBe("move");
    if (action?.actionType === "move") {
      // Should move to point 7 (making a point) with die 3
      expect(action.payload.to).toBe(7);
      expect(action.payload.die).toBe(3);
    }
  });

  it("returns a pass action for a player with no pieces", () => {
    const state = createState();
    const board = emptyBoard();
    setBoard(state, board);

    state.dice[0] = 3;
    state.dice[1] = 5;
    state.usedDice[0] = false;
    state.usedDice[1] = false;

    const action = selectCpuAction(state);
    expect(action).toEqual({ actionType: "pass" });
  });
});

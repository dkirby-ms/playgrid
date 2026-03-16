import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../../../shared/src/index.ts"));

const shared = await import("../../../../../shared/src/index.ts");
const { BLACK, CheckersState, EMPTY, PlayerInfo, RED } = shared;
const { selectCpuMove } = await import("../CpuOpponent");

const BOARD_WIDTH = 8;
const CPU_SESSION_ID = "cpu-opponent";

type CheckersStateInstance = InstanceType<typeof CheckersState>;

function toIndex(row: number, col: number): number {
  return (row * BOARD_WIDTH) + col;
}

function createState(): CheckersStateInstance {
  const state = new CheckersState();

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

  return state;
}

function setBoard(state: CheckersStateInstance, pieces: Array<[number, number]>) {
  const board = Array.from({ length: BOARD_WIDTH * BOARD_WIDTH }, () => EMPTY);
  for (const [index, piece] of pieces) {
    board[index] = piece;
  }

  for (const [index, piece] of board.entries()) {
    state.board[index] = piece;
  }

  state.mustCaptureFrom = -1;
}

describe("selectCpuMove", () => {
  it("prefers a legal capture when one is available", () => {
    const state = createState();
    setBoard(state, [
      [toIndex(5, 2), RED],
      [toIndex(4, 3), BLACK],
      [toIndex(5, 6), RED],
      [toIndex(0, 1), BLACK],
    ]);

    expect(selectCpuMove(state)).toEqual({
      from: toIndex(5, 2),
      to: toIndex(3, 4),
    });
  });

  it("prefers king promotion over a regular advance", () => {
    const state = createState();
    setBoard(state, [
      [toIndex(1, 2), RED],
      [toIndex(0, 1), BLACK],
      [toIndex(5, 6), RED],
      [toIndex(7, 6), BLACK],
    ]);

    expect(selectCpuMove(state)).toEqual({
      from: toIndex(1, 2),
      to: toIndex(0, 3),
    });
  });

  it("advances the most progressed piece when no capture or promotion is available", () => {
    const state = createState();
    setBoard(state, [
      [toIndex(6, 1), RED],
      [toIndex(4, 5), RED],
      [toIndex(7, 6), BLACK],
    ]);

    expect(selectCpuMove(state)).toEqual({
      from: toIndex(4, 5),
      to: toIndex(3, 4),
    });
  });

  it("respects an in-progress forced capture chain", () => {
    const state = createState();
    setBoard(state, [
      [toIndex(4, 3), RED],
      [toIndex(3, 4), BLACK],
      [toIndex(2, 1), RED],
      [toIndex(7, 6), BLACK],
    ]);
    state.mustCaptureFrom = toIndex(4, 3);

    expect(selectCpuMove(state)).toEqual({
      from: toIndex(4, 3),
      to: toIndex(2, 5),
    });
  });
});

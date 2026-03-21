import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@eschaton/shared",
  async () => await import("../../../../../shared/src/index.ts"),
);

const shared = await import("../../../../../shared/src/index.ts");
const { DominosPlayerState, DominosState, PlayerInfo } = shared;

import { selectCpuAction, type CpuAction } from "../CpuOpponent.js";
import { setPlayerHand } from "../DominosPlugin.js";
import {
  getValidEnds,
  type RawTile,
} from "../dominosLogic.js";

// ── Constants ────────────────────────────────────────────────────────

const CPU_ID = "cpu-opponent";
const HUMAN_ID = "player-1";

// ── Helpers ──────────────────────────────────────────────────────────

type State = InstanceType<typeof DominosState>;

function tile(id: number, high: number, low: number): RawTile {
  return { id, highPips: high, lowPips: low };
}

function addPlayer(state: State, sessionId: string, idx: number): void {
  const p = new PlayerInfo();
  p.sessionId = sessionId;
  p.displayName = `Player ${idx}`;
  p.playerIndex = idx;
  state.players.set(sessionId, p);
  state.playerStates.set(sessionId, new DominosPlayerState());
}

function setup(opts: {
  cpuHand: RawTile[];
  humanHand?: RawTile[];
  openEndA?: number;
  openEndB?: number;
  openEndC?: number;
  openEndD?: number;
  boneyardCount?: number;
  currentTurn?: string;
}): State {
  const state = new DominosState();
  addPlayer(state, HUMAN_ID, 0);
  addPlayer(state, CPU_ID, 1);

  setPlayerHand(state, HUMAN_ID, opts.humanHand ?? [tile(100, 6, 5)]);
  setPlayerHand(state, CPU_ID, opts.cpuHand);

  state.currentTurn = opts.currentTurn ?? CPU_ID;
  state.phase = "playing";
  state.openEndA = opts.openEndA ?? -1;
  state.openEndB = opts.openEndB ?? -1;
  state.openEndC = opts.openEndC ?? -1;
  state.openEndD = opts.openEndD ?? -1;
  state.boneyardCount = opts.boneyardCount ?? 0;

  return state;
}

/** Extract play payload — asserts actionType is "play". */
function expectPlay(action: CpuAction | null): { tileId: number; end: string } {
  expect(action).not.toBeNull();
  expect(action!.actionType).toBe("play");
  if (action!.actionType !== "play") throw new Error("unreachable");
  return action!.payload;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("selectCpuAction — extended scenarios", () => {

  // ── Move Selection ──────────────────────────────────────────────

  describe("move selection", () => {
    it("selects a valid tile that matches an open end", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1), tile(1, 5, 2)],
        openEndA: 3,
        openEndB: 6,
      });

      const { tileId, end } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(0); // only [3-1] matches end A
      expect(getValidEnds(tile(0, 3, 1), 3, 6)).toContain(end);
    });

    it("plays a double when available (preference heuristic)", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1), tile(1, 3, 3)],
        openEndA: 3,
        openEndB: 6,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(1); // double [3-3] preferred
    });

    it("prefers higher-pip tiles when multiple valid moves exist", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1), tile(1, 6, 3), tile(2, 5, 3)],
        openEndA: 3,
        openEndB: 4,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(1); // [6-3] pip total 9 > [5-3] 8 > [3-1] 4
    });

    it("signals draw when no tiles match and boneyard has tiles", () => {
      const state = setup({
        cpuHand: [tile(0, 1, 0), tile(1, 2, 0)],
        openEndA: 5,
        openEndB: 6,
        boneyardCount: 5,
      });

      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("draw");
    });

    it("signals pass when no tiles match and boneyard is empty", () => {
      const state = setup({
        cpuHand: [tile(0, 1, 0), tile(1, 2, 0)],
        openEndA: 5,
        openEndB: 6,
        boneyardCount: 0,
      });

      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("pass");
    });

    it("handles spinner — all 4 ends open", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1), tile(1, 5, 4)],
        openEndA: 3,
        openEndB: 6,
        openEndC: 4,
        openEndD: 4,
      });

      const { tileId, end } = expectPlay(selectCpuAction(state));
      const chosen = [tile(0, 3, 1), tile(1, 5, 4)].find(t => t.id === tileId)!;
      const validEnds = getValidEnds(chosen, 3, 6, 4, 4);
      expect(validEnds).toContain(end);
    });

    it("chooses the only playable tile when exactly one matches", () => {
      const state = setup({
        cpuHand: [tile(0, 1, 0), tile(1, 2, 0), tile(2, 6, 4)],
        openEndA: 6,
        openEndB: 3,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(2); // only [6-4] matches
    });

    it("selects any tile on an empty board (first play)", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1), tile(1, 6, 6), tile(2, 5, 3)],
        openEndA: -1,
        openEndB: -1,
      });

      const { end } = expectPlay(selectCpuAction(state));
      expect(end).toBe("a"); // first play always on arm A
    });
  });

  // ── Turn Integration ────────────────────────────────────────────

  describe("turn integration", () => {
    it("returns null when currentTurn player doesn't exist", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1)],
        openEndA: 3,
        openEndB: 6,
        currentTurn: "nonexistent",
      });

      expect(selectCpuAction(state)).toBeNull();
    });

    it("evaluates the current turn player's hand, not a specific CPU", () => {
      // When human is current turn, selectCpuAction evaluates THEIR hand
      const state = setup({
        cpuHand: [tile(0, 3, 1)],
        humanHand: [tile(100, 6, 5)],
        openEndA: 6,
        openEndB: 3,
        currentTurn: HUMAN_ID,
      });

      // It should find human's [6-5] playable on end A (6)
      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("play");
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("CPU with all doubles in hand", () => {
      const state = setup({
        cpuHand: [
          tile(0, 1, 1), tile(1, 2, 2), tile(2, 3, 3),
          tile(3, 4, 4), tile(4, 5, 5),
        ],
        openEndA: 3,
        openEndB: 6,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(2); // only [3-3] matches end A
    });

    it("CPU is the first player (opens with best double)", () => {
      const state = setup({
        cpuHand: [tile(0, 6, 6), tile(1, 5, 3), tile(2, 4, 1)],
        openEndA: -1,
        openEndB: -1,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(0); // [6-6] double + highest pips
    });

    it("CPU's last tile — result is a valid play", () => {
      const state = setup({
        cpuHand: [tile(0, 5, 3)],
        openEndA: 5,
        openEndB: 6,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(0);
    });

    it("blocked game: no playable tile, empty boneyard → pass", () => {
      const state = setup({
        cpuHand: [tile(0, 1, 0)],
        humanHand: [tile(100, 2, 0)],
        openEndA: 5,
        openEndB: 6,
        boneyardCount: 0,
      });

      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("pass");
    });

    it("tile matching both open ends — picks the better end", () => {
      const state = setup({
        cpuHand: [tile(0, 5, 3)],
        openEndA: 5,
        openEndB: 3,
      });

      const { tileId, end } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(0);
      expect(["a", "b"]).toContain(end);
    });

    it("spinner C/D arms — plays on perpendicular end", () => {
      const state = setup({
        cpuHand: [tile(0, 4, 2)],
        openEndA: 6,
        openEndB: 1,
        openEndC: 4,
        openEndD: 4,
      });

      const { end } = expectPlay(selectCpuAction(state));
      expect(["c", "d"]).toContain(end);
    });

    it("all non-matching tiles with boneyard → draw", () => {
      const state = setup({
        cpuHand: [tile(0, 1, 0), tile(1, 2, 1), tile(2, 0, 0)],
        openEndA: 5,
        openEndB: 6,
        openEndC: 4,
        openEndD: 3,
        boneyardCount: 10,
      });

      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("draw");
    });

    it("all non-matching tiles without boneyard → pass", () => {
      const state = setup({
        cpuHand: [tile(0, 1, 0), tile(1, 2, 1), tile(2, 0, 0)],
        openEndA: 5,
        openEndB: 6,
        openEndC: 4,
        openEndD: 3,
        boneyardCount: 0,
      });

      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("pass");
    });
  });

  // ── Multi-player scenarios ──────────────────────────────────────

  describe("multi-player scenarios", () => {
    it("2-player game: CPU picks optimal move against 1 human", () => {
      const state = setup({
        cpuHand: [tile(0, 6, 3), tile(1, 4, 2)],
        humanHand: [tile(100, 5, 1)],
        openEndA: 6,
        openEndB: 2,
      });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(0); // [6-3] higher pips
    });

    it("4-player game: each CPU selects valid moves when given the turn", () => {
      const state = new DominosState();
      const cpuIds = ["cpu-1", "cpu-2", "cpu-3"];

      addPlayer(state, HUMAN_ID, 0);
      addPlayer(state, cpuIds[0], 1);
      addPlayer(state, cpuIds[1], 2);
      addPlayer(state, cpuIds[2], 3);

      setPlayerHand(state, HUMAN_ID, [tile(100, 5, 5)]);
      setPlayerHand(state, cpuIds[0], [tile(0, 3, 1)]);  // matches A (3)
      setPlayerHand(state, cpuIds[1], [tile(1, 4, 2)]);  // matches B (4)
      setPlayerHand(state, cpuIds[2], [tile(2, 1, 0)]);  // no match

      state.phase = "playing";
      state.openEndA = 3;
      state.openEndB = 4;
      state.boneyardCount = 0;

      // CPU-1's turn — can play
      state.currentTurn = cpuIds[0];
      const r1 = selectCpuAction(state);
      expect(r1!.actionType).toBe("play");

      // CPU-2's turn — can play
      state.currentTurn = cpuIds[1];
      const r2 = selectCpuAction(state);
      expect(r2!.actionType).toBe("play");

      // CPU-3's turn — must pass (no boneyard)
      state.currentTurn = cpuIds[2];
      const r3 = selectCpuAction(state);
      expect(r3!.actionType).toBe("pass");
    });

    it("4-player game: CPU picks double over high-pip with 3 opponents", () => {
      const state = new DominosState();
      const cpuIds = ["cpu-1", "cpu-2", "cpu-3"];

      addPlayer(state, HUMAN_ID, 0);
      addPlayer(state, cpuIds[0], 1);
      addPlayer(state, cpuIds[1], 2);
      addPlayer(state, cpuIds[2], 3);

      setPlayerHand(state, HUMAN_ID, [tile(100, 5, 5)]);
      setPlayerHand(state, cpuIds[0], [tile(0, 6, 6), tile(1, 6, 3), tile(2, 3, 1)]);
      setPlayerHand(state, cpuIds[1], [tile(10, 5, 2)]);
      setPlayerHand(state, cpuIds[2], [tile(20, 4, 1)]);

      state.phase = "playing";
      state.currentTurn = cpuIds[0];
      state.openEndA = 6;
      state.openEndB = 3;

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(tileId).toBe(0); // [6-6] double + highest pips
    });
  });

  // ── Return value contract ───────────────────────────────────────

  describe("return value contract", () => {
    it("play action has tileId (number) and end (a|b|c|d)", () => {
      const state = setup({
        cpuHand: [tile(0, 3, 1)],
        openEndA: 3,
        openEndB: 6,
      });

      const action = selectCpuAction(state);
      expect(action).not.toBeNull();
      expect(action!.actionType).toBe("play");
      if (action!.actionType === "play") {
        expect(typeof action!.payload.tileId).toBe("number");
        expect(["a", "b", "c", "d"]).toContain(action!.payload.end);
      }
    });

    it("returned tileId references a tile in the CPU hand", () => {
      const cpuHand = [tile(7, 4, 2), tile(8, 5, 3), tile(9, 6, 1)];
      const state = setup({ cpuHand, openEndA: 4, openEndB: 6 });

      const { tileId } = expectPlay(selectCpuAction(state));
      expect(cpuHand.map(t => t.id)).toContain(tileId);
    });

    it("returned end is valid for the chosen tile on the current board", () => {
      const cpuHand = [tile(0, 5, 3), tile(1, 6, 2)];
      const state = setup({
        cpuHand,
        openEndA: 5,
        openEndB: 2,
        openEndC: 3,
        openEndD: 3,
      });

      const { tileId, end } = expectPlay(selectCpuAction(state));
      const chosen = cpuHand.find(t => t.id === tileId)!;
      const validEnds = getValidEnds(chosen, 5, 2, 3, 3);
      expect(validEnds).toContain(end);
    });
  });
});

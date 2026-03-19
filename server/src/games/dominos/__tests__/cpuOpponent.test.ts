import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../../../shared/src/index.ts"));

const shared = await import("../../../../../shared/src/index.ts");
const { DominosState, DominosPlayerState, PlayerInfo } = shared;
const { selectCpuAction } = await import("../CpuOpponent");
const { setPlayerHand, getPlayerHands } = await import("../DominosPlugin");
const { placeTileOnBoard } = await import("../dominosLogic");

import type { RawTile, PlayEnd } from "../dominosLogic";

const CPU_SESSION_ID = "cpu-opponent";
const HUMAN_SESSION_ID = "player-1";

type DominosStateInstance = InstanceType<typeof DominosState>;

function createState(): DominosStateInstance {
  const state = new DominosState();

  const human = new PlayerInfo();
  human.sessionId = HUMAN_SESSION_ID;
  human.displayName = "Player 1";
  human.playerIndex = 0;
  state.players.set(human.sessionId, human);

  const cpu = new PlayerInfo();
  cpu.sessionId = CPU_SESSION_ID;
  cpu.displayName = "CPU Opponent";
  cpu.playerIndex = 1;
  state.players.set(cpu.sessionId, cpu);

  const humanPs = new DominosPlayerState();
  state.playerStates.set(HUMAN_SESSION_ID, humanPs);

  const cpuPs = new DominosPlayerState();
  state.playerStates.set(CPU_SESSION_ID, cpuPs);

  state.currentTurn = CPU_SESSION_ID;
  state.phase = "playing";

  return state;
}

function tile(id: number, high: number, low: number): RawTile {
  return { id, highPips: high, lowPips: low };
}

describe("selectCpuAction — dominos", () => {
  it("returns null when current player is not found", () => {
    const state = createState();
    state.currentTurn = "nonexistent";
    expect(selectCpuAction(state)).toBeNull();
  });

  it("returns null when CPU hand is empty", () => {
    const state = createState();
    setPlayerHand(state, CPU_SESSION_ID, []);
    expect(selectCpuAction(state)).toBeNull();
  });

  it("plays a tile on an empty board", () => {
    const state = createState();
    const hand: RawTile[] = [tile(0, 3, 1), tile(1, 5, 2)];
    setPlayerHand(state, CPU_SESSION_ID, hand);

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("play");
  });

  it("prefers playing a double over a non-double", () => {
    const state = createState();
    // Place an initial tile so the board has open ends
    placeTileOnBoard(state, tile(99, 3, 3), "a");

    // CPU hand: a double [3,3] and a non-double [3,1]
    // Both match open end 3, but the double should be preferred
    const hand: RawTile[] = [tile(0, 3, 1), tile(1, 3, 3)];
    setPlayerHand(state, CPU_SESSION_ID, hand);

    // Reset open ends — after placing [3,3], both ends are 3
    // So both tiles match. But the double should be preferred.
    // Let's set up a fresh board with openEndA=3, openEndB=5
    const freshState = createState();
    placeTileOnBoard(freshState, tile(99, 5, 3), "a");
    setPlayerHand(freshState, CPU_SESSION_ID, [tile(0, 3, 1), tile(1, 3, 3)]);

    const action = selectCpuAction(freshState);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("play");
    if (action!.actionType === "play") {
      expect(action!.payload.tileId).toBe(1); // the double
    }
  });

  it("prefers higher-pip tiles when no doubles are involved", () => {
    const state = createState();
    placeTileOnBoard(state, tile(99, 6, 3), "a");
    // openEndA = 3, openEndB = 6
    // Both tiles match end A (value 3). [3,5] has pip total 8, [3,1] has pip total 4
    setPlayerHand(state, CPU_SESSION_ID, [tile(0, 3, 1), tile(1, 5, 3)]);

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("play");
    if (action!.actionType === "play") {
      expect(action!.payload.tileId).toBe(1); // higher pip total
    }
  });

  it("draws when no playable tile and boneyard has tiles", () => {
    const state = createState();
    placeTileOnBoard(state, tile(99, 6, 5), "a");
    // openEndA = 5, openEndB = 6
    // CPU hand has tiles that don't match either end
    setPlayerHand(state, CPU_SESSION_ID, [tile(0, 1, 0), tile(1, 2, 0)]);
    state.boneyardCount = 5;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("draw");
  });

  it("passes when no playable tile and boneyard is empty", () => {
    const state = createState();
    placeTileOnBoard(state, tile(99, 6, 5), "a");
    setPlayerHand(state, CPU_SESSION_ID, [tile(0, 1, 0), tile(1, 2, 0)]);
    state.boneyardCount = 0;

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("pass");
  });

  it("selects a valid end for the chosen tile", () => {
    const state = createState();
    placeTileOnBoard(state, tile(99, 6, 3), "a");
    // openEndA = 3, openEndB = 6
    // Tile [6,4] only matches end B
    setPlayerHand(state, CPU_SESSION_ID, [tile(0, 6, 4)]);

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("play");
    if (action!.actionType === "play") {
      expect(action!.payload.tileId).toBe(0);
      expect(action!.payload.end).toBe("b");
    }
  });

  it("considers flexibility when choosing between same-pip tiles", () => {
    const state = createState();
    placeTileOnBoard(state, tile(99, 4, 2), "a");
    // openEndA = 2, openEndB = 4
    // Hand: [2,6] and [2,1]
    // Both match end A. [2,6] opens end 6, [2,1] opens end 1.
    // If we also have [6,5] in hand, placing [2,6] leaves a match for [6,5]
    const hand: RawTile[] = [tile(0, 6, 2), tile(1, 2, 1), tile(2, 6, 5)];
    setPlayerHand(state, CPU_SESSION_ID, hand);

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("play");
    if (action!.actionType === "play") {
      // [2,6] should be preferred: higher pips + flexibility from [6,5]
      expect(action!.payload.tileId).toBe(0);
    }
  });

  it("handles perpendicular arms (C/D) when spinner exists", () => {
    const state = createState();

    // Build a board with spinner: place [3,3] first (becomes spinner)
    placeTileOnBoard(state, tile(99, 3, 3), "a");
    // Now openEndA = 3, openEndB = 3, spinner established

    // Play on arm A to start extending
    placeTileOnBoard(state, tile(98, 5, 3), "a");
    // openEndA = 5

    // Play on arm B
    placeTileOnBoard(state, tile(97, 3, 1), "b");
    // openEndB = 1, arms C/D should now activate (both have ≥1 tile)

    // Now C and D are open at 3 (spinner pip value)
    expect(state.openEndC).toBe(3);
    expect(state.openEndD).toBe(3);

    // CPU has a tile that only matches end C/D (value 3), not A (5) or B (1)
    setPlayerHand(state, CPU_SESSION_ID, [tile(0, 3, 0)]);

    const action = selectCpuAction(state);
    expect(action).not.toBeNull();
    expect(action!.actionType).toBe("play");
    if (action!.actionType === "play") {
      expect(action!.payload.tileId).toBe(0);
      expect(["c", "d"]).toContain(action!.payload.end);
    }
  });
});

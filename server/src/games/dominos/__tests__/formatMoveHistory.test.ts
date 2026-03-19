import { describe, expect, it, vi } from "vitest";
import type { MoveEntry } from "@eschaton/shared";

vi.mock("@eschaton/shared", async () => await import("../../../../../../shared/src/index.ts"));

const shared = await import("../../../../../../shared/src/index.ts");
const { DominosState } = shared;
const { dominosPlugin } = await import("../DominosPlugin");

function createGameState() {
  const state = dominosPlugin.createState();
  dominosPlugin.lifecycle.onPlayerJoin?.(
    state,
    { sessionId: "player-1" } as never,
    0,
  );
  dominosPlugin.lifecycle.onPlayerJoin?.(
    state,
    { sessionId: "player-2" } as never,
    1,
  );
  const p1 = state.players.get("player-1")!;
  p1.displayName = "Alice";
  const p2 = state.players.get("player-2")!;
  p2.displayName = "Bob";
  return state;
}

function makeMoveEntry(
  overrides: Partial<MoveEntry> & { payload: Record<string, unknown> },
): MoveEntry {
  return {
    turnNumber: 1,
    playerId: "player-1",
    playerName: "Alice",
    actionType: "play",
    timestamp: 0,
    ...overrides,
  };
}

describe("DominosPlugin.formatMoveHistory", () => {
  it("exists on the plugin", () => {
    expect(dominosPlugin.formatMoveHistory).toBeDefined();
    expect(typeof dominosPlugin.formatMoveHistory).toBe("function");
  });

  it("returns empty array for empty history", () => {
    const state = createGameState();
    const result = dominosPlugin.formatMoveHistory!(state, []);
    expect(result).toEqual([]);
  });

  it("formats a play action with tile on end a", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "play",
        payload: { tileId: 0, tile: [3, 5], end: "a" } 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice played [3|5] on A end");
  });

  it("formats a play action with tile on end b", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "play",
        payload: { tileId: 0, tile: [6, 6], end: "b" } 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice played [6|6] on B end");
  });

  it("formats a play action without tile on end a", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "play",
        payload: { tileId: 0, end: "a" } 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice played tile on A end");
  });

  it("formats a draw action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "draw",
        payload: {} 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice drew from boneyard");
  });

  it("formats a pass action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "pass",
        payload: {} 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice passed");
  });

  it("handles missing tile and end gracefully", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "play", payload: {} }),
      makeMoveEntry({ actionType: "play", payload: { tileId: 5 } }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Alice played a tile");
    expect(result[1].description).toBe("Alice played a tile");
  });

  it("handles unknown player gracefully", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        playerId: "unknown-player",
        playerName: "Ghost",
        actionType: "play",
        payload: { tileId: 0, tile: [4, 4], end: "a" } 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Ghost played [4|4] on A end");
  });

  it("preserves original MoveEntry fields", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({
        turnNumber: 5,
        playerId: "player-2",
        playerName: "Bob",
        actionType: "play",
        timestamp: 12345,
        payload: { tileId: 10, tile: [2, 6], end: "b" },
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].turnNumber).toBe(5);
    expect(result[0].playerId).toBe("player-2");
    expect(result[0].playerName).toBe("Bob");
    expect(result[0].actionType).toBe("play");
    expect(result[0].timestamp).toBe(12345);
    expect(result[0].payload).toEqual({ tileId: 10, tile: [2, 6], end: "b" });
  });

  it("does not mutate the original moves array", () => {
    const state = createGameState();
    const original: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "play",
        payload: { tileId: 0, tile: [3, 5], end: "a" } 
      }),
    ];
    const originalCopy = JSON.parse(JSON.stringify(original));
    dominosPlugin.formatMoveHistory!(state, original);
    expect(original).toEqual(originalCopy);
  });

  it("handles unknown action types gracefully", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "unknown-action",
        payload: { some: "data" } 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("formats multiple moves in sequence", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        turnNumber: 1,
        actionType: "play",
        payload: { tileId: 0, tile: [6, 6], end: "a" } 
      }),
      makeMoveEntry({ 
        turnNumber: 2,
        playerId: "player-2",
        playerName: "Bob",
        actionType: "play",
        payload: { tileId: 1, tile: [6, 3], end: "a" } 
      }),
      makeMoveEntry({ 
        turnNumber: 3,
        actionType: "draw",
        payload: {} 
      }),
      makeMoveEntry({ 
        turnNumber: 4,
        playerId: "player-2",
        playerName: "Bob",
        actionType: "pass",
        payload: {} 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(4);
    expect(result[0].description).toBe("Alice played [6|6] on A end");
    expect(result[1].description).toBe("Bob played [6|3] on A end");
    expect(result[2].description).toBe("Alice drew from boneyard");
    expect(result[3].description).toBe("Bob passed");
  });

  it("formats double tiles correctly", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "play",
        payload: { tileId: 0, tile: [0, 0], end: "a" } 
      }),
      makeMoveEntry({ 
        actionType: "play",
        payload: { tileId: 1, tile: [6, 6], end: "b" } 
      }),
    ];
    const result = dominosPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice played [0|0] on A end");
    expect(result[1].description).toBe("Alice played [6|6] on B end");
  });
});

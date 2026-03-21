import { describe, expect, it, vi } from "vitest";
import type { MoveEntry } from "@eschaton/shared";

vi.mock("@eschaton/shared", async () => await import("../../../../../../shared/src/index.ts"));

const { backgammonPlugin } = await import("../BackgammonPlugin");

function createGameState() {
  const state = backgammonPlugin.createState();
  backgammonPlugin.lifecycle.onPlayerJoin?.(
    state,
    { sessionId: "player-1" } as never,
    0,
  );
  backgammonPlugin.lifecycle.onPlayerJoin?.(
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
    actionType: "move",
    timestamp: 0,
    ...overrides,
  };
}

describe("BackgammonPlugin.formatMoveHistory", () => {
  it("exists on the plugin", () => {
    expect(backgammonPlugin.formatMoveHistory).toBeDefined();
    expect(typeof backgammonPlugin.formatMoveHistory).toBe("function");
  });

  it("returns empty array for empty history", () => {
    const state = createGameState();
    const result = backgammonPlugin.formatMoveHistory!(state, []);
    expect(result).toEqual([]);
  });

  it("formats a roll action with two different dice", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "roll",
        payload: { die1: 3, die2: 5 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice rolled 3 and 5");
  });

  it("formats a roll action with doubles", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "roll",
        payload: { die1: 4, die2: 4 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice rolled doubles: 4");
  });

  it("formats a regular move from point to point", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "move",
        payload: { from: 8, to: 5, die: 3 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice moved from point 8 to point 5");
  });

  it("formats a move that hits opponent's blot", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "move",
        payload: { from: 6, to: 3, die: 3, hit: true } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice moved from point 6 to point 3 (hit)");
  });

  it("formats entering from bar to a point", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "move",
        payload: { from: "bar", to: 5, die: 5 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice entered from bar to point 5");
  });

  it("formats bearing off from a point", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "move",
        payload: { from: 3, to: "off", die: 3 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice bore off from point 3");
  });

  it("formats a pass action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "pass",
        payload: {} 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice had no valid moves — passed");
  });

  it("handles missing payload fields gracefully for roll", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "roll", payload: {} }),
      makeMoveEntry({ actionType: "roll", payload: { die1: 3 } }),
      makeMoveEntry({ actionType: "roll", payload: { die2: 5 } }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(3);
    expect(result[0].description).toBeUndefined();
    expect(result[1].description).toBeUndefined();
    expect(result[2].description).toBeUndefined();
  });

  it("handles missing payload fields gracefully for move", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "move", payload: {} }),
      makeMoveEntry({ actionType: "move", payload: { from: 8 } }),
      makeMoveEntry({ actionType: "move", payload: { to: 5 } }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(3);
    expect(result[0].description).toBeUndefined();
    expect(result[1].description).toBeUndefined();
    expect(result[2].description).toBeUndefined();
  });

  it("handles unknown player ID gracefully", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        playerId: "unknown-player",
        playerName: "Ghost",
        actionType: "roll",
        payload: { die1: 2, die2: 4 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Ghost rolled 2 and 4");
  });

  it("preserves original MoveEntry fields", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({
        turnNumber: 5,
        playerId: "player-2",
        playerName: "Bob",
        actionType: "move",
        timestamp: 12345,
        payload: { from: 13, to: 8, die: 5 },
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result[0].turnNumber).toBe(5);
    expect(result[0].playerId).toBe("player-2");
    expect(result[0].playerName).toBe("Bob");
    expect(result[0].actionType).toBe("move");
    expect(result[0].timestamp).toBe(12345);
    expect(result[0].payload).toEqual({ from: 13, to: 8, die: 5 });
  });

  it("does not mutate the original moves array", () => {
    const state = createGameState();
    const original: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "roll",
        payload: { die1: 3, die2: 6 } 
      }),
    ];
    const originalCopy = JSON.parse(JSON.stringify(original));
    backgammonPlugin.formatMoveHistory!(state, original);
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
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("formats multiple moves in sequence", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        turnNumber: 1,
        actionType: "roll",
        payload: { die1: 3, die2: 5 } 
      }),
      makeMoveEntry({ 
        turnNumber: 1,
        actionType: "move",
        payload: { from: 8, to: 5, die: 3 } 
      }),
      makeMoveEntry({ 
        turnNumber: 1,
        actionType: "move",
        payload: { from: 6, to: 1, die: 5 } 
      }),
    ];
    const result = backgammonPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(3);
    expect(result[0].description).toBe("Alice rolled 3 and 5");
    expect(result[1].description).toBe("Alice moved from point 8 to point 5");
    expect(result[2].description).toBe("Alice moved from point 6 to point 1");
  });
});

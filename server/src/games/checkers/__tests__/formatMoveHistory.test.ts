import { describe, expect, it, vi } from "vitest";
import type { MoveEntry } from "@eschaton/shared";

vi.mock("@eschaton/shared", async () => await import("../../../../../shared/src/index.ts"));

const { checkersPlugin } = await import("../CheckersPlugin");

const BOARD_WIDTH = 8;

function toIndex(row: number, col: number): number {
  return row * BOARD_WIDTH + col;
}

function createGameState() {
  const state = checkersPlugin.createState();
  checkersPlugin.lifecycle.onPlayerJoin?.(
    state,
    { sessionId: "player-1" } as never,
    0,
  );
  checkersPlugin.lifecycle.onPlayerJoin?.(
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

describe("CheckersPlugin.formatMoveHistory", () => {
  it("exists on the plugin", () => {
    expect(checkersPlugin.formatMoveHistory).toBeDefined();
    expect(typeof checkersPlugin.formatMoveHistory).toBe("function");
  });

  it("returns empty array for empty history", () => {
    const state = createGameState();
    const result = checkersPlugin.formatMoveHistory!(state, []);
    expect(result).toEqual([]);
  });

  it("formats a regular move with coordinate notation", () => {
    const state = createGameState();
    // from=0 (A1), to=9 (B2)
    const moves: MoveEntry[] = [
      makeMoveEntry({ payload: { from: 0, to: 9 } }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice moved from A1 to B2");
  });

  it("formats a capture move (row delta = 2)", () => {
    const state = createGameState();
    // from=toIndex(2,1)=17 (B3), to=toIndex(4,3)=35 (D5) — jumps 2 rows
    const from = toIndex(2, 1);
    const to = toIndex(4, 3);
    const moves: MoveEntry[] = [makeMoveEntry({ payload: { from, to } })];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice captured at D5 (from B3)");
  });

  it("formats king promotion for BLACK reaching row 7", () => {
    const state = createGameState();
    // BLACK (player-1, playerIndex=0) moves to row 7
    const from = toIndex(6, 2);
    const to = toIndex(7, 3);
    const moves: MoveEntry[] = [
      makeMoveEntry({
        playerId: "player-1",
        playerName: "Alice",
        payload: { from, to },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice kinged at D8");
  });

  it("formats king promotion for RED reaching row 0", () => {
    const state = createGameState();
    // RED (player-2, playerIndex=1) moves to row 0
    const from = toIndex(1, 2);
    const to = toIndex(0, 3);
    const moves: MoveEntry[] = [
      makeMoveEntry({
        playerId: "player-2",
        playerName: "Bob",
        payload: { from, to },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Bob kinged at D1");
  });

  it("formats a capture that also promotes to king", () => {
    const state = createGameState();
    // BLACK captures and lands on row 7
    const from = toIndex(5, 4);
    const to = toIndex(7, 6);
    const moves: MoveEntry[] = [
      makeMoveEntry({
        playerId: "player-1",
        playerName: "Alice",
        payload: { from, to },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe(
      "Alice captured at G8 (from E6), kinged at G8",
    );
  });

  it("formats multi-jump captures with piece count", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({
        turnNumber: 1,
        payload: { from: toIndex(2, 1), to: toIndex(4, 3) },
      }),
      makeMoveEntry({
        turnNumber: 1,
        payload: { from: toIndex(4, 3), to: toIndex(6, 5) },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice captured 2 pieces");
    expect(result[1].description).toBe("Alice captured 2 pieces");
  });

  it("formats a triple-jump with correct count", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({
        turnNumber: 1,
        payload: { from: toIndex(0, 1), to: toIndex(2, 3) },
      }),
      makeMoveEntry({
        turnNumber: 1,
        payload: { from: toIndex(2, 3), to: toIndex(4, 5) },
      }),
      makeMoveEntry({
        turnNumber: 1,
        payload: { from: toIndex(4, 5), to: toIndex(6, 7) },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice captured 3 pieces");
    expect(result[1].description).toBe("Alice captured 3 pieces");
    expect(result[2].description).toBe("Alice captured 3 pieces");
  });

  it("handles moves with missing payload fields gracefully", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ payload: {} }),
      makeMoveEntry({ payload: { from: 0 } }),
      makeMoveEntry({ payload: { to: 9 } }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(3);
    expect(result[0].description).toBeUndefined();
    expect(result[1].description).toBeUndefined();
    expect(result[2].description).toBeUndefined();
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
        payload: { from: 0, to: 9 },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    expect(result[0].turnNumber).toBe(5);
    expect(result[0].playerId).toBe("player-2");
    expect(result[0].playerName).toBe("Bob");
    expect(result[0].actionType).toBe("move");
    expect(result[0].timestamp).toBe(12345);
    expect(result[0].payload).toEqual({ from: 0, to: 9 });
  });

  it("does not mutate the original moves array", () => {
    const state = createGameState();
    const original: MoveEntry[] = [
      makeMoveEntry({ payload: { from: 0, to: 9 } }),
    ];
    const originalCopy = JSON.parse(JSON.stringify(original));
    checkersPlugin.formatMoveHistory!(state, original);
    expect(original).toEqual(originalCopy);
  });

  it("handles unknown player gracefully (no king detection)", () => {
    const state = createGameState();
    // Player ID not in state — move to row 7 should not crash
    const moves: MoveEntry[] = [
      makeMoveEntry({
        playerId: "unknown-player",
        playerName: "Ghost",
        payload: { from: toIndex(6, 0), to: toIndex(7, 1) },
      }),
    ];
    const result = checkersPlugin.formatMoveHistory!(state, moves);
    // Can't determine king promotion without playerIndex, so regular move
    expect(result[0].description).toBe("Ghost moved from A7 to B8");
  });

  it("correctly converts board corners to notation", () => {
    const state = createGameState();
    const corners = [
      { from: 0, to: 9, expected: "A1 to B2" },
      { from: 7, to: 14, expected: "H1 to G2" },
    ];
    for (const { from, to, expected } of corners) {
      const result = checkersPlugin.formatMoveHistory!(state, [
        makeMoveEntry({ payload: { from, to } }),
      ]);
      expect(result[0].description).toContain(expected);
    }
  });
});

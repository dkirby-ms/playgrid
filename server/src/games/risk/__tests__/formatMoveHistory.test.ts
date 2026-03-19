import { describe, expect, it, vi } from "vitest";
import type { MoveEntry } from "@eschaton/shared";

vi.mock("@eschaton/shared", async () => await import("../../../../../../shared/src/index.ts"));

const shared = await import("../../../../../../shared/src/index.ts");
const { RiskState } = shared;
const { riskPlugin } = await import("../RiskPlugin");

function createGameState() {
  const state = riskPlugin.createState();
  riskPlugin.lifecycle.onPlayerJoin?.(
    state,
    { sessionId: "player-1" } as never,
    0,
  );
  riskPlugin.lifecycle.onPlayerJoin?.(
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
    actionType: "pickTerritory",
    timestamp: 0,
    ...overrides,
  };
}

describe("RiskPlugin.formatMoveHistory", () => {
  it("exists on the plugin", () => {
    expect(riskPlugin.formatMoveHistory).toBeDefined();
    expect(typeof riskPlugin.formatMoveHistory).toBe("function");
  });

  it("returns empty array for empty history", () => {
    const state = createGameState();
    const result = riskPlugin.formatMoveHistory!(state, []);
    expect(result).toEqual([]);
  });

  it("formats a territory pick action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "pickTerritory",
        payload: { territoryId: "alaska" } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice claimed Alaska");
  });

  it("formats a reinforce action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "placeArmy",
        payload: { territoryId: "eastern-united-states", count: 3 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice reinforced Eastern United States (+3)");
  });

  it("formats a reinforce action with default count", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "placeArmy",
        payload: { territoryId: "iceland" } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice reinforced Iceland (+1)");
  });

  it("formats an attack action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "attack",
        payload: { from: "western-europe", to: "southern-europe", attackerDice: 3 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice attacked Southern Europe from Western Europe (×3 dice)");
  });

  it("formats an attack action with 1 die", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "attack",
        payload: { from: "brazil", to: "argentina", attackerDice: 1 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice attacked Argentina from Brazil (×1 dice)");
  });

  it("formats a capture move action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "captureMove",
        payload: { count: 5 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice moved 5 armies into captured territory");
  });

  it("formats a fortify action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "fortify",
        payload: { from: "china", to: "mongolia", count: 4 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice fortified 4 armies: China → Mongolia");
  });

  it("formats a trade cards action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "tradeCards",
        payload: { cardCount: 3 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice traded 3 cards for reinforcements");
  });

  it("formats an end phase action", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "endPhase",
        payload: { phase: "attack" } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice ended phase");
  });

  it("handles missing payload fields gracefully for pickTerritory", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "pickTerritory", payload: {} }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("handles missing payload fields gracefully for placeArmy", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "placeArmy", payload: {} }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("handles missing payload fields gracefully for attack", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "attack", payload: {} }),
      makeMoveEntry({ actionType: "attack", payload: { from: "alaska" } }),
      makeMoveEntry({ actionType: "attack", payload: { to: "kamchatka" } }),
      makeMoveEntry({ actionType: "attack", payload: { from: "alaska", to: "kamchatka" } }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(4);
    expect(result[0].description).toBeUndefined();
    expect(result[1].description).toBeUndefined();
    expect(result[2].description).toBeUndefined();
    expect(result[3].description).toBeUndefined();
  });

  it("handles missing payload fields gracefully for fortify", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "fortify", payload: {} }),
      makeMoveEntry({ actionType: "fortify", payload: { from: "alaska", to: "kamchatka" } }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBeUndefined();
    expect(result[1].description).toBeUndefined();
  });

  it("handles missing payload fields gracefully for tradeCards", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "tradeCards", payload: {} }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("handles missing payload fields gracefully for captureMove", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ actionType: "captureMove", payload: {} }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("handles unknown player gracefully", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        playerId: "unknown-player",
        playerName: "Ghost",
        actionType: "pickTerritory",
        payload: { territoryId: "greenland" } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Ghost claimed Greenland");
  });

  it("preserves original MoveEntry fields", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({
        turnNumber: 5,
        playerId: "player-2",
        playerName: "Bob",
        actionType: "attack",
        timestamp: 12345,
        payload: { from: "ural", to: "siberia", attackerDice: 2 },
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].turnNumber).toBe(5);
    expect(result[0].playerId).toBe("player-2");
    expect(result[0].playerName).toBe("Bob");
    expect(result[0].actionType).toBe("attack");
    expect(result[0].timestamp).toBe(12345);
    expect(result[0].payload).toEqual({ from: "ural", to: "siberia", attackerDice: 2 });
  });

  it("does not mutate the original moves array", () => {
    const state = createGameState();
    const original: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "pickTerritory",
        payload: { territoryId: "brazil" } 
      }),
    ];
    const originalCopy = JSON.parse(JSON.stringify(original));
    riskPlugin.formatMoveHistory!(state, original);
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
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
  });

  it("formats multiple moves in sequence", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        turnNumber: 1,
        actionType: "pickTerritory",
        payload: { territoryId: "alaska" } 
      }),
      makeMoveEntry({ 
        turnNumber: 2,
        playerId: "player-2",
        playerName: "Bob",
        actionType: "pickTerritory",
        payload: { territoryId: "kamchatka" } 
      }),
      makeMoveEntry({ 
        turnNumber: 3,
        actionType: "placeArmy",
        payload: { territoryId: "alaska", count: 2 } 
      }),
      makeMoveEntry({ 
        turnNumber: 4,
        actionType: "attack",
        payload: { from: "alaska", to: "kamchatka", attackerDice: 3 } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result).toHaveLength(4);
    expect(result[0].description).toBe("Alice claimed Alaska");
    expect(result[1].description).toBe("Bob claimed Kamchatka");
    expect(result[2].description).toBe("Alice reinforced Alaska (+2)");
    expect(result[3].description).toBe("Alice attacked Kamchatka from Alaska (×3 dice)");
  });

  it("formats territory IDs with proper capitalization", () => {
    const state = createGameState();
    const moves: MoveEntry[] = [
      makeMoveEntry({ 
        actionType: "pickTerritory",
        payload: { territoryId: "eastern-united-states" } 
      }),
      makeMoveEntry({ 
        actionType: "pickTerritory",
        payload: { territoryId: "western-europe" } 
      }),
      makeMoveEntry({ 
        actionType: "pickTerritory",
        payload: { territoryId: "north-africa" } 
      }),
    ];
    const result = riskPlugin.formatMoveHistory!(state, moves);
    expect(result[0].description).toBe("Alice claimed Eastern United States");
    expect(result[1].description).toBe("Alice claimed Western Europe");
    expect(result[2].description).toBe("Alice claimed North Africa");
  });
});

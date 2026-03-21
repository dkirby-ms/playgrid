import { describe, expect, it } from "vitest";
import { TurnManager } from "../game/TurnManager";

describe("TurnManager", () => {
  it("starts with the first player and advances in round-robin order", () => {
    const manager = new TurnManager(["player-1", "player-2", "player-3"]);

    manager.startTurns();

    expect(manager.isActive()).toBe(true);
    expect(manager.getCurrentPlayer()).toBe("player-1");
    expect(manager.getTurnNumber()).toBe(1);
    expect(manager.nextTurn()).toBe("player-2");
    expect(manager.getCurrentPlayer()).toBe("player-2");
    expect(manager.getTurnNumber()).toBe(2);
    expect(manager.nextTurn()).toBe("player-3");
    expect(manager.nextTurn()).toBe("player-1");
    expect(manager.getTurnNumber()).toBe(4);
  });

  it("advances immediately when removing the current player", () => {
    const manager = new TurnManager(["player-1", "player-2", "player-3"]);

    manager.startTurns();
    manager.nextTurn();
    manager.removePlayer("player-2");

    expect(manager.getPlayerCount()).toBe(2);
    expect(manager.getCurrentPlayer()).toBe("player-3");
    expect(manager.getTurnNumber()).toBe(3);
  });

  it("stops when the last remaining player is removed", () => {
    const manager = new TurnManager(["solo"]);

    manager.startTurns();
    manager.removePlayer("solo");

    expect(manager.getPlayerCount()).toBe(0);
    expect(manager.isActive()).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnManager } from "../game/TurnManager";

describe("TurnManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("fires the timeout callback for the active player", () => {
    const onTimeout = vi.fn();
    const manager = new TurnManager(["player-1", "player-2"], {
      turnTimeLimit: 5,
      onTimeout,
    });

    manager.startTurns();
    vi.advanceTimersByTime(5_000);

    expect(onTimeout).toHaveBeenCalledWith("player-1");
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("uses the default 60-second timeout when turnTimeLimit is provided without a value", () => {
    const onTimeout = vi.fn();
    const manager = new TurnManager(["player-1"], {
      turnTimeLimit: undefined,
      onTimeout,
    });

    manager.startTurns();
    vi.advanceTimersByTime(59_000);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(onTimeout).toHaveBeenCalledWith("player-1");
  });

  it("does not start a timer unless turnTimeLimit is configured", () => {
    const onTimeout = vi.fn();
    const manager = new TurnManager(["player-1"], { onTimeout });

    manager.startTurns();
    vi.advanceTimersByTime(120_000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("pauses and resumes the active turn timer", () => {
    const onTimeout = vi.fn();
    const manager = new TurnManager(["player-1", "player-2"], {
      turnTimeLimit: 5,
      onTimeout,
    });

    manager.startTurns();
    vi.advanceTimersByTime(2_000);
    manager.pause();

    expect(manager.isPaused()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();

    manager.resume();
    expect(manager.isPaused()).toBe(false);
    vi.advanceTimersByTime(2_999);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledWith("player-1");
  });

  it("clears the timer when stopped", () => {
    const onTimeout = vi.fn();
    const manager = new TurnManager(["player-1"], {
      turnTimeLimit: 1,
      onTimeout,
    });

    manager.startTurns();
    manager.stop();
    vi.advanceTimersByTime(1_000);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(manager.isActive()).toBe(false);
  });
});

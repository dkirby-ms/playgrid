import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Delayed } from "@colyseus/timer";
import type { TurnTimerConfiguration } from "@eschaton/shared";
import { TurnTimer, type TurnTimerCallbacks } from "../game/TurnTimer.js";

function createMockClock() {
  return {
    setTimeout(callback: (...args: unknown[]) => void, delayMs: number): Delayed {
      const id = setTimeout(callback, delayMs);
      return { clear: () => clearTimeout(id) } as Delayed;
    },
    setInterval(callback: (...args: unknown[]) => void, delayMs: number): Delayed {
      const id = setInterval(callback, delayMs);
      return { clear: () => clearInterval(id) } as Delayed;
    },
  };
}

function createConfig(overrides: Partial<TurnTimerConfiguration> = {}): TurnTimerConfiguration {
  return {
    enabled: true,
    turnDurationMs: 30_000,
    warningThresholdMs: 10_000,
    maxTimeouts: 3,
    finalTimeoutAction: "auto-pass",
    ...overrides,
  };
}

function createCallbacks(): TurnTimerCallbacks & {
  onWarning: ReturnType<typeof vi.fn>;
  onTimeout: ReturnType<typeof vi.fn>;
  onTick: ReturnType<typeof vi.fn>;
} {
  return {
    onWarning: vi.fn(),
    onTimeout: vi.fn(),
    onTick: vi.fn(),
  };
}

describe("TurnTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic lifecycle", () => {
    it("starts with full duration and syncs state", () => {
      const config = createConfig({ turnDurationMs: 60_000 });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");

      expect(callbacks.onTick).toHaveBeenCalledWith(60_000, false);
      expect(timer.isRunning()).toBe(true);
    });

    it("counts down over time", () => {
      const config = createConfig({ turnDurationMs: 30_000, warningThresholdMs: 5_000 });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      callbacks.onTick.mockClear();

      vi.advanceTimersByTime(1_000);

      // Should have ticked ~5 times (200ms intervals over 1s)
      const lastCall = callbacks.onTick.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      expect(lastCall![0]).toBeLessThanOrEqual(29_200);
      expect(lastCall![0]).toBeGreaterThanOrEqual(28_800);
      expect(lastCall![1]).toBe(false); // not in warning zone yet
    });

    it("stops cleanly", () => {
      const config = createConfig();
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      timer.stop();

      expect(timer.isRunning()).toBe(false);
      callbacks.onTick.mockClear();

      vi.advanceTimersByTime(5_000);
      expect(callbacks.onTick).not.toHaveBeenCalled();
    });

    it("resets timer to full duration", () => {
      const config = createConfig({ turnDurationMs: 30_000 });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(10_000);

      callbacks.onTick.mockClear();
      timer.reset();

      expect(callbacks.onTick).toHaveBeenCalledWith(30_000, false);
    });

    it("does nothing on reset when not running", () => {
      const config = createConfig();
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.reset();
      expect(callbacks.onTick).not.toHaveBeenCalled();
    });
  });

  describe("warning threshold", () => {
    it("fires warning when crossing threshold", () => {
      const config = createConfig({
        turnDurationMs: 15_000,
        warningThresholdMs: 10_000,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      expect(callbacks.onWarning).toHaveBeenCalledWith("player-1", 0);
    });

    it("sets warningActive in tick when in warning zone", () => {
      const config = createConfig({
        turnDurationMs: 15_000,
        warningThresholdMs: 10_000,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(6_000);

      const lastCall = callbacks.onTick.mock.calls.at(-1);
      expect(lastCall![1]).toBe(true); // warningActive
    });

    it("fires warning only once per timer cycle", () => {
      const config = createConfig({
        turnDurationMs: 15_000,
        warningThresholdMs: 10_000,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(10_000);

      expect(callbacks.onWarning).toHaveBeenCalledTimes(1);
    });

    it("resets warning state after timer reset", () => {
      const config = createConfig({
        turnDurationMs: 15_000,
        warningThresholdMs: 10_000,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(6_000);
      expect(callbacks.onWarning).toHaveBeenCalledTimes(1);

      timer.reset();
      callbacks.onWarning.mockClear();

      vi.advanceTimersByTime(6_000);
      expect(callbacks.onWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe("timeout escalation", () => {
    it("resets timer on first timeout (non-final)", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 3,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      expect(callbacks.onTimeout).toHaveBeenCalledWith("player-1", 1, false);
      expect(timer.isRunning()).toBe(true);
      expect(timer.getTimeoutCount("player-1")).toBe(1);
    });

    it("resets timer on second timeout (non-final)", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 3,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_200);
      vi.advanceTimersByTime(5_200);

      expect(callbacks.onTimeout).toHaveBeenCalledTimes(2);
      expect(callbacks.onTimeout).toHaveBeenCalledWith("player-1", 2, false);
      expect(timer.isRunning()).toBe(true);
    });

    it("stops on final timeout", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 3,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_200);
      vi.advanceTimersByTime(5_200);
      vi.advanceTimersByTime(5_200);

      expect(callbacks.onTimeout).toHaveBeenCalledTimes(3);
      expect(callbacks.onTimeout).toHaveBeenLastCalledWith("player-1", 3, true);
      expect(timer.isRunning()).toBe(false);
    });

    it("tracks timeout counts per player independently", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 3,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      // Player 1 times out once
      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      // Switch to player 2
      timer.start("player-2");
      vi.advanceTimersByTime(5_200);

      expect(timer.getTimeoutCount("player-1")).toBe(1);
      expect(timer.getTimeoutCount("player-2")).toBe(1);
    });

    it("accumulates timeouts across turns for the same player", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 3,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      // Player 1 times out once on their turn
      timer.start("player-1");
      vi.advanceTimersByTime(5_200);
      expect(timer.getTimeoutCount("player-1")).toBe(1);

      // Player 2 takes their turn (no timeout)
      timer.start("player-2");
      vi.advanceTimersByTime(2_000);

      // Back to player 1, they time out again
      timer.start("player-1");
      vi.advanceTimersByTime(5_200);
      expect(timer.getTimeoutCount("player-1")).toBe(2);
    });

    it("triggers final timeout on third timeout for accumulated player", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 3,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      // P1 timeout #1
      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      // P2 turn (no timeout)
      timer.start("player-2");
      vi.advanceTimersByTime(2_000);

      // P1 timeout #2
      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      // P2 turn again
      timer.start("player-2");
      vi.advanceTimersByTime(2_000);

      // P1 timeout #3 (final)
      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      expect(callbacks.onTimeout).toHaveBeenLastCalledWith("player-1", 3, true);
      expect(timer.isRunning()).toBe(false);
    });

    it("works with maxTimeouts of 1 (immediate final)", () => {
      const config = createConfig({
        turnDurationMs: 5_000,
        warningThresholdMs: 1_000,
        maxTimeouts: 1,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_200);

      expect(callbacks.onTimeout).toHaveBeenCalledWith("player-1", 1, true);
      expect(timer.isRunning()).toBe(false);
    });
  });

  describe("pause and resume", () => {
    it("pauses countdown", () => {
      const config = createConfig({ turnDurationMs: 30_000 });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_000);

      const lastRemainingBeforePause = callbacks.onTick.mock.calls.at(-1)![0] as number;

      timer.pause();
      callbacks.onTick.mockClear();

      vi.advanceTimersByTime(10_000);

      // Ticks still fire (interval runs) but remaining doesn't change
      for (const call of callbacks.onTick.mock.calls) {
        expect(call[0]).toBe(lastRemainingBeforePause);
      }
    });

    it("resumes from paused state", () => {
      const config = createConfig({
        turnDurationMs: 30_000,
        warningThresholdMs: 5_000,
      });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(10_000);
      timer.pause();
      vi.advanceTimersByTime(60_000); // long pause

      timer.resume();
      callbacks.onTick.mockClear();

      vi.advanceTimersByTime(1_000);

      // Should resume counting down from where it paused
      const lastCall = callbacks.onTick.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      expect(lastCall![0]).toBeLessThan(20_200);
      expect(lastCall![0]).toBeGreaterThan(18_000);
    });

    it("ignores pause when not running", () => {
      const config = createConfig();
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.pause(); // no-op
      expect(timer.isRunning()).toBe(false);
    });

    it("ignores resume when not paused", () => {
      const config = createConfig();
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      timer.resume(); // no-op, already running
      expect(timer.isRunning()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("stops the timer and clears timeout counts", () => {
      const config = createConfig({ turnDurationMs: 5_000 });
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);
      timer.setClock(createMockClock());

      timer.start("player-1");
      vi.advanceTimersByTime(5_200);
      expect(timer.getTimeoutCount("player-1")).toBe(1);

      timer.dispose();

      expect(timer.isRunning()).toBe(false);
      expect(timer.getTimeoutCount("player-1")).toBe(0);
    });
  });

  describe("no clock", () => {
    it("does not start interval without a clock", () => {
      const config = createConfig();
      const callbacks = createCallbacks();
      const timer = new TurnTimer(config, callbacks);

      timer.start("player-1");

      // Initial onTick is called, but no interval ticks
      expect(callbacks.onTick).toHaveBeenCalledTimes(1);
      expect(timer.isRunning()).toBe(true);

      vi.advanceTimersByTime(5_000);
      expect(callbacks.onTick).toHaveBeenCalledTimes(1);
    });
  });
});

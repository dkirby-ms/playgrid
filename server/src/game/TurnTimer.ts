import type { Delayed } from "@colyseus/timer";
import type { TurnTimerConfiguration } from "@eschaton/shared";

export interface TurnTimerCallbacks {
  /** Called when the warning threshold is crossed */
  onWarning(sessionId: string, timeoutCount: number): void;
  /** Called when the turn timer expires */
  onTimeout(sessionId: string, timeoutCount: number, isFinal: boolean): void;
  /** Update synced state: remaining time and warning flag */
  onTick(remainingMs: number, warningActive: boolean): void;
}

interface ClockLike {
  setInterval(callback: (...args: unknown[]) => void, delayMs: number): Delayed;
}

const TICK_INTERVAL_MS = 200;

/**
 * Reusable per-turn countdown timer with escalating penalties.
 *
 * Designed to plug into any turn-based game via BaseGameRoom.
 * Uses the Colyseus clock (no setTimeout/setInterval) and syncs
 * remaining time to shared state so clients can render a countdown.
 *
 * Escalation:
 *   timeouts 1..(maxTimeouts-1) → warning + timer reset
 *   timeout at maxTimeouts       → final action (auto-pass or forfeit)
 */
export class TurnTimer {
  private readonly config: TurnTimerConfiguration;
  private readonly callbacks: TurnTimerCallbacks;

  private remainingMs = 0;
  private running = false;
  private paused = false;
  private warningFired = false;
  private currentSessionId = "";
  private tickInterval?: Delayed;
  private clock?: ClockLike;

  /** Tracks cumulative timeout count per player across the game */
  private readonly timeoutCounts = new Map<string, number>();

  constructor(config: TurnTimerConfiguration, callbacks: TurnTimerCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  /** Attach a Colyseus clock. Must be called before start(). */
  setClock(clock: ClockLike): void {
    this.clock = clock;
  }

  /** Start (or restart) the timer for the given player's turn. */
  start(sessionId: string): void {
    this.stop();
    this.currentSessionId = sessionId;
    this.remainingMs = this.config.turnDurationMs;
    this.warningFired = false;
    this.running = true;
    this.paused = false;

    this.callbacks.onTick(this.remainingMs, false);
    this.startTickInterval();
  }

  /** Reset the timer (e.g. after a valid action during the same turn). */
  reset(): void {
    if (!this.running) {
      return;
    }

    this.remainingMs = this.config.turnDurationMs;
    this.warningFired = false;
    this.paused = false;

    this.callbacks.onTick(this.remainingMs, false);
  }

  /** Pause the countdown (e.g. player disconnected). */
  pause(): void {
    if (!this.running || this.paused) {
      return;
    }

    this.paused = true;
  }

  /** Resume after a pause (e.g. player reconnected). */
  resume(): void {
    if (!this.running || !this.paused) {
      return;
    }

    this.paused = false;
  }

  /** Fully stop the timer and clear intervals. */
  stop(): void {
    this.running = false;
    this.paused = false;
    this.tickInterval?.clear();
    this.tickInterval = undefined;
  }

  /** Get the timeout count for a specific player. */
  getTimeoutCount(sessionId: string): number {
    return this.timeoutCounts.get(sessionId) ?? 0;
  }

  /** Check whether the timer is actively running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Dispose of all resources. */
  dispose(): void {
    this.stop();
    this.timeoutCounts.clear();
  }

  private startTickInterval(): void {
    this.tickInterval?.clear();

    if (!this.clock) {
      return;
    }

    this.tickInterval = this.clock.setInterval(() => {
      this.tick(TICK_INTERVAL_MS);
    }, TICK_INTERVAL_MS);
  }

  private tick(deltaMs: number): void {
    if (!this.running || this.paused) {
      return;
    }

    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);

    const warningActive = this.remainingMs <= this.config.warningThresholdMs
      && this.remainingMs > 0;

    if (warningActive && !this.warningFired) {
      this.warningFired = true;
      this.callbacks.onWarning(
        this.currentSessionId,
        this.getTimeoutCount(this.currentSessionId),
      );
    }

    this.callbacks.onTick(this.remainingMs, warningActive);

    if (this.remainingMs <= 0) {
      this.handleTimeout();
    }
  }

  private handleTimeout(): void {
    const sessionId = this.currentSessionId;
    const count = (this.timeoutCounts.get(sessionId) ?? 0) + 1;
    this.timeoutCounts.set(sessionId, count);

    const isFinal = count >= this.config.maxTimeouts;

    if (!isFinal) {
      // Not final: reset timer for another chance
      this.remainingMs = this.config.turnDurationMs;
      this.warningFired = false;
      this.callbacks.onTick(this.remainingMs, false);
    } else {
      this.stop();
    }

    this.callbacks.onTimeout(sessionId, count, isFinal);
  }
}

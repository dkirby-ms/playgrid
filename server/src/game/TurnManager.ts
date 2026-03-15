export interface TurnManagerOptions {
  turnTimeLimit?: number;
  onTimeout?: (sessionId: string) => void;
}

const DEFAULT_TURN_TIME_LIMIT_SECONDS = 60;

export class TurnManager {
  private readonly playerIds: string[];
  private readonly onTimeout?: (sessionId: string) => void;
  private readonly turnTimeLimitMs?: number;

  private currentIndex = -1;
  private turnNumber = 0;
  private active = false;
  private paused = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private timerStartedAt: number | null = null;
  private remainingTurnTimeMs?: number;

  constructor(playerIds: string[], options: TurnManagerOptions = {}) {
    this.playerIds = [...playerIds];
    this.onTimeout = options.onTimeout;

    if (Object.hasOwn(options, "turnTimeLimit")) {
      const turnTimeLimit =
        typeof options.turnTimeLimit === "number"
        && Number.isFinite(options.turnTimeLimit)
        && options.turnTimeLimit > 0
          ? options.turnTimeLimit
          : DEFAULT_TURN_TIME_LIMIT_SECONDS;

      this.turnTimeLimitMs = turnTimeLimit * 1000;
    }
  }

  startTurns(): void {
    if (this.playerIds.length === 0) {
      throw new Error("Cannot start turns without players.");
    }

    this.stopTimer();
    this.active = true;
    this.paused = false;
    this.currentIndex = 0;
    this.turnNumber = 1;
    this.remainingTurnTimeMs = this.turnTimeLimitMs;
    this.startTimer();
  }

  nextTurn(): string {
    if (!this.active || this.currentIndex === -1 || this.playerIds.length === 0) {
      throw new Error("Turns are not active.");
    }

    this.paused = false;
    this.currentIndex = (this.currentIndex + 1) % this.playerIds.length;
    this.turnNumber += 1;
    this.remainingTurnTimeMs = this.turnTimeLimitMs;
    this.startTimer();
    return this.playerIds[this.currentIndex];
  }

  getCurrentPlayer(): string {
    if (!this.active || this.currentIndex === -1 || this.playerIds.length === 0) {
      throw new Error("Turns are not active.");
    }

    return this.playerIds[this.currentIndex];
  }

  removePlayer(sessionId: string): void {
    const removedIndex = this.playerIds.indexOf(sessionId);
    if (removedIndex === -1) {
      return;
    }

    const wasCurrentPlayer = this.active && removedIndex === this.currentIndex;
    this.playerIds.splice(removedIndex, 1);

    if (this.playerIds.length === 0) {
      this.stop();
      return;
    }

    if (!this.active) {
      if (removedIndex < this.currentIndex) {
        this.currentIndex -= 1;
      }
      return;
    }

    if (wasCurrentPlayer) {
      this.paused = false;
      this.currentIndex %= this.playerIds.length;
      this.turnNumber += 1;
      this.remainingTurnTimeMs = this.turnTimeLimitMs;
      this.startTimer();
      return;
    }

    if (removedIndex < this.currentIndex) {
      this.currentIndex -= 1;
    }
  }

  getPlayerCount(): number {
    return this.playerIds.length;
  }

  getTurnNumber(): number {
    return this.turnNumber;
  }

  isActive(): boolean {
    return this.active;
  }

  isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    if (
      !this.active
      || this.paused
      || this.turnTimeLimitMs === undefined
      || this.currentIndex === -1
    ) {
      return;
    }

    if (this.remainingTurnTimeMs === undefined) {
      this.remainingTurnTimeMs = this.turnTimeLimitMs;
    }

    if (this.timerStartedAt !== null) {
      const elapsedMs = Date.now() - this.timerStartedAt;
      this.remainingTurnTimeMs = Math.max(0, this.remainingTurnTimeMs - elapsedMs);
    }

    this.paused = true;
    this.stopTimer();
  }

  resume(): void {
    if (
      !this.active
      || !this.paused
      || this.turnTimeLimitMs === undefined
      || this.currentIndex === -1
    ) {
      return;
    }

    this.paused = false;
    this.startTimer(this.remainingTurnTimeMs ?? this.turnTimeLimitMs);
  }

  stop(): void {
    this.active = false;
    this.paused = false;
    this.currentIndex = -1;
    this.remainingTurnTimeMs = this.turnTimeLimitMs;
    this.stopTimer();
  }

  private startTimer(delayMs = this.turnTimeLimitMs): void {
    this.stopTimer();

    if (
      !this.active
      || this.paused
      || delayMs === undefined
      || this.currentIndex === -1
    ) {
      return;
    }

    const sessionId = this.playerIds[this.currentIndex];
    this.remainingTurnTimeMs = delayMs;
    this.timerStartedAt = Date.now();
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.timerStartedAt = null;
      this.remainingTurnTimeMs = this.turnTimeLimitMs;
      this.onTimeout?.(sessionId);
    }, delayMs);
  }

  private stopTimer(): void {
    if (!this.timeoutId) {
      this.timerStartedAt = null;
      return;
    }

    clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.timerStartedAt = null;
  }
}

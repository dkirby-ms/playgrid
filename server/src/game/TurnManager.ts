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
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

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
    this.currentIndex = 0;
    this.turnNumber = 1;
    this.startTimer();
  }

  nextTurn(): string {
    if (!this.active || this.currentIndex === -1 || this.playerIds.length === 0) {
      throw new Error("Turns are not active.");
    }

    this.currentIndex = (this.currentIndex + 1) % this.playerIds.length;
    this.turnNumber += 1;
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
      this.currentIndex %= this.playerIds.length;
      this.turnNumber += 1;
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

  stop(): void {
    this.active = false;
    this.currentIndex = -1;
    this.stopTimer();
  }

  private startTimer(): void {
    this.stopTimer();

    if (!this.active || this.turnTimeLimitMs === undefined || this.currentIndex === -1) {
      return;
    }

    const sessionId = this.playerIds[this.currentIndex];
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.onTimeout?.(sessionId);
    }, this.turnTimeLimitMs);
  }

  private stopTimer(): void {
    if (!this.timeoutId) {
      return;
    }

    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }
}

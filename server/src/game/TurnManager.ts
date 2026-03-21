export class TurnManager {
  private readonly playerIds: string[];

  private currentIndex = -1;
  private turnNumber = 0;
  private active = false;

  constructor(playerIds: string[]) {
    this.playerIds = [...playerIds];
  }

  startTurns(): void {
    if (this.playerIds.length === 0) {
      throw new Error("Cannot start turns without players.");
    }

    this.active = true;
    this.currentIndex = 0;
    this.turnNumber = 1;
  }

  nextTurn(): string {
    if (!this.active || this.currentIndex === -1 || this.playerIds.length === 0) {
      throw new Error("Turns are not active.");
    }

    this.currentIndex = (this.currentIndex + 1) % this.playerIds.length;
    this.turnNumber += 1;
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
  }
}

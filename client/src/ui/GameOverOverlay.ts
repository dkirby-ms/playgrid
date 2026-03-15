import type { GameResult } from "@eschaton/shared";

const OVERLAY_AUTO_DISMISS_MS = 5000;
const CONTAINER_ID = "game-over-overlay";
const RESULT_DISPLAY_ID = "game-over-result";
const MESSAGE_DISPLAY_ID = "game-over-message";
const BUTTON_ID = "game-over-return-button";

export class GameOverOverlay {
  private container: HTMLElement | null = null;
  private resultDisplay: HTMLElement | null = null;
  private messageDisplay: HTMLElement | null = null;
  private returnButton: HTMLButtonElement | null = null;
  private autoDismissTimeoutId: number | null = null;
  private onReturnCallback: (() => void) | null = null;

  show(result: GameResult, sessionId: string, onReturn: () => void): void {
    this.onReturnCallback = onReturn;
    this.createOverlay();

    if (!this.resultDisplay || !this.messageDisplay) {
      return;
    }

    const { resultText, messageText } = this.formatResult(result, sessionId);
    this.resultDisplay.textContent = resultText;
    this.messageDisplay.textContent = messageText;

    this.scheduleAutoDismiss();
  }

  hide(): void {
    this.clearAutoDismissTimeout();
    
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    this.resultDisplay = null;
    this.messageDisplay = null;
    this.returnButton = null;
    this.onReturnCallback = null;
  }

  private createOverlay(): void {
    if (this.container) {
      return;
    }

    this.container = document.createElement("div");
    this.container.id = CONTAINER_ID;
    this.container.className = "game-over-overlay";

    const content = document.createElement("div");
    content.className = "game-over-content";

    this.resultDisplay = document.createElement("div");
    this.resultDisplay.id = RESULT_DISPLAY_ID;
    this.resultDisplay.className = "game-over-result";

    this.messageDisplay = document.createElement("div");
    this.messageDisplay.id = MESSAGE_DISPLAY_ID;
    this.messageDisplay.className = "game-over-message";

    this.returnButton = document.createElement("button");
    this.returnButton.id = BUTTON_ID;
    this.returnButton.className = "game-over-button";
    this.returnButton.textContent = "Return to Lobby";
    this.returnButton.addEventListener("click", () => {
      this.handleReturn();
    });

    content.appendChild(this.resultDisplay);
    content.appendChild(this.messageDisplay);
    content.appendChild(this.returnButton);
    this.container.appendChild(content);

    document.body.appendChild(this.container);
  }

  private formatResult(result: GameResult, sessionId: string): { resultText: string; messageText: string } {
    switch (result.type) {
      case "win": {
        const isWinner = result.winnerId === sessionId;
        const resultText = isWinner ? "Victory!" : "Defeat";
        
        let messageText: string;
        if (isWinner) {
          messageText = "You won the game!";
        } else {
          const winnerName = this.getPlayerName(result, result.winnerId);
          messageText = winnerName ? `${winnerName} won the game.` : "You lost the game.";
        }
        return { resultText, messageText };
      }

      case "draw": {
        return {
          resultText: "Draw",
          messageText: "The game ended in a draw.",
        };
      }

      case "forfeit": {
        const isWinner = result.winnerId === sessionId;
        const resultText = isWinner ? "Victory!" : "Forfeit";
        const messageText = isWinner ? "You won by forfeit." : "Game ended by forfeit.";
        return { resultText, messageText };
      }

      case "timeout": {
        const isWinner = result.winnerId === sessionId;
        const resultText = isWinner ? "Victory!" : "Timeout";
        const messageText = isWinner ? "You won due to opponent timeout." : "Game ended due to timeout.";
        return { resultText, messageText };
      }

      default: {
        return {
          resultText: "Game Over",
          messageText: "The game has ended.",
        };
      }
    }
  }

  private getPlayerName(result: GameResult, playerId?: string): string | null {
    if (!playerId || !result.metadata) {
      return null;
    }

    const metadata = result.metadata as Record<string, unknown>;
    if (typeof metadata.winnerName === "string") {
      return metadata.winnerName;
    }

    return null;
  }

  private scheduleAutoDismiss(): void {
    this.clearAutoDismissTimeout();

    this.autoDismissTimeoutId = window.setTimeout(() => {
      this.handleReturn();
    }, OVERLAY_AUTO_DISMISS_MS);
  }

  private clearAutoDismissTimeout(): void {
    if (this.autoDismissTimeoutId !== null) {
      window.clearTimeout(this.autoDismissTimeoutId);
      this.autoDismissTimeoutId = null;
    }
  }

  private handleReturn(): void {
    this.clearAutoDismissTimeout();
    
    if (this.onReturnCallback) {
      this.onReturnCallback();
    }
  }
}

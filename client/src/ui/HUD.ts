import type { Room } from "@colyseus/sdk";

export interface HUDPlayer {
  userId: string;
  displayName: string;
  score: number;
  isCurrent: boolean;
}

export interface HUDOptions {
  players: HUDPlayer[];
  currentTurn?: string;
  gameTimer?: number;
  showTimer?: boolean;
}

export type HUDEvent = { type: "leave" } | { type: "chat_toggle" };
type HUDEventCallback = (event: HUDEvent) => void;

export class HUD {
  private readonly container: HTMLElement;
  private readonly playerInfoPanel: HTMLElement;
  private readonly turnIndicator: HTMLElement;
  private readonly timerDisplay: HTMLElement;
  private readonly leaveButton: HTMLButtonElement;
  private readonly chatToggle: HTMLButtonElement;
  private readonly chatPlaceholder: HTMLElement;

  private room: Room | null = null;
  private eventCallback: HUDEventCallback | null = null;
  private players: HUDPlayer[] = [];
  private currentTurn: string | null = null;
  private gameTimer: number | null = null;
  private showTimer = false;
  private timerIntervalId: number | null = null;
  private isChatOpen = false;

  constructor() {
    this.container = this.createContainer();
    this.playerInfoPanel = this.createPlayerInfoPanel();
    this.turnIndicator = this.createTurnIndicator();
    this.timerDisplay = this.createTimerDisplay();
    this.leaveButton = this.createLeaveButton();
    this.chatToggle = this.createChatToggle();
    this.chatPlaceholder = this.createChatPlaceholder();

    this.container.append(
      this.playerInfoPanel,
      this.turnIndicator,
      this.timerDisplay,
      this.leaveButton,
      this.chatToggle,
      this.chatPlaceholder,
    );

    document.body.appendChild(this.container);
  }

  onEvent(callback: HUDEventCallback): void {
    this.eventCallback = callback;
  }

  show(room: Room, options: HUDOptions): void {
    this.room = room;
    this.players = options.players;
    this.currentTurn = options.currentTurn ?? null;
    this.gameTimer = options.gameTimer ?? null;
    this.showTimer = options.showTimer ?? false;

    this.render();
    this.container.style.display = "block";

    if (this.showTimer && this.gameTimer !== null) {
      this.startTimer();
    }
  }

  hide(): void {
    this.container.style.display = "none";
    this.stopTimer();
    this.room = null;
    this.players = [];
    this.currentTurn = null;
    this.gameTimer = null;
    this.showTimer = false;
    this.isChatOpen = false;
    this.chatPlaceholder.style.display = "none";
  }

  update(options: Partial<HUDOptions>): void {
    if (options.players !== undefined) {
      this.players = options.players;
    }
    if (options.currentTurn !== undefined) {
      this.currentTurn = options.currentTurn;
    }
    if (options.gameTimer !== undefined) {
      this.gameTimer = options.gameTimer;
    }
    if (options.showTimer !== undefined) {
      this.showTimer = options.showTimer;
      if (this.showTimer && this.gameTimer !== null) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }

    this.render();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.id = "hud-overlay";
    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      pointerEvents: "none",
      zIndex: "15",
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#f4f6fb",
    });
    return container;
  }

  private createPlayerInfoPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "hud-player-info-panel";
    Object.assign(panel.style, {
      position: "absolute",
      top: "16px",
      left: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      padding: "14px 16px",
      background: "rgba(16, 16, 29, 0.92)",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      borderRadius: "14px",
      minWidth: "200px",
      maxWidth: "280px",
      pointerEvents: "auto",
    });
    return panel;
  }

  private createTurnIndicator(): HTMLElement {
    const indicator = document.createElement("div");
    indicator.className = "hud-turn-indicator";
    Object.assign(indicator.style, {
      position: "absolute",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 20px",
      background: "rgba(16, 16, 29, 0.92)",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      borderRadius: "999px",
      fontSize: "0.95rem",
      fontWeight: "600",
      textAlign: "center",
      whiteSpace: "nowrap",
      pointerEvents: "auto",
    });
    return indicator;
  }

  private createTimerDisplay(): HTMLElement {
    const timer = document.createElement("div");
    timer.className = "hud-timer-display";
    Object.assign(timer.style, {
      position: "absolute",
      top: "64px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "8px 16px",
      background: "rgba(16, 16, 29, 0.92)",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      borderRadius: "12px",
      fontSize: "0.88rem",
      fontWeight: "500",
      textAlign: "center",
      display: "none",
      pointerEvents: "auto",
    });
    return timer;
  }

  private createLeaveButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Leave Game";
    button.className = "lobby-button lobby-button-ghost";
    Object.assign(button.style, {
      position: "absolute",
      top: "16px",
      right: "16px",
      minHeight: "44px",
      padding: "0 16px",
      borderRadius: "12px",
      border: "1px solid rgba(126, 207, 255, 0.16)",
      background: "rgba(16, 16, 29, 0.92)",
      color: "#d3d8e4",
      fontSize: "inherit",
      fontWeight: "600",
      cursor: "pointer",
      transition: "transform 0.12s ease, border-color 0.12s ease",
      pointerEvents: "auto",
    });

    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-1px)";
      button.style.borderColor = "rgba(126, 207, 255, 0.42)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "";
      button.style.borderColor = "rgba(126, 207, 255, 0.16)";
    });

    button.addEventListener("click", () => {
      this.eventCallback?.({ type: "leave" });
    });

    return button;
  }

  private createChatToggle(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "💬";
    button.title = "Chat";
    button.className = "hud-chat-toggle";
    Object.assign(button.style, {
      position: "absolute",
      bottom: "16px",
      right: "16px",
      width: "52px",
      height: "52px",
      borderRadius: "50%",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      background: "rgba(16, 16, 29, 0.92)",
      fontSize: "1.5rem",
      cursor: "pointer",
      transition: "transform 0.12s ease, background 0.12s ease",
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.08)";
      button.style.background = "rgba(126, 207, 255, 0.18)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "";
      button.style.background = "rgba(16, 16, 29, 0.92)";
    });

    button.addEventListener("click", () => {
      this.toggleChat();
    });

    return button;
  }

  private createChatPlaceholder(): HTMLElement {
    const placeholder = document.createElement("div");
    placeholder.className = "hud-chat-placeholder";
    Object.assign(placeholder.style, {
      position: "absolute",
      bottom: "80px",
      right: "16px",
      width: "320px",
      maxHeight: "400px",
      padding: "20px",
      background: "rgba(16, 16, 29, 0.96)",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      borderRadius: "14px",
      display: "none",
      pointerEvents: "auto",
      textAlign: "center",
      color: "#9aa3b2",
    });
    placeholder.textContent = "Chat coming soon! 🚧";
    return placeholder;
  }

  private render(): void {
    this.renderPlayerInfo();
    this.renderTurnIndicator();
    this.renderTimer();
  }

  private renderPlayerInfo(): void {
    this.playerInfoPanel.textContent = "";

    const title = document.createElement("div");
    Object.assign(title.style, {
      fontSize: "0.82rem",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#7ecfff",
      marginBottom: "6px",
    });
    title.textContent = "Players";
    this.playerInfoPanel.appendChild(title);

    for (const player of this.players) {
      const playerEl = document.createElement("div");
      Object.assign(playerEl.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 10px",
        background: player.isCurrent ? "rgba(126, 207, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
        border: player.isCurrent ? "1px solid rgba(126, 207, 255, 0.32)" : "1px solid transparent",
        borderRadius: "10px",
      });

      const nameEl = document.createElement("span");
      Object.assign(nameEl.style, {
        fontWeight: player.isCurrent ? "600" : "400",
        color: player.isCurrent ? "#d9f3ff" : "#dce2ee",
      });
      nameEl.textContent = player.displayName;

      const scoreEl = document.createElement("span");
      Object.assign(scoreEl.style, {
        fontSize: "0.88rem",
        color: "#9aa3b2",
      });
      scoreEl.textContent = `${player.score}`;

      playerEl.append(nameEl, scoreEl);
      this.playerInfoPanel.appendChild(playerEl);
    }
  }

  private renderTurnIndicator(): void {
    if (!this.currentTurn) {
      this.turnIndicator.textContent = "Game in progress";
      this.turnIndicator.style.color = "#9aa3b2";
      return;
    }

    const currentPlayer = this.players.find((p) => p.userId === this.currentTurn);
    if (currentPlayer) {
      const isLocalPlayer = this.room?.sessionId === this.currentTurn;
      this.turnIndicator.textContent = isLocalPlayer
        ? "Your turn"
        : `${currentPlayer.displayName}'s turn`;
      this.turnIndicator.style.color = isLocalPlayer ? "#8ff0b0" : "#8fc6ff";
    } else {
      this.turnIndicator.textContent = "Waiting...";
      this.turnIndicator.style.color = "#9aa3b2";
    }
  }

  private renderTimer(): void {
    if (!this.showTimer || this.gameTimer === null) {
      this.timerDisplay.style.display = "none";
      return;
    }

    this.timerDisplay.style.display = "block";
    const minutes = Math.floor(this.gameTimer / 60);
    const seconds = this.gameTimer % 60;
    this.timerDisplay.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, "0")}`;

    if (this.gameTimer < 30) {
      this.timerDisplay.style.color = "#ff6b6b";
      this.timerDisplay.style.borderColor = "rgba(255, 107, 107, 0.32)";
    } else {
      this.timerDisplay.style.color = "#f4f6fb";
      this.timerDisplay.style.borderColor = "rgba(126, 207, 255, 0.22)";
    }
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerIntervalId = window.setInterval(() => {
      if (this.gameTimer !== null && this.gameTimer > 0) {
        this.gameTimer--;
        this.renderTimer();
      } else {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    this.chatPlaceholder.style.display = this.isChatOpen ? "block" : "none";

    if (this.isChatOpen) {
      this.chatToggle.style.background = "rgba(126, 207, 255, 0.22)";
      this.eventCallback?.({ type: "chat_toggle" });
    } else {
      this.chatToggle.style.background = "rgba(16, 16, 29, 0.92)";
    }
  }

  destroy(): void {
    this.hide();
    this.container.remove();
  }
}

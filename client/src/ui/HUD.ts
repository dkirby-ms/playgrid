import type { Room } from "@colyseus/sdk";
import type { GameRendererHUDStatus } from "../renderers/GameRenderer";

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
  status?: GameRendererHUDStatus;
}

export type HUDEvent = { type: "leave" } | { type: "chat_toggle" };
type HUDEventCallback = (event: HUDEvent) => void;

export class HUD {
  private readonly container: HTMLElement;
  private readonly statusPanel: HTMLElement;
  private readonly statusEyebrow: HTMLElement;
  private readonly statusHeadline: HTMLElement;
  private readonly statusDetail: HTMLElement;
  private readonly timerDisplay: HTMLElement;
  private readonly playerList: HTMLElement;
  private readonly leaveButton: HTMLButtonElement;
  private readonly chatToggle: HTMLButtonElement;
  private readonly chatPlaceholder: HTMLElement;

  private room: Room | null = null;
  private eventCallback: HUDEventCallback | null = null;
  private players: HUDPlayer[] = [];
  private currentTurn: string | null = null;
  private gameTimer: number | null = null;
  private showTimer = false;
  private status: GameRendererHUDStatus | null = null;
  private timerIntervalId: number | null = null;
  private isChatOpen = false;

  constructor() {
    this.container = this.createContainer();
    this.statusPanel = this.createStatusPanel();
    this.statusEyebrow = this.createPanelEyebrow();
    this.statusHeadline = this.createStatusHeadline();
    this.statusDetail = this.createStatusDetail();
    this.timerDisplay = this.createTimerDisplay();
    this.playerList = this.createPlayerList();
    this.leaveButton = this.createLeaveButton();
    this.chatToggle = this.createChatToggle();
    this.chatPlaceholder = this.createChatPlaceholder();

    this.composeStatusPanel();

    this.container.append(
      this.statusPanel,
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
    this.status = options.status ?? null;

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
    this.status = null;
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
    if (options.status !== undefined) {
      this.status = options.status ?? null;
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

  private createStatusPanel(): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "hud-status-panel";
    Object.assign(panel.style, {
      position: "absolute",
      top: "16px",
      right: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "min(300px, calc(100vw - 152px))",
      padding: "12px 14px",
      background: "rgba(16, 16, 29, 0.92)",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      borderRadius: "16px",
      boxShadow: "0 18px 36px rgba(0, 0, 0, 0.28)",
      backdropFilter: "blur(10px)",
      pointerEvents: "auto",
    });
    return panel;
  }

  private createPanelEyebrow(): HTMLElement {
    const eyebrow = document.createElement("div");
    Object.assign(eyebrow.style, {
      fontSize: "0.72rem",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#7ecfff",
      fontWeight: "600",
    });
    return eyebrow;
  }

  private createStatusHeadline(): HTMLElement {
    const headline = document.createElement("div");
    Object.assign(headline.style, {
      fontSize: "1rem",
      fontWeight: "700",
      lineHeight: "1.2",
      color: "#f4f6fb",
    });
    return headline;
  }

  private createStatusDetail(): HTMLElement {
    const detail = document.createElement("div");
    Object.assign(detail.style, {
      fontSize: "0.8rem",
      lineHeight: "1.3",
      color: "#9aa3b2",
    });
    return detail;
  }

  private createTimerDisplay(): HTMLElement {
    const timer = document.createElement("div");
    timer.className = "hud-timer-display";
    Object.assign(timer.style, {
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      padding: "5px 10px",
      borderRadius: "999px",
      background: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(126, 207, 255, 0.22)",
      fontSize: "0.8rem",
      fontWeight: "600",
      whiteSpace: "nowrap",
      color: "#f4f6fb",
    });
    return timer;
  }

  private createPlayerList(): HTMLElement {
    const list = document.createElement("div");
    Object.assign(list.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      minWidth: "132px",
      flex: "1 1 132px",
    });
    return list;
  }

  private composeStatusPanel(): void {
    const headerRow = document.createElement("div");
    Object.assign(headerRow.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    });

    const contentRow = document.createElement("div");
    Object.assign(contentRow.style, {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "14px",
      flexWrap: "wrap",
    });

    const statusCopy = document.createElement("div");
    Object.assign(statusCopy.style, {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: "0",
      flex: "1 1 150px",
    });

    const playersSection = document.createElement("div");
    Object.assign(playersSection.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      flex: "1 1 132px",
      minWidth: "132px",
    });

    const playersTitle = document.createElement("div");
    Object.assign(playersTitle.style, {
      fontSize: "0.72rem",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#9aa3b2",
      fontWeight: "600",
    });
    playersTitle.textContent = "Players";

    headerRow.append(this.statusEyebrow, this.timerDisplay);
    statusCopy.append(this.statusHeadline, this.statusDetail);
    playersSection.append(playersTitle, this.playerList);
    contentRow.append(statusCopy, playersSection);
    this.statusPanel.append(headerRow, contentRow);
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
    this.renderStatusSummary();
    this.renderPlayerInfo();
    this.renderTimer();
  }

  private renderStatusSummary(): void {
    const status = this.status ?? this.getFallbackStatus();

    this.statusEyebrow.textContent = status.label ?? "Game status";
    this.statusHeadline.textContent = status.text;
    this.statusHeadline.style.color = status.accentColor ?? "#f4f6fb";

    const detail = status.detail?.trim() ?? "";
    this.statusDetail.textContent = detail;
    this.statusDetail.style.display = detail.length > 0 ? "block" : "none";
  }

  private renderPlayerInfo(): void {
    this.playerList.textContent = "";

    if (this.players.length === 0) {
      const emptyState = document.createElement("div");
      Object.assign(emptyState.style, {
        fontSize: "0.82rem",
        color: "#9aa3b2",
      });
      emptyState.textContent = "Waiting for players";
      this.playerList.appendChild(emptyState);
      return;
    }

    const hasScores = this.players.some((player) => player.score !== 0);

    for (const player of this.players) {
      const playerEl = document.createElement("div");
      Object.assign(playerEl.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        background: player.isCurrent ? "rgba(126, 207, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
        border: player.isCurrent ? "1px solid rgba(126, 207, 255, 0.28)" : "1px solid transparent",
        borderRadius: "10px",
      });

      const nameEl = document.createElement("span");
      Object.assign(nameEl.style, {
        fontWeight: player.isCurrent ? "600" : "500",
        color: player.isCurrent ? "#d9f3ff" : "#dce2ee",
        fontSize: "0.88rem",
        minWidth: "0",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      });
      nameEl.textContent = player.displayName;

      const metaEl = document.createElement("div");
      Object.assign(metaEl.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "6px",
        flexWrap: "wrap",
      });

      if (player.userId === this.room?.sessionId) {
        metaEl.appendChild(this.createPlayerTag("You", "rgba(143, 198, 255, 0.18)", "#d9f3ff"));
      }

      if (player.isCurrent) {
        metaEl.appendChild(this.createPlayerTag("Turn", "rgba(143, 240, 176, 0.18)", "#8ff0b0"));
      }

      if (hasScores) {
        metaEl.appendChild(this.createPlayerTag(String(player.score), "rgba(255, 255, 255, 0.06)", "#dce2ee"));
      }

      playerEl.append(nameEl, metaEl);
      this.playerList.appendChild(playerEl);
    }
  }

  private renderTimer(): void {
    if (!this.showTimer || this.gameTimer === null) {
      this.timerDisplay.style.display = "none";
      return;
    }

    this.timerDisplay.style.display = "inline-flex";
    const minutes = Math.floor(this.gameTimer / 60);
    const seconds = this.gameTimer % 60;
    this.timerDisplay.textContent = `Turn clock ${minutes}:${seconds.toString().padStart(2, "0")}`;

    if (this.gameTimer < 30) {
      this.timerDisplay.style.color = "#ff6b6b";
      this.timerDisplay.style.borderColor = "rgba(255, 107, 107, 0.32)";
    } else {
      this.timerDisplay.style.color = "#f4f6fb";
      this.timerDisplay.style.borderColor = "rgba(126, 207, 255, 0.22)";
    }
  }

  private getFallbackStatus(): GameRendererHUDStatus {
    if (!this.currentTurn) {
      return {
        label: "Game status",
        text: "Waiting for players",
        accentColor: "#9aa3b2",
      };
    }

    const currentPlayer = this.players.find((player) => player.userId === this.currentTurn);
    if (!currentPlayer) {
      return {
        label: "Game status",
        text: "Game in progress",
        accentColor: "#9aa3b2",
      };
    }

    const isLocalPlayer = this.room?.sessionId === this.currentTurn;
    return {
      label: "Game status",
      text: isLocalPlayer ? "Your turn" : `${currentPlayer.displayName}'s turn`,
      accentColor: isLocalPlayer ? "#8ff0b0" : "#8fc6ff",
    };
  }

  private createPlayerTag(text: string, background: string, color: string): HTMLElement {
    const tag = document.createElement("span");
    Object.assign(tag.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "3px 8px",
      borderRadius: "999px",
      background,
      color,
      fontSize: "0.72rem",
      fontWeight: "600",
      lineHeight: "1",
    });
    tag.textContent = text;
    return tag;
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

import { GAME_LAYOUT_CHANGE_EVENT } from "./gameLayout";

export interface HUDOptions {
  gameTimer?: number;
  showTimer?: boolean;
}

export type HUDEvent = { type: "leave" } | { type: "chat_toggle" };
type HUDEventCallback = (event: HUDEvent) => void;
type HUDTimerCallback = (gameTimer: number | null, showTimer: boolean) => void;

const HUD_EDGE_OFFSET = 16;

export class HUD {
  private readonly container: HTMLElement;
  private readonly leaveButton: HTMLButtonElement;
  private readonly chatToggle: HTMLButtonElement;
  private readonly chatPlaceholder: HTMLElement;

  private eventCallback: HUDEventCallback | null = null;
  private timerCallback: HUDTimerCallback | null = null;
  private gameTimer: number | null = null;
  private showTimer = false;
  private timerIntervalId: number | null = null;
  private isChatOpen = false;

  constructor() {
    this.container = this.createContainer();
    this.leaveButton = this.createLeaveButton();
    this.chatToggle = this.createChatToggle();
    this.chatPlaceholder = this.createChatPlaceholder();

    this.container.append(
      this.leaveButton,
      this.chatToggle,
      this.chatPlaceholder,
    );

    document.body.appendChild(this.container);
    window.addEventListener("resize", () => this.applyLayout());
    window.addEventListener(GAME_LAYOUT_CHANGE_EVENT, () => this.applyLayout());
    this.applyLayout();
  }

  onEvent(callback: HUDEventCallback): void {
    this.eventCallback = callback;
  }

  onTimerChange(callback: HUDTimerCallback): void {
    this.timerCallback = callback;
  }

  show(options: HUDOptions): void {
    this.gameTimer = options.gameTimer ?? null;
    this.showTimer = options.showTimer ?? false;

    this.applyLayout();
    this.container.style.display = "block";
    this.syncTimerState();
  }

  hide(): void {
    this.container.style.display = "none";
    this.stopTimer();
    this.gameTimer = null;
    this.showTimer = false;
    this.isChatOpen = false;
    this.chatPlaceholder.style.display = "none";
    this.notifyTimerChange();
  }

  update(options: Partial<HUDOptions>): void {
    if (options.gameTimer !== undefined) {
      this.gameTimer = options.gameTimer;
    }
    if (options.showTimer !== undefined) {
      this.showTimer = options.showTimer;
    }

    this.applyLayout();
    this.syncTimerState();
  }

  setSidebarActive(_active: boolean): void {
    this.applyLayout();
  }

  private applyLayout(): void {
    const gameContainer = document.getElementById("game-container");
    const gameBounds = gameContainer?.getBoundingClientRect();
    const rightInset = gameBounds
      ? Math.max(HUD_EDGE_OFFSET, window.innerWidth - gameBounds.right + HUD_EDGE_OFFSET)
      : HUD_EDGE_OFFSET;
    const availableWidth = gameBounds
      ? Math.max(0, gameBounds.width - (HUD_EDGE_OFFSET * 2))
      : Math.max(0, window.innerWidth - 152);

    this.leaveButton.style.right = `${rightInset}px`;
    this.chatToggle.style.right = `${rightInset}px`;
    this.chatPlaceholder.style.right = `${rightInset}px`;
    this.chatPlaceholder.style.maxWidth = `${Math.max(0, availableWidth)}px`;
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
    placeholder.textContent = "Chat coming soon!";
    return placeholder;
  }

  private shouldShowTimer(): boolean {
    return this.showTimer && this.gameTimer !== null;
  }

  private syncTimerState(): void {
    if (this.shouldShowTimer()) {
      this.startTimer();
    } else {
      this.stopTimer();
    }

    this.notifyTimerChange();
  }

  private notifyTimerChange(): void {
    this.timerCallback?.(this.gameTimer, this.shouldShowTimer());
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerIntervalId = window.setInterval(() => {
      if (this.gameTimer !== null && this.gameTimer > 0) {
        this.gameTimer--;
        this.notifyTimerChange();
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

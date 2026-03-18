const GAME_HEADER_STYLE_ID = "playgrid-game-header-styles";

export type GameHeaderEventType = "back_to_lobby" | "resign";

export type GameHeaderEvent = {
  type: GameHeaderEventType;
};

type GameHeaderEventCallback = (event: GameHeaderEvent) => void;

export type GameHeaderData = {
  gameTitle: string;
};

function injectStyles(): void {
  if (document.getElementById(GAME_HEADER_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = GAME_HEADER_STYLE_ID;
  style.textContent = `
    .game-header-slot {
      display: none;
      width: 100%;
      pointer-events: none;
    }

    .game-header {
      width: 100%;
      padding: var(--space-md) var(--space-lg);
      border-bottom: 1px solid var(--glass-border);
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      box-sizing: border-box;
      font-family: var(--font-family);
      pointer-events: auto;
    }

    .game-header__content {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-lg);
    }

    .game-header__left,
    .game-header__right {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      gap: var(--space-sm);
    }

    .game-header__left {
      justify-content: flex-start;
    }

    .game-header__right {
      justify-content: flex-end;
    }

    .game-header__center {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
    }

    .game-header__title {
      font-size: var(--font-xl);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      white-space: nowrap;
    }

    .game-header__btn {
      padding: 8px 16px;
      border-radius: var(--radius-md);
      font-size: var(--font-base);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      font-family: inherit;
    }

    .game-header__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .game-header__btn--back {
      background: var(--bg-card);
      color: var(--text-secondary);
      border-color: var(--border-light);
    }

    .game-header__btn--back:hover:not(:disabled) {
      background: var(--bg-dark);
      color: var(--text-primary);
      border-color: var(--border-default);
    }

    .game-header__btn--danger {
      background: rgba(239, 68, 68, 0.15);
      color: var(--pg-red-200);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .game-header__btn--danger:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.25);
      color: #fecaca;
      border-color: rgba(239, 68, 68, 0.5);
    }

    @media (max-width: 640px) {
      .game-header__content {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-sm);
      }

      .game-header__left,
      .game-header__right {
        flex: 1 1 auto;
        justify-content: center;
      }

      .game-header__center {
        order: -1;
        justify-content: center;
      }
    }
  `;

  document.head.appendChild(style);
}

export class GameHeader {
  private readonly container: HTMLElement;
  private readonly mount: HTMLElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly resignBtn: HTMLButtonElement;
  private eventCallback: GameHeaderEventCallback | null = null;
  private isVisible = false;

  constructor(mount: HTMLElement) {
    injectStyles();
    this.mount = mount;

    this.container = document.createElement("header");
    this.container.className = "game-header";

    const content = document.createElement("div");
    content.className = "game-header__content";

    // Left: Back to Lobby
    const left = document.createElement("div");
    left.className = "game-header__left";

    this.backBtn = document.createElement("button");
    this.backBtn.type = "button";
    this.backBtn.className = "game-header__btn game-header__btn--back";
    this.backBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>Back to Lobby</span>
    `;
    this.backBtn.addEventListener("click", () => {
      this.eventCallback?.({ type: "back_to_lobby" });
    });

    left.appendChild(this.backBtn);

    // Center: Game Title
    const center = document.createElement("div");
    center.className = "game-header__center";

    this.titleEl = document.createElement("h1");
    this.titleEl.className = "game-header__title";
    this.titleEl.textContent = "Game";

    center.appendChild(this.titleEl);

    // Right: Resign
    const right = document.createElement("div");
    right.className = "game-header__right";

    this.resignBtn = document.createElement("button");
    this.resignBtn.type = "button";
    this.resignBtn.className = "game-header__btn game-header__btn--danger";
    this.resignBtn.textContent = "Resign";
    this.resignBtn.addEventListener("click", () => {
      this.eventCallback?.({ type: "resign" });
    });

    right.appendChild(this.resignBtn);

    content.append(left, center, right);
    this.container.appendChild(content);
    this.mount.appendChild(this.container);

    this.setVisible(false);
  }

  onEvent(callback: GameHeaderEventCallback): void {
    this.eventCallback = callback;
  }

  show(data: GameHeaderData): void {
    this.titleEl.textContent = data.gameTitle;
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  destroy(): void {
    this.container.remove();
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    if (this.isVisible === visible) {
      return;
    }

    this.isVisible = visible;
    this.mount.style.display = visible ? "block" : "none";
  }
}

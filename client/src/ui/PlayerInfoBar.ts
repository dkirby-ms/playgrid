import { formatTurnClock } from "./GameSidebar";
import { GAME_LAYOUT_CHANGE_EVENT } from "./gameLayout";

const PLAYER_INFO_BAR_STYLE_ID = "playgrid-player-info-bar-styles";

export type PlayerInfoBarVariant = "opponent" | "player";
export type PlayerInfoStatusTone = "active" | "waiting" | "neutral";

export type PlayerInfoBarData = {
  name: string;
  label?: string;
  status?: string;
  statusTone?: PlayerInfoStatusTone;
  timerSeconds?: number | null;
};

function injectStyles(): void {
  if (document.getElementById(PLAYER_INFO_BAR_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = PLAYER_INFO_BAR_STYLE_ID;
  style.textContent = `
    .game-layout {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: var(--space-sm);
      padding: var(--space-md);
      box-sizing: border-box;
    }

    .game-info-slot {
      display: none;
      align-items: center;
      justify-content: center;
      width: 100%;
      pointer-events: none;
    }

    .game-canvas-frame {
      flex: 1 1 auto;
      width: 100%;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .player-info-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-lg);
      padding: var(--space-md) var(--space-lg);
      border-radius: var(--radius-lg);
      border: 1px solid var(--glass-border);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      box-shadow: var(--shadow-card);
      font-family: var(--font-family);
      color: var(--text-primary);
      box-sizing: border-box;
    }

    .player-info-bar--player {
      border-color: var(--accent-border);
      background: linear-gradient(
        130deg,
        rgba(15, 23, 42, 0.7),
        rgba(30, 41, 59, 0.6)
      );
    }

    .player-info-bar__identity {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      min-width: 0;
    }

    .player-info-bar__avatar {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-lg);
      font-weight: 600;
      text-transform: uppercase;
      background: linear-gradient(135deg, var(--pg-slate-700), var(--pg-slate-600));
      color: var(--text-primary);
      flex-shrink: 0;
    }

    .player-info-bar--player .player-info-bar__avatar {
      background: linear-gradient(135deg, var(--pg-blue-500), var(--pg-blue-600));
    }

    .player-info-bar__copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .player-info-bar__name {
      font-size: var(--font-base);
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player-info-bar__label {
      font-size: var(--font-sm);
      color: var(--text-secondary);
    }

    .player-info-bar__meta {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-shrink: 0;
    }

    .player-info-bar__status,
    .player-info-bar__timer {
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      font-size: var(--font-sm);
      font-weight: 600;
      line-height: 1.2;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .player-info-bar__status--active {
      background: var(--status-playing-bg);
      color: var(--status-playing-text);
      border-color: rgba(34, 197, 94, 0.35);
      animation: status-pulse 2s ease-in-out infinite;
    }

    @keyframes status-pulse {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
      }
      50% {
        opacity: 0.85;
        box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.3);
      }
    }

    .player-info-bar__status--waiting {
      background: var(--status-waiting-bg);
      color: var(--status-waiting-text);
      border-color: rgba(245, 158, 11, 0.25);
    }

    .player-info-bar__status--neutral {
      background: rgba(148, 163, 184, 0.18);
      color: var(--text-muted);
      border-color: rgba(148, 163, 184, 0.2);
    }

    .player-info-bar__timer {
      background: rgba(15, 23, 42, 0.7);
      color: var(--text-primary);
      border-color: rgba(126, 207, 255, 0.28);
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 720px) {
      .player-info-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-sm);
      }

      .player-info-bar__meta {
        align-self: flex-end;
      }
    }
  `;

  document.head.appendChild(style);
}

export class PlayerInfoBar {
  private readonly container: HTMLDivElement;
  private readonly avatarEl: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly labelEl: HTMLDivElement;
  private readonly statusEl: HTMLSpanElement;
  private readonly timerEl: HTMLSpanElement;
  private readonly mount: HTMLElement;
  private isVisible = false;

  constructor(mount: HTMLElement, variant: PlayerInfoBarVariant) {
    injectStyles();
    this.mount = mount;

    this.container = document.createElement("div");
    this.container.className = `player-info-bar player-info-bar--${variant}`;

    const identity = document.createElement("div");
    identity.className = "player-info-bar__identity";

    this.avatarEl = document.createElement("div");
    this.avatarEl.className = "player-info-bar__avatar";

    const copy = document.createElement("div");
    copy.className = "player-info-bar__copy";

    this.nameEl = document.createElement("div");
    this.nameEl.className = "player-info-bar__name";

    this.labelEl = document.createElement("div");
    this.labelEl.className = "player-info-bar__label";

    copy.append(this.nameEl, this.labelEl);
    identity.append(this.avatarEl, copy);

    const meta = document.createElement("div");
    meta.className = "player-info-bar__meta";

    this.statusEl = document.createElement("span");
    this.statusEl.className = "player-info-bar__status";

    this.timerEl = document.createElement("span");
    this.timerEl.className = "player-info-bar__timer";

    meta.append(this.statusEl, this.timerEl);
    this.container.append(identity, meta);
    this.mount.appendChild(this.container);

    this.setVisible(false);
  }

  update(data: PlayerInfoBarData | null): void {
    if (!data) {
      this.setVisible(false);
      return;
    }

    this.setVisible(true);

    const name = data.name.trim().length > 0 ? data.name : "Player";
    this.nameEl.textContent = name;
    this.avatarEl.textContent = name.trim().charAt(0).toUpperCase() || "?";

    this.labelEl.textContent = data.label ?? "";
    this.labelEl.style.display = data.label ? "block" : "none";

    this.statusEl.textContent = data.status ?? "";
    this.statusEl.style.display = data.status ? "inline-flex" : "none";
    this.applyStatusTone(data.statusTone ?? "neutral");

    if (data.timerSeconds !== null && data.timerSeconds !== undefined && data.timerSeconds > 0) {
      this.timerEl.textContent = formatTurnClock(data.timerSeconds);
      this.timerEl.style.display = "inline-flex";
    } else {
      this.timerEl.style.display = "none";
    }
  }

  destroy(): void {
    this.container.remove();
    this.setVisible(false);
  }

  private applyStatusTone(tone: PlayerInfoStatusTone): void {
    this.statusEl.classList.toggle("player-info-bar__status--active", tone === "active");
    this.statusEl.classList.toggle("player-info-bar__status--waiting", tone === "waiting");
    this.statusEl.classList.toggle("player-info-bar__status--neutral", tone === "neutral");
  }

  private setVisible(visible: boolean): void {
    if (this.isVisible === visible) {
      return;
    }

    this.isVisible = visible;
    this.mount.style.display = visible ? "flex" : "none";
    window.dispatchEvent(new Event(GAME_LAYOUT_CHANGE_EVENT));
  }
}

import type { MoveEntry } from "@eschaton/shared";
import { getFormatter } from "./historyFormatters";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLE_ID = "playgrid-history-screen-styles";
const CONTAINER_ID = "history-overlay";

const GAME_LABELS: Record<string, string> = {
  checkers: "Checkers",
  backgammon: "Backgammon",
  risk: "Risk",
  dominos: "Dominos",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryScreenData {
  moveHistory: MoveEntry[];
  gameType: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes hs-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes hs-slide-up {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #${CONTAINER_ID} {
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--overlay-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      animation: hs-fade-in 0.3s ease-out;
      padding: var(--space-lg);
    }

    .hs-container {
      width: 100%;
      max-width: 720px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--glass-radius);
      box-shadow: var(--shadow-modal);
      animation: hs-slide-up 0.4s ease-out 0.05s both;
      overflow: hidden;
    }

    /* Header */
    .hs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md) var(--space-lg);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }

    .hs-title-group {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .hs-title {
      font-family: var(--font-family);
      font-size: var(--font-2xl);
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
    }

    .hs-game-badge {
      display: inline-block;
      font-family: var(--font-family);
      font-size: var(--font-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      background: var(--bg-card-dark);
      padding: var(--space-2xs) var(--space-sm);
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-light);
    }

    .hs-close {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      font-size: var(--font-xl);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      flex-shrink: 0;
    }

    .hs-close:hover {
      background: var(--pg-slate-700);
      color: var(--text-primary);
    }

    /* Stats bar */
    .hs-stats {
      display: flex;
      gap: var(--space-lg);
      padding: var(--space-sm) var(--space-lg);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .hs-stat-item {
      display: flex;
      align-items: center;
      gap: var(--space-2xs);
      font-family: var(--font-family);
      font-size: var(--font-sm);
      color: var(--text-muted);
    }

    .hs-stat-value {
      font-weight: 700;
      color: var(--text-secondary);
    }

    /* Move list */
    .hs-move-list {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-sm) var(--space-lg);
      scroll-behavior: smooth;
    }

    .hs-move-list::-webkit-scrollbar {
      width: 6px;
    }
    .hs-move-list::-webkit-scrollbar-track {
      background: transparent;
    }
    .hs-move-list::-webkit-scrollbar-thumb {
      background: var(--pg-slate-600);
      border-radius: var(--radius-pill);
    }

    .hs-empty {
      text-align: center;
      padding: var(--space-2xl);
      font-family: var(--font-family);
      font-size: var(--font-base);
      color: var(--text-muted);
    }

    .hs-move-entry {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--radius-md);
      transition: background 0.1s ease;
    }

    .hs-move-entry:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .hs-move-entry + .hs-move-entry {
      border-top: 1px solid rgba(51, 65, 85, 0.2);
    }

    .hs-move-turn {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-family);
      font-size: var(--font-xs);
      font-weight: 700;
      border-radius: var(--radius-md);
      color: var(--text-primary);
    }

    .hs-move-turn.hs-player-0 {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.1));
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .hs-move-turn.hs-player-1 {
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(234, 179, 8, 0.1));
      border: 1px solid rgba(234, 179, 8, 0.3);
    }

    .hs-move-turn.hs-player-2 {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(168, 85, 247, 0.1));
      border: 1px solid rgba(168, 85, 247, 0.3);
    }

    .hs-move-turn.hs-player-3 {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.1));
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .hs-move-body {
      flex: 1;
      min-width: 0;
    }

    .hs-move-player {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      font-weight: 600;
      margin: 0;
    }

    .hs-move-player.hs-player-0 { color: var(--pg-blue-400); }
    .hs-move-player.hs-player-1 { color: var(--pg-amber-400); }
    .hs-move-player.hs-player-2 { color: rgba(168, 85, 247, 0.9); }
    .hs-move-player.hs-player-3 { color: var(--pg-green-400); }

    .hs-move-desc {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.4;
    }

    .hs-move-time {
      flex-shrink: 0;
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      white-space: nowrap;
    }

    /* Footer */
    .hs-footer {
      padding: var(--space-md) var(--space-lg);
      border-top: 1px solid var(--border-light);
      flex-shrink: 0;
    }

    .hs-btn-back {
      width: 100%;
      font-family: var(--font-family);
      font-size: var(--font-base);
      font-weight: 700;
      border: none;
      border-radius: var(--radius-lg);
      padding: var(--space-sm) var(--space-lg);
      cursor: pointer;
      background: var(--pg-slate-700);
      color: var(--text-primary);
      transition: transform 0.15s ease, background 0.15s ease;
      text-align: center;
    }

    .hs-btn-back:hover {
      transform: scale(1.02);
      background: var(--pg-slate-600);
    }

    .hs-btn-back:active {
      transform: scale(0.98);
    }

    @media (max-width: 480px) {
      .hs-container {
        max-height: 100vh;
        border-radius: 0;
      }

      .hs-header {
        padding: var(--space-sm) var(--space-md);
      }

      .hs-stats {
        padding: var(--space-xs) var(--space-md);
        gap: var(--space-md);
      }

      .hs-move-list {
        padding: var(--space-xs) var(--space-md);
      }

      .hs-footer {
        padding: var(--space-sm) var(--space-md);
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// HistoryScreen
// ---------------------------------------------------------------------------

export class HistoryScreen {
  private container: HTMLElement | null = null;
  private onCloseCallback: (() => void) | null = null;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  show(data: HistoryScreenData, onClose: () => void): void {
    this.hide();
    injectStyles();

    this.onCloseCallback = onClose;

    const { moveHistory, gameType, metadata } = data;
    const formatter = getFormatter(gameType);

    // Build a player-index map from order of first appearance
    const playerIndexMap = new Map<string, number>();
    for (const move of moveHistory) {
      if (!playerIndexMap.has(move.playerId)) {
        playerIndexMap.set(move.playerId, playerIndexMap.size);
      }
    }

    // Root overlay
    this.container = el("div");
    this.container.id = CONTAINER_ID;

    const panel = el("div", "hs-container");

    // ── Header ──
    const header = el("div", "hs-header");
    const titleGroup = el("div", "hs-title-group");
    titleGroup.appendChild(el("h2", "hs-title", "Move History"));
    titleGroup.appendChild(
      el("span", "hs-game-badge", GAME_LABELS[gameType] ?? gameType),
    );
    header.appendChild(titleGroup);

    const closeBtn = el("button", "hs-close", "×");
    closeBtn.setAttribute("aria-label", "Close history");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // ── Stats bar ──
    const meta = (metadata ?? {}) as Record<string, unknown>;
    const statsBar = el("div", "hs-stats");
    let hasStats = false;

    const totalMoves = moveHistory.length;
    if (totalMoves > 0) {
      statsBar.appendChild(this.buildStat("📊", "Moves", String(totalMoves)));
      hasStats = true;
    }

    if (typeof meta.durationSeconds === "number") {
      statsBar.appendChild(
        this.buildStat("⏱️", "Duration", formatDuration(meta.durationSeconds as number)),
      );
      hasStats = true;

      if (totalMoves > 0) {
        const avg = Math.round((meta.durationSeconds as number) / totalMoves);
        statsBar.appendChild(this.buildStat("⚡", "Avg/Move", `${avg}s`));
      }
    }

    if (hasStats) {
      panel.appendChild(statsBar);
    }

    // ── Move list ──
    const moveList = el("div", "hs-move-list");
    moveList.setAttribute("role", "list");

    if (moveHistory.length === 0) {
      moveList.appendChild(el("p", "hs-empty", "No moves recorded."));
    } else {
      for (const move of moveHistory) {
        const playerIdx = playerIndexMap.get(move.playerId) ?? 0;
        const entry = el("div", "hs-move-entry");
        entry.setAttribute("role", "listitem");

        // Turn badge
        const turnBadge = el(
          "div",
          `hs-move-turn hs-player-${Math.min(playerIdx, 3)}`,
          String(move.turnNumber),
        );
        entry.appendChild(turnBadge);

        // Body
        const body = el("div", "hs-move-body");
        const playerLabel = el(
          "p",
          `hs-move-player hs-player-${Math.min(playerIdx, 3)}`,
          move.playerName,
        );
        body.appendChild(playerLabel);

        const desc = el("p", "hs-move-desc");
        desc.innerHTML = formatter.formatMove(move);
        body.appendChild(desc);

        entry.appendChild(body);

        // Timestamp
        const time = el("span", "hs-move-time", formatTimestamp(move.timestamp));
        entry.appendChild(time);

        moveList.appendChild(entry);
      }
    }

    panel.appendChild(moveList);

    // ── Footer ──
    const footer = el("div", "hs-footer");
    const backBtn = el("button", "hs-btn-back", "Back to Results");
    backBtn.addEventListener("click", () => this.close());
    footer.appendChild(backBtn);
    panel.appendChild(footer);

    this.container.appendChild(panel);
    document.body.appendChild(this.container);

    // Keyboard: Escape to close
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.close();
      }
    };
    document.addEventListener("keydown", this.boundKeyHandler);

    // Focus close button for keyboard accessibility
    closeBtn.focus();
  }

  hide(): void {
    if (this.boundKeyHandler) {
      document.removeEventListener("keydown", this.boundKeyHandler);
      this.boundKeyHandler = null;
    }
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.onCloseCallback = null;
  }

  destroy(): void {
    this.hide();
    const injected = document.getElementById(STYLE_ID);
    if (injected) {
      injected.remove();
    }
  }

  private close(): void {
    const cb = this.onCloseCallback;
    this.hide();
    cb?.();
  }

  private buildStat(icon: string, label: string, value: string): HTMLElement {
    const item = el("div", "hs-stat-item");
    item.appendChild(el("span", undefined, icon));
    item.appendChild(el("span", undefined, `${label}:`));
    item.appendChild(el("span", "hs-stat-value", value));
    return item;
  }
}

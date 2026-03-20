import {
  GAME_LAYOUT_CHANGE_EVENT,
  GAME_LAYOUT_SIDEBAR_ACTIVE_CLASS,
} from "./gameLayout";

const GAME_SIDEBAR_STYLE_ID = "playgrid-game-sidebar-styles";
const VISIBLE_CLASS = "is-visible";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

function setPanelMarkup(element: HTMLDivElement, content: string): void {
  element.innerHTML = content;
}

export function formatTurnClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getTurnClockMarkup(seconds: number | null, visible: boolean): string {
  if (!visible || seconds === null) {
    return "";
  }

  const criticalClass = seconds < 30 ? " sidebar-turn-clock--critical" : "";
  return `<div class="sidebar-stat-row"><span class="sidebar-stat-label">Turn Clock</span><span class="sidebar-stat-value sidebar-turn-clock${criticalClass}">${escapeHtml(formatTurnClock(seconds))}</span></div>`;
}

export function getChessClockMarkup(
  player1TimeMs: number,
  player2TimeMs: number,
  activePlayerIndex: number,
  player1Name: string,
  player2Name: string,
): string {
  const player1Seconds = Math.ceil(player1TimeMs / 1000);
  const player2Seconds = Math.ceil(player2TimeMs / 1000);
  const player1Critical = player1Seconds < 60;
  const player2Critical = player2Seconds < 60;
  const player1Active = activePlayerIndex === 0;
  const player2Active = activePlayerIndex === 1;

  const player1ItemClass = `sidebar-clock-item${player1Active ? " sidebar-clock-item--active" : ""}${player1Critical && player1Active ? " sidebar-clock-item--critical" : ""}`;
  const player2ItemClass = `sidebar-clock-item${player2Active ? " sidebar-clock-item--active" : ""}${player2Critical && player2Active ? " sidebar-clock-item--critical" : ""}`;
  const player1TimeClass = `sidebar-clock-time${player1Critical ? " sidebar-clock-time--critical" : ""}`;
  const player2TimeClass = `sidebar-clock-time${player2Critical ? " sidebar-clock-time--critical" : ""}`;

  const player1Indicator = player1Active ? '<div class="sidebar-clock-indicator"></div>' : "";
  const player2Indicator = player2Active ? '<div class="sidebar-clock-indicator"></div>' : "";

  return `
    <div class="sidebar-clock-container">
      <div class="${player1ItemClass}">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1;">
          <div class="sidebar-clock-player-name">${escapeHtml(player1Name)} (Black)</div>
          <div class="${player1TimeClass}">${escapeHtml(formatTurnClock(player1Seconds))}</div>
        </div>
        ${player1Indicator}
      </div>
      <div class="${player2ItemClass}">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1;">
          <div class="sidebar-clock-player-name">${escapeHtml(player2Name)} (Red)</div>
          <div class="${player2TimeClass}">${escapeHtml(formatTurnClock(player2Seconds))}</div>
        </div>
        ${player2Indicator}
      </div>
    </div>
  `;
}

function injectStyles(): void {
  if (document.getElementById(GAME_SIDEBAR_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = GAME_SIDEBAR_STYLE_ID;
  style.textContent = `
    .game-sidebar {
      position: fixed;
      top: 72px;
      right: var(--game-sidebar-edge-offset, 16px);
      width: min(var(--game-sidebar-width, 304px), calc(100vw - 32px));
      max-height: calc(100vh - 88px);
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
      overflow-y: auto;
      padding-right: 4px;
      pointer-events: none;
      z-index: 14;
      opacity: 0;
      visibility: hidden;
      transform: translateX(24px);
      transition:
        transform 220ms ease,
        opacity 220ms ease,
        visibility 220ms ease;
      font-family: var(--font-family);
      scrollbar-width: thin;
      scrollbar-color: var(--glass-border) transparent;
    }

    .game-sidebar.${VISIBLE_CLASS} {
      opacity: 1;
      visibility: visible;
      transform: translateX(0);
    }

    .game-sidebar::-webkit-scrollbar {
      width: 8px;
    }

    .game-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }

    .game-sidebar::-webkit-scrollbar-thumb {
      background: var(--glass-border);
      border-radius: var(--radius-pill);
    }

    .game-sidebar-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      min-height: 0;
      max-height: min(320px, calc(100vh - 140px));
      padding: var(--space-md);
      box-shadow: var(--shadow-card);
      pointer-events: auto;
    }

    .sidebar-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding-bottom: var(--space-sm);
      border-bottom: 1px solid var(--border-light);
    }

    .sidebar-panel-header h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-lg);
      font-weight: 600;
      line-height: 1.3;
    }

    .sidebar-panel-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      min-height: 0;
      overflow-y: auto;
      color: var(--text-secondary);
      font-size: var(--font-sm);
      line-height: 1.5;
      white-space: normal;
      scrollbar-width: thin;
      scrollbar-color: var(--glass-border) transparent;
    }

    .sidebar-panel-content > * {
      margin: 0;
    }

    .sidebar-panel-content::-webkit-scrollbar {
      width: 6px;
    }

    .sidebar-panel-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .sidebar-panel-content::-webkit-scrollbar-thumb {
      background: var(--glass-border);
      border-radius: var(--radius-pill);
    }

    .sidebar-stat-list,
    .sidebar-history-list,
    .sidebar-player-list,
    .sidebar-button-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .sidebar-stat-row,
    .sidebar-player-row,
    .sidebar-history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-sm);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      background: var(--bg-card-dark);
    }

    .sidebar-player-row,
    .sidebar-history-item {
      align-items: flex-start;
      justify-content: flex-start;
    }

    .sidebar-stat-row--turn-active {
      border-color: var(--sidebar-turn-indicator-border, rgba(34, 197, 94, 0.42));
      background: linear-gradient(
        135deg,
        var(--sidebar-turn-indicator-bg, var(--status-waiting-bg)),
        var(--bg-card-dark)
      );
      box-shadow:
        inset 3px 0 0 var(--sidebar-turn-indicator-accent, var(--pg-amber-400)),
        0 14px 28px var(--sidebar-turn-indicator-shadow, rgba(245, 158, 11, 0.2));
      animation: sidebar-turn-indicator-pulse 1800ms ease-in-out infinite;
    }

    .sidebar-stat-row--turn-active .sidebar-stat-label {
      color: var(--sidebar-turn-indicator-accent, var(--pg-amber-400));
    }

    .sidebar-stat-label,
    .sidebar-player-meta,
    .sidebar-empty {
      color: var(--text-secondary);
      font-size: var(--font-sm);
    }

    .sidebar-stat-value,
    .sidebar-player-name,
    .sidebar-history-text {
      min-width: 0;
      color: var(--text-primary);
      font-weight: 600;
      word-break: break-word;
    }

    .sidebar-stat-value {
      text-align: right;
    }

    .sidebar-stat-value--turn-active {
      color: var(--sidebar-turn-indicator-text, var(--text-primary));
      font-size: 1.08rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-shadow: 0 0 14px var(--sidebar-turn-indicator-text-glow, rgba(250, 204, 21, 0.24));
    }

    .sidebar-turn-clock {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 72px;
      padding: var(--space-2xs) var(--space-xs);
      border: 1px solid var(--accent-border);
      border-radius: var(--radius-pill);
      background: var(--bg-card-dark);
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .sidebar-turn-clock--critical {
      border-color: var(--status-danger);
      color: var(--pg-red-200);
    }

    .sidebar-player-copy {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .sidebar-player-meta {
      font-size: var(--font-xs);
    }

    .sidebar-history-item {
      gap: var(--space-xs);
    }

    .sidebar-history-index,
    .sidebar-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 var(--space-xs);
      border-radius: var(--radius-pill);
      background: var(--accent-soft);
      color: var(--text-primary);
      font-size: var(--font-xs);
      font-weight: 600;
      line-height: 1;
      flex: 0 0 auto;
    }

    .sidebar-note {
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--radius-lg);
      border: 1px solid var(--notice-info-border);
      background: var(--notice-info-bg);
      color: var(--notice-info-text);
      font-size: var(--font-sm);
    }

    @keyframes sidebar-turn-indicator-pulse {
      0%,
      100% {
        box-shadow:
          inset 3px 0 0 var(--sidebar-turn-indicator-accent, var(--pg-amber-400)),
          0 14px 28px var(--sidebar-turn-indicator-shadow, rgba(245, 158, 11, 0.2));
      }

      50% {
        box-shadow:
          inset 3px 0 0 var(--sidebar-turn-indicator-accent, var(--pg-amber-400)),
          0 16px 32px var(--sidebar-turn-indicator-shadow, rgba(245, 158, 11, 0.28));
      }
    }

    .sidebar-button {
      appearance: none;
      width: 100%;
      min-height: 44px;
      padding: 0 var(--space-md);
      border: 1px solid var(--accent-border);
      border-radius: var(--radius-lg);
      background: var(--gradient-button-primary);
      color: var(--text-primary);
      font: inherit;
      font-size: var(--font-sm);
      font-weight: 600;
      cursor: pointer;
      transition:
        transform 140ms ease,
        border-color 140ms ease,
        opacity 140ms ease,
        box-shadow 140ms ease;
    }

    .sidebar-button:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-hover);
    }

    .sidebar-button--secondary {
      background: var(--bg-card-dark);
      border-color: var(--border-default);
    }

    .sidebar-button--secondary:not(:disabled):hover {
      border-color: var(--accent-border);
    }

    .sidebar-button--danger {
      background: var(--gradient-button-danger);
      border-color: var(--status-danger);
      color: var(--pg-red-200);
    }

    .sidebar-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .sidebar-clock-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .sidebar-clock-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      min-height: 64px;
      padding: var(--space-md) var(--space-lg);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      background: var(--bg-card-dark);
      transition: all 200ms ease;
    }

    .sidebar-clock-item--active {
      background: linear-gradient(135deg, var(--pg-slate-700), var(--pg-slate-800));
      border: 2px solid var(--pg-blue-400);
      box-shadow: 
        inset 0 0 0 2px var(--pg-blue-400),
        0 0 16px rgba(96, 165, 250, 0.3);
      animation: sidebar-clock-highlight 2000ms ease-in-out infinite;
    }

    .sidebar-clock-item--active.sidebar-clock-item--critical {
      background: rgba(248, 113, 113, 0.08);
      border-color: var(--pg-red-400);
    }

    .sidebar-clock-player-name {
      color: var(--pg-slate-400);
      font-size: var(--font-xs);
      font-weight: 400;
      line-height: 1.2;
    }

    .sidebar-clock-time {
      color: var(--text-primary);
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-family: 'Courier New', Consolas, monospace;
    }

    .sidebar-clock-time--critical {
      color: var(--pg-red-400);
      font-weight: 800;
    }

    .sidebar-clock-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--pg-green-500);
      flex-shrink: 0;
      animation: sidebar-clock-pulse 2000ms ease-in-out infinite;
    }

    .sidebar-clock-item--active.sidebar-clock-item--critical .sidebar-clock-indicator {
      animation: sidebar-clock-pulse-fast 1000ms ease-in-out infinite;
    }

    @keyframes sidebar-clock-pulse {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
      }
      50% {
        opacity: 0.7;
        box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.2);
      }
    }

    @keyframes sidebar-clock-highlight {
      0%, 100% {
        box-shadow: 
          inset 0 0 0 2px var(--pg-blue-400),
          0 0 16px rgba(96, 165, 250, 0.3);
      }
      50% {
        box-shadow: 
          inset 0 0 0 2px var(--pg-blue-400),
          0 0 24px rgba(96, 165, 250, 0.5);
      }
    }

    @keyframes sidebar-clock-pulse-fast {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.4);
      }
      50% {
        opacity: 0.6;
        box-shadow: 0 0 12px 3px rgba(248, 113, 113, 0.3);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sidebar-stat-row--turn-active {
        animation: none;
      }
      .sidebar-clock-item--active {
        animation: none;
      }
      .sidebar-clock-indicator {
        animation: none;
      }
      .sidebar-clock-item--active.sidebar-clock-item--critical .sidebar-clock-indicator {
        animation: none;
      }
    }

    @media (max-width: 767px) {
      .game-sidebar {
        display: none;
      }
    }

    @media (min-width: 768px) and (max-width: 1024px) {
      .game-sidebar {
        width: min(var(--game-sidebar-width, 260px), calc(100vw - 32px));
      }

      .game-sidebar-panel {
        padding: var(--space-sm);
      }

      .sidebar-panel-header h3 {
        font-size: var(--font-base);
      }

      .sidebar-clock-time {
        font-size: 1.75rem;
      }
    }
  `;

  document.head.appendChild(style);
}

export class GameSidebar {
  private readonly container: HTMLDivElement;
  private readonly panels = new Map<string, HTMLDivElement>();
  private isVisible = false;

  constructor() {
    injectStyles();

    this.container = createElement("div", "game-sidebar") as HTMLDivElement;
    this.container.setAttribute("role", "complementary");
    this.container.setAttribute("aria-label", "Game information sidebar");
    this.container.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.container);
  }

  addPanel(id: string, title: string, content?: string): HTMLDivElement {
    const existingPanel = this.panels.get(id);
    if (existingPanel) {
      const existingTitle = existingPanel.querySelector(".sidebar-panel-header h3");
      const existingContent = existingPanel.querySelector(".sidebar-panel-content");
      if (existingTitle) {
        existingTitle.textContent = title;
      }
      if (content !== undefined && existingContent instanceof HTMLDivElement) {
        setPanelMarkup(existingContent, content);
      }
      return existingPanel;
    }

    const panel = createElement("div", "game-sidebar-panel glass-panel") as HTMLDivElement;
    panel.dataset.panelId = id;

    const header = createElement("div", "sidebar-panel-header") as HTMLDivElement;
    const heading = createElement("h3", undefined, title) as HTMLHeadingElement;
    const contentEl = createElement("div", "sidebar-panel-content") as HTMLDivElement;

    if (content !== undefined) {
      setPanelMarkup(contentEl, content);
    }

    header.appendChild(heading);
    panel.append(header, contentEl);
    this.container.appendChild(panel);

    this.panels.set(id, panel);

    return panel;
  }

  updatePanel(id: string, content: string): void {
    const contentEl = this.getPanelContent(id);
    if (!contentEl) {
      return;
    }

    setPanelMarkup(contentEl, content);
  }

  removePanel(id: string): void {
    const panel = this.panels.get(id);
    if (!panel) {
      return;
    }

    panel.remove();
    this.panels.delete(id);
  }

  clearPanels(): void {
    for (const panel of this.panels.values()) {
      panel.remove();
    }
    this.panels.clear();
  }

  show(): void {
    this.isVisible = true;
    this.container.classList.add(VISIBLE_CLASS);
    this.container.setAttribute("aria-hidden", "false");
    this.syncDocumentLayout();
  }

  hide(): void {
    this.isVisible = false;
    this.container.classList.remove(VISIBLE_CLASS);
    this.container.setAttribute("aria-hidden", "true");
    this.syncDocumentLayout();
  }

  destroy(): void {
    this.clearPanels();
    this.hide();
    this.container.remove();
  }

  getContainer(): HTMLDivElement {
    return this.container;
  }

  getPanelContent(id: string): HTMLDivElement | null {
    const panel = this.panels.get(id);
    if (!panel) {
      return null;
    }

    const contentEl = panel.querySelector(".sidebar-panel-content");
    return contentEl instanceof HTMLDivElement ? contentEl : null;
  }

  private syncDocumentLayout(): void {
    document.body.classList.toggle(GAME_LAYOUT_SIDEBAR_ACTIVE_CLASS, this.isVisible);
    window.dispatchEvent(new Event(GAME_LAYOUT_CHANGE_EVENT));
  }
}

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
      gap: var(--space-md);
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
      border-radius: 999px;
    }

    .game-sidebar-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      min-height: 0;
      max-height: min(320px, calc(100vh - 140px));
      padding: var(--space-md);
      box-shadow: 0 18px 36px rgba(0, 0, 0, 0.24);
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
      font-weight: 500;
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
      border-radius: 999px;
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
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
    }

    .sidebar-player-row,
    .sidebar-history-item {
      align-items: flex-start;
      justify-content: flex-start;
    }

    .sidebar-stat-label,
    .sidebar-player-meta,
    .sidebar-empty {
      color: var(--text-secondary);
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

    .sidebar-turn-clock {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 72px;
      padding: 4px 10px;
      border: 1px solid rgba(126, 207, 255, 0.22);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .sidebar-turn-clock--critical {
      border-color: rgba(255, 107, 107, 0.32);
      color: #ff9b9b;
    }

    .sidebar-player-copy {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .sidebar-player-meta {
      font-size: 0.78rem;
    }

    .sidebar-history-item {
      gap: 10px;
    }

    .sidebar-history-index,
    .sidebar-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border-radius: 999px;
      background: rgba(126, 207, 255, 0.14);
      color: var(--text-primary);
      font-size: 0.72rem;
      font-weight: 600;
      line-height: 1;
      flex: 0 0 auto;
    }

    .sidebar-note {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(126, 207, 255, 0.16);
      background: rgba(126, 207, 255, 0.08);
      color: var(--text-secondary);
    }

    .sidebar-button {
      appearance: none;
      width: 100%;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid rgba(126, 207, 255, 0.22);
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(126, 207, 255, 0.24), rgba(126, 207, 255, 0.12));
      color: var(--text-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition:
        transform 140ms ease,
        border-color 140ms ease,
        opacity 140ms ease,
        background 140ms ease;
    }

    .sidebar-button:not(:disabled):hover {
      transform: translateY(-1px);
      border-color: rgba(126, 207, 255, 0.42);
    }

    .sidebar-button--secondary {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .sidebar-button--danger {
      background: linear-gradient(135deg, rgba(190, 41, 41, 0.28), rgba(122, 22, 22, 0.2));
      border-color: rgba(255, 107, 107, 0.3);
      color: #ffe2e2;
    }

    .sidebar-button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
    }

    @media (max-width: 767px) {
      .game-sidebar {
        display: none;
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

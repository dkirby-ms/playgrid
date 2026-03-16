const GAME_SIDEBAR_STYLE_ID = "playgrid-game-sidebar-styles";
const VISIBLE_CLASS = "is-visible";

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
      right: 16px;
      width: min(304px, calc(100vw - 32px));
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
      min-height: 0;
      overflow-y: auto;
      color: var(--text-secondary);
      font-size: var(--font-sm);
      line-height: 1.5;
      white-space: pre-wrap;
      scrollbar-width: thin;
      scrollbar-color: var(--glass-border) transparent;
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
        existingContent.textContent = content;
      }
      return existingPanel;
    }

    const panel = createElement("div", "game-sidebar-panel glass-panel") as HTMLDivElement;
    panel.dataset.panelId = id;

    const header = createElement("div", "sidebar-panel-header") as HTMLDivElement;
    const heading = createElement("h3", undefined, title) as HTMLHeadingElement;
    const contentEl = createElement("div", "sidebar-panel-content") as HTMLDivElement;

    if (content !== undefined) {
      contentEl.textContent = content;
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

    contentEl.textContent = content;
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
    this.container.classList.add(VISIBLE_CLASS);
    this.container.setAttribute("aria-hidden", "false");
  }

  hide(): void {
    this.container.classList.remove(VISIBLE_CLASS);
    this.container.setAttribute("aria-hidden", "true");
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
}

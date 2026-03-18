const CONSOLE_LOG_STYLE_ID = "playgrid-console-log-styles";

export type ConsoleLogLevel = "info" | "success" | "warning" | "error";

export interface ConsoleLogEntry {
  timestamp: number;
  level: ConsoleLogLevel;
  message: string;
}

const MAX_ENTRIES = 200;

function injectStyles(): void {
  if (document.getElementById(CONSOLE_LOG_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = CONSOLE_LOG_STYLE_ID;
  style.textContent = `
    .console-log {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 15;
      display: flex;
      flex-direction: column;
      max-height: 260px;
      font-family: var(--font-family);
      pointer-events: auto;
      transition: max-height 0.25s ease;
    }

    .console-log.collapsed {
      max-height: 36px;
    }

    .console-log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2xs) var(--space-md);
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-top: 1px solid var(--glass-border);
      cursor: pointer;
      user-select: none;
      min-height: 36px;
      flex-shrink: 0;
    }

    .console-log-header:hover {
      background: var(--bg-card);
    }

    .console-log-header-left {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .console-log-title {
      font-size: var(--font-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .console-log-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--accent-soft);
      color: var(--accent-highlight);
      display: none;
    }

    .console-log-badge.visible {
      display: inline-block;
    }

    .console-log-toggle {
      font-size: var(--font-xs);
      color: var(--text-muted);
      transition: transform 0.2s ease;
    }

    .console-log.collapsed .console-log-toggle {
      transform: rotate(180deg);
    }

    .console-log-body {
      flex: 1 1 auto;
      overflow-y: auto;
      background: var(--bg-card-dark);
      border-top: 1px solid var(--border-light);
      padding: var(--space-xs) 0;
      scrollbar-width: thin;
      scrollbar-color: var(--pg-slate-600) transparent;
    }

    .console-log.collapsed .console-log-body {
      display: none;
    }

    .console-log-entry {
      display: flex;
      align-items: baseline;
      gap: var(--space-xs);
      padding: 2px var(--space-md);
      font-size: var(--font-xs);
      line-height: 1.5;
    }

    .console-log-entry:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .console-log-ts {
      color: var(--text-muted);
      font-family: monospace;
      font-size: 0.7rem;
      flex-shrink: 0;
      opacity: 0.7;
    }

    .console-log-level {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      flex-shrink: 0;
      width: 3.2em;
      text-align: center;
    }

    .console-log-msg {
      color: var(--text-secondary);
      word-break: break-word;
    }

    /* Level-specific colors */
    .console-log-entry--info .console-log-level {
      color: var(--accent-highlight);
    }

    .console-log-entry--success .console-log-level {
      color: var(--pg-green-400);
    }
    .console-log-entry--success .console-log-msg {
      color: var(--pg-green-400);
    }

    .console-log-entry--warning .console-log-level {
      color: var(--pg-amber-400);
    }
    .console-log-entry--warning .console-log-msg {
      color: var(--pg-amber-400);
    }

    .console-log-entry--error .console-log-level {
      color: var(--pg-red-500);
    }
    .console-log-entry--error .console-log-msg {
      color: var(--pg-red-200);
    }

    /* Latest entry preview in collapsed header */
    .console-log-preview {
      font-size: var(--font-xs);
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 50vw;
      display: none;
    }

    .console-log.collapsed .console-log-preview {
      display: inline;
    }

    /* Scrollbar for WebKit */
    .console-log-body::-webkit-scrollbar {
      width: 6px;
    }
    .console-log-body::-webkit-scrollbar-track {
      background: transparent;
    }
    .console-log-body::-webkit-scrollbar-thumb {
      background: var(--pg-slate-600);
      border-radius: 3px;
    }

    @media (max-width: 767px) {
      .console-log {
        max-height: 180px;
      }
      .console-log-preview {
        max-width: 40vw;
      }
    }
  `;
  document.head.appendChild(style);
}

const LEVEL_LABELS: Record<ConsoleLogLevel, string> = {
  info: "INFO",
  success: "OK",
  warning: "WARN",
  error: "ERR",
};

export class ConsoleLog {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly preview: HTMLElement;
  private readonly entries: ConsoleLogEntry[] = [];
  private collapsed = true;
  private unreadCount = 0;
  private userHasScrolled = false;

  constructor() {
    injectStyles();

    const container = document.getElementById("console-log-container");
    if (!container) {
      throw new Error("Missing #console-log-container");
    }

    this.root = document.createElement("div");
    this.root.className = "console-log collapsed";
    this.root.setAttribute("role", "log");
    this.root.setAttribute("aria-live", "polite");
    this.root.setAttribute("aria-label", "Console log");

    // Header
    const header = document.createElement("div");
    header.className = "console-log-header";
    header.addEventListener("click", () => this.toggle());

    const headerLeft = document.createElement("div");
    headerLeft.className = "console-log-header-left";

    const title = document.createElement("span");
    title.className = "console-log-title";
    title.textContent = "Console";

    this.badge = document.createElement("span");
    this.badge.className = "console-log-badge";

    this.preview = document.createElement("span");
    this.preview.className = "console-log-preview";

    headerLeft.append(title, this.badge, this.preview);

    const toggle = document.createElement("span");
    toggle.className = "console-log-toggle";
    toggle.textContent = "▾";
    toggle.setAttribute("aria-hidden", "true");

    header.append(headerLeft, toggle);

    // Body
    this.body = document.createElement("div");
    this.body.className = "console-log-body";
    this.body.addEventListener("scroll", () => {
      const { scrollTop, scrollHeight, clientHeight } = this.body;
      this.userHasScrolled = scrollHeight - scrollTop - clientHeight > 30;
    });

    this.root.append(header, this.body);
    container.appendChild(this.root);
  }

  log(message: string, level: ConsoleLogLevel = "info"): void {
    const entry: ConsoleLogEntry = {
      timestamp: Date.now(),
      level,
      message,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
      this.body.firstChild?.remove();
    }

    this.body.appendChild(this.createEntryEl(entry));
    this.preview.textContent = message;

    if (this.collapsed) {
      this.unreadCount++;
      this.badge.textContent = String(this.unreadCount);
      this.badge.classList.add("visible");
    }

    if (!this.userHasScrolled) {
      this.scrollToBottom();
    }
  }

  info(message: string): void {
    this.log(message, "info");
  }

  success(message: string): void {
    this.log(message, "success");
  }

  warn(message: string): void {
    this.log(message, "warning");
  }

  error(message: string): void {
    this.log(message, "error");
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.root.classList.toggle("collapsed", this.collapsed);

    if (!this.collapsed) {
      this.unreadCount = 0;
      this.badge.classList.remove("visible");
      this.scrollToBottom();
    }
  }

  expand(): void {
    if (this.collapsed) {
      this.toggle();
    }
  }

  collapse(): void {
    if (!this.collapsed) {
      this.toggle();
    }
  }

  destroy(): void {
    this.root.remove();
  }

  private createEntryEl(entry: ConsoleLogEntry): HTMLElement {
    const el = document.createElement("div");
    el.className = `console-log-entry console-log-entry--${entry.level}`;

    const ts = document.createElement("span");
    ts.className = "console-log-ts";
    ts.textContent = this.formatTime(entry.timestamp);

    const level = document.createElement("span");
    level.className = "console-log-level";
    level.textContent = LEVEL_LABELS[entry.level];

    const msg = document.createElement("span");
    msg.className = "console-log-msg";
    msg.textContent = entry.message;

    el.append(ts, level, msg);
    return el;
  }

  private formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.body.scrollTop = this.body.scrollHeight;
    });
  }
}

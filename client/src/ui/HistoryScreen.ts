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
      max-width: 1200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-2xl, 1rem);
      box-shadow: var(--shadow-modal), 0 0 0 1px rgba(51, 65, 85, 0.15);
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

    /* Main content area */
    .hs-content {
      display: flex;
      flex: 1;
      overflow: hidden;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-lg);
    }

    .hs-main-section {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .hs-stats-sidebar {
      width: 280px;
      flex-shrink: 0;
      overflow-y: auto;
      padding-right: var(--space-xs);
    }

    .hs-stats-sidebar::-webkit-scrollbar {
      width: 6px;
    }
    .hs-stats-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }
    .hs-stats-sidebar::-webkit-scrollbar-thumb {
      background: var(--pg-slate-600);
      border-radius: var(--radius-pill);
    }

    .hs-section-title {
      font-family: var(--font-family);
      font-size: var(--font-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 var(--space-md);
      padding-bottom: var(--space-sm);
      border-bottom: 1px solid rgba(51, 65, 85, 0.2);
    }

    /* Move list */
    .hs-move-list {
      flex: 1;
      overflow-y: auto;
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
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
    }

    .hs-empty-icon {
      font-size: 3rem;
      opacity: 0.5;
    }

    .hs-move-entry {
      border-radius: var(--radius-lg);
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(51, 65, 85, 0.25);
      overflow: hidden;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .hs-move-entry:hover {
      background: rgba(15, 23, 42, 0.7);
      border-color: rgba(51, 65, 85, 0.4);
    }

    .hs-move-entry + .hs-move-entry {
      margin-top: var(--space-sm);
    }

    .hs-move-header {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-sm) var(--space-md);
      cursor: pointer;
      user-select: none;
      min-height: 48px;
    }

    .hs-move-details {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
      background: rgba(0, 0, 0, 0.25);
      border-top: 1px solid rgba(51, 65, 85, 0.2);
    }

    .hs-move-details.expanded {
      max-height: 500px;
    }

    .hs-move-details-inner {
      padding: var(--space-sm);
    }

    .hs-chevron {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
      color: var(--text-muted);
      font-size: var(--font-base);
    }

    .hs-chevron.expanded {
      transform: rotate(180deg);
    }

    .hs-move-turn {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-family);
      font-size: var(--font-sm);
      font-weight: 800;
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

    .hs-move-turn.hs-player-4 {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.1));
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .hs-move-turn.hs-player-5 {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(6, 182, 212, 0.1));
      border: 1px solid rgba(6, 182, 212, 0.3);
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
    .hs-move-player.hs-player-4 { color: rgba(239, 68, 68, 0.9); }
    .hs-move-player.hs-player-5 { color: rgba(6, 182, 212, 0.9); }

    .hs-move-desc {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      color: var(--text-secondary);
      margin: 2px 0 0;
      line-height: 1.5;
    }

    .hs-move-time {
      flex-shrink: 0;
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      white-space: nowrap;
    }

    .hs-detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--space-sm);
    }

    .hs-detail-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-2xs);
    }

    .hs-detail-label {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .hs-detail-value {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      color: var(--text-secondary);
      font-weight: 600;
    }

    /* Stats card */
    .hs-stats-card {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(51, 65, 85, 0.3);
      border-radius: var(--radius-lg);
      padding: var(--space-md) var(--space-lg);
      margin-bottom: var(--space-md);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .hs-stats-card-title {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 var(--space-md);
      padding-bottom: var(--space-sm);
      border-bottom: 1px solid rgba(51, 65, 85, 0.25);
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .hs-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-xs) 0;
    }

    .hs-stat-row + .hs-stat-row {
      border-top: 1px solid rgba(51, 65, 85, 0.15);
    }

    .hs-stat-label {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
    }

    .hs-stat-value {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      font-weight: 700;
      color: var(--text-secondary);
    }

    .hs-stat-bar-container {
      margin-top: var(--space-sm);
    }

    .hs-stat-bar-row {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-bottom: var(--space-sm);
    }

    .hs-stat-bar-label {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      min-width: 80px;
    }

    .hs-stat-bar-track {
      flex: 1;
      height: 8px;
      background: var(--bg-card-dark);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }

    .hs-stat-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--pg-blue-500), var(--pg-blue-600));
      border-radius: var(--radius-pill);
      transition: width 0.3s ease;
    }

    .hs-stat-bar-fill.player-0 {
      background: linear-gradient(90deg, var(--pg-blue-500), var(--pg-blue-600));
    }

    .hs-stat-bar-fill.player-1 {
      background: linear-gradient(90deg, var(--pg-amber-500), var(--pg-amber-600));
    }

    .hs-stat-bar-fill.player-2 {
      background: linear-gradient(90deg, rgba(168, 85, 247, 0.8), rgba(147, 51, 234, 0.9));
    }

    .hs-stat-bar-fill.player-3 {
      background: linear-gradient(90deg, var(--pg-green-500), var(--pg-green-600));
    }

    .hs-stat-bar-fill.player-4 {
      background: linear-gradient(90deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.9));
    }

    .hs-stat-bar-fill.player-5 {
      background: linear-gradient(90deg, rgba(6, 182, 212, 0.8), rgba(8, 145, 178, 0.9));
    }

    .hs-stat-bar-value {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      font-weight: 700;
      color: var(--text-primary);
      min-width: 30px;
      text-align: right;
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

    @media (max-width: 768px) {
      .hs-content {
        flex-direction: column;
      }

      .hs-stats-sidebar {
        width: 100%;
        max-height: 300px;
        order: 2;
      }

      .hs-main-section {
        order: 1;
      }
    }

    @media (max-width: 480px) {
      .hs-container {
        max-height: 100vh;
        border-radius: 0;
      }

      .hs-header {
        padding: var(--space-sm) var(--space-md);
      }

      .hs-title {
        font-size: var(--font-xl);
      }

      .hs-content {
        padding: var(--space-sm) var(--space-md);
      }

      .hs-stats-sidebar {
        max-height: 250px;
      }

      .hs-footer {
        padding: var(--space-sm) var(--space-md);
      }

      .hs-move-header {
        padding: var(--space-sm) var(--space-md);
      }

      .hs-detail-grid {
        grid-template-columns: 1fr;
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

    // ── Main content area ──
    const content = el("div", "hs-content");

    // Main section (move list)
    const mainSection = el("div", "hs-main-section");
    const sectionTitle = el("h3", "hs-section-title", `All Moves (${moveHistory.length})`);
    mainSection.appendChild(sectionTitle);

    const moveList = el("div", "hs-move-list");
    moveList.setAttribute("role", "list");

    if (moveHistory.length === 0) {
      const emptyState = el("div", "hs-empty");
      emptyState.appendChild(el("div", "hs-empty-icon", "📋"));
      emptyState.appendChild(el("p", undefined, "No moves were recorded for this game."));
      moveList.appendChild(emptyState);
    } else {
      for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i];
        const playerIdx = playerIndexMap.get(move.playerId) ?? 0;
        const entry = el("div", "hs-move-entry");
        entry.setAttribute("role", "listitem");

        // Header (clickable)
        const moveHeader = el("div", "hs-move-header");

        // Chevron
        const chevron = el("div", i === 0 ? "hs-chevron expanded" : "hs-chevron", "▼");
        moveHeader.appendChild(chevron);

        // Turn badge
        const turnBadge = el(
          "div",
          `hs-move-turn hs-player-${Math.min(playerIdx, 5)}`,
          `#${move.turnNumber}`,
        );
        moveHeader.appendChild(turnBadge);

        // Body
        const body = el("div", "hs-move-body");
        const playerLabel = el(
          "p",
          `hs-move-player hs-player-${Math.min(playerIdx, 5)}`,
          move.playerName,
        );
        body.appendChild(playerLabel);

        const desc = el("p", "hs-move-desc");
        desc.innerHTML = formatter.formatMove(move);
        body.appendChild(desc);

        moveHeader.appendChild(body);

        // Timestamp
        const time = el("span", "hs-move-time", formatTimestamp(move.timestamp));
        moveHeader.appendChild(time);

        entry.appendChild(moveHeader);

        // Details panel (expandable)
        const details = el("div", i === 0 ? "hs-move-details expanded" : "hs-move-details");
        const detailsInner = el("div", "hs-move-details-inner");
        const detailGrid = el("div", "hs-detail-grid");

        // Add structured detail items from formatter
        const detailItems = formatter.formatMoveDetails(move);
        for (const detail of detailItems) {
          const item = el("div", "hs-detail-item");
          item.appendChild(el("div", "hs-detail-label", detail.label));
          item.appendChild(el("div", "hs-detail-value", detail.value));
          detailGrid.appendChild(item);
        }

        detailsInner.appendChild(detailGrid);
        details.appendChild(detailsInner);
        entry.appendChild(details);

        // Toggle expand/collapse on click
        moveHeader.addEventListener("click", () => {
          const isExpanded = details.classList.contains("expanded");
          if (isExpanded) {
            details.classList.remove("expanded");
            chevron.classList.remove("expanded");
          } else {
            details.classList.add("expanded");
            chevron.classList.add("expanded");
          }
        });

        moveList.appendChild(entry);
      }
    }

    mainSection.appendChild(moveList);
    content.appendChild(mainSection);

    // Stats sidebar
    const sidebar = this.buildStatsSidebar(gameType, moveHistory, metadata, playerIndexMap);
    content.appendChild(sidebar);

    panel.appendChild(content);

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

  private buildStatsSidebar(
    gameType: string,
    moveHistory: MoveEntry[],
    metadata: Record<string, unknown> | undefined,
    playerIndexMap: Map<string, number>,
  ): HTMLElement {
    const sidebar = el("div", "hs-stats-sidebar");
    const meta = (metadata ?? {}) as Record<string, unknown>;

    // General stats card
    const generalCard = el("div", "hs-stats-card");
    const generalTitle = el("div", "hs-stats-card-title", "📊 Game Statistics");
    generalCard.appendChild(generalTitle);

    const totalMoves = moveHistory.length;
    if (totalMoves > 0) {
      generalCard.appendChild(this.buildStatRow("Total Moves", String(totalMoves)));
    }

    if (typeof meta.durationSeconds === "number") {
      generalCard.appendChild(
        this.buildStatRow("Duration", formatDuration(meta.durationSeconds as number)),
      );

      if (totalMoves > 0) {
        const avg = Math.round((meta.durationSeconds as number) / totalMoves);
        generalCard.appendChild(this.buildStatRow("Avg Move Time", `${avg}s`));
      }
    }

    sidebar.appendChild(generalCard);

    // Game-specific stats
    if (gameType === "checkers") {
      this.addCheckersStats(sidebar, moveHistory, playerIndexMap, meta);
    } else if (gameType === "backgammon") {
      this.addBackgammonStats(sidebar, moveHistory, playerIndexMap, meta);
    } else if (gameType === "dominos") {
      this.addDominosStats(sidebar, moveHistory, playerIndexMap, meta);
    } else if (gameType === "risk") {
      this.addRiskStats(sidebar, moveHistory, playerIndexMap, meta);
    }

    return sidebar;
  }

  private buildStatRow(label: string, value: string): HTMLElement {
    const row = el("div", "hs-stat-row");
    row.appendChild(el("div", "hs-stat-label", label));
    row.appendChild(el("div", "hs-stat-value", value));
    return row;
  }

  private addCheckersStats(
    sidebar: HTMLElement,
    moveHistory: MoveEntry[],
    playerIndexMap: Map<string, number>,
    meta: Record<string, unknown>,
  ): void {
    const card = el("div", "hs-stats-card");
    const title = el("div", "hs-stats-card-title", "👑 Checkers Stats");
    card.appendChild(title);

    // Kings created
    const kingsCreated = (meta.kingsCreated as number) ?? 0;
    card.appendChild(this.buildStatRow("Kings Created", String(kingsCreated)));

    sidebar.appendChild(card);

    // Captures comparison
    const capturesCard = el("div", "hs-stats-card");
    const capturesTitle = el("div", "hs-stats-card-title", "⚔️ Captures");
    capturesCard.appendChild(capturesTitle);

    const playerCapturesMap = new Map<string, number>();
    for (const move of moveHistory) {
      const captures = (move.payload as { captured?: unknown })?.captured;
      if (captures) {
        const current = playerCapturesMap.get(move.playerId) ?? 0;
        playerCapturesMap.set(move.playerId, current + 1);
      }
    }

    const playerIds = Array.from(playerIndexMap.keys());
    const maxCaptures = Math.max(...Array.from(playerCapturesMap.values()), 1);

    const barContainer = el("div", "hs-stat-bar-container");
    for (const playerId of playerIds) {
      const playerIdx = playerIndexMap.get(playerId) ?? 0;
      const playerName = moveHistory.find((m) => m.playerId === playerId)?.playerName ?? "Player";
      const captures = playerCapturesMap.get(playerId) ?? 0;

      barContainer.appendChild(
        this.buildStatBar(playerName, captures, maxCaptures, playerIdx),
      );
    }

    capturesCard.appendChild(barContainer);
    sidebar.appendChild(capturesCard);
  }

  private addBackgammonStats(
    sidebar: HTMLElement,
    moveHistory: MoveEntry[],
    playerIndexMap: Map<string, number>,
    meta: Record<string, unknown>,
  ): void {
    const card = el("div", "hs-stats-card");
    const title = el("div", "hs-stats-card-title", "🎲 Backgammon Stats");
    card.appendChild(title);

    const doublesRolled = (meta.doublesRolled as number) ?? 0;
    card.appendChild(this.buildStatRow("Doubles Rolled", String(doublesRolled)));

    sidebar.appendChild(card);

    // Hits comparison
    const hitsCard = el("div", "hs-stats-card");
    const hitsTitle = el("div", "hs-stats-card-title", "⚔️ Hits");
    hitsCard.appendChild(hitsTitle);

    const playerHitsMap = new Map<string, number>();
    for (const move of moveHistory) {
      const hit = (move.payload as { hit?: boolean })?.hit;
      if (hit) {
        const current = playerHitsMap.get(move.playerId) ?? 0;
        playerHitsMap.set(move.playerId, current + 1);
      }
    }

    const playerIds = Array.from(playerIndexMap.keys());
    const maxHits = Math.max(...Array.from(playerHitsMap.values()), 1);

    const barContainer = el("div", "hs-stat-bar-container");
    for (const playerId of playerIds) {
      const playerIdx = playerIndexMap.get(playerId) ?? 0;
      const playerName = moveHistory.find((m) => m.playerId === playerId)?.playerName ?? "Player";
      const hits = playerHitsMap.get(playerId) ?? 0;

      barContainer.appendChild(this.buildStatBar(playerName, hits, maxHits, playerIdx));
    }

    hitsCard.appendChild(barContainer);
    sidebar.appendChild(hitsCard);
  }

  private addDominosStats(
    sidebar: HTMLElement,
    moveHistory: MoveEntry[],
    playerIndexMap: Map<string, number>,
    _meta: Record<string, unknown>,
  ): void {
    const card = el("div", "hs-stats-card");
    const title = el("div", "hs-stats-card-title", "🎴 Dominos Stats");
    card.appendChild(title);

    // Count tiles played and passes per player
    const playerIds = Array.from(playerIndexMap.keys());
    const tilesPlayedMap = new Map<string, number>();
    const passesMap = new Map<string, number>();

    for (const move of moveHistory) {
      if (move.actionType === "play") {
        const current = tilesPlayedMap.get(move.playerId) ?? 0;
        tilesPlayedMap.set(move.playerId, current + 1);
      } else if (move.actionType === "pass") {
        const current = passesMap.get(move.playerId) ?? 0;
        passesMap.set(move.playerId, current + 1);
      }
    }

    const maxTiles = Math.max(...Array.from(tilesPlayedMap.values()), 1);

    const barContainer = el("div", "hs-stat-bar-container");
    for (const playerId of playerIds) {
      const playerIdx = playerIndexMap.get(playerId) ?? 0;
      const playerName = moveHistory.find((m) => m.playerId === playerId)?.playerName ?? "Player";
      const tilesPlayed = tilesPlayedMap.get(playerId) ?? 0;

      barContainer.appendChild(this.buildStatBar(playerName, tilesPlayed, maxTiles, playerIdx));
    }

    card.appendChild(barContainer);
    sidebar.appendChild(card);

    // Pass counts
    const totalPasses = Array.from(passesMap.values()).reduce((a, b) => a + b, 0);
    if (totalPasses > 0) {
      const passCard = el("div", "hs-stats-card");
      const passTitle = el("div", "hs-stats-card-title", "🚫 Passes");
      passCard.appendChild(passTitle);
      passCard.appendChild(this.buildStatRow("Total Passes", String(totalPasses)));
      sidebar.appendChild(passCard);
    }
  }

  private addRiskStats(
    sidebar: HTMLElement,
    moveHistory: MoveEntry[],
    _playerIndexMap: Map<string, number>,
    _meta: Record<string, unknown>,
  ): void {
    const card = el("div", "hs-stats-card");
    const title = el("div", "hs-stats-card-title", "🌍 Risk Stats");
    card.appendChild(title);

    // Count action types
    const attackCount = moveHistory.filter((m) => m.actionType === "attack").length;
    const fortifyCount = moveHistory.filter((m) => m.actionType === "fortify").length;
    const reinforceCount = moveHistory.filter((m) => m.actionType === "placeArmy").length;
    const pickCount = moveHistory.filter((m) => m.actionType === "pickTerritory").length;
    const tradeCount = moveHistory.filter((m) => m.actionType === "tradeCards").length;

    if (pickCount > 0) card.appendChild(this.buildStatRow("Territory Picks", String(pickCount)));
    if (reinforceCount > 0) card.appendChild(this.buildStatRow("Reinforcements", String(reinforceCount)));
    card.appendChild(this.buildStatRow("Total Attacks", String(attackCount)));
    card.appendChild(this.buildStatRow("Total Fortifies", String(fortifyCount)));
    if (tradeCount > 0) card.appendChild(this.buildStatRow("Card Trades", String(tradeCount)));

    sidebar.appendChild(card);
  }

  private buildStatBar(
    label: string,
    value: number,
    maxValue: number,
    playerIdx: number,
  ): HTMLElement {
    const row = el("div", "hs-stat-bar-row");
    row.appendChild(el("div", "hs-stat-bar-label", label));

    const track = el("div", "hs-stat-bar-track");
    const fill = el("div", `hs-stat-bar-fill player-${Math.min(playerIdx, 5)}`);
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    fill.style.width = `${percentage}%`;
    track.appendChild(fill);
    row.appendChild(track);

    row.appendChild(el("div", "hs-stat-bar-value", String(value)));
    return row;
  }

}

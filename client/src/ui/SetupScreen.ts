import type { Room } from "@colyseus/sdk";
import { buildJoinGameHref } from "../joinLinks";
import type { ConsoleLog } from "./ConsoleLog";
import {
  ADD_CPU_PLAYER,
  CREATE_GAME,
  GAME_JOINED,
  GAME_PLAYERS,
  GAME_STARTED,
  LEAVE_GAME,
  LOBBY_ERROR,
  REMOVE_CPU_PLAYER,
  SET_READY,
  START_GAME,
  type CreateGamePayload,
  type GameJoinedPayload,
  type GameSessionInfo,
  type LobbyErrorPayload,
} from "./LobbyScreen";
import type { GamePlayersPayload, GameStartedPayload, PreGamePlayerInfo, SetReadyPayload } from "./WaitingRoom";
import {
  type SetupConfigPanel,
  createCheckersSetupConfig,
  createBackgammonSetupConfig,
  createRiskSetupConfig,
  createDominosSetupConfig,
} from "./setup";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLE_ID = "playgrid-setup-screen-styles";

const GAME_LABELS: Record<string, string> = {
  checkers: "Checkers",
  backgammon: "Backgammon",
  risk: "Risk",
  dominos: "Dominos",
};

const GAME_PLAYER_LABELS: Record<string, string> = {
  checkers: "2 Players",
  backgammon: "2 Players",
  risk: "2–6 Players",
  dominos: "2–4 Players",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetupScreenMode = "create" | "waiting";

export type SetupScreenEvent =
  | { type: "leave" }
  | { type: "game_started"; gameId: string; roomId: string; gameType: string };

type SetupScreenEventCallback = (event: SetupScreenEvent) => void;

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

function createConfigPanel(gameType: string): SetupConfigPanel {
  switch (gameType) {
    case "checkers":
      return createCheckersSetupConfig();
    case "backgammon":
      return createBackgammonSetupConfig();
    case "risk":
      return createRiskSetupConfig();
    case "dominos":
      return createDominosSetupConfig();
    default:
      return createCheckersSetupConfig();
  }
}

// ---------------------------------------------------------------------------
// Style injection (same pattern as PlayerInfoBar)
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* ===== Setup Screen Overlay ===== */
    #setup-overlay {
      position: fixed;
      inset: 0;
      display: none;
      z-index: 10;
      overflow-y: auto;
      background: var(--gradient-page);
    }
    #setup-overlay.visible {
      display: block;
    }

    .setup-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: var(--font-family);
      color: var(--text-primary);
    }

    /* ===== Header ===== */
    .setup-header {
      border-bottom: 1px solid var(--border-light);
      background: var(--glass-bg-strong);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
    }
    .setup-header-inner {
      max-width: 80rem;
      margin: 0 auto;
      padding: var(--space-md) var(--space-lg);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .setup-header-left {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }
    .setup-back-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      font-size: var(--font-lg);
    }
    .setup-back-btn:hover {
      background: var(--bg-card);
      color: var(--text-primary);
    }
    .setup-title-group h1 {
      font-size: var(--font-2xl);
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
    }
    .setup-title-group p {
      font-size: var(--font-sm);
      color: var(--text-muted);
      margin: 2px 0 0;
    }
    .setup-player-count {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-sm);
      color: var(--text-muted);
    }

    /* ===== Content grid ===== */
    .setup-content {
      max-width: 80rem;
      margin: 0 auto;
      padding: var(--space-xl) var(--space-lg);
      width: 100%;
      box-sizing: border-box;
    }
    .setup-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: var(--space-lg);
    }
    .setup-main {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }
    .setup-sidebar {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    /* ===== Glass panels ===== */
    .setup-panel {
      border-radius: var(--radius-xl);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      padding: var(--space-lg);
      box-shadow: var(--shadow-card);
      border: 1px solid var(--border-light);
    }
    .setup-panel-header {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      margin-bottom: var(--space-md);
    }
    .setup-panel-icon {
      font-size: var(--font-lg);
    }
    .setup-panel-title {
      font-size: var(--font-lg);
      font-weight: 700;
      margin: 0;
    }

    /* ===== Config panels container ===== */
    .setup-config-panels {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    /* ===== Option group ===== */
    .setup-option-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
    .setup-option-btn {
      width: 100%;
      border-radius: var(--radius-lg);
      padding: var(--space-sm) var(--space-md);
      border: 1px solid transparent;
      background: var(--bg-card-dark);
      color: var(--text-secondary);
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
      font-family: var(--font-family);
    }
    .setup-option-btn:hover:not(:disabled) {
      background: var(--bg-card);
    }
    .setup-option-btn.selected {
      background: var(--accent-primary);
      color: var(--text-primary);
      border-color: var(--accent-highlight);
      box-shadow: 0 0 0 2px var(--accent-highlight);
    }
    .setup-option-btn:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .setup-option-btn-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .setup-option-btn-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .setup-option-label {
      font-size: var(--font-base);
      font-weight: 600;
    }
    .setup-option-desc {
      font-size: var(--font-sm);
      opacity: 0.8;
    }
    .setup-option-trailing {
      font-size: var(--font-xl);
      font-family: monospace;
      font-weight: 600;
    }

    /* ===== Toggle row ===== */
    .setup-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-lg);
      background: var(--bg-card-dark);
      cursor: pointer;
      gap: var(--space-md);
    }
    .setup-toggle-row.read-only {
      opacity: 0.6;
      cursor: default;
    }
    .setup-toggle-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .setup-toggle-label {
      font-size: var(--font-base);
      font-weight: 600;
      color: var(--text-primary);
    }
    .setup-toggle-desc {
      font-size: var(--font-sm);
      color: var(--text-muted);
    }
    .setup-toggle-input {
      width: 20px;
      height: 20px;
      accent-color: var(--accent-primary);
      flex-shrink: 0;
    }

    /* ===== Stepper ===== */
    .setup-stepper {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
    .setup-stepper + .setup-stepper {
      margin-top: var(--space-md);
    }
    .setup-stepper-label {
      font-size: var(--font-sm);
      color: var(--text-secondary);
    }
    .setup-stepper-controls {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }
    .setup-stepper-btn {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-lg);
      border: none;
      background: var(--bg-card);
      color: var(--text-primary);
      cursor: pointer;
      font-size: var(--font-lg);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      font-family: var(--font-family);
    }
    .setup-stepper-btn:hover:not(:disabled) {
      background: var(--pg-slate-600);
    }
    .setup-stepper-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .setup-stepper-display {
      flex: 1;
      text-align: center;
      padding: var(--space-xs) 0;
      border-radius: var(--radius-lg);
      background: var(--bg-card-dark);
      color: var(--text-primary);
      font-weight: 600;
    }

    /* ===== Game name input ===== */
    .setup-name-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }
    .setup-name-label {
      font-size: var(--font-sm);
      color: var(--text-secondary);
      font-weight: 600;
    }
    .setup-name-input {
      width: 100%;
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-default);
      background: var(--bg-card-dark);
      color: var(--text-primary);
      font-size: var(--font-base);
      font-family: var(--font-family);
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s;
    }
    .setup-name-input:focus {
      border-color: var(--accent-primary);
    }
    .setup-name-input:disabled {
      opacity: 0.6;
    }

    /* ===== Player list ===== */
    .setup-player-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }
    .setup-player-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md);
      border-radius: var(--radius-xl);
      background: var(--bg-card-dark);
      border: 1px solid var(--border-light);
    }
    .setup-player-left {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }
    .setup-player-avatar {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
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
    .setup-player-avatar.host {
      background: linear-gradient(135deg, var(--pg-blue-500), var(--pg-blue-600));
    }
    .setup-player-avatar.cpu {
      font-size: var(--font-xl);
    }
    .setup-player-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .setup-player-name-row {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }
    .setup-player-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    .setup-player-chip {
      font-size: var(--font-xs);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--accent-soft);
      color: var(--accent-highlight);
      font-weight: 600;
    }
    .setup-player-role {
      font-size: var(--font-sm);
      color: var(--text-muted);
    }
    .setup-ready-badge {
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      font-size: var(--font-sm);
      font-weight: 600;
    }
    .setup-ready-badge.ready {
      background: var(--status-playing-bg);
      color: var(--status-playing-text);
      border: 1px solid rgba(34, 197, 94, 0.35);
    }
    .setup-ready-badge.not-ready {
      background: var(--status-waiting-bg);
      color: var(--status-waiting-text);
      border: 1px solid rgba(245, 158, 11, 0.25);
    }
    .setup-empty-slot {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-xs);
      padding: var(--space-md);
      border-radius: var(--radius-xl);
      border: 2px dashed var(--border-default);
      color: var(--text-muted);
      font-size: var(--font-sm);
    }
    .setup-add-cpu-slot {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-md);
      border-radius: var(--radius-xl);
      border: 2px dashed rgba(255, 255, 255, 0.2);
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .setup-add-cpu-slot:hover {
      border-color: rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.05);
    }
    .setup-add-cpu-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: var(--font-sm);
      cursor: pointer;
      padding: 0;
      font-family: inherit;
      transition: color 0.15s;
    }
    .setup-add-cpu-slot:hover .setup-add-cpu-btn {
      color: var(--text-primary);
    }
    .setup-remove-cpu-btn {
      background: none;
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: #f87171;
      font-size: var(--font-xs);
      line-height: 1;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s, border-color 0.15s;
      font-family: inherit;
    }
    .setup-remove-cpu-btn:hover {
      background: rgba(248, 113, 113, 0.15);
      border-color: rgba(248, 113, 113, 0.5);
    }

    /* ===== Invite section ===== */
    .setup-invite-section {
      margin-top: var(--space-md);
    }
    .setup-invite-title {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--text-secondary);
      margin: 0 0 var(--space-xs);
    }
    .setup-invite-row {
      display: flex;
      gap: var(--space-xs);
    }
    .setup-invite-input {
      flex: 1;
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-card-dark);
      color: var(--text-primary);
      font-size: var(--font-sm);
      font-family: var(--font-family);
      outline: none;
    }
    .setup-copy-btn {
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-card);
      color: var(--text-primary);
      font-size: var(--font-sm);
      cursor: pointer;
      white-space: nowrap;
      font-family: var(--font-family);
      transition: background 0.15s;
    }
    .setup-copy-btn:hover {
      background: var(--pg-slate-600);
    }

    /* ===== Error banner ===== */
    .setup-error {
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-md);
      background: var(--notice-error-bg);
      border: 1px solid var(--notice-error-border);
      color: var(--notice-error-text);
      font-size: var(--font-sm);
      display: none;
    }
    .setup-error.visible {
      display: block;
    }

    /* ===== Action buttons ===== */
    .setup-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }
    .setup-action-btn {
      width: 100%;
      padding: var(--space-md);
      border-radius: var(--radius-xl);
      border: none;
      font-size: var(--font-lg);
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: var(--font-family);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-xs);
    }
    .setup-action-btn.primary {
      background: var(--gradient-button-primary);
      color: var(--text-primary);
    }
    .setup-action-btn.primary:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .setup-action-btn.start {
      background: linear-gradient(to right, #16a34a, #059669);
      color: white;
    }
    .setup-action-btn.start:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .setup-action-btn:disabled {
      background: var(--bg-card);
      color: var(--text-muted);
      cursor: not-allowed;
      transform: none;
      filter: none;
    }
    .setup-action-btn.secondary {
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border-default);
    }
    .setup-action-btn.secondary:hover {
      background: var(--pg-slate-600);
      color: var(--text-primary);
    }
    .setup-action-btn.ghost {
      background: transparent;
      color: var(--text-muted);
      font-size: var(--font-base);
      font-weight: 600;
      padding: var(--space-sm);
    }
    .setup-action-btn.ghost:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    /* ===== Pre-create placeholder ===== */
    .setup-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl) var(--space-lg);
      text-align: center;
      gap: var(--space-sm);
    }
    .setup-placeholder-icon {
      font-size: 3rem;
      opacity: 0.5;
    }
    .setup-placeholder-text {
      font-size: var(--font-base);
      color: var(--text-muted);
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .setup-grid {
        grid-template-columns: 1fr;
      }
      .setup-header-inner {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-sm);
      }
      .setup-player-count {
        align-self: flex-end;
      }
      .setup-invite-row {
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// SetupScreen
// ---------------------------------------------------------------------------

export class SetupScreen {
  private readonly overlay: HTMLElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly playerCountEl: HTMLElement;
  private readonly mainColumn: HTMLElement;
  private readonly sidebarColumn: HTMLElement;
  private readonly gameNameInput: HTMLInputElement;
  private readonly playerListEl: HTMLElement;
  private readonly inviteSection: HTMLElement;
  private readonly joinLinkInput: HTMLInputElement;
  private readonly copyBtn: HTMLButtonElement;
  private readonly errorEl: HTMLElement;
  private readonly actionsEl: HTMLElement;

  private room: Room | null = null;
  private boundRoom: Room | null = null;
  private gameType = "checkers";
  private gameId: string | null = null;
  private gameInfo: GameSessionInfo | null = null;
  private mode: SetupScreenMode = "create";
  private isHost = false;
  private isReady = false;
  private isCreatePending = false;
  private players: PreGamePlayerInfo[] = [];
  private configPanel: SetupConfigPanel | null = null;
  private consoleLog: ConsoleLog | null = null;
  private eventCallback: SetupScreenEventCallback | null = null;
  private createTimeoutId: number | null = null;

  constructor() {
    injectStyles();

    const overlay = document.getElementById("setup-overlay");
    if (!overlay) {
      throw new Error("Missing #setup-overlay");
    }

    this.overlay = overlay;
    this.overlay.textContent = "";

    const screen = el("div", "setup-screen");

    // Header
    const header = el("header", "setup-header");
    const headerInner = el("div", "setup-header-inner");
    const headerLeft = el("div", "setup-header-left");

    const backBtn = el("button", "setup-back-btn") as HTMLButtonElement;
    backBtn.type = "button";
    backBtn.textContent = "←";
    backBtn.title = "Back to Lobby";
    backBtn.addEventListener("click", () => this.leave());

    const titleGroup = el("div", "setup-title-group");
    this.titleEl = el("h1", undefined, "Game Setup") as HTMLHeadingElement;
    this.subtitleEl = el("p", undefined, "Configure your match settings") as HTMLParagraphElement;
    titleGroup.append(this.titleEl, this.subtitleEl);
    headerLeft.append(backBtn, titleGroup);

    this.playerCountEl = el("div", "setup-player-count");
    headerInner.append(headerLeft, this.playerCountEl);
    header.append(headerInner);

    // Content
    const content = el("div", "setup-content");
    const grid = el("div", "setup-grid");

    this.mainColumn = el("div", "setup-main");
    this.sidebarColumn = el("div", "setup-sidebar");

    // -- Main column: game name + players panel --
    const namePanel = el("div", "setup-panel");
    const nameField = el("div", "setup-name-field");
    const nameLabel = el("label", "setup-name-label", "Game Name");
    this.gameNameInput = el("input", "setup-name-input") as HTMLInputElement;
    this.gameNameInput.type = "text";
    this.gameNameInput.placeholder = "My awesome game";
    this.gameNameInput.maxLength = 32;
    nameField.append(nameLabel, this.gameNameInput);
    namePanel.append(nameField);
    this.mainColumn.append(namePanel);

    const playersPanel = el("div", "setup-panel");
    const playersHeader = el("div", "setup-panel-header");
    playersHeader.append(el("h3", "setup-panel-title", "Players"));
    this.playerListEl = el("div", "setup-player-list");
    this.errorEl = el("div", "setup-error");

    // Invite section
    this.inviteSection = el("div", "setup-invite-section");
    const inviteTitle = el("p", "setup-invite-title", "Invite Players");
    const inviteRow = el("div", "setup-invite-row");
    this.joinLinkInput = el("input", "setup-invite-input") as HTMLInputElement;
    this.joinLinkInput.type = "text";
    this.joinLinkInput.readOnly = true;
    this.joinLinkInput.setAttribute("aria-label", "Join link");
    this.joinLinkInput.addEventListener("focus", () => this.joinLinkInput.select());
    this.joinLinkInput.addEventListener("click", () => this.joinLinkInput.select());

    this.copyBtn = el("button", "setup-copy-btn", "Copy Link") as HTMLButtonElement;
    this.copyBtn.type = "button";
    this.copyBtn.addEventListener("click", () => {
      void this.copyJoinLink();
    });

    inviteRow.append(this.joinLinkInput, this.copyBtn);
    this.inviteSection.append(inviteTitle, inviteRow);
    this.inviteSection.style.display = "none";

    playersPanel.append(playersHeader, this.playerListEl, this.errorEl, this.inviteSection);
    this.mainColumn.append(playersPanel);

    // -- Sidebar: config panels + action buttons --
    // Config panels inserted dynamically
    this.actionsEl = el("div", "setup-actions");
    this.sidebarColumn.append(this.actionsEl);

    grid.append(this.mainColumn, this.sidebarColumn);
    content.append(grid);
    screen.append(header, content);
    this.overlay.append(screen);
  }

  onEvent(callback: SetupScreenEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Show in "create" mode — host configures a new game.
   */
  showCreate(room: Room, gameType: string): void {
    this.room = room;
    this.gameType = gameType;
    this.gameId = null;
    this.gameInfo = null;
    this.mode = "create";
    this.isHost = true;
    this.isReady = false;
    this.isCreatePending = false;
    this.players = [];

    this.bindRoom(room);
    this.buildConfigPanel(gameType);
    this.updateHeader();
    this.renderPlayerList();
    this.renderActions();
    this.gameNameInput.disabled = false;
    this.gameNameInput.value = "";
    this.inviteSection.style.display = "none";
    this.clearError();
    this.overlay.classList.add("visible");
    this.gameNameInput.focus();
  }

  /**
   * Show in "waiting" mode — after creating or joining a game.
   */
  showWaiting(room: Room, gameId: string, gameInfo: GameSessionInfo | null, isHost: boolean): void {
    this.room = room;
    this.gameType = gameInfo?.gameType ?? "checkers";
    this.gameId = gameId;
    this.gameInfo = gameInfo;
    this.mode = "waiting";
    this.isHost = isHost;
    this.isReady = false;
    this.isCreatePending = false;
    this.players = [];

    this.bindRoom(room);
    this.buildConfigPanel(this.gameType);
    this.configPanel?.setReadOnly(true);
    this.updateHeader();
    this.gameNameInput.value = gameInfo?.name ?? "";
    this.gameNameInput.disabled = true;
    this.renderPlayerList();
    this.renderActions();
    this.updateJoinLink();
    this.updateInviteVisibility();
    this.clearError();
    this.overlay.classList.add("visible");
  }

  hide(): void {
    this.overlay.classList.remove("visible");
    this.room = null;
    this.gameId = null;
    this.gameInfo = null;
    this.isHost = false;
    this.isReady = false;
    this.isCreatePending = false;
    this.players = [];
    this.clearCreateTimeout();
    this.clearError();
  }

  // ---------------------------------------------------------------------------
  // Room binding
  // ---------------------------------------------------------------------------

  private bindRoom(room: Room): void {
    if (this.boundRoom === room) return;
    this.boundRoom = room;

    room.onMessage(GAME_JOINED, (payload: GameJoinedPayload) => {
      if (this.mode !== "create" || !this.isCreatePending) return;

      this.clearCreateTimeout();
      this.isCreatePending = false;
      this.gameId = payload.gameId;

      // If payload has roomId, game is already started (e.g. head-to-head) — join directly
      if (payload.roomId) {
        this.hide();
        this.eventCallback?.({
          type: "game_started",
          gameId: payload.gameId,
          roomId: payload.roomId,
          gameType: this.gameType,
        });
        return;
      }

      // Transition to waiting mode
      this.mode = "waiting";
      this.configPanel?.setReadOnly(true);
      this.gameNameInput.disabled = true;
      this.updateJoinLink();
      this.updateInviteVisibility();
      this.renderActions();
    });

    room.onMessage(GAME_PLAYERS, (payload: GamePlayersPayload) => {
      if (payload.gameId !== this.gameId) return;

      this.players = payload.players;
      const localPlayer = this.players.find((p) => p.userId === room.sessionId);
      this.isReady = localPlayer?.isReady ?? this.isReady;
      this.clearError();
      this.renderPlayerList();
      this.renderActions();
      this.updateInviteVisibility();
      this.updatePlayerCountHeader();
    });

    room.onMessage(GAME_STARTED, (payload: GameStartedPayload) => {
      if (payload.gameId !== this.gameId) return;

      this.hide();
      this.eventCallback?.({
        type: "game_started",
        gameId: payload.gameId,
        roomId: payload.roomId,
        gameType: payload.gameType,
      });
    });

    room.onMessage(LOBBY_ERROR, (payload: LobbyErrorPayload) => {
      if (this.isCreatePending) {
        this.clearCreateTimeout();
        this.isCreatePending = false;
        this.renderActions();
      }
      this.consoleLog?.error(payload.message);
    });
  }

  setConsoleLog(log: ConsoleLog): void {
    this.consoleLog = log;
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  private updateHeader(): void {
    const label = GAME_LABELS[this.gameType] ?? this.gameType;
    this.titleEl.textContent = `${label} — Game Setup`;
    this.subtitleEl.textContent = this.mode === "create"
      ? "Configure your match settings"
      : this.isHost
        ? "You are hosting. Start when everyone is ready."
        : "Toggle Ready when you are set to play.";
    this.updatePlayerCountHeader();
  }

  private updatePlayerCountHeader(): void {
    const label = GAME_PLAYER_LABELS[this.gameType] ?? "";
    if (this.mode === "waiting" && this.gameInfo) {
      this.playerCountEl.textContent = `👥 ${this.players.length}/${this.gameInfo.maxPlayers}`;
    } else {
      this.playerCountEl.textContent = `👥 ${label}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Config panel
  // ---------------------------------------------------------------------------

  private buildConfigPanel(gameType: string): void {
    this.configPanel?.destroy();

    this.configPanel = createConfigPanel(gameType);

    // Insert config panel at the start of the sidebar (before actions)
    this.sidebarColumn.insertBefore(this.configPanel.element, this.actionsEl);
  }

  // ---------------------------------------------------------------------------
  // Player list
  // ---------------------------------------------------------------------------

  private renderPlayerList(): void {
    this.playerListEl.textContent = "";

    if (this.mode === "create") {
      // Show placeholder in create mode
      const placeholder = el("div", "setup-placeholder");
      placeholder.append(
        el("div", "setup-placeholder-icon", "🎮"),
        el("div", "setup-placeholder-text", "Configure your game settings and click Create Game to begin."),
      );
      this.playerListEl.append(placeholder);
      return;
    }

    if (this.players.length === 0) {
      const placeholder = el("div", "setup-placeholder");
      placeholder.append(
        el("div", "setup-placeholder-icon", "⏳"),
        el("div", "setup-placeholder-text", "Waiting for player updates…"),
      );
      this.playerListEl.append(placeholder);
      return;
    }

    const hostId = this.gameInfo?.hostId ?? "";
    const sorted = [...this.players].sort((a, b) => {
      const aHost = a.userId === hostId ? 1 : 0;
      const bHost = b.userId === hostId ? 1 : 0;
      return bHost - aHost;
    });

    for (const player of sorted) {
      this.playerListEl.append(this.buildPlayerCard(player, hostId));
    }

    // Add CPU Player slot or empty slots
    const maxPlayers = this.gameInfo?.maxPlayers ?? 0;
    const emptySlots = Math.max(0, maxPlayers - this.players.length);
    const hasCpu = this.players.some((p) => p.isCPU);

    if (
      emptySlots > 0 &&
      this.isHost &&
      this.supportsCpuOpponent() &&
      !hasCpu
    ) {
      // First empty slot becomes an "Add CPU" button
      const cpuSlot = el("div", "setup-add-cpu-slot");
      const addBtn = el("button", "setup-add-cpu-btn", "🤖 Add CPU Player") as HTMLButtonElement;
      addBtn.type = "button";
      addBtn.addEventListener("click", () => {
        this.room?.send(ADD_CPU_PLAYER, { gameId: this.gameId });
      });
      cpuSlot.append(addBtn);
      this.playerListEl.append(cpuSlot);

      // Remaining empty slots
      for (let i = 1; i < emptySlots; i++) {
        const slot = el("div", "setup-empty-slot");
        slot.textContent = "Waiting for player…";
        this.playerListEl.append(slot);
      }
    } else {
      for (let i = 0; i < emptySlots; i++) {
        const slot = el("div", "setup-empty-slot");
        slot.textContent = "Waiting for player…";
        this.playerListEl.append(slot);
      }
    }
  }

  private buildPlayerCard(player: PreGamePlayerInfo, hostId: string): HTMLElement {
    const card = el("div", "setup-player-card");
    const left = el("div", "setup-player-left");

    const isPlayerHost = player.userId === hostId;
    const isLocal = player.userId === this.room?.sessionId;

    const avatar = el("div", "setup-player-avatar");
    if (player.isCPU) {
      avatar.classList.add("cpu");
      avatar.textContent = "🤖";
    } else {
      if (isPlayerHost) avatar.classList.add("host");
      avatar.textContent = (player.displayName || "P").charAt(0).toUpperCase();
    }

    const info = el("div", "setup-player-info");
    const nameRow = el("div", "setup-player-name-row");
    nameRow.append(el("span", "setup-player-name", player.displayName || "Player"));

    if (isPlayerHost) {
      nameRow.append(el("span", "setup-player-chip", "Host"));
    }
    if (isLocal) {
      nameRow.append(el("span", "setup-player-chip", "You"));
    }
    if (player.isCPU) {
      nameRow.append(el("span", "setup-player-chip", "CPU"));
      if (this.isHost) {
        const removeBtn = el("button", "setup-remove-cpu-btn", "✕") as HTMLButtonElement;
        removeBtn.type = "button";
        removeBtn.title = "Remove CPU player";
        removeBtn.addEventListener("click", () => {
          this.room?.send(REMOVE_CPU_PLAYER, { gameId: this.gameId });
        });
        nameRow.append(removeBtn);
      }
    }

    info.append(nameRow);
    left.append(avatar, info);

    const badge = el("span", `setup-ready-badge ${player.isReady ? "ready" : "not-ready"}`);
    badge.textContent = player.isReady ? "Ready" : "Not Ready";

    card.append(left, badge);
    return card;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private renderActions(): void {
    this.actionsEl.textContent = "";

    if (this.mode === "create") {
      const createBtn = el("button", "setup-action-btn primary") as HTMLButtonElement;
      createBtn.type = "button";
      createBtn.textContent = this.isCreatePending ? "Creating…" : "▶ Create Game";
      createBtn.disabled = this.isCreatePending;
      createBtn.addEventListener("click", () => this.handleCreateGame());
      this.actionsEl.append(createBtn);
    } else if (this.isHost) {
      const startBtn = el("button", "setup-action-btn start") as HTMLButtonElement;
      startBtn.type = "button";
      const canStart = this.canStartGame();
      startBtn.textContent = canStart ? "▶ Start Game" : "Waiting for players…";
      startBtn.disabled = !canStart;
      startBtn.addEventListener("click", () => this.startGame());
      this.actionsEl.append(startBtn);
    } else {
      const readyBtn = el("button", `setup-action-btn ${this.isReady ? "secondary" : "primary"}`) as HTMLButtonElement;
      readyBtn.type = "button";
      readyBtn.textContent = this.isReady ? "Not Ready" : "✓ Ready";
      readyBtn.addEventListener("click", () => this.toggleReady());
      this.actionsEl.append(readyBtn);
    }

    const leaveBtn = el("button", "setup-action-btn ghost") as HTMLButtonElement;
    leaveBtn.type = "button";
    leaveBtn.textContent = "← Back to Lobby";
    leaveBtn.addEventListener("click", () => this.leave());
    this.actionsEl.append(leaveBtn);
  }

  // ---------------------------------------------------------------------------
  // Game actions
  // ---------------------------------------------------------------------------

  private handleCreateGame(): void {
    if (!this.room || this.isCreatePending) return;

    const overrides = this.configPanel?.getPayloadOverrides() ?? {};
    const payload: CreateGamePayload = {
      name: this.gameNameInput.value.trim() || this.gameNameInput.placeholder || "New game",
      gameType: this.gameType,
      ...overrides,
    };

    this.isCreatePending = true;
    this.renderActions();
    this.room.send(CREATE_GAME, payload);

    // Auto-ready after creation (handled by server when host creates)
    this.createTimeoutId = window.setTimeout(() => {
      this.isCreatePending = false;
      this.consoleLog?.error("Game creation timed out. Try again.");
      this.renderActions();
    }, 30_000);
  }

  private toggleReady(): void {
    if (!this.room) return;
    this.isReady = !this.isReady;
    const payload: SetReadyPayload = { ready: this.isReady };
    this.room.send(SET_READY, payload);
    this.renderActions();
  }

  private startGame(): void {
    if (!this.room || !this.gameId) return;
    this.room.send(START_GAME, { gameId: this.gameId });
  }

  private leave(): void {
    if (this.room && this.gameId && this.mode === "waiting") {
      this.room.send(LEAVE_GAME, { gameId: this.gameId });
    }
    this.hide();
    this.eventCallback?.({ type: "leave" });
  }

  private canStartGame(): boolean {
    const hostId = this.gameInfo?.hostId ?? this.room?.sessionId ?? "";
    return (
      this.players.length > 0 &&
      this.players.every((p) => p.userId === hostId || p.isReady)
    );
  }

  private supportsCpuOpponent(): boolean {
    return this.gameType === "checkers" || this.gameType === "backgammon" || this.gameType === "dominos";
  }

  // ---------------------------------------------------------------------------
  // Invite link
  // ---------------------------------------------------------------------------

  private updateJoinLink(): void {
    const link = this.gameId ? buildJoinGameHref(window.location.href, this.gameId) : "";
    this.joinLinkInput.value = link;
    this.copyBtn.disabled = !link;
  }

  private updateInviteVisibility(): void {
    const hasCpu = this.players.some((p) => p.isCPU);
    const isFull = this.gameInfo != null && this.players.length >= this.gameInfo.maxPlayers;
    this.inviteSection.style.display = this.mode === "waiting" && !hasCpu && !isFull ? "" : "none";
  }

  private async copyJoinLink(): Promise<void> {
    const text = this.joinLinkInput.value;
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.append(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      this.copyBtn.textContent = "Copied!";
      window.setTimeout(() => {
        this.copyBtn.textContent = "Copy Link";
      }, 2000);
    } catch {
      this.joinLinkInput.select();
    }
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  private showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.classList.add("visible");
  }

  private clearError(): void {
    this.errorEl.textContent = "";
    this.errorEl.classList.remove("visible");
  }

  private clearCreateTimeout(): void {
    if (this.createTimeoutId !== null) {
      window.clearTimeout(this.createTimeoutId);
      this.createTimeoutId = null;
    }
  }
}

import type { Room } from "@colyseus/sdk";
import { MessageLog } from "./MessageLog.js";
import type { ConsoleLog } from "./ConsoleLog";

export const CREATE_GAME = "create_game" as const;
export const JOIN_GAME = "join_game" as const;
export const LEAVE_GAME = "leave_game" as const;
export const START_GAME = "start_game" as const;
export const SET_READY = "set_ready" as const;
export const GAME_LIST = "game_list" as const;
export const GAME_JOINED = "game_joined" as const;
export const GAME_UPDATED = "game_updated" as const;
export const GAME_REMOVED = "game_removed" as const;
export const GAME_STARTED = "game_started" as const;
export const GAME_PLAYERS = "game_players" as const;
export const LOBBY_ERROR = "lobby_error" as const;
export const ONLINE_PLAYERS = "online_players" as const;
export const LOBBY_LOG_EVENT = "lobby_log_event" as const;

export type GameStatus = "waiting" | "in_progress" | "ended";

export interface GameSessionInfo {
  id: string;
  name: string;
  gameType: string;
  hostId: string;
  hostName: string;
  status: GameStatus;
  playerCount: number;
  maxPlayers: number;
  mapSize: number;
  mapSeed: number;
  createdAt: number;
  cpuPlayers?: number;
  cpuOpponent?: boolean;
  headToHeadMode?: boolean;
}

export interface CreateGamePayload {
  name: string;
  gameType: string;
  maxPlayers?: number;
  mapSize?: number;
  mapSeed?: number;
  cpuPlayers?: number;
  cpuOpponent?: boolean;
  headToHeadMode?: boolean;
}

export interface JoinGamePayload {
  gameId: string;
}

export interface GameListPayload {
  games: GameSessionInfo[];
}

export interface GameUpdatedPayload {
  game: GameSessionInfo;
}

export interface GameRemovedPayload {
  gameId: string;
}

export interface GameJoinedPayload {
  gameId: string;
  roomId?: string;
}

export interface LobbyErrorPayload {
  message: string;
}

export interface OnlinePlayerInfo {
  userId: string;
  displayName: string;
  status: "in_lobby" | "in_game";
}

export interface OnlinePlayersPayload {
  players: OnlinePlayerInfo[];
}

export type LobbyEvent =
  | { type: "join_game"; gameId: string; roomId: string; gameType: string }
  | { type: "waiting"; gameId: string; gameInfo: GameSessionInfo | null; isHost: boolean }
  | { type: "setup"; gameType: string }
  | { type: "set_display_name"; displayName: string }
  | { type: "error"; message: string };

type LobbyFilter = "all" | "waiting" | "in_progress";
type NoticeTone = "info" | "error";
type LobbyEventCallback = (event: LobbyEvent) => void;

export type LobbyLogEventType =
  | "player_joined"
  | "player_left"
  | "game_created"
  | "game_started"
  | "game_finished"
  | "player_joined_game";

export interface LobbyLogEntry {
  timestamp: number;
  type: LobbyLogEventType;
  message: string;
  playerName?: string;
  gameName?: string;
  gameType?: string;
  winner?: string;
}

interface GameTypeOption {
  value: string;
  label: string;
  playerCountLabel: string;
  selectablePlayerCounts: number[];
}

const GAME_TYPE_OPTIONS: GameTypeOption[] = [
  {
    value: "checkers",
    label: "Checkers",
    playerCountLabel: "2 players",
    selectablePlayerCounts: [2],
  },
  {
    value: "backgammon",
    label: "Backgammon",
    playerCountLabel: "2 players",
    selectablePlayerCounts: [2],
  },
  {
    value: "risk",
    label: "Risk",
    playerCountLabel: "2-6 players",
    selectablePlayerCounts: [2, 3, 4, 5, 6],
  },
  {
    value: "dominos",
    label: "Dominos",
    playerCountLabel: "2-4 players",
    selectablePlayerCounts: [2, 3, 4],
  },
];
const MAX_DISPLAY_NAME_LENGTH = 24;

function getGameTypeOption(gameType: string): GameTypeOption {
  return GAME_TYPE_OPTIONS.find((option) => option.value === gameType) ?? GAME_TYPE_OPTIONS[0];
}

const GAME_TILE_ARTWORK: Record<string, string> = {
  checkers: "/game-thumbnails/checkers.jpg",
  backgammon: "/game-thumbnails/backgammon.jpg",
  risk: "/game-thumbnails/risk.jpg",
  dominos: "/game-thumbnails/dominos.jpg",
  default: "/game-thumbnails/checkers.jpg",
};

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

export class LobbyScreen {
  private readonly overlay: HTMLElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly notificationEl: HTMLDivElement;
  private readonly gameListBody: HTMLElement;
  private readonly playerNameInput: HTMLInputElement;
  private readonly gameNameInput: HTMLInputElement;
  private readonly gameTypeInput: HTMLSelectElement;
  private readonly maxPlayersInput: HTMLSelectElement;
  private readonly cpuOpponentInput: HTMLInputElement;
  private readonly headToHeadInput: HTMLInputElement;
  private readonly createButton: HTMLButtonElement;
  private readonly filterButtons = new Map<LobbyFilter, HTMLButtonElement>();
  private readonly filterCounts = new Map<LobbyFilter, HTMLSpanElement>();

  private readonly defaultSubtitle = "Play with friends worldwide";
  private readonly games = new Map<string, GameSessionInfo>();
  private readonly onlinePlayers: OnlinePlayerInfo[] = [];
  private readonly onlinePlayersListEl: HTMLElement;
  private readonly onlinePlayersBadgeEl: HTMLElement;
  private messageLog: MessageLog | null = null;
  private consoleLog: ConsoleLog | null = null;

  private room: Room | null = null;
  private boundRoom: Room | null = null;
  private eventCallback: LobbyEventCallback | null = null;
  private activeFilter: LobbyFilter = "all";
  private pendingTransition: "create" | "join" | null = null;
  private pendingSpectator = false;
  private createTimeout: ReturnType<typeof window.setTimeout> | null = null;
  private noticeTimeout: ReturnType<typeof window.setTimeout> | null = null;
  private isCreatePending = false;

  constructor() {
    const overlay = document.getElementById("lobby-overlay");
    if (!overlay) {
      throw new Error("Missing #lobby-overlay");
    }

    this.overlay = overlay;
    this.overlay.textContent = "";

    // Dashboard container
    const dashboard = createElement("div", "lobby-dashboard");

    // Header
    const header = createElement("header", "lobby-header");
    const headerInner = createElement("div", "lobby-header-inner");
    
    const headerLeft = createElement("div", "lobby-header-left");
    const logo = createElement("div", "lobby-logo");
    logo.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12M6 16h12M6 8h12m-6 8v4M10 20h4"/></svg>';
    
    const titleGroup = createElement("div", "lobby-title-group");
    const title = createElement("h1", "lobby-title", "Board Game Lounge");
    this.subtitleEl = createElement("p", "lobby-subtitle", "Play with friends worldwide");
    titleGroup.append(title, this.subtitleEl);
    headerLeft.append(logo, titleGroup);
    
    const headerRight = createElement("div", "lobby-header-right");
    
    // Player name input in header
    this.playerNameInput = createElement("input", "lobby-input") as HTMLInputElement;
    this.playerNameInput.type = "text";
    this.playerNameInput.name = "player-name";
    this.playerNameInput.placeholder = "Your name";
    this.playerNameInput.maxLength = MAX_DISPLAY_NAME_LENGTH;
    this.playerNameInput.style.maxWidth = "180px";
    this.playerNameInput.addEventListener("change", () => {
      this.handleSaveDisplayName();
    });
    
    const userButton = createElement("button", "lobby-header-user") as HTMLButtonElement;
    userButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    userButton.title = "Player Profile";
    
    headerRight.append(this.playerNameInput, userButton);
    headerInner.append(headerLeft, headerRight);
    header.append(headerInner);

    // Notification element (positioned fixed)
    this.notificationEl = createElement("div", "lobby-notice");
    this.notificationEl.setAttribute("role", "status");

    // Main content
    const content = createElement("div", "lobby-content");
    const grid = createElement("div", "lobby-grid");

    // Game Library (left side)
    const gameLibrary = createElement("div", "game-library");
    const gameLibraryHeader = createElement("div", "game-library-header");
    const gameLibraryTitle = createElement("h2", "game-library-title", "Game Library");
    
    const gameLibraryToolbar = createElement("div", "game-library-toolbar");
    
    // Create Game button
    const createGameButton = createElement("button", "create-game-trigger") as HTMLButtonElement;
    createGameButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Create Game</span>';
    createGameButton.addEventListener("click", () => this.openCreateGameModal());
    
    // Filters
    const filtersSection = createElement("div", "lobby-filters");
    for (const filter of [
      { key: "all", label: "All" },
      { key: "waiting", label: "Waiting" },
      { key: "in_progress", label: "In Progress" },
    ] as const) {
      const button = createElement("button", "lobby-filter-button") as HTMLButtonElement;
      button.type = "button";
      button.dataset.filter = filter.key;

      const label = createElement("span", "filter-label", filter.label);
      const count = createElement("span", "filter-badge", "0");

      button.append(label, count);
      button.addEventListener("click", () => this.setActiveFilter(filter.key));

      this.filterButtons.set(filter.key, button);
      this.filterCounts.set(filter.key, count);
      filtersSection.append(button);
    }
    
    gameLibraryToolbar.append(createGameButton, filtersSection);
    gameLibraryHeader.append(gameLibraryTitle, gameLibraryToolbar);
    
    // Game tiles grid (shows game types and active sessions)
    this.gameListBody = createElement("div", "game-tiles-grid") as HTMLElement;
    
    gameLibrary.append(gameLibraryHeader, this.gameListBody);

    // Sidebar (right side)
    const sidebar = createElement("div", "lobby-sidebar");
    
    // Active Games Panel (will be populated by renderGameList)
    const activeGamesPanel = createElement("div", "active-games-panel");
    activeGamesPanel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Active Games</h2>
      </div>
      <div class="panel-content" id="active-games-list"></div>
    `;
    
    // Online Players Panel
    const onlinePlayersPanel = createElement("div", "online-players-panel");
    const onlinePlayersHeader = createElement("div", "panel-header");
    const onlinePlayersTitle = createElement("h2", "panel-title", "Online Players");
    this.onlinePlayersBadgeEl = createElement("span", "panel-badge", "0");
    onlinePlayersHeader.append(onlinePlayersTitle, this.onlinePlayersBadgeEl);
    this.onlinePlayersListEl = createElement("div", "panel-content");
    this.onlinePlayersListEl.append(createElement("div", "panel-empty", "No players online"));
    onlinePlayersPanel.append(onlinePlayersHeader, this.onlinePlayersListEl);
    
    // Message Log Panel
    const messageLogPanel = createElement("div", "message-log-panel");
    const messageLogHeader = createElement("div", "panel-header");
    const messageLogTitle = createElement("h2", "panel-title", "Activity Feed");
    messageLogHeader.append(messageLogTitle);
    const messageLogContent = createElement("div", "message-log-content");
    messageLogPanel.append(messageLogHeader, messageLogContent);
    this.messageLog = new MessageLog(messageLogContent);
    
    sidebar.append(activeGamesPanel, onlinePlayersPanel, messageLogPanel);

    grid.append(gameLibrary, sidebar);
    content.append(grid);

    // Create Game Modal
    const modal = createElement("div", "create-game-modal");
    modal.id = "create-game-modal";
    const modalContent = createElement("div", "create-game-modal-content");
    
    const modalHeader = createElement("div", "create-game-modal-header");
    const modalTitle = createElement("h2", "create-game-modal-title", "Create New Game");
    const modalClose = createElement("button", "create-game-modal-close") as HTMLButtonElement;
    modalClose.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    modalClose.addEventListener("click", () => this.closeCreateGameModal());
    modalHeader.append(modalTitle, modalClose);
    
    const modalBody = createElement("div", "create-game-modal-body");
    const createForm = createElement("form", "create-game-form");

    const nameField = createElement("label", "field-group");
    const nameLabel = createElement("span", "field-label", "Game name");
    this.gameNameInput = createElement("input", "lobby-input") as HTMLInputElement;
    this.gameNameInput.type = "text";
    this.gameNameInput.name = "game-name";
    this.gameNameInput.placeholder = "New game";
    this.gameNameInput.maxLength = 32;
    nameField.append(nameLabel, this.gameNameInput);

    const gameTypeField = createElement("label", "field-group");
    const gameTypeLabel = createElement("span", "field-label", "Game type");
    this.gameTypeInput = createElement("select", "lobby-select") as HTMLSelectElement;
    this.gameTypeInput.name = "game-type";

    for (const optionConfig of GAME_TYPE_OPTIONS) {
      const option = createElement("option") as HTMLOptionElement;
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      this.gameTypeInput.append(option);
    }
    this.gameTypeInput.addEventListener("change", () => {
      this.syncGameTypeConstraints();
    });

    const maxPlayersField = createElement("label", "field-group");
    const maxPlayersLabel = createElement("span", "field-label", "Max players");
    this.maxPlayersInput = createElement("select", "lobby-select") as HTMLSelectElement;
    this.maxPlayersInput.name = "max-players";

    const cpuOpponentField = createElement("label", "field-group");
    const cpuOpponentLabel = createElement("span", "field-label", "Opponent");
    const cpuOpponentToggle = createElement("label") as HTMLLabelElement;
    this.cpuOpponentInput = createElement("input") as HTMLInputElement;
    this.cpuOpponentInput.type = "checkbox";
    this.cpuOpponentInput.name = "cpu-opponent";
    const cpuOpponentText = createElement("span", undefined, "Play vs CPU");
    cpuOpponentToggle.append(this.cpuOpponentInput, cpuOpponentText);

    const headToHeadField = createElement("label", "field-group");
    const headToHeadLabel = createElement("span", "field-label", "Mode");
    const headToHeadToggle = createElement("label") as HTMLLabelElement;
    this.headToHeadInput = createElement("input") as HTMLInputElement;
    this.headToHeadInput.type = "checkbox";
    this.headToHeadInput.name = "head-to-head-mode";
    this.headToHeadInput.addEventListener("change", () => {
      this.syncGameTypeConstraints();
    });
    const headToHeadText = createElement("span", undefined, "Play on Shared Device");
    headToHeadToggle.append(this.headToHeadInput, headToHeadText);

    gameTypeField.append(gameTypeLabel, this.gameTypeInput);
    maxPlayersField.append(maxPlayersLabel, this.maxPlayersInput);
    cpuOpponentField.append(cpuOpponentLabel, cpuOpponentToggle);
    headToHeadField.append(headToHeadLabel, headToHeadToggle);

    createForm.append(nameField, gameTypeField, maxPlayersField, cpuOpponentField, headToHeadField);
    createForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleCreateGame();
    });
    this.syncGameTypeConstraints();
    
    modalBody.append(createForm);
    
    const modalFooter = createElement("div", "create-game-modal-footer");
    const cancelButton = createElement("button", "lobby-button lobby-button-secondary", "Cancel") as HTMLButtonElement;
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => this.closeCreateGameModal());
    
    this.createButton = createElement("button", "lobby-button lobby-button-primary", "Create Game") as HTMLButtonElement;
    this.createButton.type = "button";
    this.createButton.addEventListener("click", () => {
      createForm.requestSubmit();
    });
    
    modalFooter.append(cancelButton, this.createButton);
    
    modalContent.append(modalHeader, modalBody, modalFooter);
    modal.append(modalContent);
    
    // Close modal on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeCreateGameModal();
      }
    });

    dashboard.append(header, content, this.notificationEl, modal);
    this.overlay.append(dashboard);

    this.renderGameList();
    this.setActiveFilter("all");
  }

  private openCreateGameModal(): void {
    const modal = document.getElementById("create-game-modal");
    if (modal) {
      modal.classList.add("visible");
      this.gameNameInput.focus();
    }
  }

  private closeCreateGameModal(): void {
    const modal = document.getElementById("create-game-modal");
    if (modal) {
      modal.classList.remove("visible");
    }
  }

  onEvent(callback: LobbyEventCallback): void {
    this.eventCallback = callback;
  }

  setDisplayName(displayName: string): void {
    this.playerNameInput.value = displayName;
  }

  setConsoleLog(log: ConsoleLog): void {
    this.consoleLog = log;
  }

  bindToRoom(room: Room): void {
    this.room = room;
    this.subtitleEl.textContent = this.defaultSubtitle;
    this.setCreatePending(false);

    if (this.boundRoom === room) {
      return;
    }

    this.boundRoom = room;

    room.onMessage(GAME_LIST, (payload: GameListPayload) => {
      this.games.clear();
      for (const game of payload.games) {
        this.games.set(game.id, game);
      }
      this.renderGameList();
    });

    room.onMessage(GAME_UPDATED, (payload: GameUpdatedPayload) => {
      this.games.set(payload.game.id, payload.game);
      this.renderGameList();
    });

    room.onMessage(GAME_REMOVED, (payload: GameRemovedPayload) => {
      this.games.delete(payload.gameId);
      this.renderGameList();
    });

    room.onMessage(GAME_JOINED, (payload: GameJoinedPayload) => {
      const joinedGame = this.games.get(payload.gameId) ?? null;
      const isHost = joinedGame?.hostId === room.sessionId || this.pendingTransition === "create";
      this.pendingTransition = null;
      this.setCreatePending(false);
      this.clearNotice();

      if (payload.roomId) {
        this.eventCallback?.({
          type: "join_game",
          gameId: payload.gameId,
          roomId: payload.roomId,
          gameType: joinedGame?.gameType ?? "checkers",
        });
        return;
      }

      this.eventCallback?.({
        type: "waiting",
        gameId: payload.gameId,
        gameInfo: joinedGame,
        isHost,
      });
    });

    room.onMessage(LOBBY_ERROR, (payload: LobbyErrorPayload) => {
      this.pendingTransition = null;
      this.setCreatePending(false);
      this.showNotice(payload.message, "error");
      this.eventCallback?.({ type: "error", message: payload.message });
    });

    room.onMessage(ONLINE_PLAYERS, (payload: OnlinePlayersPayload) => {
      this.onlinePlayers.length = 0;
      this.onlinePlayers.push(...payload.players);
      this.renderOnlinePlayers();
    });

    room.onMessage(LOBBY_LOG_EVENT, (entry: LobbyLogEntry) => {
      this.messageLog?.addMessage(entry);
      this.consoleLog?.info(entry.message);
    });
  }

  show(): void {
    this.overlay.classList.add("visible");
  }

  hide(): void {
    this.overlay.classList.remove("visible");
  }

  clearNotice(): void {
    if (this.noticeTimeout) {
      window.clearTimeout(this.noticeTimeout);
      this.noticeTimeout = null;
    }

    this.notificationEl.textContent = "";
    this.notificationEl.className = "lobby-notice";
  }

  showNotice(message: string, tone: NoticeTone = "info", autoHide = true): void {
    this.show();
    this.notificationEl.textContent = message;
    this.notificationEl.className = `lobby-notice ${tone} visible`;

    if (this.noticeTimeout) {
      window.clearTimeout(this.noticeTimeout);
      this.noticeTimeout = null;
    }

    if (autoHide) {
      this.noticeTimeout = window.setTimeout(() => this.clearNotice(), 4000);
    }

    this.consoleLog?.log(message, tone === "error" ? "error" : "info");
  }

  showConnectionError(message: string): void {
    this.show();
    this.subtitleEl.textContent = "Could not connect to the lobby room. Check that the server is running.";
    this.showNotice(message, "error", false);
    this.consoleLog?.error(`Connection error: ${message}`);
  }

  private handleSaveDisplayName(): void {
    const displayName = this.playerNameInput.value.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    this.playerNameInput.value = displayName;

    if (!displayName) {
      this.showNotice("Player name is required.", "error");
      return;
    }

    this.eventCallback?.({ type: "set_display_name", displayName });
  }

  private handleCreateGame(): void {
    if (!this.room) {
      this.showNotice("Lobby is not connected yet.", "error");
      return;
    }

    const payload: CreateGamePayload = {
      name: this.gameNameInput.value.trim() || this.gameNameInput.placeholder || "New game",
      gameType: this.getSelectedGameType(),
      maxPlayers: this.getSelectedMaxPlayers(),
      cpuOpponent: this.shouldUseCpuOpponent(),
      headToHeadMode: this.shouldUseHeadToHeadMode(),
    };

    this.pendingTransition = "create";
    this.setCreatePending(true);
    this.room.send(CREATE_GAME, payload);
  }

  private setCreatePending(isPending: boolean): void {
    this.isCreatePending = isPending;
    this.createButton.disabled = isPending;
    this.gameNameInput.disabled = isPending;
    this.gameTypeInput.disabled = isPending;
    this.syncGameTypeConstraints();
    this.createButton.textContent = isPending ? "Creating…" : "Create Game";

    if (this.createTimeout) {
      window.clearTimeout(this.createTimeout);
      this.createTimeout = null;
    }

    if (!isPending) {
      return;
    }

    this.createTimeout = window.setTimeout(() => {
      this.pendingTransition = null;
      this.setCreatePending(false);
      this.showNotice("Game creation timed out. Try again.", "error");
    }, 30000);
  }

  private getSelectedGameType(): string {
    return this.gameTypeInput.value || GAME_TYPE_OPTIONS[0].value;
  }

  private getSelectedMaxPlayers(): number {
    const selectedGameType = getGameTypeOption(this.getSelectedGameType());
    return Number(this.maxPlayersInput.value) || selectedGameType.selectablePlayerCounts[0] || 2;
  }

  private syncGameTypeConstraints(): void {
    const gameTypeOption = getGameTypeOption(this.getSelectedGameType());
    const currentValue = Number(this.maxPlayersInput.value);
    const selectedValue = gameTypeOption.selectablePlayerCounts.includes(currentValue)
      ? currentValue
      : gameTypeOption.selectablePlayerCounts[0] || 2;

    this.maxPlayersInput.textContent = "";
    for (const count of gameTypeOption.selectablePlayerCounts) {
      const option = createElement("option") as HTMLOptionElement;
      option.value = String(count);
      option.textContent = `${count} players`;
      option.selected = count === selectedValue;
      this.maxPlayersInput.append(option);
    }

    const supportsCpuOpponent = this.supportsCpuOpponent(gameTypeOption.value);
    if (!supportsCpuOpponent) {
      this.cpuOpponentInput.checked = false;
    }

    const supportsHeadToHeadMode = this.supportsHeadToHeadMode(gameTypeOption.value);
    if (!supportsHeadToHeadMode) {
      this.headToHeadInput.checked = false;
    }

    this.maxPlayersInput.disabled = this.isCreatePending || this.isTwoPlayerGameType(gameTypeOption.value);
    this.cpuOpponentInput.disabled = this.isCreatePending || !supportsCpuOpponent;
    this.cpuOpponentInput.title = supportsCpuOpponent
      ? ""
      : "CPU opponents are not available for this game type.";
    this.headToHeadInput.disabled = this.isCreatePending || !supportsHeadToHeadMode;
    this.headToHeadInput.title = supportsHeadToHeadMode
      ? ""
      : "Shared-device mode is currently available for Checkers only.";
  }

  private isTwoPlayerGameType(gameType: string): boolean {
    return getGameTypeOption(gameType).selectablePlayerCounts.length === 1;
  }

  private supportsCpuOpponent(gameType: string): boolean {
    return gameType === "checkers" || gameType === "backgammon";
  }

  private shouldUseCpuOpponent(): boolean {
    return this.supportsCpuOpponent(this.getSelectedGameType()) && this.cpuOpponentInput.checked;
  }

  private supportsHeadToHeadMode(gameType: string): boolean {
    return gameType === "checkers";
  }

  private shouldUseHeadToHeadMode(): boolean {
    return this.supportsHeadToHeadMode(this.getSelectedGameType()) && this.headToHeadInput.checked;
  }

  private setActiveFilter(filter: LobbyFilter): void {
    this.activeFilter = filter;

    for (const [key, button] of this.filterButtons.entries()) {
      button.classList.toggle("active", key === filter);
    }

    this.renderGameList();
  }

  private renderGameList(): void {
    this.updateFilterCounts();
    this.gameListBody.textContent = "";

    const filteredGames = this.getFilteredGames();
    
    // Render game type tiles (always show available game types)
    for (const gameTypeOption of GAME_TYPE_OPTIONS) {
      const activeGamesOfType = filteredGames.filter((game) => game.gameType === gameTypeOption.value);
      const tile = this.buildGameTile(gameTypeOption, activeGamesOfType.length);
      this.gameListBody.append(tile);
    }

    // If no games, show empty state in game tiles grid
    if (filteredGames.length === 0) {
      const emptyTile = createElement("div", "panel-empty");
      emptyTile.textContent = this.emptyMessageForFilter();
      emptyTile.style.gridColumn = "1 / -1";
      emptyTile.style.padding = "2rem";
      emptyTile.style.textAlign = "center";
      emptyTile.style.color = "#71717a";
      this.gameListBody.append(emptyTile);
    }

    // Render active games in sidebar
    this.renderActiveGamesList(filteredGames);
  }

  private buildGameTile(gameTypeOption: GameTypeOption, activeCount: number): HTMLElement {
    const { value: gameType, label, playerCountLabel } = gameTypeOption;
    const tile = createElement("button", "game-tile") as HTMLButtonElement;
    tile.type = "button";

    const imageArea = createElement("div", "game-tile-image");
    const imageInner = createElement("img", "game-tile-image-inner") as HTMLImageElement;
    imageInner.src = GAME_TILE_ARTWORK[gameType] || GAME_TILE_ARTWORK.default;
    imageInner.alt = "";
    imageInner.loading = "lazy";
    imageInner.decoding = "async";

    imageArea.append(imageInner);

    const content = createElement("div", "game-tile-content");
    const name = createElement("h3", "game-tile-name", label);
    const meta = createElement("div", "game-tile-meta");

    const players = createElement("span", "game-tile-players");
    players.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>${playerCountLabel}</span>`;

    const active = createElement("span", "game-tile-active", `${activeCount} active`);

    meta.append(players, active);
    content.append(name, meta);

    tile.append(imageArea, content);
    tile.addEventListener("click", () => {
      this.eventCallback?.({ type: "setup", gameType: gameType });
    });

    return tile;
  }

  private renderActiveGamesList(games: GameSessionInfo[]): void {
    const activeGamesList = document.getElementById("active-games-list");
    if (!activeGamesList) {
      return;
    }
    
    activeGamesList.textContent = "";
    
    if (games.length === 0) {
      const empty = createElement("div", "panel-empty", "No active games yet");
      activeGamesList.append(empty);
      return;
    }
    
    for (const game of games) {
      const card = this.buildActiveGameCard(game);
      activeGamesList.append(card);
    }
  }

  private renderOnlinePlayers(): void {
    this.onlinePlayersBadgeEl.textContent = String(this.onlinePlayers.length);
    this.onlinePlayersListEl.textContent = "";

    if (this.onlinePlayers.length === 0) {
      this.onlinePlayersListEl.append(
        createElement("div", "panel-empty", "No players online"),
      );
      return;
    }

    for (const player of this.onlinePlayers) {
      const card = createElement("div", "online-player-item");

      const avatarWrapper = createElement("div", "online-player-avatar-wrapper");
      const avatar = createElement("div", "online-player-avatar");
      avatar.textContent = player.displayName.charAt(0).toUpperCase();
      const statusDot = createElement("div",
        `online-player-status-dot ${player.status === "in_game" ? "in-game" : "online"}`,
      );
      avatarWrapper.append(avatar, statusDot);

      const info = createElement("div", "online-player-info");
      const name = createElement("div", "online-player-name", player.displayName);
      const status = createElement("div", "online-player-status",
        player.status === "in_game" ? "In Game" : "In Lobby",
      );
      info.append(name, status);

      card.append(avatarWrapper, info);
      this.onlinePlayersListEl.append(card);
    }
  }

  private buildActiveGameCard(game: GameSessionInfo): HTMLElement {
    const card = createElement("div", "active-game-card");
    
    const header = createElement("div", "active-game-header");
    const info = createElement("div", "active-game-info");
    
    const name = createElement("div", "active-game-name", game.name || "Untitled game");
    const meta = createElement("div", "active-game-meta");
    
    const gameTypeMeta = createElement("span", "active-game-meta-item");
    const gameTypeOption = getGameTypeOption(game.gameType);
    gameTypeMeta.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg><span>${gameTypeOption.label}</span>`;
    
    const playersMeta = createElement("span", "active-game-meta-item");
    playersMeta.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>${game.playerCount}/${game.maxPlayers}</span>`;
    
    meta.append(gameTypeMeta, playersMeta);
    if (game.headToHeadMode) {
      meta.append(createElement("span", "active-game-meta-item", "Shared Device"));
    }
    
    // Show time elapsed for in-progress games
    if (game.status === "in_progress" && game.createdAt) {
      const elapsed = Math.floor((Date.now() - game.createdAt) / 60000);
      const timeMeta = createElement("span", "active-game-meta-item");
      timeMeta.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${elapsed}m</span>`;
      meta.append(timeMeta);
    }
    
    info.append(name, meta);
    
    const statusBadge = createElement("span", `game-status-badge ${game.status === "waiting" ? "waiting" : "playing"}`);
    statusBadge.textContent = game.status === "waiting" ? "Waiting" : "Playing";
    
    header.append(info, statusBadge);
    
    const footer = createElement("div", "active-game-footer");
    
    // Player avatars
    const playersDiv = createElement("div", "active-game-players");
    // Show mock player avatars based on player count
    for (let i = 0; i < Math.min(game.playerCount, 4); i++) {
      const avatar = createElement("div", "player-avatar");
      avatar.textContent = game.hostName ? game.hostName.charAt(0) : "?";
      playersDiv.append(avatar);
    }
    
    footer.append(playersDiv);
    
    // Join button for waiting games with space
    const canJoin = game.status === "waiting"
      && game.playerCount < game.maxPlayers
      && game.headToHeadMode !== true;
    if (canJoin) {
      const joinBtn = createElement("button", "active-game-join-btn") as HTMLButtonElement;
      joinBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Join</span>';
      joinBtn.addEventListener("click", () => {
        if (!this.room) {
          this.showNotice("Lobby is not connected yet.", "error");
          return;
        }
        const payload: JoinGamePayload = { gameId: game.id };
        this.pendingTransition = "join";
        this.room.send(JOIN_GAME, payload);
      });
      footer.append(joinBtn);
    }
    
    card.append(header, footer);
    return card;
  }

  private getFilteredGames(): GameSessionInfo[] {
    const games = [...this.games.values()];
    const filtered = this.activeFilter === "all"
      ? games
      : games.filter((game) => game.status === this.activeFilter);

    return filtered.sort((left, right) => {
      const order = this.statusOrder(left.status) - this.statusOrder(right.status);
      if (order !== 0) {
        return order;
      }
      return (right.createdAt ?? 0) - (left.createdAt ?? 0);
    });
  }

  private statusOrder(status: GameStatus): number {
    if (status === "waiting") {
      return 0;
    }
    if (status === "in_progress") {
      return 1;
    }
    return 2;
  }

  private emptyMessageForFilter(): string {
    if (this.activeFilter === "waiting") {
      return "No waiting sessions yet — create one above.";
    }
    if (this.activeFilter === "in_progress") {
      return "No sessions in progress right now.";
    }
    return "No sessions available yet — create one above.";
  }

  private updateFilterCounts(): void {
    const allGames = [...this.games.values()];
    const waitingCount = allGames.filter((game) => game.status === "waiting").length;
    const inProgressCount = allGames.filter((game) => game.status === "in_progress").length;

    this.filterCounts.get("all")!.textContent = String(allGames.length);
    this.filterCounts.get("waiting")!.textContent = String(waitingCount);
    this.filterCounts.get("in_progress")!.textContent = String(inProgressCount);
  }
}

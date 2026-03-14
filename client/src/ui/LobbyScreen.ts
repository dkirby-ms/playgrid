import type { Room } from "@colyseus/sdk";

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
}

export interface CreateGamePayload {
  name: string;
  gameType: string;
  maxPlayers?: number;
  mapSize?: number;
  mapSeed?: number;
  cpuPlayers?: number;
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

export type LobbyEvent =
  | { type: "join_game"; gameId: string; roomId: string; gameType: string }
  | { type: "waiting"; gameId: string; gameInfo: GameSessionInfo | null; isHost: boolean }
  | { type: "set_display_name"; displayName: string }
  | { type: "error"; message: string };

type LobbyFilter = "all" | "waiting" | "in_progress";
type NoticeTone = "info" | "error";
type LobbyEventCallback = (event: LobbyEvent) => void;

const GAME_TYPE_OPTIONS = [
  { value: "checkers", label: "Checkers" },
] as const;
const MAX_DISPLAY_NAME_LENGTH = 24;

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

function getGameTypeLabel(gameType: string): string {
  return GAME_TYPE_OPTIONS.find((option) => option.value === gameType)?.label
    ?? gameType
      .split(/[-_]/)
      .filter(Boolean)
      .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
      .join(" ");
}

export class LobbyScreen {
  private readonly overlay: HTMLElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly notificationEl: HTMLDivElement;
  private readonly gameListBody: HTMLTableSectionElement;
  private readonly playerNameInput: HTMLInputElement;
  private readonly gameNameInput: HTMLInputElement;
  private readonly gameTypeInput: HTMLSelectElement;
  private readonly maxPlayersInput: HTMLSelectElement;
  private readonly createButton: HTMLButtonElement;
  private readonly filterButtons = new Map<LobbyFilter, HTMLButtonElement>();
  private readonly filterCounts = new Map<LobbyFilter, HTMLSpanElement>();

  private readonly defaultSubtitle = "Browse open sessions or spin up a new game.";
  private readonly games = new Map<string, GameSessionInfo>();

  private room: Room | null = null;
  private boundRoom: Room | null = null;
  private eventCallback: LobbyEventCallback | null = null;
  private activeFilter: LobbyFilter = "all";
  private pendingTransition: "create" | "join" | null = null;
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

    const panel = createElement("section", "lobby-panel");
    const header = createElement("header", "overlay-header");
    const titleEl = createElement("h1", "overlay-title", "Game Lobby");
    this.subtitleEl = createElement("p", "overlay-subtitle", this.defaultSubtitle);
    header.append(titleEl, this.subtitleEl);

    this.notificationEl = createElement("div", "lobby-notice");
    this.notificationEl.setAttribute("role", "status");

    const playerSection = createElement("section", "lobby-profile-section");
    const playerHeading = createElement("h2", "section-title", "Player name");
    const playerForm = createElement("form", "lobby-profile-form");
    const playerNameField = createElement("label", "field-group");
    const playerNameLabel = createElement("span", "field-label", "Display name");
    this.playerNameInput = createElement("input", "lobby-input") as HTMLInputElement;
    this.playerNameInput.type = "text";
    this.playerNameInput.name = "player-name";
    this.playerNameInput.placeholder = "Player name";
    this.playerNameInput.maxLength = MAX_DISPLAY_NAME_LENGTH;
    playerNameField.append(playerNameLabel, this.playerNameInput);

    const saveNameButton = createElement("button", "lobby-button lobby-button-secondary", "Save Name") as HTMLButtonElement;
    saveNameButton.type = "submit";
    playerForm.append(playerNameField, saveNameButton);
    playerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleSaveDisplayName();
    });
    playerSection.append(playerHeading, playerForm);

    const createSection = createElement("section", "lobby-create-section");
    const createHeading = createElement("h2", "section-title", "Create a session");
    const createForm = createElement("form", "lobby-create-form");

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

    for (const count of [2, 4, 6, 8]) {
      const option = createElement("option") as HTMLOptionElement;
      option.value = String(count);
      option.textContent = `${count} players`;
      if (count === 2) {
        option.selected = true;
      }
      this.maxPlayersInput.append(option);
    }

    gameTypeField.append(gameTypeLabel, this.gameTypeInput);
    maxPlayersField.append(maxPlayersLabel, this.maxPlayersInput);

    this.createButton = createElement("button", "lobby-button lobby-button-primary", "Create Game") as HTMLButtonElement;
    this.createButton.type = "submit";

    createForm.append(nameField, gameTypeField, maxPlayersField, this.createButton);
    createForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleCreateGame();
    });
    this.syncGameTypeConstraints();

    createSection.append(createHeading, createForm);

    const filtersSection = createElement("section", "lobby-filters");
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

    const listSection = createElement("section", "lobby-list-section");
    const listHeading = createElement("h2", "section-title", "Open sessions");
    const tableWrapper = createElement("div", "lobby-table-wrapper");
    const table = createElement("table", "lobby-table");
    const tableHead = createElement("thead");
    const headRow = createElement("tr");

    for (const label of ["Game", "Type", "Host", "Players", "Status", "Action"]) {
      headRow.append(createElement("th", undefined, label));
    }

    tableHead.append(headRow);
    this.gameListBody = createElement("tbody") as HTMLTableSectionElement;
    table.append(tableHead, this.gameListBody);
    tableWrapper.append(table);
    listSection.append(listHeading, tableWrapper);

    panel.append(header, this.notificationEl, playerSection, createSection, filtersSection, listSection);
    this.overlay.append(panel);

    this.renderGameList();
    this.setActiveFilter("all");
  }

  onEvent(callback: LobbyEventCallback): void {
    this.eventCallback = callback;
  }

  setDisplayName(displayName: string): void {
    this.playerNameInput.value = displayName;
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
      const isHost = this.pendingTransition === "create";
      this.pendingTransition = null;
      this.setCreatePending(false);
      this.clearNotice();

      if (payload.roomId) {
        this.eventCallback?.({
          type: "join_game",
          gameId: payload.gameId,
          roomId: payload.roomId,
          gameType: this.games.get(payload.gameId)?.gameType ?? "checkers",
        });
        return;
      }

      this.eventCallback?.({
        type: "waiting",
        gameId: payload.gameId,
        gameInfo: this.games.get(payload.gameId) ?? null,
        isHost,
      });
    });

    room.onMessage(LOBBY_ERROR, (payload: LobbyErrorPayload) => {
      this.pendingTransition = null;
      this.setCreatePending(false);
      this.showNotice(payload.message, "error");
      this.eventCallback?.({ type: "error", message: payload.message });
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
  }

  showConnectionError(message: string): void {
    this.show();
    this.subtitleEl.textContent = "Could not connect to the lobby room. Check that the server is running.";
    this.showNotice(message, "error", false);
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
    if (this.getSelectedGameType() === "checkers") {
      return 2;
    }

    return Number(this.maxPlayersInput.value) || 2;
  }

  private syncGameTypeConstraints(): void {
    const isTwoPlayerGame = this.getSelectedGameType() === "checkers";
    if (isTwoPlayerGame) {
      this.maxPlayersInput.value = "2";
    }

    this.maxPlayersInput.disabled = this.isCreatePending || isTwoPlayerGame;
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
    if (filteredGames.length === 0) {
      const emptyRow = createElement("tr", "lobby-empty-row");
      const emptyCell = createElement("td", undefined, this.emptyMessageForFilter()) as HTMLTableCellElement;
      emptyCell.colSpan = 6;
      emptyRow.append(emptyCell);
      this.gameListBody.append(emptyRow);
      return;
    }

    for (const game of filteredGames) {
      const row = createElement("tr");
      row.append(
        this.buildTextCell(game.name || "Untitled game"),
        this.buildTextCell(getGameTypeLabel(game.gameType || GAME_TYPE_OPTIONS[0].value)),
        this.buildTextCell(game.hostName || "Unknown"),
        this.buildTextCell(`${game.playerCount}/${game.maxPlayers}`),
        this.buildStatusCell(game.status),
        this.buildActionCell(game),
      );
      this.gameListBody.append(row);
    }
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

  private buildTextCell(text: string): HTMLTableCellElement {
    const cell = createElement("td") as HTMLTableCellElement;
    cell.textContent = text;
    return cell;
  }

  private buildStatusCell(status: GameStatus): HTMLTableCellElement {
    const cell = createElement("td") as HTMLTableCellElement;
    const pill = createElement("span", `status-pill ${this.statusClass(status)}`, this.statusLabel(status));
    cell.append(pill);
    return cell;
  }

  private buildActionCell(game: GameSessionInfo): HTMLTableCellElement {
    const cell = createElement("td") as HTMLTableCellElement;
    const canJoin = game.status !== "ended" && game.playerCount < game.maxPlayers;

    if (!canJoin) {
      const label = createElement(
        "span",
        "row-state",
        game.status === "ended" ? "Closed" : "Full",
      );
      cell.append(label);
      return cell;
    }

    const button = createElement("button", "lobby-button lobby-button-secondary", "Join") as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", () => {
      if (!this.room) {
        this.showNotice("Lobby is not connected yet.", "error");
        return;
      }

      const payload: JoinGamePayload = { gameId: game.id };
      this.pendingTransition = "join";
      this.room.send(JOIN_GAME, payload);
    });

    cell.append(button);
    return cell;
  }

  private statusLabel(status: GameStatus): string {
    if (status === "waiting") {
      return "Waiting";
    }
    if (status === "in_progress") {
      return "In Progress";
    }
    return "Ended";
  }

  private statusClass(status: GameStatus): string {
    if (status === "waiting") {
      return "is-waiting";
    }
    if (status === "in_progress") {
      return "is-in-progress";
    }
    return "is-ended";
  }
}

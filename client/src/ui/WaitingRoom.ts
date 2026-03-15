import type { Room } from "@colyseus/sdk";
import { buildJoinGameHref } from "../joinLinks";
import {
  GAME_PLAYERS,
  GAME_STARTED,
  LEAVE_GAME,
  LOBBY_ERROR,
  SET_READY,
  START_GAME,
  type GameSessionInfo,
  type LobbyErrorPayload,
} from "./LobbyScreen";

export interface PreGamePlayerInfo {
  userId: string;
  displayName: string;
  isReady: boolean;
  isCPU?: boolean;
}

export interface GamePlayersPayload {
  gameId: string;
  players: PreGamePlayerInfo[];
}

export interface GameStartedPayload {
  gameId: string;
  roomId: string;
  gameType: string;
}

export interface SetReadyPayload {
  ready: boolean;
}

type WaitingRoomEvent =
  | { type: "leave" }
  | { type: "game_started"; gameId: string; roomId: string; gameType: string };

type WaitingRoomEventCallback = (event: WaitingRoomEvent) => void;

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

function createChip(text: string): HTMLSpanElement {
  return createElement("span", "waiting-room-chip", text) as HTMLSpanElement;
}

export class WaitingRoom {
  private readonly overlay: HTMLElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly joinLinkInput: HTMLInputElement;
  private readonly copyLinkButton: HTMLButtonElement;
  private readonly copyFeedbackEl: HTMLParagraphElement;
  private readonly playerListEl: HTMLUListElement;
  private readonly errorEl: HTMLDivElement;
  private readonly readyButton: HTMLButtonElement;
  private readonly startButton: HTMLButtonElement;
  private readonly leaveButton: HTMLButtonElement;

  private room: Room | null = null;
  private boundRoom: Room | null = null;
  private gameId: string | null = null;
  private gameInfo: GameSessionInfo | null = null;
  private isHost = false;
  private isReady = false;
  private players: PreGamePlayerInfo[] = [];
  private eventCallback: WaitingRoomEventCallback | null = null;
  private copyFeedbackTimeoutId: number | null = null;

  constructor() {
    const overlay = document.getElementById("waiting-room-overlay");
    if (!overlay) {
      throw new Error("Missing #waiting-room-overlay");
    }

    this.overlay = overlay;
    this.overlay.textContent = "";

    const panel = createElement("section", "waiting-room-panel");
    const header = createElement("header", "overlay-header");
    this.titleEl = createElement("h2", "overlay-title", "Waiting Room") as HTMLHeadingElement;
    this.subtitleEl = createElement("p", "overlay-subtitle", "Waiting for players to join.") as HTMLParagraphElement;
    header.append(this.titleEl, this.subtitleEl);

    const shareHeading = createElement("h3", "section-title", "Invite Players");
    const shareHint = createElement(
      "p",
      "waiting-room-share-hint",
      "Share this link to let other players join this waiting room directly.",
    );
    const shareRow = createElement("div", "waiting-room-share-row");
    this.joinLinkInput = createElement("input", "waiting-room-share-input") as HTMLInputElement;
    this.joinLinkInput.type = "text";
    this.joinLinkInput.readOnly = true;
    this.joinLinkInput.autocomplete = "off";
    this.joinLinkInput.spellcheck = false;
    this.joinLinkInput.setAttribute("aria-label", "Join link");
    this.joinLinkInput.addEventListener("focus", () => this.joinLinkInput.select());
    this.joinLinkInput.addEventListener("click", () => this.joinLinkInput.select());

    this.copyLinkButton = createElement(
      "button",
      "lobby-button lobby-button-secondary waiting-room-copy-button",
      "Copy Link",
    ) as HTMLButtonElement;
    this.copyLinkButton.type = "button";
    this.copyLinkButton.addEventListener("click", () => {
      void this.copyJoinLink();
    });

    shareRow.append(this.joinLinkInput, this.copyLinkButton);
    this.copyFeedbackEl = createElement("p", "waiting-room-share-feedback") as HTMLParagraphElement;

    const rosterHeading = createElement("h3", "section-title", "Players");
    this.playerListEl = createElement("ul", "waiting-room-player-list") as HTMLUListElement;

    this.errorEl = createElement("div", "waiting-room-error") as HTMLDivElement;
    this.errorEl.style.display = "none";

    const controls = createElement("div", "waiting-room-controls");
    this.readyButton = createElement("button", "lobby-button lobby-button-secondary", "Ready") as HTMLButtonElement;
    this.readyButton.type = "button";
    this.readyButton.addEventListener("click", () => this.toggleReady());

    this.startButton = createElement("button", "lobby-button lobby-button-primary", "Start Game") as HTMLButtonElement;
    this.startButton.type = "button";
    this.startButton.addEventListener("click", () => this.startGame());

    this.leaveButton = createElement("button", "lobby-button lobby-button-ghost", "Leave") as HTMLButtonElement;
    this.leaveButton.type = "button";
    this.leaveButton.addEventListener("click", () => this.leave());

    controls.append(this.readyButton, this.startButton, this.leaveButton);
    panel.append(
      header,
      shareHeading,
      shareHint,
      shareRow,
      this.copyFeedbackEl,
      rosterHeading,
      this.playerListEl,
      this.errorEl,
      controls,
    );
    this.overlay.append(panel);

    this.renderPlayerList();
    this.updateControls();
    this.updateJoinLink();
  }

  onEvent(callback: WaitingRoomEventCallback): void {
    this.eventCallback = callback;
  }

  show(room: Room, gameId: string, gameInfo: GameSessionInfo | null, isHost: boolean): void {
    if (this.boundRoom !== room) {
      this.boundRoom = room;

      room.onMessage(GAME_PLAYERS, (payload: GamePlayersPayload) => {
        if (payload.gameId !== this.gameId) {
          return;
        }

        this.players = payload.players;
        const localPlayer = this.players.find((player) => player.userId === room.sessionId);
        this.isReady = localPlayer?.isReady ?? this.isReady;
        this.clearError();
        this.renderPlayerList();
        this.updateControls();
      });

      room.onMessage(GAME_STARTED, (payload: GameStartedPayload) => {
        if (payload.gameId !== this.gameId) {
          return;
        }

        this.hide();
        this.eventCallback?.({
          type: "game_started",
          gameId: payload.gameId,
          roomId: payload.roomId,
          gameType: payload.gameType,
        });
      });

      room.onMessage(LOBBY_ERROR, (payload: LobbyErrorPayload) => {
        if (!this.isHost || !this.gameId) {
          return;
        }

        this.showError(payload.message);
      });
    }

    this.room = room;
    this.gameId = gameId;
    this.gameInfo = gameInfo;
    this.isHost = isHost;
    this.isReady = false;
    this.players = [];

    this.titleEl.textContent = gameInfo?.name || "Waiting Room";
    this.subtitleEl.textContent = isHost
      ? "You are hosting. Start when everyone is ready."
      : "Toggle Ready when you are set to play.";

    this.updateJoinLink();
    this.clearCopyFeedback();
    this.renderPlayerList();
    this.updateControls();
    this.overlay.classList.add("visible");
  }

  hide(): void {
    this.overlay.classList.remove("visible");
    this.room = null;
    this.gameId = null;
    this.gameInfo = null;
    this.isHost = false;
    this.isReady = false;
    this.players = [];
    this.clearError();
    this.clearCopyFeedback();
    this.updateJoinLink();
    this.renderPlayerList();
    this.updateControls();
  }

  private renderPlayerList(): void {
    this.playerListEl.textContent = "";

    if (this.players.length === 0) {
      const emptyState = createElement("li", "waiting-room-empty", "Waiting for player updates…");
      this.playerListEl.append(emptyState);
      return;
    }

    const hostId = this.gameInfo?.hostId ?? "";
    const sortedPlayers = [...this.players].sort((left, right) => {
      const leftHost = left.userId === hostId ? 1 : 0;
      const rightHost = right.userId === hostId ? 1 : 0;
      return rightHost - leftHost;
    });

    for (const player of sortedPlayers) {
      const item = createElement("li", "waiting-room-player");
      const meta = createElement("div", "waiting-room-player-meta");
      const name = createElement("span", "waiting-room-player-name", player.displayName || "Player");
      meta.append(name);

      if (player.userId === hostId) {
        meta.append(createChip("Host"));
      }
      if (player.userId === this.room?.sessionId) {
        meta.append(createChip("You"));
      }
      if (player.isCPU) {
        meta.append(createChip("CPU"));
      }

      const readyState = createElement(
        "span",
        `waiting-room-ready ${player.isReady ? "ready" : "not-ready"}`,
        player.isReady ? "✅ Ready" : "⬜ Not Ready",
      );

      item.append(meta, readyState);
      this.playerListEl.append(item);
    }
  }

  private updateControls(): void {
    this.readyButton.style.display = this.isHost ? "none" : "inline-flex";
    this.startButton.style.display = this.isHost ? "inline-flex" : "none";
    this.startButton.disabled = !this.canStartGame();

    if (this.isHost) {
      this.startButton.textContent = this.canStartGame() ? "Start Game" : "Start when everyone is ready";
    }

    this.readyButton.textContent = this.isReady ? "Not Ready" : "Ready";
    this.readyButton.classList.toggle("is-active", this.isReady);
  }

  private canStartGame(): boolean {
    const hostId = this.gameInfo?.hostId ?? this.room?.sessionId ?? "";
    return this.players.length > 0 && this.players.every((player) => player.userId === hostId || player.isReady);
  }

  private toggleReady(): void {
    if (!this.room) {
      return;
    }

    this.isReady = !this.isReady;
    const payload: SetReadyPayload = { ready: this.isReady };
    this.room.send(SET_READY, payload);
    this.updateControls();
  }

  private startGame(): void {
    if (!this.room || !this.gameId) {
      return;
    }

    this.room.send(START_GAME, { gameId: this.gameId });
    this.startButton.disabled = true;
    this.startButton.textContent = "Starting…";
  }

  private leave(): void {
    if (this.room && this.gameId) {
      this.room.send(LEAVE_GAME, { gameId: this.gameId });
    }

    this.hide();
    this.eventCallback?.({ type: "leave" });
  }

  private async copyJoinLink(): Promise<void> {
    const joinLink = this.joinLinkInput.value;
    if (!joinLink) {
      return;
    }

    try {
      await this.copyText(joinLink);
      this.setCopyFeedback("Copied!", "success");
    } catch {
      this.joinLinkInput.select();
      this.setCopyFeedback("Press Ctrl+C or Cmd+C to copy the link.", "error");
    }
  }

  private updateJoinLink(): void {
    const joinLink = this.gameId ? buildJoinGameHref(window.location.href, this.gameId) : "";
    this.joinLinkInput.value = joinLink;
    this.copyLinkButton.disabled = !joinLink;
  }

  private async copyText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "true");
    fallback.style.position = "absolute";
    fallback.style.left = "-9999px";
    document.body.append(fallback);
    fallback.select();

    const copied = document.execCommand("copy");
    fallback.remove();

    if (!copied) {
      throw new Error("Copy failed");
    }
  }

  private setCopyFeedback(message: string, tone: "success" | "error"): void {
    if (this.copyFeedbackTimeoutId !== null) {
      window.clearTimeout(this.copyFeedbackTimeoutId);
      this.copyFeedbackTimeoutId = null;
    }

    this.copyFeedbackEl.textContent = message;
    this.copyFeedbackEl.className = `waiting-room-share-feedback ${tone} visible`;
    this.copyLinkButton.textContent = tone === "success" ? "Copied!" : "Copy Link";

    this.copyFeedbackTimeoutId = window.setTimeout(() => {
      this.clearCopyFeedback();
    }, 2200);
  }

  private clearCopyFeedback(): void {
    if (this.copyFeedbackTimeoutId !== null) {
      window.clearTimeout(this.copyFeedbackTimeoutId);
      this.copyFeedbackTimeoutId = null;
    }

    this.copyFeedbackEl.textContent = "";
    this.copyFeedbackEl.className = "waiting-room-share-feedback";
    this.copyLinkButton.textContent = "Copy Link";
  }

  private showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.style.display = "block";
  }

  private clearError(): void {
    this.errorEl.textContent = "";
    this.errorEl.style.display = "none";
  }
}

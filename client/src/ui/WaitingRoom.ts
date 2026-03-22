import type { Room } from "@colyseus/sdk";
import { buildJoinGameHref } from "../joinLinks";
import type { ConsoleLog } from "./ConsoleLog";
import {
  ADD_CPU_PLAYER,
  GAME_PLAYERS,
  GAME_STARTED,
  LEAVE_GAME,
  LOBBY_ERROR,
  REMOVE_CPU_PLAYER,
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
  private readonly gameInfoEl: HTMLParagraphElement;
  private readonly inviteSection: HTMLDivElement;
  private readonly joinLinkInput: HTMLInputElement;
  private readonly copyLinkButton: HTMLButtonElement;
  private readonly copyFeedbackEl: HTMLParagraphElement;
  private readonly playerCountEl: HTMLSpanElement;
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
  private consoleLog: ConsoleLog | null = null;
  private eventCallback: WaitingRoomEventCallback | null = null;
  private copyFeedbackTimeoutId: number | null = null;
  private hasGameStarted = false;
  private hasExplicitlyLeft = false;
  private cpuAddPending = false;
  private cpuAddTimeoutId: number | null = null;
  private cpuRemovePending = false;
  private cpuRemoveTimeoutId: number | null = null;
  private leavePending = false;

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
    this.gameInfoEl = createElement("p", "waiting-room-game-info") as HTMLParagraphElement;
    header.append(this.titleEl, this.subtitleEl, this.gameInfoEl);

    this.inviteSection = createElement("div", "waiting-room-invite-section") as HTMLDivElement;
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
    this.inviteSection.append(shareHeading, shareHint, shareRow, this.copyFeedbackEl);

    const rosterHeading = createElement("h3", "section-title", "Players");
    this.playerCountEl = createElement("span", "waiting-room-player-count") as HTMLSpanElement;
    rosterHeading.append(this.playerCountEl);
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
      this.inviteSection,
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

  setConsoleLog(log: ConsoleLog): void {
    this.consoleLog = log;
  }

  show(room: Room, gameId: string, gameInfo: GameSessionInfo | null, isHost: boolean): void {
    if (this.boundRoom !== room) {
      this.boundRoom = room;

      room.onMessage(GAME_PLAYERS, (payload: GamePlayersPayload) => {
        if (payload.gameId !== this.gameId) {
          return;
        }

        if (this.cpuAddPending && payload.players.some((p) => p.isCPU)) {
          this.clearCpuAddPending();
        }
        if (this.cpuRemovePending && !payload.players.some((p) => p.isCPU)) {
          this.clearCpuRemovePending();
        }

        this.players = payload.players;
        const localPlayer = this.players.find((player) => player.userId === room.sessionId);
        this.isReady = localPlayer?.isReady ?? this.isReady;
        this.clearError();
        this.renderPlayerList();
        this.updateControls();
        this.updateInviteSectionVisibility();
        this.updatePlayerCount();
      });

      room.onMessage(GAME_STARTED, (payload: GameStartedPayload) => {
        if (payload.gameId !== this.gameId) {
          return;
        }

        this.hasGameStarted = true;
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

        if (this.cpuAddPending) {
          this.clearCpuAddPending();
        }
        if (this.cpuRemovePending) {
          this.clearCpuRemovePending();
        }
        this.renderPlayerList();
        this.consoleLog?.error(payload.message);
      });
    }

    this.room = room;
    this.gameId = gameId;
    this.gameInfo = gameInfo;
    this.isHost = isHost;
    this.isReady = false;
    this.players = [];
    this.hasGameStarted = false;
    this.hasExplicitlyLeft = false;
    this.leavePending = false;
    this.clearCpuAddPending();
    this.clearCpuRemovePending();

    this.titleEl.textContent = gameInfo?.name || "Waiting Room";
    this.subtitleEl.textContent = isHost
      ? "You are hosting. Start when everyone is ready."
      : "Toggle Ready when you are set to play.";

    this.updateJoinLink();
    this.updateInviteSectionVisibility();
    this.updatePlayerCount();
    this.updateGameInfo();
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
    this.hasGameStarted = false;
    this.hasExplicitlyLeft = false;
    this.leavePending = false;
    this.clearCpuAddPending();
    this.clearCpuRemovePending();
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
        if (this.isHost) {
          const cpuUserId = player.userId;
          const removeBtn = createElement("button", "waiting-room-remove-cpu", this.cpuRemovePending ? "⏳" : "✕");
          removeBtn.type = "button";
          removeBtn.title = "Remove CPU player";
          if (this.cpuRemovePending) {
            (removeBtn as HTMLButtonElement).disabled = true;
          } else {
            removeBtn.addEventListener("click", () => this.requestRemoveCpu(cpuUserId));
          }
          meta.append(removeBtn);
        }
      }

      const readyState = createElement(
        "span",
        `waiting-room-ready ${player.isReady ? "ready" : "not-ready"}`,
        player.isReady ? "✅ Ready" : "⬜ Not Ready",
      );

      item.append(meta, readyState);
      this.playerListEl.append(item);
    }

    // Add CPU Player slot (host only, CPU-supporting games, room not full)
    const maxPlayers = this.gameInfo?.maxPlayers ?? 0;
    if (
      this.isHost &&
      this.supportsCpuOpponent() &&
      this.players.length < maxPlayers
    ) {
      const slot = createElement("li", "waiting-room-add-cpu");
      const addBtn = createElement("button", "waiting-room-add-cpu-btn") as HTMLButtonElement;
      addBtn.type = "button";

      if (this.cpuAddPending) {
        addBtn.textContent = "⏳ Adding CPU…";
        addBtn.disabled = true;
        slot.classList.add("pending");
      } else {
        addBtn.textContent = "🤖 Add CPU Player";
        addBtn.addEventListener("click", () => {
          this.requestAddCpu();
        });
      }

      slot.append(addBtn);
      this.playerListEl.append(slot);
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

  private requestAddCpu(): void {
    if (!this.room || !this.gameId || this.cpuAddPending) {
      return;
    }

    this.cpuAddPending = true;
    this.room.send(ADD_CPU_PLAYER, { gameId: this.gameId });
    this.renderPlayerList();

    this.cpuAddTimeoutId = window.setTimeout(() => {
      this.cpuAddTimeoutId = null;
      if (this.cpuAddPending) {
        this.cpuAddPending = false;
        this.renderPlayerList();
      }
    }, 5000);
  }

  private clearCpuAddPending(): void {
    this.cpuAddPending = false;
    if (this.cpuAddTimeoutId !== null) {
      window.clearTimeout(this.cpuAddTimeoutId);
      this.cpuAddTimeoutId = null;
    }
  }

  private requestRemoveCpu(cpuSessionId: string): void {
    if (!this.room || !this.gameId || this.cpuRemovePending) {
      return;
    }

    this.cpuRemovePending = true;
    this.room.send(REMOVE_CPU_PLAYER, { gameId: this.gameId, cpuSessionId });
    this.renderPlayerList();

    this.cpuRemoveTimeoutId = window.setTimeout(() => {
      this.cpuRemoveTimeoutId = null;
      if (this.cpuRemovePending) {
        this.cpuRemovePending = false;
        this.renderPlayerList();
      }
    }, 5000);
  }

  private clearCpuRemovePending(): void {
    this.cpuRemovePending = false;
    if (this.cpuRemoveTimeoutId !== null) {
      window.clearTimeout(this.cpuRemoveTimeoutId);
      this.cpuRemoveTimeoutId = null;
    }
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
    if (this.leavePending) return;
    this.hasExplicitlyLeft = true;
    this.leavePending = true;
    this.leaveButton.disabled = true;
    this.leaveButton.textContent = "Leaving…";
    if (this.room && this.gameId) {
      this.room.send(LEAVE_GAME, { gameId: this.gameId });
    }
    this.hide();
    this.eventCallback?.({ type: "leave" });
  }

  cleanup(): void {
    if (this.hasGameStarted || this.hasExplicitlyLeft) {
      return;
    }

    if (this.room && this.gameId) {
      this.room.send(LEAVE_GAME, { gameId: this.gameId });
    }
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

  private updateInviteSectionVisibility(): void {
    const isFull =
      this.gameInfo != null && this.players.length >= this.gameInfo.maxPlayers;
    this.inviteSection.style.display = isFull ? "none" : "";
  }

  private updatePlayerCount(): void {
    const max = this.gameInfo?.maxPlayers ?? 0;
    this.playerCountEl.textContent = max > 0 ? ` (${this.players.length}/${max})` : "";
  }

  private updateGameInfo(): void {
    if (!this.gameInfo) {
      this.gameInfoEl.textContent = "";
      return;
    }

    const infoParts: string[] = [];

    // Time Control
    if (this.gameInfo.timeControl) {
      const timeLabels: Record<string, string> = {
        "no-limit": "⏱ No Time Limit",
        "blitz": "⏱ Blitz (3:00)",
        "rapid": "⏱ Rapid (10:00)",
        "classical": "⏱ Classical (30:00)",
      };
      infoParts.push(timeLabels[this.gameInfo.timeControl] || "⏱ Time Control");
    }

    // Head-to-Head Mode
    if (this.gameInfo.headToHeadMode) {
      infoParts.push("🖥 Shared Device");
    }

    this.gameInfoEl.textContent = infoParts.join(" • ");
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

  private supportsCpuOpponent(): boolean {
    const gameType = this.gameInfo?.gameType ?? "";
    return gameType === "checkers" || gameType === "backgammon" || gameType === "dominos";
  }
}

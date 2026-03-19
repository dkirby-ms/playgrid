import { CloseCode } from "@colyseus/shared-types";
import { type Room } from "@colyseus/sdk";
import { Application as PixiApplication, Text } from "pixi.js";
import type { GameResult } from "@eschaton/shared";
import {
  buildJoinGameHref,
  clearJoinGameHref,
  getJoinGameIdFromHref,
} from "./joinLinks";
import {
  ConnectionManager,
  ConnectionState,
  type ConnectionErrorEvent,
  type ConnectionStateChangeEvent,
} from "./networking";
import { rendererRegistry } from "./renderers";
import { SceneManager } from "./SceneManager";
import {
  GameScene,
  type GameSceneEnterData,
  type GameSceneEvent,
} from "./scenes/GameScene";
import { LobbyScene, type LobbySceneEnterData } from "./scenes/LobbyScene";
import {
  SetupScene,
  type SetupSceneEnterData,
  type SetupSceneEvent,
} from "./scenes/SetupScene";
import {
  WaitingRoomScene,
  type WaitingRoomSceneEnterData,
  type WaitingRoomSceneEvent,
} from "./scenes/WaitingRoomScene";
import { SandboxScene } from "./scenes/SandboxScene";
import { ReconnectOverlay } from "./ui/ReconnectOverlay";
import { GameOverOverlay } from "./ui/GameOverOverlay";
import { VictoryScreen, type VictoryScreenEvent, type VictoryPlayerInfo } from "./ui/VictoryScreen";
import { HistoryScreen, type HistoryScreenData } from "./ui/HistoryScreen";
import { ConsoleLog } from "./ui/ConsoleLog";
import { JOIN_GAME, type JoinGamePayload, type LobbyEvent } from "./ui/LobbyScreen";
import { GAME_LAYOUT_CHANGE_EVENT } from "./ui/gameLayout";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const STATUS_MARGIN = 12;
const STATUS_HIDE_DELAY_MS = 2500;
const DISPLAY_NAME_STORAGE_KEY = "playgrid.display-name";
const LOBBY_PLAYER_ID_STORAGE_KEY = "playgrid.lobby-player-id";
const ACTIVE_SESSION_STORAGE_KEY = "playgrid.active-session";
const ACTIVE_SESSION_MAX_AGE_MS = 30_000;
const GAME_ENDED_MESSAGE = "game-end";
const RECONNECT_FAILURE_RETURN_DELAY_MS = 1500;
const RECONNECTED_HIDE_DELAY_MS = 1200;

type ColyseusRoom = Room<Record<string, unknown>>;
type Notice = { message: string; tone: "info" | "error" };
type StatusOptions = {
  tone?: "info" | "error";
  persistent?: boolean;
  visibleInGame?: boolean;
};
type RoomWithOptionalId = ColyseusRoom & { id?: string; roomId?: string };
type ActiveSessionRecord = {
  reconnectionToken: string;
  roomId: string;
  gameType: string;
  timestamp: number;
};
type RestoreActiveSessionResult = {
  restored: boolean;
  notice?: Notice;
};

function createStatusText(app: PixiApplication): Text {
  const statusText = new Text({
    text: "",
    style: {
      fontFamily: "monospace",
      fontSize: 13,
      fill: 0xd1d5db,
      align: "left",
    },
  });

  statusText.anchor.set(0, 0);
  statusText.visible = false;
  app.stage.addChild(statusText);
  return statusText;
}

export class PlaygridApp {
  pixiApp!: PixiApplication;
  sceneManager!: SceneManager;
  lobbyRoom: ColyseusRoom | null = null;
  gameRoom: ColyseusRoom | null = null;

  private connectionManager!: ConnectionManager;
  private statusText!: Text;
  private reconnectOverlay!: ReconnectOverlay;
  private gameOverOverlay!: GameOverOverlay;
  private victoryScreen!: VictoryScreen;
  private historyScreen!: HistoryScreen;
  private consoleLog!: ConsoleLog;
  private statusHideTimeoutId: number | null = null;
  private reconnectOverlayHideTimeoutId: number | null = null;
  private reconnectReturnTimeoutId: number | null = null;
  private statusVisibleInGame = false;
  private displayName = "";
  private lobbyPlayerId = "";
  private activeGameType: string | null = null;
  private isDisplayNameUpdatePending = false;
  private gameContainer: HTMLElement | null = null;
  private gameCanvasFrame: HTMLElement | null = null;
  private gameContainerResizeObserver: ResizeObserver | null = null;
  private resizeSyncFrameId: number | null = null;
  private readonly rendererRegistry = rendererRegistry;
  private readonly lobbyScene = new LobbyScene((event) => {
    void this.handleLobbyEvent(event);
  });
  private readonly setupScene = new SetupScene((event) => {
    void this.handleSetupSceneEvent(event);
  });
  private readonly waitingRoomScene = new WaitingRoomScene((event) => {
    void this.handleWaitingRoomEvent(event);
  });
  private readonly gameScene = new GameScene(this.rendererRegistry, (event) => {
    void this.handleGameSceneEvent(event);
  });
  private readonly sandboxScene = new SandboxScene(this.rendererRegistry);

  private createVersionFooter(): void {
    const footer = document.createElement("div");
    footer.style.cssText =
      "position:fixed;bottom:8px;left:50%;transform:translateX(-50%);font-size:11px;color:rgba(255,255,255,0.3);z-index:999;font-family:monospace;text-align:center;display:flex;gap:12px;align-items:center";

    const versionText = document.createElement("span");
    versionText.textContent = `v${__APP_VERSION__}`;
    versionText.style.cssText = "pointer-events:none";

    const separator = document.createElement("span");
    separator.textContent = "•";
    separator.style.cssText = "pointer-events:none";

    const feedbackLink = document.createElement("a");
    feedbackLink.textContent = "Submit Feedback";
    feedbackLink.href = "https://github.com/dkirby-ms/playgrid/issues";
    feedbackLink.target = "_blank";
    feedbackLink.rel = "noopener noreferrer";
    feedbackLink.style.cssText =
      "color:rgba(255,255,255,0.4);text-decoration:none;transition:color 0.2s ease;pointer-events:auto";
    feedbackLink.onmouseover = () => {
      feedbackLink.style.color = "rgba(255,255,255,0.7)";
    };
    feedbackLink.onmouseout = () => {
      feedbackLink.style.color = "rgba(255,255,255,0.4)";
    };

    const separator2 = document.createElement("span");
    separator2.textContent = "•";
    separator2.style.cssText = "pointer-events:none";

    const copyright = document.createElement("span");
    copyright.textContent = "© 2026 Kirbytoso. All rights reserved.";
    copyright.style.cssText = "pointer-events:none";

    footer.append(versionText, separator, copyright, separator2, feedbackLink);
    document.body.appendChild(footer);
  }

  async init(container: HTMLElement): Promise<void> {
    const gameContainer = this.getGameContainer(container);
    this.gameContainer = gameContainer;
    const { canvasFrame } = this.createGameLayout(gameContainer);
    this.gameCanvasFrame = canvasFrame;

    this.createVersionFooter();

    this.pixiApp = new PixiApplication();
    await this.pixiApp.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x1a1a2e,
      resizeTo: canvasFrame,
    });

    canvasFrame.appendChild(this.pixiApp.canvas);

    this.connectionManager = new ConnectionManager();
    this.setupConnectionListeners();

    this.sceneManager = new SceneManager(this.pixiApp.stage);
    this.sceneManager.register(this.lobbyScene);
    this.sceneManager.register(this.setupScene);
    this.sceneManager.register(this.waitingRoomScene);
    this.sceneManager.register(this.gameScene);
    this.sceneManager.register(this.sandboxScene);

    this.displayName = this.loadDisplayName();
    this.lobbyPlayerId = this.loadLobbyPlayerId();
    this.lobbyScene.setDisplayName(this.displayName);

    this.statusText = createStatusText(this.pixiApp);
    this.reconnectOverlay = new ReconnectOverlay();
    this.gameOverOverlay = new GameOverOverlay();
    this.victoryScreen = new VictoryScreen();
    this.historyScreen = new HistoryScreen();
    this.consoleLog = new ConsoleLog();
    this.lobbyScene.setConsoleLog(this.consoleLog);
    this.setupScene.setConsoleLog(this.consoleLog);
    this.waitingRoomScene.setConsoleLog(this.consoleLog);
    window.addEventListener("beforeunload", () => this.persistSessionForRefresh());
    window.addEventListener("pagehide", () => this.persistSessionForRefresh());
    window.addEventListener("resize", () => this.scheduleViewportSync());
    window.addEventListener(GAME_LAYOUT_CHANGE_EVENT, () => this.scheduleViewportSync());
    this.observeGameContainer(canvasFrame);
    this.layoutStatusText();

    this.pixiApp.ticker.add(() => {
      this.sceneManager.update(this.pixiApp.ticker.deltaMS);
      this.layoutStatusText();
    });

    const sandboxMatch = this.detectSandboxRoute();
    if (sandboxMatch) {
      await this.transitionTo(this.sandboxScene.name, { gameType: sandboxMatch });
      return;
    }

    const restoredSession = await this.tryRestoreActiveSession();
    if (!restoredSession.restored) {
      await this.connectToLobby(restoredSession.notice);
    }
  }

  private detectSandboxRoute(): string | null {
    const hash = window.location.hash;
    const path = window.location.pathname;
    
    const hashMatch = hash.match(/^#\/sandbox\/(\w+)$/);
    if (hashMatch) {
      return hashMatch[1];
    }
    
    const pathMatch = path.match(/\/sandbox\/(\w+)$/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    return null;
  }

  async joinGame(roomId: string, gameType?: string, spectator = false): Promise<void> {
    this.ensureInitialized();
    this.syncWaitingRoomJoinUrl(null);
    this.setStatus("Joining game room…", { persistent: true, visibleInGame: true });

    try {
      const room = await this.connectionManager.joinGame(roomId, { spectator });
      const roomLabel = this.getRoomLabel(room);
      const resolvedGameType = gameType ?? room.name;
      this.activeGameType = resolvedGameType;
      this.gameRoom = room;
      this.bindGameRoom(room, resolvedGameType);
      this.persistActiveSession(room, resolvedGameType);
      const statusMessage = spectator
        ? `Spectating — Room: ${roomLabel}`
        : `Connected — Room: ${roomLabel}`;
      this.setStatus(statusMessage, { visibleInGame: true });
      const enterData: GameSceneEnterData = {
        room,
        gameType: resolvedGameType,
      };
      await this.transitionTo(this.gameScene.name, enterData);
      console.log(`[playgrid] Joined game room: ${roomLabel}${spectator ? " (spectator)" : ""}`);
    } catch (error) {
      console.error("[playgrid] Failed to join game room:", error);
      this.gameRoom = null;
      await this.showLobby({ message: "Could not join that game room.", tone: "error" });
    }
  }

  async leaveGame(): Promise<void> {
    const room = this.gameRoom;
    const roomLabel = this.getRoomLabel(room);

    this.clearActiveSession();
    this.clearReconnectOverlayFeedback();
    this.activeGameType = null;
    this.gameRoom = null;

    await this.connectionManager.leaveGame(room);
    console.log(`[playgrid] Left game room ${roomLabel}`);

    await this.returnToLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
  }

  private async connectToLobby(notice?: Notice): Promise<void> {
    this.ensureInitialized();
    this.lobbyRoom = null;
    this.gameRoom = null;
    this.activeGameType = null;
    this.waitingRoomScene.hideOverlay();
    this.setupScene.hideOverlay();
    this.clearReconnectOverlayFeedback();
    this.setStatus("Connecting to lobby…", { persistent: true });

    try {
      const joinOptions = {
        ...(this.displayName ? { displayName: this.displayName } : {}),
        ...(this.lobbyPlayerId ? { playerId: this.lobbyPlayerId } : {}),
      };
      const room = await this.connectionManager.joinLobby(joinOptions);
      this.lobbyRoom = room;
      this.lobbyScene.bindToRoom(room);
      this.lobbyScene.setDisplayName(this.displayName);
      await this.showLobby(notice);
      console.log(`[playgrid] Joined lobby room: ${this.getRoomLabel(room)}`);

      room.onLeave((code) => {
        if (this.lobbyRoom?.id !== room.id) {
          return;
        }

        void this.handleLobbyRoomLeave(room, code);
      });

      this.autoJoinWaitingRoomFromUrl(room);
    } catch (error) {
      console.error("[playgrid] Lobby connection failed:", error);
      const message =
        error instanceof Error ? error.message : "Connection failed — is the server running?";
      await this.transitionTo(this.lobbyScene.name);
      this.lobbyScene.setDisplayName(this.displayName);
      this.setStatus(message, { tone: "error", persistent: true });
      this.lobbyScene.showConnectionError(message);
    }
  }

  private async handleLobbyEvent(event: LobbyEvent): Promise<void> {
    if (event.type === "error") {
      this.setStatus(event.message, { tone: "error", persistent: true });
      return;
    }

    if (event.type === "set_display_name") {
      await this.handleDisplayNameUpdate(event.displayName);
      return;
    }

    if (event.type === "setup") {
      if (!this.lobbyRoom) {
        this.lobbyScene.showConnectionError("Lobby room is unavailable.");
        return;
      }

      const data: SetupSceneEnterData = {
        room: this.lobbyRoom,
        mode: "create",
        gameType: event.gameType,
      };
      this.setStatus(`Setting up ${event.gameType} game…`);
      await this.transitionTo(this.setupScene.name, data);
      return;
    }

    if (event.type === "waiting") {
      if (!this.lobbyRoom) {
        this.lobbyScene.showConnectionError("Lobby room is unavailable.");
        return;
      }

      this.syncWaitingRoomJoinUrl(event.gameId);
      const data: SetupSceneEnterData = {
        room: this.lobbyRoom,
        mode: "waiting",
        gameType: event.gameInfo?.gameType ?? "checkers",
        gameId: event.gameId,
        gameInfo: event.gameInfo,
        isHost: event.isHost,
      };

      this.setStatus(`Setup — ${event.gameInfo?.name ?? "Game"}`);
      await this.transitionTo(this.setupScene.name, data);
      return;
    }

    await this.joinGame(event.roomId, event.gameType);
  }

  private async handleSetupSceneEvent(event: SetupSceneEvent): Promise<void> {
    if (event.type === "leave") {
      this.syncWaitingRoomJoinUrl(null);
      await this.showLobby({ message: "Returned to the lobby browser.", tone: "info" });
      return;
    }

    await this.joinGame(event.roomId, event.gameType);
  }

  private async handleWaitingRoomEvent(event: WaitingRoomSceneEvent): Promise<void> {
    if (event.type === "leave") {
      this.syncWaitingRoomJoinUrl(null);
      await this.showLobby({ message: "Returned to the lobby browser.", tone: "info" });
      return;
    }

    await this.joinGame(event.roomId, event.gameType);
  }

  private async handleGameSceneEvent(event: GameSceneEvent): Promise<void> {
    if (event.type === "leave_game") {
      await this.leaveGame();
    }
  }

  private bindGameRoom(room: ColyseusRoom, gameType: string): void {
    room.onMessage(GAME_ENDED_MESSAGE, (result: GameResult) => {
      if (this.gameRoom !== room) {
        return;
      }

      this.handleGameEnd(result);
    });

    room.onDrop((code) => {
      if (this.gameRoom !== room) {
        return;
      }

      this.handleGameRoomDrop(room, code);
    });

    room.onReconnect(() => {
      if (this.gameRoom !== room) {
        return;
      }

      this.handleGameRoomReconnect(room, gameType);
    });

    room.onLeave((code) => {
      if (this.gameRoom !== room) {
        return;
      }

      void this.handleGameRoomLeave(room, code);
    });
  }

  private handleGameEnd(result: GameResult): void {
    this.clearActiveSession();
    this.clearReconnectReturnTimeout();
    this.reconnectOverlay.hide();

    const sessionId = this.gameRoom?.sessionId ?? "";
    const gameType = this.activeGameType ?? this.gameRoom?.name ?? "checkers";
    const players = this.extractVictoryPlayers();
    const victoryData = { result, sessionId, gameType, players };

    const endMsg = result.type === "win"
      ? (result.winnerId === sessionId ? "Victory! You won the game." : "Defeat — opponent wins.")
      : result.type === "draw"
        ? "Game ended in a draw."
        : result.type === "forfeit"
          ? "Game ended by forfeit."
          : result.type === "timeout"
            ? "Game ended due to timeout."
            : "Game over.";
    this.consoleLog?.log(endMsg, result.winnerId === sessionId ? "success" : "info");

    this.showVictoryScreenWithHistory(victoryData);
  }

  private showVictoryScreenWithHistory(
    victoryData: { result: GameResult; sessionId: string; gameType: string; players: VictoryPlayerInfo[] },
  ): void {
    this.victoryScreen.show(victoryData, (event: VictoryScreenEvent) => {
      if (event.type === "view_history") {
        this.victoryScreen.hide();
        const meta = (victoryData.result.metadata ?? {}) as Record<string, unknown>;
        const moveHistory = (Array.isArray(meta.moveHistory) ? meta.moveHistory : []) as import("@eschaton/shared").MoveEntry[];
        const historyData: HistoryScreenData = {
          moveHistory,
          gameType: victoryData.gameType,
          metadata: meta,
        };
        this.historyScreen.show(historyData, () => {
          this.showVictoryScreenWithHistory(victoryData);
        });
        return;
      }

      this.victoryScreen.hide();
      void this.handleVictoryEvent(event);
    });
  }

  private async handleVictoryEvent(event: VictoryScreenEvent): Promise<void> {
    if (event.type === "play_again") {
      if (!this.lobbyRoom) {
        await this.connectToLobby();
      }

      if (this.lobbyRoom) {
        const data: SetupSceneEnterData = {
          room: this.lobbyRoom,
          mode: "create",
          gameType: event.gameType,
        };
        this.setStatus(`Setting up ${event.gameType} game…`);
        await this.transitionTo(this.setupScene.name, data);
        return;
      }

      await this.returnToLobby({ message: "Game ended. Back in the lobby.", tone: "info" });
      return;
    }

    await this.returnToLobby({ message: "Game ended. Back in the lobby.", tone: "info" });
  }

  private extractVictoryPlayers(): VictoryPlayerInfo[] {
    const state = this.gameRoom?.state as Record<string, unknown> | undefined;
    const players: VictoryPlayerInfo[] = [];

    if (!state) return players;

    const playerEntries = (
      state.players as
        | { entries?: () => Iterable<[string, Record<string, unknown>]> }
        | undefined
    )?.entries?.();

    for (const [sessionId, player] of playerEntries ?? []) {
      if (!player.isSpectator) {
        players.push({
          sessionId,
          displayName: typeof player.displayName === "string" ? player.displayName : "Player",
          playerIndex: typeof player.playerIndex === "number" ? player.playerIndex : -1,
        });
      }
    }

    return players;
  }


  private handleGameRoomDrop(room: ColyseusRoom, code: number): void {
    console.log(`[playgrid] Dropped game room ${this.getRoomLabel(room)} (code: ${code})`);
    this.clearReconnectReturnTimeout();
    this.consoleLog?.warn("Trying to restore your game session…");
    this.setStatus("Reconnecting...", { persistent: true, visibleInGame: true });
  }

  private handleGameRoomReconnect(room: ColyseusRoom, gameType: string): void {
    console.log(`[playgrid] Reconnected game room ${this.getRoomLabel(room)}`);
    this.persistActiveSession(room, gameType);
    this.clearReconnectReturnTimeout();
    this.consoleLog?.success("You're back in the game.");
    this.setStatus("Reconnected!", { visibleInGame: true });
    this.scheduleReconnectOverlayHide();
  }

  private async handleGameRoomLeave(room: ColyseusRoom, code: number): Promise<void> {
    console.log(`[playgrid] Left game room ${this.getRoomLabel(room)} (code: ${code})`);

    if (code === CloseCode.CONSENTED) {
      this.clearActiveSession();
      this.clearReconnectOverlayFeedback();
      this.activeGameType = null;
      this.gameRoom = null;
      this.consoleLog?.info("Left game room.");
      await this.returnToLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
      return;
    }

    this.clearActiveSession();
    this.clearReconnectOverlayHideTimeout();
    this.activeGameType = null;
    this.gameRoom = null;
    this.consoleLog?.error("Returning to lobby…");
    this.setStatus("Connection lost. Returning to lobby...", {
      tone: "error",
      persistent: true,
      visibleInGame: true,
    });
    this.scheduleReconnectReturn();
  }

  private async handleLobbyRoomLeave(room: ColyseusRoom, code: number): Promise<void> {
    if (this.lobbyRoom?.id !== room.id) {
      return;
    }

    console.log(`[playgrid] Left lobby room (code: ${code})`);
    this.lobbyRoom = null;
    this.waitingRoomScene.hideOverlay();
    this.setupScene.hideOverlay();
    this.lobbyScene.showConnectionError("Lost connection to the lobby room.");
    this.setStatus("Lobby disconnected.", { tone: "error", persistent: true });

    this.connectionManager.attemptReconnect(() => this.connectToLobby());
  }

  private async returnToLobby(notice?: Notice): Promise<void> {
    if (this.lobbyRoom) {
      this.clearReconnectOverlayFeedback();
      await this.showLobby(notice);
      return;
    }

    await this.connectToLobby(notice);
  }

  private async showLobby(notice?: Notice): Promise<void> {
    const data: LobbySceneEnterData | undefined = notice ? { notice } : undefined;
    await this.transitionTo(this.lobbyScene.name, data);
    this.lobbyScene.setDisplayName(this.displayName);

    if (this.lobbyRoom) {
      this.setStatus("Lobby connected — create or join a game.");
      return;
    }

    this.setStatus("Connecting to lobby…", { persistent: true });
  }

  private async transitionTo(name: string, data?: unknown): Promise<void> {
    this.ensureInitialized();
    await this.sceneManager.transitionTo(name, data);
    this.sceneManager.resize(this.pixiApp.screen.width, this.pixiApp.screen.height);
    this.pixiApp.stage.addChild(this.statusText);
    this.layoutStatusText();
    this.scheduleViewportSync();
  }

  private setStatus(message: string, options: StatusOptions = {}): void {
    if (!this.statusText) {
      return;
    }

    const {
      tone = "info",
      persistent = tone === "error",
      visibleInGame = false,
    } = options;

    this.clearStatusHideTimeout();
    this.statusVisibleInGame = visibleInGame;
    this.statusText.text = message;
    this.statusText.style.fill = tone === "error" ? 0xff7b72 : 0xd1d5db;
    this.layoutStatusText();

    if (message.length > 0) {
      this.consoleLog?.log(message, tone === "error" ? "error" : "info");
    }

    if (!persistent && message.length > 0) {
      this.statusHideTimeoutId = window.setTimeout(() => {
        if (this.statusText.text === message) {
          this.hideStatus();
        }
      }, STATUS_HIDE_DELAY_MS);
    }
  }

  private hideStatus(): void {
    if (!this.statusText) {
      return;
    }

    this.clearStatusHideTimeout();
    this.statusVisibleInGame = false;
    this.statusText.text = "";
    this.statusText.visible = false;
  }

  private clearStatusHideTimeout(): void {
    if (this.statusHideTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.statusHideTimeoutId);
    this.statusHideTimeoutId = null;
  }

  private scheduleReconnectOverlayHide(): void {
    this.clearReconnectOverlayHideTimeout();
    this.reconnectOverlayHideTimeoutId = window.setTimeout(() => {
      this.reconnectOverlayHideTimeoutId = null;
      this.reconnectOverlay.hide();
    }, RECONNECTED_HIDE_DELAY_MS);
  }

  private clearReconnectOverlayHideTimeout(): void {
    if (this.reconnectOverlayHideTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.reconnectOverlayHideTimeoutId);
    this.reconnectOverlayHideTimeoutId = null;
  }

  private scheduleReconnectReturn(): void {
    this.clearReconnectReturnTimeout();
    this.reconnectReturnTimeoutId = window.setTimeout(() => {
      this.reconnectReturnTimeoutId = null;
      this.reconnectOverlay.hide();
      void this.returnToLobby({
        message: "Connection lost. Back in the lobby.",
        tone: "error",
      });
    }, RECONNECT_FAILURE_RETURN_DELAY_MS);
  }

  private clearReconnectReturnTimeout(): void {
    if (this.reconnectReturnTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.reconnectReturnTimeoutId);
    this.reconnectReturnTimeoutId = null;
  }

  private clearReconnectOverlayFeedback(): void {
    this.clearReconnectOverlayHideTimeout();
    this.clearReconnectReturnTimeout();
    this.reconnectOverlay.hide();
  }

  private persistSessionForRefresh(): void {
    if (!this.gameRoom || !this.activeGameType) {
      return;
    }

    this.persistActiveSession(this.gameRoom, this.activeGameType);
  }

  private persistActiveSession(room: ColyseusRoom, gameType: string): void {
    if (!room.reconnectionToken || !room.roomId) {
      return;
    }

    const sessionRecord: ActiveSessionRecord = {
      reconnectionToken: room.reconnectionToken,
      roomId: room.roomId,
      gameType,
      timestamp: Date.now(),
    };

    try {
      window.sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(sessionRecord));
    } catch {
      // Ignore storage failures and keep reconnect limited to the current runtime.
    }
  }

  private loadActiveSession(): ActiveSessionRecord | null {
    try {
      const rawValue = window.sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as Partial<ActiveSessionRecord>;
      if (
        typeof parsedValue.reconnectionToken !== "string" ||
        typeof parsedValue.roomId !== "string" ||
        typeof parsedValue.gameType !== "string" ||
        typeof parsedValue.timestamp !== "number"
      ) {
        this.clearActiveSession();
        return null;
      }

      return {
        reconnectionToken: parsedValue.reconnectionToken,
        roomId: parsedValue.roomId,
        gameType: parsedValue.gameType,
        timestamp: parsedValue.timestamp,
      };
    } catch {
      this.clearActiveSession();
      return null;
    }
  }

  private clearActiveSession(): void {
    try {
      window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage failures and keep runtime state consistent.
    }
  }

  private async tryRestoreActiveSession(): Promise<RestoreActiveSessionResult> {
    const activeSession = this.loadActiveSession();
    if (!activeSession) {
      return { restored: false };
    }

    if (Date.now() - activeSession.timestamp >= ACTIVE_SESSION_MAX_AGE_MS) {
      this.clearActiveSession();
      return { restored: false };
    }

    this.consoleLog?.warn("Rejoining your active game…");
    this.setStatus("Rejoining active game...", { persistent: true, visibleInGame: true });

    try {
      const room = await this.connectionManager.reconnect(activeSession.reconnectionToken);
      this.activeGameType = activeSession.gameType;
      this.gameRoom = room;
      this.bindGameRoom(room, activeSession.gameType);
      this.persistActiveSession(room, activeSession.gameType);
      await this.transitionTo(this.gameScene.name, {
        room,
        gameType: activeSession.gameType,
      } satisfies GameSceneEnterData);
      this.syncWaitingRoomJoinUrl(null);
      this.reconnectOverlay.hide();
      this.setStatus(`Rejoined — Room: ${this.getRoomLabel(room)}`, { visibleInGame: true });
      console.log(`[playgrid] Rejoined game room: ${this.getRoomLabel(room)}`);
      return { restored: true };
    } catch (error) {
      console.error(
        `[playgrid] Failed to restore active game session ${activeSession.roomId}:`,
        error,
      );
      this.clearActiveSession();
      this.reconnectOverlay.hide();
      return {
        restored: false,
        notice: {
          message: "Previous game session expired. Back in the lobby.",
          tone: "info",
        },
      };
    }
  }

  private autoJoinWaitingRoomFromUrl(room: ColyseusRoom): void {
    const joinGameId = getJoinGameIdFromHref(window.location.href);
    if (!joinGameId) {
      return;
    }

    const payload: JoinGamePayload = { gameId: joinGameId };
    this.setStatus("Joining shared waiting room…", { persistent: true });
    room.send(JOIN_GAME, payload);
  }

  private syncWaitingRoomJoinUrl(gameId: string | null): void {
    const nextHref = gameId
      ? buildJoinGameHref(window.location.href, gameId)
      : clearJoinGameHref(window.location.href);

    if (nextHref === window.location.href) {
      return;
    }

    window.history.replaceState(window.history.state, "", nextHref);
  }

  private getRoomLabel(room: ColyseusRoom | null): string {
    if (!room) {
      return "unknown";
    }

    const roomWithOptionalId = room as RoomWithOptionalId;
    return roomWithOptionalId.roomId ?? roomWithOptionalId.id ?? room.name ?? "unknown";
  }

  private async handleDisplayNameUpdate(displayName: string): Promise<void> {
    if (this.isDisplayNameUpdatePending) {
      return;
    }

    this.isDisplayNameUpdatePending = true;

    try {
      if (displayName === this.displayName && this.lobbyRoom) {
        this.consoleLog?.success("Player name saved.");
        return;
      }

      this.displayName = displayName;
      this.saveDisplayName(displayName);
      this.lobbyScene.setDisplayName(displayName);

      const room = this.lobbyRoom;
      this.lobbyRoom = null;
      if (room) {
        await this.connectionManager.leaveGame(room);
      }

      await this.connectToLobby({ message: "Player name saved.", tone: "info" });
    } finally {
      this.isDisplayNameUpdatePending = false;
    }
  }

  private loadDisplayName(): string {
    try {
      return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  }

  private loadLobbyPlayerId(): string {
    const fallbackPlayerId = globalThis.crypto?.randomUUID?.()
      ?? `lobby-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const savedPlayerId = window.sessionStorage.getItem(LOBBY_PLAYER_ID_STORAGE_KEY)?.trim();
      if (savedPlayerId) {
        return savedPlayerId;
      }

      window.sessionStorage.setItem(LOBBY_PLAYER_ID_STORAGE_KEY, fallbackPlayerId);
    } catch {
      // Ignore storage failures and fall back to an in-memory ID for this page lifecycle.
    }

    return fallbackPlayerId;
  }

  private saveDisplayName(displayName: string): void {
    try {
      if (displayName) {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);
        return;
      }

      window.localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    } catch {
      // Ignore storage failures and keep the in-memory name for the session.
    }
  }

  private layoutStatusText(): void {
    if (!this.statusText) {
      return;
    }

    this.statusText.x = STATUS_MARGIN;
    this.statusText.y = STATUS_MARGIN;
    this.statusText.visible =
      this.statusText.text.length > 0 && (!this.gameRoom || this.statusVisibleInGame);
  }

  private observeGameContainer(gameContainer: HTMLElement): void {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    this.gameContainerResizeObserver?.disconnect();
    this.gameContainerResizeObserver = new ResizeObserver(() => {
      this.scheduleViewportSync();
    });
    this.gameContainerResizeObserver.observe(gameContainer);
  }

  private scheduleViewportSync(): void {
    if (this.resizeSyncFrameId !== null) {
      window.cancelAnimationFrame(this.resizeSyncFrameId);
    }

    this.resizeSyncFrameId = window.requestAnimationFrame(() => {
      this.resizeSyncFrameId = null;

      if (!this.pixiApp || !this.sceneManager || !this.gameCanvasFrame) {
        return;
      }

      this.pixiApp.resize();
      this.sceneManager.resize(this.pixiApp.screen.width, this.pixiApp.screen.height);
      this.layoutStatusText();
    });
  }

  private getGameContainer(container: HTMLElement): HTMLElement {
    const gameContainer = container.querySelector<HTMLElement>("#game-container");
    if (!gameContainer) {
      throw new Error("Missing #game-container");
    }

    return gameContainer;
  }

  private createGameLayout(gameContainer: HTMLElement): {
    container: HTMLDivElement;
    canvasFrame: HTMLDivElement;
  } {
    const layout = document.createElement("div");
    layout.id = "game-layout";
    layout.className = "game-layout";

    const header = document.createElement("div");
    header.id = "game-header";
    header.className = "game-header-slot";
    header.style.display = "none";

    const topBar = document.createElement("div");
    topBar.id = "game-info-top";
    topBar.className = "game-info-slot";
    topBar.style.display = "none";

    const canvasFrame = document.createElement("div");
    canvasFrame.id = "game-canvas-frame";
    canvasFrame.className = "game-canvas-frame";

    const bottomBar = document.createElement("div");
    bottomBar.id = "game-info-bottom";
    bottomBar.className = "game-info-slot";
    bottomBar.style.display = "none";

    layout.append(header, topBar, canvasFrame, bottomBar);
    gameContainer.replaceChildren(layout);

    return { container: layout, canvasFrame };
  }

  private ensureInitialized(): void {
    if (!this.connectionManager || !this.sceneManager || !this.pixiApp) {
      throw new Error("PlaygridApp is not initialized.");
    }
  }

  private setupConnectionListeners(): void {
    this.connectionManager.on((event) => {
      if ("state" in event) {
        this.handleConnectionStateChange(event);
      } else {
        this.handleConnectionError(event);
      }
    });
  }

  private handleConnectionStateChange(event: ConnectionStateChangeEvent): void {
    const { state, previousState } = event;

    if (state === ConnectionState.RECONNECTING) {
      this.setStatus("Reconnecting…", { tone: "error", persistent: true });
    } else if (
      state === ConnectionState.CONNECTED &&
      previousState === ConnectionState.RECONNECTING
    ) {
      this.setStatus("Reconnected!", { tone: "info" });
    }
  }

  private handleConnectionError(event: ConnectionErrorEvent): void {
    const { message, context } = event;

    if (context === "lobby" || context === "joinLobby") {
      this.consoleLog?.error(message);
    }

    this.consoleLog?.error(`Connection error: ${message}`);
    this.setStatus(`Error: ${message}`, { tone: "error", persistent: true });
  }
}

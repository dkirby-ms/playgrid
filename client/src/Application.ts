import { Client, type Room } from "@colyseus/sdk";
import { Application as PixiApplication, Text } from "pixi.js";
import { rendererRegistry } from "./renderers";
import { SceneManager } from "./SceneManager";
import {
  GameScene,
  type GameSceneEnterData,
  type GameSceneEvent,
} from "./scenes/GameScene";
import { LobbyScene, type LobbySceneEnterData } from "./scenes/LobbyScene";
import {
  WaitingRoomScene,
  type WaitingRoomSceneEnterData,
  type WaitingRoomSceneEvent,
} from "./scenes/WaitingRoomScene";
import type { LobbyEvent } from "./ui/LobbyScreen";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const STATUS_MARGIN = 12;
const STATUS_HIDE_DELAY_MS = 2500;
const DISPLAY_NAME_STORAGE_KEY = "playgrid.display-name";

type ColyseusRoom = Room<Record<string, unknown>>;
type Notice = { message: string; tone: "info" | "error" };
type StatusOptions = {
  tone?: "info" | "error";
  persistent?: boolean;
  visibleInGame?: boolean;
};
type RoomWithOptionalId = ColyseusRoom & { id?: string; roomId?: string };

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
  client!: Client;
  sceneManager!: SceneManager;
  lobbyRoom: ColyseusRoom | null = null;
  gameRoom: ColyseusRoom | null = null;

  private statusText!: Text;
  private statusHideTimeoutId: number | null = null;
  private statusVisibleInGame = false;
  private displayName = "";
  private isDisplayNameUpdatePending = false;
  private readonly rendererRegistry = rendererRegistry;
  private readonly lobbyScene = new LobbyScene((event) => {
    void this.handleLobbyEvent(event);
  });
  private readonly waitingRoomScene = new WaitingRoomScene((event) => {
    void this.handleWaitingRoomEvent(event);
  });
  private readonly gameScene = new GameScene(this.rendererRegistry, (event) => {
    void this.handleGameSceneEvent(event);
  });

  private createVersionFooter(): void {
    const footer = document.createElement("div");
    footer.textContent = `v${__APP_VERSION__}`;
    footer.style.cssText =
      "position:fixed;bottom:4px;right:8px;font-size:11px;color:rgba(255,255,255,0.3);pointer-events:none;z-index:999;font-family:monospace";
    document.body.appendChild(footer);
  }

  async init(container: HTMLElement): Promise<void> {
    const gameContainer = this.getGameContainer(container);

    this.createVersionFooter();

    this.pixiApp = new PixiApplication();
    await this.pixiApp.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x1a1a2e,
      resizeTo: gameContainer,
    });

    gameContainer.appendChild(this.pixiApp.canvas);

    this.connectionManager = new ConnectionManager();
    this.setupConnectionListeners();

    this.sceneManager = new SceneManager(this.pixiApp.stage);
    this.sceneManager.register(this.lobbyScene);
    this.sceneManager.register(this.waitingRoomScene);
    this.sceneManager.register(this.gameScene);

    this.displayName = this.loadDisplayName();
    this.lobbyScene.setDisplayName(this.displayName);

    this.statusText = createStatusText(this.pixiApp);
    this.layoutStatusText();

    this.pixiApp.ticker.add(() => {
      this.sceneManager.update(this.pixiApp.ticker.deltaMS);
      this.layoutStatusText();
    });

    await this.connectToLobby();
  }

  async joinGame(roomId: string, gameType?: string, spectator = false): Promise<void> {
    this.ensureInitialized();
    this.setStatus("Joining game room…", { persistent: true, visibleInGame: true });

    try {
      const room = await this.connectionManager.joinGame(roomId, { spectator });
      const roomLabel = this.getRoomLabel(room);
      this.gameRoom = room;
      this.bindGameRoom(room);
      const statusMessage = spectator
        ? `Spectating — Room: ${roomLabel}`
        : `Connected — Room: ${roomLabel}`;
      this.setStatus(statusMessage, { visibleInGame: true });
      const enterData: GameSceneEnterData = {
        room,
        gameType: gameType ?? room.name,
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

    this.gameRoom = null;

    await this.connectionManager.leaveGame(room);
    console.log(`[playgrid] Left game room ${roomLabel}`);

    await this.showLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
  }

  private async connectToLobby(notice?: Notice): Promise<void> {
    this.ensureInitialized();
    this.lobbyRoom = null;
    this.gameRoom = null;
    this.waitingRoomScene.hideOverlay();
    this.setStatus("Connecting to lobby…", { persistent: true });

    try {
      const joinOptions = this.displayName ? { displayName: this.displayName } : undefined;
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

    if (event.type === "waiting") {
      if (!this.lobbyRoom) {
        this.lobbyScene.showConnectionError("Lobby room is unavailable.");
        return;
      }

      const data: WaitingRoomSceneEnterData = {
        room: this.lobbyRoom,
        gameId: event.gameId,
        gameInfo: event.gameInfo,
        isHost: event.isHost,
      };

      this.setStatus(`Waiting room — ${event.gameInfo?.name ?? "Game"}`);
      await this.transitionTo(this.waitingRoomScene.name, data);
      return;
    }

    await this.joinGame(event.roomId, event.gameType, event.spectator);
  }

  private async handleWaitingRoomEvent(event: WaitingRoomSceneEvent): Promise<void> {
    if (event.type === "leave") {
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

  private bindGameRoom(room: ColyseusRoom): void {
    room.onLeave((code) => {
      if (this.gameRoom !== room) {
        return;
      }

      console.log(`[playgrid] Left game room ${this.getRoomLabel(room)} (code: ${code})`);
      this.gameRoom = null;
      void this.showLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
    });
  }

  private async handleLobbyRoomLeave(room: ColyseusRoom, code: number): Promise<void> {
    if (this.lobbyRoom?.id !== room.id) {
      return;
    }

    console.log(`[playgrid] Left lobby room (code: ${code})`);
    this.lobbyRoom = null;
    this.waitingRoomScene.hideOverlay();
    this.lobbyScene.showConnectionError("Lost connection to the lobby room.");
    this.setStatus("Lobby disconnected.", { tone: "error", persistent: true });

    this.connectionManager.attemptReconnect(() => this.connectToLobby());
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
        this.lobbyScene.showNotice("Player name saved.", "info");
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

  private getGameContainer(container: HTMLElement): HTMLElement {
    const gameContainer = container.querySelector<HTMLElement>("#game-container");
    if (!gameContainer) {
      throw new Error("Missing #game-container");
    }

    return gameContainer;
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
      this.lobbyScene.showNotice(message, "error");
    }

    this.setStatus(`Error: ${message}`, { tone: "error", persistent: true });
  }
}

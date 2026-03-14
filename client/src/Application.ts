import { Client, type Room } from "@colyseus/sdk";
import { Application as PixiApplication, Text } from "pixi.js";
import { RendererRegistry } from "./renderers";
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
const LOBBY_ROOM_NAME = "lobby";

type ColyseusRoom = Room<Record<string, unknown>>;
type Notice = { message: string; tone: "info" | "error" };

function getServerUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:2567`;
}

function createStatusText(app: PixiApplication): Text {
  const statusText = new Text({
    text: "Connecting to lobby…",
    style: {
      fontFamily: "monospace",
      fontSize: 18,
      fill: 0xffffff,
      align: "center",
    },
  });

  statusText.anchor.set(0.5);
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
  private readonly rendererRegistry = new RendererRegistry();
  private readonly lobbyScene = new LobbyScene((event) => {
    void this.handleLobbyEvent(event);
  });
  private readonly waitingRoomScene = new WaitingRoomScene((event) => {
    void this.handleWaitingRoomEvent(event);
  });
  private readonly gameScene = new GameScene(this.rendererRegistry, (event) => {
    void this.handleGameSceneEvent(event);
  });

  async init(container: HTMLElement): Promise<void> {
    const gameContainer = this.getGameContainer(container);

    this.pixiApp = new PixiApplication();
    await this.pixiApp.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x1a1a2e,
      resizeTo: gameContainer,
    });

    gameContainer.appendChild(this.pixiApp.canvas);

    this.client = new Client(getServerUrl());
    this.sceneManager = new SceneManager(this.pixiApp.stage);
    this.sceneManager.register(this.lobbyScene);
    this.sceneManager.register(this.waitingRoomScene);
    this.sceneManager.register(this.gameScene);

    this.statusText = createStatusText(this.pixiApp);
    this.layoutStatusText();

    this.pixiApp.ticker.add(() => {
      this.sceneManager.update(this.pixiApp.ticker.deltaMS);
      this.layoutStatusText();
    });

    await this.connectToLobby();
  }

  async joinGame(roomId: string, gameType?: string): Promise<void> {
    this.ensureInitialized();
    this.statusText.text = "Joining game room…";

    try {
      const room = (await this.client.joinById(roomId)) as ColyseusRoom;
      this.gameRoom = room;
      this.bindGameRoom(room);
      this.statusText.text = `Connected — Room: ${room.id}`;
      const enterData: GameSceneEnterData = {
        room,
        gameType: gameType ?? room.name,
      };
      await this.transitionTo(this.gameScene.name, enterData);
      console.log(`[playgrid] Joined game room: ${room.id}`);
    } catch (error) {
      console.error("[playgrid] Failed to join game room:", error);
      this.gameRoom = null;
      await this.showLobby({ message: "Could not join that game room.", tone: "error" });
    }
  }

  async leaveGame(): Promise<void> {
    const room = this.gameRoom;
    if (!room) {
      await this.showLobby();
      return;
    }

    this.gameRoom = null;

    try {
      await room.leave();
      console.log(`[playgrid] Left game room ${room.id}`);
    } catch (error) {
      console.error("[playgrid] Failed to leave game room:", error);
    }

    await this.showLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
  }

  private async connectToLobby(): Promise<void> {
    this.ensureInitialized();
    this.statusText.text = "Connecting to lobby…";

    try {
      this.lobbyRoom = (await this.client.joinOrCreate(LOBBY_ROOM_NAME)) as ColyseusRoom;
      this.lobbyScene.bindToRoom(this.lobbyRoom);
      await this.showLobby();
      console.log(`[playgrid] Joined lobby room: ${this.lobbyRoom.id}`);

      this.lobbyRoom.onLeave((code) => {
        void this.handleLobbyRoomLeave(code);
      });

      this.lobbyRoom.onError((code, message) => {
        console.error(`[playgrid] Lobby error ${code}: ${message}`);
        this.statusText.text = `Lobby error: ${message}`;
        this.lobbyScene.showNotice(message, "error");
      });
    } catch (error) {
      console.error("[playgrid] Lobby connection failed:", error);
      const message = error instanceof Error ? error.message : "Connection failed — is the server running?";
      await this.transitionTo(this.lobbyScene.name);
      this.statusText.text = "Connection failed — is the server running?";
      this.lobbyScene.showConnectionError(message);
    }
  }

  private async handleLobbyEvent(event: LobbyEvent): Promise<void> {
    if (event.type === "error") {
      this.statusText.text = event.message;
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

      this.statusText.text = `Waiting room — ${event.gameInfo?.name ?? "Game"}`;
      await this.transitionTo(this.waitingRoomScene.name, data);
      return;
    }

    await this.joinGame(event.roomId);
  }

  private async handleWaitingRoomEvent(event: WaitingRoomSceneEvent): Promise<void> {
    if (event.type === "leave") {
      await this.showLobby({ message: "Returned to the lobby browser.", tone: "info" });
      return;
    }

    await this.joinGame(event.roomId);
  }

  private async handleGameSceneEvent(event: GameSceneEvent): Promise<void> {
    if (event.type === "leave_game") {
      await this.leaveGame();
    }
  }

  private bindGameRoom(room: ColyseusRoom): void {
    room.onLeave((code) => {
      if (this.gameRoom?.id !== room.id) {
        return;
      }

      console.log(`[playgrid] Left game room ${room.id} (code: ${code})`);
      this.gameRoom = null;
      void this.showLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
    });

    room.onError((code, message) => {
      if (this.gameRoom?.id !== room.id) {
        return;
      }

      console.error(`[playgrid] Game room error ${code}: ${message}`);
      this.statusText.text = `Game error: ${message}`;
      this.lobbyScene.showNotice(message, "error");
    });
  }

  private async handleLobbyRoomLeave(code: number): Promise<void> {
    console.log(`[playgrid] Left lobby room (code: ${code})`);
    this.lobbyRoom = null;
    this.waitingRoomScene.hideOverlay();
    this.lobbyScene.showConnectionError("Lost connection to the lobby room.");
    this.statusText.text = "Lobby disconnected.";
  }

  private async showLobby(notice?: Notice): Promise<void> {
    const data: LobbySceneEnterData | undefined = notice ? { notice } : undefined;
    await this.transitionTo(this.lobbyScene.name, data);
    this.statusText.text = this.lobbyRoom
      ? "Lobby connected — create or join a game."
      : "Connecting to lobby…";
  }

  private async transitionTo(name: string, data?: unknown): Promise<void> {
    this.ensureInitialized();
    await this.sceneManager.transitionTo(name, data);
    this.sceneManager.resize(this.pixiApp.screen.width, this.pixiApp.screen.height);
    this.pixiApp.stage.addChild(this.statusText);
    this.layoutStatusText();
  }

  private layoutStatusText(): void {
    if (!this.statusText) {
      return;
    }

    this.statusText.x = this.pixiApp.screen.width / 2;
    this.statusText.y = this.gameRoom ? (this.pixiApp.screen.height / 2) + 34 : this.pixiApp.screen.height / 2;
  }

  private getGameContainer(container: HTMLElement): HTMLElement {
    const gameContainer = container.querySelector<HTMLElement>("#game-container");
    if (!gameContainer) {
      throw new Error("Missing #game-container");
    }

    return gameContainer;
  }

  private ensureInitialized(): void {
    if (!this.client || !this.sceneManager || !this.pixiApp) {
      throw new Error("PlaygridApp is not initialized.");
    }
  }
}

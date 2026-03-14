import type { Room } from "@colyseus/sdk";
import { Container } from "pixi.js";
import { LobbyScreen, type LobbyEvent } from "../ui/LobbyScreen";
import type { Scene } from "./Scene";

export interface LobbySceneEnterData {
  notice?: {
    message: string;
    tone: "info" | "error";
  };
}

export class LobbyScene implements Scene {
  readonly name = "lobby";
  readonly container = new Container();

  private readonly lobbyScreen = new LobbyScreen();

  constructor(private readonly onEventCallback: (event: LobbyEvent) => void | Promise<void>) {}

  bindToRoom(room: Room): void {
    this.lobbyScreen.bindToRoom(room);
  }

  setDisplayName(displayName: string): void {
    this.lobbyScreen.setDisplayName(displayName);
  }

  showNotice(message: string, tone: "info" | "error"): void {
    this.lobbyScreen.showNotice(message, tone);
  }

  showConnectionError(message: string): void {
    this.lobbyScreen.showConnectionError(message);
  }

  onEnter(data?: unknown): void {
    const enterData = data as LobbySceneEnterData | undefined;
    this.lobbyScreen.onEvent((event) => {
      void this.onEventCallback(event);
    });
    this.lobbyScreen.show();

    if (enterData?.notice) {
      this.lobbyScreen.showNotice(enterData.notice.message, enterData.notice.tone);
      return;
    }

    this.lobbyScreen.clearNotice();
  }

  onExit(): void {
    this.lobbyScreen.onEvent(() => undefined);
    this.lobbyScreen.hide();
  }

  update(_deltaTime: number): void {}

  resize(_width: number, _height: number): void {}
}

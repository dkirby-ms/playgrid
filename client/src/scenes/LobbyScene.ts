import type { Room } from "@colyseus/sdk";
import { Container } from "pixi.js";
import { LobbyScreen, type LobbyEvent } from "../ui/LobbyScreen";
import type { ConsoleLog } from "../ui/ConsoleLog";
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
  private consoleLog: ConsoleLog | null = null;

  constructor(private readonly onEventCallback: (event: LobbyEvent) => void | Promise<void>) {}

  bindToRoom(room: Room): void {
    this.lobbyScreen.bindToRoom(room);
  }

  setDisplayName(displayName: string): void {
    this.lobbyScreen.setDisplayName(displayName);
  }

  setConsoleLog(log: ConsoleLog): void {
    this.consoleLog = log;
    this.lobbyScreen.setConsoleLog(log);
  }

  showNotice(message: string, tone: "info" | "error"): void {
    this.consoleLog?.log(message, tone === "error" ? "error" : "info");
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
    this.lobbyScreen.clearNotice();

    if (enterData?.notice) {
      this.consoleLog?.log(
        enterData.notice.message,
        enterData.notice.tone === "error" ? "error" : "info",
      );
    }
  }

  onExit(): void {
    this.lobbyScreen.onEvent(() => undefined);
    this.lobbyScreen.hide();
  }

  update(_deltaTime: number): void {}

  resize(_width: number, _height: number): void {}
}

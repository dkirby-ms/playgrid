import type { Room } from "@colyseus/sdk";
import { Container } from "pixi.js";
import type { ConsoleLog } from "../ui/ConsoleLog";
import type { GameSessionInfo } from "../ui/LobbyScreen";
import { SetupScreen, type SetupScreenEvent } from "../ui/SetupScreen";
import type { Scene } from "./Scene";

export type SetupSceneEvent =
  | { type: "leave" }
  | { type: "game_started"; gameId: string; roomId: string; gameType: string };

export interface SetupSceneEnterData {
  room: Room;
  mode: "create" | "waiting";
  gameType: string;
  gameId?: string;
  gameInfo?: GameSessionInfo | null;
  isHost?: boolean;
}

export class SetupScene implements Scene {
  readonly name = "setup";
  readonly container = new Container();

  private readonly setupScreen = new SetupScreen();

  constructor(private readonly onEventCallback: (event: SetupSceneEvent) => void | Promise<void>) {}

  hideOverlay(): void {
    this.setupScreen.hide();
  }

  setConsoleLog(log: ConsoleLog): void {
    this.setupScreen.setConsoleLog(log);
  }

  onEnter(data?: unknown): void {
    const enterData = data as SetupSceneEnterData | undefined;
    if (!enterData) {
      throw new Error("SetupScene requires enter data.");
    }

    this.setupScreen.onEvent((event: SetupScreenEvent) => {
      void this.onEventCallback(event);
    });

    if (enterData.mode === "create") {
      this.setupScreen.showCreate(enterData.room, enterData.gameType);
    } else {
      this.setupScreen.showWaiting(
        enterData.room,
        enterData.gameId ?? "",
        enterData.gameInfo ?? null,
        enterData.isHost ?? false,
      );
    }
  }

  onExit(): void {
    this.setupScreen.cleanup();
    this.setupScreen.onEvent(() => undefined);
    this.setupScreen.hide();
  }

  update(_deltaTime: number): void {}

  resize(_width: number, _height: number): void {}
}

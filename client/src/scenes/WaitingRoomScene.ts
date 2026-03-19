import type { Room } from "@colyseus/sdk";
import { Container } from "pixi.js";
import type { ConsoleLog } from "../ui/ConsoleLog";
import type { GameSessionInfo } from "../ui/LobbyScreen";
import { WaitingRoom } from "../ui/WaitingRoom";
import type { Scene } from "./Scene";

export type WaitingRoomSceneEvent =
  | { type: "leave" }
  | { type: "game_started"; gameId: string; roomId: string; gameType: string };

export interface WaitingRoomSceneEnterData {
  room: Room;
  gameId: string;
  gameInfo: GameSessionInfo | null;
  isHost: boolean;
}

export class WaitingRoomScene implements Scene {
  readonly name = "waiting-room";
  readonly container = new Container();

  private readonly waitingRoom = new WaitingRoom();

  constructor(private readonly onEventCallback: (event: WaitingRoomSceneEvent) => void | Promise<void>) {}

  hideOverlay(): void {
    this.waitingRoom.hide();
  }

  setConsoleLog(log: ConsoleLog): void {
    this.waitingRoom.setConsoleLog(log);
  }

  onEnter(data?: unknown): void {
    const enterData = data as WaitingRoomSceneEnterData | undefined;
    if (!enterData) {
      throw new Error("WaitingRoomScene requires room data.");
    }

    this.waitingRoom.onEvent((event) => {
      void this.onEventCallback(event);
    });
    this.waitingRoom.show(enterData.room, enterData.gameId, enterData.gameInfo, enterData.isHost);
  }

  onExit(): void {
    this.waitingRoom.onEvent(() => undefined);
    this.waitingRoom.hide();
  }

  update(_deltaTime: number): void {}

  resize(_width: number, _height: number): void {}
}

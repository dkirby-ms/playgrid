import type { Room } from "@colyseus/sdk";
import { Container, Text } from "pixi.js";
import type { Scene } from "./Scene";

export interface GameSceneEnterData {
  room: Room;
}

export class GameScene implements Scene {
  readonly name = "game";
  readonly container = new Container();
  room: Room | null = null;

  private readonly loadingText = new Text({
    text: "Game loading...",
    style: {
      fontFamily: "monospace",
      fontSize: 24,
      fill: 0xffffff,
    },
  });

  constructor() {
    this.loadingText.anchor.set(0.5);
    this.container.addChild(this.loadingText);
  }

  onEnter(data?: unknown): void {
    const enterData = data as GameSceneEnterData | undefined;
    this.room = enterData?.room ?? null;
    this.loadingText.text = "Game loading...";
  }

  onExit(): void {
    this.room = null;
  }

  update(_deltaTime: number): void {}

  resize(width: number, height: number): void {
    this.loadingText.x = width / 2;
    this.loadingText.y = (height / 2) - 34;
  }
}

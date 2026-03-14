import type { Room } from "@colyseus/sdk";
import { Container, Text } from "pixi.js";
import { RendererRegistry, type GameRenderer } from "../renderers";
import type { Scene } from "./Scene";

export interface GameSceneEnterData {
  room: Room;
  gameType: string;
}

export interface GameSceneEvent {
  type: "leave_game";
}

export class GameScene implements Scene {
  readonly name = "game";
  readonly container = new Container();
  room: Room | null = null;

  private renderer: GameRenderer | null = null;
  private stateChangeHandler: ((state: unknown) => void) | null = null;
  private leaveButton: HTMLButtonElement | null = null;
  private width = 0;
  private height = 0;

  private readonly messageText = new Text({
    text: "",
    style: {
      fontFamily: "monospace",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
    },
  });

  constructor(
    private readonly rendererRegistry: RendererRegistry,
    private readonly onEventCallback: (event: GameSceneEvent) => void | Promise<void>,
  ) {
    this.messageText.anchor.set(0.5);
    this.messageText.visible = false;
    this.container.addChild(this.messageText);
  }

  onEnter(data?: unknown): void {
    this.cleanup();

    const enterData = data as GameSceneEnterData | undefined;
    if (!enterData) {
      throw new Error("GameScene requires room and game type data.");
    }

    this.room = enterData.room;
    this.createLeaveButton();

    if (!this.rendererRegistry.has(enterData.gameType)) {
      this.showMessage(`No renderer available for ${enterData.gameType}.`);
      return;
    }

    this.renderer = this.rendererRegistry.create(enterData.gameType);
    this.renderer.init(this.room.state, { room: this.room });
    this.container.addChild(this.renderer.container);

    this.stateChangeHandler = (state) => {
      this.renderer?.onStateChange(state);
    };
    this.room.onStateChange(this.stateChangeHandler);

    if (this.width > 0 && this.height > 0) {
      this.renderer.resize(this.width, this.height);
    }
  }

  onExit(): void {
    this.cleanup();
  }

  update(deltaTime: number): void {
    this.renderer?.update(deltaTime);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.messageText.x = width / 2;
    this.messageText.y = (height / 2) - 34;
    this.renderer?.resize(width, height);
  }

  private cleanup(): void {
    if (this.room && this.stateChangeHandler) {
      this.room.onStateChange.remove(this.stateChangeHandler);
    }

    this.stateChangeHandler = null;
    this.room = null;
    this.removeLeaveButton();
    this.hideMessage();

    if (!this.renderer) {
      return;
    }

    if (this.renderer.container.parent === this.container) {
      this.container.removeChild(this.renderer.container);
    }

    this.renderer.destroy();
    this.renderer = null;
  }

  private createLeaveButton(): void {
    const host = document.getElementById("app") ?? document.body;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Leave Game";
    button.className = "lobby-button lobby-button-ghost";
    Object.assign(button.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "20",
      background: "rgba(16, 16, 29, 0.92)",
      borderColor: "rgba(126, 207, 255, 0.22)",
    });
    button.addEventListener("click", this.handleLeaveButtonClick);
    host.appendChild(button);
    this.leaveButton = button;
  }

  private removeLeaveButton(): void {
    if (!this.leaveButton) {
      return;
    }

    this.leaveButton.removeEventListener("click", this.handleLeaveButtonClick);
    this.leaveButton.remove();
    this.leaveButton = null;
  }

  private showMessage(message: string): void {
    this.messageText.text = message;
    this.messageText.visible = true;
  }

  private hideMessage(): void {
    this.messageText.text = "";
    this.messageText.visible = false;
  }

  private readonly handleLeaveButtonClick = (): void => {
    void this.onEventCallback({ type: "leave_game" });
  };
}

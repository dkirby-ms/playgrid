import type { Room } from "@colyseus/sdk";
import { Container, Text } from "pixi.js";
import { RendererRegistry, type GameRenderer } from "../renderers";
import type { Scene } from "./Scene";
import { HUD, type HUDEvent, type HUDPlayer } from "../ui/HUD";

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
  private hud: HUD | null = null;
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
    this.hud = new HUD();
    this.hud.onEvent((event) => this.handleHUDEvent(event));
  }

  onEnter(data?: unknown): void {
    this.cleanup();

    const enterData = data as GameSceneEnterData | undefined;
    if (!enterData) {
      throw new Error("GameScene requires room and game type data.");
    }

    this.room = enterData.room;

    if (!this.rendererRegistry.has(enterData.gameType)) {
      this.showMessage(`No renderer available for ${enterData.gameType}.`);
      return;
    }

    this.renderer = this.rendererRegistry.create(enterData.gameType);
    this.renderer.init(this.room.state, { room: this.room });
    this.container.addChild(this.renderer.container);

    this.stateChangeHandler = (state) => {
      this.renderer?.onStateChange(state);
      this.updateHUD(state);
    };
    this.room.onStateChange(this.stateChangeHandler);

    if (this.width > 0 && this.height > 0) {
      this.renderer.resize(this.width, this.height);
    }

    this.initHUD();
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
    this.hud?.hide();
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

  private initHUD(): void {
    if (!this.room || !this.hud) {
      return;
    }

    const players = this.extractPlayersFromState(this.room.state);
    const currentTurn = this.extractCurrentTurn(this.room.state);
    const turnTimeRemaining = this.extractTurnTimeRemaining(this.room.state);
    const showTimer = turnTimeRemaining > 0;

    this.hud.show(this.room, {
      players,
      currentTurn,
      gameTimer: turnTimeRemaining,
      showTimer,
    });
  }

  private updateHUD(state: unknown): void {
    if (!this.hud || !this.room) {
      return;
    }

    const players = this.extractPlayersFromState(state);
    const currentTurn = this.extractCurrentTurn(state);
    const turnTimeRemaining = this.extractTurnTimeRemaining(state);
    const showTimer = turnTimeRemaining > 0;

    this.hud.update({
      players,
      currentTurn,
      gameTimer: turnTimeRemaining,
      showTimer,
    });
  }

  private extractPlayersFromState(state: unknown): HUDPlayer[] {
    const players: HUDPlayer[] = [];

    if (typeof state !== "object" || state === null) {
      return players;
    }

    const stateObj = state as Record<string, unknown>;

    if (Array.isArray(stateObj.players)) {
      for (const player of stateObj.players) {
        if (typeof player === "object" && player !== null) {
          const playerObj = player as Record<string, unknown>;
          players.push({
            userId: String(playerObj.userId ?? ""),
            displayName: String(playerObj.displayName ?? "Player"),
            score: typeof playerObj.score === "number" ? playerObj.score : 0,
            isCurrent: false,
          });
        }
      }
    }

    const currentTurn = this.extractCurrentTurn(state);
    if (currentTurn) {
      const currentPlayerIndex = players.findIndex((p) => p.userId === currentTurn);
      if (currentPlayerIndex !== -1) {
        players[currentPlayerIndex].isCurrent = true;
      }
    }

    return players;
  }

  private extractCurrentTurn(state: unknown): string | undefined {
    if (typeof state !== "object" || state === null) {
      return undefined;
    }

    const stateObj = state as Record<string, unknown>;
    return typeof stateObj.currentTurn === "string" ? stateObj.currentTurn : undefined;
  }

  private extractTurnTimeRemaining(state: unknown): number {
    if (typeof state !== "object" || state === null) {
      return 0;
    }

    const stateObj = state as Record<string, unknown>;
    return typeof stateObj.turnTimeRemaining === "number" ? stateObj.turnTimeRemaining : 0;
  }

  private handleHUDEvent(event: HUDEvent): void {
    if (event.type === "leave") {
      void this.onEventCallback({ type: "leave_game" });
    }
  }

  private showMessage(message: string): void {
    this.messageText.text = message;
    this.messageText.visible = true;
  }

  private hideMessage(): void {
    this.messageText.text = "";
    this.messageText.visible = false;
  }

}

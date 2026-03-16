import type { Room } from "@colyseus/sdk";
import { Container, Text } from "pixi.js";
import { RendererRegistry, type GameRenderer } from "../renderers";
import type { Scene } from "./Scene";
import { HUD, type HUDEvent } from "../ui/HUD";

export interface GameSceneEnterData {
  room: Room;
  gameType: string;
}

export interface GameSceneEvent {
  type: "leave_game";
}

interface ScenePlayerSnapshot {
  controllerSessionId: string;
  displayName: string;
  isSpectator: boolean;
  playerIndex: number;
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
  private persistentMessage = "";
  private turnPromptUntil = 0;
  private lastObservedTurn = "";

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
    this.hud.onTimerChange((gameTimer, showTimer) => {
      this.renderer?.setTurnClock?.(gameTimer, showTimer);
    });
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
    this.renderer.init(this.room.state, {
      room: this.room,
      requestLeave: () => {
        void this.onEventCallback({ type: "leave_game" });
      },
    });
    this.container.addChild(this.renderer.container);

    this.stateChangeHandler = (state) => {
      this.renderer?.onStateChange(state);
      this.updateHUD(state);
      this.updateHeadToHeadPrompt(state);
    };
    this.room.onStateChange(this.stateChangeHandler);
    this.hud?.setSidebarActive(true);

    if (this.width > 0 && this.height > 0) {
      this.renderer.resize(this.width, this.height);
    }

    this.initHUD();
  }

  onExit(): void {
    this.cleanup();
  }

  update(deltaTime: number): void {
    if (this.turnPromptUntil > 0 && performance.now() >= this.turnPromptUntil) {
      this.turnPromptUntil = 0;
      this.updateMessageDisplay();
    }

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
    this.turnPromptUntil = 0;
    this.lastObservedTurn = "";
    this.hud?.setSidebarActive(false);
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
    if (!this.hud) {
      return;
    }

    const turnTimeRemaining = this.room ? this.extractTurnTimeRemaining(this.room.state) : 0;
    this.hud.show({
      gameTimer: turnTimeRemaining,
      showTimer: turnTimeRemaining > 0,
    });
  }

  private updateHUD(state: unknown): void {
    if (!this.hud) {
      return;
    }

    const turnTimeRemaining = this.extractTurnTimeRemaining(state);
    this.hud.update({
      gameTimer: turnTimeRemaining,
      showTimer: turnTimeRemaining > 0,
    });
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

  private updateHeadToHeadPrompt(state: unknown): void {
    const phase = this.extractPhase(state);
    const currentTurn = this.extractCurrentTurn(state);
    const players = this.extractPlayers(state);
    const localSessionId = this.room?.sessionId ?? "";
    const isHeadToHead = localSessionId.length > 0 && Array.from(players.entries()).some(
      ([sessionId, player]) => (
        !player.isSpectator
        && sessionId !== localSessionId
        && player.controllerSessionId === localSessionId
      ),
    );

    if (!isHeadToHead || phase !== "playing" || !currentTurn) {
      this.lastObservedTurn = currentTurn;
      this.turnPromptUntil = 0;
      this.updateMessageDisplay();
      return;
    }

    if (this.lastObservedTurn && this.lastObservedTurn !== currentTurn) {
      const currentPlayer = players.get(currentTurn);
      const playerLabel = currentPlayer && currentPlayer.playerIndex >= 0
        ? `Player ${currentPlayer.playerIndex + 1}`
        : currentPlayer?.displayName || "Next player";
      this.showTurnPrompt(`${playerLabel}'s turn — pass the device`);
    }

    this.lastObservedTurn = currentTurn;
  }

  private extractPhase(state: unknown): string {
    if (typeof state !== "object" || state === null) {
      return "";
    }

    const stateObj = state as Record<string, unknown>;
    return typeof stateObj.phase === "string" ? stateObj.phase : "";
  }

  private extractCurrentTurn(state: unknown): string {
    if (typeof state !== "object" || state === null) {
      return "";
    }

    const stateObj = state as Record<string, unknown>;
    return typeof stateObj.currentTurn === "string" ? stateObj.currentTurn : "";
  }

  private extractPlayers(state: unknown): Map<string, ScenePlayerSnapshot> {
    const players = new Map<string, ScenePlayerSnapshot>();
    if (typeof state !== "object" || state === null) {
      return players;
    }

    const stateObj = state as Record<string, unknown>;
    const playerEntries = (stateObj.players as { entries?: () => Iterable<[string, Record<string, unknown>]> } | undefined)
      ?.entries?.();

    for (const [sessionId, player] of playerEntries ?? []) {
      players.set(sessionId, {
        controllerSessionId: typeof player.controllerSessionId === "string" ? player.controllerSessionId : "",
        displayName: typeof player.displayName === "string" ? player.displayName : "Player",
        isSpectator: Boolean(player.isSpectator),
        playerIndex: typeof player.playerIndex === "number" ? player.playerIndex : -1,
      });
    }

    return players;
  }

  private showTurnPrompt(message: string): void {
    this.turnPromptUntil = performance.now() + 1800;
    this.messageText.text = message;
    this.messageText.visible = true;
  }

  private showMessage(message: string): void {
    this.persistentMessage = message;
    this.updateMessageDisplay();
  }

  private hideMessage(): void {
    this.persistentMessage = "";
    this.turnPromptUntil = 0;
    this.updateMessageDisplay();
  }

  private updateMessageDisplay(): void {
    if (this.turnPromptUntil > 0) {
      this.messageText.visible = true;
      return;
    }

    this.messageText.text = this.persistentMessage;
    this.messageText.visible = this.persistentMessage.length > 0;
  }

}

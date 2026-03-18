import type { Room } from "@colyseus/sdk";
import { Container, Text } from "pixi.js";
import { RendererRegistry, type GameRenderer } from "../renderers";
import type { Scene } from "./Scene";
import { HUD, type HUDEvent } from "../ui/HUD";
import { PlayerInfoBar, type PlayerInfoBarData, type PlayerInfoStatusTone } from "../ui/PlayerInfoBar";
import { GameHeader, type GameHeaderEvent } from "../ui/GameHeader";

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

const RISK_COLOR_LABELS = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];

export class GameScene implements Scene {
  readonly name = "game";
  readonly container = new Container();
  room: Room | null = null;

  private renderer: GameRenderer | null = null;
  private stateChangeHandler: ((state: unknown) => void) | null = null;
  private hud: HUD | null = null;
  private gameHeader: GameHeader | null = null;
  private playerInfoBars: { opponent: PlayerInfoBar; player: PlayerInfoBar } | null = null;
  private width = 0;
  private height = 0;
  private gameType = "";
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
    this.gameType = enterData.gameType;

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
    this.initGameHeader();
    this.initPlayerInfoBars();

    this.stateChangeHandler = (state) => {
      this.renderer?.onStateChange(state);
      this.updateHUD(state);
      this.updatePlayerInfoBars(state);
      this.updateHeadToHeadPrompt(state);
    };
    this.room.onStateChange(this.stateChangeHandler);
    this.hud?.setSidebarActive(true);

    if (this.width > 0 && this.height > 0) {
      this.renderer.resize(this.width, this.height);
    }

    this.initHUD();
    this.updatePlayerInfoBars(this.room.state);
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
    this.gameType = "";
    this.hud?.setSidebarActive(false);
    this.hud?.hide();
    this.destroyGameHeader();
    this.destroyPlayerInfoBars();
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

  private initGameHeader(): void {
    const headerMount = document.getElementById("game-header");

    if (!headerMount) {
      return;
    }

    this.gameHeader = new GameHeader(headerMount);
    this.gameHeader.onEvent((event) => this.handleGameHeaderEvent(event));
    
    const gameTitle = this.formatGameTitle(this.gameType);
    this.gameHeader.show({ gameTitle });

    // Hide the HUD Leave button since we now have the header
    if (this.hud) {
      const leaveButton = document.querySelector("#hud-overlay .lobby-button-ghost") as HTMLElement;
      if (leaveButton) {
        leaveButton.style.display = "none";
      }
    }
  }

  private destroyGameHeader(): void {
    if (!this.gameHeader) {
      return;
    }

    this.gameHeader.destroy();
    this.gameHeader = null;

    // Restore the HUD Leave button
    if (this.hud) {
      const leaveButton = document.querySelector("#hud-overlay .lobby-button-ghost") as HTMLElement;
      if (leaveButton) {
        leaveButton.style.display = "";
      }
    }
  }

  private formatGameTitle(gameType: string): string {
    if (!gameType) {
      return "Game";
    }
    
    return gameType.charAt(0).toUpperCase() + gameType.slice(1);
  }

  private handleGameHeaderEvent(event: GameHeaderEvent): void {
    if (event.type === "back_to_lobby" || event.type === "resign") {
      void this.onEventCallback({ type: "leave_game" });
    }
  }

  private initPlayerInfoBars(): void {
    const opponentMount = document.getElementById("game-info-top");
    const playerMount = document.getElementById("game-info-bottom");

    if (!opponentMount || !playerMount) {
      return;
    }

    this.playerInfoBars = {
      opponent: new PlayerInfoBar(opponentMount, "opponent"),
      player: new PlayerInfoBar(playerMount, "player"),
    };
  }

  private destroyPlayerInfoBars(): void {
    if (!this.playerInfoBars) {
      return;
    }

    this.playerInfoBars.opponent.destroy();
    this.playerInfoBars.player.destroy();
    this.playerInfoBars = null;
  }

  private updatePlayerInfoBars(state: unknown): void {
    if (!this.playerInfoBars || !this.room || !this.gameType) {
      return;
    }

    const players = this.extractPlayers(state);
    const phase = this.extractPhase(state);
    const currentTurn = this.extractCurrentTurn(state);
    const turnTimeRemaining = this.extractTurnTimeRemaining(state);
    const localSessionId = this.room.sessionId ?? "";

    const localPlayer = localSessionId ? players.get(localSessionId) ?? null : null;
    const opponentSelection = this.selectOpponent(players, currentTurn, localSessionId);

    const playerData = this.buildPlayerInfoData(
      {
        sessionId: localSessionId,
        player: localPlayer,
        isLocal: true,
        fallbackName: "You",
      },
      phase,
      currentTurn,
      turnTimeRemaining,
      state,
    );

    const opponentData = this.buildPlayerInfoData(
      {
        sessionId: opponentSelection?.sessionId ?? "",
        player: opponentSelection?.player ?? null,
        isLocal: false,
        fallbackName: "Waiting for opponent",
      },
      phase,
      currentTurn,
      turnTimeRemaining,
      state,
    );

    this.playerInfoBars.player.update(playerData);
    this.playerInfoBars.opponent.update(opponentData);
  }

  private selectOpponent(
    players: Map<string, ScenePlayerSnapshot>,
    currentTurn: string,
    localSessionId: string,
  ): { sessionId: string; player: ScenePlayerSnapshot } | null {
    if (currentTurn && currentTurn !== localSessionId) {
      const currentPlayer = players.get(currentTurn);
      if (currentPlayer && !currentPlayer.isSpectator) {
        return { sessionId: currentTurn, player: currentPlayer };
      }
    }

    for (const [sessionId, player] of players.entries()) {
      if (sessionId !== localSessionId && !player.isSpectator) {
        return { sessionId, player };
      }
    }

    return null;
  }

  private buildPlayerInfoData(
    context: {
      sessionId: string;
      player: ScenePlayerSnapshot | null;
      isLocal: boolean;
      fallbackName: string;
    },
    phase: string,
    currentTurn: string,
    turnTimeRemaining: number,
    state: unknown,
  ): PlayerInfoBarData {
    if (!context.player) {
      const status = phase === "ended" ? "Game over" : "Waiting for players";
      return {
        name: context.fallbackName,
        label: context.isLocal ? "Connecting..." : "Invite a player to join",
        status,
        statusTone: "neutral",
        timerSeconds: null,
      };
    }

    const name = this.getPlayerDisplayName(context.player, context.isLocal);
    const label = this.getPlayerRoleLabel(this.gameType, context.player, context.sessionId, state);
    const status = this.getStatusForPlayer(context, phase, currentTurn);
    const timerSeconds =
      context.sessionId && currentTurn === context.sessionId && turnTimeRemaining > 0
        ? turnTimeRemaining
        : null;

    return {
      name,
      label,
      status: status.text,
      statusTone: status.tone,
      timerSeconds,
    };
  }

  private getPlayerDisplayName(player: ScenePlayerSnapshot, isLocal: boolean): string {
    const trimmedName = player.displayName.trim();
    if (trimmedName.length > 0) {
      return isLocal ? `${trimmedName} (You)` : trimmedName;
    }

    return isLocal ? "You" : "Player";
  }

  private getPlayerRoleLabel(
    gameType: string,
    player: ScenePlayerSnapshot,
    sessionId: string,
    state: unknown,
  ): string {
    if (player.isSpectator) {
      return "Spectating";
    }

    if (gameType === "checkers") {
      if (player.playerIndex === 0) {
        return "Black Pieces";
      }
      if (player.playerIndex === 1) {
        return "Red Pieces";
      }
      return "Checkers Pieces";
    }

    if (gameType === "backgammon") {
      if (player.playerIndex === 0) {
        return "Black Checkers";
      }
      if (player.playerIndex === 1) {
        return "White Checkers";
      }
      return "Backgammon";
    }

    if (gameType === "dominos") {
      const handCount = this.getDominosHandCount(state, sessionId);
      return handCount !== null ? `${handCount} tiles` : "Dominoes";
    }

    if (gameType === "risk") {
      return this.getRiskColorLabel(player.playerIndex);
    }

    return "";
  }

  private getStatusForPlayer(
    context: { sessionId: string; player: ScenePlayerSnapshot; isLocal: boolean },
    phase: string,
    currentTurn: string,
  ): { text: string; tone: PlayerInfoStatusTone } {
    if (phase === "waiting") {
      return { text: "Waiting for players", tone: "neutral" };
    }

    if (phase === "ended") {
      return { text: "Game over", tone: "neutral" };
    }

    if (context.player.isSpectator) {
      return { text: "Spectating", tone: "neutral" };
    }

    if (!currentTurn) {
      return { text: "Waiting...", tone: "waiting" };
    }

    if (currentTurn === context.sessionId) {
      return { text: context.isLocal ? "Your Turn" : "Their Turn", tone: "active" };
    }

    return { text: "Waiting...", tone: "waiting" };
  }

  private getDominosHandCount(state: unknown, sessionId: string): number | null {
    if (!sessionId || typeof state !== "object" || state === null) {
      return null;
    }

    const stateObj = state as {
      playerStates?: { get?: (id: string) => { handCount?: number } | undefined };
    };
    const playerState = stateObj.playerStates?.get?.(sessionId);
    return typeof playerState?.handCount === "number" ? playerState.handCount : null;
  }

  private getRiskColorLabel(playerIndex: number): string {
    if (playerIndex < 0) {
      return "Commander";
    }

    const color = RISK_COLOR_LABELS[playerIndex % RISK_COLOR_LABELS.length] ?? "Player";
    return `${color} Army`;
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

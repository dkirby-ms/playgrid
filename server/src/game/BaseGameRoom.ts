import { Client, CloseCode, Room } from "colyseus";
import {
  BaseGameState,
  PlayerInfo,
  type ActionHandler,
  type GameOptions,
  type GamePlugin,
  type GameResult,
} from "@eschaton/shared";
import { gameRegistry } from "./GameRegistry.js";
import { TurnManager } from "./TurnManager.js";
import { getPool } from "../db.js";
import * as gameRepository from "../db/gameRepository.js";

interface BaseGameRoomOptions extends GameOptions {
  gameType?: string;
  maxPlayers?: number;
  expectedPlayers?: number;
  reconnectionTimeout?: number;
}

const DEFAULT_ACTION_ERROR = "Action failed.";
const DEFAULT_RECONNECTION_TIMEOUT = 30;
const GAME_ENDED_MESSAGE = "game-end";
const INVALID_ACTION_ERROR = "Invalid action.";
const ROOM_ERROR_MESSAGE = "error";

export class BaseGameRoom extends Room {
  declare state: BaseGameState;

  private plugin!: GamePlugin<BaseGameState>;
  private turnManager?: TurnManager;
  private expectedPlayers = 0;
  private reconnectionTimeout = DEFAULT_RECONNECTION_TIMEOUT;
  private gameId?: string;
  private gameStartTime?: number;

  override async onCreate(options: BaseGameRoomOptions = {}) {
    const gameType = typeof options.gameType === "string" ? options.gameType.trim() : "";
    if (!gameType) {
      throw new Error('BaseGameRoom requires a "gameType" option.');
    }

    this.plugin = gameRegistry.get(gameType) as unknown as GamePlugin<BaseGameState>;

    const [minPlayers, maxPlayers] = this.plugin.metadata.playerCount;
    const maxPlayersConfig = Math.min(
      maxPlayers,
      Math.max(minPlayers, this.normalizePlayerCount(options.maxPlayers) ?? maxPlayers),
    );
    this.maxClients = maxPlayersConfig + 100;
    this.expectedPlayers = Math.min(
      maxPlayersConfig,
      Math.max(minPlayers, this.normalizePlayerCount(options.expectedPlayers) ?? maxPlayersConfig),
    );

    if (typeof options.reconnectionTimeout === "number" && options.reconnectionTimeout > 0) {
      this.reconnectionTimeout = options.reconnectionTimeout;
    }

    const state = this.plugin.createState() as BaseGameState;
    this.setState(state);
    this.plugin.lifecycle.onCreate?.(state, options);

    this.registerActionHandlers();

    if (this.plugin.lifecycle.onTick) {
      this.setSimulationInterval((deltaTime) => {
        this.plugin.lifecycle.onTick?.(this.state, deltaTime);
      });
    }

    try {
      const pool = getPool();
      this.gameId = await gameRepository.createGame(pool, {
        gameType,
        playerIds: [],
      });
    } catch (error) {
      console.error("[BaseGameRoom] Failed to create game in DB:", error);
    }
  }

  override onJoin(client: Client, options: Record<string, unknown> = {}) {
    const existingPlayer = this.state.players.get(client.sessionId);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      return;
    }

    const isSpectator = options.isSpectator === true || options.spectator === true;
    const playerIndex = isSpectator
      ? this.state.players.size
      : this.getParticipatingPlayers().length;

    const player = new PlayerInfo();
    player.sessionId = client.sessionId;
    player.displayName = this.resolveDisplayName(options.displayName, playerIndex);
    player.playerIndex = playerIndex;
    player.isSpectator = isSpectator;
    player.isConnected = true;

    this.state.players.set(client.sessionId, player);
    this.plugin.lifecycle.onPlayerJoin?.(this.state, client, playerIndex);

    if (this.gameId) {
      try {
        const pool = getPool();
        void gameRepository.addParticipant(pool, {
          gameId: this.gameId,
          userId: client.sessionId,
          role: isSpectator ? "spectator" : "player",
        });
      } catch (error) {
        console.error("[BaseGameRoom] Failed to add participant to DB:", error);
      }
    }

    if (!isSpectator && this.shouldStartGame()) {
      this.startGame();
    }
  }

  override async onLeave(client: Client, code: number = CloseCode.NORMAL_CLOSURE) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    player.isConnected = false;

    if (
      this.state.phase === "playing" &&
      !player.isSpectator &&
      code !== CloseCode.CONSENTED
    ) {
      try {
        await this.allowReconnection(client, this.reconnectionTimeout);
        player.isConnected = true;
        return;
      } catch {
        await this.handleReconnectionTimeout(client.sessionId);
        return;
      }
    }

    this.plugin.lifecycle.onPlayerLeave?.(this.state, client.sessionId);
    this.turnManager?.removePlayer(client.sessionId);

    if (this.turnManager?.isActive() && this.turnManager.getPlayerCount() > 0) {
      this.state.currentTurn = this.turnManager.getCurrentPlayer();
      this.state.turnNumber = this.turnManager.getTurnNumber();
    } else if (this.state.phase !== "ended") {
      this.state.currentTurn = "";
    }

    if (this.state.phase !== "playing") {
      return;
    }

    const remainingPlayers = this.getConnectedParticipants();
    if (remainingPlayers.length !== 1) {
      return;
    }

    const winner = remainingPlayers[0];
    await this.endGame({
      type: "forfeit",
      winnerId: winner.sessionId,
      scores: { [winner.sessionId]: 1 },
      metadata: {
        consented: code === CloseCode.CONSENTED,
        disconnectedPlayerId: client.sessionId,
      },
    });
  }

  override onDispose() {
    this.turnManager?.stop();
  }

  private registerActionHandlers() {
    for (const [actionType, handler] of Object.entries(this.plugin.actions)) {
      this.onMessage(actionType, (client, payload) => {
        void this.handleAction(
          client,
          actionType,
          payload,
          handler as ActionHandler<BaseGameState>,
        );
      });
    }
  }

  private async handleAction(
    client: Client,
    actionType: string,
    payload: unknown,
    handler: ActionHandler<BaseGameState>,
  ) {
    const player = this.state.players.get(client.sessionId);
    if (player?.isSpectator) {
      client.send(ROOM_ERROR_MESSAGE, { message: "Spectators cannot perform actions." });
      return;
    }

    const isValid = this.plugin.conditions.validateAction(
      this.state,
      client,
      actionType,
      payload,
    );

    if (!isValid) {
      client.send(ROOM_ERROR_MESSAGE, { message: INVALID_ACTION_ERROR });
      return;
    }

    const result = handler(this.state, client, payload);
    if (!result.success) {
      client.send(ROOM_ERROR_MESSAGE, { message: result.error ?? DEFAULT_ACTION_ERROR });
      return;
    }

    const gameResult = this.plugin.conditions.checkGameEnd(this.state);
    if (result.endsGame || gameResult) {
      await this.endGame(gameResult ?? this.createFallbackGameResult());
      return;
    }

    if (result.endsTurn) {
      this.advanceTurn();
    }
  }

  private startGame() {
    if (this.state.phase === "playing" || this.state.phase === "ended") {
      return;
    }

    const playerIds = this.getConnectedParticipants()
      .sort((left, right) => left.playerIndex - right.playerIndex)
      .map((player) => player.sessionId);

    if (playerIds.length === 0) {
      return;
    }

    this.state.phase = "playing";
    this.gameStartTime = Date.now();
    this.turnManager = new TurnManager(this.orderTurnPlayers(playerIds), {
      turnTimeLimit: this.plugin.turnConfig.turnTimeLimit,
      onTimeout: (sessionId) => {
        void this.handleTurnTimeout(sessionId);
      },
    });

    this.plugin.lifecycle.onGameStart(this.state);
    this.turnManager.startTurns();
    this.state.currentTurn = this.turnManager.getCurrentPlayer();
    this.state.turnNumber = this.turnManager.getTurnNumber();
  }

  private advanceTurn() {
    if (!this.turnManager?.isActive()) {
      return;
    }

    this.state.currentTurn = this.turnManager.nextTurn();
    this.state.turnNumber = this.turnManager.getTurnNumber();
  }

  private async handleTurnTimeout(sessionId: string) {
    if (this.state.phase === "ended") {
      return;
    }

    const remainingPlayers = this.getConnectedParticipants().filter(
      (player) => player.sessionId !== sessionId,
    );
    const winnerId = remainingPlayers[0]?.sessionId;

    await this.endGame({
      type: "timeout",
      winnerId,
      scores: winnerId ? { [winnerId]: 1 } : {},
      metadata: {
        timedOutPlayerId: sessionId,
      },
    });
  }

  private async handleReconnectionTimeout(sessionId: string) {
    if (this.state.phase === "ended") {
      return;
    }

    this.turnManager?.removePlayer(sessionId);

    const remainingPlayers = this.getConnectedParticipants();
    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      await this.endGame({
        type: "forfeit",
        winnerId: winner.sessionId,
        scores: { [winner.sessionId]: 1 },
        metadata: {
          reconnectionTimeout: true,
          disconnectedPlayerId: sessionId,
        },
      });
    } else if (remainingPlayers.length === 0) {
      await this.endGame({
        type: "draw",
        scores: {},
        metadata: {
          reconnectionTimeout: true,
          reason: "all-players-disconnected",
        },
      });
    }
  }

  private async endGame(result: GameResult) {
    if (this.state.phase === "ended") {
      return;
    }

    this.turnManager?.stop();
    this.state.phase = "ended";
    this.state.currentTurn = "";

    this.plugin.lifecycle.onGameEnd?.(this.state, result);
    this.broadcast(GAME_ENDED_MESSAGE, result);

    if (this.gameId && this.gameStartTime) {
      try {
        const pool = getPool();
        const durationSeconds = Math.floor((Date.now() - this.gameStartTime) / 1000);
        await gameRepository.endGame(pool, {
          gameId: this.gameId,
          outcome: result as unknown as Record<string, unknown>,
          durationSeconds,
        });
      } catch (error) {
        console.error("[BaseGameRoom] Failed to end game in DB:", error);
      }
    }

    await this.disconnect();
  }

  private getParticipatingPlayers() {
    return Array.from(this.state.players.values()).filter((player) => !player.isSpectator);
  }

  private getConnectedParticipants() {
    return this.getParticipatingPlayers().filter((player) => player.isConnected);
  }

  private shouldStartGame() {
    return this.state.phase === "waiting"
      && this.getConnectedParticipants().length >= this.expectedPlayers;
  }

  private orderTurnPlayers(playerIds: string[]) {
    if (this.plugin.turnConfig.turnOrder.type !== "random") {
      return playerIds;
    }

    const shuffled = [...playerIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  }

  private createFallbackGameResult(): GameResult {
    return {
      type: "draw",
      scores: {},
      metadata: {
        reason: "action-ended-game",
      },
    };
  }

  private normalizePlayerCount(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.max(1, Math.floor(value));
  }

  private resolveDisplayName(value: unknown, playerIndex: number) {
    if (typeof value === "string") {
      const displayName = value.trim();
      if (displayName) {
        return displayName;
      }
    }

    return `Player ${playerIndex + 1}`;
  }
}

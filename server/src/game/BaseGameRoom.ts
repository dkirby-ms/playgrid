import type { Delayed } from "@colyseus/timer";
import { Client, CloseCode, Room } from "colyseus";
import {
  BaseGameState,
  PlayerInfo,
  type ActionHandler,
  type BackgammonState,
  type CheckersState,
  type DominosState,
  type GameOptions,
  type GamePlugin,
  type GameResult,
  type MoveEntry,
} from "@eschaton/shared";
import * as gameRepository from "../db/gameRepository.js";
import { getPool } from "../db.js";
import { selectCpuAction } from "../games/backgammon/CpuOpponent.js";
import { selectCpuMove } from "../games/checkers/CpuOpponent.js";
import { selectCpuAction as selectDominosCpuAction } from "../games/dominos/CpuOpponent.js";
import { GAME_ROOM_DISPOSED_TOPIC } from "../rooms/lobbyPresence.js";
import { trackEvent } from "../telemetry.js";
import { gameRegistry } from "./GameRegistry.js";
import { TurnManager } from "./TurnManager.js";

interface BaseGameRoomOptions extends GameOptions {
  cpuOpponent?: boolean;
  gameId?: string;
  gameType?: string;
  headToHeadMode?: boolean;
  maxPlayers?: number;
  expectedPlayers?: number;
  reconnectionTimeout?: number;
}

const CPU_OPPONENT_DISPLAY_NAME = "CPU Opponent";
const CPU_OPPONENT_SESSION_ID = "cpu-opponent";
const CPU_TURN_DELAY_MS = 200;
const DEFAULT_ACTION_ERROR = "Action failed.";
const DEFAULT_RECONNECTION_TIMEOUT = 30;
const GAME_ENDED_MESSAGE = "game-end";
const HEAD_TO_HEAD_OPPONENT_DISPLAY_NAME = "Player 2";
const HEAD_TO_HEAD_OPPONENT_SESSION_ID = "shared-device-opponent";
const INVALID_ACTION_ERROR = "Invalid action.";
const ROOM_ERROR_MESSAGE = "error";

export class BaseGameRoom extends Room {
  declare state: BaseGameState;

  private plugin!: GamePlugin<BaseGameState>;
  private turnManager?: TurnManager;
  private expectedPlayers = 0;
  private reconnectionTimeout = DEFAULT_RECONNECTION_TIMEOUT;
  private gameId?: string;
  private lobbyGameId?: string;
  private gameStartTime?: number;
  private cpuOpponentEnabled = false;
  private pendingCpuTurn?: Delayed;
  private headToHeadMode = false;
  private moveHistory: MoveEntry[] = [];

  override async onCreate(options: BaseGameRoomOptions = {}) {
    const gameType = typeof options.gameType === "string" ? options.gameType.trim() : "";
    if (!gameType) {
      throw new Error('BaseGameRoom requires a "gameType" option.');
    }

    this.plugin = gameRegistry.get(gameType) as unknown as GamePlugin<BaseGameState>;
    this.cpuOpponentEnabled = options.cpuOpponent === true
      && (gameType === "checkers" || gameType === "backgammon" || gameType === "dominos");
    this.headToHeadMode = options.headToHeadMode === true && gameType === "checkers";

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

    if (typeof options.gameId === "string") {
      const lobbyGameId = options.gameId.trim();
      this.lobbyGameId = lobbyGameId || undefined;
    }

    const state = this.plugin.createState() as BaseGameState;
    this.setState(state);
    this.plugin.lifecycle.onCreate?.(state, options);

    this.registerActionHandlers();

    // Allow clients to request their player-specific data (e.g. hand tiles)
    // after registering message handlers — the initial broadcast during
    // onJoin/startGame may arrive before the client's handler is ready.
    this.onMessage("request-player-data", (client) => {
      this.sendPlayerMessage(client);
    });

    if (this.plugin.lifecycle.onTick) {
      this.setSimulationInterval((deltaTime) => {
        this.plugin.lifecycle.onTick?.(this.state, deltaTime);
      });
    }

    // Chess clock tick (separate from onTick to ensure it runs independently)
    // Disabled when a CPU opponent is present — CPU games are untimed.
    if (this.plugin.chessClockConfig?.enabled && !this.cpuOpponentEnabled) {
      this.setSimulationInterval((deltaTime) => {
        this.updateChessClocks(deltaTime);
      });
    }

    try {
      const pool = getPool();
      this.gameId = await gameRepository.createGame(pool, {
        gameType,
        playerIds: [],
      });
      trackEvent("room_created", {
        gameType,
        roomId: this.roomId,
        gameId: this.gameId,
      });
    } catch (error) {
      console.error("[BaseGameRoom] Failed to create game in DB:", error);
    }
  }

  override onJoin(client: Client, options: Record<string, unknown> = {}) {
    const existingPlayer = this.state.players.get(client.sessionId);
    if (existingPlayer) {
      const wasDisconnected = !existingPlayer.isConnected;
      existingPlayer.isConnected = true;
      this.setControllerOwnedConnection(client.sessionId, true);

      if (wasDisconnected) {
        this.plugin.lifecycle.onPlayerReconnect?.(this.state, client);
        this.sendPlayerMessage(client);
        trackEvent("player_reconnected", {
          gameType: this.plugin.name,
          roomId: this.roomId,
          sessionId: client.sessionId,
        });
      }

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
    player.controllerSessionId = client.sessionId;

    this.state.players.set(client.sessionId, player);
    this.plugin.lifecycle.onPlayerJoin?.(this.state, client, playerIndex);
    trackEvent("player_connected", {
      gameType: this.plugin.name,
      roomId: this.roomId,
      sessionId: client.sessionId,
      isSpectator: String(isSpectator),
    });

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

    if (!isSpectator) {
      this.ensureCpuParticipant(client.sessionId);
      this.ensureHeadToHeadParticipant(client);
      if (this.shouldStartGame()) {
        this.startGame();
      }
    }
  }

  override async onLeave(client: Client, code: number = CloseCode.NORMAL_CLOSURE) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    player.isConnected = false;
    this.setControllerOwnedConnection(client.sessionId, false);
    trackEvent("player_disconnected", {
      gameType: this.plugin.name,
      roomId: this.roomId,
      sessionId: client.sessionId,
      phase: this.state.phase,
      code: String(code),
    });

    if (
      this.state.phase === "playing"
      && !player.isSpectator
      && code !== CloseCode.CONSENTED
    ) {
      try {
        await this.allowReconnection(client, this.reconnectionTimeout);
        player.isConnected = true;
        this.setControllerOwnedConnection(client.sessionId, true);
        return;
      } catch {
        await this.handleReconnectionTimeout(client.sessionId);
        return;
      }
    }

    this.finalizeParticipantDeparture(client.sessionId);

    if (player.isSpectator) {
      this.state.players.delete(client.sessionId);
      return;
    }

    if (this.state.phase !== "playing") {
      if (this.headToHeadMode && !this.hasConnectedController()) {
        await this.disconnect();
      }

      return;
    }

    const remainingPlayers = this.getConnectedParticipants();
    if (remainingPlayers.length === 0) {
      await this.endGame({
        type: "draw",
        scores: {},
        metadata: {
          consented: code === CloseCode.CONSENTED,
          disconnectedPlayerId: client.sessionId,
          reason: "all-players-disconnected",
        },
      });
      return;
    }

    if (remainingPlayers.length !== 1) {
      return;
    }

    const winner = remainingPlayers[0];
    if (winner.controllerSessionId === client.sessionId) {
      await this.endGame({
        type: "draw",
        scores: {},
        metadata: {
          consented: code === CloseCode.CONSENTED,
          disconnectedPlayerId: client.sessionId,
          reason: "controller-owned-opponent",
        },
      });
      return;
    }

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
    this.cancelPendingCpuTurn();
    this.turnManager?.stop();

    if (this.lobbyGameId) {
      this.presence.publish(GAME_ROOM_DISPOSED_TOPIC, {
        gameId: this.lobbyGameId,
        roomId: this.roomId,
      });
    }
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
    await this.processAction(client, actionType, payload, handler, true);
  }

  private async processAction(
    client: Client,
    actionType: string,
    payload: unknown,
    handler: ActionHandler<BaseGameState>,
    sendErrors: boolean,
  ) {
    if (this.state.phase === "ended") {
      return false;
    }

    const player = this.state.players.get(client.sessionId);
    if (player?.isSpectator) {
      if (sendErrors) {
        client.send(ROOM_ERROR_MESSAGE, { message: "Spectators cannot perform actions." });
      }
      return false;
    }

    const actingClient = this.resolveActingClient(client);
    const isValid = this.plugin.conditions.validateAction(
      this.state,
      actingClient,
      actionType,
      payload,
    );

    if (!isValid) {
      if (sendErrors) {
        client.send(ROOM_ERROR_MESSAGE, { message: INVALID_ACTION_ERROR });
      }
      return false;
    }

    const result = handler(this.state, actingClient, payload);
    if (!result.success) {
      if (sendErrors) {
        client.send(ROOM_ERROR_MESSAGE, { message: result.error ?? DEFAULT_ACTION_ERROR });
      }
      return false;
    }

    // Enrich recorded payload for backgammon roll actions (dice are generated
    // server-side and aren't part of the client payload, but move history needs them)
    let recordPayload = payload;
    if (actionType === "roll" && this.plugin.id === "backgammon") {
      const bgState = this.state as BackgammonState;
      recordPayload = { die1: bgState.dice[0], die2: bgState.dice[1] };
    }

    this.recordMove(actionType, actingClient.sessionId, recordPayload);

    this.broadcastPlayerMessages();

    const gameResult = this.plugin.conditions.checkGameEnd(this.state);
    if (result.endsGame || gameResult) {
      await this.endGame(gameResult ?? this.createFallbackGameResult());
      return true;
    }

    // Check for chess clock timeout (after normal game end check)
    if (this.plugin.chessClockConfig?.enabled && !this.cpuOpponentEnabled && this.state.phase === "playing") {
      const timeoutResult = this.checkChessClockTimeout();
      if (timeoutResult) {
        await this.endGame(timeoutResult);
        return true;
      }
    }

    if (result.endsTurn) {
      this.advanceTurn();
    }

    return true;
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
    this.moveHistory = [];

    this.turnManager = new TurnManager(this.orderTurnPlayers(playerIds));

    this.plugin.lifecycle.onGameStart(this.state);
    
    // Initialize chess clocks if enabled (skip for CPU games — they are untimed)
    if (this.plugin.chessClockConfig?.enabled && !this.cpuOpponentEnabled) {
      this.state.player1TimeRemainingMs = this.plugin.chessClockConfig.initialTimeBankMs;
      this.state.player2TimeRemainingMs = this.plugin.chessClockConfig.initialTimeBankMs;
    }
    
    this.turnManager.startTurns();
    this.state.currentTurn = this.turnManager.getCurrentPlayer();
    this.state.turnNumber = this.turnManager.getTurnNumber();
    this.broadcastPlayerMessages();
    this.queueCpuTurnIfNeeded();
    trackEvent("game_started", {
      gameType: this.plugin.name,
      roomId: this.roomId,
      gameId: this.gameId ?? "",
      playerCount: String(playerIds.length),
    });
  }

  private advanceTurn() {
    if (!this.turnManager?.isActive()) {
      return;
    }

    this.state.currentTurn = this.turnManager.nextTurn();
    this.state.turnNumber = this.turnManager.getTurnNumber();

    this.plugin.lifecycle.onTurnStarted?.(this.state, this.state.currentTurn);
    this.queueCpuTurnIfNeeded();
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

    this.finalizeParticipantDeparture(sessionId);

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

    this.cancelPendingCpuTurn();
    this.turnManager?.stop();
    this.state.phase = "ended";
    this.state.currentTurn = "";

    // Enrich metadata with duration and move count
    const durationSeconds = this.gameStartTime
      ? Math.floor((Date.now() - this.gameStartTime) / 1000)
      : 0;

    const formattedHistory = this.plugin.formatMoveHistory
      ? this.plugin.formatMoveHistory(this.state, this.moveHistory)
      : this.moveHistory;

    result.metadata = {
      ...result.metadata,
      durationSeconds,
      totalMoves: this.state.turnNumber ?? 0,
      moveHistory: formattedHistory,
    };

    this.plugin.lifecycle.onGameEnd?.(this.state, result);
    this.broadcast(GAME_ENDED_MESSAGE, result);

    if (this.gameId && this.gameStartTime) {
      try {
        const pool = getPool();
        await gameRepository.endGame(pool, {
          gameId: this.gameId,
          outcome: result as unknown as Record<string, unknown>,
          durationSeconds,
        });
        trackEvent("game_ended", {
          gameType: this.plugin.name,
          roomId: this.roomId,
          gameId: this.gameId,
          resultType: result.type,
          durationSeconds: String(durationSeconds),
        });
      } catch (error) {
        console.error("[BaseGameRoom] Failed to end game in DB:", error);
      }
    }

    if (this.clock) {
      this.clock.setTimeout(() => {
        void this.disconnect();
      }, 6000);
    } else {
      await this.disconnect();
    }
  }

  private ensureCpuParticipant(controllerSessionId: string) {
    if (!this.cpuOpponentEnabled || this.state.players.has(CPU_OPPONENT_SESSION_ID)) {
      return;
    }

    const playerIndex = this.getParticipatingPlayers().length;
    const player = new PlayerInfo();
    player.sessionId = CPU_OPPONENT_SESSION_ID;
    player.displayName = CPU_OPPONENT_DISPLAY_NAME;
    player.playerIndex = playerIndex;
    player.isSpectator = false;
    player.isConnected = true;
    player.controllerSessionId = controllerSessionId;

    this.state.players.set(CPU_OPPONENT_SESSION_ID, player);
    this.plugin.lifecycle.onPlayerJoin?.(
      this.state,
      this.createSyntheticClient(CPU_OPPONENT_SESSION_ID),
      playerIndex,
    );

    if (this.gameId) {
      try {
        const pool = getPool();
        void gameRepository.addParticipant(pool, {
          gameId: this.gameId,
          userId: CPU_OPPONENT_SESSION_ID,
          role: "player",
        });
      } catch (error) {
        console.error("[BaseGameRoom] Failed to add CPU participant to DB:", error);
      }
    }
  }

  private ensureHeadToHeadParticipant(client: Client) {
    if (!this.headToHeadMode || this.state.players.has(HEAD_TO_HEAD_OPPONENT_SESSION_ID)) {
      return;
    }

    const playerIndex = this.getParticipatingPlayers().length;
    const player = new PlayerInfo();
    player.sessionId = HEAD_TO_HEAD_OPPONENT_SESSION_ID;
    player.displayName = HEAD_TO_HEAD_OPPONENT_DISPLAY_NAME;
    player.playerIndex = playerIndex;
    player.isSpectator = false;
    player.isConnected = true;
    player.controllerSessionId = client.sessionId;

    this.state.players.set(HEAD_TO_HEAD_OPPONENT_SESSION_ID, player);
    this.plugin.lifecycle.onPlayerJoin?.(
      this.state,
      this.createSyntheticClient(HEAD_TO_HEAD_OPPONENT_SESSION_ID),
      playerIndex,
    );

    if (this.gameId) {
      try {
        const pool = getPool();
        void gameRepository.addParticipant(pool, {
          gameId: this.gameId,
          userId: HEAD_TO_HEAD_OPPONENT_SESSION_ID,
          role: "player",
        });
      } catch (error) {
        console.error("[BaseGameRoom] Failed to add head-to-head participant to DB:", error);
      }
    }
  }

  private queueCpuTurnIfNeeded() {
    this.cancelPendingCpuTurn();

    if (!this.isCpuTurn(this.state.currentTurn) || this.state.phase !== "playing") {
      return;
    }

    if (!this.clock) {
      void this.executeCpuTurn();
      return;
    }

    this.pendingCpuTurn = this.clock.setTimeout(() => {
      this.pendingCpuTurn = undefined;
      void this.executeCpuTurn();
    }, CPU_TURN_DELAY_MS);
  }

  private cancelPendingCpuTurn() {
    this.pendingCpuTurn?.clear();
    this.pendingCpuTurn = undefined;
  }

  private isCpuTurn(sessionId: string) {
    return this.cpuOpponentEnabled
      && sessionId === CPU_OPPONENT_SESSION_ID;
  }

  private async executeCpuTurn() {
    if (!this.isCpuTurn(this.state.currentTurn) || this.state.phase !== "playing") {
      return;
    }

    if (this.plugin.id === "backgammon") {
      await this.executeBackgammonCpuTurn();
      return;
    }

    if (this.plugin.id === "dominos") {
      await this.executeDominosCpuTurn();
      return;
    }

    await this.executeCheckersCpuTurn();
  }

  private async executeCheckersCpuTurn() {
    const move = selectCpuMove(this.state as CheckersState);
    if (!move) {
      await this.handleTurnTimeout(CPU_OPPONENT_SESSION_ID);
      return;
    }

    const moveHandler = this.plugin.actions.move;
    if (!moveHandler) {
      return;
    }

    const didProcessAction = await this.processAction(
      this.createSyntheticClient(CPU_OPPONENT_SESSION_ID),
      "move",
      move,
      moveHandler as ActionHandler<BaseGameState>,
      false,
    );

    if (!didProcessAction) {
      await this.handleTurnTimeout(CPU_OPPONENT_SESSION_ID);
      return;
    }

    this.queueCpuTurnIfNeeded();
  }

  private async executeBackgammonCpuTurn() {
    const action = selectCpuAction(this.state as BackgammonState);
    if (!action) {
      await this.handleTurnTimeout(CPU_OPPONENT_SESSION_ID);
      return;
    }

    const handler = this.plugin.actions[action.actionType];
    if (!handler) {
      return;
    }

    const payload = action.actionType === "move" ? action.payload : undefined;
    const didProcessAction = await this.processAction(
      this.createSyntheticClient(CPU_OPPONENT_SESSION_ID),
      action.actionType,
      payload,
      handler as ActionHandler<BaseGameState>,
      false,
    );

    if (!didProcessAction) {
      await this.handleTurnTimeout(CPU_OPPONENT_SESSION_ID);
      return;
    }

    this.queueCpuTurnIfNeeded();
  }

  private async executeDominosCpuTurn() {
    const action = selectDominosCpuAction(this.state as DominosState);
    if (!action) {
      await this.handleTurnTimeout(CPU_OPPONENT_SESSION_ID);
      return;
    }

    const handler = this.plugin.actions[action.actionType];
    if (!handler) {
      return;
    }

    const payload = action.actionType === "play" ? action.payload : undefined;
    const didProcessAction = await this.processAction(
      this.createSyntheticClient(CPU_OPPONENT_SESSION_ID),
      action.actionType,
      payload,
      handler as ActionHandler<BaseGameState>,
      false,
    );

    if (!didProcessAction) {
      await this.handleTurnTimeout(CPU_OPPONENT_SESSION_ID);
      return;
    }

    this.queueCpuTurnIfNeeded();
  }

  private resolveActingClient(client: Client) {
    const currentTurnPlayer = this.state.players.get(this.state.currentTurn);
    if (
      !currentTurnPlayer
      || currentTurnPlayer.isSpectator
      || currentTurnPlayer.sessionId === client.sessionId
      || currentTurnPlayer.controllerSessionId !== client.sessionId
    ) {
      return client;
    }

    return this.createSyntheticClient(currentTurnPlayer.sessionId);
  }

  private createSyntheticClient(sessionId: string): Client {
    return {
      sessionId,
      send: () => undefined,
    } as unknown as Client;
  }

  private recordMove(actionType: string, sessionId: string, payload: unknown) {
    const player = this.state.players.get(sessionId);
    const playerName = player?.displayName ?? "Unknown";

    this.moveHistory.push({
      turnNumber: this.state.turnNumber ?? 0,
      playerId: sessionId,
      playerName,
      actionType,
      payload: payload as Record<string, unknown>,
      timestamp: this.getGameElapsedTime(),
    });
  }

  private getGameElapsedTime(): number {
    return this.gameStartTime ? Date.now() - this.gameStartTime : 0;
  }

  private getParticipatingPlayers() {
    return Array.from(this.state.players.values()).filter((player) => !player.isSpectator);
  }

  private getConnectedParticipants() {
    return this.getParticipatingPlayers().filter((player) => player.isConnected);
  }

  private finalizeParticipantDeparture(sessionId: string) {
    this.plugin.lifecycle.onPlayerLeave?.(this.state, sessionId);
    this.turnManager?.removePlayer(sessionId);
    this.releaseControllerOwnedParticipants(sessionId);
    this.syncTurnState();
  }

  private getControllerOwnedParticipants(controllerSessionId: string) {
    return this.getParticipatingPlayers().filter(
      (player) => player.sessionId !== controllerSessionId
        && player.controllerSessionId === controllerSessionId,
    );
  }

  private setControllerOwnedConnection(controllerSessionId: string, isConnected: boolean) {
    for (const player of this.getControllerOwnedParticipants(controllerSessionId)) {
      player.isConnected = isConnected;
    }
  }

  private releaseControllerOwnedParticipants(controllerSessionId: string) {
    for (const player of this.getControllerOwnedParticipants(controllerSessionId)) {
      this.plugin.lifecycle.onPlayerLeave?.(this.state, player.sessionId);
      this.turnManager?.removePlayer(player.sessionId);
    }
  }

  private hasConnectedController() {
    return this.getConnectedParticipants().some(
      (player) => player.controllerSessionId === player.sessionId,
    );
  }

  private shouldStartGame() {
    return this.state.phase === "waiting"
      && this.getConnectedParticipants().length >= this.expectedPlayers;
  }

  private pauseTurnTimerFor(_sessionId: string) {
    // Turn timers removed — chess clocks handle timing now.
  }

  private resumeTurnTimerFor(_sessionId: string) {
    // Turn timers removed — chess clocks handle timing now.
  }

  private isTurnControlledBy(sessionId: string) {
    const currentTurnPlayer = this.state.players.get(this.state.currentTurn);
    if (!currentTurnPlayer) {
      return false;
    }

    return currentTurnPlayer.sessionId === sessionId
      || currentTurnPlayer.controllerSessionId === sessionId;
  }

  private syncTurnState() {
    if (this.turnManager?.isActive() && this.turnManager.getPlayerCount() > 0) {
      this.state.currentTurn = this.turnManager.getCurrentPlayer();
      this.state.turnNumber = this.turnManager.getTurnNumber();
      this.queueCpuTurnIfNeeded();
      return;
    }

    this.cancelPendingCpuTurn();
    if (this.state.phase !== "ended") {
      this.state.currentTurn = "";
    }
  }

  private updateTurnTimeRemaining() {
    this.state.turnTimeRemaining = 0;
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

  private broadcastPlayerMessages() {
    const getMsg = this.plugin.stateFilter?.getPlayerMessage;
    if (!getMsg) return;

    for (const client of this.clients) {
      const msg = getMsg(this.state, client.sessionId);
      if (msg !== null && msg !== undefined) {
        client.send("player-data", msg);
      }
    }
  }

  private sendPlayerMessage(client: Client) {
    const getMsg = this.plugin.stateFilter?.getPlayerMessage;
    if (!getMsg) return;

    const msg = getMsg(this.state, client.sessionId);
    if (msg !== null && msg !== undefined) {
      client.send("player-data", msg);
    }
  }

  private updateChessClocks(deltaTime: number) {
    // Only tick during active gameplay
    if (this.state.phase !== "playing") {
      return;
    }

    // Get the current player
    const currentPlayer = this.state.players.get(this.state.currentTurn);
    if (!currentPlayer || currentPlayer.isSpectator) {
      return;
    }

    // Check if player is connected (pause clock on disconnect)
    if (!currentPlayer.isConnected) {
      return;
    }

    // Decrement the active player's clock
    const playerIndex = currentPlayer.playerIndex;
    if (playerIndex === 0) {
      this.state.player1TimeRemainingMs = Math.max(0, this.state.player1TimeRemainingMs - deltaTime);
    } else if (playerIndex === 1) {
      this.state.player2TimeRemainingMs = Math.max(0, this.state.player2TimeRemainingMs - deltaTime);
    }
  }

  private checkChessClockTimeout(): GameResult | null {
    const players = Array.from(this.state.players.values()).filter((player) => !player.isSpectator);

    // Check if player 1 (index 0) ran out of time
    if (this.state.player1TimeRemainingMs <= 0) {
      const player1 = players.find((p) => p.playerIndex === 0);
      const player2 = players.find((p) => p.playerIndex === 1);
      if (player1 && player2) {
        return {
          type: "timeout",
          winnerId: player2.sessionId,
          scores: {
            [player1.sessionId]: 0,
            [player2.sessionId]: 1,
          },
          metadata: {
            reason: "chess_clock_timeout",
            timedOutPlayerId: player1.sessionId,
          },
        };
      }
    }

    // Check if player 2 (index 1) ran out of time
    if (this.state.player2TimeRemainingMs <= 0) {
      const player1 = players.find((p) => p.playerIndex === 0);
      const player2 = players.find((p) => p.playerIndex === 1);
      if (player1 && player2) {
        return {
          type: "timeout",
          winnerId: player1.sessionId,
          scores: {
            [player1.sessionId]: 1,
            [player2.sessionId]: 0,
          },
          metadata: {
            reason: "chess_clock_timeout",
            timedOutPlayerId: player2.sessionId,
          },
        };
      }
    }

    return null;
  }
}

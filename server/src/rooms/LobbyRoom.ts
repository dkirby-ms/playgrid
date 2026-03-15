import { Client, CloseCode, Room, matchMaker } from "colyseus";
import {
  CREATE_GAME,
  GAME_JOINED,
  GAME_LIST,
  GAME_PLAYERS,
  GAME_REMOVED,
  GAME_STARTED,
  GAME_UPDATED,
  JOIN_GAME,
  LEAVE_GAME,
  LOBBY_ERROR,
  LOBBY_LOG_EVENT,
  ONLINE_PLAYERS,
  SET_READY,
  START_GAME,
  type CreateGamePayload,
  type GameJoinedPayload,
  type GamePlayersPayload,
  type GameSessionInfo,
  type GameStartedPayload,
  type JoinGamePayload,
  type LobbyErrorPayload,
  type LobbyLogEntry,
  type OnlinePlayerInfo,
  type OnlinePlayersPayload,
  type PreGamePlayerInfo,
  type SetReadyPayload,
} from "@eschaton/shared";
import { gameRegistry } from "../game/GameRegistry.js";
import { GAME_ROOM_DISPOSED_TOPIC, type GameRoomDisposedMessage } from "./lobbyPresence.js";

const DEFAULT_GAME_TYPE = "checkers";
const DEFAULT_MAX_PLAYERS = 4;
const LOBBY_RECONNECTION_TIMEOUT_SECONDS = 30;
const MAX_GAME_NAME_LENGTH = 32;
const MAX_DISPLAY_NAME_LENGTH = 24;
const MAX_PLAYER_ID_LENGTH = 64;

interface LobbySession {
  sessionId: string;
  playerId: string;
  displayName: string;
  currentGameId?: string;
}

interface LobbyGameEntry extends GameSessionInfo {
  roomId?: string;
}

export class LobbyRoom extends Room {
  private readonly sessions = new Map<string, LobbySession>();
  private readonly sessionIdByPlayerId = new Map<string, string>();
  private readonly games = new Map<string, LobbyGameEntry>();
  private readonly waitingPlayers = new Map<string, Map<string, PreGamePlayerInfo>>();
  private readonly handleDisposedGameRoom = (message: GameRoomDisposedMessage) => {
    if (!message?.gameId) {
      return;
    }

    const game = this.games.get(message.gameId);
    if (!game || game.status !== "in_progress") {
      return;
    }

    if (game.roomId && message.roomId && game.roomId !== message.roomId) {
      return;
    }

    this.waitingPlayers.delete(message.gameId);
    this.clearSessionAssignments(message.gameId);
    this.games.delete(message.gameId);
    this.broadcast(GAME_REMOVED, { gameId: message.gameId });
    this.broadcastOnlinePlayers();
    this.broadcastLobbyEvent({
      type: "game_finished",
      message: `🏁 ${game.name} finished`,
      gameName: game.name,
      gameType: game.gameType,
    });

    console.log(`[LobbyRoom] Removed disposed game ${message.gameId} from the lobby`);
  };

  override onCreate() {
    this.onMessage(CREATE_GAME, (client, payload: CreateGamePayload) => {
      this.handleCreateGame(client, payload);
    });

    this.onMessage(JOIN_GAME, (client, payload: JoinGamePayload) => {
      void this.handleJoinGame(client, payload);
    });

    this.onMessage(LEAVE_GAME, (client) => {
      this.handleLeaveGame(client);
    });

    this.onMessage(START_GAME, (client) => {
      void this.handleStartGame(client);
    });

    this.onMessage(SET_READY, (client, payload: SetReadyPayload) => {
      this.handleSetReady(client, payload);
    });

    void this.presence.subscribe(GAME_ROOM_DISPOSED_TOPIC, this.handleDisposedGameRoom);
    console.log("[LobbyRoom] Lobby created");
  }

  override onJoin(client: Client, options?: Record<string, unknown>) {
    const displayName = this.normalizeDisplayName(options?.displayName, client.sessionId);
    const playerId = this.normalizePlayerId(options?.playerId, client.sessionId);
    const existingSession = this.sessions.get(client.sessionId);

    if (existingSession) {
      if (existingSession.playerId !== playerId
        && this.sessionIdByPlayerId.get(existingSession.playerId) === client.sessionId) {
        this.sessionIdByPlayerId.delete(existingSession.playerId);
      }

      existingSession.playerId = playerId;
      existingSession.displayName = displayName;
      this.sessionIdByPlayerId.set(playerId, client.sessionId);
      client.send(GAME_LIST, {
        games: Array.from(this.games.values(), (game) => this.toGameSessionInfo(game)),
      });

      this.broadcastOnlinePlayers();

      console.log(`[LobbyRoom] ${existingSession.displayName} rejoined the lobby`);
      return;
    }

    const previousSessionId = this.sessionIdByPlayerId.get(playerId);
    if (previousSessionId && previousSessionId !== client.sessionId) {
      const reclaimedSession = this.reclaimSession(previousSessionId, client.sessionId, playerId, displayName);
      if (reclaimedSession) {
        client.send(GAME_LIST, {
          games: Array.from(this.games.values(), (game) => this.toGameSessionInfo(game)),
        });

        this.broadcastOnlinePlayers();
        console.log(
          `[LobbyRoom] ${displayName} resumed the lobby on a new session (${previousSessionId} → ${client.sessionId})`,
        );
        return;
      }
    }

    this.sessions.set(client.sessionId, {
      sessionId: client.sessionId,
      playerId,
      displayName,
    });
    this.sessionIdByPlayerId.set(playerId, client.sessionId);

    client.send(GAME_LIST, {
      games: Array.from(this.games.values(), (game) => this.toGameSessionInfo(game)),
    });

    this.broadcastOnlinePlayers();
    this.broadcastLobbyEvent({
      type: "player_joined",
      message: `👋 ${displayName} joined the lobby`,
      playerName: displayName,
    });

    console.log(`[LobbyRoom] ${displayName} joined the lobby`);
  }

  override async onLeave(client: Client, code: number = CloseCode.NORMAL_CLOSURE) {
    if (code !== CloseCode.CONSENTED) {
      try {
        await this.allowReconnection(client, LOBBY_RECONNECTION_TIMEOUT_SECONDS);
        return;
      } catch {
        // fall through to final cleanup once the reconnection window expires
      }
    }

    this.removeSession(client.sessionId);
  }

  override onDispose() {
    this.presence.unsubscribe(GAME_ROOM_DISPOSED_TOPIC, this.handleDisposedGameRoom);
    console.log("[LobbyRoom] Lobby disposed");
  }

  private handleCreateGame(client: Client, payload: CreateGamePayload) {
    const session = this.sessions.get(client.sessionId);
    if (!session) {
      this.sendError(client, "You must join the lobby before creating a game.");
      return;
    }

    if (session.currentGameId) {
      this.sendError(client, "Leave your current game before creating another.");
      return;
    }

    const name = this.normalizeGameName(payload.name);
    if (!name) {
      this.sendError(client, "Game name is required.");
      return;
    }

    const gameType = this.normalizeGameType(payload.gameType);
    const hasRegisteredGames = gameRegistry.getAll().length > 0;
    if (hasRegisteredGames && !gameRegistry.has(gameType)) {
      this.sendError(client, `Game type "${gameType}" is not available.`);
      return;
    }

    let maxPlayers = this.normalizeMaxPlayers(payload.maxPlayers);
    if (hasRegisteredGames) {
      const [minPlayers, maxAllowedPlayers] = gameRegistry.get(gameType).metadata.playerCount;
      maxPlayers = Math.min(Math.max(maxPlayers, minPlayers), maxAllowedPlayers);
    }

    const gameId = crypto.randomUUID();
    const game: LobbyGameEntry = {
      id: gameId,
      name,
      gameType,
      hostId: session.sessionId,
      hostName: session.displayName,
      status: "waiting",
      playerCount: 1,
      maxPlayers,
      createdAt: Date.now(),
    };

    this.games.set(gameId, game);
    this.waitingPlayers.set(gameId, new Map([
      [client.sessionId, this.createPreGamePlayerInfo(session)],
    ]));
    session.currentGameId = gameId;

    const payloadOut: GameJoinedPayload = { gameId };
    client.send(GAME_JOINED, payloadOut);
    this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });
    this.broadcastGamePlayers(gameId);
    this.broadcastLobbyEvent({
      type: "game_created",
      message: `🎮 ${session.displayName} created a ${gameType} game`,
      playerName: session.displayName,
      gameName: name,
      gameType,
    });

    console.log(`[LobbyRoom] Created game ${gameId} (${name}, ${gameType})`);
  }

  private async handleJoinGame(client: Client, payload: JoinGamePayload) {
    const session = this.sessions.get(client.sessionId);
    if (!session) {
      this.sendError(client, "You must join the lobby before joining a game.");
      return;
    }

    const game = this.games.get(payload.gameId);
    if (!game) {
      this.sendError(client, "Game not found.");
      return;
    }

    if (session.currentGameId && session.currentGameId !== game.id) {
      this.sendError(client, "Leave your current game before joining another.");
      return;
    }

    const isSpectator = payload.spectator === true;

    if (game.status === "in_progress") {
      if (!game.roomId) {
        this.sendError(client, "Game is starting. Please try again.");
        return;
      }

      if (!isSpectator) {
        this.sendError(client, "Cannot join a game in progress as a player.");
        return;
      }

      session.currentGameId = game.id;
      const joinedPayload: GameJoinedPayload = {
        gameId: game.id,
        roomId: game.roomId,
      };
      client.send(GAME_JOINED, joinedPayload);
      return;
    }

    if (isSpectator) {
      this.sendError(client, "Cannot join a waiting game as a spectator.");
      return;
    }

    const players = this.waitingPlayers.get(game.id);
    if (!players) {
      this.sendError(client, "Game is no longer available.");
      return;
    }

    if (players.has(client.sessionId)) {
      const joinedPayload: GameJoinedPayload = { gameId: game.id };
      client.send(GAME_JOINED, joinedPayload);
      this.broadcastGamePlayers(game.id);
      return;
    }

    if (players.size >= game.maxPlayers) {
      this.sendError(client, "Game is full.");
      return;
    }

    players.set(client.sessionId, this.createPreGamePlayerInfo(session));
    session.currentGameId = game.id;
    game.playerCount = players.size;

    const joinedPayload: GameJoinedPayload = { gameId: game.id };
    client.send(GAME_JOINED, joinedPayload);
    this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });
    this.broadcastGamePlayers(game.id);
    this.broadcastLobbyEvent({
      type: "player_joined_game",
      message: `🎲 ${session.displayName} joined ${game.name}`,
      playerName: session.displayName,
      gameName: game.name,
      gameType: game.gameType,
    });

    console.log(`[LobbyRoom] ${session.displayName} joined game ${game.id}`);
  }

  private handleLeaveGame(clientOrSessionId: Client | string) {
    const sessionId = this.resolveSessionId(clientOrSessionId);
    const session = this.sessions.get(sessionId);
    if (!session?.currentGameId) {
      return;
    }

    const gameId = session.currentGameId;
    session.currentGameId = undefined;

    const game = this.games.get(gameId);
    if (!game) {
      return;
    }

    if (game.status !== "waiting") {
      this.broadcastOnlinePlayers();
      return;
    }

    const players = this.waitingPlayers.get(gameId);
    if (!players) {
      this.broadcastOnlinePlayers();
      return;
    }

    players.delete(sessionId);

    if (sessionId === game.hostId || players.size === 0) {
      this.clearSessionAssignments(gameId);
      this.games.delete(gameId);
      this.waitingPlayers.delete(gameId);
      this.broadcast(GAME_REMOVED, { gameId });
      this.broadcastOnlinePlayers();
      console.log(`[LobbyRoom] Removed waiting game ${gameId}`);
      return;
    }

    game.playerCount = players.size;
    this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });
    this.broadcastGamePlayers(gameId);
    this.broadcastOnlinePlayers();
  }

  private async handleStartGame(client: Client) {
    const session = this.sessions.get(client.sessionId);
    if (!session?.currentGameId) {
      this.sendError(client, "Join a waiting game before starting it.");
      return;
    }

    const game = this.games.get(session.currentGameId);
    if (!game) {
      this.sendError(client, "Game not found.");
      return;
    }

    if (game.hostId !== client.sessionId) {
      this.sendError(client, "Only the host can start the game.");
      return;
    }

    if (game.status !== "waiting") {
      this.sendError(client, "Game has already started.");
      return;
    }

    const players = this.waitingPlayers.get(game.id);
    if (!players || players.size === 0) {
      this.sendError(client, "Cannot start an empty game.");
      return;
    }

    const registeredPlugin = gameRegistry.getAll().length > 0
      ? gameRegistry.get(game.gameType)
      : undefined;
    const minPlayers = registeredPlugin?.metadata.playerCount[0] ?? 1;
    if (players.size < minPlayers) {
      this.sendError(client, `At least ${minPlayers} players are required to start this game.`);
      return;
    }

    if (!this.areWaitingPlayersReady(game, players)) {
      this.sendError(client, "All players must be ready before starting the game.");
      return;
    }

    try {
      const room = await matchMaker.createRoom("game", {
        gameId: game.id,
        gameType: game.gameType,
        maxPlayers: game.maxPlayers,
        expectedPlayers: players.size,
      });

      game.status = "in_progress";
      game.roomId = room.roomId;
      game.playerCount = players.size;

      this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });

      const startedPayload: GameStartedPayload = {
        gameId: game.id,
        roomId: room.roomId,
        gameType: game.gameType,
      };

      for (const sessionId of players.keys()) {
        const playerClient = this.getClientBySessionId(sessionId);
        playerClient?.send(GAME_STARTED, startedPayload);
      }

      this.broadcastLobbyEvent({
        type: "game_started",
        message: `🚀 ${game.name} started`,
        gameName: game.name,
        gameType: game.gameType,
      });

      this.waitingPlayers.delete(game.id);
      console.log(`[LobbyRoom] Started game ${game.id} in room ${room.roomId}`);
    } catch (error) {
      console.error("[LobbyRoom] Failed to create game room", error);
      this.sendError(client, "Failed to start the game.");
    }
  }

  private handleSetReady(client: Client, payload: SetReadyPayload) {
    const session = this.sessions.get(client.sessionId);
    if (!session?.currentGameId) {
      this.sendError(client, "Join a waiting game before changing ready state.");
      return;
    }

    const game = this.games.get(session.currentGameId);
    if (!game || game.status !== "waiting") {
      this.sendError(client, "Ready state is only available while waiting.");
      return;
    }

    const players = this.waitingPlayers.get(game.id);
    const player = players?.get(client.sessionId);
    if (!player) {
      this.sendError(client, "Player is not part of this waiting game.");
      return;
    }

    player.isReady = payload.ready;
    this.broadcastGamePlayers(game.id);
  }

  private broadcastGamePlayers(gameId: string) {
    const players = this.waitingPlayers.get(gameId);
    if (!players) {
      return;
    }

    const payload: GamePlayersPayload = {
      gameId,
      players: Array.from(players.values()),
    };

    for (const sessionId of players.keys()) {
      const client = this.getClientBySessionId(sessionId);
      client?.send(GAME_PLAYERS, payload);
    }
  }

  private broadcastOnlinePlayers() {
    const players: OnlinePlayerInfo[] = Array.from(
      this.sessions.values(),
      (session) => ({
        userId: session.sessionId,
        displayName: session.displayName,
        status: session.currentGameId ? "in_game" as const : "in_lobby" as const,
      }),
    );
    const payload: OnlinePlayersPayload = { players };
    this.broadcast(ONLINE_PLAYERS, payload);
  }

  private clearSessionAssignments(gameId: string) {
    for (const session of this.sessions.values()) {
      if (session.currentGameId === gameId) {
        session.currentGameId = undefined;
      }
    }
  }

  private reclaimSession(
    previousSessionId: string,
    nextSessionId: string,
    playerId: string,
    displayName: string,
  ) {
    const previousSession = this.sessions.get(previousSessionId);
    if (!previousSession) {
      this.sessionIdByPlayerId.delete(playerId);
      return null;
    }

    const reclaimedSession: LobbySession = {
      ...previousSession,
      sessionId: nextSessionId,
      playerId,
      displayName,
    };

    this.sessions.delete(previousSessionId);
    this.sessions.set(nextSessionId, reclaimedSession);
    this.sessionIdByPlayerId.set(playerId, nextSessionId);

    const waitingGamesToRefresh = new Set<string>();
    for (const [gameId, players] of this.waitingPlayers.entries()) {
      const existingPlayer = players.get(previousSessionId);
      if (!existingPlayer) {
        continue;
      }

      players.delete(previousSessionId);
      players.set(nextSessionId, {
        ...existingPlayer,
        userId: nextSessionId,
        displayName,
      });
      waitingGamesToRefresh.add(gameId);
    }

    for (const game of this.games.values()) {
      if (game.hostId !== previousSessionId) {
        continue;
      }

      game.hostId = nextSessionId;
      game.hostName = displayName;
      this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });
    }

    for (const gameId of waitingGamesToRefresh) {
      this.broadcastGamePlayers(gameId);
    }

    return reclaimedSession;
  }

  private removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.currentGameId) {
      const game = this.games.get(session.currentGameId);
      if (game?.status === "in_progress") {
        session.currentGameId = undefined;
      }
    }

    this.handleLeaveGame(sessionId);
    this.sessions.delete(sessionId);
    if (this.sessionIdByPlayerId.get(session.playerId) === sessionId) {
      this.sessionIdByPlayerId.delete(session.playerId);
    }
    this.broadcastOnlinePlayers();
    this.broadcastLobbyEvent({
      type: "player_left",
      message: `👋 ${session.displayName} left the lobby`,
      playerName: session.displayName,
    });
  }

  private resolveSessionId(clientOrSessionId: Client | string) {
    return typeof clientOrSessionId === "string"
      ? clientOrSessionId
      : clientOrSessionId.sessionId;
  }

  private getClientBySessionId(sessionId: string) {
    return this.clients.find((client) => client.sessionId === sessionId);
  }

  private areWaitingPlayersReady(game: LobbyGameEntry, players: Map<string, PreGamePlayerInfo>) {
    return Array.from(players.entries()).every(
      ([sessionId, player]) => sessionId === game.hostId || player.isReady,
    );
  }

  private createPreGamePlayerInfo(session: LobbySession): PreGamePlayerInfo {
    return {
      userId: session.sessionId,
      displayName: session.displayName,
      isReady: false,
    };
  }

  private toGameSessionInfo(game: LobbyGameEntry): GameSessionInfo {
    return {
      id: game.id,
      name: game.name,
      gameType: game.gameType,
      hostId: game.hostId,
      hostName: game.hostName,
      status: game.status,
      playerCount: game.playerCount,
      maxPlayers: game.maxPlayers,
      createdAt: game.createdAt,
      canSpectate: game.status === "in_progress" && !!game.roomId,
    };
  }

  private sendError(client: Client, message: string) {
    const payload: LobbyErrorPayload = { message };
    client.send(LOBBY_ERROR, payload);
  }

  private broadcastLobbyEvent(entry: Omit<LobbyLogEntry, "timestamp">) {
    const event: LobbyLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    this.broadcast(LOBBY_LOG_EVENT, event);
  }

  private normalizeGameName(value: unknown) {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().slice(0, MAX_GAME_NAME_LENGTH);
  }

  private normalizeDisplayName(value: unknown, fallbackSessionId: string) {
    if (typeof value !== "string") {
      return `Player ${fallbackSessionId.slice(0, 6)}`;
    }

    const trimmed = value.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    return trimmed || `Player ${fallbackSessionId.slice(0, 6)}`;
  }

  private normalizePlayerId(value: unknown, fallbackSessionId: string) {
    if (typeof value !== "string") {
      return fallbackSessionId;
    }

    const trimmed = value.trim().slice(0, MAX_PLAYER_ID_LENGTH);
    return trimmed || fallbackSessionId;
  }

  private normalizeGameType(value: unknown) {
    if (typeof value !== "string") {
      return DEFAULT_GAME_TYPE;
    }

    const trimmed = value.trim();
    return trimmed || DEFAULT_GAME_TYPE;
  }

  private normalizeMaxPlayers(value: number | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_MAX_PLAYERS;
    }

    return Math.max(1, Math.floor(value));
  }
}

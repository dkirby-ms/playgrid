import { Client, Room, matchMaker } from "colyseus";
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
  SET_READY,
  START_GAME,
  type CreateGamePayload,
  type GameJoinedPayload,
  type GamePlayersPayload,
  type GameSessionInfo,
  type GameStartedPayload,
  type JoinGamePayload,
  type LobbyErrorPayload,
  type PreGamePlayerInfo,
  type SetReadyPayload,
} from "@eschaton/playgrid-shared";

const DEFAULT_MAX_PLAYERS = 4;
const MAX_GAME_NAME_LENGTH = 32;
const MAX_DISPLAY_NAME_LENGTH = 24;

interface LobbySession {
  sessionId: string;
  displayName: string;
  currentGameId?: string;
}

interface LobbyGameEntry extends GameSessionInfo {
  roomId?: string;
}

export class LobbyRoom extends Room {
  private readonly sessions = new Map<string, LobbySession>();
  private readonly games = new Map<string, LobbyGameEntry>();
  private readonly waitingPlayers = new Map<string, Map<string, PreGamePlayerInfo>>();

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

    console.log("[LobbyRoom] Lobby created");
  }

  override onJoin(client: Client, options?: Record<string, unknown>) {
    const displayName = this.normalizeDisplayName(options?.displayName, client.sessionId);

    this.sessions.set(client.sessionId, {
      sessionId: client.sessionId,
      displayName,
    });

    client.send(GAME_LIST, {
      games: Array.from(this.games.values(), (game) => this.toGameSessionInfo(game)),
    });

    console.log(`[LobbyRoom] ${displayName} joined the lobby`);
  }

  override onLeave(client: Client, _code: number) {
    this.handleLeaveGame(client);
    this.sessions.delete(client.sessionId);
  }

  override onDispose() {
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

    const gameId = crypto.randomUUID();
    const maxPlayers = this.normalizeMaxPlayers(payload.maxPlayers);
    const game: LobbyGameEntry = {
      id: gameId,
      name,
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

    console.log(`[LobbyRoom] Created game ${gameId} (${name})`);
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

    if (game.status === "in_progress") {
      if (!game.roomId) {
        this.sendError(client, "Game is starting. Please try again.");
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

    console.log(`[LobbyRoom] ${session.displayName} joined game ${game.id}`);
  }

  private handleLeaveGame(client: Client) {
    const session = this.sessions.get(client.sessionId);
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
      return;
    }

    const players = this.waitingPlayers.get(gameId);
    if (!players) {
      return;
    }

    players.delete(client.sessionId);

    if (client.sessionId === game.hostId || players.size === 0) {
      this.clearGameAssignments(gameId, players);
      this.games.delete(gameId);
      this.waitingPlayers.delete(gameId);
      this.broadcast(GAME_REMOVED, { gameId });
      console.log(`[LobbyRoom] Removed waiting game ${gameId}`);
      return;
    }

    game.playerCount = players.size;
    this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });
    this.broadcastGamePlayers(gameId);
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

    try {
      const room = await matchMaker.createRoom("game", {
        gameId: game.id,
        maxPlayers: game.maxPlayers,
      });

      game.status = "in_progress";
      game.roomId = room.roomId;
      game.playerCount = players.size;

      this.broadcast(GAME_UPDATED, { game: this.toGameSessionInfo(game) });

      const startedPayload: GameStartedPayload = {
        gameId: game.id,
        roomId: room.roomId,
      };

      for (const sessionId of players.keys()) {
        const playerClient = this.getClientBySessionId(sessionId);
        playerClient?.send(GAME_STARTED, startedPayload);
      }

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

  private clearGameAssignments(gameId: string, players: Map<string, PreGamePlayerInfo>) {
    for (const sessionId of players.keys()) {
      const session = this.sessions.get(sessionId);
      if (session?.currentGameId === gameId) {
        session.currentGameId = undefined;
      }
    }
  }

  private getClientBySessionId(sessionId: string) {
    return this.clients.find((client) => client.sessionId === sessionId);
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
      hostId: game.hostId,
      hostName: game.hostName,
      status: game.status,
      playerCount: game.playerCount,
      maxPlayers: game.maxPlayers,
      createdAt: game.createdAt,
    };
  }

  private sendError(client: Client, message: string) {
    const payload: LobbyErrorPayload = { message };
    client.send(LOBBY_ERROR, payload);
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

  private normalizeMaxPlayers(value: number | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_MAX_PLAYERS;
    }

    return Math.max(1, Math.floor(value));
  }
}

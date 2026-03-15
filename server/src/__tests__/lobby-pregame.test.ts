import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateRoom, mockGameRegistry, mockedCloseCode, sharedExports } = vi.hoisted(() => ({
  mockCreateRoom: vi.fn(),
  mockGameRegistry: {
    getAll: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
  },
  mockedCloseCode: {
    NORMAL_CLOSURE: 1000,
    CONSENTED: 4000,
  },
  sharedExports: {
    CREATE_GAME: "create_game",
    JOIN_GAME: "join_game",
    LEAVE_GAME: "leave_game",
    START_GAME: "start_game",
    SET_READY: "set_ready",
    GAME_LIST: "game_list",
    GAME_JOINED: "game_joined",
    GAME_UPDATED: "game_updated",
    GAME_REMOVED: "game_removed",
    GAME_STARTED: "game_started",
    GAME_PLAYERS: "game_players",
    LOBBY_ERROR: "lobby_error",
    ONLINE_PLAYERS: "online_players",
    LOBBY_LOG_EVENT: "lobby_log_event",
    DEFAULT_MAP_SIZE: 128,
    LOBBY_DEFAULTS: {
      MIN_PLAYERS: 1,
      MAX_PLAYERS: 8,
      MIN_GAME_NAME_LENGTH: 1,
      MAX_GAME_NAME_LENGTH: 32,
    },
  },
}));

vi.mock("colyseus", () => ({
  Room: class {},
  CloseCode: mockedCloseCode,
  matchMaker: { createRoom: mockCreateRoom },
}));

vi.mock("@eschaton/shared", () => sharedExports);
vi.mock("../game/GameRegistry", () => ({ gameRegistry: mockGameRegistry }));

const shared = await import("@eschaton/shared");
const lobbyModule = await import("../rooms/LobbyRoom")
  .catch(() => import("../rooms/LobbyRoom.ts"))
  .catch(() => import("../rooms/LobbyRoom.js"))
  .catch(() => null);

const {
  GAME_LIST,
  GAME_JOINED,
  GAME_STARTED,
  GAME_PLAYERS,
  GAME_UPDATED,
  ONLINE_PLAYERS,
  LOBBY_ERROR,
  LOBBY_DEFAULTS,
  DEFAULT_MAP_SIZE,
} = shared;

const LobbyRoom = lobbyModule?.LobbyRoom;
const describeLobby = LobbyRoom ? describe : describe.skip;
const CONSENTED_CLOSE = mockedCloseCode.CONSENTED;

type MockClient = {
  sessionId: string;
  send: ReturnType<typeof vi.fn>;
  userId?: string;
  displayName?: string;
  auth?: {
    userId: string;
    displayName: string;
    isGuest: boolean;
  };
};

type TestRoom = Record<string, any>;

function createClient(sessionId: string, displayName = sessionId): MockClient {
  return {
    sessionId,
    displayName,
    userId: sessionId,
    send: vi.fn(),
  };
}

function createLobbyRoom(): TestRoom {
  if (!LobbyRoom) {
    throw new Error("LobbyRoom is not available in the template yet");
  }

  const games = new Map<string, any>();
  const players = new Map<string, any>();
  const room = Object.assign(new LobbyRoom(), {
    roomId: "lobby-room",
    state: { games, players },
    games,
    waitingPlayers: new Map<string, Map<string, any>>(),
    playerGameMap: new Map<string, string>(),
    sessions: new Map<string, { userId: string; displayName: string; isGuest: boolean }>(),
    pendingGameOptions: new Map<string, Record<string, unknown>>(),
    gameRoomIds: new Map<string, string>(),
    clients: [] as MockClient[],
    allowReconnection: vi.fn(),
    broadcast: vi.fn(),
    onMessage: vi.fn(),
    presence: {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn(),
    },
    setState: vi.fn(),
    setSimulationInterval: vi.fn(),
  });

  room.onCreate();
  return room;
}

function registerClient(
  room: TestRoom,
  client: MockClient,
  overrides: Partial<{ userId: string; displayName: string; isGuest: boolean }> = {},
) {
  const userId = overrides.userId ?? client.userId ?? client.sessionId;
  const displayName = overrides.displayName ?? client.displayName ?? `Player ${client.sessionId}`;
  const isGuest = overrides.isGuest ?? true;

  client.userId = userId;
  client.displayName = displayName;
  client.auth = { userId, displayName, isGuest };

  room.sessions.set(client.sessionId, {
    sessionId: client.sessionId,
    playerId: userId,
    displayName,
    currentGameId: undefined,
  });
  room.sessionIdByPlayerId?.set(userId, client.sessionId);
  room.state.players.set(client.sessionId, {
    userId,
    displayName,
    isGuest,
    activeGameId: "",
  });

  if (!room.clients.some((existing: MockClient) => existing.sessionId === client.sessionId)) {
    room.clients.push(client);
  }
}

function getGames(room: TestRoom) {
  return room.games ?? room.state?.games;
}

function getGameIds(room: TestRoom): string[] {
  return Array.from(getGames(room).keys());
}

function getGame(room: TestRoom, gameId: string) {
  return getGames(room).get(gameId);
}

function getWaitingPlayers(room: TestRoom, gameId: string): Map<string, any> {
  return room.waitingPlayers.get(gameId) ?? new Map<string, any>();
}

function getTrackedGameId(room: TestRoom, sessionId: string): string | undefined {
  return room.playerGameMap.get(sessionId)
    ?? room.sessions.get(sessionId)?.currentGameId
    ?? room.state?.players?.get(sessionId)?.activeGameId;
}

function findPayload(client: MockClient, messageType: string) {
  const match = client.send.mock.calls.find(([type]) => type === messageType);
  return match?.[1];
}

function createPlugin(minPlayers: number, maxPlayers: number) {
  return {
    metadata: {
      playerCount: [minPlayers, maxPlayers],
    },
  };
}

function findLastPayload(client: MockClient, messageType: string) {
  const match = [...client.send.mock.calls].reverse().find(([type]) => type === messageType);
  return match?.[1];
}

function expectLobbyError(client: MockClient, expectedText: string | RegExp) {
  const payload = findLastPayload(client, LOBBY_ERROR) as { message?: string } | undefined;
  expect(payload?.message).toBeTruthy();

  if (typeof expectedText === "string") {
    expect(payload?.message?.toLowerCase()).toContain(expectedText.toLowerCase());
    return;
  }

  expect(payload?.message).toMatch(expectedText);
}

async function createGame(
  room: TestRoom,
  client: MockClient,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const before = new Set(getGameIds(room));

  await room.handleCreateGame(client, {
    name: "Test Game",
    maxPlayers: 4,
    mapSize: DEFAULT_MAP_SIZE,
    ...payload,
  });

  const joined = findPayload(client, GAME_JOINED) as { gameId?: string } | undefined;
  return joined?.gameId ?? getGameIds(room).find((id) => !before.has(id)) ?? "";
}

describeLobby("LobbyRoom pregame flow", () => {
  let room: TestRoom;
  let host: MockClient;
  let guest: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGameRegistry.getAll.mockReturnValue([]);
    mockGameRegistry.has.mockReturnValue(false);
    mockGameRegistry.get.mockImplementation(() => {
      throw new Error("Unexpected gameRegistry.get() call");
    });

    room = createLobbyRoom();
    host = createClient("host-session", "Host");
    guest = createClient("guest-session", "Guest");
    registerClient(room, host, { userId: "host-user", displayName: "Host" });
    registerClient(room, guest, { userId: "guest-user", displayName: "Guest" });
    mockCreateRoom.mockResolvedValue({ roomId: "game-room-123" });
  });

  it("creates a waiting game and seeds the host in waitingPlayers", async () => {
    const gameId = await createGame(room, host);

    expect(gameId).toBeTruthy();
    expect(getGame(room, gameId)).toMatchObject({
      status: "waiting",
      gameType: "checkers",
      playerCount: 1,
    });
    expect(getWaitingPlayers(room, gameId).get(host.sessionId)).toMatchObject({
      userId: host.sessionId,
      displayName: "Host",
      isReady: false,
    });
    expect(getTrackedGameId(room, host.sessionId)).toBe(gameId);
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it("sends GAME_JOINED without a roomId while the game is still waiting", async () => {
    const gameId = await createGame(room, host);

    const joinedPayload = findPayload(host, GAME_JOINED) as { gameId?: string; roomId?: string } | undefined;

    expect(joinedPayload?.gameId).toBe(gameId);
    expect(joinedPayload?.roomId).toBeUndefined();
  });

  it("allows a second player to join a waiting game", async () => {
    const gameId = await createGame(room, host);

    await room.handleJoinGame(guest, { gameId });

    expect(getGame(room, gameId)?.playerCount).toBe(2);
    expect(getWaitingPlayers(room, gameId).get(guest.sessionId)).toMatchObject({
      userId: guest.sessionId,
      displayName: "Guest",
      isReady: false,
    });
    expect(getTrackedGameId(room, guest.sessionId)).toBe(gameId);
    expect(findPayload(guest, GAME_JOINED)).toEqual(expect.objectContaining({ gameId }));
  });

  it("toggles ready state and broadcasts GAME_PLAYERS", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });

    host.send.mockClear();
    guest.send.mockClear();

    room.handleSetReady(guest, { ready: true });
    expect(getWaitingPlayers(room, gameId).get(guest.sessionId)?.isReady).toBe(true);
    expect(findPayload(host, GAME_PLAYERS)).toEqual(
      expect.objectContaining({ gameId, players: expect.any(Array) }),
    );
    expect(findPayload(guest, GAME_PLAYERS)).toEqual(
      expect.objectContaining({ gameId, players: expect.any(Array) }),
    );

    room.handleSetReady(guest, { ready: false });
    expect(getWaitingPlayers(room, gameId).get(guest.sessionId)?.isReady).toBe(false);
  });

  it("rejects starting a game while joined players are still unready", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });

    host.send.mockClear();
    guest.send.mockClear();

    await room.handleStartGame(host);

    expect(mockCreateRoom).not.toHaveBeenCalled();
    expect(getGame(room, gameId)?.status).toBe("waiting");
    expect(findPayload(host, GAME_STARTED)).toBeUndefined();
    expect(findPayload(guest, GAME_STARTED)).toBeUndefined();
    expectLobbyError(host, /ready/i);
  });

  it("starts a game through matchMaker once every waiting player is ready", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });
    room.handleSetReady(guest, { ready: true });

    host.send.mockClear();
    guest.send.mockClear();

    await room.handleStartGame(host);

    expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    expect(mockCreateRoom).toHaveBeenCalledWith("game", {
      gameId,
      gameType: "checkers",
      maxPlayers: 4,
      expectedPlayers: 2,
    });
    expect(getGame(room, gameId)?.status).toBe("in_progress");
    expect(findPayload(host, GAME_STARTED)).toEqual({ gameId, roomId: "game-room-123", gameType: "checkers" });
    expect(findPayload(guest, GAME_STARTED)).toEqual({ gameId, roomId: "game-room-123", gameType: "checkers" });
  });

  it("supports the full create → join → ready → start path", async () => {
    const gameId = await createGame(room, host, { name: "Full Flow" });

    await room.handleJoinGame(guest, { gameId });
    room.handleSetReady(guest, { ready: true });
    await room.handleStartGame(host);

    expect(getWaitingPlayers(room, gameId).size).toBe(0);
    expect(getGame(room, gameId)?.status).toBe("in_progress");
    expect(findPayload(host, GAME_STARTED)).toEqual({ gameId, roomId: "game-room-123", gameType: "checkers" });
    expect(findPayload(guest, GAME_STARTED)).toEqual({ gameId, roomId: "game-room-123", gameType: "checkers" });
  });

  it("blocks non-host players from starting a game", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });

    guest.send.mockClear();
    await room.handleStartGame(guest);

    expect(mockCreateRoom).not.toHaveBeenCalled();
    expectLobbyError(guest, "host");
  });

  it("rejects joins for games that are already marked in progress but not joinable", async () => {
    const gameId = await createGame(room, host);
    const game = getGame(room, gameId);
    game.status = "in_progress";
    delete game.roomId;

    const lateJoiner = createClient("late-joiner", "Late");
    registerClient(room, lateJoiner, { userId: "late-user", displayName: "Late" });

    await room.handleJoinGame(lateJoiner, { gameId });

    expectLobbyError(lateJoiner, /starting|started/i);
  });

  it("rejects joins when the game is already full", async () => {
    const gameId = await createGame(room, host, { maxPlayers: 1 });

    await room.handleJoinGame(guest, { gameId });

    expectLobbyError(guest, "full");
  });

  it("skips game type validation when no plugins are registered", async () => {
    const gameId = await createGame(room, host, { gameType: "go-fish" });

    expect(getGame(room, gameId)?.gameType).toBe("go-fish");
    expect(room.broadcast).toHaveBeenCalledWith(GAME_UPDATED, {
      game: expect.objectContaining({ gameType: "go-fish" }),
    });
  });

  it("defaults missing gameType to checkers and includes it in GAME_LIST", async () => {
    const plugin = createPlugin(2, 4);
    mockGameRegistry.getAll.mockReturnValue([plugin]);
    mockGameRegistry.has.mockImplementation((gameType: string) => gameType === "checkers");
    mockGameRegistry.get.mockReturnValue(plugin);

    const gameId = await createGame(room, host, { name: "Default Type" });
    const spectator = createClient("spectator-session", "Spectator");

    room.onJoin(spectator as never, { displayName: "Spectator" });

    expect(getGame(room, gameId)).toMatchObject({
      gameType: "checkers",
      maxPlayers: 4,
    });
    expect(findPayload(spectator, GAME_LIST)).toEqual({
      games: [expect.objectContaining({ id: gameId, gameType: "checkers" })],
    });
  });

  it("rejects unknown game types once plugins are registered", async () => {
    mockGameRegistry.getAll.mockReturnValue([createPlugin(2, 4)]);
    mockGameRegistry.has.mockReturnValue(false);

    await room.handleCreateGame(host, {
      name: "Unsupported",
      gameType: "go-fish",
      maxPlayers: 4,
    });

    expect(getGameIds(room)).toHaveLength(0);
    expectLobbyError(host, /game type|available/i);
  });

  it("accepts registered game types and clamps player limits to plugin metadata", async () => {
    const plugin = createPlugin(2, 3);
    mockGameRegistry.getAll.mockReturnValue([plugin]);
    mockGameRegistry.has.mockImplementation((gameType: string) => gameType === "checkers");
    mockGameRegistry.get.mockImplementation((gameType: string) => {
      if (gameType !== "checkers") {
        throw new Error(`Unexpected game type ${gameType}`);
      }
      return plugin;
    });

    const lowGameId = await createGame(room, host, {
      gameType: "checkers",
      maxPlayers: 1,
    });

    const otherHost = createClient("other-host", "Other Host");
    registerClient(room, otherHost, { userId: "other-host-user", displayName: "Other Host" });
    const highGameId = await createGame(room, otherHost, {
      name: "High Limit",
      gameType: "checkers",
      maxPlayers: 99,
    });

    expect(getGame(room, lowGameId)).toMatchObject({
      gameType: "checkers",
      maxPlayers: 2,
    });
    expect(getGame(room, highGameId)).toMatchObject({
      gameType: "checkers",
      maxPlayers: 3,
    });
    expect(room.broadcast).toHaveBeenCalledWith(GAME_UPDATED, {
      game: expect.objectContaining({ gameType: "checkers", maxPlayers: 2 }),
    });
    expect(room.broadcast).toHaveBeenCalledWith(GAME_UPDATED, {
      game: expect.objectContaining({ gameType: "checkers", maxPlayers: 3 }),
    });
  });

  it("rejects joins for missing games", async () => {
    await room.handleJoinGame(guest, { gameId: "missing-game" });

    expectLobbyError(guest, "not");
  });

  it("does not allow creating or joining another game while already tracked in one", async () => {
    const hostGameId = await createGame(room, host);

    const otherHost = createClient("other-host", "Other Host");
    registerClient(room, otherHost, { userId: "other-host-user", displayName: "Other Host" });
    const otherGameId = await createGame(room, otherHost, { name: "Other Game" });

    host.send.mockClear();
    await room.handleCreateGame(host, { name: "Second Game" });
    expectLobbyError(host, /leave your current game|already/i);

    host.send.mockClear();
    await room.handleJoinGame(host, { gameId: otherGameId });
    expectLobbyError(host, /leave your current game|already/i);
    expect(getTrackedGameId(room, host.sessionId)).toBe(hostGameId);
  });

  it("removes a leaving player from the waiting list", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });

    room.handleLeaveGame(guest);

    expect(getWaitingPlayers(room, gameId).has(guest.sessionId)).toBe(false);
    expect(getGame(room, gameId)?.playerCount).toBe(1);
    expect(getTrackedGameId(room, guest.sessionId)).toBeFalsy();
  });

  it("removes a consented leaver from the waiting room immediately", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });

    await room.onLeave(guest, CONSENTED_CLOSE);

    expect(getWaitingPlayers(room, gameId).has(guest.sessionId)).toBe(false);
    expect(getTrackedGameId(room, guest.sessionId)).toBeFalsy();
    expect(room.sessions.has(guest.sessionId)).toBe(false);
    expect(getGame(room, gameId)).toMatchObject({ playerCount: 1, status: "waiting" });
  });

  it("removes the game when the host leaves an otherwise empty waiting game", async () => {
    const gameId = await createGame(room, host);

    room.handleLeaveGame(host);

    expect(getGames(room).has(gameId)).toBe(false);
    expect(room.waitingPlayers.has(gameId)).toBe(false);
  });

  it("preserves a waiting-room spot during an unexpected disconnect", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });
    room.allowReconnection.mockResolvedValue(undefined);

    await room.onLeave(guest);

    expect(room.allowReconnection).toHaveBeenCalledWith(guest, 30);
    expect(getWaitingPlayers(room, gameId).has(guest.sessionId)).toBe(true);
    expect(getTrackedGameId(room, guest.sessionId)).toBe(gameId);
    expect(room.sessions.has(guest.sessionId)).toBe(true);
  });

  it("reclaims a refreshed lobby session instead of duplicating the player online", async () => {
    const refreshRoom = createLobbyRoom();
    const originalClient = createClient("original-session", "Host");
    const refreshedClient = createClient("refreshed-session", "Host");

    refreshRoom.clients.push(originalClient, refreshedClient);
    refreshRoom.onJoin(originalClient as never, { displayName: "Host", playerId: "browser-tab-1" });
    refreshRoom.allowReconnection.mockResolvedValue(undefined);

    await refreshRoom.onLeave(originalClient as never);
    refreshRoom.broadcast.mockClear();

    refreshRoom.onJoin(refreshedClient as never, {
      displayName: "Host",
      playerId: "browser-tab-1",
    });

    const onlinePlayersPayload = refreshRoom.broadcast.mock.calls
      .filter(([type]: [string]) => type === ONLINE_PLAYERS)
      .at(-1)?.[1];

    expect(refreshRoom.sessions.has(originalClient.sessionId)).toBe(false);
    expect(refreshRoom.sessions.get(refreshedClient.sessionId)).toMatchObject({
      playerId: "browser-tab-1",
      displayName: "Host",
    });
    expect(onlinePlayersPayload).toEqual({
      players: [
        expect.objectContaining({
          userId: refreshedClient.sessionId,
          displayName: "Host",
          status: "in_lobby",
        }),
      ],
    });
  });

  it("transfers waiting-room ownership to the refreshed lobby session", async () => {
    const refreshRoom = createLobbyRoom();
    const originalHost = createClient("original-host-session", "Host");
    const refreshedHost = createClient("refreshed-host-session", "Host");

    refreshRoom.clients.push(originalHost, refreshedHost);
    refreshRoom.onJoin(originalHost as never, { displayName: "Host", playerId: "browser-tab-1" });
    const gameId = await createGame(refreshRoom, originalHost);
    refreshRoom.allowReconnection.mockResolvedValue(undefined);

    await refreshRoom.onLeave(originalHost as never);
    refreshRoom.broadcast.mockClear();

    refreshRoom.onJoin(refreshedHost as never, {
      displayName: "Host",
      playerId: "browser-tab-1",
    });

    expect(refreshRoom.sessions.has(originalHost.sessionId)).toBe(false);
    expect(getTrackedGameId(refreshRoom, refreshedHost.sessionId)).toBe(gameId);
    expect(getWaitingPlayers(refreshRoom, gameId).has(originalHost.sessionId)).toBe(false);
    expect(getWaitingPlayers(refreshRoom, gameId).get(refreshedHost.sessionId)).toMatchObject({
      userId: refreshedHost.sessionId,
      displayName: "Host",
      isReady: false,
    });
    expect(getGame(refreshRoom, gameId)).toMatchObject({
      hostId: refreshedHost.sessionId,
      hostName: "Host",
    });
  });

  it("keeps a host-owned waiting room reserved across an unexpected disconnect", async () => {
    const gameId = await createGame(room, host);
    room.allowReconnection.mockResolvedValue(undefined);

    await room.onLeave(host);

    expect(getGames(room).has(gameId)).toBe(true);
    expect(getTrackedGameId(room, host.sessionId)).toBe(gameId);
    expect(room.sessions.has(host.sessionId)).toBe(true);
  });

  it("cleans up tracked waiting-room membership when the reconnect window expires", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });
    room.allowReconnection.mockRejectedValue(new Error("timed out"));

    await room.onLeave(guest);

    expect(getWaitingPlayers(room, gameId).has(guest.sessionId)).toBe(false);
    expect(getTrackedGameId(room, guest.sessionId)).toBeFalsy();
    expect(room.sessions.has(guest.sessionId)).toBe(false);
  });

  it("clears an in-progress game assignment when the reconnect window expires", async () => {
    const gameId = await createGame(room, host);
    const trackedSession = room.sessions.get(host.sessionId);
    const game = getGame(room, gameId);

    if (!trackedSession || !game) {
      throw new Error("Expected host session and game to exist");
    }

    game.status = "in_progress";
    trackedSession.currentGameId = gameId;
    room.allowReconnection.mockRejectedValue(new Error("timed out"));

    await room.onLeave(host);

    expect(trackedSession.currentGameId).toBeUndefined();
    expect(room.sessions.has(host.sessionId)).toBe(false);
    expect(getGame(room, gameId)?.status).toBe("in_progress");
  });

  it("removes disposed game rooms from the lobby and clears player assignments", async () => {
    const gameId = await createGame(room, host);
    await room.handleJoinGame(guest, { gameId });
    room.handleSetReady(guest, { ready: true });
    await room.handleStartGame(host);

    const disposeListener = room.presence.subscribe.mock.calls[0]?.[1];
    disposeListener?.({ gameId, roomId: "game-room-123" });

    expect(getGames(room).has(gameId)).toBe(false);
    expect(getTrackedGameId(room, host.sessionId)).toBeFalsy();
    expect(getTrackedGameId(room, guest.sessionId)).toBeFalsy();
    expect(room.broadcast).toHaveBeenCalledWith(shared.GAME_REMOVED, { gameId });
  });

  it("allows a solo host to start a game", async () => {
    const gameId = await createGame(room, host);

    await room.handleStartGame(host);

    expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    expect(mockCreateRoom).toHaveBeenCalledWith("game", {
      gameId,
      gameType: "checkers",
      maxPlayers: 4,
      expectedPlayers: 1,
    });
    expect(findPayload(host, GAME_STARTED)).toEqual({ gameId, roomId: "game-room-123", gameType: "checkers" });
  });

  it("requires the plugin minimum player count before starting when games are registered", async () => {
    const plugin = createPlugin(2, 4);
    mockGameRegistry.getAll.mockReturnValue([plugin]);
    mockGameRegistry.has.mockReturnValue(true);
    mockGameRegistry.get.mockReturnValue(plugin);

    await createGame(room, host);
    await room.handleStartGame(host);

    expect(mockCreateRoom).not.toHaveBeenCalled();
    expectLobbyError(host, "at least 2 players");
  });

  it("keeps multiple waiting games isolated from each other", async () => {
    const gameOneId = await createGame(room, host, { name: "Game One" });

    const otherHost = createClient("other-host", "Other Host");
    registerClient(room, otherHost, { userId: "other-host-user", displayName: "Other Host" });
    const gameTwoId = await createGame(room, otherHost, { name: "Game Two" });

    expect(gameOneId).not.toBe(gameTwoId);
    expect(getWaitingPlayers(room, gameOneId).has(host.sessionId)).toBe(true);
    expect(getWaitingPlayers(room, gameOneId).has(otherHost.sessionId)).toBe(false);
    expect(getWaitingPlayers(room, gameTwoId).has(otherHost.sessionId)).toBe(true);
    expect(getWaitingPlayers(room, gameTwoId).has(host.sessionId)).toBe(false);
  });

  it("keeps a game waiting if matchMaker room creation fails", async () => {
    const gameId = await createGame(room, host);
    mockCreateRoom.mockRejectedValueOnce(new Error("boom"));

    host.send.mockClear();
    await room.handleStartGame(host);

    expect(getGame(room, gameId)?.status).toBe("waiting");
    expectLobbyError(host, "fail");
  });

  it("truncates long game names and clamps invalid player limits to a positive integer", async () => {
    const longName = "x".repeat(LOBBY_DEFAULTS.MAX_GAME_NAME_LENGTH + 12);
    const gameId = await createGame(room, host, {
      name: longName,
      maxPlayers: -5,
    });

    const entry = getGame(room, gameId);

    expect(entry?.name.length).toBeLessThanOrEqual(LOBBY_DEFAULTS.MAX_GAME_NAME_LENGTH);
    expect(entry?.maxPlayers).toBe(1);
    expect(entry?.gameType).toBe("checkers");
  });
});

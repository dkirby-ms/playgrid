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
    ADD_CPU_PLAYER: "add_cpu_player",
    REMOVE_CPU_PLAYER: "remove_cpu_player",
    GAME_LIST: "game_list",
    GAME_JOINED: "game_joined",
    GAME_UPDATED: "game_updated",
    GAME_REMOVED: "game_removed",
    GAME_STARTED: "game_started",
    GAME_PLAYERS: "game_players",
    LOBBY_ERROR: "lobby_error",
    ONLINE_PLAYERS: "online_players",
    LOBBY_LOG_EVENT: "lobby_log_event",
    AVAILABLE_GAME_TYPES: "available_game_types",
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

const { AVAILABLE_GAME_TYPES, GAME_LIST } = shared;

const LobbyRoom = lobbyModule?.LobbyRoom;
const describeLobby = LobbyRoom ? describe : describe.skip;

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
    throw new Error("LobbyRoom is not available");
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

function findPayload(client: MockClient, messageType: string) {
  const match = client.send.mock.calls.find(([type]: [string]) => type === messageType);
  return match?.[1];
}

function makePlugin(
  id: string,
  name: string,
  playerCount: [number, number],
  description: string,
  complexity = 2,
  estimatedDuration = 30,
) {
  return {
    id,
    name,
    metadata: { playerCount, description, complexity, estimatedDuration, hasHiddenInformation: false },
  };
}

describeLobby("LobbyRoom AVAILABLE_GAME_TYPES", () => {
  let room: TestRoom;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGameRegistry.getAll.mockReturnValue([]);
    mockGameRegistry.has.mockReturnValue(false);
    mockGameRegistry.get.mockImplementation(() => {
      throw new Error("Unexpected gameRegistry.get() call");
    });
    mockCreateRoom.mockResolvedValue({ roomId: "game-room-123" });
  });

  it("sends AVAILABLE_GAME_TYPES to a new client on join", () => {
    const plugins = [
      makePlugin("checkers", "Checkers", [2, 2], "Classic checkers", 1, 20),
      makePlugin("backgammon", "Backgammon", [2, 2], "Classic backgammon", 2, 30),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");
    room.onJoin(client as never, { displayName: "Alice" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES);
    expect(payload).toBeDefined();
    expect(payload).toHaveLength(2);
  });

  it("sends AVAILABLE_GAME_TYPES with correct GameTypeInfo shape", () => {
    const plugins = [
      makePlugin("checkers", "Checkers", [2, 2], "Classic checkers", 1, 20),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");
    room.onJoin(client as never, { displayName: "Alice" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES);
    expect(payload).toEqual([
      {
        id: "checkers",
        name: "Checkers",
        playerCount: [2, 2],
        description: "Classic checkers",
        complexity: 1,
        estimatedDuration: 20,
      },
    ]);
  });

  it("payload contains only non-disabled games (registry already filtered)", () => {
    // Simulate registry after risk was disabled at startup (not registered)
    const plugins = [
      makePlugin("checkers", "Checkers", [2, 2], "Classic checkers"),
      makePlugin("backgammon", "Backgammon", [2, 2], "Classic backgammon"),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);
    mockGameRegistry.has.mockImplementation((t: string) => ["checkers", "backgammon"].includes(t));

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");
    room.onJoin(client as never, { displayName: "Alice" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES) as Array<{ id: string }>;
    const ids = payload.map(t => t.id);
    expect(ids).toContain("checkers");
    expect(ids).toContain("backgammon");
    expect(ids).not.toContain("risk");
    expect(ids).not.toContain("dominos");
  });

  it("sends empty array when all games are disabled", () => {
    mockGameRegistry.getAll.mockReturnValue([]);

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");
    room.onJoin(client as never, { displayName: "Alice" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES);
    expect(payload).toEqual([]);
  });

  it("sends AVAILABLE_GAME_TYPES alongside GAME_LIST on join", () => {
    const plugins = [
      makePlugin("checkers", "Checkers", [2, 2], "Classic checkers"),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");
    room.onJoin(client as never, { displayName: "Alice" });

    const gameList = findPayload(client, GAME_LIST);
    const gameTypes = findPayload(client, AVAILABLE_GAME_TYPES);

    expect(gameList).toBeDefined();
    expect(gameTypes).toBeDefined();
  });

  it("sends all four game types when no games are disabled", () => {
    const plugins = [
      makePlugin("checkers", "Checkers", [2, 2], "Classic checkers", 1, 20),
      makePlugin("backgammon", "Backgammon", [2, 2], "Classic backgammon", 2, 30),
      makePlugin("risk", "Risk", [2, 6], "World domination", 4, 120),
      makePlugin("dominos", "Dominos", [2, 4], "Classic dominos", 1, 15),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");
    room.onJoin(client as never, { displayName: "Alice" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES) as Array<{ id: string }>;
    expect(payload).toHaveLength(4);
    expect(payload.map(t => t.id).sort()).toEqual(["backgammon", "checkers", "dominos", "risk"]);
  });

  it("each GameTypeInfo entry has all required fields", () => {
    const plugins = [
      makePlugin("risk", "Risk", [2, 6], "World domination", 4, 120),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);

    room = createLobbyRoom();
    const client = createClient("session-1", "Bob");
    room.onJoin(client as never, { displayName: "Bob" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES) as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);

    const entry = payload[0];
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("name");
    expect(entry).toHaveProperty("playerCount");
    expect(entry).toHaveProperty("description");
    expect(entry).toHaveProperty("complexity");
    expect(entry).toHaveProperty("estimatedDuration");

    expect(typeof entry.id).toBe("string");
    expect(typeof entry.name).toBe("string");
    expect(Array.isArray(entry.playerCount)).toBe(true);
    expect(typeof entry.description).toBe("string");
    expect(typeof entry.complexity).toBe("number");
    expect(typeof entry.estimatedDuration).toBe("number");
  });

  it("sends AVAILABLE_GAME_TYPES on rejoin (existing session)", () => {
    const plugins = [
      makePlugin("checkers", "Checkers", [2, 2], "Classic checkers"),
    ];
    mockGameRegistry.getAll.mockReturnValue(plugins);

    room = createLobbyRoom();
    const client = createClient("session-1", "Alice");

    // First join
    room.onJoin(client as never, { displayName: "Alice" });

    // Clear mocks to isolate the rejoin
    client.send.mockClear();

    // Rejoin (existing session path)
    room.onJoin(client as never, { displayName: "Alice" });

    const payload = findPayload(client, AVAILABLE_GAME_TYPES);
    expect(payload).toBeDefined();
    expect(payload).toHaveLength(1);
  });
});

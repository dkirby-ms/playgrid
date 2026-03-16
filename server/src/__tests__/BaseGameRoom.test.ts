import { BaseGameState, type GamePlugin } from "../../../shared/src/index.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockedCloseCode, mockGameRegistry } = vi.hoisted(() => ({
  mockedCloseCode: {
    NORMAL_CLOSURE: 1000,
    CONSENTED: 4000,
  },
  mockGameRegistry: {
    get: vi.fn(),
  },
}));

vi.mock("colyseus", () => ({
  Room: class {},
  CloseCode: mockedCloseCode,
}));

vi.mock("../game/GameRegistry", () => ({ gameRegistry: mockGameRegistry }));
vi.mock("@eschaton/shared", async () => await import("../../../shared/src/index.ts"));

const roomModule = await import("../game/BaseGameRoom")
  .catch(() => import("../game/BaseGameRoom.ts"))
  .catch(() => import("../game/BaseGameRoom.js"))
  .catch(() => null);

const BaseGameRoom = roomModule?.BaseGameRoom;
const describeRoom = BaseGameRoom ? describe : describe.skip;

type MockClient = {
  sessionId: string;
  send: ReturnType<typeof vi.fn>;
};

type TestRoom = Record<string, any> & {
  messageHandlers: Map<string, (client: MockClient, payload: unknown) => unknown>;
};

class TestState extends BaseGameState {}

function createClient(sessionId: string): MockClient {
  return {
    sessionId,
    send: vi.fn(),
  };
}

function createPlugin(overrides: Partial<GamePlugin<TestState>> = {}): GamePlugin<TestState> {
  const stateFactory = overrides.createState ?? (() => new TestState());
  const lifecycle = {
    onCreate: vi.fn(),
    onPlayerJoin: vi.fn(),
    onGameStart: vi.fn(),
    onPlayerLeave: vi.fn(),
    onPlayerReconnect: vi.fn(),
    onGameEnd: vi.fn(),
    onTick: undefined,
    ...overrides.lifecycle,
  };
  const validateAction = vi.fn().mockReturnValue(true);
  const checkGameEnd = vi.fn().mockReturnValue(null);
  const actions = {
    move: vi.fn().mockReturnValue({ success: true, endsTurn: true }),
    ...overrides.actions,
  };

  return {
    id: "checkers",
    name: "Checkers",
    metadata: {
      playerCount: [2, 4],
      estimatedDuration: 20,
      complexity: 2,
      description: "Test plugin",
      hasHiddenInformation: false,
      ...overrides.metadata,
    },
    createState: stateFactory,
    lifecycle,
    turnConfig: {
      mode: "sequential",
      turnOrder: { type: "round-robin" },
      allowPass: false,
      ...overrides.turnConfig,
    },
    actions,
    conditions: {
      validateAction,
      checkGameEnd,
      ...overrides.conditions,
    },
  };
}

function createRoom(): TestRoom {
  if (!BaseGameRoom) {
    throw new Error("BaseGameRoom is not available in the template yet");
  }

  const messageHandlers = new Map<string, (client: MockClient, payload: unknown) => unknown>();

  return Object.assign(new BaseGameRoom(), {
    roomId: "test-room",
    clients: [] as MockClient[],
    maxClients: 1,
    messageHandlers,
    allowReconnection: vi.fn(),
    broadcast: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    presence: { publish: vi.fn() },
    onMessage: vi.fn((type: string, handler: (client: MockClient, payload: unknown) => unknown) => {
      messageHandlers.set(type, handler);
    }),
    setSimulationInterval: vi.fn(),
    setState: vi.fn(function setState(state: TestState) {
      this.state = state;
    }),
  });
}

describeRoom("BaseGameRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates plugin state, applies maxClients, and registers action handlers", () => {
    const room = createRoom();
    const state = new TestState();
    const plugin = createPlugin({
      createState: () => state,
      lifecycle: {
        onCreate: vi.fn(),
        onPlayerJoin: vi.fn(),
        onGameStart: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);

    room.onCreate({ gameType: "checkers", maxPlayers: 3 });

    expect(mockGameRegistry.get).toHaveBeenCalledWith("checkers");
    expect(room.state).toBe(state);
    expect(room.maxClients).toBe(103); // maxPlayers (3) + spectator slots (100)
    expect(plugin.lifecycle.onCreate).toHaveBeenCalledWith(
      state,
      expect.objectContaining({ gameType: "checkers", maxPlayers: 3 }),
    );
    expect(room.onMessage).toHaveBeenCalledWith("move", expect.any(Function));
  });

  it("adds players and starts the game once the expected player count joins", () => {
    const room = createRoom();
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onPlayerJoin: vi.fn(),
        onGameStart: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", maxPlayers: 4, expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");

    room.clients.push(firstPlayer, secondPlayer);
    room.onJoin(firstPlayer, { displayName: "Alice" });

    expect(room.state.phase).toBe("waiting");
    expect(room.state.players.get(firstPlayer.sessionId)).toMatchObject({
      displayName: "Alice",
      playerIndex: 0,
      isConnected: true,
    });

    room.onJoin(secondPlayer, { displayName: "Bob" });

    expect(plugin.lifecycle.onPlayerJoin).toHaveBeenNthCalledWith(1, room.state, firstPlayer, 0);
    expect(plugin.lifecycle.onPlayerJoin).toHaveBeenNthCalledWith(2, room.state, secondPlayer, 1);
    expect(plugin.lifecycle.onGameStart).toHaveBeenCalledWith(room.state);
    expect(room.state.phase).toBe("playing");
    expect(room.state.currentTurn).toBe("player-1");
    expect(room.state.turnNumber).toBe(1);
    expect(room.turnManager).toBeTruthy();
  });

  it("registers a synthetic CPU opponent and starts once the human player joins", () => {
    const room = createRoom();
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onPlayerJoin: vi.fn(),
        onGameStart: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2, cpuOpponent: true });

    const humanPlayer = createClient("player-1");
    room.clients.push(humanPlayer);
    room.onJoin(humanPlayer, { displayName: "Alice" });

    expect(plugin.lifecycle.onPlayerJoin).toHaveBeenNthCalledWith(1, room.state, humanPlayer, 0);
    expect(plugin.lifecycle.onPlayerJoin).toHaveBeenNthCalledWith(
      2,
      room.state,
      expect.objectContaining({ sessionId: "cpu-opponent" }),
      1,
    );
    expect(room.state.players.get("cpu-opponent")).toMatchObject({
      displayName: "CPU Opponent",
      playerIndex: 1,
      isConnected: true,
    });
    expect(plugin.lifecycle.onGameStart).toHaveBeenCalledWith(room.state);
    expect(room.state.phase).toBe("playing");
    expect(room.state.currentTurn).toBe("player-1");
    expect(room.turnManager).toBeTruthy();
  });

  it("validates actions and advances the turn for successful end-of-turn actions", async () => {
    const room = createRoom();
    const moveHandler = vi.fn().mockReturnValue({ success: true, endsTurn: true });
    const validateAction = vi.fn().mockReturnValue(true);
    const checkGameEnd = vi.fn().mockReturnValue(null);
    const plugin = createPlugin({
      actions: { move: moveHandler },
      conditions: { validateAction, checkGameEnd },
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    await room.messageHandlers.get("move")?.(firstPlayer, { from: 1, to: 2 });

    expect(validateAction).toHaveBeenCalledWith(room.state, firstPlayer, "move", { from: 1, to: 2 });
    expect(moveHandler).toHaveBeenCalledWith(room.state, firstPlayer, { from: 1, to: 2 });
    expect(room.state.currentTurn).toBe("player-2");
    expect(room.state.turnNumber).toBe(2);
  });

  it("ends the game when an action reports endsGame", async () => {
    const room = createRoom();
    const gameResult = {
      type: "win",
      winnerId: "player-1",
      scores: { "player-1": 1 },
    };
    const plugin = createPlugin({
      actions: {
        move: vi.fn().mockReturnValue({ success: true, endsGame: true }),
      },
      conditions: {
        validateAction: vi.fn().mockReturnValue(true),
        checkGameEnd: vi.fn().mockReturnValue(gameResult),
      },
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
        onGameEnd: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    await room.messageHandlers.get("move")?.(firstPlayer, { from: 1, to: 2 });

    expect(plugin.lifecycle.onGameEnd).toHaveBeenCalledWith(room.state, gameResult);
    expect(room.state.phase).toBe("ended");
    expect(room.broadcast).toHaveBeenCalledWith("game-end", gameResult);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });

  it("marks a departed waiting player disconnected without ending the room", async () => {
    const room = createRoom();
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onPlayerJoin: vi.fn(),
        onPlayerLeave: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    room.onJoin(firstPlayer);

    await expect(room.onLeave(firstPlayer, mockedCloseCode.NORMAL_CLOSURE)).resolves.toBeUndefined();

    expect(room.state.players.get(firstPlayer.sessionId)).toMatchObject({ isConnected: false });
    expect(plugin.lifecycle.onPlayerLeave).toHaveBeenCalledWith(room.state, firstPlayer.sessionId);
    expect(room.disconnect).not.toHaveBeenCalled();
    expect(room.state.phase).toBe("waiting");
  });

  it("holds a playing seat for 30 seconds on an unexpected disconnect", async () => {
    const room = createRoom();
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
        onPlayerLeave: vi.fn(),
        onGameEnd: vi.fn(),
      },
    });

    room.allowReconnection.mockResolvedValue(undefined);
    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    await room.onLeave(secondPlayer, mockedCloseCode.NORMAL_CLOSURE);

    expect(room.allowReconnection).toHaveBeenCalledWith(secondPlayer, 30);
    expect(room.state.players.get(secondPlayer.sessionId)).toMatchObject({ isConnected: true });
    expect(plugin.lifecycle.onPlayerLeave).not.toHaveBeenCalled();
    expect(plugin.lifecycle.onGameEnd).not.toHaveBeenCalled();
    expect(room.disconnect).not.toHaveBeenCalled();
    expect(room.state.phase).toBe("playing");
  });

  it("does not hold a seat for a consented disconnect and forfeits immediately when one player remains", async () => {
    const room = createRoom();
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
        onPlayerLeave: vi.fn(),
        onGameEnd: vi.fn(),
      },
    });

    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    await room.onLeave(secondPlayer, mockedCloseCode.CONSENTED);

    expect(room.allowReconnection).not.toHaveBeenCalled();
    expect(room.state.players.get(secondPlayer.sessionId)).toMatchObject({ isConnected: false });
    expect(plugin.lifecycle.onPlayerLeave).toHaveBeenCalledWith(room.state, secondPlayer.sessionId);
    expect(plugin.lifecycle.onGameEnd).toHaveBeenCalledWith(
      room.state,
      expect.objectContaining({
        type: "forfeit",
        winnerId: firstPlayer.sessionId,
        metadata: expect.objectContaining({
          consented: true,
          disconnectedPlayerId: secondPlayer.sessionId,
        }),
      }),
    );
    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });

  it("releases the reserved seat after the reconnection window expires", async () => {
    const room = createRoom();
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
        onPlayerLeave: vi.fn(),
        onGameEnd: vi.fn(),
      },
    });

    room.allowReconnection.mockRejectedValue(new Error("timed out"));
    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    await room.onLeave(secondPlayer, mockedCloseCode.NORMAL_CLOSURE);

    expect(room.allowReconnection).toHaveBeenCalledWith(secondPlayer, 30);
    expect(plugin.lifecycle.onGameEnd).toHaveBeenCalledWith(
      room.state,
      expect.objectContaining({
        type: "forfeit",
        winnerId: firstPlayer.sessionId,
        metadata: expect.objectContaining({
          reconnectionTimeout: true,
          disconnectedPlayerId: secondPlayer.sessionId,
        }),
      }),
    );
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(room.state.phase).toBe("ended");
  });

  it("calls the plugin onPlayerReconnect hook when a reserved player rejoins", async () => {
    const room = createRoom();
    let resolveReconnection!: () => void;
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
        onPlayerReconnect: vi.fn(),
      },
    });

    room.allowReconnection.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveReconnection = resolve;
      }),
    );
    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    const leavePromise = room.onLeave(firstPlayer, mockedCloseCode.NORMAL_CLOSURE);
    expect(room.state.players.get(firstPlayer.sessionId)).toMatchObject({ isConnected: false });

    room.onJoin(firstPlayer);
    resolveReconnection();
    await leavePromise;

    expect(plugin.lifecycle.onPlayerReconnect).toHaveBeenCalledWith(room.state, firstPlayer);
    expect(plugin.lifecycle.onPlayerJoin).toHaveBeenCalledTimes(2);
    expect(room.state.players.get(firstPlayer.sessionId)).toMatchObject({ isConnected: true });
  });

  it("pauses the turn timer while a seat is reserved and resumes it after reconnect", async () => {
    vi.useFakeTimers();

    const room = createRoom();
    let resolveReconnection!: () => void;
    const plugin = createPlugin({
      lifecycle: {
        onCreate: vi.fn(),
        onGameStart: vi.fn(),
        onGameEnd: vi.fn(),
      },
      turnConfig: {
        mode: "sequential",
        turnOrder: { type: "round-robin" },
        allowPass: false,
        turnTimeLimit: 5,
      },
    });

    room.allowReconnection.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveReconnection = resolve;
      }),
    );
    mockGameRegistry.get.mockReturnValue(plugin);
    room.onCreate({ gameType: "checkers", expectedPlayers: 2 });

    const firstPlayer = createClient("player-1");
    const secondPlayer = createClient("player-2");
    room.onJoin(firstPlayer);
    room.onJoin(secondPlayer);

    await vi.advanceTimersByTimeAsync(2_000);
    const leavePromise = room.onLeave(firstPlayer, mockedCloseCode.NORMAL_CLOSURE);
    expect(room.turnManager.isPaused()).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(plugin.lifecycle.onGameEnd).not.toHaveBeenCalled();

    room.onJoin(firstPlayer);
    expect(room.turnManager.isPaused()).toBe(false);

    resolveReconnection();
    await leavePromise;

    await vi.advanceTimersByTimeAsync(2_999);
    expect(plugin.lifecycle.onGameEnd).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(plugin.lifecycle.onGameEnd).toHaveBeenCalledWith(
      room.state,
      expect.objectContaining({
        type: "timeout",
        winnerId: secondPlayer.sessionId,
        metadata: expect.objectContaining({
          timedOutPlayerId: firstPlayer.sessionId,
        }),
      }),
    );
  });
  it.todo("resolves simultaneous disconnects during the reconnect window without awarding a premature forfeit");
});

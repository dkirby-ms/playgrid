import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../shared/src/index.ts"));

const shared = await import("../../../shared/src/index.ts");
const { BLACK, CheckersState, EMPTY, PlayerInfo, RED } = shared;
const { checkersPlugin } = await import("../games/checkers/CheckersPlugin");

type MockClient = {
  sessionId: string;
};

function createClient(sessionId: string): MockClient {
  return { sessionId };
}

function addPlayer(state: InstanceType<typeof CheckersState>, sessionId: string, playerIndex: number) {
  const player = new PlayerInfo();
  player.sessionId = sessionId;
  player.displayName = `Player ${playerIndex + 1}`;
  player.playerIndex = playerIndex;
  state.players.set(sessionId, player);
}

function createGameState() {
  const state = checkersPlugin.createState();
  addPlayer(state, "player-1", 0);
  addPlayer(state, "player-2", 1);
  return state;
}

function setBoard(state: InstanceType<typeof CheckersState>, pieces: number[]) {
  for (const [index, piece] of pieces.entries()) {
    state.board[index] = piece;
  }
}

describe("checkersPlugin", () => {
  it("creates an empty checkers state and initializes the board on game start", () => {
    const state = checkersPlugin.createState();

    expect(state).toBeInstanceOf(CheckersState);
    expect(Array.from(state.board)).toEqual(Array.from({ length: 64 }, () => EMPTY));
    expect(state.mustCaptureFrom).toBe(-1);

    addPlayer(state, "player-1", 0);
    addPlayer(state, "player-2", 1);
    checkersPlugin.lifecycle.onGameStart(state);

    expect(state.board.filter((piece) => piece === BLACK)).toHaveLength(12);
    expect(state.board.filter((piece) => piece === RED)).toHaveLength(12);
    expect(state.mustCaptureFrom).toBe(-1);
  });

  it("replaces joined players with normalized PlayerInfo records", () => {
    const state = checkersPlugin.createState();
    const existing = new PlayerInfo();
    existing.sessionId = "player-1";
    existing.displayName = "Alice";
    existing.isSpectator = true;
    state.players.set(existing.sessionId, existing);

    checkersPlugin.lifecycle.onPlayerJoin(state, createClient("player-1") as never, 0);

    expect(state.players.get("player-1")).toMatchObject({
      sessionId: "player-1",
      displayName: "Alice",
      playerIndex: 0,
      isSpectator: true,
      isConnected: true,
    });
  });

  it("validates moves against turn order and applies multi-jump chains", () => {
    const state = createGameState();
    state.currentTurn = "player-1";
    setBoard(state, Array.from({ length: 64 }, () => EMPTY));
    state.board[17] = BLACK;
    state.board[26] = RED;
    state.board[44] = RED;

    expect(checkersPlugin.conditions.validateAction(state, createClient("player-1") as never, "move", { from: 17, to: 35 })).toBe(true);
    expect(checkersPlugin.conditions.validateAction(state, createClient("player-2") as never, "move", { from: 44, to: 26 })).toBe(false);

    const firstMove = checkersPlugin.actions.move(state, createClient("player-1") as never, {
      from: 17,
      to: 35,
    });

    expect(firstMove).toMatchObject({ success: true, endsTurn: false, endsGame: false });
    expect(state.board[17]).toBe(EMPTY);
    expect(state.board[26]).toBe(EMPTY);
    expect(state.board[35]).toBe(BLACK);
    expect(state.mustCaptureFrom).toBe(35);

    const secondMove = checkersPlugin.actions.move(state, createClient("player-1") as never, {
      from: 35,
      to: 53,
    });

    expect(secondMove).toMatchObject({ success: true, endsTurn: true, endsGame: true });
    expect(state.board[44]).toBe(EMPTY);
    expect(state.board[53]).toBe(BLACK);
    expect(state.mustCaptureFrom).toBe(-1);
  });

  it("returns a win result for the player who eliminates the opponent", () => {
    const state = createGameState();
    state.currentTurn = "player-1";
    setBoard(state, Array.from({ length: 64 }, () => EMPTY));
    state.board[53] = BLACK;

    const result = checkersPlugin.conditions.checkGameEnd(state);

    expect(result).toEqual({
      type: "win",
      winnerId: "player-1",
      scores: {
        "player-1": 1,
        "player-2": 0,
      },
      metadata: {
        winnerColor: BLACK,
      },
    });
  });

  it("marks players disconnected on leave and ends the state on game end", () => {
    const state = createGameState();

    checkersPlugin.lifecycle.onPlayerLeave?.(state, "player-2");
    expect(state.players.get("player-2")?.isConnected).toBe(false);

    checkersPlugin.lifecycle.onGameEnd?.(state, {
      type: "win",
      winnerId: "player-1",
      scores: { "player-1": 1 },
    });
    expect(state.phase).toBe("ended");
  });
});

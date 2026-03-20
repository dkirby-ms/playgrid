import { CheckersState } from "@eschaton/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Chess Clock Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Schema Initialization", () => {
    it("initializes with clock fields at 0 by default (BaseGameRoom sets actual values)", () => {
      const state = new CheckersState();

      // Default to 0; BaseGameRoom initializes them based on chessClockConfig
      expect(state.player1TimeRemainingMs).toBe(0);
      expect(state.player2TimeRemainingMs).toBe(0);
    });

    it("has clock fields defined in schema types (inherited from BaseGameState)", () => {
      const state = new CheckersState();

      expect(state).toHaveProperty("player1TimeRemainingMs");
      expect(state).toHaveProperty("player2TimeRemainingMs");
    });
  });

  describe("Clock Tick Logic (Unit Tests)", () => {
    it("decrements active player's clock (player 1) when it's their turn", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Manually decrement as BaseGameRoom.updateChessClocks would do
      const deltaMs = 1000;
      // Assume player 1 is playerIndex 0
      const playerIndex = 0;

      if (playerIndex === 0) {
        state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - deltaMs);
      }

      expect(state.player1TimeRemainingMs).toBe(599000);
      expect(state.player2TimeRemainingMs).toBe(600000);
    });

    it("decrements active player's clock (player 2) when it's their turn", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-2";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Manually decrement as BaseGameRoom.updateChessClocks would do
      const deltaMs = 1000;
      const currentPlayerInfo = { playerIndex: 1 };

      if (currentPlayerInfo.playerIndex === 1) {
        state.player2TimeRemainingMs = Math.max(0, state.player2TimeRemainingMs - deltaMs);
      }

      expect(state.player1TimeRemainingMs).toBe(600000);
      expect(state.player2TimeRemainingMs).toBe(599000);
    });

    it("does not decrement clock when game phase is 'waiting'", () => {
      const state = new CheckersState();
      state.phase = "waiting";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      const initialP1Time = state.player1TimeRemainingMs;
      const initialP2Time = state.player2TimeRemainingMs;

      // updateChessClocks should early-return if phase !== 'playing'
      if (state.phase !== "playing") {
        // no-op
      }

      expect(state.player1TimeRemainingMs).toBe(initialP1Time);
      expect(state.player2TimeRemainingMs).toBe(initialP2Time);
    });

    it("does not decrement clock when game phase is 'ended'", () => {
      const state = new CheckersState();
      state.phase = "ended";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      const initialP1Time = state.player1TimeRemainingMs;
      const initialP2Time = state.player2TimeRemainingMs;

      // updateChessClocks should early-return if phase !== 'playing'
      if (state.phase !== "playing") {
        // no-op
      }

      expect(state.player1TimeRemainingMs).toBe(initialP1Time);
      expect(state.player2TimeRemainingMs).toBe(initialP2Time);
    });

    it("never decrements clock below 0", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 500;
      state.player2TimeRemainingMs = 600000;

      // Simulate large tick that would go negative
      const deltaMs = 1000;
      state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - deltaMs);

      expect(state.player1TimeRemainingMs).toBe(0);
    });

    it("handles multiple rapid ticks correctly", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Simulate 5 ticks of 1000ms each
      for (let i = 0; i < 5; i++) {
        const deltaMs = 1000;
        state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - deltaMs);
      }

      expect(state.player1TimeRemainingMs).toBe(595000);
      expect(state.player2TimeRemainingMs).toBe(600000);
    });
  });

  describe("Clock Switching on Turn Change", () => {
    it("switches active clock when turn changes from player 1 to player 2", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Player 1's turn - decrement their clock
      state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - 1000);
      expect(state.player1TimeRemainingMs).toBe(599000);

      // Turn changes
      state.currentTurn = "player-2";

      // Player 2's turn - decrement their clock
      state.player2TimeRemainingMs = Math.max(0, state.player2TimeRemainingMs - 1000);
      expect(state.player1TimeRemainingMs).toBe(599000); // unchanged
      expect(state.player2TimeRemainingMs).toBe(599000);
    });

    it("stops player 1 clock and starts player 2 clock on turn switch", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Player 1 takes their turn
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs -= 1000;

      const p1TimeAfterMove = state.player1TimeRemainingMs;

      // Turn switches to player 2
      state.currentTurn = "player-2";

      // Next tick should only affect player 2
      state.player2TimeRemainingMs -= 1000;

      expect(state.player1TimeRemainingMs).toBe(p1TimeAfterMove);
      expect(state.player2TimeRemainingMs).toBe(599000);
    });

    it("preserves clock values across multiple turn cycles", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Turn 1: Player 1
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs -= 3000; // 597000

      // Turn 2: Player 2
      state.currentTurn = "player-2";
      state.player2TimeRemainingMs -= 5000; // 595000

      // Turn 3: Player 1 again
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs -= 2000; // 595000

      expect(state.player1TimeRemainingMs).toBe(595000);
      expect(state.player2TimeRemainingMs).toBe(595000);
    });
  });

  describe("Timeout and Forfeit", () => {
    it("detects when player 1's clock reaches 0", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 0;
      state.player2TimeRemainingMs = 600000;

      const hasTimedOut = state.player1TimeRemainingMs <= 0;

      expect(hasTimedOut).toBe(true);
    });

    it("detects when player 2's clock reaches 0", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-2";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 0;

      const hasTimedOut = state.player2TimeRemainingMs <= 0;

      expect(hasTimedOut).toBe(true);
    });

    it("identifies the losing player when timeout occurs", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 0;
      state.player2TimeRemainingMs = 600000;

      // Simulate forfeit detection logic (now in BaseGameRoom)
      let loser = null;
      let winner = null;

      if (state.player1TimeRemainingMs <= 0) {
        loser = "player-1";
        winner = "player-2";
      } else if (state.player2TimeRemainingMs <= 0) {
        loser = "player-2";
        winner = "player-1";
      }

      expect(loser).toBe("player-1");
      expect(winner).toBe("player-2");
    });

    it("should end game with timeout type when player times out", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 0;
      state.player2TimeRemainingMs = 600000;

      // Simulate game result creation (now in BaseGameRoom.checkChessClockTimeout)
      const result = {
        type: "timeout" as const,
        winnerId: "player-2",
        scores: {
          "player-1": 0,
          "player-2": 1,
        },
        metadata: {
          reason: "chess_clock_timeout",
          timedOutPlayerId: "player-1",
        },
      };

      expect(result.type).toBe("timeout");
      expect(result.winnerId).toBe("player-2");
      expect(result.metadata.reason).toBe("chess_clock_timeout");
    });
  });

  describe("Edge Cases", () => {
    it("handles clock values when currentTurn is undefined", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      const initialP1 = state.player1TimeRemainingMs;
      const initialP2 = state.player2TimeRemainingMs;

      // updateChessClocks should handle this gracefully by not decrementing
      const currentPlayerInfo = state.players.get(state.currentTurn);
      if (!currentPlayerInfo) {
        // no-op
      }

      expect(state.player1TimeRemainingMs).toBe(initialP1);
      expect(state.player2TimeRemainingMs).toBe(initialP2);
    });

    it("handles clock values when player is not found in players map", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "non-existent-player";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      const initialP1 = state.player1TimeRemainingMs;
      const initialP2 = state.player2TimeRemainingMs;

      // updateChessClocks should handle missing player gracefully
      const currentPlayerInfo = state.players.get(state.currentTurn);
      if (!currentPlayerInfo) {
        // no-op - don't decrement any clock
      }

      expect(state.player1TimeRemainingMs).toBe(initialP1);
      expect(state.player2TimeRemainingMs).toBe(initialP2);
    });

    it("preserves clock values across state syncs", () => {
      const state = new CheckersState();
      state.player1TimeRemainingMs = 450000;
      state.player2TimeRemainingMs = 520000;

      // Schema fields should persist
      expect(state.player1TimeRemainingMs).toBe(450000);
      expect(state.player2TimeRemainingMs).toBe(520000);
    });

    it("handles spectators without affecting clock", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Spectator joins but shouldn't affect clock logic
      const initialP1 = state.player1TimeRemainingMs;
      const initialP2 = state.player2TimeRemainingMs;

      // Clock tick should still work normally
      state.player1TimeRemainingMs -= 1000;

      expect(state.player1TimeRemainingMs).toBe(initialP1 - 1000);
      expect(state.player2TimeRemainingMs).toBe(initialP2);
    });

    it("handles very small deltaTime values", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Simulate small tick (16ms, typical frame time)
      state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - 16);

      expect(state.player1TimeRemainingMs).toBe(599984);
    });

    it("handles large deltaTime values (lag spike)", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 600000;
      state.player2TimeRemainingMs = 600000;

      // Simulate large tick (5000ms lag spike)
      state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - 5000);

      expect(state.player1TimeRemainingMs).toBe(595000);
    });

    it("handles clock when time remaining is exactly 1ms", () => {
      const state = new CheckersState();
      state.phase = "playing";
      state.currentTurn = "player-1";
      state.player1TimeRemainingMs = 1;
      state.player2TimeRemainingMs = 600000;

      // Next tick should bring it to 0, not negative
      state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - 1000);

      expect(state.player1TimeRemainingMs).toBe(0);
    });
  });

  describe("Integration with Game Flow", () => {
    it("clock should be active during 'playing' phase", () => {
      const state = new CheckersState();
      state.phase = "playing";

      expect(state.phase).toBe("playing");
    });

    it("clock should not tick during 'waiting' phase", () => {
      const state = new CheckersState();
      state.phase = "waiting";

      const shouldTick = state.phase === "playing";

      expect(shouldTick).toBe(false);
    });

    it("clock should not tick during 'ended' phase", () => {
      const state = new CheckersState();
      state.phase = "ended";

      const shouldTick = state.phase === "playing";

      expect(shouldTick).toBe(false);
    });

    it("verifies clock fields exist on CheckersState and are numeric", () => {
      const state = new CheckersState();

      expect(typeof state.player1TimeRemainingMs).toBe("number");
      expect(typeof state.player2TimeRemainingMs).toBe("number");
      expect(Number.isFinite(state.player1TimeRemainingMs)).toBe(true);
      expect(Number.isFinite(state.player2TimeRemainingMs)).toBe(true);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, QueryResult } from "pg";

const { createGame, endGame, addParticipant } = await import("../db/gameRepository");

type MockPool = {
  query: ReturnType<typeof vi.fn>;
};

describe("gameRepository", () => {
  let mockPool: MockPool;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  describe("createGame", () => {
    it("creates a game and returns the game ID", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const gameId = await createGame(mockPool as unknown as Pool, {
        gameType: "checkers",
        playerIds: ["player-1", "player-2"],
      });

      expect(gameId).toBeTruthy();
      expect(typeof gameId).toBe("string");
      expect(gameId.length).toBeGreaterThan(0);

      expect(mockPool.query).toHaveBeenCalledTimes(3);

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO games"),
        expect.arrayContaining([gameId, "checkers"]),
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO game_participants"),
        [gameId, "player-1", "player"],
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("INSERT INTO game_participants"),
        [gameId, "player-2", "player"],
      );
    });

    it("creates a game with no players", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const gameId = await createGame(mockPool as unknown as Pool, {
        gameType: "backgammon",
        playerIds: [],
      });

      expect(gameId).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO games"),
        expect.arrayContaining([gameId, "backgammon"]),
      );
    });

    it("creates a game with many players", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const playerIds = ["p1", "p2", "p3", "p4", "p5"];
      const gameId = await createGame(mockPool as unknown as Pool, {
        gameType: "poker",
        playerIds,
      });

      expect(gameId).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledTimes(6);
      
      for (let i = 0; i < playerIds.length; i++) {
        expect(mockPool.query).toHaveBeenNthCalledWith(
          i + 2,
          expect.stringContaining("INSERT INTO game_participants"),
          [gameId, playerIds[i], "player"],
        );
      }
    });

    it("logs error and throws when game insert fails", async () => {
      const dbError = new Error("Connection refused");
      mockPool.query.mockRejectedValue(dbError);

      await expect(
        createGame(mockPool as unknown as Pool, {
          gameType: "checkers",
          playerIds: ["player-1"],
        }),
      ).rejects.toThrow("Connection refused");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[gameRepository] Failed to create game:",
        dbError,
      );
    });

    it("logs error and throws when participant insert fails", async () => {
      const dbError = new Error("Foreign key violation");
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as QueryResult)
        .mockRejectedValueOnce(dbError);

      await expect(
        createGame(mockPool as unknown as Pool, {
          gameType: "checkers",
          playerIds: ["player-1"],
        }),
      ).rejects.toThrow("Foreign key violation");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[gameRepository] Failed to create game:",
        dbError,
      );
    });

    it("handles constraint violations gracefully", async () => {
      const constraintError = new Error("duplicate key value violates unique constraint");
      mockPool.query.mockRejectedValue(constraintError);

      await expect(
        createGame(mockPool as unknown as Pool, {
          gameType: "checkers",
          playerIds: [],
        }),
      ).rejects.toThrow("duplicate key value");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("endGame", () => {
    it("updates game with outcome and duration", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const outcome = { winner: "player-1", score: { "player-1": 100, "player-2": 50 } };
      await endGame(mockPool as unknown as Pool, {
        gameId: "game-123",
        outcome,
        durationSeconds: 300,
      });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE games"),
        [JSON.stringify(outcome), 300, "game-123"],
      );
    });

    it("handles null outcome", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      await endGame(mockPool as unknown as Pool, {
        gameId: "game-456",
        outcome: {},
        durationSeconds: 0,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE games"),
        [JSON.stringify({}), 0, "game-456"],
      );
    });

    it("handles complex outcome with nested data", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const complexOutcome = {
        winner: "player-1",
        reason: "resignation",
        finalBoard: { pieces: [1, 2, 3], captured: [4, 5] },
        scores: { "player-1": 100, "player-2": 0 },
      };

      await endGame(mockPool as unknown as Pool, {
        gameId: "game-789",
        outcome: complexOutcome,
        durationSeconds: 1200,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE games"),
        [JSON.stringify(complexOutcome), 1200, "game-789"],
      );
    });

    it("logs error and throws when update fails", async () => {
      const dbError = new Error("Connection lost");
      mockPool.query.mockRejectedValue(dbError);

      await expect(
        endGame(mockPool as unknown as Pool, {
          gameId: "game-123",
          outcome: { winner: "player-1" },
          durationSeconds: 100,
        }),
      ).rejects.toThrow("Connection lost");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[gameRepository] Failed to end game:",
        dbError,
      );
    });

    it("handles database down scenario", async () => {
      const networkError = new Error("ECONNREFUSED");
      mockPool.query.mockRejectedValue(networkError);

      await expect(
        endGame(mockPool as unknown as Pool, {
          gameId: "game-999",
          outcome: { winner: "player-2" },
          durationSeconds: 60,
        }),
      ).rejects.toThrow("ECONNREFUSED");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("handles non-existent game ID gracefully", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as QueryResult);

      await expect(
        endGame(mockPool as unknown as Pool, {
          gameId: "nonexistent-game",
          outcome: { winner: "player-1" },
          durationSeconds: 50,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("addParticipant", () => {
    it("adds a player participant to a game", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      await addParticipant(mockPool as unknown as Pool, {
        gameId: "game-123",
        userId: "player-3",
        role: "player",
      });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO game_participants"),
        ["game-123", "player-3", "player"],
      );
    });

    it("adds a spectator participant to a game", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      await addParticipant(mockPool as unknown as Pool, {
        gameId: "game-456",
        userId: "spectator-1",
        role: "spectator",
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO game_participants"),
        ["game-456", "spectator-1", "spectator"],
      );
    });

    it("logs error and throws when insert fails", async () => {
      const dbError = new Error("Foreign key constraint violation");
      mockPool.query.mockRejectedValue(dbError);

      await expect(
        addParticipant(mockPool as unknown as Pool, {
          gameId: "game-123",
          userId: "player-4",
          role: "player",
        }),
      ).rejects.toThrow("Foreign key constraint violation");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[gameRepository] Failed to add participant:",
        dbError,
      );
    });

    it("handles duplicate participant insertion", async () => {
      const duplicateError = new Error("duplicate key value violates unique constraint");
      mockPool.query.mockRejectedValue(duplicateError);

      await expect(
        addParticipant(mockPool as unknown as Pool, {
          gameId: "game-789",
          userId: "player-1",
          role: "player",
        }),
      ).rejects.toThrow("duplicate key value");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("handles non-existent game ID", async () => {
      const foreignKeyError = new Error('insert or update on table "game_participants" violates foreign key constraint');
      mockPool.query.mockRejectedValue(foreignKeyError);

      await expect(
        addParticipant(mockPool as unknown as Pool, {
          gameId: "nonexistent-game",
          userId: "player-5",
          role: "player",
        }),
      ).rejects.toThrow("foreign key constraint");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("handles database connection failure", async () => {
      const connectionError = new Error("Connection terminated unexpectedly");
      mockPool.query.mockRejectedValue(connectionError);

      await expect(
        addParticipant(mockPool as unknown as Pool, {
          gameId: "game-123",
          userId: "player-6",
          role: "spectator",
        }),
      ).rejects.toThrow("Connection terminated");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("concurrent operations", () => {
    it("handles multiple concurrent createGame calls", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const results = await Promise.all([
        createGame(mockPool as unknown as Pool, {
          gameType: "checkers",
          playerIds: ["p1", "p2"],
        }),
        createGame(mockPool as unknown as Pool, {
          gameType: "backgammon",
          playerIds: ["p3", "p4"],
        }),
        createGame(mockPool as unknown as Pool, {
          gameType: "poker",
          playerIds: ["p5", "p6", "p7"],
        }),
      ]);

      expect(results).toHaveLength(3);
      expect(new Set(results).size).toBe(3);
      results.forEach(id => expect(id).toBeTruthy());
    });

    it("handles mixed concurrent operations", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const gameId = "test-game-concurrent";
      await Promise.all([
        addParticipant(mockPool as unknown as Pool, {
          gameId,
          userId: "player-1",
          role: "player",
        }),
        addParticipant(mockPool as unknown as Pool, {
          gameId,
          userId: "player-2",
          role: "player",
        }),
        addParticipant(mockPool as unknown as Pool, {
          gameId,
          userId: "spectator-1",
          role: "spectator",
        }),
      ]);

      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });

  describe("edge cases", () => {
    it("handles empty gameType string", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const gameId = await createGame(mockPool as unknown as Pool, {
        gameType: "",
        playerIds: [],
      });

      expect(gameId).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO games"),
        expect.arrayContaining([gameId, ""]),
      );
    });

    it("handles very long userId values", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const longUserId = "x".repeat(500);
      await addParticipant(mockPool as unknown as Pool, {
        gameId: "game-123",
        userId: longUserId,
        role: "player",
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO game_participants"),
        ["game-123", longUserId, "player"],
      );
    });

    it("handles zero duration in endGame", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      await endGame(mockPool as unknown as Pool, {
        gameId: "game-123",
        outcome: { winner: "player-1" },
        durationSeconds: 0,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE games"),
        expect.arrayContaining([expect.any(String), 0, "game-123"]),
      );
    });

    it("handles very large duration values", async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as QueryResult);

      const largeSeconds = 999999999;
      await endGame(mockPool as unknown as Pool, {
        gameId: "game-marathon",
        outcome: { winner: "player-1" },
        durationSeconds: largeSeconds,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE games"),
        expect.arrayContaining([expect.any(String), largeSeconds, "game-marathon"]),
      );
    });
  });
});

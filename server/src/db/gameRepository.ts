import type { Pool } from "pg";
import { randomUUID } from "crypto";

export interface CreateGameParams {
  gameType: string;
  playerIds: string[];
}

export interface EndGameParams {
  gameId: string;
  outcome: Record<string, unknown>;
  durationSeconds: number;
}

export interface AddParticipantParams {
  gameId: string;
  userId: string;
  role: "player" | "spectator";
}

export interface GameRecord {
  id: string;
  game_type: string;
  created_at: Date;
  ended_at: Date | null;
  outcome: Record<string, unknown> | null;
  duration_seconds: number | null;
}

export const createGame = async (
  pool: Pool,
  params: CreateGameParams,
): Promise<string> => {
  const gameId = randomUUID();
  
  try {
    await pool.query(
      `INSERT INTO games (id, game_type, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [gameId, params.gameType],
    );

    for (const playerId of params.playerIds) {
      await pool.query(
        `INSERT INTO game_participants (game_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [gameId, playerId, "player"],
      );
    }

    return gameId;
  } catch (error) {
    console.error("[gameRepository] Failed to create game:", error);
    throw error;
  }
};

export const endGame = async (
  pool: Pool,
  params: EndGameParams,
): Promise<void> => {
  try {
    await pool.query(
      `UPDATE games
       SET ended_at = CURRENT_TIMESTAMP,
           outcome = $1,
           duration_seconds = $2
       WHERE id = $3`,
      [JSON.stringify(params.outcome), params.durationSeconds, params.gameId],
    );
  } catch (error) {
    console.error("[gameRepository] Failed to end game:", error);
    throw error;
  }
};

export const addParticipant = async (
  pool: Pool,
  params: AddParticipantParams,
): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO game_participants (game_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [params.gameId, params.userId, params.role],
    );
  } catch (error) {
    console.error("[gameRepository] Failed to add participant:", error);
    throw error;
  }
};

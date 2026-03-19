/**
 * Generic move entry for recording game action history.
 * Used across all game types to maintain a consistent move history format.
 */
export interface MoveEntry {
  /** Turn number when move occurred */
  turnNumber: number;
  /** Session ID of player who made the move */
  playerId: string;
  /** Player display name */
  playerName: string;
  /** Game-specific action type (e.g., "move", "attack", "reinforce") */
  actionType: string;
  /** Game-specific payload (move details) */
  payload: Record<string, unknown>;
  /** Timestamp (ms since game start) */
  timestamp: number;
  /** Optional formatted description (set by game plugin) */
  description?: string;
}

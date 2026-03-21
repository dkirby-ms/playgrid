import type { Schema } from "@colyseus/schema";
import type { Client } from "colyseus";
import type { MoveEntry } from "./MoveEntry.js";

/**
 * The main interface that every game plugin must implement.
 * This is the contract between the core game system and individual game implementations.
 */
export interface GamePlugin<TState extends Schema = Schema> {
  /** Unique identifier for this game type (e.g., "checkers", "risk") */
  readonly id: string;

  /** Human-readable name (e.g., "Checkers", "Risk") */
  readonly name: string;

  /** Game metadata */
  readonly metadata: GameMetadata;

  /** Factory function to create the initial game state schema */
  createState(): TState;

  /** Lifecycle hooks */
  lifecycle: GameLifecycle<TState>;

  /** Turn management configuration */
  turnConfig: TurnConfiguration;

  /** Chess clock configuration (optional) */
  chessClockConfig?: ChessClockConfiguration;

  /** Action handlers for player moves */
  actions: GameActionHandlers<TState>;

  /** Win/loss/draw condition evaluators */
  conditions: GameConditions<TState>;

  /** State filtering for hidden information (optional) */
  stateFilter?: StateFilter<TState>;

  /** Optional: format raw move entries into human-readable descriptions */
  formatMoveHistory?(state: TState, moves: MoveEntry[]): MoveEntry[];
}

export interface GameMetadata {
  /** Supported player counts [min, max] */
  playerCount: [number, number];

  /** Estimated play time in minutes */
  estimatedDuration: number;

  /** Complexity rating (1-5) */
  complexity: number;

  /** Short description */
  description: string;

  /** Rule variants (optional) */
  variants?: string[];

  /** Whether this game requires hidden information */
  hasHiddenInformation: boolean;
}

export interface GameLifecycle<TState extends Schema> {
  /**
   * Called when the game room is created, before players join.
   * Initialize any data structures, RNG seeds, etc.
   */
  onCreate?(state: TState, options: GameOptions): void;

  /**
   * Called when a player joins the game room.
   * Assign player slots, deal cards, etc.
   */
  onPlayerJoin?(state: TState, client: Client, playerIndex: number): void;

  /**
   * Called after all expected players have joined.
   * Set up the initial board, deal hands, etc.
   */
  onGameStart(state: TState): void;

  /**
   * Called after the turn advances to a new player.
   * Use for per-turn initialization (e.g. calculating reinforcements).
   */
  onTurnStarted?(state: TState, newPlayerId: string): void;

  /**
   * Called when a player disconnects.
   * Handle graceful degradation or pause state.
   */
  onPlayerLeave?(state: TState, sessionId: string): void;

  /**
   * Called when a player reconnects.
   * Restore their connection to the game state.
   */
  onPlayerReconnect?(state: TState, client: Client): void;

  /**
   * Called when the game ends (win/loss/draw).
   * Clean up resources, record final scores.
   */
  onGameEnd?(state: TState, result: GameResult): void;

  /**
   * Called every tick (optional, for time-based mechanics).
   * Update timers, check for timeouts, etc.
   */
  onTick?(state: TState, deltaTime: number): void;
}

export interface GameOptions {
  /** Optional variant rules */
  variant?: string;

  /** Other game-specific options */
  [key: string]: unknown;
}

export interface GameResult {
  /** Type of game ending */
  type: "win" | "draw" | "forfeit" | "timeout";

  /** Winner session ID (if type is "win") */
  winnerId?: string;

  /** Final scores/rankings */
  scores: Record<string, number>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export type TurnMode = "sequential" | "simultaneous" | "phased";

export interface TurnConfiguration {
  /** How turns are managed */
  mode: TurnMode;

  /** Turn order strategy */
  turnOrder: TurnOrderStrategy;

  /** Whether players can pass/skip */
  allowPass: boolean;

  /** For phased games (like Risk), define the phases */
  phases?: TurnPhase[];

}

/**
 * Chess clock configuration for 2-player games.
 * When enabled, each player has a fixed time bank that decrements only during their turns.
 * The clock pauses on disconnect and a player loses if their time reaches zero.
 */
export interface ChessClockConfiguration {
  /** Whether the chess clock is enabled */
  enabled: boolean;

  /** Initial time bank for each player in milliseconds */
  initialTimeBankMs: number;
}

export type TurnOrderStrategy =
  | { type: "round-robin" }
  | { type: "random" }
  | { type: "custom"; determineNext: (state: Schema) => string };

export interface TurnPhase {
  /** Phase identifier (e.g., "reinforce", "attack", "fortify") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Actions available in this phase */
  allowedActions: string[];

  /** Whether this phase can be skipped */
  optional: boolean;
}

export interface GameActionHandlers<TState extends Schema> {
  /** Map of action type to handler function */
  [actionType: string]: ActionHandler<TState>;
}

export type ActionHandler<TState extends Schema> = (
  state: TState,
  client: Client,
  payload: unknown,
) => ActionResult;

export interface ActionResult {
  /** Whether the action was valid and executed */
  success: boolean;

  /** Error message if action failed */
  error?: string;

  /** Optional state updates to broadcast */
  updates?: Record<string, unknown>;

  /** Whether this action ends the current turn */
  endsTurn?: boolean;

  /** Whether this action ends the game */
  endsGame?: boolean;
}

export interface GameConditions<TState extends Schema> {
  /**
   * Check if the game has ended and determine the result.
   * Called after every action.
   */
  checkGameEnd(state: TState): GameResult | null;

  /**
   * Validate if a specific action is legal in the current state.
   * Called before executing an action.
   */
  validateAction(
    state: TState,
    client: Client,
    actionType: string,
    payload: unknown,
  ): boolean;

  /**
   * Get all valid actions for a player in the current state.
   * Used for AI hints or client-side validation.
   */
  getValidActions?(state: TState, sessionId: string): string[];
}

export interface StateFilter<TState extends Schema> {
  /**
   * Filter the state for a specific client.
   * Used for card games where each player has private information.
   *
   * @param state - The full server state
   * @param sessionId - The client requesting the filtered state
   * @param isSpectator - Whether this client is a spectator
   * @returns A filtered view of the state
   */
  filterForClient(
    state: TState,
    sessionId: string | null,
    isSpectator: boolean,
  ): Partial<TState>;

  /**
   * Return per-client private data to send as a direct message.
   * Called after actions, game start, and reconnection.
   * Return null/undefined to skip sending.
   */
  getPlayerMessage?(state: TState, sessionId: string): unknown;
}

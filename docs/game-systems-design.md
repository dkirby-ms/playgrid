# Game Systems Design

**Author:** Pemulis (Systems Dev)  
**Date:** 2026-03-14  
**Status:** Research & Design Phase

> The simulation is the game. If the ecosystem doesn't feel alive, nothing else matters.

## Executive Summary

This document defines the architecture for a plugin-based game system that supports multiple classic board and card games (Risk, Checkers, Backgammon, Dominoes, Poker, Hearts, Spades) on the playgrid platform. The design prioritizes:

1. **Type Safety** — Full TypeScript interfaces with Colyseus schema validation
2. **Plugin Architecture** — Each game is a self-contained module with standardized lifecycle
3. **Hidden Information** — Server-authoritative state with per-client filtering for card games
4. **Extensibility** — New games can be added without modifying core system code

---

## 1. Game Plugin Interface Design

### 1.1 Core Plugin Interface

Every game plugin implements the `GamePlugin` interface:

```typescript
import { Schema } from "@colyseus/schema";
import { Client } from "colyseus";

/**
 * The main interface that every game plugin must implement.
 * This is the contract between the core game system and individual game implementations.
 */
interface GamePlugin<TState extends Schema = Schema> {
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
  
  /** Action handlers for player moves */
  actions: GameActionHandlers<TState>;
  
  /** Win/loss/draw condition evaluators */
  conditions: GameConditions<TState>;
  
  /** State filtering for hidden information (optional) */
  stateFilter?: StateFilter<TState>;
}

interface GameMetadata {
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
```

### 1.2 Lifecycle Hooks

```typescript
interface GameLifecycle<TState extends Schema> {
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

interface GameOptions {
  /** Optional variant rules */
  variant?: string;
  
  /** Optional time limits */
  turnTimeLimit?: number;
  
  /** Other game-specific options */
  [key: string]: unknown;
}

interface GameResult {
  /** Type of game ending */
  type: "win" | "draw" | "forfeit" | "timeout";
  
  /** Winner session ID (if type is "win") */
  winnerId?: string;
  
  /** Final scores/rankings */
  scores: Record<string, number>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### 1.3 Turn Management Configuration

```typescript
type TurnMode = "sequential" | "simultaneous" | "phased";

interface TurnConfiguration {
  /** How turns are managed */
  mode: TurnMode;
  
  /** Turn order strategy */
  turnOrder: TurnOrderStrategy;
  
  /** Optional turn timer (seconds) */
  turnTimeLimit?: number;
  
  /** Whether players can pass/skip */
  allowPass: boolean;
  
  /** For phased games (like Risk), define the phases */
  phases?: TurnPhase[];
}

type TurnOrderStrategy = 
  | { type: "round-robin" }
  | { type: "random" }
  | { type: "custom"; determineNext: (state: Schema) => string };

interface TurnPhase {
  /** Phase identifier (e.g., "reinforce", "attack", "fortify") */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Actions available in this phase */
  allowedActions: string[];
  
  /** Whether this phase can be skipped */
  optional: boolean;
}
```

### 1.4 Action Handlers

```typescript
interface GameActionHandlers<TState extends Schema> {
  /** Map of action type to handler function */
  [actionType: string]: ActionHandler<TState>;
}

type ActionHandler<TState extends Schema> = (
  state: TState,
  client: Client,
  payload: unknown
) => ActionResult;

interface ActionResult {
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
```

### 1.5 Win Conditions

```typescript
interface GameConditions<TState extends Schema> {
  /**
   * Check if the game has ended and determine the result.
   * Called after every action.
   */
  checkGameEnd(state: TState): GameResult | null;
  
  /**
   * Validate if a specific action is legal in the current state.
   * Called before executing an action.
   */
  validateAction(state: TState, client: Client, actionType: string, payload: unknown): boolean;
  
  /**
   * Get all valid actions for a player in the current state.
   * Used for AI hints or client-side validation.
   */
  getValidActions?(state: TState, sessionId: string): string[];
}
```

### 1.6 State Filtering (Hidden Information)

```typescript
interface StateFilter<TState extends Schema> {
  /**
   * Filter the state for a specific client.
   * Used for card games where each player has private information.
   * 
   * @param state - The full server state
   * @param sessionId - The client requesting the filtered state
   * @param isSpectator - Whether this client is a spectator
   * @returns A filtered view of the state
   */
  filterForClient(state: TState, sessionId: string | null, isSpectator: boolean): Partial<TState>;
}
```

---

## 2. Game State Architecture

### 2.1 Base State Schema

All game states extend a common base:

```typescript
import { Schema, defineTypes, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * Base game state that all game plugins extend.
 * Contains common fields for player management, turn tracking, etc.
 */
class BaseGameState extends Schema {
  declare gameId: string;
  declare gameType: string;
  declare status: "waiting" | "active" | "paused" | "ended";
  declare players: MapSchema<GamePlayer>;
  declare currentTurnPlayer: string; // sessionId
  declare turnNumber: number;
  declare startedAt: number;
  declare lastActionAt: number;
}

defineTypes(BaseGameState, {
  gameId: "string",
  gameType: "string",
  status: "string",
  players: { map: GamePlayer },
  currentTurnPlayer: "string",
  turnNumber: "number",
  startedAt: "number",
  lastActionAt: "number",
});

class GamePlayer extends Schema {
  declare sessionId: string;
  declare displayName: string;
  declare playerIndex: number; // 0-based position
  declare isActive: boolean; // false if eliminated/disconnected
  declare isReady: boolean;
  declare score: number;
}

defineTypes(GamePlayer, {
  sessionId: "string",
  displayName: "string",
  playerIndex: "number",
  isActive: "boolean",
  isReady: "boolean",
  score: "number",
});
```

### 2.2 State Synchronization Strategy

**Turn-Based Games:**
- State updates only when actions are validated and applied
- Full state sync after each action
- Clients never predict state (server is authoritative)

**Real-Time Elements:**
- Turn timers tick every second
- Animation hints sent separately from state updates
- Client interpolates visual elements, never game logic

**State Delta Compression:**
- Colyseus automatically sends only changed fields
- Large nested structures (like game boards) use ArraySchema for efficient deltas

### 2.3 Validation Flow

```
Client sends action
    ↓
Server validates via plugin.conditions.validateAction()
    ↓
If valid → Execute plugin.actions[actionType]()
    ↓
State mutates
    ↓
Colyseus detects changes and syncs to clients
    ↓
Check plugin.conditions.checkGameEnd()
```

---

## 3. Per-Game Technical Analysis

### 3.1 Checkers

**Complexity:** Low (2/5)  
**State Size:** Small (~200 bytes)  
**Hidden Info:** None

#### State Schema

```typescript
class CheckersState extends BaseGameState {
  declare board: ArraySchema<number>; // 64 cells, 0=empty, 1=black, 2=red, 3=black king, 4=red king
  declare mustCaptureFrom: number; // -1 or cell index (for forced jump chains)
}

defineTypes(CheckersState, {
  ...BaseGameState.prototype._definition,
  board: ["number"],
  mustCaptureFrom: "number",
});
```

#### Movement Rules

- Regular pieces move diagonally forward one square
- Kings move diagonally in any direction
- Captures are mandatory (forced jump rule)
- Multi-jump chains: after a capture, if another capture is available, player must continue

#### Win Conditions

- Opponent has no pieces left
- Opponent has no legal moves

#### Action Types

```typescript
type CheckersAction = 
  | { type: "move"; from: number; to: number }
  | { type: "continue-capture"; to: number } // for jump chains
```

#### Estimated Implementation Time

**2-3 days** — Good first game to build. Simple rules, no hidden info, exercises the plugin system well.

---

### 3.2 Backgammon

**Complexity:** Medium (3/5)  
**State Size:** Medium (~500 bytes)  
**Hidden Info:** None (dice rolls are visible)

#### State Schema

```typescript
class BackgammonState extends BaseGameState {
  declare points: ArraySchema<number>; // 24 points, positive=white, negative=black count
  declare bar: ArraySchema<number>; // [white count, black count]
  declare off: ArraySchema<number>; // [white count, black count]
  declare dice: ArraySchema<number>; // [die1, die2] (0 if not rolled)
  declare diceUsed: ArraySchema<boolean>; // [used1, used2]
  declare doublingCube: number; // 1, 2, 4, 8, 16, 32, 64
  declare doublingCubeOwner: string; // sessionId or "" (centered)
  declare canDouble: boolean;
}

defineTypes(BackgammonState, {
  ...BaseGameState.prototype._definition,
  points: ["number"],
  bar: ["number"],
  off: ["number"],
  dice: ["number"],
  diceUsed: ["boolean"],
  doublingCube: "number",
  doublingCubeOwner: "string",
  canDouble: "boolean",
});
```

#### Movement Rules

- Roll two dice at start of turn
- Move checkers according to dice values
- Must use both dice if possible
- If doubles, play each die twice
- Cannot land on opponent's point with 2+ checkers (blocked)
- Checkers on bar must re-enter before other moves
- Bearing off requires all checkers in home board

#### Win Conditions

- Opponent bears off all 15 checkers first
- Backgammon (win with opponent pieces on bar or in winner's home) = 3x points
- Gammon (win with opponent having borne off none) = 2x points

#### Action Types

```typescript
type BackgammonAction =
  | { type: "roll" }
  | { type: "move"; from: number; die: number }
  | { type: "double" }
  | { type: "accept-double" }
  | { type: "decline-double" }
  | { type: "end-turn" }
```

#### Estimated Implementation Time

**4-5 days** — Complex movement validation, dice mechanics, doubling cube adds state management complexity.

---

### 3.3 Dominoes (Draw variant)

**Complexity:** Low-Medium (2/5)  
**State Size:** Small (~300 bytes)  
**Hidden Info:** Yes (player hands, draw pile)

#### State Schema

```typescript
class DominoTile extends Schema {
  declare left: number;  // 0-6 (or 0-9 for double-nine)
  declare right: number;
}

defineTypes(DominoTile, {
  left: "number",
  right: "number",
});

class DominoesState extends BaseGameState {
  declare boneyard: ArraySchema<DominoTile>; // draw pile (HIDDEN from clients)
  declare line: ArraySchema<DominoTile>; // played dominoes on the table
  declare lineEnds: ArraySchema<number>; // [leftEnd, rightEnd] for valid plays
  declare playerHands: MapSchema<ArraySchema<DominoTile>>; // HIDDEN per-player
  declare handSizes: MapSchema<number>; // visible counts
  declare passCount: number; // consecutive passes
}

defineTypes(DominoesState, {
  ...BaseGameState.prototype._definition,
  boneyard: [DominoTile],
  line: [DominoTile],
  lineEnds: ["number"],
  playerHands: { map: [DominoTile] },
  handSizes: { map: "number" },
  passCount: "number",
});
```

#### Game Rules (Draw Variant)

- Standard double-six set (28 tiles)
- Deal 7 tiles per player (2-4 players)
- Highest double starts
- Play tiles matching line ends
- If can't play, draw from boneyard until you can (or boneyard empty)
- If can't play after drawing, pass
- Game ends when one player empties hand or all players pass

#### Win Conditions

- First player to empty hand wins
- If all pass (blocked game), lowest pip count wins
- Scoring: Winner gets sum of opponent pip counts

#### Hidden Information Strategy

The server maintains the full state but filters views:
- Each client sees only their own hand
- Clients see boneyard size but not contents
- Clients see played line and counts of opponent hands

#### Action Types

```typescript
type DominoesAction =
  | { type: "play"; tileIndex: number; end: "left" | "right"; flipped: boolean }
  | { type: "draw" }
  | { type: "pass" }
```

#### Estimated Implementation Time

**3-4 days** — First game with hidden information, exercises state filtering.

---

### 3.4 Risk

**Complexity:** Very High (5/5)  
**State Size:** Large (~5KB+)  
**Hidden Info:** Minimal (draft cards are private until traded)

#### State Schema

```typescript
class Territory extends Schema {
  declare id: string;
  declare name: string;
  declare continentId: string;
  declare ownerId: string; // sessionId
  declare armies: number;
}

defineTypes(Territory, {
  id: "string",
  name: "string",
  continentId: "string",
  ownerId: "string",
  armies: "number",
});

class RiskCard extends Schema {
  declare id: string;
  declare territoryId: string;
  declare type: "infantry" | "cavalry" | "artillery" | "wild";
}

defineTypes(RiskCard, {
  id: "string",
  territoryId: "string",
  type: "string",
});

class RiskState extends BaseGameState {
  declare territories: MapSchema<Territory>;
  declare continents: MapSchema<Continent>; // static, bonus info
  declare adjacencies: MapSchema<ArraySchema<string>>; // territory connections
  declare currentPhase: "setup" | "reinforce" | "attack" | "fortify";
  declare cardDeck: ArraySchema<RiskCard>; // HIDDEN
  declare playerCards: MapSchema<ArraySchema<RiskCard>>; // HIDDEN per-player
  declare cardSetValue: number; // increases each set traded
  declare conqueredThisTurn: boolean; // for card draw eligibility
  declare attackDice: ArraySchema<number>; // for showing attack results
  declare defendDice: ArraySchema<number>;
}

defineTypes(RiskState, {
  ...BaseGameState.prototype._definition,
  territories: { map: Territory },
  continents: { map: Continent },
  adjacencies: { map: ["string"] },
  currentPhase: "string",
  cardDeck: [RiskCard],
  playerCards: { map: [RiskCard] },
  cardSetValue: "number",
  conqueredThisTurn: "boolean",
  attackDice: ["number"],
  defendDice: ["number"],
});
```

#### Game Phases

**1. Setup Phase:**
- Players take turns placing initial armies
- Continues until all territories claimed and all starting armies placed

**2. Reinforce Phase:**
- Calculate reinforcements (territories/3, continent bonuses, card trades)
- Place armies on owned territories

**3. Attack Phase:**
- Attack adjacent enemy territories
- Attacker rolls 1-3 dice, defender rolls 1-2 dice
- Compare highest dice, attacker loses ties
- Repeat until attacker stops or conquers world

**4. Fortify Phase:**
- Move armies from one territory to an adjacent owned territory
- Optional, once per turn

#### Win Conditions

- Control all territories on the map
- Or, mission cards variant: complete secret objective

#### Action Types

```typescript
type RiskAction =
  | { type: "place-army"; territoryId: string; count: number }
  | { type: "trade-cards"; cardIds: [string, string, string] }
  | { type: "attack"; from: string; to: string; diceCount: 1 | 2 | 3 }
  | { type: "defend"; diceCount: 1 | 2 }
  | { type: "occupy"; armyCount: number } // after conquest
  | { type: "end-attack" }
  | { type: "fortify"; from: string; to: string; armyCount: number }
  | { type: "end-turn" }
```

#### Complexity Factors

- Large state space (42 territories × players × armies)
- Multi-phase turns
- Dice rolling mechanics
- Card trading logic
- Pathfinding for fortify adjacency checks
- Elimination mechanics (players can be knocked out)

#### Estimated Implementation Time

**10-14 days** — Most complex game. Save for last. Requires robust phase management and extensive validation logic.

---

### 3.5 Card Games (Poker, Hearts, Spades)

**Complexity:** Medium-High (3-4/5)  
**State Size:** Medium (~1-2KB)  
**Hidden Info:** Critical (private hands, deck state)

#### Shared Card Infrastructure

```typescript
class Card extends Schema {
  declare suit: "hearts" | "diamonds" | "clubs" | "spades";
  declare rank: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
  declare id: string; // unique identifier
}

defineTypes(Card, {
  suit: "string",
  rank: "string",
  id: "string",
});

class CardGameState extends BaseGameState {
  declare deck: ArraySchema<Card>; // HIDDEN
  declare playerHands: MapSchema<ArraySchema<Card>>; // HIDDEN per-player
  declare handSizes: MapSchema<number>; // visible counts
  declare currentTrick: ArraySchema<Card>; // visible
  declare trickStarter: string; // sessionId
}

defineTypes(CardGameState, {
  ...BaseGameState.prototype._definition,
  deck: [Card],
  playerHands: { map: [Card] },
  handSizes: { map: "number" },
  currentTrick: [Card],
  trickStarter: "string",
});
```

---

#### 3.5.1 Hearts

**Complexity:** Medium (3/5)

```typescript
class HeartsState extends CardGameState {
  declare roundScores: MapSchema<ArraySchema<number>>; // scores per round per player
  declare totalScores: MapSchema<number>;
  declare heartsBroken: boolean;
  declare passDirection: "left" | "right" | "across" | "none"; // rotates each round
  declare passedCards: MapSchema<ArraySchema<Card>>; // during pass phase
  declare trickWinner: string; // sessionId
}

defineTypes(HeartsState, {
  ...CardGameState.prototype._definition,
  roundScores: { map: ["number"] },
  totalScores: { map: "number" },
  heartsBroken: "boolean",
  passDirection: "string",
  passedCards: { map: [Card] },
  trickWinner: "string",
});
```

**Rules:**
- 4 players, standard 52-card deck
- Deal entire deck (13 cards each)
- Pass 3 cards before play (direction rotates)
- Player with 2♣ leads first trick
- Must follow suit if possible
- Hearts cannot lead until "broken" (played on a trick)
- Each heart = 1 point, Q♠ = 13 points
- "Shooting the moon" = taking all 26 points → others get 26, you get 0
- Game ends when player reaches 100 points, lowest score wins

**Action Types:**
```typescript
type HeartsAction =
  | { type: "pass-cards"; cardIds: [string, string, string] }
  | { type: "play-card"; cardId: string }
```

**Estimated Implementation Time:** **5-6 days**

---

#### 3.5.2 Spades

**Complexity:** Medium (3/5)

```typescript
class SpadesState extends CardGameState {
  declare bids: MapSchema<number>; // per player
  declare nilBids: MapSchema<boolean>; // blind nil optional
  declare tricksWon: MapSchema<number>;
  declare roundScores: MapSchema<ArraySchema<number>>;
  declare totalScores: MapSchema<number>;
  declare bags: MapSchema<number>; // overtricks
  declare spadesLed: boolean;
}

defineTypes(SpadesState, {
  ...CardGameState.prototype._definition,
  bids: { map: "number" },
  nilBids: { map: "boolean" },
  tricksWon: { map: "number" },
  roundScores: { map: ["number"] },
  totalScores: { map: "number" },
  bags: { map: "number" },
  spadesLed: "boolean",
});
```

**Rules:**
- 4 players (partners: 0+2 vs 1+3), standard 52-card deck
- Deal entire deck (13 cards each)
- Bidding phase: each player bids number of tricks they'll win
- Nil bid = 0 tricks (100 bonus/-100 penalty)
- Spades are always trump, cannot lead until broken
- Must follow suit, can trump if can't follow
- Scoring: 10 × bid if met, -10 × bid if not
- Overtricks ("bags") = 1 point each, 10 bags = -100 penalty
- Game to 500 points

**Action Types:**
```typescript
type SpadesAction =
  | { type: "bid"; tricks: number; nil?: boolean }
  | { type: "play-card"; cardId: string }
```

**Estimated Implementation Time:** **5-6 days**

---

#### 3.5.3 Poker (Texas Hold'em)

**Complexity:** High (4/5)

```typescript
class PokerState extends CardGameState {
  declare communityCards: ArraySchema<Card>; // flop, turn, river (visible)
  declare pot: number;
  declare currentBet: number;
  declare playerChips: MapSchema<number>;
  declare playerBets: MapSchema<number>; // this round
  declare phase: "blinds" | "preflop" | "flop" | "turn" | "river" | "showdown";
  declare dealerButton: number; // player index
  declare smallBlind: number;
  declare bigBlind: number;
  declare folded: MapSchema<boolean>;
  declare allIn: MapSchema<boolean>;
}

defineTypes(PokerState, {
  ...CardGameState.prototype._definition,
  communityCards: [Card],
  pot: "number",
  currentBet: "number",
  playerChips: { map: "number" },
  playerBets: { map: "number" },
  phase: "string",
  dealerButton: "number",
  smallBlind: "number",
  bigBlind: "number",
  folded: { map: "boolean" },
  allIn: { map: "boolean" },
});
```

**Rules:**
- 2-9 players, standard 52-card deck
- Deal 2 hole cards per player (private)
- Betting rounds: pre-flop → flop (3 community) → turn (1 community) → river (1 community) → showdown
- Actions: fold, check, call, raise, all-in
- Best 5-card hand from 7 cards (2 hole + 5 community)
- Side pots for all-ins
- Dealer button rotates

**Action Types:**
```typescript
type PokerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; amount: number }
  | { type: "all-in" }
```

**Complexity Factors:**
- Hand evaluation logic (poker hand rankings)
- Side pot calculations
- Betting validation (raise minimums, legal actions)
- Showdown logic (who reveals first, who wins)

**Estimated Implementation Time:** **7-9 days** (hand evaluator is complex)

---

## 4. Hidden Information Architecture

### 4.1 Server-Authoritative State

**Core Principle:** The server holds the complete, unfiltered game state. Clients receive filtered views based on their session ID and role (player vs. spectator).

### 4.2 Colyseus State Filtering

Colyseus doesn't natively support per-client state filtering, so we implement this at the Room level:

```typescript
class GameRoom extends Room<Schema> {
  private gamePlugin: GamePlugin;
  
  override onJoin(client: Client) {
    // Register client but don't auto-sync full state
    client.send("initial-state", this.getFilteredState(client.sessionId));
  }
  
  private getFilteredState(sessionId: string | null): Partial<Schema> {
    if (!this.gamePlugin.stateFilter) {
      return this.state; // No filtering needed
    }
    
    const isSpectator = !this.state.players.has(sessionId);
    return this.gamePlugin.stateFilter.filterForClient(
      this.state,
      sessionId,
      isSpectator
    );
  }
  
  private broadcastStateUpdate() {
    if (!this.gamePlugin.stateFilter) {
      // Let Colyseus handle automatic sync
      return;
    }
    
    // Manual per-client state filtering
    for (const client of this.clients) {
      const filtered = this.getFilteredState(client.sessionId);
      client.send("state-update", filtered);
    }
  }
}
```

### 4.3 Example: Card Game State Filter

```typescript
const pokerStateFilter: StateFilter<PokerState> = {
  filterForClient(state, sessionId, isSpectator) {
    const filtered = { ...state };
    
    // Hide deck from everyone
    filtered.deck = undefined;
    
    if (isSpectator) {
      // Spectators see no hole cards (unless showdown)
      filtered.playerHands = new MapSchema();
      if (state.phase === "showdown") {
        // Show revealed hands
        for (const [sid, hand] of state.playerHands.entries()) {
          if (!state.folded.get(sid)) {
            filtered.playerHands.set(sid, hand);
          }
        }
      }
    } else {
      // Players see only their own hand
      const myHand = state.playerHands.get(sessionId);
      filtered.playerHands = new MapSchema();
      if (myHand) {
        filtered.playerHands.set(sessionId, myHand);
      }
      
      // At showdown, reveal all active hands
      if (state.phase === "showdown") {
        for (const [sid, hand] of state.playerHands.entries()) {
          if (!state.folded.get(sid)) {
            filtered.playerHands.set(sid, hand);
          }
        }
      }
    }
    
    return filtered;
  }
};
```

### 4.4 Anti-Cheat Considerations

**Server Authority:**
- All game logic executes server-side
- Client sends action intents, not state mutations
- Server validates every action before applying

**Validation:**
- Never trust client-provided data
- Validate action legality via `plugin.conditions.validateAction()`
- Check player permissions (is it their turn? are they still active?)

**Audit Trails:**
- Log all actions with timestamps
- Enable replay/review for disputed games
- Rate-limit action requests per client

---

## 5. Turn Management System

### 5.1 Core Turn Manager

```typescript
class TurnManager {
  constructor(private config: TurnConfiguration) {}
  
  /**
   * Initialize turn order when the game starts.
   */
  initializeTurns(playerIds: string[]): string {
    switch (this.config.turnOrder.type) {
      case "round-robin":
        return playerIds[0];
      case "random":
        return playerIds[Math.floor(Math.random() * playerIds.length)];
      case "custom":
        // Plugin-defined logic
        return this.config.turnOrder.determineNext(state);
    }
  }
  
  /**
   * Advance to the next player's turn.
   */
  nextTurn(state: BaseGameState): string {
    const playerIds = Array.from(state.players.keys()).filter(
      (id) => state.players.get(id)!.isActive
    );
    
    const currentIndex = playerIds.indexOf(state.currentTurnPlayer);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    
    return playerIds[nextIndex];
  }
  
  /**
   * Handle turn timeout (if turn time limit is configured).
   */
  onTurnTimeout(state: BaseGameState): void {
    // Auto-skip turn or forfeit, depending on game rules
    console.warn(`Turn timeout for player ${state.currentTurnPlayer}`);
  }
}
```

### 5.2 Phased Turn Management (Risk Example)

```typescript
class PhasedTurnManager extends TurnManager {
  private currentPhaseIndex = 0;
  
  advancePhase(state: RiskState): void {
    const phases = this.config.phases!;
    this.currentPhaseIndex = (this.currentPhaseIndex + 1) % phases.length;
    
    if (this.currentPhaseIndex === 0) {
      // Wrapped around, advance to next player
      state.currentTurnPlayer = this.nextTurn(state);
    }
    
    state.currentPhase = phases[this.currentPhaseIndex].id;
  }
  
  canSkipPhase(state: RiskState): boolean {
    const phases = this.config.phases!;
    return phases[this.currentPhaseIndex].optional;
  }
}
```

### 5.3 Turn Timers

```typescript
class TurnTimer {
  private timers = new Map<string, NodeJS.Timeout>();
  
  startTimer(gameId: string, duration: number, onTimeout: () => void): void {
    this.clearTimer(gameId);
    
    const timer = setTimeout(() => {
      onTimeout();
      this.timers.delete(gameId);
    }, duration * 1000);
    
    this.timers.set(gameId, timer);
  }
  
  clearTimer(gameId: string): void {
    const existing = this.timers.get(gameId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(gameId);
    }
  }
}
```

---

## 6. Recommended Implementation Order

### Phase 1: Foundation (Week 1)
**Build:** Core plugin system, BaseGameState, GameRoom integration

**Deliverables:**
- `GamePlugin` interface
- `GameRoom` modified to accept and load plugins
- Plugin registry system
- Basic turn management

---

### Phase 2: First Game - Checkers (Week 2)
**Why Checkers?**
- Simple rules, no hidden information
- Exercises the full plugin lifecycle
- Good validation test case (forced jumps)
- Quick win to validate architecture

**Deliverables:**
- `CheckersPlugin` implementing `GamePlugin`
- CheckersState schema
- Action handlers (move, jump chains)
- Win condition logic
- Client rendering (PixiJS board + pieces)

---

### Phase 3: Hidden Information - Dominoes (Week 3)
**Why Dominoes next?**
- Introduces state filtering
- Simpler than card games (fewer rules)
- Tests per-client view architecture

**Deliverables:**
- State filtering system in GameRoom
- `DominoesPlugin` with StateFilter
- Private hand management
- Draw pile mechanics

---

### Phase 4: Card Game - Hearts (Week 4)
**Why Hearts?**
- No betting logic (simpler than Poker/Spades)
- Exercises trick-taking mechanics (reusable for Spades)
- Tests multi-round scoring

**Deliverables:**
- Shared card infrastructure (Card schema, deck utils)
- `HeartsPlugin`
- Passing phase
- Trick-taking logic
- Shooting the moon logic

---

### Phase 5: Bidding - Spades (Week 5)
**Why Spades?**
- Reuses Hearts' trick-taking
- Adds bidding phase
- Partner scoring logic

**Deliverables:**
- `SpadesPlugin`
- Bidding phase
- Nil bid logic
- Bags tracking

---

### Phase 6: Dice Game - Backgammon (Week 6)
**Why Backgammon?**
- Different mechanic (dice + movement)
- Complex validation (bearing off, bar)
- Doubling cube adds state depth

**Deliverables:**
- `BackgammonPlugin`
- Dice rolling RNG
- Movement validation
- Doubling cube mechanics

---

### Phase 7: Complex Betting - Poker (Week 7-8)
**Why Poker?**
- Most complex betting logic
- Hand evaluation is non-trivial
- Side pots require careful accounting

**Deliverables:**
- `PokerPlugin`
- Poker hand evaluator
- Betting rounds
- Side pot calculation
- Showdown logic

---

### Phase 8: Most Complex - Risk (Week 9-11)
**Why Risk last?**
- Largest state space
- Multi-phase turns
- Player elimination
- Requires all prior learnings

**Deliverables:**
- `RiskPlugin`
- Territory/continent data
- Attack/defend dice mechanics
- Card trading
- Phase management (reinforce → attack → fortify)
- Win condition (world domination or missions)

---

## 7. Example Plugin Skeleton

### 7.1 Complete Checkers Plugin

```typescript
import { Schema, defineTypes, ArraySchema } from "@colyseus/schema";
import { Client } from "colyseus";
import type {
  GamePlugin,
  GameMetadata,
  GameLifecycle,
  TurnConfiguration,
  GameActionHandlers,
  GameConditions,
  ActionResult,
  GameResult,
} from "./types";

// ==================== STATE SCHEMA ====================

class CheckersState extends BaseGameState {
  declare board: ArraySchema<number>;
  declare mustCaptureFrom: number; // -1 or cell index
}

defineTypes(CheckersState, {
  ...BaseGameState.prototype._definition,
  board: ["number"],
  mustCaptureFrom: "number",
});

// ==================== PLUGIN DEFINITION ====================

export const CheckersPlugin: GamePlugin<CheckersState> = {
  id: "checkers",
  name: "Checkers",
  
  metadata: {
    playerCount: [2, 2],
    estimatedDuration: 20,
    complexity: 2,
    description: "Classic 8x8 checkers with forced jumps",
    hasHiddenInformation: false,
  },
  
  // ==================== STATE FACTORY ====================
  
  createState() {
    const state = new CheckersState();
    state.board = new ArraySchema<number>(...Array(64).fill(0));
    state.mustCaptureFrom = -1;
    return state;
  },
  
  // ==================== LIFECYCLE ====================
  
  lifecycle: {
    onCreate(state, options) {
      // Initialize 8x8 board (64 cells)
      // Cells 0-7: row 0, 8-15: row 1, etc.
      // Black on top (rows 0-2), red on bottom (rows 5-7)
      
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const index = row * 8 + col;
          const isDarkSquare = (row + col) % 2 === 1;
          
          if (!isDarkSquare) continue; // Checkers only on dark squares
          
          if (row < 3) {
            state.board[index] = 1; // Black piece
          } else if (row > 4) {
            state.board[index] = 2; // Red piece
          }
        }
      }
    },
    
    onPlayerJoin(state, client, playerIndex) {
      const player = state.players.get(client.sessionId)!;
      player.playerIndex = playerIndex;
      
      // Player 0 = Black (pieces = 1), Player 1 = Red (pieces = 2)
    },
    
    onGameStart(state) {
      // Black goes first
      const blackPlayer = Array.from(state.players.values()).find(
        (p) => p.playerIndex === 0
      );
      state.currentTurnPlayer = blackPlayer!.sessionId;
      state.status = "active";
      state.startedAt = Date.now();
    },
    
    onTick(state, deltaTime) {
      state.lastActionAt = Date.now();
    },
  },
  
  // ==================== TURN CONFIG ====================
  
  turnConfig: {
    mode: "sequential",
    turnOrder: { type: "round-robin" },
    turnTimeLimit: 60,
    allowPass: false,
  },
  
  // ==================== ACTIONS ====================
  
  actions: {
    move(state, client, payload: { from: number; to: number }): ActionResult {
      const { from, to } = payload;
      
      // Validation
      if (!isValidMove(state, client.sessionId, from, to)) {
        return { success: false, error: "Invalid move" };
      }
      
      // Execute move
      const piece = state.board[from];
      state.board[from] = 0;
      state.board[to] = piece;
      
      // Check for king promotion
      const toRow = Math.floor(to / 8);
      const player = state.players.get(client.sessionId)!;
      if (player.playerIndex === 0 && toRow === 7 && piece === 1) {
        state.board[to] = 3; // Black king
      } else if (player.playerIndex === 1 && toRow === 0 && piece === 2) {
        state.board[to] = 4; // Red king
      }
      
      // Check for capture
      const isCapture = Math.abs(from - to) > 9;
      if (isCapture) {
        const capturedIndex = (from + to) / 2;
        state.board[capturedIndex] = 0;
        
        // Check for multi-jump
        if (hasValidCaptures(state, to)) {
          state.mustCaptureFrom = to;
          return { success: true, endsTurn: false }; // Continue turn
        }
      }
      
      state.mustCaptureFrom = -1;
      return { success: true, endsTurn: true };
    },
  },
  
  // ==================== CONDITIONS ====================
  
  conditions: {
    validateAction(state, client, actionType, payload) {
      // Must be player's turn
      if (state.currentTurnPlayer !== client.sessionId) {
        return false;
      }
      
      // If in multi-jump, can only move from forced position
      if (state.mustCaptureFrom !== -1) {
        const { from } = payload as { from: number };
        return from === state.mustCaptureFrom;
      }
      
      return true;
    },
    
    checkGameEnd(state): GameResult | null {
      // Check if either player has no pieces
      let blackCount = 0;
      let redCount = 0;
      
      for (const cell of state.board) {
        if (cell === 1 || cell === 3) blackCount++;
        if (cell === 2 || cell === 4) redCount++;
      }
      
      if (blackCount === 0) {
        const redPlayer = Array.from(state.players.values()).find(
          (p) => p.playerIndex === 1
        )!;
        return {
          type: "win",
          winnerId: redPlayer.sessionId,
          scores: { [redPlayer.sessionId]: 1 },
        };
      }
      
      if (redCount === 0) {
        const blackPlayer = Array.from(state.players.values()).find(
          (p) => p.playerIndex === 0
        )!;
        return {
          type: "win",
          winnerId: blackPlayer.sessionId,
          scores: { [blackPlayer.sessionId]: 1 },
        };
      }
      
      // Check for no legal moves (stalemate)
      // TODO: Implement move enumeration
      
      return null;
    },
  },
};

// ==================== HELPER FUNCTIONS ====================

function isValidMove(
  state: CheckersState,
  sessionId: string,
  from: number,
  to: number
): boolean {
  // 1. Check piece ownership
  const piece = state.board[from];
  const player = state.players.get(sessionId)!;
  const isBlack = player.playerIndex === 0;
  const ownsFrom = isBlack ? (piece === 1 || piece === 3) : (piece === 2 || piece === 4);
  
  if (!ownsFrom) return false;
  
  // 2. Check destination is empty
  if (state.board[to] !== 0) return false;
  
  // 3. Check diagonal movement
  const fromRow = Math.floor(from / 8);
  const fromCol = from % 8;
  const toRow = Math.floor(to / 8);
  const toCol = to % 8;
  
  const rowDiff = toRow - fromRow;
  const colDiff = Math.abs(toCol - fromCol);
  
  // Must move diagonally
  if (Math.abs(rowDiff) !== colDiff) return false;
  
  const isKing = piece === 3 || piece === 4;
  
  // 4. Check direction (non-kings can only move forward)
  if (!isKing) {
    if (isBlack && rowDiff < 0) return false; // Black moves down
    if (!isBlack && rowDiff > 0) return false; // Red moves up
  }
  
  // 5. Regular move (one square) or capture (two squares)
  if (Math.abs(rowDiff) === 1) {
    // Regular move
    // Must check if captures are available (forced jump rule)
    if (hasValidCaptures(state, from)) {
      return false; // Must capture instead
    }
    return true;
  } else if (Math.abs(rowDiff) === 2) {
    // Capture move
    const midRow = (fromRow + toRow) / 2;
    const midCol = (fromCol + toCol) / 2;
    const midIndex = midRow * 8 + midCol;
    const midPiece = state.board[midIndex];
    
    // Must jump over opponent piece
    const isOpponent = isBlack
      ? (midPiece === 2 || midPiece === 4)
      : (midPiece === 1 || midPiece === 3);
    
    return isOpponent;
  }
  
  return false;
}

function hasValidCaptures(state: CheckersState, from: number): boolean {
  const piece = state.board[from];
  if (piece === 0) return false;
  
  const row = Math.floor(from / 8);
  const col = from % 8;
  const isKing = piece === 3 || piece === 4;
  
  const directions = isKing
    ? [[-2, -2], [-2, 2], [2, -2], [2, 2]] // All directions for kings
    : piece === 1 || piece === 3
    ? [[2, -2], [2, 2]] // Black forward
    : [[-2, -2], [-2, 2]]; // Red forward
  
  for (const [dRow, dCol] of directions) {
    const toRow = row + dRow;
    const toCol = col + dCol;
    
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) continue;
    
    const to = toRow * 8 + toCol;
    const midRow = row + dRow / 2;
    const midCol = col + dCol / 2;
    const mid = midRow * 8 + midCol;
    
    const isBlack = piece === 1 || piece === 3;
    const midPiece = state.board[mid];
    const destEmpty = state.board[to] === 0;
    
    const isOpponent = isBlack
      ? (midPiece === 2 || midPiece === 4)
      : (midPiece === 1 || midPiece === 3);
    
    if (destEmpty && isOpponent) {
      return true;
    }
  }
  
  return false;
}
```

---

## 8. Integration with GameRoom

### 8.1 Plugin Registry

```typescript
// server/src/plugins/registry.ts

import { GamePlugin } from "./types";
import { CheckersPlugin } from "./checkers";
import { BackgammonPlugin } from "./backgammon";
// ... import other plugins

const PLUGIN_REGISTRY = new Map<string, GamePlugin>([
  ["checkers", CheckersPlugin],
  ["backgammon", BackgammonPlugin],
  // ... register other plugins
]);

export function getPlugin(gameType: string): GamePlugin | undefined {
  return PLUGIN_REGISTRY.get(gameType);
}

export function listAvailableGames(): GameMetadata[] {
  return Array.from(PLUGIN_REGISTRY.values()).map((plugin) => ({
    id: plugin.id,
    name: plugin.name,
    ...plugin.metadata,
  }));
}
```

### 8.2 Modified GameRoom

```typescript
// server/src/rooms/GameRoom.ts

import { Room, Client } from "colyseus";
import { getPlugin } from "../plugins/registry";
import type { GamePlugin } from "../plugins/types";

interface GameRoomOptions {
  gameId?: string;
  gameType: string; // "checkers", "risk", etc.
  maxPlayers?: number;
  variant?: string;
}

export class GameRoom extends Room {
  private gamePlugin!: GamePlugin;
  private turnManager!: TurnManager;
  
  override onCreate(options: GameRoomOptions) {
    // Load the game plugin
    const plugin = getPlugin(options.gameType);
    if (!plugin) {
      throw new Error(`Unknown game type: ${options.gameType}`);
    }
    
    this.gamePlugin = plugin;
    this.maxClients = options.maxPlayers ?? plugin.metadata.playerCount[1];
    
    // Create game state via plugin
    const state = plugin.createState();
    state.gameId = options.gameId ?? crypto.randomUUID();
    state.gameType = options.gameType;
    this.setState(state);
    
    // Initialize turn manager
    this.turnManager = new TurnManager(plugin.turnConfig);
    
    // Call plugin lifecycle hook
    plugin.lifecycle.onCreate?.(state, options);
    
    // Register action handlers
    for (const [actionType, handler] of Object.entries(plugin.actions)) {
      this.onMessage(actionType, (client, payload) => {
        this.handleAction(client, actionType, payload, handler);
      });
    }
    
    // Set up tick interval if plugin needs it
    if (plugin.lifecycle.onTick) {
      this.setSimulationInterval((deltaTime) => {
        plugin.lifecycle.onTick!(this.state, deltaTime);
      }, 1000 / TICK_RATE);
    }
    
    console.log(`[GameRoom] Created ${plugin.name} game`);
  }
  
  override onJoin(client: Client) {
    const playerIndex = this.state.players.size;
    
    const player = new GamePlayer();
    player.sessionId = client.sessionId;
    player.displayName = `Player ${playerIndex + 1}`;
    player.playerIndex = playerIndex;
    
    this.state.players.set(client.sessionId, player);
    
    this.gamePlugin.lifecycle.onPlayerJoin?.(this.state, client, playerIndex);
    
    // Start game when all players joined
    const [minPlayers, maxPlayers] = this.gamePlugin.metadata.playerCount;
    if (this.state.players.size >= minPlayers) {
      this.gamePlugin.lifecycle.onGameStart(this.state);
    }
  }
  
  override onLeave(client: Client, consented: boolean) {
    this.gamePlugin.lifecycle.onPlayerLeave?.(this.state, client.sessionId);
  }
  
  private handleAction(
    client: Client,
    actionType: string,
    payload: unknown,
    handler: ActionHandler
  ) {
    // Validate action
    const isValid = this.gamePlugin.conditions.validateAction(
      this.state,
      client,
      actionType,
      payload
    );
    
    if (!isValid) {
      client.send("error", { message: "Invalid action" });
      return;
    }
    
    // Execute action
    const result = handler(this.state, client, payload);
    
    if (!result.success) {
      client.send("error", { message: result.error ?? "Action failed" });
      return;
    }
    
    // Broadcast state update (with filtering if needed)
    if (this.gamePlugin.stateFilter) {
      this.broadcastFilteredState();
    }
    // Otherwise Colyseus auto-syncs
    
    // Advance turn if action ends turn
    if (result.endsTurn) {
      this.state.currentTurnPlayer = this.turnManager.nextTurn(this.state);
      this.state.turnNumber++;
    }
    
    // Check for game end
    const gameResult = this.gamePlugin.conditions.checkGameEnd(this.state);
    if (gameResult) {
      this.state.status = "ended";
      this.gamePlugin.lifecycle.onGameEnd?.(this.state, gameResult);
      this.broadcast("game-end", gameResult);
    }
  }
  
  private broadcastFilteredState() {
    for (const client of this.clients) {
      const filtered = this.gamePlugin.stateFilter!.filterForClient(
        this.state,
        client.sessionId,
        false
      );
      client.send("state-update", filtered);
    }
  }
}
```

---

## 9. Client Integration Points

### 9.1 Game Renderer Interface

Each game needs a client-side renderer:

```typescript
// client/src/games/GameRenderer.ts

export interface GameRenderer {
  /**
   * Initialize the game view (create PixiJS containers, sprites, etc.)
   */
  init(container: Container): void;
  
  /**
   * Update the view based on new state from server
   */
  updateState(state: Schema): void;
  
  /**
   * Handle player input (clicks, drags)
   * Returns the action to send to server
   */
  onPlayerInput(event: InteractionEvent): GameAction | null;
  
  /**
   * Clean up resources when game ends
   */
  dispose(): void;
}
```

### 9.2 Example: Checkers Client Renderer

```typescript
// client/src/games/CheckersRenderer.ts

import * as PIXI from "pixi.js";
import type { GameRenderer, CheckersState } from "./types";

export class CheckersRenderer implements GameRenderer {
  private board!: PIXI.Container;
  private pieces: PIXI.Graphics[] = [];
  private selectedPiece: number | null = null;
  
  init(container: PIXI.Container) {
    this.board = new PIXI.Container();
    container.addChild(this.board);
    
    // Draw 8x8 checkerboard
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = new PIXI.Graphics();
        const color = (row + col) % 2 === 0 ? 0xF0D9B5 : 0xB58863;
        square.beginFill(color);
        square.drawRect(col * 64, row * 64, 64, 64);
        square.endFill();
        square.interactive = true;
        square.on("pointerdown", () => this.onCellClick(row, col));
        this.board.addChild(square);
      }
    }
  }
  
  updateState(state: CheckersState) {
    // Clear old pieces
    for (const piece of this.pieces) {
      piece.destroy();
    }
    this.pieces = [];
    
    // Render pieces from state
    for (let i = 0; i < 64; i++) {
      const pieceType = state.board[i];
      if (pieceType === 0) continue;
      
      const row = Math.floor(i / 8);
      const col = i % 8;
      
      const piece = new PIXI.Graphics();
      const color = pieceType === 1 || pieceType === 3 ? 0x333333 : 0xCC0000;
      piece.beginFill(color);
      piece.drawCircle(col * 64 + 32, row * 64 + 32, 24);
      piece.endFill();
      
      // Draw crown for kings
      if (pieceType === 3 || pieceType === 4) {
        piece.lineStyle(2, 0xFFD700);
        piece.drawStar(col * 64 + 32, row * 64 + 32, 5, 12);
      }
      
      piece.interactive = true;
      piece.on("pointerdown", () => this.onPieceClick(i));
      
      this.board.addChild(piece);
      this.pieces.push(piece);
    }
  }
  
  onPieceClick(index: number) {
    if (this.selectedPiece === null) {
      this.selectedPiece = index;
      // Highlight selected piece
    } else {
      // Attempt move
      const action = { type: "move", from: this.selectedPiece, to: index };
      this.selectedPiece = null;
      return action;
    }
  }
  
  onCellClick(row: number, col: number) {
    const index = row * 8 + col;
    if (this.selectedPiece !== null) {
      const action = { type: "move", from: this.selectedPiece, to: index };
      this.selectedPiece = null;
      return action;
    }
  }
  
  dispose() {
    this.board.destroy({ children: true });
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

Each plugin should have comprehensive unit tests:

```typescript
// server/src/plugins/__tests__/checkers.test.ts

import { describe, it, expect } from "vitest";
import { CheckersPlugin } from "../checkers";

describe("CheckersPlugin", () => {
  it("should initialize board correctly", () => {
    const state = CheckersPlugin.createState();
    CheckersPlugin.lifecycle.onCreate(state, {});
    
    // Check black pieces in rows 0-2
    expect(state.board[1]).toBe(1);
    expect(state.board[3]).toBe(1);
    
    // Check red pieces in rows 5-7
    expect(state.board[40]).toBe(2);
    expect(state.board[42]).toBe(2);
    
    // Check empty middle rows
    expect(state.board[24]).toBe(0);
  });
  
  it("should force jumps when available", () => {
    const state = CheckersPlugin.createState();
    // Set up a capture scenario
    state.board[18] = 1; // Black
    state.board[27] = 2; // Red (can be captured)
    state.board[36] = 0; // Empty landing
    
    const isValid = CheckersPlugin.conditions.validateAction(
      state,
      mockClient,
      "move",
      { from: 18, to: 27 } // Regular move when capture available
    );
    
    expect(isValid).toBe(false); // Should be invalid (must capture)
  });
});
```

### 10.2 Integration Tests

Test full game flows:

```typescript
describe("Checkers Game Flow", () => {
  it("should play a full game", async () => {
    const room = await colyseus.createRoom("game", { gameType: "checkers" });
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room);
    
    // ... simulate moves ...
    
    expect(room.state.status).toBe("ended");
  });
});
```

---

## 11. Performance Considerations

### 11.1 State Size Optimization

**Problem:** Large state objects (especially Risk with 42 territories) can slow down serialization.

**Solutions:**
- Use ArraySchema for homogeneous collections (faster than MapSchema)
- Limit string lengths (IDs, names)
- Compress boolean flags into bitmasks if needed
- Consider delta compression for very large states

### 11.2 Action Validation Performance

**Problem:** Complex validation (e.g., pathfinding in Risk fortify) can block the event loop.

**Solutions:**
- Cache valid move lists when state changes
- Use memoization for expensive checks
- Offload to worker threads for very complex games

### 11.3 Broadcasting Filtered States

**Problem:** Manually broadcasting to each client is slower than Colyseus auto-sync.

**Solutions:**
- Only use state filtering when truly necessary (card games)
- Filter at the field level, not by recreating entire objects
- Consider separate "public" and "private" state schemas

---

## 12. Future Enhancements

### 12.1 AI Opponents

Add `AIPlayer` interface for bots:

```typescript
interface AIPlayer {
  selectAction(state: Schema): GameAction;
}
```

### 12.2 Replay System

Store all actions in sequence for replay:

```typescript
interface ActionLog {
  turnNumber: number;
  timestamp: number;
  sessionId: string;
  actionType: string;
  payload: unknown;
}
```

### 12.3 Tournament Mode

Support multi-game tournaments with bracket progression.

### 12.4 Custom Rule Variants

Allow plugins to define rule variants (e.g., "International Checkers" vs "American Checkers").

---

## 13. Open Questions & Decisions Needed

1. **Spectator Experience:** Should spectators see all hands in card games, or only revealed cards?
   - **Recommendation:** Only revealed cards (preserves suspense).

2. **Reconnection Handling:** How long to wait for disconnected players?
   - **Recommendation:** 60 seconds, then forfeit/bot takeover.

3. **Undo/Redo:** Should players be able to undo moves?
   - **Recommendation:** No for competitive play. Maybe for casual mode.

4. **Time Controls:** Fast/Standard/No limit?
   - **Recommendation:** Per-game configurable (30s/60s/none).

5. **Mobile Support:** Touch-optimized controls?
   - **Recommendation:** Phase 2 after desktop MVP.

---

## Conclusion

This architecture provides:

✅ **Type-safe** plugin system with clear interfaces  
✅ **Hidden information** handling for card games  
✅ **Phased turn management** for complex games like Risk  
✅ **Extensibility** — new games are self-contained modules  
✅ **Clear implementation path** — start simple (Checkers), build up to complex (Risk)

The estimated timeline for full library implementation is **11-12 weeks** with one developer, assuming 2-5 days per game plus 1 week for core infrastructure.

**Next Steps:**
1. Review and approve this design
2. Begin Phase 1: Core plugin system implementation
3. Build Checkers as the proof-of-concept
4. Iterate on architecture based on real implementation feedback

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-14  
**Author:** Pemulis, Systems Dev

# Skill: Implementing Colyseus Game Plugins

**Context:** playgrid project uses a plugin-based architecture where each game implements the `IGamePlugin` interface and integrates with `BaseGameRoom`.

**When to use:** Adding any new game type to the playgrid system (board games, card games, strategy games).

## Architecture Pattern

### 1. State Schema (shared/src/games/{game}/GameState.ts)

```typescript
import { Schema, MapSchema, ArraySchema, defineTypes } from "@colyseus/schema";
import { BaseGameState } from "../../BaseGameState.js";

// Custom nested schemas must extend Schema
export class CustomPiece extends Schema {
  declare field: string;
  constructor() {
    super();
    this.field = "";
  }
}
defineTypes(CustomPiece, { field: "string" });

// Main game state extends BaseGameState
export class GameState extends BaseGameState {
  declare board: ArraySchema<number>;
  declare pieces: MapSchema<CustomPiece>;
  declare customField: string;

  constructor() {
    super();
    this.board = new ArraySchema<number>();
    this.pieces = new MapSchema<CustomPiece>();
    this.customField = "";
  }
}

defineTypes(GameState, {
  board: ["number"],
  pieces: { map: CustomPiece },
  customField: "string",
});
```

**Key rules:**
- Extend `BaseGameState` (provides players, phase, currentTurn, turnNumber)
- All nested classes must extend `Schema` and be defined with `defineTypes()`
- Use `MapSchema` for keyed collections, `ArraySchema` for ordered lists
- Initialize all fields in constructor

### 2. Game Logic (server/src/games/{game}/gameLogic.ts)

```typescript
import type { GameState } from "@eschaton/shared";

// Pure functions only - no state mutation in logic layer
export function isValidMove(board: number[], from: number, to: number): boolean {
  // Validate move
  return true;
}

export function applyMove(board: number[], from: number, to: number): { board: number[] } {
  const newBoard = [...board];
  // Apply move to copy
  return { board: newBoard };
}

export function checkWinCondition(state: GameState): string | null {
  // Return winnerId or null
  return null;
}
```

**Key rules:**
- Pure functions for testability
- Take state as input, return new data (or mutate via plugin actions)
- Logic layer should work without Colyseus/Colyseus types

### 3. Game Plugin (server/src/games/{game}/GamePlugin.ts)

```typescript
import type { Client } from "colyseus";
import {
  GameState,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
} from "@eschaton/shared";
import { isValidMove, applyMove, checkWinCondition } from "./gameLogic.js";

type MovePayload = {
  from: number;
  to: number;
};

function isMovePayload(payload: unknown): payload is MovePayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return Number.isInteger(candidate.from) && Number.isInteger(candidate.to);
}

export const gamePlugin: GamePlugin<GameState> = {
  id: "mygame",
  name: "My Game",
  metadata: {
    playerCount: [2, 4],
    estimatedDuration: 30,
    complexity: 3,
    description: "A fun game",
    hasHiddenInformation: false,
  },
  createState() {
    return new GameState();
  },
  turnConfig: {
    mode: "sequential", // or "simultaneous" or "phased"
    turnOrder: { type: "round-robin" }, // or { type: "random" }
    allowPass: false,
    turnTimeLimit: 60, // seconds, optional
  },
  lifecycle: {
    onPlayerJoin(state, client, playerIndex) {
      // Initialize player-specific state
    },
    onGameStart(state) {
      // Initialize game board, deal cards, etc.
    },
    onGameEnd(state, result) {
      // Cleanup if needed
    },
  },
  actions: {
    move(state, client, payload): ActionResult {
      if (!isMovePayload(payload)) {
        return { success: false, error: "Invalid payload." };
      }

      // Validate move
      if (!isValidMove(state.board, payload.from, payload.to)) {
        return { success: false, error: "Invalid move." };
      }

      // Apply move (mutate state directly)
      const result = applyMove(Array.from(state.board), payload.from, payload.to);
      for (const [i, val] of result.board.entries()) {
        state.board[i] = val;
      }

      // Check for game end
      const winnerId = checkWinCondition(state);
      return {
        success: true,
        endsTurn: true,
        endsGame: winnerId !== null,
      };
    },
  },
  conditions: {
    checkGameEnd(state) {
      const winnerId = checkWinCondition(state);
      if (!winnerId) return null;

      const players = Array.from(state.players.values()).filter((p) => !p.isSpectator);
      return {
        type: "win",
        winnerId,
        scores: Object.fromEntries(
          players.map((p) => [p.sessionId, p.sessionId === winnerId ? 1 : 0]),
        ),
      };
    },
    validateAction(state, client, actionType, payload) {
      // Check current turn
      if (state.currentTurn !== client.sessionId) {
        return false;
      }

      // Validate action type and payload
      if (actionType === "move") {
        return isMovePayload(payload);
      }

      return false;
    },
  },
};
```

**Key patterns:**
- Type guards for payloads (`isMovePayload`)
- Mutate state directly in action handlers (Colyseus will sync changes)
- Return `ActionResult` with success/error/endsTurn/endsGame flags
- `validateAction` checks turn ownership and payload structure
- `checkGameEnd` builds proper GameResult with scores for all players

### 4. Registration (server/src/index.ts)

```typescript
import { gameRegistry } from "./game/GameRegistry.js";
import { gamePlugin } from "./games/mygame/index.js";

gameRegistry.register(gamePlugin);
```

### 5. Export from shared (shared/src/index.ts)

```typescript
export * from "./games/mygame/index.js";
```

## Common Patterns

### Multi-phase turns (like Risk)

```typescript
turnConfig: {
  mode: "phased",
  turnOrder: { type: "round-robin" },
  allowPass: false,
  phases: [
    { id: "phase1", name: "Phase 1", allowedActions: ["action1"], optional: false },
    { id: "phase2", name: "Phase 2", allowedActions: ["action2", "skip"], optional: true },
  ],
}
```

Then in actions, check `state.turnPhase` and transition manually:

```typescript
if (state.turnPhase === "phase1") {
  state.turnPhase = "phase2";
}
```

### Random initial state

```typescript
lifecycle: {
  onGameStart(state) {
    const shuffled = shuffleArray([...items]);
    // distribute to players...
  },
}
```

### Setup phase before main game

```typescript
// Add to state:
declare gamePhase: "setup" | "playing";

// In lifecycle:
onGameStart(state) {
  state.gamePhase = "setup";
  // ... setup logic
}

// In an action:
if (setupComplete) {
  state.gamePhase = "playing";
}
```

### Hidden information (card games)

```typescript
// Store full info server-side in state
declare hands: MapSchema<ArraySchema<number>>;

// Add stateFilter to plugin:
stateFilter: {
  filterForClient(state, sessionId, isSpectator) {
    // Return filtered view - hide other players' cards
    // (Not implemented in BaseGameRoom yet, but defined in interface)
  },
}
```

## Testing

Create `__tests__/gamePlugin.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { gamePlugin } from "../GamePlugin.js";

describe("Game Plugin", () => {
  it("initializes state", () => {
    const state = gamePlugin.createState();
    expect(state).toBeDefined();
  });

  it("validates actions", () => {
    const state = gamePlugin.createState();
    state.currentTurn = "player1";
    const client = { sessionId: "player1" } as any;
    
    const valid = gamePlugin.conditions.validateAction(
      state,
      client,
      "move",
      { from: 0, to: 1 },
    );
    expect(valid).toBe(true);
  });
});
```

## Checklist

When implementing a new game plugin:

- [ ] Create state schema in `shared/src/games/{game}/GameState.ts`
- [ ] Export from `shared/src/games/{game}/index.ts`
- [ ] Add export to `shared/src/index.ts`
- [ ] Create pure logic functions in `server/src/games/{game}/gameLogic.ts`
- [ ] Implement plugin in `server/src/games/{game}/GamePlugin.ts`
- [ ] Export plugin from `server/src/games/{game}/index.ts`
- [ ] Register in `server/src/index.ts`
- [ ] Write tests in `server/src/games/{game}/__tests__/`
- [ ] Run `npm run build` to verify compilation
- [ ] Commit with reference to issue number

## References

- Checkers: Simple sequential game, single action type
- Backgammon: Dice rolling, bar/bearing off mechanics
- Risk: Multi-phase turns, complex state, card mechanics

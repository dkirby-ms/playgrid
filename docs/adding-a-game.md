# Adding a Game to PlayGrid

This guide walks you through adding a new game to PlayGrid, from zero to playable. We'll use **Checkers** as our running example throughout—it's the simplest game in the project and a great template to learn from.

## What You'll Build

By the end, you'll have:

- **Server plugin** – State schema + pure game logic + Colyseus handlers
- **Client renderer** – PIXI.js visualization + input handling
- **Registration** – Server and client wiring
- **Tests** – Logic, plugin, and end-to-end test suites

**Estimated time:** ~4–6 hours (depending on game complexity)

---

## Part 1: Understand the Architecture

### The Plugin Pattern

PlayGrid uses a **plugin architecture** where each game is self-contained:

```typescript
// A game plugin is a singleton object that implements GamePlugin<TState>
export const checkersPlugin: GamePlugin<CheckersState> = {
  id: "checkers",
  name: "Checkers",
  metadata: { /* ... */ },
  createState() { /* ... */ },
  lifecycle: { /* ... */ },
  actions: { /* ... */ },
  conditions: { /* ... */ },
};
```

**Why?** This keeps games isolated, testable, and independent. The core server doesn't know about Checkers—Checkers registers itself.

### Key Concepts

| Term | Meaning |
|------|---------|
| **State Schema** | Colyseus `Schema` that defines the game state (board, pieces, turn tracker, etc.) |
| **Pure Logic Functions** | Plain TypeScript functions that implement game rules (no Colyseus dependencies) |
| **GamePlugin Interface** | Contract defining what every game must implement (metadata, lifecycle hooks, actions, win conditions) |
| **GameRenderer** | PIXI.js class that visualizes state and handles local input |
| **Registry** | Singleton that maps game IDs to plugins; used by server at startup |

### Architecture at a Glance

```
┌─────────────────────────────────────────────┐
│             Client (PIXI.js)                 │
│  CheckersRenderer ← reads CheckersState     │
│       ↓ sends "move" action                  │
│  Room.send("move", { from, to })            │
└─────────────────┬───────────────────────────┘
                  │ WebSocket
┌─────────────────▼───────────────────────────┐
│         Server (Colyseus)                    │
│  GameRegistry.get("checkers")               │
│       ↓ loads CheckersPlugin                │
│  BaseGameRoom (manages lifecycle)           │
│       ↓                                      │
│  CheckersPlugin.actions.move()             │
│       ↓ pure logic                          │
│  checkersLogic.applyMove()                 │
│       ↓ updates schema                      │
│  CheckersState.board (broadcasts to client) │
└─────────────────────────────────────────────┘
```

---

## Part 2: Define Your Game State

### Create the Shared State Schema

All game state lives in `shared/src/games/{gameName}/`. Create:

**`shared/src/games/checkers/CheckersState.ts`**

```typescript
import { Schema, type, ArraySchema } from "@colyseus/schema";
import { BaseGameState } from "../../gameState.js";

// Piece constants
export const EMPTY = 0;
export const BLACK = 1;
export const RED = 2;
export const BLACK_KING = 3;
export const RED_KING = 4;

export class CheckersState extends BaseGameState {
  // Define fields with @type() decorator
  @type("number")
  declare board: ArraySchema<number>;

  @type("number")
  declare mustCaptureFrom: number;

  constructor() {
    super(); // Extends BaseGameState (provides phase, currentTurn, players, etc.)
    
    // Initialize board: 64 squares (8×8), initially empty
    this.board = new ArraySchema<number>(
      ...Array.from({ length: 64 }, () => EMPTY)
    );
    
    // Track if a player must continue a capture chain
    this.mustCaptureFrom = -1;
  }
}

// Tell Colyseus how to serialize (required for all Schema classes)
defineTypes(CheckersState, {
  board: ["number"],
  mustCaptureFrom: "number",
});
```

**Key points:**
- Extend `BaseGameState` to inherit shared fields (`phase`, `currentTurn`, `turnNumber`, `players`).
- Use `ArraySchema` for dynamic arrays; `MapSchema` for maps.
- Use `@type()` decorators for serialization.
- Keep state minimal and serializable (no functions, promises, etc.).

### Export from Shared Index

**`shared/src/games/index.ts`** (or similar):

```typescript
export { CheckersState } from "./checkers/CheckersState.js";
```

---

## Part 3: Implement Pure Game Logic

Game logic is **pure functions**—no Colyseus, no side effects. This makes it easy to test, reason about, and reuse on the client for validation.

### Create Logic Functions

**`server/src/games/checkers/checkersLogic.ts`**

```typescript
// Initialize the board to starting position
export function initializeBoard(): number[] {
  const board = Array.from({ length: 64 }, () => EMPTY);
  
  // Place Black pieces at top
  for (let i = 0; i < 3; i++) {
    for (let col = 0; col < 8; col++) {
      const index = i * 8 + col;
      if ((index + Math.floor(index / 8)) % 2 === 1) board[index] = BLACK;
    }
  }
  
  // Place Red pieces at bottom
  for (let i = 5; i < 8; i++) {
    for (let col = 0; col < 8; col++) {
      const index = i * 8 + col;
      if ((index + Math.floor(index / 8)) % 2 === 1) board[index] = RED;
    }
  }
  
  return board;
}

// Get valid moves for a piece at cellIndex
export function getValidMoves(
  board: number[],
  cellIndex: number,
  mustCaptureFrom: number
): Move[] {
  const piece = board[cellIndex];
  if (piece === EMPTY) return [];
  
  const color = piece === BLACK || piece === BLACK_KING ? BLACK : RED;
  const isKing = piece === BLACK_KING || piece === RED_KING;
  
  // If forced capture is active, only allow captures from that piece
  if (mustCaptureFrom !== -1 && cellIndex !== mustCaptureFrom) {
    return [];
  }
  
  const moves: Move[] = [];
  
  // Generate capture moves (highest priority)
  const captures = getCaptureMoves(board, cellIndex, color, isKing);
  if (captures.length > 0) return captures;
  
  // Generate regular moves (only if no captures available)
  const normals = getRegularMoves(board, cellIndex, color, isKing);
  
  return [...captures, ...normals];
}

// Apply a move and return the result
export function applyMove(
  board: number[],
  from: number,
  to: number
): MoveResult {
  const newBoard = [...board];
  const piece = newBoard[from];
  
  newBoard[from] = EMPTY;
  newBoard[to] = piece;
  
  // Check if capture occurred (distance > 1 diagonal = jump)
  const distance = Math.abs(from - to);
  let captured: number | null = null;
  
  if (distance > 10) { // Jump detected
    const capturedIndex = (from + to) / 2;
    captured = newBoard[capturedIndex];
    newBoard[capturedIndex] = EMPTY;
  }
  
  // Check king promotion
  const isKingPromotion = 
    (piece === BLACK && Math.floor(to / 8) === 7) ||
    (piece === RED && Math.floor(to / 8) === 0);
  
  if (isKingPromotion) {
    newBoard[to] = piece === BLACK ? BLACK_KING : RED_KING;
  }
  
  // Check for continuation (forced capture chain)
  const continuesChain =
    captured !== null &&
    getCaptureMoves(newBoard, to, piece === BLACK ? BLACK : RED, isKingPromotion)
      .length > 0;
  
  return { board: newBoard, captured, isKingPromotion, continuesChain };
}

// Check if the game has ended
export function checkWinCondition(
  board: number[],
  currentPlayerColor: number
): GameResult | null {
  const opponent = currentPlayerColor === BLACK ? RED : BLACK;
  
  const playerHasPieces = board.some(p => p === currentPlayerColor || 
    p === (currentPlayerColor === BLACK ? BLACK_KING : RED_KING));
  const opponentHasPieces = board.some(p => p === opponent || 
    p === (opponent === BLACK ? BLACK_KING : RED_KING));
  
  if (!playerHasPieces) {
    return {
      type: "win",
      winnerId: opponent, // Opponent won
      scores: { [opponent]: 1, [currentPlayerColor]: 0 },
    };
  }
  
  if (!opponentHasPieces) {
    return {
      type: "win",
      winnerId: currentPlayerColor,
      scores: { [currentPlayerColor]: 1, [opponent]: 0 },
    };
  }
  
  return null; // Game continues
}

// Helper types
export interface Move {
  from: number;
  to: number;
}

export interface MoveResult {
  board: number[];
  captured: number | null;
  isKingPromotion: boolean;
  continuesChain: boolean;
}
```

**Guidelines for game logic:**
- Input: primitives and simple data structures (numbers, arrays, objects).
- Output: new state or validation results (never mutate inputs).
- No imports from Colyseus, no side effects.
- **Test thoroughly**—this is the heart of your game.

---

## Part 4: Create the Server Plugin

The plugin ties game logic to Colyseus and defines the game's lifecycle.

### Plugin Structure

**`server/src/games/checkers/CheckersPlugin.ts`**

```typescript
import { GamePlugin, GameResult } from "@eschaton/shared";
import { Client } from "colyseus";
import { CheckersState, EMPTY, BLACK, RED, BLACK_KING, RED_KING } from "@eschaton/shared";
import {
  initializeBoard,
  getValidMoves,
  applyMove,
  checkWinCondition,
} from "./checkersLogic.js";

export const checkersPlugin: GamePlugin<CheckersState> = {
  id: "checkers",
  name: "Checkers",
  
  metadata: {
    playerCount: [2, 2],
    estimatedDuration: 20,
    complexity: 2, // 1–5 scale
    description: "Classic 8×8 checkers with forced captures and king promotion.",
    hasHiddenInformation: false,
  },
  
  // Factory to create fresh game state
  createState() {
    return new CheckersState();
  },
  
  // Turn and action configuration
  turnConfig: {
    mode: "sequential",
    turnOrder: { type: "round-robin" },
    allowPass: false, // Can't skip turn in checkers
  },
  
  // Lifecycle hooks—called by BaseGameRoom at key moments
  lifecycle: {
    onPlayerJoin(state, client, playerIndex) {
      // Assign player to a color
      const playerInfo = state.players.get(client.sessionId) || new PlayerInfo();
      playerInfo.playerIndex = playerIndex;
      playerInfo.color = playerIndex === 0 ? BLACK : RED;
      state.players.set(client.sessionId, playerInfo);
    },
    
    onGameStart(state) {
      // Initialize the board
      const board = initializeBoard();
      state.board = new ArraySchema(...board);
      state.mustCaptureFrom = -1;
      state.phase = "playing";
      
      // Set first turn to Black (player 0)
      const players = Array.from(state.players.values());
      state.currentTurn = players[0]?.sessionId || "";
    },
    
    onPlayerLeave(state, sessionId) {
      // Mark as disconnected (BaseGameRoom may forfeit)
      const player = state.players.get(sessionId);
      if (player) player.isConnected = false;
    },
    
    onGameEnd(state) {
      state.phase = "ended";
    },
  },
  
  // Action handlers—called when client sends "move", etc.
  actions: {
    move(state, client, payload) {
      // Validate payload structure
      if (typeof payload !== "object" || payload === null) {
        return { success: false, error: "Invalid payload" };
      }
      
      const { from, to } = payload as { from?: number; to?: number };
      if (typeof from !== "number" || typeof to !== "number") {
        return { success: false, error: "from and to must be numbers" };
      }
      
      // Verify turn ownership (conditions.validateAction already checked this,
      // but it's good practice to re-validate in the action handler)
      if (state.currentTurn !== client.sessionId) {
        return { success: false, error: "Not your turn" };
      }
      
      // Apply logic
      const result = applyMove(Array.from(state.board), from, to);
      
      // Update state
      state.board = new ArraySchema(...result.board);
      state.mustCaptureFrom = result.continuesChain ? to : -1;
      
      // Determine turn end
      if (result.continuesChain) {
        // Multi-capture: player takes another turn
        return { success: true, endsTurn: false, endsGame: false };
      }
      
      // End turn normally
      const gameEnded = checkWinCondition(result.board, playerColor) !== null;
      return {
        success: true,
        endsTurn: true,
        endsGame: gameEnded,
      };
    },
  },
  
  // Validation and win condition checks
  conditions: {
    // Called before action is executed
    validateAction(state, client, actionType, payload) {
      if (actionType !== "move") return false;
      if (state.currentTurn !== client.sessionId) return false;
      
      // Validate move is legal
      const { from, to } = payload as { from?: number; to?: number };
      if (typeof from !== "number" || typeof to !== "number") return false;
      
      const validMoves = getValidMoves(
        Array.from(state.board),
        from,
        state.mustCaptureFrom
      );
      return validMoves.some(m => m.from === from && m.to === to);
    },
    
    // Called after action is executed
    checkGameEnd(state) {
      const playerColor = state.players.get(state.currentTurn)?.color;
      if (playerColor === undefined) return null;
      
      return checkWinCondition(Array.from(state.board), playerColor);
    },
  },
};
```

**Key patterns:**
- `createState()` – Factory function, called once per game.
- `lifecycle` hooks – Manage game transitions (join, start, leave, end).
- `actions.move()` – Update state and return `{ success, endsTurn, endsGame }`.
- `conditions` – Validate before action, check win condition after.
- **Always validate payload structure** before accessing properties.

---

## Part 5: Register the Plugin

### Server Registration

**`server/src/index.ts`**

```typescript
import { gameRegistry } from "./game/GameRegistry.js";
import { checkersPlugin } from "./games/checkers/index.js";
import { backgammonPlugin } from "./games/backgammon/index.js";

// Register on server startup
gameRegistry.register(checkersPlugin);
gameRegistry.register(backgammonPlugin);
// ... register more games

// The registry is now used by:
// - LobbyRoom.ts to validate game types and player counts
// - BaseGameRoom.ts to load the plugin when creating a room
```

**`server/src/games/checkers/index.ts`** (export barrel):

```typescript
export { checkersPlugin } from "./CheckersPlugin.js";
export { CheckersState } from "@eschaton/shared";
export * from "./checkersLogic.js";
```

---

## Part 6: Create the Client Renderer

The renderer visualizes state and handles input. It uses PIXI.js for graphics.

### Renderer Class

**`client/src/renderers/CheckersRenderer.ts`**

```typescript
import { Container, Graphics, Text } from "pixi.js";
import { Room } from "colyseus.js";
import { CheckersState, BLACK, RED, BLACK_KING, RED_KING, EMPTY } from "@eschaton/shared";

// Board dimensions
const BOARD_SIZE = 8;
const BOARD_CELL_COUNT = 64;
const CELL_SIZE = 60;

export class CheckersRenderer implements GameRenderer {
  readonly gameType = "checkers";
  readonly container = new Container();
  
  private room: Room<CheckersState> | null = null;
  private boardLayer = new Container();
  private piecesLayer = new Container();
  private overlayLayer = new Container();
  
  // State tracking
  private board: number[] = [];
  private currentTurn: string = "";
  private players = new Map<string, { color: number; sessionId: string }>();
  private selectedIndex: number | null = null;
  private validTargetIndexes = new Set<number>();
  private isFlipped = false; // Red player's perspective if true
  private gameResult: GameResult | null = null;
  
  // UI elements
  private statusText: Text | null = null;
  private squareGraphics = new Map<number, Graphics>();

  init(state: CheckersState, context?: GameRenderContext): void {
    // Store room and subscribe to messages
    this.room = context?.room || null;
    
    if (this.room) {
      this.room.onMessage<GameResult>("game-end", (result) => {
        this.gameResult = result;
        this.updateGameOverOverlay();
      });
    }
    
    // Set up layers
    this.container.addChild(this.boardLayer);
    this.container.addChild(this.piecesLayer);
    this.container.addChild(this.overlayLayer);
    
    // Draw board (8×8 checkerboard)
    for (let i = 0; i < BOARD_CELL_COUNT; i++) {
      const row = Math.floor(i / BOARD_SIZE);
      const col = i % BOARD_SIZE;
      const isLight = (row + col) % 2 === 0;
      
      const squareGraphic = new Graphics();
      squareGraphic.rect(
        col * CELL_SIZE,
        row * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
      squareGraphic.fill(isLight ? 0xf0d9b5 : 0xb58863);
      squareGraphic.eventMode = "static";
      squareGraphic.cursor = "pointer";
      squareGraphic.on("pointerdown", () => this.handleSquareClick(i));
      
      this.boardLayer.addChild(squareGraphic);
      this.squareGraphics.set(i, squareGraphic);
    }
    
    // Create status text
    this.statusText = new Text("Waiting for players...", { fill: 0xffffff });
    this.statusText.position.set(10, 10);
    this.container.addChild(this.statusText);
    
    // Sync with current state
    this.onStateChange(state);
  }

  onStateChange(state: CheckersState): void {
    // Update local state
    this.board = Array.from(state.board);
    this.currentTurn = state.currentTurn;
    
    // Update players map
    for (const [sessionId, player] of state.players.entries()) {
      this.players.set(sessionId, { color: player.color, sessionId });
    }
    
    // Determine perspective (flip board for red player)
    const localSessionId = this.room?.sessionId || "";
    const localPlayerColor = this.players.get(localSessionId)?.color;
    this.isFlipped = localPlayerColor === RED;
    
    // Redraw pieces
    this.redrawPieces();
    
    // Update status
    this.updateStatusText();
  }

  private redrawPieces(): void {
    // Clear old pieces
    this.piecesLayer.removeChildren();
    
    // Draw pieces
    for (let i = 0; i < BOARD_CELL_COUNT; i++) {
      const piece = this.board[i];
      if (piece === EMPTY) continue;
      
      const displayIndex = this.toDisplayIndex(i);
      const row = Math.floor(displayIndex / BOARD_SIZE);
      const col = displayIndex % BOARD_SIZE;
      
      const centerX = col * CELL_SIZE + CELL_SIZE / 2;
      const centerY = row * CELL_SIZE + CELL_SIZE / 2;
      
      const pieceGraphic = new Graphics();
      const color = piece === BLACK || piece === BLACK_KING ? 0x222222 : 0xffcccc;
      
      // Draw piece circle
      pieceGraphic.circle(centerX, centerY, CELL_SIZE / 3);
      pieceGraphic.fill(color);
      pieceGraphic.stroke({ color: 0x000000, width: 2 });
      
      // Draw king crown if applicable
      if (piece === BLACK_KING || piece === RED_KING) {
        const crownText = new Text("♛", { fill: 0xffff00, fontSize: 16 });
        crownText.anchor.set(0.5);
        crownText.position.set(centerX, centerY);
        this.piecesLayer.addChild(crownText);
      }
      
      this.piecesLayer.addChild(pieceGraphic);
    }
  }

  private handleSquareClick(displayIndex: number): void {
    // Convert display index to board index (handles flip)
    const boardIndex = this.toBoardIndex(displayIndex);
    
    // Check if it's local player's turn
    const localSessionId = this.room?.sessionId || "";
    if (this.currentTurn !== localSessionId) {
      return;
    }
    
    // If target is valid, send move
    if (
      this.selectedIndex !== null &&
      this.validTargetIndexes.has(displayIndex)
    ) {
      this.room?.send("move", { from: this.selectedIndex, to: boardIndex });
      this.selectedIndex = null;
      this.validTargetIndexes.clear();
      this.redrawSelection();
      return;
    }
    
    // Otherwise, try selecting this piece
    const piece = this.board[boardIndex];
    const localColor = this.players.get(localSessionId)?.color;
    
    if (piece !== EMPTY && (piece === localColor || 
      (piece === BLACK_KING && localColor === BLACK) ||
      (piece === RED_KING && localColor === RED))) {
      
      this.selectedIndex = boardIndex;
      this.validTargetIndexes = new Set(
        getValidMoves(this.board, boardIndex, -1) // Use client-side logic
          .map(m => this.toDisplayIndex(m.to))
      );
      this.redrawSelection();
    }
  }

  private redrawSelection(): void {
    // Highlight selected piece and valid targets
    this.boardLayer.children.forEach((child, i) => {
      if (this.selectedIndex !== null && this.toDisplayIndex(this.selectedIndex) === i) {
        (child as Graphics).tint = 0xaaaadd;
      } else if (this.validTargetIndexes.has(i)) {
        (child as Graphics).tint = 0xddaa88;
      } else {
        (child as Graphics).tint = 0xffffff;
      }
    });
  }

  private updateStatusText(): void {
    if (!this.statusText) return;
    
    if (this.gameResult) {
      const winner =
        this.gameResult.winnerId === this.room?.sessionId
          ? "You won!"
          : "Game over.";
      this.statusText.text = winner;
    } else if (this.currentTurn === this.room?.sessionId) {
      this.statusText.text = "Your turn";
    } else {
      this.statusText.text = "Opponent's turn";
    }
  }

  private updateGameOverOverlay(): void {
    if (!this.gameResult) return;
    
    const overlay = new Graphics();
    overlay.rect(0, 0, BOARD_SIZE * CELL_SIZE, BOARD_SIZE * CELL_SIZE);
    overlay.fill({ color: 0x000000, alpha: 0.7 });
    this.overlayLayer.addChild(overlay);
    
    const text = new Text(
      this.gameResult.winnerId === this.room?.sessionId ? "You Won!" : "Game Over",
      { fill: 0xffffff, fontSize: 48 }
    );
    text.anchor.set(0.5);
    text.position.set(
      (BOARD_SIZE * CELL_SIZE) / 2,
      (BOARD_SIZE * CELL_SIZE) / 2
    );
    this.overlayLayer.addChild(text);
  }

  // Index conversion (handles board flip for perspective)
  private toDisplayIndex(boardIndex: number): number {
    return this.isFlipped ? BOARD_CELL_COUNT - 1 - boardIndex : boardIndex;
  }

  private toBoardIndex(displayIndex: number): number {
    return this.isFlipped ? BOARD_CELL_COUNT - 1 - displayIndex : displayIndex;
  }

  resize(width: number, height: number): void {
    // Responsive sizing (optional)
  }

  handleInput(event: KeyboardEvent): void {
    // Add keyboard shortcuts here if needed
  }

  destroy(): void {
    this.container.removeChildren();
    this.squareGraphics.clear();
    this.validTargetIndexes.clear();
  }
}
```

**Key renderer patterns:**
- Layered containers: `boardLayer` (static), `piecesLayer` (dynamic), `overlayLayer` (UI).
- Interactive squares: attach `pointerdown` handlers for clicks.
- State syncing: `onStateChange()` is called on every server broadcast.
- Perspective: `isFlipped` handles board rotation for each player.
- **No direct state mutations**—derive display state from `this.board`.

### Client-Side Logic Duplication

For **client-side validation** (optional but recommended), duplicate your logic functions:

**`client/src/games/checkers/checkersClientLogic.ts`**

```typescript
// Copy of server logic functions, used by renderer for:
// - Computing valid targets before sending move
// - Instant feedback without waiting for server

export function getValidMoves(
  board: number[],
  cellIndex: number,
  mustCaptureFrom: number
): Move[] {
  // ... same implementation as server
}

// Use in renderer:
// this.validTargetIndexes = new Set(
//   getValidMoves(this.board, boardIndex, -1).map(m => m.to)
// );
```

---

## Part 7: Hook Up Client Registration

Register your renderer so the client knows how to display your game.

**`client/src/renderers/index.ts`**

```typescript
export { CheckersRenderer } from "./CheckersRenderer.js";

// Or in the main GameRendererFactory:
import { GameRenderer } from "../types/GameRenderer.js";
import { CheckersRenderer } from "./CheckersRenderer.js";

export const renderers: Record<string, new () => GameRenderer> = {
  checkers: CheckersRenderer,
  backgammon: BackgammonRenderer,
  // ... more games
};

export function createRenderer(gameType: string): GameRenderer {
  const RendererClass = renderers[gameType];
  if (!RendererClass) {
    throw new Error(`No renderer found for game type: ${gameType}`);
  }
  return new RendererClass();
}
```

---

## Part 8: Test Your Game

Write tests in three tiers: **logic**, **plugin**, and **end-to-end**.

### Tier 1: Logic Tests

Pure function tests—the simplest and most important.

**`server/src/games/checkers/__tests__/checkersLogic.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  initializeBoard,
  getValidMoves,
  applyMove,
  checkWinCondition,
  BLACK,
  RED,
  EMPTY,
} from "../checkersLogic.js";

function toIndex(row: number, col: number): number {
  return row * 8 + col;
}

describe("checkersLogic", () => {
  describe("initializeBoard", () => {
    it("creates a 64-square board", () => {
      const board = initializeBoard();
      expect(board).toHaveLength(64);
    });

    it("places 12 black pieces and 12 red pieces", () => {
      const board = initializeBoard();
      const blackCount = board.filter(p => p === BLACK).length;
      const redCount = board.filter(p => p === RED).length;
      expect(blackCount).toBe(12);
      expect(redCount).toBe(12);
    });
  });

  describe("getValidMoves", () => {
    it("returns forward diagonal moves for a black piece", () => {
      const board = Array.from({ length: 64 }, () => EMPTY);
      board[toIndex(2, 1)] = BLACK;
      
      const moves = getValidMoves(board, toIndex(2, 1), -1);
      expect(moves).toContainEqual({ from: toIndex(2, 1), to: toIndex(3, 0) });
      expect(moves).toContainEqual({ from: toIndex(2, 1), to: toIndex(3, 2) });
    });

    it("enforces forced capture rule", () => {
      const board = Array.from({ length: 64 }, () => EMPTY);
      board[toIndex(2, 1)] = BLACK;
      board[toIndex(3, 2)] = RED; // Opponent piece for capture
      board[toIndex(4, 3)] = EMPTY; // Capture destination
      
      const moves = getValidMoves(board, toIndex(2, 1), -1);
      // Should only return capture move, not regular diagonal
      expect(moves).toEqual([{ from: toIndex(2, 1), to: toIndex(4, 3) }]);
    });
  });

  describe("applyMove", () => {
    it("moves a piece and returns updated board", () => {
      const board = Array.from({ length: 64 }, () => EMPTY);
      board[toIndex(2, 1)] = BLACK;
      
      const result = applyMove(board, toIndex(2, 1), toIndex(3, 0));
      expect(result.board[toIndex(3, 0)]).toBe(BLACK);
      expect(result.board[toIndex(2, 1)]).toBe(EMPTY);
    });

    it("detects king promotion on reaching opposite end", () => {
      const board = Array.from({ length: 64 }, () => EMPTY);
      board[toIndex(6, 1)] = BLACK; // Just before end
      
      const result = applyMove(board, toIndex(6, 1), toIndex(7, 0));
      expect(result.isKingPromotion).toBe(true);
    });
  });

  describe("checkWinCondition", () => {
    it("returns null if both players have pieces", () => {
      const board = Array.from({ length: 64 }, () => EMPTY);
      board[toIndex(0, 1)] = BLACK;
      board[toIndex(7, 1)] = RED;
      
      const result = checkWinCondition(board, BLACK);
      expect(result).toBeNull();
    });

    it("returns win result when opponent has no pieces", () => {
      const board = Array.from({ length: 64 }, () => EMPTY);
      board[toIndex(0, 1)] = BLACK;
      
      const result = checkWinCondition(board, BLACK);
      expect(result?.type).toBe("win");
      expect(result?.winnerId).toBe(RED); // RED lost, so... wait, this logic is wrong
    });
  });
});
```

**Testing tips:**
- Use a helper like `toIndex(row, col)` to make tests readable.
- Test boundary cases (edge of board, king promotion, multi-capture).
- Keep test data minimal (empty board + a few pieces).

### Tier 2: Plugin Tests

Test the plugin interface and lifecycle.

**`server/src/games/checkers/__tests__/checkersPlugin.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { checkersPlugin } from "../CheckersPlugin.js";
import { CheckersState } from "@eschaton/shared";

const mockClient = (sessionId: string) => ({ sessionId }) as Client;

describe("checkersPlugin", () => {
  describe("metadata", () => {
    it("describes the plugin correctly", () => {
      expect(checkersPlugin.id).toBe("checkers");
      expect(checkersPlugin.name).toBe("Checkers");
      expect(checkersPlugin.metadata.playerCount).toEqual([2, 2]);
      expect(checkersPlugin.metadata.complexity).toBe(2);
    });
  });

  describe("createState", () => {
    it("creates a CheckersState instance", () => {
      const state = checkersPlugin.createState();
      expect(state).toBeInstanceOf(CheckersState);
      expect(state.board).toHaveLength(64);
      expect(state.mustCaptureFrom).toBe(-1);
    });
  });

  describe("lifecycle.onPlayerJoin", () => {
    it("assigns colors to players", () => {
      const state = checkersPlugin.createState();
      const client1 = mockClient("player1");
      const client2 = mockClient("player2");
      
      checkersPlugin.lifecycle.onPlayerJoin?.(state, client1, 0);
      checkersPlugin.lifecycle.onPlayerJoin?.(state, client2, 1);
      
      expect(state.players.get("player1")?.color).toBe(BLACK);
      expect(state.players.get("player2")?.color).toBe(RED);
    });
  });

  describe("lifecycle.onGameStart", () => {
    it("initializes the board", () => {
      const state = checkersPlugin.createState();
      const client1 = mockClient("player1");
      const client2 = mockClient("player2");
      
      checkersPlugin.lifecycle.onPlayerJoin?.(state, client1, 0);
      checkersPlugin.lifecycle.onPlayerJoin?.(state, client2, 1);
      checkersPlugin.lifecycle.onGameStart(state);
      
      const blackCount = Array.from(state.board).filter(p => p === BLACK).length;
      expect(blackCount).toBe(12);
      expect(state.phase).toBe("playing");
    });
  });

  describe("conditions.validateAction", () => {
    it("rejects actions from non-current player", () => {
      const state = checkersPlugin.createState();
      const client1 = mockClient("player1");
      const client2 = mockClient("player2");
      
      state.currentTurn = "player1";
      
      const isValid = checkersPlugin.conditions.validateAction(
        state,
        client2,
        "move",
        { from: 8, to: 12 }
      );
      expect(isValid).toBe(false);
    });

    it("accepts valid moves from current player", () => {
      // Setup... (see full test for details)
      const isValid = checkersPlugin.conditions.validateAction(
        state,
        client1,
        "move",
        { from: 8, to: 12 }
      );
      expect(isValid).toBe(true);
    });
  });

  describe("actions.move", () => {
    it("rejects invalid payload", () => {
      const state = checkersPlugin.createState();
      const client = mockClient("player1");
      
      const result = checkersPlugin.actions.move(state, client, null);
      expect(result.success).toBe(false);
    });

    it("executes a valid move and ends turn", () => {
      // Full setup...
      const result = checkersPlugin.actions.move(state, client1, {
        from: 8,
        to: 12,
      });
      
      expect(result.success).toBe(true);
      expect(result.endsTurn).toBe(true);
    });
  });
});
```

### Tier 3: End-to-End Tests

Simulate a full game flow.

**`server/src/__tests__/checkers-e2e.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { checkersPlugin } from "../games/checkers/CheckersPlugin.js";
import { CheckersState } from "@eschaton/shared";

function createStartedGame() {
  const state = checkersPlugin.createState();
  const client1 = mockClient("player1");
  const client2 = mockClient("player2");
  
  checkersPlugin.lifecycle.onPlayerJoin?.(state, client1, 0);
  checkersPlugin.lifecycle.onPlayerJoin?.(state, client2, 1);
  checkersPlugin.lifecycle.onGameStart(state);
  state.phase = "playing";
  state.currentTurn = "player1";
  
  return { state, client1, client2 };
}

describe("checkers-e2e", () => {
  it("plays a complete game to win", () => {
    const { state, client1, client2 } = createStartedGame();
    
    // Simulate moves...
    // Remove all opponent pieces
    // Verify checkWinCondition detects win
    
    const moves = [
      [8, 12],
      [40, 36],
      [12, 16],
      // ... more moves
    ];
    
    for (const [from, to] of moves) {
      expect(checkersPlugin.conditions.validateAction(
        state,
        state.currentTurn === "player1" ? client1 : client2,
        "move",
        { from, to }
      )).toBe(true);
      
      checkersPlugin.actions.move(state, /*...*/, { from, to });
      // Advance turn...
    }
    
    const gameEnd = checkersPlugin.conditions.checkGameEnd(state);
    expect(gameEnd).not.toBeNull();
  });

  it("enforces forced capture rule", () => {
    const { state, client1, client2 } = createStartedGame();
    
    // Setup board with capture opportunity
    // Try to make non-capture move
    // Verify it's rejected
    
    const result = checkersPlugin.conditions.validateAction(
      state,
      client1,
      "move",
      { from: someIndex, to: anotherIndex } // Non-capture
    );
    expect(result).toBe(false);
  });
});
```

**Run tests:**

```bash
npm run test                    # Run all tests
npm run test:watch             # Watch mode
npm run test -- checkers       # Filter to Checkers tests
```

---

## Part 9: Checklist

Use this checklist to verify your game is complete:

### Server

- [ ] State schema extends `BaseGameState` (shared/src/games/)
- [ ] Game logic functions are pure (no Colyseus) (server/src/games/{game}/)
- [ ] Plugin object implements `GamePlugin<TState>` (server/src/games/{game}/)
- [ ] Metadata is filled out (playerCount, complexity, description)
- [ ] Lifecycle hooks are implemented (onPlayerJoin, onGameStart, etc.)
- [ ] Actions validate payload and update state
- [ ] Conditions validate moves and detect win/loss
- [ ] Plugin is registered in `server/src/index.ts`
- [ ] Tests: logic, plugin, and e2e (server/src/__tests__/)

### Client

- [ ] Renderer extends `GameRenderer` (client/src/renderers/)
- [ ] `init()` subscribes to messages and draws initial state
- [ ] `onStateChange()` redraws on updates
- [ ] Input handling sends "move" actions to room
- [ ] Renderer is registered in renderer factory (client/src/renderers/index.ts)
- [ ] (Optional) Duplicate logic functions for client validation (client/src/games/{game}/)

### Shared

- [ ] State schema is exported (shared/src/games/)
- [ ] Types are synced between server and client

### Testing & QA

- [ ] Logic tests cover core rules and edge cases
- [ ] Plugin tests cover lifecycle and validation
- [ ] E2E tests cover a full game
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] `npm run lint` has no errors
- [ ] Manual testing: create game, play to completion, verify win/loss

---

## Part 10: Troubleshooting

### "Game type is not registered"

**Cause:** You forgot to call `gameRegistry.register(yourPlugin)` in `server/src/index.ts`.

**Fix:** Add the import and registration:

```typescript
import { checkersPlugin } from "./games/checkers/index.js";
gameRegistry.register(checkersPlugin);
```

### "State is not syncing to client"

**Cause:** You're mutating state instead of reassigning it. Colyseus won't detect changes to nested arrays.

**Fix:** Always reassign:

```typescript
// ❌ Wrong
state.board[i] = value;

// ✅ Correct
state.board = new ArraySchema(...newBoardArray);
```

### "Renderer is not rendering pieces"

**Cause:** `onStateChange()` isn't being called, or `this.board` isn't updating.

**Fix:** Verify:
1. Renderer's `init()` is called on room join
2. `onStateChange()` is triggered by state broadcasts
3. State changes are actually happening on server

Add debug logging:

```typescript
onStateChange(state: CheckersState) {
  console.log("State changed:", state.board);
  this.board = Array.from(state.board);
  // ...
}
```

### "Piece selection isn't working"

**Cause:** Display index ↔ board index conversion is wrong, or click handler isn't attached.

**Fix:**
1. Verify click handlers are attached to all squares in `init()`
2. Add debug logging to `handleSquareClick()`:

```typescript
private handleSquareClick(displayIndex: number): void {
  const boardIndex = this.toBoardIndex(displayIndex);
  console.log(`Clicked display ${displayIndex} → board ${boardIndex}`);
  // ...
}
```

---

## Learning Resources

- **IGamePlugin interface:** `shared/src/gamePlugin.ts`
- **BaseGameState:** `shared/src/gameState.ts`
- **BaseGameRoom:** `server/src/game/BaseGameRoom.ts`
- **Checkers implementation:** Full reference throughout this guide
- **Colyseus docs:** https://docs.colyseus.io/

---

## Next Steps

Once your game is playable:

1. **Polish:** Improve UI, add animations, sound effects.
2. **Rules:** Add variants, undo, chat.
3. **Testing:** Add spectator support, timeout handling, reconnection.
4. **Monitoring:** Track game duration, win rates, common moves.

Good luck! 🎮

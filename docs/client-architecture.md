# Client Architecture — playgrid

**Author:** Gately (Game Dev / Frontend)  
**Last Updated:** 2026-03-14

---

## Overview

This document defines the client architecture for **playgrid**, a multiplayer board game platform. The client is built with **PixiJS 8** for rendering and **Colyseus.js** for real-time networking. The platform must support multiple game types: **Risk**, **Checkers**, **Backgammon**, **Dominoes**, and **Card Games** (Poker, Hearts, Spades).

The architecture follows these core principles:
- **Plugin-based renderers** — each game provides its own renderer
- **Clean separation** — UI (HTML/CSS) for menus, PixiJS for game rendering
- **Simple state flow** — Colyseus state drives rendering, no complex local state
- **Mobile-first** — responsive design with touch and mouse input

---

## 1. Client Application Architecture

### 1.1 Application Structure

Refactor the current `index.ts` into a **proper application class** with scene management:

```typescript
// client/src/Application.ts
export class PlaygridApp {
  private pixi: PIXIApplication;
  private colyseusClient: Client;
  private sceneManager: SceneManager;
  private lobbyRoom: Room | null = null;
  private gameRoom: Room | null = null;

  async init(container: HTMLElement): Promise<void> {
    // Initialize PixiJS app
    this.pixi = new PIXIApplication();
    await this.pixi.init({ resizeTo: container, backgroundColor: 0x1a1a2e });
    container.appendChild(this.pixi.canvas);

    // Initialize Colyseus client
    this.colyseusClient = new Client(this.getServerUrl());

    // Initialize scene manager
    this.sceneManager = new SceneManager(this.pixi.stage);

    // Connect to lobby
    await this.connectToLobby();
  }

  private async connectToLobby(): Promise<void> {
    this.lobbyRoom = await this.colyseusClient.joinOrCreate("lobby");
    this.sceneManager.transitionTo("lobby", { room: this.lobbyRoom });
  }

  async joinGame(roomId: string, gameType: string): Promise<void> {
    this.gameRoom = await this.colyseusClient.joinById(roomId);
    this.sceneManager.transitionTo("game", { 
      room: this.gameRoom, 
      gameType 
    });
  }

  async leaveGame(): Promise<void> {
    if (this.gameRoom) {
      await this.gameRoom.leave();
      this.gameRoom = null;
    }
    this.sceneManager.transitionTo("lobby", { room: this.lobbyRoom });
  }
}
```

### 1.2 Scene Management System

A **SceneManager** handles transitions between screens and manages the active scene:

```typescript
// client/src/SceneManager.ts
export type SceneName = "lobby" | "waiting-room" | "game";

export interface Scene {
  name: SceneName;
  container: Container;
  
  onEnter(data: unknown): Promise<void>;
  onExit(): Promise<void>;
  update(deltaTime: number): void;
  resize(width: number, height: number): void;
}

export class SceneManager {
  private scenes = new Map<SceneName, Scene>();
  private activeScene: Scene | null = null;
  private stage: Container;

  constructor(stage: Container) {
    this.stage = stage;
  }

  registerScene(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  async transitionTo(sceneName: SceneName, data?: unknown): Promise<void> {
    const nextScene = this.scenes.get(sceneName);
    if (!nextScene) {
      throw new Error(`Scene "${sceneName}" not registered`);
    }

    // Exit current scene
    if (this.activeScene) {
      await this.activeScene.onExit();
      this.stage.removeChild(this.activeScene.container);
    }

    // Enter new scene
    this.activeScene = nextScene;
    this.stage.addChild(nextScene.container);
    await nextScene.onEnter(data);
  }

  update(deltaTime: number): void {
    this.activeScene?.update(deltaTime);
  }

  resize(width: number, height: number): void {
    this.activeScene?.resize(width, height);
  }
}
```

**Why this works:**
- Clean separation of concerns — each scene owns its rendering
- Async transitions allow loading assets before displaying
- Scenes can be unit-tested independently
- Easy to add new screens (settings, player profiles, etc.)

### 1.3 Screen Transition Flow

```
[Lobby Screen] ──create/join──> [Waiting Room] ──start──> [Game Screen]
       ↑                              │                         │
       └──────────────────leave───────┴──────────leave──────────┘
```

**Lobby Screen:**
- HTML overlay (existing `LobbyScreen.ts`)
- Shows list of available games
- Create new game button
- Filters by game type and status

**Waiting Room:**
- HTML overlay (existing `WaitingRoom.ts`)
- Player list with ready states
- Host can start the game
- Chat (future enhancement)

**Game Screen:**
- PixiJS rendering (fullscreen canvas)
- Game-specific renderer plugin
- In-game UI (HUD, controls)
- Back to lobby button

### 1.4 State Management

**Client-side state is minimal.** Colyseus owns the authoritative state; client just renders it.

```typescript
// client/src/state/GameState.ts
export class ClientGameState {
  // Colyseus room state (synced from server)
  roomState: Schema;

  // Local UI state only
  selectedPiece: string | null = null;
  hoveredSquare: { x: number; y: number } | null = null;
  animationQueue: Animation[] = [];
  
  // NO game logic here — server is source of truth
}
```

**State flow:**
1. Player makes input (click piece, select card)
2. Client sends message to server (`room.send("move", { from, to })`)
3. Server validates and updates state
4. State change syncs back to all clients
5. Renderer updates based on new state

**Local prediction:** For fast-paced interactions, client can optimistically update UI (e.g., drag piece), but rolls back if server rejects.

### 1.5 Connection Lifecycle

```typescript
// client/src/networking/ConnectionManager.ts
export class ConnectionManager {
  private client: Client;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    // Initial connection
  }

  private async handleDisconnect(): Promise<void> {
    // Show "reconnecting..." overlay
    // Attempt reconnect with exponential backoff
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      await this.delay(Math.pow(2, this.reconnectAttempts) * 1000);
      try {
        await this.reconnect();
        return;
      } catch (err) {
        this.reconnectAttempts++;
      }
    }
    // Give up, return to lobby with error message
  }

  private async reconnect(): Promise<void> {
    // Colyseus supports reconnection tokens
    // If lobby room, rejoin by name
    // If game room, rejoin by roomId + reconnect token
  }
}
```

**Reconnection strategy:**
- **Lobby room:** Automatically rejoin on disconnect
- **Game room:** Preserve seat for 60s, allow reconnect
- **Visual feedback:** "Reconnecting..." overlay with countdown
- **Failure:** Return to lobby, show error toast

---

## 2. Game Renderer Plugin System

Each game implements a **GameRenderer** interface. The client loads the appropriate renderer when a game starts.

### 2.1 GameRenderer Interface

```typescript
// client/src/renderers/GameRenderer.ts
export interface GameRenderer {
  /** Unique game type identifier */
  readonly gameType: string;

  /** PixiJS container holding all game visuals */
  readonly container: Container;

  /** Initialize renderer with game state */
  init(room: Room, state: Schema): Promise<void>;

  /** Called when Colyseus state changes */
  onStateChange(state: Schema): void;

  /** Called every frame (60 FPS) */
  update(deltaTime: number): void;

  /** Handle window/canvas resize */
  resize(width: number, height: number): void;

  /** Handle mouse/touch input */
  handleInput(event: RendererInputEvent): void;

  /** Clean up resources */
  destroy(): void;
}

export interface RendererInputEvent {
  type: "pointerdown" | "pointerup" | "pointermove";
  position: { x: number; y: number };
  button?: number; // 0=left, 1=middle, 2=right
  target?: DisplayObject;
}
```

### 2.2 Renderer Registration

```typescript
// client/src/renderers/RendererRegistry.ts
export class RendererRegistry {
  private static renderers = new Map<string, new () => GameRenderer>();

  static register(gameType: string, rendererClass: new () => GameRenderer): void {
    this.renderers.set(gameType, rendererClass);
  }

  static create(gameType: string): GameRenderer {
    const RendererClass = this.renderers.get(gameType);
    if (!RendererClass) {
      throw new Error(`No renderer registered for game type: ${gameType}`);
    }
    return new RendererClass();
  }
}

// Usage (in each renderer file):
RendererRegistry.register("checkers", CheckersRenderer);
RendererRegistry.register("risk", RiskRenderer);
```

### 2.3 Renderer Loading

```typescript
// client/src/scenes/GameScene.ts
export class GameScene implements Scene {
  private renderer: GameRenderer | null = null;

  async onEnter(data: { room: Room; gameType: string }): Promise<void> {
    // Create renderer for this game type
    this.renderer = RendererRegistry.create(data.gameType);
    
    // Load assets (if needed)
    await this.renderer.init(data.room, data.room.state);
    
    // Add to stage
    this.container.addChild(this.renderer.container);

    // Listen for state changes
    data.room.onStateChange((state) => {
      this.renderer?.onStateChange(state);
    });
  }

  update(deltaTime: number): void {
    this.renderer?.update(deltaTime);
  }
}
```

### 2.4 Input Handling

Each renderer receives input events and decides how to handle them:

```typescript
// In CheckersRenderer.ts
handleInput(event: RendererInputEvent): void {
  if (event.type === "pointerdown") {
    const square = this.getSquareAtPosition(event.position);
    if (square && this.isPieceSelectable(square)) {
      this.selectPiece(square);
      this.room.send("select_piece", { square });
    }
  }
}
```

**Input flow:**
1. PixiJS captures pointer events on canvas
2. GameScene forwards to active renderer
3. Renderer converts screen coords to game coords
4. Renderer sends validated input to server
5. Server broadcasts state change
6. Renderer updates visuals based on new state

---

## 3. Per-Game Rendering Analysis

### 3.1 Checkers

**Complexity:** LOW — Simple grid, basic sprites

**Rendering Requirements:**
- 8×8 board (alternating light/dark squares)
- 24 pieces (12 red, 12 black)
- Piece states: regular, king (crowned)
- Valid move indicators (highlight squares)
- Capture animation (piece jumps and removes opponent)
- King promotion animation (crown appears)

**Implementation Strategy:**
```typescript
// client/src/renderers/CheckersRenderer.ts
export class CheckersRenderer implements GameRenderer {
  private board: Graphics;
  private pieces = new Map<string, Sprite>();
  private highlights: Graphics[] = [];

  async init(room: Room, state: CheckersState): Promise<void> {
    this.board = this.createBoard();
    this.container.addChild(this.board);
    
    // Create piece sprites
    for (const piece of state.pieces) {
      const sprite = this.createPiece(piece.color, piece.isKing);
      this.pieces.set(piece.id, sprite);
      this.container.addChild(sprite);
    }
  }

  private createBoard(): Graphics {
    const board = new Graphics();
    const squareSize = 80;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const color = (row + col) % 2 === 0 ? 0xf0d9b5 : 0xb58863;
        board.rect(col * squareSize, row * squareSize, squareSize, squareSize);
        board.fill(color);
      }
    }
    
    return board;
  }

  onStateChange(state: CheckersState): void {
    // Update piece positions
    for (const piece of state.pieces) {
      const sprite = this.pieces.get(piece.id);
      if (sprite) {
        this.animatePieceMove(sprite, piece.position);
      }
    }
    
    // Update highlights for valid moves
    this.updateHighlights(state.validMoves);
  }
}
```

**Assets Needed:**
- Board: Programmatic (Graphics API)
- Pieces: Simple circles with colors (Graphics or SVG)
- Crown icon: SVG or bitmap for king promotion
- Highlight: Semi-transparent overlay (Graphics)

**Input:**
- Click piece to select
- Click destination square to move
- Multi-jump handled by server (auto-continue or choose path)

---

### 3.2 Backgammon

**Complexity:** MEDIUM — Stacking pieces, dice, complex layout

**Rendering Requirements:**
- 24 points (triangular spikes)
- 30 pieces (15 per player, stacked on points)
- Bar (middle area for captured pieces)
- Home boards (bear-off areas)
- 2 dice with 6 faces each
- Doubling cube (1, 2, 4, 8, 16, 32, 64)
- Movement animation (piece slides from point to point)
- Bearing off animation (piece exits board)

**Implementation Strategy:**
```typescript
// client/src/renderers/BackgammonRenderer.ts
export class BackgammonRenderer implements GameRenderer {
  private points: Graphics[] = []; // 24 triangular points
  private pieces = new Map<string, Sprite>();
  private dice: DiceSprites;
  
  private createPoint(index: number, isTop: boolean): Graphics {
    const point = new Graphics();
    const color = index % 2 === 0 ? 0x8b4513 : 0xdeb887;
    
    // Draw triangle
    point.moveTo(0, 0);
    point.lineTo(30, isTop ? 120 : -120);
    point.lineTo(60, 0);
    point.closePath();
    point.fill(color);
    
    return point;
  }

  onStateChange(state: BackgammonState): void {
    // Update piece stacks on each point
    for (let i = 0; i < 24; i++) {
      const stack = state.points[i];
      this.updatePieceStack(i, stack);
    }
    
    // Update dice
    this.dice.setValues(state.dice);
  }

  private updatePieceStack(pointIndex: number, stack: PieceStack): void {
    const basePos = this.getPointPosition(pointIndex);
    const stackHeight = Math.min(stack.count, 5); // Max 5 visible
    
    for (let i = 0; i < stackHeight; i++) {
      const piece = this.getOrCreatePiece(pointIndex, i);
      piece.x = basePos.x;
      piece.y = basePos.y + (i * 20); // Stack offset
    }
    
    // Show count label if > 5
    if (stack.count > 5) {
      this.showStackCount(pointIndex, stack.count);
    }
  }
}
```

**Assets Needed:**
- Points: Programmatic triangles (Graphics)
- Pieces: Circular checkers (Graphics or sprites)
- Dice: 6 sprite frames per die (or 3D if fancy)
- Board background: Wooden texture (optional bitmap)
- Doubling cube: 6 sprite frames

**Input:**
- Click piece to select (shows valid destinations)
- Click destination point to move
- Dice auto-roll on turn start (server-driven)
- Click doubling cube to double stakes (if enabled)

---

### 3.3 Dominoes

**Complexity:** MEDIUM — Chain layout, tile rotation, hand management

**Rendering Requirements:**
- Domino tiles (28 tiles in a double-six set)
- Each tile has two halves with pip counts (0-6)
- Board layout: Chain of placed tiles (linear or branching)
- Player hand: Fan of tiles (face-up for player, face-down for opponents)
- Tile placement: Snap to valid positions, rotate to match pips
- Score display (running total or per-round)

**Implementation Strategy:**
```typescript
// client/src/renderers/DominoesRenderer.ts
export class DominoesRenderer implements GameRenderer {
  private board: Container; // Placed tiles
  private hand: Container; // Player's tiles
  private opponentHands = new Map<string, Container>();

  private createTile(pips: [number, number], faceUp: boolean): Container {
    const tile = new Container();
    const bg = new Graphics();
    bg.rect(0, 0, 50, 100);
    bg.fill(0xffffff);
    bg.stroke({ color: 0x000000, width: 2 });
    tile.addChild(bg);
    
    if (faceUp) {
      // Draw pips for each half
      tile.addChild(this.createPips(pips[0], 25, 25));
      tile.addChild(this.createPips(pips[1], 25, 75));
      
      // Divider line
      const line = new Graphics();
      line.moveTo(0, 50).lineTo(50, 50);
      line.stroke({ color: 0x000000, width: 1 });
      tile.addChild(line);
    } else {
      // Face-down (just show back)
      bg.fill(0x8b4513);
    }
    
    return tile;
  }

  onStateChange(state: DominoesState): void {
    // Update board chain
    this.updateBoardChain(state.placedTiles);
    
    // Update player hand
    this.updateHand(state.playerHand);
    
    // Update opponent hands (just counts)
    for (const opponent of state.opponents) {
      this.updateOpponentHand(opponent.id, opponent.tileCount);
    }
  }

  private updateBoardChain(tiles: PlacedTile[]): void {
    // Layout tiles in a chain, with proper rotation and spacing
    // Handle branching for certain domino variants
    let x = 100;
    let y = 300;
    
    for (const tile of tiles) {
      const sprite = this.createTile(tile.pips, true);
      sprite.x = x;
      sprite.y = y;
      sprite.rotation = tile.rotation;
      this.board.addChild(sprite);
      
      // Update position for next tile
      if (tile.rotation === 0) {
        x += 60; // Horizontal
      } else {
        y += 110; // Vertical
      }
    }
  }
}
```

**Assets Needed:**
- Tile background: White rounded rectangle (Graphics)
- Pips: Black dots (Graphics circles)
- Tile back: Brown pattern (Graphics or bitmap)
- Optional: SVG dominoes for crisp scaling

**Input:**
- Click tile in hand to select
- Click valid position on board to place
- Server validates placement (matching pips)
- Drag-and-drop optional (mobile harder)

---

### 3.4 Risk

**Complexity:** HIGH — World map, complex UI, multiple phases

**Rendering Requirements:**
- World map with ~42 territories
- Territory coloring (one color per player)
- Army count display per territory (numeric label)
- Territory borders (highlight on hover/select)
- Continent bonuses (visual grouping)
- Dice rolling animation (attack/defend)
- Card display (territory cards, wild cards)
- Phase indicators (draft → attack → fortify)
- Attack flow: Select attacker → select target → roll dice → show results
- Fortify flow: Select source → select destination → drag slider for count

**Implementation Strategy:**
```typescript
// client/src/renderers/RiskRenderer.ts
export class RiskRenderer implements GameRenderer {
  private map: Container;
  private territories = new Map<string, TerritorySprite>();
  private armyLabels = new Map<string, Text>();
  private selectedTerritory: string | null = null;
  private phaseUI: PhaseUI;
  private cardPanel: CardPanel;

  async init(room: Room, state: RiskState): Promise<void> {
    // Load map asset (SVG or pre-rendered)
    const mapTexture = await Assets.load("assets/risk-map.svg");
    this.map = new Sprite(mapTexture);
    this.container.addChild(this.map);
    
    // Create territory hitboxes (from polygon data)
    for (const [id, polygon] of Object.entries(TERRITORY_POLYGONS)) {
      const territory = this.createTerritory(id, polygon);
      this.territories.set(id, territory);
      this.map.addChild(territory);
    }
    
    // Initialize UI
    this.phaseUI = new PhaseUI();
    this.cardPanel = new CardPanel();
    this.container.addChild(this.phaseUI.container);
    this.container.addChild(this.cardPanel.container);
  }

  private createTerritory(id: string, polygon: Point[]): TerritorySprite {
    const territory = new Graphics();
    
    // Draw territory shape (for hit detection)
    territory.poly(polygon);
    territory.fill({ color: 0xffffff, alpha: 0.01 });
    
    // Interactive
    territory.eventMode = "static";
    territory.cursor = "pointer";
    territory.on("pointerdown", () => this.onTerritoryClick(id));
    territory.on("pointerover", () => this.onTerritoryHover(id));
    
    return territory as TerritorySprite;
  }

  onStateChange(state: RiskState): void {
    // Update territory colors and army counts
    for (const [id, territory] of state.territories) {
      this.territories.get(id)?.tint(this.getPlayerColor(territory.owner));
      this.armyLabels.get(id)?.setText(territory.armies.toString());
    }
    
    // Update phase UI
    this.phaseUI.setPhase(state.phase);
    
    // Update cards
    this.cardPanel.setCards(state.playerCards);
  }

  private onTerritoryClick(id: string): void {
    const state = this.room.state as RiskState;
    
    if (state.phase === "attack") {
      if (!this.selectedTerritory) {
        // Select attacker
        if (this.canAttackFrom(id)) {
          this.selectedTerritory = id;
          this.highlightAdjacentEnemies(id);
        }
      } else {
        // Select target
        if (this.canAttackTarget(this.selectedTerritory, id)) {
          this.room.send("attack", { from: this.selectedTerritory, to: id });
        }
        this.selectedTerritory = null;
      }
    }
    // Similar logic for draft and fortify phases
  }
}
```

**Assets Needed:**
- **World map:** SVG with territory boundaries (critical asset)
  - Can use open-source Risk map SVG
  - Alternative: JSON polygon data for programmatic rendering
- **Territory colors:** Programmatic tints (red, blue, green, yellow, etc.)
- **Army tokens:** Sprites or text labels
- **Dice:** 6-frame sprite sheet per die
- **Cards:** Small territory images or icons
- **Icons:** Draft, attack, fortify phase indicators

**Input:**
- Click territory to select (context-dependent on phase)
- Dice auto-roll after attack/defend (server-driven)
- Card panel: Click card to select, click "Trade Cards" button
- Slider for draft/fortify counts (HTML overlay or PixiJS UI)

**Note:** Risk is the most complex game visually. The map asset is critical — without it, the game isn't playable. We can start with a simple programmatic map (circles for territories, lines for borders) as a placeholder.

---

### 3.5 Card Games (Poker, Hearts, Spades)

**Complexity:** MEDIUM — Card rendering, hand layout, trick-taking

**Rendering Requirements:**
- 52-card deck (13 ranks × 4 suits)
- Card front (rank + suit symbols)
- Card back (decorative pattern)
- Hand layout: Fan of cards (player) or face-down (opponents)
- Trick area: Played cards in center
- Pot area: Chips or bet amounts (Poker)
- Score display: Running totals (Hearts, Spades)
- Betting UI: Fold, call, raise buttons (Poker)
- Passing UI: Select 3 cards to pass (Hearts)
- Trump indicator: Show trump suit (Spades)
- Animation: Card dealing, playing, collecting tricks

**Implementation Strategy:**
```typescript
// client/src/renderers/CardGameRenderer.ts
export abstract class CardGameRenderer implements GameRenderer {
  protected deck: Map<string, Sprite>; // Card sprites
  protected playerHand: Container;
  protected opponentHands: Container[] = [];
  protected trickArea: Container;
  protected scoreDisplay: Text;

  protected createCard(rank: string, suit: string, faceUp: boolean): Sprite {
    if (faceUp) {
      const texture = this.getCardTexture(rank, suit);
      return new Sprite(texture);
    } else {
      const texture = this.getCardBackTexture();
      return new Sprite(texture);
    }
  }

  protected layoutHand(cards: Card[], container: Container): void {
    const cardWidth = 80;
    const overlapFactor = 0.3;
    const totalWidth = cardWidth + (cards.length - 1) * cardWidth * overlapFactor;
    const startX = -totalWidth / 2;

    cards.forEach((card, index) => {
      const sprite = this.createCard(card.rank, card.suit, true);
      sprite.x = startX + index * cardWidth * overlapFactor;
      sprite.y = 0;
      sprite.eventMode = "static";
      sprite.cursor = "pointer";
      sprite.on("pointerdown", () => this.onCardClick(card));
      container.addChild(sprite);
    });
  }

  abstract onCardClick(card: Card): void;
}

// client/src/renderers/PokerRenderer.ts
export class PokerRenderer extends CardGameRenderer {
  private bettingUI: BettingUI;
  private potDisplay: Text;

  onStateChange(state: PokerState): void {
    // Update hands
    this.layoutHand(state.playerHand, this.playerHand);
    
    // Update community cards (Texas Hold'em)
    this.layoutCommunityCards(state.communityCards);
    
    // Update pot
    this.potDisplay.text = `Pot: $${state.pot}`;
    
    // Update betting UI
    this.bettingUI.setOptions(state.validActions);
  }

  onCardClick(card: Card): void {
    // In poker, clicking cards is usually just for visual feedback
    // (cards are auto-selected by server for best hand)
  }
}

// client/src/renderers/HeartsRenderer.ts
export class HeartsRenderer extends CardGameRenderer {
  private passingUI: PassingUI;
  private selectedForPass: Card[] = [];

  onStateChange(state: HeartsState): void {
    if (state.phase === "passing") {
      // Show passing UI
      this.passingUI.show();
    } else if (state.phase === "playing") {
      // Update trick area
      this.updateTrickArea(state.currentTrick);
    }
    
    // Update scores
    this.updateScores(state.scores);
  }

  onCardClick(card: Card): void {
    if (this.room.state.phase === "passing") {
      // Select card for passing
      if (this.selectedForPass.includes(card)) {
        this.selectedForPass = this.selectedForPass.filter(c => c !== card);
      } else if (this.selectedForPass.length < 3) {
        this.selectedForPass.push(card);
      }
      
      if (this.selectedForPass.length === 3) {
        this.room.send("pass_cards", { cards: this.selectedForPass });
      }
    } else {
      // Play card
      this.room.send("play_card", { card });
    }
  }
}
```

**Assets Needed:**
- **Card sprites:** 52 card faces + 1 back design
  - Can use open-source card SVG (e.g., SVG-cards by Chris Aguilar)
  - Or bitmap sprite sheet (4096×1024 texture atlas)
- **Chip sprites:** Poker chips in various denominations (optional)
- **Suit icons:** ♠ ♥ ♦ ♣ (for trump indicator)
- **Button icons:** Fold, call, raise, check (Poker)

**Input:**
- Click card to play (or select for passing)
- Betting buttons: Click to fold/call/raise
- Raise slider: Drag to set raise amount

---

## 4. Spectator Mode UI

Spectators can watch games without participating. They see the game state but cannot interact.

### 4.1 Spectator Perspective

**For public information games (Checkers, Backgammon, Dominoes, Risk):**
- Spectator sees the full board state
- All pieces and moves are visible
- No input events processed
- "Spectator Mode" indicator in top-left

**For hidden information games (Poker, Hearts, Spades):**
- Spectator sees board/trick area, but NOT any player's hand
- Option: "View from Player X's perspective" dropdown
  - If enabled, see that player's cards (only if player allows spectators)
- Default: See community cards and played cards only

### 4.2 Spectator Controls

```typescript
// client/src/renderers/SpectatorOverlay.ts
export class SpectatorOverlay extends Container {
  private perspectiveDropdown: HTMLSelectElement | null = null;

  constructor(gameType: string, players: Player[]) {
    super();
    
    // Add "Spectator Mode" banner
    const banner = new Graphics();
    banner.rect(0, 0, 200, 40);
    banner.fill({ color: 0x000000, alpha: 0.7 });
    this.addChild(banner);
    
    const label = new Text({
      text: "👁 Spectator Mode",
      style: { fontSize: 16, fill: 0xffffff }
    });
    label.x = 10;
    label.y = 10;
    this.addChild(label);
    
    // For hidden-info games, add perspective selector
    if (gameType === "poker" || gameType === "hearts" || gameType === "spades") {
      this.createPerspectiveDropdown(players);
    }
  }

  private createPerspectiveDropdown(players: Player[]): void {
    // Create HTML dropdown overlay
    // (This could be PixiJS UI, but HTML is easier for dropdowns)
    this.perspectiveDropdown = document.createElement("select");
    this.perspectiveDropdown.style.position = "absolute";
    this.perspectiveDropdown.style.top = "50px";
    this.perspectiveDropdown.style.left = "10px";
    
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "No player view";
    this.perspectiveDropdown.add(defaultOption);
    
    for (const player of players) {
      const option = document.createElement("option");
      option.value = player.id;
      option.text = `View ${player.name}'s cards`;
      this.perspectiveDropdown.add(option);
    }
    
    document.body.appendChild(this.perspectiveDropdown);
  }

  destroy(): void {
    this.perspectiveDropdown?.remove();
    super.destroy();
  }
}
```

### 4.3 Spectator Count Display

In the lobby and waiting room, show spectator count:

```
Players: 3/6
Spectators: 2
```

### 4.4 Join as Spectator Flow

In `LobbyScreen.ts`, add a "Spectate" button next to "Join" button for in-progress games:

```typescript
private buildActionCell(game: GameSessionInfo): HTMLTableCellElement {
  const cell = document.createElement("td");
  
  if (game.status === "in_progress") {
    const spectateButton = document.createElement("button");
    spectateButton.textContent = "Spectate";
    spectateButton.onclick = () => this.joinAsSpectator(game.id);
    cell.appendChild(spectateButton);
  } else if (game.playerCount < game.maxPlayers) {
    // Existing "Join" button
  }
  
  return cell;
}

private joinAsSpectator(gameId: string): void {
  this.room.send("join_game", { gameId, spectator: true });
}
```

Server handles spectator join by not assigning a seat, just adding to spectator list.

---

## 5. Lobby & Matchmaking UI

### 5.1 Game Type Selection

The current lobby shows all games in one list. Enhance with game type filtering:

**Lobby Filter Buttons:**
```
[All] [Risk] [Checkers] [Backgammon] [Dominoes] [Poker] [Hearts] [Spades]
```

Each button filters the game list by type. Add `gameType` field to `GameSessionInfo`:

```typescript
export interface GameSessionInfo {
  id: string;
  name: string;
  gameType: "risk" | "checkers" | "backgammon" | "dominoes" | "poker" | "hearts" | "spades";
  // ...existing fields
}
```

### 5.2 Game Type Icons

Add icons to make game types visually distinct:

```typescript
// client/src/ui/GameTypeIcon.ts
export function getGameTypeIcon(gameType: string): string {
  const icons = {
    risk: "🌍",
    checkers: "🔴",
    backgammon: "🎲",
    dominoes: "🀫",
    poker: "🃏",
    hearts: "♥️",
    spades: "♠️"
  };
  return icons[gameType] || "🎮";
}
```

Show icon in lobby table:

```html
<td>🌍 World Domination</td>
```

### 5.3 Player Profiles & Stats

**Future enhancement** (not MVP):
- Click player name to view profile
- Profile shows: games played, win rate, rank
- Leaderboard page (top players by game type)

Store in database (outside scope of this doc).

### 5.4 Active Games List Enhancements

Current lobby shows:
- Game name
- Host
- Player count
- Status
- Action button

**Add:**
- Game type icon/name
- Time elapsed (for in-progress games)
- Map/variant info (e.g., "Large Map" for Risk)

### 5.5 Quick Match

**Future enhancement:**
- "Quick Match" button finds/creates a game with available players
- Matchmaking queue by game type and skill level

---

## 6. UI Framework Strategy

### 6.1 HTML/CSS vs. PixiJS for UI

**Recommendation: Hybrid approach**

**Use HTML/CSS for:**
- Lobby screen (game browser, filters, create game form)
- Waiting room (player list, ready states)
- Settings menu
- Chat panel
- Player profiles
- Leaderboards

**Use PixiJS for:**
- Game board rendering
- In-game HUD (score, timer, phase indicator)
- Piece/card sprites and animations
- Tooltips and highlights during gameplay

**Why this split?**
- HTML/CSS is better for forms, text layout, accessibility
- PixiJS is better for interactive game visuals and animations
- Keep concerns separated: UI chrome vs. game rendering

### 6.2 Accessibility Considerations

**HTML UI:**
- Use semantic HTML (`<button>`, `<nav>`, `<section>`)
- ARIA labels for screen readers
- Keyboard navigation (tab order, enter to activate)
- High contrast mode support (CSS variables)

**PixiJS Game:**
- Keyboard controls as alternative to mouse (arrow keys to select, enter to confirm)
- Screen reader support is harder — provide text alternatives for critical info
- Color-blind friendly palettes (avoid red/green only differentiation)
- Larger hit areas for touch (minimum 44×44px)

### 6.3 Responsive Design

**Canvas resizing:**
```typescript
// In PlaygridApp
private handleResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  this.pixi.renderer.resize(width, height);
  this.sceneManager.resize(width, height);
}
```

**Game renderer scaling:**
```typescript
// In CheckersRenderer
resize(width: number, height: number): void {
  const scale = Math.min(width / 800, height / 800);
  this.container.scale.set(scale);
  
  // Center board
  this.container.x = width / 2 - (800 * scale) / 2;
  this.container.y = height / 2 - (800 * scale) / 2;
}
```

**Mobile touch:**
- PixiJS automatically handles touch events as pointer events
- Ensure hit areas are large enough (44×44px minimum)
- Avoid hover-dependent interactions (use click/tap only)
- Test on actual devices (emulators don't match real touch behavior)

---

## 7. Asset Strategy

### 7.1 What Assets Are Needed?

**Universal:**
- UI icons (settings, back, home, mute, etc.)
- Button backgrounds (optional, can use CSS)
- Font files (if custom fonts used)

**Checkers:**
- None (all programmatic with Graphics API)

**Backgammon:**
- Dice faces (6 frames per die) — optional, can use 3D or programmatic
- Board texture (wood grain) — optional

**Dominoes:**
- Tile back texture — optional, can use solid color

**Risk:**
- **World map SVG** (critical) — 42 territories with IDs
- Dice faces (6 frames per die)
- Card images (territory cards)

**Card Games:**
- **Card sprite sheet** (52 cards + back) — can use open-source SVG
- Chip sprites (Poker) — optional
- Suit icons (♠ ♥ ♦ ♣)

### 7.2 SVG vs. Bitmap

**Use SVG when:**
- Scaling to arbitrary sizes (cards, UI icons)
- Crisp lines and shapes (territory borders, card designs)
- File size matters (SVG compresses well)

**Use Bitmap when:**
- Complex textures (wood, felt, photo-realistic)
- Pre-rendered art (character portraits, map backgrounds)
- Faster to render (no SVG parsing overhead)

**PixiJS 8 supports both:**
- SVG: Load with `Assets.load("icon.svg")`, convert to texture
- Bitmap: Load PNG/JPG directly

### 7.3 Asset Loading & Caching

```typescript
// client/src/assets/AssetLoader.ts
export class AssetLoader {
  private static cache = new Map<string, Texture>();

  static async loadGameAssets(gameType: string): Promise<void> {
    const manifest = this.getManifest(gameType);
    await Assets.load(manifest);
  }

  private static getManifest(gameType: string): string[] {
    const manifests: Record<string, string[]> = {
      risk: ["assets/risk-map.svg", "assets/dice.png", "assets/cards.png"],
      poker: ["assets/cards-spritesheet.json", "assets/chips.png"],
      checkers: [], // No assets needed
    };
    return manifests[gameType] || [];
  }

  static async preloadCommon(): Promise<void> {
    // Load UI icons and fonts
    await Assets.load([
      "assets/ui-icons.json",
      "assets/fonts/roboto.woff2"
    ]);
  }
}
```

**Lazy loading:**
- Load lobby UI assets immediately
- Load game assets only when entering that game
- Show loading screen during asset load

### 7.4 Placeholder Strategy

**Development workflow:**
1. **Prototype with simple shapes** (Graphics API)
   - Checkers: Colored circles
   - Risk: Colored squares for territories
   - Cards: Rectangles with text labels
2. **Test gameplay mechanics** with placeholders
3. **Replace with polished assets** once gameplay is solid

**Placeholder example:**
```typescript
// Temporary card rendering
private createCardPlaceholder(rank: string, suit: string): Graphics {
  const card = new Graphics();
  card.rect(0, 0, 80, 120);
  card.fill(0xffffff);
  card.stroke({ color: 0x000000, width: 2 });
  
  const label = new Text({ text: `${rank}${suit}`, style: { fontSize: 24 } });
  label.x = 20;
  label.y = 40;
  card.addChild(label);
  
  return card;
}
```

**Asset TODO list:**
- [ ] Risk map SVG (highest priority)
- [ ] Card spritesheet (shared across card games)
- [ ] Dice sprites (shared across board games)
- [ ] UI icon set (settings, back, etc.)
- [ ] Backgammon board texture (low priority)
- [ ] Poker chip sprites (low priority)

---

## 8. Responsive Design

### 8.1 Screen Size Adaptation

**Breakpoints:**
- Desktop: ≥ 1024px (full layout)
- Tablet: 768px – 1023px (scaled layout)
- Mobile: < 768px (simplified layout)

**Game rendering strategies:**

**Desktop:**
- Board centered, full size
- UI panels on sides (left: player info, right: controls)
- Chat panel at bottom

**Tablet:**
- Board scaled down slightly
- UI panels overlay board (semi-transparent)
- Collapsible panels

**Mobile:**
- Board fills screen (portrait or landscape)
- UI controls as overlay buttons (hamburger menu)
- Card games: Single-column hand layout (vertical stack)

### 8.2 Touch Input

**PixiJS pointer events:**
```typescript
sprite.eventMode = "static"; // Enable interaction
sprite.on("pointerdown", onTouchStart);
sprite.on("pointerup", onTouchEnd);
sprite.on("pointermove", onTouchMove);
```

**Touch-specific considerations:**
- No hover state (use tap to show highlights)
- Drag gestures (swipe card from hand to play area)
- Pinch-to-zoom (optional, for Risk map)
- Prevent accidental double-tap zoom (CSS: `touch-action: none`)

**Example: Drag-and-drop card:**
```typescript
private onCardPointerDown(card: Sprite): void {
  this.draggedCard = card;
  this.dragOffset = { x: card.x - globalX, y: card.y - globalY };
}

private onPointerMove(event: PointerEvent): void {
  if (this.draggedCard) {
    this.draggedCard.x = event.globalX + this.dragOffset.x;
    this.draggedCard.y = event.globalY + this.dragOffset.y;
  }
}

private onPointerUp(): void {
  if (this.draggedCard) {
    // Check if dropped on valid target
    const dropTarget = this.getDropTarget(this.draggedCard.position);
    if (dropTarget) {
      this.room.send("play_card", { card: this.draggedCard.data });
    } else {
      // Snap back to hand
      this.snapToHand(this.draggedCard);
    }
    this.draggedCard = null;
  }
}
```

### 8.3 Viewport Management

For games with large boards (Risk), support panning and zooming:

```typescript
// client/src/utils/Viewport.ts
export class Viewport {
  private camera: Container;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  
  enablePanZoom(stage: Container, content: Container): void {
    this.camera = new Container();
    this.camera.addChild(content);
    stage.addChild(this.camera);
    
    // Mouse drag to pan
    stage.eventMode = "static";
    stage.on("pointerdown", (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.globalX, y: e.globalY };
    });
    
    stage.on("pointermove", (e) => {
      if (this.isDragging) {
        const dx = e.globalX - this.dragStart.x;
        const dy = e.globalY - this.dragStart.y;
        this.camera.x += dx;
        this.camera.y += dy;
        this.dragStart = { x: e.globalX, y: e.globalY };
      }
    });
    
    stage.on("pointerup", () => {
      this.isDragging = false;
    });
    
    // Mouse wheel to zoom
    stage.on("wheel", (e: WheelEvent) => {
      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.scale.x *= scale;
      this.camera.scale.y *= scale;
    });
  }
}
```

**Constraints:**
- Limit zoom range (0.5x – 2x)
- Clamp pan to keep content visible
- Reset button to return to default view

---

## 9. Component Structure

### 9.1 Proposed File Structure

```
client/
├── public/
│   └── assets/
│       ├── cards/             # Card sprites
│       ├── dice/              # Dice sprites
│       ├── maps/              # Risk map SVG
│       ├── icons/             # UI icons
│       └── sounds/            # Audio (future)
├── src/
│   ├── index.ts              # Entry point (creates PlaygridApp)
│   ├── Application.ts        # Main app class
│   ├── SceneManager.ts       # Scene transition system
│   ├── scenes/
│   │   ├── Scene.ts          # Base Scene interface
│   │   ├── LobbyScene.ts     # Lobby (HTML UI only, no PixiJS)
│   │   ├── WaitingRoomScene.ts
│   │   └── GameScene.ts      # Game rendering (loads GameRenderer plugin)
│   ├── renderers/
│   │   ├── GameRenderer.ts   # Base renderer interface
│   │   ├── RendererRegistry.ts
│   │   ├── CheckersRenderer.ts
│   │   ├── BackgammonRenderer.ts
│   │   ├── DominoesRenderer.ts
│   │   ├── RiskRenderer.ts
│   │   └── cards/
│   │       ├── CardGameRenderer.ts  # Base for card games
│   │       ├── PokerRenderer.ts
│   │       ├── HeartsRenderer.ts
│   │       └── SpadesRenderer.ts
│   ├── ui/
│   │   ├── LobbyScreen.ts    # Existing lobby HTML UI
│   │   ├── WaitingRoom.ts    # Existing waiting room HTML UI
│   │   ├── HUD.ts            # In-game HUD (PixiJS or HTML overlay)
│   │   ├── ChatPanel.ts      # Chat overlay
│   │   └── SpectatorOverlay.ts
│   ├── networking/
│   │   ├── ConnectionManager.ts
│   │   └── MessageHandler.ts
│   ├── state/
│   │   └── ClientGameState.ts  # Minimal local state
│   ├── assets/
│   │   ├── AssetLoader.ts
│   │   └── GameTypeIcon.ts
│   ├── input/
│   │   ├── InputManager.ts
│   │   └── Viewport.ts      # Pan/zoom for large boards
│   └── utils/
│       ├── Animation.ts     # Tween/animation helpers
│       └── LayoutUtils.ts   # Card fan, piece stacking, etc.
```

### 9.2 Key Classes & Responsibilities

**Application.ts:**
- Creates PixiJS app and Colyseus client
- Initializes scene manager
- Connects to lobby
- Handles high-level navigation (join game, leave game)

**SceneManager.ts:**
- Registers scenes
- Transitions between scenes
- Passes data to scenes (room, state)
- Calls update/resize on active scene

**GameScene.ts:**
- Loads appropriate GameRenderer based on game type
- Forwards input events to renderer
- Manages in-game UI (HUD, spectator overlay)
- Handles leave game and reconnection

**GameRenderer (interface):**
- Implemented by each game type
- Receives Colyseus state changes
- Renders game visuals with PixiJS
- Handles game-specific input
- Sends messages to server via room.send()

**LobbyScreen.ts / WaitingRoom.ts:**
- HTML UI components (existing code)
- Communicate with Application via callbacks
- Show/hide with CSS classes

**ConnectionManager.ts:**
- Handles Colyseus connection lifecycle
- Reconnection logic with exponential backoff
- Shows "reconnecting..." overlay

**AssetLoader.ts:**
- Loads game-specific assets lazily
- Caches textures
- Shows loading screen during asset load

**InputManager.ts:**
- Captures PixiJS pointer events
- Converts to game-agnostic input events
- Forwards to active renderer

**Viewport.ts:**
- Pan and zoom for large game boards (Risk)
- Mouse drag and wheel zoom
- Constraints and bounds checking

**Animation.ts:**
- Tween utilities (move piece from A to B)
- Easing functions
- Animation queue management

### 9.3 Renderer Plugin Organization

Each game renderer is a self-contained module:

```
renderers/
  CheckersRenderer.ts       # ~300 lines
  BackgammonRenderer.ts     # ~500 lines
  DominoesRenderer.ts       # ~400 lines
  RiskRenderer.ts           # ~800 lines (most complex)
  cards/
    CardGameRenderer.ts     # ~400 lines (base class)
    PokerRenderer.ts        # ~300 lines (extends base)
    HeartsRenderer.ts       # ~300 lines (extends base)
    SpadesRenderer.ts       # ~300 lines (extends base)
```

**Shared utilities:**
```
renderers/utils/
  BoardUtils.ts       # Grid calculations, square-to-pixel conversion
  PieceFactory.ts     # Reusable piece sprites (checkers, backgammon)
  DiceRenderer.ts     # Dice rolling animation (backgammon, Risk)
  CardFactory.ts      # Card sprite creation (poker, hearts, spades)
```

**Inheritance hierarchy:**
```
GameRenderer (interface)
  ├─ CheckersRenderer
  ├─ BackgammonRenderer
  ├─ DominoesRenderer
  ├─ RiskRenderer
  └─ CardGameRenderer (abstract base)
       ├─ PokerRenderer
       ├─ HeartsRenderer
       └─ SpadesRenderer
```

---

## 10. Implementation Roadmap

This is a research document, not an implementation plan. But here's a suggested order if we were to build this:

### Phase 1: Core Architecture (Week 1)
1. Refactor `index.ts` into `Application.ts` + `SceneManager.ts`
2. Create `Scene` interface and `GameScene.ts`
3. Implement `GameRenderer` interface
4. Build `RendererRegistry` for plugin loading
5. Update `LobbyScreen` and `WaitingRoom` to work with new architecture

### Phase 2: First Game Renderer (Week 2)
6. Implement `CheckersRenderer` (simplest game)
7. Build `AssetLoader` with lazy loading
8. Add in-game HUD (score, timer, back button)
9. Test full flow: lobby → waiting room → checkers game → back to lobby

### Phase 3: Card Games (Week 3)
10. Create `CardGameRenderer` base class
11. Load card sprite sheet (SVG or bitmap)
12. Implement `PokerRenderer`
13. Implement `HeartsRenderer` and `SpadesRenderer`

### Phase 4: Board Games (Week 4)
14. Implement `BackgammonRenderer`
15. Implement `DominoesRenderer`
16. Create dice and tile rendering utilities

### Phase 5: Risk (Week 5-6)
17. Source or create Risk map SVG
18. Implement `RiskRenderer` with territory polygons
19. Build attack/fortify UI flows
20. Add pan/zoom viewport for large map

### Phase 6: Polish (Week 7)
21. Add animations (piece movement, card dealing, dice rolling)
22. Implement spectator mode
23. Mobile touch optimization
24. Accessibility improvements

---

## Conclusion

This architecture provides a clean, maintainable foundation for playgrid. Key design decisions:

1. **Plugin-based renderers** — Each game is a self-contained module implementing `GameRenderer`
2. **HTML for menus, PixiJS for games** — Use the right tool for each job
3. **Server-authoritative** — Client renders state, server validates logic
4. **Scene management** — Clean transitions between lobby, waiting room, and game
5. **Lazy asset loading** — Only load assets when needed
6. **Mobile-first** — Touch input and responsive design from day one
7. **Spectator support** — Watch games without playing

The simplest games (Checkers, Backgammon, Dominoes) can use all-programmatic rendering with the PixiJS Graphics API. Card games need a sprite sheet (use open-source SVG). Risk needs a world map asset (can start with a simplified version).

This design scales from simple 2-player games to complex 6-player strategy games, and supports both turn-based and real-time gameplay. It's practical, testable, and ships fast.

— Gately

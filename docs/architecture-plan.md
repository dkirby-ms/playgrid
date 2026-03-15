# Playgrid Architecture Plan

**Author:** Hal (Lead)  
**Date:** 2025-03-14  
**Status:** Planning

## Executive Summary

This document defines the complete architecture for playgrid: a multiplayer game platform that lets users play classic board and card games with friends. The platform will support multiple game types through a plugin architecture, scale to thousands of concurrent games, and provide a seamless experience from lobby to gameplay to spectating.

**Core Principle:** Start simple, scale deliberately. Build what we need now, design for what we'll need next.

---

## 1. Server Architecture

### Current State
- Single LobbyRoom managing game sessions
- Basic GameRoom with tick-based simulation
- Direct matchMaker.createRoom integration
- No game type differentiation

### Target Architecture

#### Room Types & Responsibilities

**1. LobbyRoom (existing, evolve)**
- **Purpose:** Central hub for browsing and creating games
- **Lifecycle:** Singleton, always-on, shared by all users
- **Responsibilities:**
  - Maintain user sessions (displayName, presence)
  - Track available game sessions across all game types
  - Handle create/join/leave/ready/start flow
  - Coordinate with matchMaker to spin up GameRooms
  - NO game logic — purely orchestration
- **State:** No synchronized state (uses message passing only)
- **Scaling:** Single instance initially, can shard by region later

**2. GameRoom (abstract base, specialize per-game)**
- **Purpose:** Authoritative game logic and state synchronization
- **Lifecycle:** Created on-demand, disposed when game ends or all players leave
- **Responsibilities:**
  - Host game-specific state (board, turn order, scores)
  - Validate and process player actions
  - Tick-based or event-based simulation (game-dependent)
  - Broadcast state updates to players and spectators
  - Handle reconnection (seat reservation)
  - Report game outcomes to persistence layer
- **State:** Game-specific Schema (e.g., ChessState, PokerState)
- **Scaling:** Unlimited instances, distributed across processes

**3. SpectatorSlot (integrated into GameRoom)**
- **Purpose:** Read-only observation of active games
- **Design Decision:** Spectators join the same GameRoom but with `isSpectator` flag
- **Why?** Simplicity. Colyseus state sync works identically for players/spectators.
- **Differentiation:**
  - Spectators connect with `{ spectator: true }` option
  - Server marks them, ignores their game actions
  - May filter sensitive state (hidden cards in poker)
  - Don't count toward `maxClients` (use `allowSpectators` option)
- **Alternative (deferred):** Separate SpectatorRoom that mirrors GameRoom state. Only needed if spectator count becomes a performance issue.

#### Room Lifecycle

```
User connects → LobbyRoom (persistent)
  ↓
  Creates/joins game session → LobbyRoom tracks it
  ↓
  Host starts game → LobbyRoom calls matchMaker.createRoom("game-{type}")
  ↓
  GameRoom created → Players receive roomId, disconnect from lobby, join game
  ↓
  Game plays → GameRoom processes actions, syncs state
  ↓
  Game ends → GameRoom logs outcome, disposes, players return to lobby
```

**Connection Management:**
- **WebSocket persistence:** Users maintain single connection to lobby OR game (not both)
- **Reconnection:** Colyseus built-in `allowReconnection` + session token
  - Players can reconnect to GameRoom within timeout (default 3s, extend to 30s)
  - LobbyRoom tracks last-known game for "rejoin game" feature
- **Heartbeat:** Colyseus handles this, but we'll add `pingInterval` monitoring

---

## 2. Scaling Strategy

### Phase 1: Single Process (0-100 concurrent games)
**Current state — no changes needed yet.**
- Single Node.js process
- LocalPresence (in-memory)
- PostgreSQL (Azure Database for PostgreSQL Flexible Server)
- Deploy: Azure Container Apps (single replica, Consumption plan)

### Phase 2: Multi-Process (100-1000 concurrent games)
**Timeline: After first 3 games are live and we hit 50 concurrent games**

**Changes:**
1. **Add RedisPresence**
   ```ts
   import { RedisPresence } from "@colyseus/redis-presence";
   server.configure({
     presence: new RedisPresence()
   });
   ```
2. **Add @colyseus/proxy**
   - Sits in front of game servers
   - Routes connections based on seat reservations
   - Single entry point for clients
3. **Run multiple processes**
   - PM2 with fork mode (NOT cluster)
   - Each process on different port (2567, 2568, 2569...)
   - Proxy listens on 2567, routes to backends
4. **Shared persistence**
   - PostgreSQL with connection pooling
   - Connection pool shared across processes via env config

**Load Balancing:**
- Default Colyseus behavior: assign rooms to process with fewest rooms
- Override later if needed (e.g., game-type-based sharding)

### Phase 3: Multi-Server (1000+ concurrent games)
**Timeline: When single machine CPU/memory caps out**

**Changes:**
1. **Horizontal scaling**
   - Multiple servers, each running multiple processes
   - Redis Cluster for presence
   - Load balancer (nginx/HAProxy) in front of proxy layer
2. **Room affinity**
   - Sticky sessions for reconnection
   - Redis tracks which server/process owns each room
3. **Monitoring**
   - @colyseus/monitor for room inspector
   - Custom metrics: games/sec, avg game duration, reconnection rate

### What to Defer

**Don't build until we need it:**
- Cross-room communication (tournaments, lobbies watching games) — Phase 3+
- Auto-scaling based on load — Phase 3+
- Geographic sharding — Phase 4+
- Separate spectator infrastructure — Only if spectators outnumber players 10:1

**Design in from day 1:**
- Game type as first-class concept (enables future plugin loading)
- Room disposal logs outcomes (enables future analytics)
- Spectator flag in state sync (enables future viewer features)

---

## 2.1 Cloud Infrastructure (Azure Container Apps)

### Deployment Model

**Phase 1: Single Replica (Current)**
- **Platform:** Azure Container Apps (Consumption plan)
- **Compute:** Single container, 0.5–1 vCPU, 1–2 Gi memory
- **Database:** Azure Database for PostgreSQL Flexible Server (Burstable tier)
- **Container Registry:** Azure Container Registry (Basic)
- **Ingress:** ACA's native Envoy ingress with port 2567, WebSocket support built-in
- **Custom Domain:** playgrid.kirbytoso.xyz (cert managed by ACA)
- **Cost:** ~$20–30/mo (ACA + ACR + modest PostgreSQL tier)

**Why ACA (not VPS or self-managed)?**
- Serverless consumption pricing aligns with Phase 1 sporadic usage
- WebSocket support via Envoy proxy (no additional configuration)
- Integrates with Azure ecosystem (PostgreSQL, Key Vault, App Insights)
- Scales to multi-replica when needed (sticky sessions via Envoy)
- Deployment via GitHub Actions + Azure Container Registry

### Scaling Phases

**Phase 2: Multi-Replica (~6 months out, 50+ concurrent games)**
- Increase replicas to 2–3 on ACA
- Enable sticky sessions in Envoy (required for WebSocket room affinity)
- Add Azure Cache for Redis (Colyseus RedisPresence across replicas)
- Upgrade PostgreSQL tier
- Add application monitoring (Application Insights)
- Cost: ~$90–140/mo

**Phase 3: Full Scale (1000+ concurrent games)**
- 3–10 ACA replicas with auto-scaling on concurrent connections
- Redis Cluster for presence
- Dedicated PostgreSQL instance
- Azure Front Door for global load balancing
- Cost: ~$360–700/mo

### Supporting Infrastructure

**All Phases:**
- **Azure Container Registry:** Image storage and building
- **Application Insights:** Logging, performance monitoring
- **Azure Key Vault:** Secrets management (database credentials, Discord webhook, etc.)

**GitHub Actions CI/CD:**
- Branch strategy: main (dev) → uat → prod
- Workflows: `ci.yml` (test on PR), `deploy-dev.yml` (main push), `deploy-uat.yml` (uat push), `deploy-prod.yml` (manual/tag)
- Build: `az acr build` (cloud build in ACR, faster than local Docker)
- Deploy: `az containerapp update` (update running container)
- Health checks: Post-deploy curl to verify service readiness
- Notifications: Discord webhook to #play-grid channel

**Security & Compliance:**
- GitHub Environments for scoped secrets (dev/staging/prod)
- ACA Managed Identity for ACR pull (no admin credentials in workflows)
- OIDC-based Azure login (no static credentials)
- Key Vault references for sensitive config
- Pinned GitHub Action versions
- Minimal workflow permissions

### Colyseus-Specific Considerations

**WebSocket Affinity:**
- ACA sticky sessions keep clients connected to same replica
- Critical for reconnection after temporary network loss
- Colyseus `allowReconnection` window: 30s (configurable per game)

**State Synchronization:**
- Phase 1: Local state, no inter-process communication needed (1 replica)
- Phase 2+: RedisPresence syncs room registry across replicas
- Note: Sticky sessions route clients to correct replica, but Redis is still needed for room discovery

**Message Passing:**
- Colyseus rooms broadcast state diffs efficiently
- ACA consumption plan is cost-effective for typical message volumes

### Database Strategy

**PostgreSQL from Day One:**
- Simplifies operations (no SQLite → PostgreSQL migration later)
- Supports concurrent writes from Colyseus processes
- Connection pooling via `pg` module or pgBouncer
- Backup/recovery via Azure backup service
- Flexible Server: Burstable tier for Phase 1, scales to General Purpose as needed

**Game Data:**
```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL,
  created_at TIMESTAMP,
  ended_at TIMESTAMP,
  outcome TEXT,  -- JSON: { winner, scores, etc. }
  duration_seconds INTEGER
);

CREATE TABLE game_participants (
  game_id TEXT REFERENCES games(id),
  user_id TEXT NOT NULL,
  role TEXT,  -- 'player', 'spectator'
  joined_at TIMESTAMP,
  left_at TIMESTAMP
);
```

---

## 3. Game Abstraction Layer (Plugin System)

### The Problem
We need to support 10+ different games, each with unique rules, state, and player counts. Hardcoding each game into server/index.ts doesn't scale.

### The Solution: Game Plugin Pattern

#### Interface: IGamePlugin

Every game implements this interface:

```typescript
// shared/src/gamePlugin.ts
export interface IGamePlugin {
  // Metadata
  readonly id: string;              // "chess", "poker", "risk"
  readonly displayName: string;     // "Chess"
  readonly minPlayers: number;      // 2
  readonly maxPlayers: number;      // 2
  readonly supportsSpectators: boolean;
  
  // Schema factory
  createState(): Schema;            // Returns game-specific state
  
  // Room factory
  createRoom(): typeof Room;        // Returns game-specific Room class
  
  // Client-side entry point (optional, for dynamic import)
  readonly clientRenderer?: string; // Path to PixiJS renderer module
}
```

#### Plugin Registration (Server)

```typescript
// server/src/index.ts
import { Server } from "colyseus";
import { GameRegistry } from "./GameRegistry.js";
import { ChessPlugin } from "./games/chess/ChessPlugin.js";
import { PokerPlugin } from "./games/poker/PokerPlugin.js";

const registry = new GameRegistry();
registry.register(new ChessPlugin());
registry.register(new PokerPlugin());

const server = new Server({...});

// Register each game type as a room
for (const plugin of registry.getAllPlugins()) {
  server.define(`game-${plugin.id}`, plugin.createRoom());
}
```

#### Plugin Structure (Per-Game)

```
server/src/games/
  chess/
    ChessPlugin.ts      // Implements IGamePlugin
    ChessRoom.ts        // Extends BaseGameRoom<ChessState>
    ChessState.ts       // Schema with board, turn, moves
    chessLogic.ts       // Pure functions: isValidMove, checkmate, etc.
  poker/
    PokerPlugin.ts
    PokerRoom.ts
    PokerState.ts
    pokerLogic.ts
```

#### Base Room Template

```typescript
// server/src/rooms/BaseGameRoom.ts
export abstract class BaseGameRoom<T extends Schema> extends Room<T> {
  protected gameId?: string;
  protected gameType: string;
  
  override onCreate(options: GameRoomOptions) {
    this.gameId = options.gameId;
    this.gameType = options.gameType;
    this.setState(this.createInitialState(options));
    
    // Common setup
    if (options.maxPlayers) {
      this.maxClients = options.maxPlayers;
    }
    
    this.setupMessageHandlers();
    this.onGameStart();
  }
  
  protected abstract createInitialState(options: GameRoomOptions): T;
  protected abstract setupMessageHandlers(): void;
  protected abstract onGameStart(): void;
  protected abstract onGameEnd(): void;
  
  override onDispose() {
    this.logGameOutcome();
    this.onGameEnd();
  }
  
  private logGameOutcome() {
    // Persist game result to database
    // This is the hook for stats/leaderboards
  }
}
```

#### Per-Game State Schemas

Each game defines its own schema:

```typescript
// server/src/games/chess/ChessState.ts
import { Schema, defineTypes, ArraySchema } from "@colyseus/schema";

export class ChessState extends Schema {
  declare board: ArraySchema<string>;  // 64-element array
  declare currentTurn: "white" | "black";
  declare moveHistory: ArraySchema<string>;
  declare winner?: "white" | "black" | "draw";
}
defineTypes(ChessState, {
  board: ["string"],
  currentTurn: "string",
  moveHistory: ["string"],
  winner: "string"
});
```

```typescript
// server/src/games/poker/PokerState.ts
export class PokerState extends Schema {
  declare deck: ArraySchema<number>;
  declare pot: number;
  declare players: MapSchema<PokerPlayer>;
  declare communityCards: ArraySchema<number>;
  declare currentBettingRound: string;
}
// ... defineTypes
```

**Key insight:** No shared game state shape. Each game is fully independent.

#### Move Validation Pattern

Keep game logic pure and testable:

```typescript
// server/src/games/chess/chessLogic.ts
export function isValidMove(state: ChessState, from: string, to: string): boolean {
  // Pure function, easy to unit test
}

export function applyMove(state: ChessState, move: Move): void {
  // Mutates state (inside Room context)
}

// ChessRoom.ts
onMessage("move", (client, move) => {
  if (!isValidMove(this.state, move.from, move.to)) {
    client.send("error", "Invalid move");
    return;
  }
  applyMove(this.state, move);
});
```

#### Client-Side Renderer Pattern

Each game gets its own PixiJS renderer module:

```typescript
// client/src/games/chess/ChessRenderer.ts
export class ChessRenderer {
  private app: Application;
  private room: Room<ChessState>;
  
  constructor(app: Application, room: Room<ChessState>) {
    this.app = app;
    this.room = room;
    this.setupBoard();
    this.bindState();
  }
  
  private bindState() {
    this.room.onStateChange((state) => {
      this.renderBoard(state.board);
      this.updateTurnIndicator(state.currentTurn);
    });
  }
}

// client/src/index.ts - dynamic loading
async function loadGameRenderer(gameType: string, app: Application, room: Room) {
  const module = await import(`./games/${gameType}/${gameType}Renderer.js`);
  return new module.default(app, room);
}
```

### Benefits of This Pattern

1. **Isolation:** Each game is self-contained, can be developed independently
2. **Testability:** Pure logic functions, easy to unit test without Colyseus
3. **Discoverability:** LobbyRoom can query registry for available games
4. **Hot-loading (future):** Plugins can be loaded/unloaded without server restart
5. **Consistency:** BaseGameRoom enforces common patterns (lifecycle, persistence)

---

## 4. Matchmaking & Lobby Design

### Current Lobby Evolution

**Current:**
- Single game type (implicit)
- Game sessions have name, host, player count

**Target:**
- Multiple game types coexist
- Game sessions have `gameType` field

### Lobby Flow

```
1. User connects to LobbyRoom
   ↓
2. LobbyRoom sends GAME_LIST (filtered by gameType if requested)
   ↓
3. User creates game: { name, gameType, maxPlayers }
   ↓
4. LobbyRoom creates session entry, broadcasts GAME_UPDATED
   ↓
5. Other users join game session
   ↓
6. Host starts game → LobbyRoom calls matchMaker.createRoom(`game-${gameType}`)
   ↓
7. GameRoom created → LobbyRoom sends GAME_STARTED with roomId
   ↓
8. Clients disconnect from lobby, join game room by roomId
   ↓
9. Game ends → Clients return to lobby, LobbyRoom removes session
```

### Data Model Changes

```typescript
// shared/src/lobbyTypes.ts (extend existing)
export interface GameSessionInfo {
  id: string;
  name: string;
  gameType: string;           // NEW: "chess", "poker", etc.
  hostId: string;
  hostName: string;
  status: GameStatus;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

export interface CreateGamePayload {
  name: string;
  gameType: string;           // NEW
  maxPlayers?: number;
}
```

### Game Type Registry (Lobby)

LobbyRoom needs to know available games:

```typescript
// server/src/rooms/LobbyRoom.ts
private gameRegistry: GameRegistry;

onCreate() {
  // Respond to game type queries
  this.onMessage("query_game_types", (client) => {
    const types = this.gameRegistry.getAllPlugins().map(p => ({
      id: p.id,
      displayName: p.displayName,
      minPlayers: p.minPlayers,
      maxPlayers: p.maxPlayers
    }));
    client.send("game_types", { types });
  });
}
```

### Client Lobby UI

**New screens:**
1. **GameTypeSelector:** Grid of game tiles (chess, poker, risk...)
2. **GameBrowser:** List of active sessions for selected game type
3. **WaitingRoom:** (existing) Ready/start flow

**Navigation:**
```
Lobby → Select Game Type → Browse Sessions → Create/Join → Waiting Room → Play
     ↖────────────────────────────────── Game ends ──────────────────────────┘
```

---

## 5. Spectator System

### Design Decision: Integrated Spectators

Spectators join the same GameRoom as players, not a separate room.

**Why?**
- Simpler: Reuse existing state sync infrastructure
- Efficient: State is already being broadcast
- Flexible: Can filter state per-client if needed

**How?**

```typescript
// Server: GameRoom
override onAuth(client: Client, options: any) {
  return {
    isSpectator: options.spectator === true,
    userId: options.userId
  };
}

override onJoin(client: Client, options: any, auth: any) {
  if (auth.isSpectator) {
    // Mark as spectator, don't add to player list
    this.spectators.add(client.sessionId);
    this.send(client, "spectator_mode", { enabled: true });
  } else {
    // Add as player
    this.addPlayer(client);
  }
}

onMessage("move", (client, data) => {
  // Ignore if spectator
  if (this.spectators.has(client.sessionId)) {
    return;
  }
  // Process move...
});
```

**State Filtering (for games with hidden info):**

```typescript
// PokerRoom.ts
override getFilteredState(client: Client, state: PokerState) {
  if (this.spectators.has(client.sessionId)) {
    // Spectators see all hands (or none, depending on game rules)
    return state;
  }
  // Players only see their own hand
  return filterStateForPlayer(state, client.sessionId);
}
```

**Client-side:**

```typescript
// Join as spectator
const room = await client.joinById(roomId, { spectator: true });

// UI shows spectator badge, disables input
room.onMessage("spectator_mode", () => {
  this.renderer.disableInput();
  this.ui.showSpectatorBadge();
});
```

### Spectator Limits

**Phase 1:** No limit (trust Colyseus to handle it)  
**Phase 2:** If needed, add `maxSpectators` cap  
**Phase 3:** If spectators outnumber players 10:1, consider separate SpectatorRoom with mirror state

---

## 6. Persistence & Stats

### Phase 1: Minimal Persistence

**What to log:**
- Game outcomes (winner, duration, final scores)
- Player participation (who played, game type)

**Schema:**

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  outcome TEXT,  -- JSON: { winner, scores, etc. }
  duration_seconds INTEGER
);

CREATE TABLE game_participants (
  game_id TEXT REFERENCES games(id),
  user_id TEXT NOT NULL,
  role TEXT,  -- 'player', 'spectator'
  joined_at TIMESTAMP,
  left_at TIMESTAMP
);
```

**Where to log:**
- `BaseGameRoom.onDispose()` writes to database
- Phase 1 uses PostgreSQL (Azure Database for PostgreSQL Flexible Server)
- No ORM, use raw SQL with connection pooling

### Phase 2: Stats & Leaderboards

**Add:**
- Per-user stats table (games played, wins, losses by game type)
- Incremental stat updates on game end
- Leaderboard queries (top 100 by game type, global)

**Schema:**

```sql
CREATE TABLE user_stats (
  user_id TEXT,
  game_type TEXT,
  games_played INTEGER,
  wins INTEGER,
  losses INTEGER,
  draws INTEGER,
  total_score INTEGER,  -- game-specific
  PRIMARY KEY (user_id, game_type)
);
```

**API:**
- LobbyRoom responds to `query_leaderboard` message
- Returns top N players for game type
- No REST API yet (use Colyseus messages)

### Phase 3: Advanced Analytics

**Defer until we have 10k+ games played:**
- Detailed move history storage
- Replay functionality
- Heatmaps / common strategies
- ML-based skill ratings (Elo, TrueSkill)

**Tech stack (when needed):**
- Migrate to PostgreSQL
- Add TimescaleDB extension for time-series
- Add Redis for cached leaderboards

---

## 7. Shared Types Strategy

### Current Structure

```
shared/src/
  index.ts          // Exports everything
  lobbyTypes.ts     // Lobby messages
```

### Target Structure

```
shared/src/
  index.ts
  lobbyTypes.ts
  gameTypes.ts      // Generic game message types
  schemas/
    Player.ts       // Generic player (if needed across games)
  games/
    chess/
      ChessState.ts      // Schema
      chessTypes.ts      // Message types specific to chess
    poker/
      PokerState.ts
      pokerTypes.ts
```

### Generic vs Per-Game Types

**Generic (shared/src/gameTypes.ts):**

```typescript
export const GAME_ACTION = "game_action";
export const GAME_ERROR = "game_error";
export const GAME_ENDED = "game_ended";

export interface GameActionPayload {
  action: string;
  data: any;  // Game-specific
}

export interface GameEndedPayload {
  winner?: string;
  scores: Record<string, number>;
  outcome: string;
}
```

**Per-Game (shared/src/games/chess/chessTypes.ts):**

```typescript
export const CHESS_MOVE = "chess_move";
export const CHESS_RESIGN = "chess_resign";

export interface ChessMovePayload {
  from: string;  // "e2"
  to: string;    // "e4"
  promotion?: "Q" | "R" | "B" | "N";
}
```

### Import Pattern

```typescript
// Client/Server
import { ChessState, CHESS_MOVE } from "@eschaton/shared/games/chess";
import { GAME_ENDED } from "@eschaton/shared/gameTypes";
```

**Key decision:** Use path exports in package.json for clean imports:

```json
// shared/package.json
{
  "exports": {
    ".": "./src/index.js",
    "./games/chess": "./src/games/chess/index.js",
    "./games/poker": "./src/games/poker/index.js"
  }
}
```

---

## 8. Implementation Phases

### Phase 0: Preparation (1 day)
**Goal:** Set up architecture without breaking current code

- [ ] Create `server/src/games/` directory structure
- [ ] Create `BaseGameRoom.ts` abstraction
- [ ] Create `IGamePlugin` interface in shared
- [ ] Create `GameRegistry.ts` in server
- [ ] Update shared types with `gameType` field
- [ ] Add `docs/game-plugin-guide.md` template

**Files:**
- `shared/src/gamePlugin.ts` (new)
- `server/src/rooms/BaseGameRoom.ts` (new)
- `server/src/GameRegistry.ts` (new)
- `shared/src/lobbyTypes.ts` (modify)
- `docs/game-plugin-guide.md` (new)

**Tests:** None yet (architecture only)

---

### Phase 1: Refactor Current GameRoom as Plugin (2 days)
**Goal:** Prove the plugin pattern works with existing code

- [ ] Create `DemoPlugin` from current GameRoom
- [ ] Move GameState to `games/demo/DemoState.ts`
- [ ] Implement `BaseGameRoom` in `DemoRoom.ts`
- [ ] Register DemoPlugin in server/index.ts
- [ ] Update LobbyRoom to pass `gameType: "demo"`
- [ ] Test: Existing lobby → demo game flow works unchanged

**Files:**
- `server/src/games/demo/DemoPlugin.ts` (new)
- `server/src/games/demo/DemoRoom.ts` (refactor from GameRoom.ts)
- `server/src/games/demo/DemoState.ts` (refactor from shared)
- `server/src/index.ts` (modify)
- `server/src/rooms/LobbyRoom.ts` (modify)

**Tests:**
- End-to-end: Create demo game, join, leave, dispose

---

### Phase 2A: Implement First Real Game — Checkers (3 days)
**Goal:** Prove we can build a second game quickly

**Why Checkers first?**
- Simple rules, easy to validate
- 2 players only (no complex turn ordering)
- Visual feedback is straightforward
- Good test of plugin isolation

**Tasks:**
- [ ] Define `CheckersState` schema (8x8 board, piece positions, turn)
- [ ] Implement `CheckersRoom` (move validation, jump logic, king promotion)
- [ ] Write `checkersLogic.ts` (pure functions, unit tested)
- [ ] Create `CheckersPlugin`
- [ ] Build client `CheckersRenderer` (board, pieces, drag-drop)
- [ ] Register in GameRegistry
- [ ] Update lobby to show game type selector
- [ ] Test: Full game from lobby to checkmate

**Files:**
- `server/src/games/checkers/` (all files)
- `client/src/games/checkers/` (all files)
- `shared/src/games/checkers/` (state, types)
- `client/src/ui/GameTypeSelector.ts` (new)
- `server/src/rooms/LobbyRoom.ts` (add game type query)

**Tests:**
- Unit: checkersLogic.ts (isValidMove, isWin)
- Integration: CheckersRoom lifecycle
- E2E: Play a full game

---

### Phase 2B: Implement Second Real Game — Backgammon (4 days)
**Goal:** Prove dice mechanics and complex state work

**Why Backgammon?**
- Introduces randomness (dice rolls)
- More complex state (24 points, bar, bearing off)
- 2 players, tests turn-based flow
- Good test of server authority (prevent dice manipulation)

**Tasks:**
- [ ] Define `BackgammonState` schema
- [ ] Implement dice rolling on server (provably fair)
- [ ] Move validation (legal moves from dice)
- [ ] Client renderer with dice animation
- [ ] Register plugin

**Files:**
- `server/src/games/backgammon/` (all files)
- `client/src/games/backgammon/` (all files)
- `shared/src/games/backgammon/` (state, types)

**Tests:**
- Unit: Dice roll fairness, move legality
- E2E: Full game with bearing off

---

### Phase 3: Add Spectator Support (2 days)
**Goal:** Let users watch live games

**Tasks:**
- [ ] Add `isSpectator` flag to BaseGameRoom
- [ ] Implement spectator join flow in LobbyRoom
- [ ] Add "Watch" button to lobby game list
- [ ] Client shows spectator badge
- [ ] Disable input for spectators
- [ ] Test with Checkers and Backgammon

**Files:**
- `server/src/rooms/BaseGameRoom.ts` (modify)
- `server/src/rooms/LobbyRoom.ts` (add spectator join)
- `client/src/index.ts` (add spectator mode)
- `client/src/ui/WaitingRoom.ts` (show spectators)

**Tests:**
- E2E: Spectate a live game, see state updates

---

### Phase 4: Add Persistence (2 days)
**Goal:** Log games and start tracking stats

**Tasks:**
- [ ] Set up PostgreSQL database connection in server
- [ ] Create schema (games, game_participants)
- [ ] Implement logging in `BaseGameRoom.onDispose()`
- [ ] Add `GameHistory` API in LobbyRoom
- [ ] Client shows "Recent Games" tab in lobby
- [ ] Test: Game completion logs correctly

**Files:**
- `server/src/persistence/database.ts` (new)
- `server/src/persistence/schema.sql` (new)
- `server/src/rooms/BaseGameRoom.ts` (add logging)
- `server/src/rooms/LobbyRoom.ts` (add history query)
- `client/src/ui/GameHistory.ts` (new)

**Tests:**
- Integration: Game disposal writes to DB
- Query: Recent games API returns correct data

---

### Phase 5: Implement Third Game — Dominoes (3 days)
**Goal:** Validate plugin system at scale

**Why Dominoes?**
- Different player count (2-4 players)
- Turn order complexity
- Tests tile drawing mechanics
- Popular classic game

**Tasks:**
- [ ] Implement Dominoes plugin (same pattern as checkers)
- [ ] Support 2-4 players in room setup
- [ ] Tile drawing and placement validation
- [ ] Score calculation and rounds
- [ ] Client renderer

**Files:**
- `server/src/games/dominoes/` (all files)
- `client/src/games/dominoes/` (all files)
- `shared/src/games/dominoes/` (state, types)

---

### Phase 6: Add Simple Stats & Leaderboard (2 days)
**Goal:** Show wins/losses per player

**Tasks:**
- [ ] Add `user_stats` table
- [ ] Update stats on game end
- [ ] Add leaderboard query to LobbyRoom
- [ ] Client shows leaderboard tab
- [ ] Filter by game type

**Files:**
- `server/src/persistence/schema.sql` (modify)
- `server/src/persistence/stats.ts` (new)
- `server/src/rooms/LobbyRoom.ts` (add leaderboard query)
- `client/src/ui/Leaderboard.ts` (new)

---

### Phase 7: Implement Card Game — Poker (5 days)
**Goal:** Validate hidden state and betting mechanics

**Why Poker (Texas Hold'em)?**
- Complex betting rounds
- Hidden state (hole cards)
- 2-9 players
- Tests state filtering for spectators
- High complexity, good stress test

**Tasks:**
- [ ] Implement PokerState with per-player hands
- [ ] State filtering (players see only their cards)
- [ ] Betting round logic (check, call, raise, fold)
- [ ] Pot calculation and side pots
- [ ] Spectators see all hands (or blurred during play)
- [ ] Client renderer with chips, cards, betting UI

**Files:**
- `server/src/games/poker/` (all files)
- `client/src/games/poker/` (all files)
- `shared/src/games/poker/` (state, types)

---

### Phase 8: Scaling Preparation (3 days)
**Goal:** Prepare for Phase 2 scaling

**Tasks:**
- [ ] Add RedisPresence configuration (environment-based)
- [ ] Add @colyseus/monitor for room inspection
- [ ] Add PM2 ecosystem.config.js for multi-process
- [ ] Add health check endpoint
- [ ] Add basic metrics logging
- [ ] Document scaling runbook

**Files:**
- `server/src/index.ts` (add Redis config)
- `server/ecosystem.config.js` (new)
- `server/src/monitoring.ts` (new)
- `docs/scaling-runbook.md` (new)

**Tests:**
- Deploy: Run 3 processes locally, verify room distribution

---

### Future Phases (Not Detailed Yet)

**Phase 9:** More card games (Hearts, Spades)  
**Phase 10:** Complex board game (Risk)  
**Phase 11:** Real-time games (speed chess variants)  
**Phase 12:** Tournaments and brackets  
**Phase 13:** Chat and social features  
**Phase 14:** AI opponents (simple bots)  

---

## 9. Game Library Analysis

| Game | Complexity | Players | State Estimate | Turn Order | Special Considerations | Rec. Order |
|------|-----------|---------|---------------|-----------|----------------------|-----------|
| **Checkers** | Simple | 2 | ~100 bytes | Alternating | Jump sequences, king promotion | **1st** |
| **Backgammon** | Medium | 2 | ~200 bytes | Dice-based | Dice rolls, bar, bearing off | **2nd** |
| **Dominoes** | Simple | 2-4 | ~150 bytes | Round-robin | Tile drawing, score tracking | **3rd** |
| **Poker** | Complex | 2-9 | ~500 bytes | Betting rounds | Hidden state, side pots, all-in | **4th** |
| **Hearts** | Medium | 4 | ~200 bytes | Trick-based | Pass cards, shooting moon | 5th |
| **Spades** | Medium | 4 | ~200 bytes | Trick-based | Bidding, partnerships | 6th |
| **Chess** | Complex | 2 | ~300 bytes | Alternating | Move validation, check, castling | 7th |
| **Risk** | Very Complex | 3-6 | ~2KB | Multi-phase | Combat dice, card turns, alliances | Last |

### Rationale

**Start with Checkers:**
- Simplest rules to implement correctly
- Quick win to prove plugin system
- Good baseline for testing

**Backgammon second:**
- Introduces dice (server authority for RNG)
- Still 2-player, manageable complexity
- Validates state sync with animations

**Dominoes third:**
- First multi-player (2-4)
- Tests turn ordering with >2 players
- Round structure introduces game phases

**Poker fourth:**
- High complexity, biggest risk
- Validates hidden state filtering
- Popular game, worth the effort
- Tests betting UI patterns for other games

**Defer Chess:**
- Despite being iconic, move validation is complex
- Check/checkmate detection is non-trivial
- En passant, castling, promotion add edge cases
- Do after we've learned from simpler games

**Defer Risk:**
- Massive state (board, armies, cards, alliances)
- Multi-phase turns (attack, fortify)
- Combat resolution is complex
- Build this after we've optimized state sync
- May need special UI for map navigation

---

## 10. Technical Decisions Summary

### What We're Building

✅ **Plugin-based game system** with IGamePlugin interface  
✅ **Integrated spectators** in GameRoom (not separate rooms)  
✅ **PostgreSQL from day one** for persistence  
✅ **Single lobby, multiple game types** model  
✅ **Pure function game logic** separated from Colyseus  
✅ **Dynamic client rendering** per game type  

### What We're Deferring

❌ Separate spectator rooms (only if needed)  
❌ Cross-room communication (tournaments)  
❌ Hot-reloading plugins (static registration for now)  
❌ Auto-scaling (manual PM2 scaling first)  
❌ REST API (use Colyseus messages)  
❌ Advanced matchmaking (ELO-based)  

### Technology Choices

| Decision | Choice | Alternative Considered | Reason |
|----------|--------|----------------------|---------|
| State sync | Colyseus Schema | Manual JSON diffing | Built-in, battle-tested |
| Persistence | PostgreSQL (Azure) | SQLite, MongoDB | Relational fits game data, scalable from day one |
| Scaling | Redis Presence | Consul | Official Colyseus support |
| Client rendering | PixiJS 8 | Phaser, three.js | Already chosen, lightweight |
| Cloud platform | Azure Container Apps | AWS ECS, GCP Cloud Run | User preference, primal-grid reference |
| CI/CD | GitHub Actions | Azure DevOps | User preference, primal-grid reference |
| Testing | Vitest | Jest | Already in scaffold |

---

## 11. Next Steps

**Immediate (This Week):**
1. Get approval on this architecture plan
2. Begin Phase 0 (architecture setup)
3. Create game plugin guide template
4. Set up project board with phase tasks

**Sprint 1 (Week 1-2):**
- Complete Phase 0 + Phase 1 (refactor to plugins)
- Complete Phase 2A (Checkers)

**Sprint 2 (Week 3-4):**
- Complete Phase 2B (Backgammon)
- Complete Phase 3 (Spectators)

**Sprint 3 (Month 2):**
- Complete Phase 4 (Persistence)
- Complete Phase 5 (Dominoes)
- Begin Phase 7 (Poker) if ahead of schedule

**Review Milestones:**
- After Checkers: Validate plugin pattern works
- After Backgammon: Validate dice/RNG works
- After Dominoes: Validate multi-player works
- After Poker: Validate hidden state works
- After 50 concurrent games: Scale to multi-process

---

## Appendix A: File Structure (Target)

```
playgrid/
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── GameRegistry.ts
│   │   ├── rooms/
│   │   │   ├── BaseGameRoom.ts
│   │   │   ├── LobbyRoom.ts
│   │   ├── games/
│   │   │   ├── demo/
│   │   │   │   ├── DemoPlugin.ts
│   │   │   │   ├── DemoRoom.ts
│   │   │   │   └── DemoState.ts
│   │   │   ├── checkers/
│   │   │   │   ├── CheckersPlugin.ts
│   │   │   │   ├── CheckersRoom.ts
│   │   │   │   ├── CheckersState.ts
│   │   │   │   └── checkersLogic.ts
│   │   │   ├── backgammon/
│   │   │   ├── dominoes/
│   │   │   └── poker/
│   │   ├── persistence/
│   │   │   ├── database.ts
│   │   │   ├── schema.sql
│   │   │   └── stats.ts
│   │   └── monitoring.ts
│   └── ecosystem.config.js
├── client/
│   ├── src/
│   │   ├── index.ts
│   │   ├── ui/
│   │   │   ├── LobbyScreen.ts
│   │   │   ├── GameTypeSelector.ts
│   │   │   ├── WaitingRoom.ts
│   │   │   ├── GameHistory.ts
│   │   │   └── Leaderboard.ts
│   │   └── games/
│   │       ├── checkers/
│   │       │   └── CheckersRenderer.ts
│   │       ├── backgammon/
│   │       ├── dominoes/
│   │       └── poker/
├── shared/
│   ├── src/
│   │   ├── index.ts
│   │   ├── gamePlugin.ts
│   │   ├── lobbyTypes.ts
│   │   ├── gameTypes.ts
│   │   └── games/
│   │       ├── checkers/
│   │       │   ├── CheckersState.ts
│   │       │   └── checkersTypes.ts
│   │       ├── backgammon/
│   │       ├── dominoes/
│   │       └── poker/
└── docs/
    ├── architecture-plan.md (this file)
    ├── game-plugin-guide.md
    └── scaling-runbook.md
```

---

## Appendix B: Key APIs

### Game Plugin API

```typescript
interface IGamePlugin {
  readonly id: string;
  readonly displayName: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly supportsSpectators: boolean;
  createState(): Schema;
  createRoom(): typeof Room;
  readonly clientRenderer?: string;
}
```

### Lobby Message Protocol

```typescript
// Client → Server
"create_game" → { name, gameType, maxPlayers }
"join_game" → { gameId, spectator? }
"query_game_types" → {}

// Server → Client
"game_list" → { games: GameSessionInfo[] }
"game_types" → { types: GameTypeInfo[] }
"game_started" → { gameId, roomId }
```

### Game Message Protocol

```typescript
// Generic (all games)
"game_action" → { action, data }
"game_error" → { message }
"game_ended" → { winner?, scores, outcome }

// Game-specific
"chess_move" → { from, to, promotion? }
"poker_bet" → { amount, action: "check"|"call"|"raise"|"fold" }
```

---

**End of Plan**

This architecture is designed to be built incrementally. Each phase delivers a working, testable product. Scale when needed, not before. Start simple, stay simple.

— Hal

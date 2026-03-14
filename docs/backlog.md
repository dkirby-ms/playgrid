# PlayGrid — Project Backlog

**Author:** Hal (Lead)
**Created:** 2026-03-14
**Status:** Active

---

## How to Read This Backlog

Each work item is sized for **one agent, one session** (~1–3 files, a few hundred lines).

| Field | Meaning |
|-------|---------|
| **ID** | Short slug for reference |
| **Title** | What gets built |
| **Description** | What to do + acceptance criteria |
| **Role** | Which team member picks this up |
| **Deps** | Items that must be done first |
| **Priority** | P0 = infrastructure foundation, P1 = Checkers playable, P2 = everything else |

**Team:** Hal (Lead), Gately (Game Dev), Pemulis (Systems Dev), Steeply (Tester), Marathe (DevOps), Joelle (DevRel)

---

## Current State (What Already Exists)

Before decomposing work, here's what's built:

**Server** (`server/src/`):
- `index.ts` — Colyseus server on port 2567 with WebSocketTransport
- `rooms/LobbyRoom.ts` — Full lobby: create/join/leave/ready/start game flow, matchmaker integration
- `rooms/GameRoom.ts` — Skeleton game room with tick-based simulation, player tracking, no actual game logic
- `__tests__/lobby-pregame.test.ts` — 431-line test suite for lobby pregame flow

**Client** (`client/src/`):
- `index.ts` — Monolithic entry point: PixiJS app init, Colyseus connection, lobby/waiting room flow
- `ui/LobbyScreen.ts` — Full HTML lobby UI: game list, create form, filters, join buttons
- `ui/WaitingRoom.ts` — HTML waiting room: player list, ready/start controls
- `client/index.html` — Complete HTML + CSS for lobby and waiting room overlays

**Shared** (`shared/src/`):
- `index.ts` — Player schema, GameState schema (generic x/y player state, tick counter)
- `lobbyTypes.ts` — Lobby message constants and payload types

**Infrastructure:**
- npm workspaces monorepo (client, server, shared)
- Build: `shared → server → client` (root `npm run build`)
- Dev: concurrent client (Vite on :3000) + server (tsx watch)
- Test: vitest
- No Dockerfile, no CI pipeline, no PostgreSQL, no static file serving

**Key Gap:** The existing GameRoom is a placeholder — it tracks players with x/y coordinates and a tick counter. All game logic, plugin system, and rendering must be built from scratch. The lobby system, however, is solid and functional.

---

## Phase 0 — Minimum Viable Infrastructure (P0)

> **Goal:** Colyseus server starts, serves the client page, connects to PostgreSQL.

These items establish the deployment foundation. Without them, nothing else ships.

---

### `p0-env-config`

| | |
|---|---|
| **Title** | Environment configuration module |
| **Role** | Pemulis |
| **Deps** | — |
| **Priority** | P0 |

**Description:** Create `server/src/config.ts` that reads environment variables with sensible defaults. Variables needed: `PORT` (default 2567), `DATABASE_URL` (PostgreSQL connection string), `NODE_ENV` (development/production). Export a typed config object. Use `process.env` directly — no dotenv package needed (Docker/ACA injects env vars).

**Acceptance Criteria:**
- Config module exports typed object with all env vars
- Defaults work for local development (port 2567, localhost PostgreSQL)
- `server/src/index.ts` uses config instead of inline `process.env.PORT`

---

### `p0-static-serving`

| | |
|---|---|
| **Title** | Serve static client files from Colyseus server |
| **Role** | Pemulis |
| **Deps** | `p0-env-config` |
| **Priority** | P0 |

**Description:** Add Express middleware to serve Vite-built client assets from a `public/` directory in production. The Colyseus `WebSocketTransport` accepts an Express `app` — pass one in with `express.static()` middleware. In dev mode, Vite dev server handles the client separately (no change needed). Add a `/health` endpoint that returns `{ status: "ok" }` for deployment health checks.

**Acceptance Criteria:**
- `npm run build` at root produces `client/dist/` (already works)
- Server serves `client/dist/` as static files when `public/` directory or `client/dist/` exists
- `GET /health` returns 200 with JSON status
- WebSocket connections still work on the same port
- Dev workflow (`npm run dev`) unchanged

---

### `p0-pg-connection`

| | |
|---|---|
| **Title** | PostgreSQL connection module |
| **Role** | Pemulis |
| **Deps** | `p0-env-config` |
| **Priority** | P0 |

**Description:** Add `pg` package to server dependencies. Create `server/src/db.ts` with a connection pool (`new Pool()`), using `DATABASE_URL` from config. Export `query()` and `getPool()` helpers. Include a `connectDb()` function that verifies the connection on startup (run `SELECT 1`). Call it from `server/src/index.ts` before `server.listen()`.

**Acceptance Criteria:**
- `pg` added to `server/package.json` dependencies
- `server/src/db.ts` exports pool, query helper, connect function
- Server logs successful DB connection on startup
- Server logs error and exits gracefully if DB is unreachable
- Connection pool uses sensible defaults (max 10 connections)

---

### `p0-db-schema`

| | |
|---|---|
| **Title** | Database schema — games and participants tables |
| **Role** | Pemulis |
| **Deps** | `p0-pg-connection` |
| **Priority** | P0 |

**Description:** Create `server/src/db/schema.sql` with the approved schema from the architecture plan. Create `server/src/db/migrate.ts` that reads the SQL file and runs it on startup (idempotent — use `CREATE TABLE IF NOT EXISTS`). Tables: `games` (id, game_type, created_at, ended_at, outcome JSON, duration_seconds) and `game_participants` (game_id, user_id, role, joined_at, left_at). Call migration from `connectDb()`.

**Acceptance Criteria:**
- Schema file matches architecture plan's approved design
- Migration runs automatically on server start
- Migration is idempotent (safe to run multiple times)
- Tables are created in PostgreSQL

---

### `p0-dockerfile`

| | |
|---|---|
| **Title** | Multi-stage Dockerfile for containerized deployment |
| **Role** | Marathe |
| **Deps** | `p0-static-serving` |
| **Priority** | P0 |

**Description:** Create a `Dockerfile` at the repo root following the primal-grid pattern. Multi-stage build: (1) install dependencies with `npm ci`, (2) build shared → server → client, (3) copy `server/dist/`, `shared/dist/`, `client/dist/` to a `node:22-alpine` runtime image. Copy `client/dist/` to `public/` so the server can serve it. Expose port 2567. Add `.dockerignore` excluding `node_modules`, `.git`, `docs/`, `.squad/`.

**Acceptance Criteria:**
- `docker build -t playgrid .` succeeds
- `docker run -p 2567:2567 playgrid` starts the server
- Client is accessible at `http://localhost:2567` in the container
- Image size is reasonable (<200MB)
- `.dockerignore` prevents unnecessary files from entering the build context

---

### `p0-ci-pipeline`

| | |
|---|---|
| **Title** | GitHub Actions CI pipeline (ci.yml) |
| **Role** | Marathe |
| **Deps** | — |
| **Priority** | P0 |

**Description:** Create `.github/workflows/ci.yml` triggered on PRs to `main`. Steps: checkout, setup Node 22, `npm ci`, `npm run build`, `npm run test`. Use concurrency groups to cancel stale PR builds. Add path filters to skip on docs-only changes. Pin action versions. Set minimal permissions (`contents: read`).

**Acceptance Criteria:**
- Workflow triggers on PRs to `main`
- Builds all three workspaces (shared, server, client)
- Runs vitest test suite
- Cancels previous runs for same PR
- Skips on docs-only changes

---

### `p0-ci-lint`

| | |
|---|---|
| **Title** | ESLint configuration and CI lint step |
| **Role** | Marathe |
| **Deps** | `p0-ci-pipeline` |
| **Priority** | P0 |

**Description:** Verify ESLint is configured (root `package.json` has `lint` script). Add ESLint config if missing (flat config, TypeScript support). Add lint step to `ci.yml` after build. Ensure lint passes on existing code or fix any violations.

**Acceptance Criteria:**
- `npm run lint` runs successfully on existing codebase
- CI pipeline includes lint step
- No lint errors in existing code

---

## Phase 1A — Game Plugin Foundation (P1)

> **Goal:** Build the server-side game plugin system that all games will use.

These items create the architecture that Checkers (and every future game) plugs into.

---

### `p1-shared-game-types`

| | |
|---|---|
| **Title** | Game plugin interfaces and shared types |
| **Role** | Pemulis |
| **Deps** | — |
| **Priority** | P1 |

**Description:** Create `shared/src/gamePlugin.ts` with the `GamePlugin` interface, `GameMetadata`, `GameLifecycle`, `TurnConfiguration`, `GameActionHandlers`, `GameConditions`, and `GameResult` types — as specified in the game-systems-design doc (Section 1.1–1.5). Keep it type-only (no runtime code) so it works in both server and client. Export from `shared/src/index.ts`.

**Acceptance Criteria:**
- All interfaces from design doc Section 1 are defined
- Types are generic over state type (`GamePlugin<TState>`)
- No runtime dependencies — pure TypeScript interfaces
- Exported from shared package

---

### `p1-base-game-state`

| | |
|---|---|
| **Title** | BaseGameState schema for all games |
| **Role** | Pemulis |
| **Deps** | `p1-shared-game-types` |
| **Priority** | P1 |

**Description:** Create `shared/src/BaseGameState.ts` with a `BaseGameState` Colyseus schema that all games extend. Fields: `phase` ("waiting" | "playing" | "ended"), `currentTurn` (string — session ID of active player), `turnNumber` (number), `players` (MapSchema of a `PlayerInfo` schema with sessionId, displayName, playerIndex, isSpectator, isConnected). Keep the existing `GameState` in `index.ts` for now (the GameRoom still uses it); `BaseGameState` will be used by the new plugin-based rooms.

**Acceptance Criteria:**
- `BaseGameState` schema with phase, currentTurn, turnNumber, players
- `PlayerInfo` schema with sessionId, displayName, playerIndex, isSpectator, isConnected
- Uses `defineTypes()` correctly for Colyseus serialization
- Exported from shared package
- Does not break existing `GameState` import paths

---

### `p1-turn-manager`

| | |
|---|---|
| **Title** | Turn management system |
| **Role** | Pemulis |
| **Deps** | `p1-base-game-state` |
| **Priority** | P1 |

**Description:** Create `server/src/game/TurnManager.ts` implementing sequential turn management. Responsibilities: track turn order (array of session IDs), advance to next player, handle player removal from turn order, optional turn timer (configurable timeout, callback on expiry). Start with sequential mode only — phased turns (Risk) deferred to P2.

**Acceptance Criteria:**
- `TurnManager` class with `startTurns()`, `nextTurn()`, `getCurrentPlayer()`, `removePlayer()`
- Configurable turn time limit (default 60s, optional)
- Fires callback on turn timeout
- Turn order is deterministic (player index order)
- Pure logic — no Colyseus dependency (testable standalone)

---

### `p1-game-registry`

| | |
|---|---|
| **Title** | Game registry for plugin registration and lookup |
| **Role** | Pemulis |
| **Deps** | `p1-shared-game-types` |
| **Priority** | P1 |

**Description:** Create `server/src/game/GameRegistry.ts`. A singleton that stores registered `GamePlugin` instances by ID. Methods: `register(plugin)`, `get(gameType): GamePlugin`, `getAll(): GamePlugin[]`, `has(gameType): boolean`. Games register themselves at server startup. The registry is queried by `BaseGameRoom` to load the right plugin and by `LobbyRoom` to validate game types.

**Acceptance Criteria:**
- `GameRegistry` singleton with register/get/getAll/has methods
- Throws on duplicate registration
- Throws on get() for unknown game type
- Returns metadata (min/max players, name) for lobby use

---

### `p1-base-game-room`

| | |
|---|---|
| **Title** | BaseGameRoom — plugin-driven game room |
| **Role** | Pemulis |
| **Deps** | `p1-game-registry`, `p1-turn-manager`, `p1-base-game-state` |
| **Priority** | P1 |

**Description:** Create `server/src/game/BaseGameRoom.ts` extending Colyseus `Room`. On `onCreate`, look up the plugin from `GameRegistry` by `gameType` option, create state via `plugin.createState()`, set up message handlers from `plugin.actions`, wire lifecycle hooks. Handle player join/leave through plugin lifecycle. Manage turn advancement via `TurnManager`. Existing `GameRoom.ts` stays untouched for now — `BaseGameRoom` is registered under a different room type (e.g., `"game-{type}"` or just `"game"` with gameType option).

**Acceptance Criteria:**
- `BaseGameRoom` loads plugin by gameType from options
- Creates game-specific state via plugin factory
- Routes player messages to plugin action handlers
- Calls plugin lifecycle hooks (onPlayerJoin, onGameStart, onPlayerLeave, onGameEnd)
- Validates actions via plugin before applying
- Integrates TurnManager for turn tracking
- Reports game outcome to persistence layer (log to DB, can be basic)

---

### `p1-lobby-gametype`

| | |
|---|---|
| **Title** | Add gameType to lobby flow |
| **Role** | Pemulis |
| **Deps** | `p1-game-registry` |
| **Priority** | P1 |

**Description:** Update the lobby system to support game types. Changes: (1) Add `gameType` field to `CreateGamePayload` and `GameSessionInfo` in `shared/src/lobbyTypes.ts`. (2) In `LobbyRoom.ts`, validate `gameType` against `GameRegistry` on create, pass it through to `matchMaker.createRoom()` options, include it in game session broadcasts. (3) Default to `"checkers"` if no gameType provided (backward compat). Keep `maxPlayers` validation — also validate against plugin metadata (min/max players).

**Acceptance Criteria:**
- `gameType` added to shared lobby types
- LobbyRoom validates gameType against GameRegistry
- LobbyRoom passes gameType to matchMaker.createRoom options
- GameSessionInfo includes gameType in broadcasts
- Backward compatible — omitting gameType defaults to "checkers"

---

## Phase 1B — Checkers Game Logic (P1)

> **Goal:** Implement Checkers as the first game plugin with pure, testable logic.

---

### `p1-checkers-state`

| | |
|---|---|
| **Title** | Checkers state schema |
| **Role** | Gately |
| **Deps** | `p1-base-game-state` |
| **Priority** | P1 |

**Description:** Create `shared/src/games/checkers/CheckersState.ts`. Extend `BaseGameState` with Checkers-specific fields: `board` (ArraySchema of numbers — 64 cells, 0=empty, 1=black, 2=red, 3=blackKing, 4=redKing), `mustCaptureFrom` (number, -1 when no forced jump chain). Use `defineTypes()` for serialization. Export cell value constants.

**Acceptance Criteria:**
- `CheckersState` extends `BaseGameState`
- Board is 64-cell array with piece type encoding
- `mustCaptureFrom` tracks forced jump chains (-1 = none)
- Piece type constants exported (EMPTY, BLACK, RED, BLACK_KING, RED_KING)
- Colyseus schema serialization works correctly

---

### `p1-checkers-logic`

| | |
|---|---|
| **Title** | Checkers pure game logic functions |
| **Role** | Gately |
| **Deps** | `p1-checkers-state` |
| **Priority** | P1 |

**Description:** Create `server/src/games/checkers/checkersLogic.ts` with pure functions (no Colyseus imports — operates on plain data or state objects). Functions: `initializeBoard()` → sets up starting position, `getValidMoves(board, cellIndex, mustCaptureFrom)` → returns array of valid target cells, `isValidMove(board, from, to, currentPlayer, mustCaptureFrom)` → boolean, `applyMove(board, from, to)` → returns new board state + captured piece info + whether jump chain continues, `checkWinCondition(board, currentPlayer)` → returns winner or null, `isKingPromotion(to, pieceType)` → boolean. All functions are deterministic and testable.

**Acceptance Criteria:**
- All functions are pure (no side effects, no Colyseus dependency)
- Forced capture rule implemented (if a jump is available, it must be taken)
- Multi-jump chains work correctly
- King promotion at opposite end
- Kings move/capture in all diagonal directions
- Win detection: opponent has no pieces OR no legal moves

---

### `p1-checkers-logic-tests`

| | |
|---|---|
| **Title** | Unit tests for Checkers game logic |
| **Role** | Steeply |
| **Deps** | `p1-checkers-logic` |
| **Priority** | P1 |

**Description:** Create `server/src/games/checkers/__tests__/checkersLogic.test.ts`. Test all pure functions from checkersLogic.ts. Cover: initial board setup, regular moves, capture moves, forced captures, multi-jump chains, king promotion, king movement, win conditions (no pieces left, no legal moves), invalid move rejection. Use vitest. Aim for thorough coverage of edge cases — this is the game's correctness guarantee.

**Acceptance Criteria:**
- Tests for `initializeBoard()` — correct starting position
- Tests for `getValidMoves()` — regular moves, jumps, king moves
- Tests for forced capture rule — must jump when available
- Tests for multi-jump chains — continue capturing
- Tests for king promotion — promote at end row
- Tests for `checkWinCondition()` — both win conditions
- Tests for invalid moves — out of bounds, wrong player's piece, occupied target
- All tests pass

---

### `p1-checkers-plugin`

| | |
|---|---|
| **Title** | Checkers game plugin |
| **Role** | Gately |
| **Deps** | `p1-checkers-logic`, `p1-base-game-room` |
| **Priority** | P1 |

**Description:** Create `server/src/games/checkers/CheckersPlugin.ts` implementing `GamePlugin<CheckersState>`. Wire together: metadata (2 players, complexity 2, no hidden info), `createState()` returns new `CheckersState`, lifecycle hooks (onGameStart initializes board, onPlayerJoin assigns colors), action handlers (handle "move" messages by validating and applying via pure logic functions), win condition checks after each move. Register in `server/src/index.ts` via `GameRegistry.register()`.

**Acceptance Criteria:**
- Implements `GamePlugin<CheckersState>` interface
- `createState()` returns properly initialized CheckersState
- `onGameStart` sets up the board via `initializeBoard()`
- Player color assignment (first player = black, second = red)
- "move" action validated via `isValidMove()`, applied via `applyMove()`
- Win condition checked after each move
- Game ends and reports result when win detected
- Registered in GameRegistry at server startup

---

### `p1-checkers-plugin-tests`

| | |
|---|---|
| **Title** | Integration tests for Checkers plugin |
| **Role** | Steeply |
| **Deps** | `p1-checkers-plugin` |
| **Priority** | P1 |

**Description:** Create `server/src/games/checkers/__tests__/checkersPlugin.test.ts`. Test the plugin at a higher level than pure logic: verify plugin metadata, state creation, lifecycle hook behavior, action handler validation and application, turn management integration, and game completion flow. Mock Colyseus Room/Client as needed (follow pattern from `lobby-pregame.test.ts`).

**Acceptance Criteria:**
- Plugin metadata tests (id, name, player count)
- State creation tests (initial state is valid)
- Game start lifecycle test (board initialized, first player set)
- Move action handler tests (valid move applied, invalid move rejected)
- Turn advancement tests (alternates between players correctly)
- Game completion test (win condition triggers game end)

---

## Phase 1C — Client Architecture (P1)

> **Goal:** Refactor the client to support game rendering plugins, then build the Checkers renderer.

---

### `p1-scene-manager`

| | |
|---|---|
| **Title** | Scene management system |
| **Role** | Gately |
| **Deps** | — |
| **Priority** | P1 |

**Description:** Create `client/src/SceneManager.ts` and `client/src/scenes/Scene.ts`. The `Scene` interface defines lifecycle: `onEnter(data)`, `onExit()`, `update(deltaTime)`, `resize(width, height)`. `SceneManager` holds registered scenes, manages transitions (exit current → enter next), forwards update/resize ticks to active scene. Scenes can be PixiJS-based (using Container) or HTML-overlay-based. This is infrastructure — no scenes need to be created yet.

**Acceptance Criteria:**
- `Scene` interface with onEnter, onExit, update, resize
- `SceneManager` with registerScene, transitionTo, update, resize
- Async transitions (onEnter/onExit return Promise)
- Only one scene active at a time
- Stage management: adds/removes scene containers from PixiJS stage

---

### `p1-app-refactor`

| | |
|---|---|
| **Title** | Refactor client entry point to Application class |
| **Role** | Gately |
| **Deps** | `p1-scene-manager` |
| **Priority** | P1 |

**Description:** Refactor `client/src/index.ts` into `client/src/Application.ts` + thin `index.ts` entry point. Move PixiJS init, Colyseus client creation, and lobby connection into `PlaygridApp` class. Integrate `SceneManager`. Create `LobbyScene` (wraps existing `LobbyScreen` HTML overlay), `WaitingRoomScene` (wraps existing `WaitingRoom`), and a placeholder `GameScene`. The existing HTML overlays (`LobbyScreen.ts`, `WaitingRoom.ts`) remain unchanged — scenes just coordinate them.

**Acceptance Criteria:**
- `PlaygridApp` class with `init()`, `joinGame()`, `leaveGame()`
- `SceneManager` integrated with scene transitions
- `LobbyScene` wraps existing LobbyScreen
- `WaitingRoomScene` wraps existing WaitingRoom
- `GameScene` exists as placeholder (shows "Game loading..." text)
- Existing lobby/waiting room flow works identically to before
- `index.ts` is a thin bootstrap: `new PlaygridApp().init(container)`

---

### `p1-renderer-system`

| | |
|---|---|
| **Title** | Game renderer interface and registry |
| **Role** | Gately |
| **Deps** | `p1-scene-manager` |
| **Priority** | P1 |

**Description:** Create `client/src/renderers/GameRenderer.ts` (interface) and `client/src/renderers/RendererRegistry.ts` (registration). `GameRenderer` interface: `gameType`, `container` (PixiJS Container), `init(room, state)`, `onStateChange(state)`, `update(deltaTime)`, `resize(width, height)`, `handleInput(event)`, `destroy()`. `RendererRegistry`: static `register(gameType, rendererClass)` and `create(gameType)`. These match the client-architecture doc Section 2.1–2.2.

**Acceptance Criteria:**
- `GameRenderer` interface matches design doc
- `RendererRegistry` with register/create
- `RendererInputEvent` type defined
- Throws on unknown game type in `create()`
- No runtime dependencies beyond PixiJS types

---

### `p1-game-scene`

| | |
|---|---|
| **Title** | GameScene — loads renderer and connects to room |
| **Role** | Gately |
| **Deps** | `p1-renderer-system`, `p1-app-refactor` |
| **Priority** | P1 |

**Description:** Implement `client/src/scenes/GameScene.ts` as a real Scene. On `onEnter({ room, gameType })`: create renderer from `RendererRegistry`, call `renderer.init(room, state)`, add renderer container to scene, bind `room.onStateChange` to `renderer.onStateChange`. Forward `update()` and `resize()` to renderer. On `onExit()`: call `renderer.destroy()`, clean up room listeners. Add a "Leave Game" button (HTML overlay or PixiJS UI) that triggers navigation back to lobby.

**Acceptance Criteria:**
- Creates renderer for the given gameType
- Renderer receives state changes from Colyseus room
- Update/resize forwarded to renderer each frame
- Leave button returns to lobby scene
- Renderer properly cleaned up on scene exit
- Handles missing renderer gracefully (shows error message)

---

### `p1-lobby-gametype-ui`

| | |
|---|---|
| **Title** | Game type selection in lobby UI |
| **Role** | Gately |
| **Deps** | `p1-lobby-gametype` |
| **Priority** | P1 |

**Description:** Update `client/src/ui/LobbyScreen.ts` to include a game type dropdown in the create-game form. For now, only "Checkers" is available (hardcoded option). The selected game type is sent as `gameType` in the `CreateGamePayload`. Also display the game type in the game list table (add a "Type" column). Update the `GameSessionInfo` usage to include the new `gameType` field.

**Acceptance Criteria:**
- Game type dropdown in create form (currently just "Checkers")
- Selected gameType included in create_game message payload
- Game list table shows game type column
- Works with existing lobby flow
- Dropdown is extensible (easy to add more game types later)

---

## Phase 1D — Checkers Renderer (P1)

> **Goal:** Render a playable Checkers game in the browser with PixiJS.

---

### `p1-checkers-board-renderer`

| | |
|---|---|
| **Title** | Checkers renderer — board and piece rendering |
| **Role** | Gately |
| **Deps** | `p1-game-scene`, `p1-checkers-state` |
| **Priority** | P1 |

**Description:** Create `client/src/renderers/CheckersRenderer.ts` implementing `GameRenderer`. Draw an 8×8 checkerboard using PixiJS Graphics (alternating light/dark squares). Render pieces as circles — black pieces, red pieces, kings (with a crown/star indicator). Position pieces based on `CheckersState.board` array. Update piece positions on `onStateChange()`. Register with `RendererRegistry`. Use procedural graphics (no image assets needed).

**Acceptance Criteria:**
- 8×8 board with alternating square colors
- Pieces rendered as colored circles on correct squares
- Kings visually distinct from regular pieces (crown or double-stack)
- Board scales to fit container (responsive)
- Pieces update when state changes
- Registered in RendererRegistry as "checkers"

---

### `p1-checkers-interaction`

| | |
|---|---|
| **Title** | Checkers renderer — piece selection and move input |
| **Role** | Gately |
| **Deps** | `p1-checkers-board-renderer` |
| **Priority** | P1 |

**Description:** Add interaction to `CheckersRenderer`: click a piece to select it (highlight selected piece + show valid move targets), click a valid target to send a "move" message to the server. Use PixiJS pointer events on each square. Show valid move indicators (dots or highlighted squares). Deselect on clicking invalid target or own piece again. Only allow selecting pieces belonging to the current player (check `currentTurn` from state).

**Acceptance Criteria:**
- Click own piece to select (visual highlight)
- Valid move targets shown as indicators
- Click valid target sends move to server
- Click elsewhere deselects
- Cannot select opponent's pieces
- Cannot interact when it's not your turn
- Touch-friendly (44px+ hit areas per square)

---

### `p1-checkers-polish`

| | |
|---|---|
| **Title** | Checkers renderer — game status and polish |
| **Role** | Gately |
| **Deps** | `p1-checkers-interaction` |
| **Priority** | P1 |

**Description:** Add game status display to CheckersRenderer: show whose turn it is, piece counts for each player, game result when game ends (win/loss/draw overlay). Add simple move animations (piece slides to new position using PixiJS ticker/tween). Show captured piece removal animation. Add player color assignment display ("You are Black/Red"). This is the polish pass that makes Checkers feel playable.

**Acceptance Criteria:**
- Turn indicator shows whose turn it is ("Your turn" / "Opponent's turn")
- Piece count display for both players
- Game over overlay with winner announcement
- Simple slide animation for piece movement
- Captured piece removal visual feedback
- Player color shown at game start

---

### `p1-e2e-checkers`

| | |
|---|---|
| **Title** | End-to-end test: Checkers game flow |
| **Role** | Steeply |
| **Deps** | `p1-checkers-polish`, `p1-checkers-plugin` |
| **Priority** | P1 |

**Description:** Create a server-side integration test that verifies the full Checkers flow: two simulated clients join lobby → create game (type: checkers) → enter waiting room → start game → make moves → game concludes. Test at the Colyseus message level (no browser needed). Verify: state sync works, turns alternate, invalid moves rejected, game end detected, outcome logged.

**Acceptance Criteria:**
- Test creates lobby room, two clients join
- Client creates game with gameType "checkers"
- Both clients join and ready up
- Game starts, CheckersState is initialized
- Moves are validated and state updates broadcast
- Invalid moves are rejected with error
- Game can complete (simulate to win condition or verify partial)
- All assertions pass

---

## Phase 2 — Deployment & Infrastructure (P2)

> **Goal:** Get PlayGrid deployed to Azure and establish the full CI/CD pipeline.

---

### `p2-deploy-dev`

| | |
|---|---|
| **Title** | Deploy-dev workflow (main → Azure) |
| **Role** | Marathe |
| **Deps** | `p0-dockerfile`, `p0-ci-pipeline` |
| **Priority** | P2 |

**Description:** Create `.github/workflows/deploy-dev.yml` triggered on push to `main`. Steps: Azure OIDC login, `az acr build` (build image in ACR), `az containerapp update` (deploy to playgrid-dev). Add post-deploy health check (curl /health endpoint). Add Discord notification on success/failure. Use concurrency groups. Follow primal-grid patterns but use `az acr build` instead of local Docker.

**Acceptance Criteria:**
- Triggers on push to main
- Builds Docker image in ACR
- Deploys to dev Container App
- Health check verifies deployment
- Discord notification sent
- Concurrency group prevents simultaneous deploys

---

### `p2-deploy-uat`

| | |
|---|---|
| **Title** | Deploy-UAT workflow (uat branch → Azure) |
| **Role** | Marathe |
| **Deps** | `p2-deploy-dev` |
| **Priority** | P2 |

**Description:** Create `.github/workflows/deploy-uat.yml` triggered on push to `uat` branch. Same pattern as deploy-dev, targeting playgrid-uat Container App. Use GitHub Environment `uat` for scoped secrets.

**Acceptance Criteria:**
- Triggers on push to uat
- Deploys to UAT Container App
- Uses uat GitHub Environment
- Health check after deploy

---

### `p2-deploy-prod`

| | |
|---|---|
| **Title** | Deploy-prod workflow (manual/tag → Azure) |
| **Role** | Marathe |
| **Deps** | `p2-deploy-uat` |
| **Priority** | P2 |

**Description:** Create `.github/workflows/deploy-prod.yml` triggered manually (workflow_dispatch) or on version tag push. Targets playgrid-prod. Requires GitHub Environment `prod` with required reviewers for approval gate.

**Acceptance Criteria:**
- Manual trigger or tag-based trigger
- Requires approval via GitHub Environment protection
- Deploys to prod Container App
- Health check after deploy

---

### `p2-bicep-infra`

| | |
|---|---|
| **Title** | Azure Bicep infrastructure-as-code |
| **Role** | Marathe |
| **Deps** | — |
| **Priority** | P2 |

**Description:** Create `infra/main.bicep` defining all Azure resources: Container App Environment, Container App (playgrid-dev), ACR, PostgreSQL Flexible Server, Log Analytics workspace. Parameterize for environment (dev/uat/prod). Create `infra/deploy-infra.yml` GitHub Actions workflow for infrastructure changes. Include Key Vault for secrets management.

**Acceptance Criteria:**
- Bicep template creates all Phase 1 Azure resources
- Parameterized for dev/uat/prod environments
- Includes PostgreSQL, ACR, Container App, Log Analytics
- GitHub Actions workflow for infra deployment
- Key Vault for secret management

---

### `p2-game-persistence`

| | |
|---|---|
| **Title** | Persist game outcomes to PostgreSQL |
| **Role** | Pemulis |
| **Deps** | `p0-db-schema`, `p1-base-game-room` |
| **Priority** | P2 |

**Description:** Create `server/src/db/gameRepository.ts` with functions: `createGame(gameType, playerIds)`, `endGame(gameId, outcome, duration)`, `addParticipant(gameId, userId, role)`. Call from `BaseGameRoom` lifecycle: insert game record on room create, add participants on join, update with outcome on game end. Ensure DB errors don't crash the game room (log and continue).

**Acceptance Criteria:**
- Game created in DB when BaseGameRoom starts
- Participants recorded on join
- Outcome and duration saved on game end
- DB errors logged but don't crash the room
- Functions are testable (accept pool as parameter)

---

### `p2-game-persistence-tests`

| | |
|---|---|
| **Title** | Tests for game persistence layer |
| **Role** | Steeply |
| **Deps** | `p2-game-persistence` |
| **Priority** | P2 |

**Description:** Create `server/src/db/__tests__/gameRepository.test.ts`. Test CRUD operations for games and participants. Use a test PostgreSQL database or mock the pg Pool. Verify: game creation, participant addition, game completion updates, error handling.

**Acceptance Criteria:**
- Tests for createGame, endGame, addParticipant
- Tests for error handling (DB down, constraint violations)
- Tests pass in CI

---

### `p2-reconnection`

| | |
|---|---|
| **Title** | Player reconnection support |
| **Role** | Pemulis |
| **Deps** | `p1-base-game-room` |
| **Priority** | P2 |

**Description:** Add reconnection support to `BaseGameRoom`. Use Colyseus `allowReconnection()` in `onLeave` with configurable timeout (default 30s). On reconnect, restore player's state and re-sync. Track player connection status in `PlayerInfo.isConnected`. Show disconnection/reconnection status to other players. Handle timeout (player forfeits or game pauses depending on game type).

**Acceptance Criteria:**
- `allowReconnection` called in onLeave with 30s timeout
- Reconnected player sees current state
- Other players see disconnect/reconnect status
- Timeout triggers forfeit or game end
- Works with Checkers plugin

---

### `p2-spectator-mode`

| | |
|---|---|
| **Title** | Spectator mode — join game as observer |
| **Role** | Pemulis |
| **Deps** | `p1-base-game-room` |
| **Priority** | P2 |

**Description:** Add spectator support to `BaseGameRoom`. Players joining with `{ spectator: true }` option get `isSpectator` flag — their game actions are ignored, they receive state updates but don't count toward maxClients. Update lobby to show spectator option for in-progress games. Client needs a "Watch" button in the game list for active games.

**Acceptance Criteria:**
- Spectators can join in-progress games
- Spectator actions are rejected
- Spectators receive state sync
- Don't count toward maxClients
- Lobby shows spectator join option

---

## Phase 2 — Additional Features (P2)

---

### `p2-lobby-tests-update`

| | |
|---|---|
| **Title** | Update lobby tests for gameType support |
| **Role** | Steeply |
| **Deps** | `p1-lobby-gametype` |
| **Priority** | P2 |

**Description:** Update `server/src/__tests__/lobby-pregame.test.ts` to cover the new `gameType` field in create/join flow. Add tests: create game with valid gameType, create with invalid gameType (error), gameType appears in game list broadcasts, gameType passed to matchMaker.createRoom options.

**Acceptance Criteria:**
- Existing lobby tests still pass
- New tests for gameType validation
- New tests for gameType in broadcasts
- New tests for gameType in room creation

---

### `p2-client-networking`

| | |
|---|---|
| **Title** | Client connection manager |
| **Role** | Gately |
| **Deps** | `p1-app-refactor` |
| **Priority** | P2 |

**Description:** Create `client/src/networking/ConnectionManager.ts`. Centralize Colyseus connection logic: server URL construction, lobby room join, game room join by ID, connection state tracking, auto-reconnect attempts, error handling. Extract this logic from `Application.ts` to clean up the app class. Emit events for connection state changes.

**Acceptance Criteria:**
- Centralizes all Colyseus connection logic
- Tracks connection state (disconnected, connecting, connected)
- Handles reconnection attempts
- Application.ts delegates to ConnectionManager
- Error events emitted for UI to display

---

### `p2-hud-overlay`

| | |
|---|---|
| **Title** | In-game HUD overlay |
| **Role** | Gately |
| **Deps** | `p1-game-scene` |
| **Priority** | P2 |

**Description:** Create `client/src/ui/HUD.ts` — an HTML overlay displayed during gameplay. Shows: player names and scores, turn indicator, game timer (if applicable), leave game button, chat toggle (placeholder). The HUD is managed by GameScene — shown on enter, hidden on exit. HTML-based (not PixiJS) per the hybrid UI decision.

**Acceptance Criteria:**
- HTML overlay visible during gameplay
- Shows player info and turn status
- Leave button triggers scene transition
- Responsive layout
- Integrates with GameScene lifecycle

---

### `p2-app-insights`

| | |
|---|---|
| **Title** | Application Insights integration |
| **Role** | Pemulis |
| **Deps** | `p0-env-config` |
| **Priority** | P2 |

**Description:** Add `applicationinsights` npm package to server. Create `server/src/telemetry.ts` that initializes App Insights with connection string from env vars. Track custom events: room created, game started, game ended, player connected/disconnected. Track exceptions. Set daily ingestion cap. No-op gracefully if connection string not configured (local dev).

**Acceptance Criteria:**
- App Insights SDK initialized on server start
- Custom events tracked for key lifecycle moments
- Unhandled exceptions captured
- Graceful no-op when not configured
- Daily cap configured

---

### `p2-api-docs`

| | |
|---|---|
| **Title** | Developer documentation — setup and architecture guide |
| **Role** | Joelle |
| **Deps** | `p0-static-serving`, `p0-pg-connection` |
| **Priority** | P2 |

**Description:** Update `README.md` with: project description, prerequisites (Node 22, PostgreSQL), setup instructions (clone, npm ci, create DB, npm run dev), project structure explanation, how to add a new game (plugin pattern overview), deployment overview. Keep it concise — link to docs/ for deep dives.

**Acceptance Criteria:**
- README has clear setup instructions
- Prerequisites listed
- Dev workflow documented
- Project structure explained
- Link to architecture docs
- New contributor can get running in <10 minutes

---

### `p2-game-plugin-docs`

| | |
|---|---|
| **Title** | Game plugin developer guide |
| **Role** | Joelle |
| **Deps** | `p1-checkers-plugin`, `p1-checkers-board-renderer` |
| **Priority** | P2 |

**Description:** Create `docs/adding-a-game.md` — a step-by-step guide for adding a new game to PlayGrid. Cover: creating the state schema, writing pure logic functions, implementing the GamePlugin interface, creating a GameRenderer, registering both server and client plugins, testing patterns. Use Checkers as the example throughout.

**Acceptance Criteria:**
- Step-by-step guide from zero to playable game
- References Checkers implementation as example
- Covers server (plugin + logic) and client (renderer)
- Explains testing approach
- New team member can follow it to add a game

---

### `p2-discord-notifications`

| | |
|---|---|
| **Title** | Discord webhook for deploy notifications |
| **Role** | Marathe |
| **Deps** | `p2-deploy-dev` |
| **Priority** | P2 |

**Description:** Add Discord webhook integration to deploy workflows. Send notification to #play-grid channel on: deploy start, deploy success (with link), deploy failure (with error summary). Use the `DISCORD_WEBHOOK_URL` secret. Simple curl-based webhook — no additional dependencies.

**Acceptance Criteria:**
- Deploy success sends message with environment and URL
- Deploy failure sends message with error context
- Webhook URL from GitHub secret
- Works for dev, uat, and prod deploys

---

### `p2-backgammon-plugin`

| | |
|---|---|
| **Title** | Backgammon game plugin (server) |
| **Role** | Gately |
| **Deps** | `p1-checkers-plugin` |
| **Priority** | P2 |

**Description:** Implement BackgammonPlugin following the same pattern as Checkers. State: 24 points + bar + borne-off. Logic: dice rolling (server-authoritative RNG), movement validation with bearing off rules, hit-and-enter from bar. No doubling cube in v1. Register in GameRegistry.

**Acceptance Criteria:**
- BackgammonPlugin implements GamePlugin
- Pure logic functions for movement and capture
- Server-authoritative dice rolling
- Win condition: all 15 pieces borne off
- Registered in GameRegistry

---

### `p2-backgammon-renderer`

| | |
|---|---|
| **Title** | Backgammon renderer (client) |
| **Role** | Gately |
| **Deps** | `p2-backgammon-plugin`, `p1-renderer-system` |
| **Priority** | P2 |

**Description:** Create BackgammonRenderer implementing GameRenderer. Render: board with 24 triangular points, pieces as stacked discs, dice display, bar and borne-off areas. Handle input for piece selection and point targeting. Procedural graphics (no image assets).

**Acceptance Criteria:**
- Board with 24 points rendered correctly
- Pieces stack visually on crowded points
- Dice display with current roll
- Move input with valid target highlighting
- Registered in RendererRegistry

---

### `p2-backgammon-tests`

| | |
|---|---|
| **Title** | Backgammon logic and plugin tests |
| **Role** | Steeply |
| **Deps** | `p2-backgammon-plugin` |
| **Priority** | P2 |

**Description:** Unit tests for Backgammon pure logic functions and plugin integration. Cover: movement validation, bearing off rules, bar re-entry, dice usage, win conditions.

**Acceptance Criteria:**
- Logic function tests with edge cases
- Plugin integration tests
- All tests pass

---

## Dependency Graph (Simplified)

```
P0 Foundation:
  p0-env-config ──→ p0-static-serving ──→ p0-dockerfile
       │                                       │
       └──→ p0-pg-connection ──→ p0-db-schema  │
                                               │
  p0-ci-pipeline ──→ p0-ci-lint               │

P1A Plugin System:
  p1-shared-game-types ──→ p1-base-game-state ──→ p1-turn-manager
       │                        │                       │
       └──→ p1-game-registry ───┴───────────→ p1-base-game-room
                  │
                  └──→ p1-lobby-gametype

P1B Checkers Logic:
  p1-base-game-state ──→ p1-checkers-state ──→ p1-checkers-logic
                                                    │
  p1-base-game-room ───────────────────→ p1-checkers-plugin
                                                    │
                                         p1-checkers-logic-tests
                                         p1-checkers-plugin-tests

P1C Client Architecture:
  p1-scene-manager ──→ p1-app-refactor
       │                     │
       └──→ p1-renderer-system ──→ p1-game-scene
                                       │
  p1-lobby-gametype ──→ p1-lobby-gametype-ui

P1D Checkers Renderer:
  p1-game-scene + p1-checkers-state ──→ p1-checkers-board-renderer
                                              │
                                       p1-checkers-interaction
                                              │
                                       p1-checkers-polish
                                              │
  p1-checkers-plugin ─────────────→ p1-e2e-checkers
```

---

## Priority Summary

| Priority | Count | Goal |
|----------|-------|------|
| **P0** | 7 items | Server starts, serves client, connects to PostgreSQL |
| **P1** | 16 items | Checkers is playable in browser |
| **P2** | 15 items | Deployment, persistence, second game, docs, monitoring |
| **Total** | **38 items** | |

---

## Implementation Order Recommendation

**Start in parallel:**
1. **Pemulis** begins P0 (env-config → static serving → pg connection → db schema)
2. **Marathe** begins P0 (ci-pipeline, Dockerfile) in parallel
3. **Gately** begins P1C (scene manager, app refactor) — no server deps needed
4. **Pemulis** continues to P1A (shared game types → registry → base game room) once P0 is done
5. **Gately** builds Checkers state + logic (P1B) while Pemulis builds plugin system (P1A)
6. **Gately** builds Checkers renderer (P1D) while Pemulis finishes BaseGameRoom
7. **Steeply** writes tests as each component lands (P1B tests, P1 plugin tests, e2e)
8. **Joelle** starts docs once P1 is stable
9. **Marathe** builds deploy pipeline (P2) once Dockerfile and CI are proven

**Critical path:** `p0-env-config → p0-static-serving → p1-shared-game-types → p1-base-game-state → p1-base-game-room → p1-checkers-plugin → p1-e2e-checkers`

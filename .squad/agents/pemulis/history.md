# pemulis — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Learnings

### Game Systems Architecture (2026-03-14)

**Core Architecture Decisions:**
- **Plugin-based game system** — Each game is a self-contained module implementing a standardized `GamePlugin` interface
- **BaseGameState schema** — All game states extend a common base with player management, turn tracking, and game status
- **Server-authoritative validation** — All game logic and validation runs server-side; clients send action intents, not state mutations
- **State filtering for hidden information** — Card games and Dominoes require per-client state views filtered by the server

**Key Technical Patterns:**
1. **Lifecycle Hooks** — Games define `onCreate`, `onPlayerJoin`, `onGameStart`, `onGameEnd`, `onTick` for initialization and cleanup
2. **Action Handlers** — Map of action type → handler function returning `ActionResult` (success/failure, endsTurn, endsGame)
3. **Turn Management** — Generic `TurnManager` supports round-robin, random, or custom turn order; `PhasedTurnManager` for multi-phase games (Risk)
4. **Win Conditions** — Games implement `checkGameEnd()` called after every action and `validateAction()` for pre-execution checks

**Hidden Information Strategy:**
- Server holds complete unfiltered state
- `StateFilter` interface allows per-client filtering
- Manual broadcast to each client with their filtered view
- Critical for card games (Poker, Hearts, Spades) and Dominoes

**Implementation Order (by complexity):**
1. **Checkers (2/5)** — Simple rules, no hidden info, good first plugin to validate architecture
2. **Dominoes (2/5)** — First test of hidden information (hands, draw pile)
3. **Hearts (3/5)** — Card game with trick-taking, no betting, multi-round scoring
4. **Spades (3/5)** — Reuses Hearts' trick-taking, adds bidding phase
5. **Backgammon (3/5)** — Dice mechanics, complex movement validation, doubling cube
6. **Poker (4/5)** — Complex betting, hand evaluation, side pots
7. **Risk (5/5)** — Most complex: multi-phase turns, player elimination, largest state space

**State Size Estimates:**
- Checkers: ~200 bytes
- Dominoes: ~300 bytes
- Backgammon: ~500 bytes
- Card games: ~1-2KB
- Risk: ~5KB+

**Critical Insights:**
- **Forced jump chains** (Checkers) require tracking `mustCaptureFrom` state
- **Phased turns** (Risk) need separate turn phase tracking + phase-specific action sets
- **Card game filtering** must handle showdown reveals (make private hands public at end)
- **Backgammon doubling cube** adds strategic depth with minimal state overhead
- **Risk attack/defend** dice resolution needs careful highest-dice comparison logic

**Open Design Questions:**
- Spectator visibility of hidden info (recommendation: only revealed cards)
- Reconnection timeout (recommendation: 60s then forfeit/bot)
- Undo/redo support (recommendation: not for competitive)
- Time controls (recommendation: per-game configurable)

**Performance Considerations:**
- Use ArraySchema for homogeneous collections (faster than MapSchema)
- Cache valid move lists when expensive to compute
- State filtering slows broadcasts vs Colyseus auto-sync (only use when necessary)
- Complex validation (Risk pathfinding) may need memoization

---

### Cross-Agent Research Summary (2026-03-14)

**Hal (Lead)** produced `docs/architecture-plan.md` with:
- Server architecture patterns (LobbyRoom, GameRoom, plugin system)
- 3-phase scaling strategy with trigger conditions (50 games → multi-process, saturate → multi-server)
- Game plugin system design (IGamePlugin interface, BaseGameRoom)
- Single unified lobby for all game types
- SQLite → PostgreSQL migration path
- 8-phase implementation plan (~4-5 weeks for core games + infrastructure)

**Gately (Game Dev)** produced `docs/client-architecture.md` with:
- Scene management system (Lobby, Waiting Room, Game scenes with lifecycle)
- Game renderer plugin system with RendererRegistry
- Hybrid HTML/PixiJS UI (HTML for menus, PixiJS for games)
- Per-game rendering analysis and asset requirements
- Spectator mode with perspective selector
- Lazy asset loading, mobile-first design
- Risk pan/zoom viewport, touch pointer events

**Key Alignment:**
- Plugin architecture agreed across server (Hal), systems (me), client (Gately)
- Server-authoritative state with client input validation separation
- Hidden information filtering for card games (consistent approach)
- Turn management supports both simple and phased turns
- Game order aligned: Checkers → Dominoes → Card games → Complex games
- Asset dependencies identified and risk mitigation planned

### Environment Config Module (2026-03-14)

- Built `server/src/config.ts` as the server-side environment config module for P0 infrastructure.
- Exported a typed `config` object with `port`, `databaseUrl`, and `nodeEnv`, using `process.env` directly and local-safe defaults.
- Updated `server/src/index.ts` to consume `config.port` instead of reading `process.env.PORT` inline.
- Pattern used: centralize env parsing in one typed module, default invalid or missing values to development-safe settings, and import config from runtime entrypoints.

### Colyseus 0.17 workspace migration (2026-03-14)

- Upgraded dependencies in `server/package.json`, `shared/package.json`, and `client/package.json` to Colyseus 0.17 / Schema v4 / SDK packages, and refreshed the root `package-lock.json` with `npm install`.
- Added explicit `@colyseus/core` to the server workspace because `colyseus` 0.17 re-exports core types but requires the peer dependency to be installed for `Server`, `Room`, `Client`, and `matchMaker` typings to resolve.
- Updated room classes in `server/src/rooms/GameRoom.ts` and `server/src/rooms/LobbyRoom.ts` to the 0.17 room shape: remove the `Room<State>` generic, assign `state = new GameState()` directly, and accept `onLeave(client, code)` even when the close code is not used.
- Swapped client imports in `client/src/index.ts`, `client/src/ui/LobbyScreen.ts`, and `client/src/ui/WaitingRoom.ts` from `colyseus.js` to `@colyseus/sdk`; existing `Client` / `Room` usage continued to work after the package rename.
- Validation outcome: `npm run build` and `npm run test` both passed after the migration. One gotcha is that Vitest currently discovers both `server/src/__tests__` and built `server/dist/src/__tests__`, so the same suite runs twice during root tests.

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.

### Static asset serving on the Colyseus port (2026-03-14)

- Added an Express app in `server/src/index.ts` to expose `GET /health` and serve the built Vite client from `client/dist` on the same port as Colyseus.
- Wired the HTTP app and WebSocket transport together by creating the HTTP server with `createServer(app)` and passing that server into `new WebSocketTransport({ server })`, which preserves same-port WebSocket traffic with the currently installed `@colyseus/ws-transport` 0.17.9 API.
- Kept the existing `npm run dev` workflow unchanged and verified the new setup with root `npm run build`, root `npm run test`, `GET /health`, the static `/` response, and a same-port WebSocket probe.

### PostgreSQL startup connection policy (2026-03-14)

- Added `server/src/db.ts` with a lazy `pg` connection pool, a shared `query()` helper, `getPool()`, and `connectDb()` startup verification using `SELECT 1`.
- Startup now gates `server.listen()` on `connectDb()`: production requires an explicitly configured `DATABASE_URL` and a reachable PostgreSQL server, while development logs a warning and keeps the server running when the variable is missing or the database is offline.
- Verified the change with `npm run build`, `npm run lint`, `npm run test`, plus runtime checks for development-without-DB, development-with-unreachable-DB, and production-with-unreachable-DB startup behavior.


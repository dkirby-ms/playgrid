# pemulis — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Core Context (2026-03-14 Research Phase)

**Plugin-based architecture:** Server-authoritative game plugin system with per-game implementation. Each plugin defines lifecycle hooks (`onCreate`, `onPlayerJoin`, `onGameStart`, `onGameEnd`, `onTick`), action handlers (type → function), and win-condition checks. Turn management via `TurnManager` (round-robin) or `PhasedTurnManager` (multi-phase for Risk). State filtering for hidden information (card games, Dominoes).

**Game stack (priority order):** Checkers → Dominoes → Hearts/Spades → Backgammon → Poker → Risk. Estimated state sizes: Checkers 200B, Dominoes 300B, Card games 1-2KB, Risk 5KB+.

**Infrastructure:** Environment config module (`config.ts`). Colyseus 0.17 with Schema v4. PostgreSQL for persistence (dev: local docker-compose, prod: Azure). Static asset serving on same Colyseus port via Express.

**Cross-agent alignment:** Plugin pattern agreed across server (Hal), systems (me), client (Gately). Server-authoritative validation. Client renders per scene (Lobby, Waiting, Game) with PixiJS for games and HTML for menus.

---

## Learnings

### Session lifecycle + reconnection audit (2026-03-15)

- `server/src/game/BaseGameRoom.ts` only grants a reconnection window during `phase === "playing"` for non-spectators and non-`CloseCode.CONSENTED` disconnects. It calls `allowReconnection(client, 30)` and keeps the existing `PlayerInfo` in state with `isConnected = false`; a successful reconnect only flips `isConnected` back to `true`.
- There is **no** server-side reconnection support in `LobbyRoom`: waiting-room/browser-refresh disconnects immediately remove the lobby session, clear the player from `waitingPlayers`, and delete the whole waiting game if the host refreshes. Mid-game reconnection is the only resilience path currently implemented.
- The shared plugin contract already defines `onPlayerReconnect`, but `BaseGameRoom.onJoin()` never calls it. Server state is preserved during the reconnection window, but reconnect-specific game/plugin hooks are currently skipped.
- `BaseGameRoom` ends games with `disconnect()` and `LobbyRoom` does not get notified when an in-progress game room disposes, so lobby-side session lifecycle is incomplete after game shutdown.
- On the client, `Application.ts` only persists `playgrid.display-name` in `localStorage`. It does **not** persist `room.roomId`, `room.reconnectionToken`, spectator/player role, or any active-game marker, and `bindGameRoom()` drops `this.gameRoom` and returns to the lobby as soon as the room finally emits `onLeave`.
- The installed Colyseus SDK already has same-tab automatic socket recovery using `room.reconnectionToken` (`client/node_modules/@colyseus/sdk/src/Room.ts`), but Playgrid does not wire `room.onDrop` / `room.onReconnect` into app state or UI. That means transient network drops may self-heal inside one live page, but the app does not surface that lifecycle and browser refresh still loses the in-memory token entirely.
- Browser refresh during a live game closes both the lobby socket and the game socket. The server will usually open the 30s `allowReconnection()` window for the game room, but the refreshed app boots as a brand-new client, reconnects only to the lobby, and has no saved reconnection token to reclaim the reserved seat. In practice, refresh makes the active match irrecoverable from the browser even though the server is briefly holding the seat open.
- Because waiting-room state lives in `LobbyRoom` only, refreshing before game start is harsher: the guest is removed from the waiting roster immediately, and a host refresh removes the waiting game outright.
- Recommended direction for session resilience: persist `room.reconnectionToken` + minimal active-game metadata in `sessionStorage`, attempt `client.reconnect(savedToken)` during app boot before falling back to `connectToLobby()`, clear the stored token on consented leave/game end, wire `onDrop` / `onReconnect` UI, call `plugin.lifecycle.onPlayerReconnect`, and decide whether turn timers should pause while a seat is reserved.
- Team note: the existing decision log entry for PR #61 correctly reflects server-side `allowReconnection()` work, but its claim that players can reload mid-game is not true end-to-end until the client persists and uses the reconnection token.

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

### Database schema bootstrap for games and participants (2026-03-14)

- Added a dedicated migration helper at `server/src/db/migrate.ts` and invoke it from `connectDb()` immediately after the startup connection probe succeeds.
- Kept migration execution safe for repeated startups by using idempotent table creation for `games` and `game_participants`, while leaving development startup behavior unchanged when PostgreSQL is unavailable.
- Checked the integration with a focused Vitest suite for `connectDb()` plus the full root `npm run build`, `npm run lint`, and `npm run test` validation pass.

### Base state and registry scaffolding (2026-03-14)

- Added `shared/src/BaseGameState.ts` with `PlayerInfo` and `BaseGameState` Colyseus schemas using the repo's `defineTypes()` pattern, including shared player connection/spectator metadata and turn-tracking defaults.
- Re-exported the new shared schemas from `shared/src/index.ts` without changing the legacy `GameState`, so existing `GameRoom` code remains compatible while new plugins can extend the shared base.
- Added `server/src/game/GameRegistry.ts` as a singleton plugin registry with duplicate-registration and missing-plugin guards, plus `server/src/game/index.ts` for package-level re-export.
- Mapped `@eschaton/shared` to the shared workspace source in `server/tsconfig.json` so the server can use the requested type-only shared import path while staying on the current workspace layout.
- Verified the full workspace with `npm run build && npm run lint && npm run test` after both feature commits.

### Turn management and lobby game types (2026-03-14)

- Added a standalone `server/src/game/TurnManager.ts` that keeps sequential round-robin order independent of Colyseus, with optional timeout scheduling via `setTimeout`/`clearTimeout` and package-level re-exports from `server/src/game/index.ts`.
- `TurnManager` only enables timed turns when the `turnTimeLimit` option is explicitly present; if that option is present but invalid or undefined, it falls back to the 60-second team default instead of enabling an unlimited turn accidentally.
- Updated shared lobby contracts and `server/src/rooms/LobbyRoom.ts` so waiting-game entries now carry `gameType`, validate against `gameRegistry` only when plugins actually exist, and clamp requested player counts to plugin metadata when a matching plugin is registered.
- Added focused Vitest coverage for both the standalone turn manager and the lobby's new `gameType` validation / passthrough behavior, including the pre-plugin empty-registry fallback.

### BaseGameRoom orchestration (2026-03-14)

- Added `server/src/game/BaseGameRoom.ts` as the plugin-driven Colyseus room that loads a registered game plugin, creates shared `BaseGameState` instances, wires plugin action handlers, and drives turn flow through `TurnManager`.
- `BaseGameRoom` tracks `PlayerInfo` connection state, starts play once the expected player count joins, advances `state.currentTurn` / `state.turnNumber`, and resolves end-game cleanup for action-driven wins, timeouts, and leave-triggered forfeits.
- Updated `server/src/index.ts` so the public room type `"game"` now uses `BaseGameRoom`, and updated `LobbyRoom` to pass `expectedPlayers` plus enforce plugin minimum player counts before creating the live game room.
- Verified the integration with new `server/src/__tests__/BaseGameRoom.test.ts` coverage and a full `npm run build && npm run lint && npm run test` pass.

### Active-game disconnect cleanup (2026-03-14)

- Hardened `server/src/rooms/LobbyRoom.ts` so a lobby disconnect explicitly clears `session.currentGameId` before the existing leave flow runs when the tracked game is already `in_progress`.
- Left `BaseGameRoom`'s disconnect path intact but added regression coverage proving a leave during the waiting phase only flips `PlayerInfo.isConnected` and does not crash or end the room early.
- Reset `client/src/Application.ts` transient game/waiting-room state before joining the lobby so a fresh lobby connection never carries stale room UI or auto-rejoin behavior.
- Re-verified the workspace with `npm run build && npm run lint && npm run test` after adding the new disconnect regression tests.

### Player reconnection support and connection stability (2026-03-14)

**Issue #35 (Player Reconnection) & Issue #59 (Connection Drop Bug):**
- Added `allowReconnection()` support in `BaseGameRoom.onLeave()` with configurable timeout (default 30s, configurable via `reconnectionTimeout` option)
- Modified `onJoin()` to detect returning players and restore their `isConnected` state instead of creating duplicate `PlayerInfo` entries
- Added `handleReconnectionTimeout()` private method to handle forfeit/draw logic when reconnection expires
- CONSENTED disconnects skip reconnection entirely and trigger immediate forfeit (preserves existing test behavior)
- Configured WebSocket transport with `pingInterval: 10000` (10s) and `pingMaxRetries: 3` to fix connection drop bug after 1-2 minutes of idle
- Pattern: Reconnection only applies during `phase === "playing"` and for non-spectators; waiting-phase leaves and spectator leaves use immediate cleanup path

**Technical details:**
- `allowReconnection()` is an async Colyseus method that throws when timeout expires, caught to trigger `handleReconnectionTimeout()`
- Reconnection restores full game state automatically via Colyseus state sync; no manual re-sync needed beyond flipping `isConnected` flag
- `PlayerInfo.isConnected` already existed in schema; this work adds proper lifecycle management around it
- Heartbeat configuration prevents server-side idle timeout that was causing #59 connection drops
- All existing BaseGameRoom tests pass; reconnection behavior is compatible with Checkers plugin

**Key decisions:**
- 30s reconnection timeout balances user experience (enough time to reload page) with game flow (not too long for opponents to wait)
- Skip reconnection for CONSENTED closes to preserve forfeit semantics (player intentionally leaving)
- Reconnection timeout triggers same forfeit logic as regular disconnect to maintain consistent game-end behavior

**File paths:**
- `server/src/game/BaseGameRoom.ts` — reconnection logic
- `server/src/index.ts` — WebSocket heartbeat config
- `shared/src/BaseGameState.ts` — PlayerInfo schema (isConnected field already present)


### Game outcome persistence (2026-03-14)

- Created `server/src/db/gameRepository.ts` with three persistence functions: `createGame(pool, {gameType, playerIds})` creates a new game record and returns the UUID; `addParticipant(pool, {gameId, userId, role})` records player or spectator joins; `endGame(pool, {gameId, outcome, durationSeconds})` updates the final outcome and duration on game end.
- Integrated persistence into `BaseGameRoom` lifecycle: `onCreate()` generates a game UUID and stores it in the DB, `onJoin()` adds each participant record with their role, `startGame()` captures the start timestamp, and `endGame()` calculates duration and persists the final outcome.
- All database calls are wrapped in try/catch blocks that log errors but never crash the game room, ensuring DB failures degrade gracefully without impacting gameplay.
- Functions accept the `pool` parameter for testability and use parameterized queries to prevent SQL injection; existing migrations already define the `games` and `game_participants` tables.
- Verified integration with `npm run build && npm run lint && npm run test`; DB connection errors in test environment are caught and logged as expected without test failures.

### Reconnection hardening follow-up (2026-03-15)

- `server/src/game/BaseGameRoom.ts` now treats an existing disconnected `PlayerInfo` as a true reconnect path: `onJoin()` restores `isConnected`, fires `plugin.lifecycle.onPlayerReconnect`, and resumes the turn timer only when the returning player owns `state.currentTurn`.
- `server/src/game/TurnManager.ts` now tracks remaining turn time so `pause()` / `resume()` preserve the active player's clock across `allowReconnection()` windows instead of letting the timer expire in the background.
- `BaseGameRoom.onLeave()` pauses the timer before `allowReconnection()`, and `handleReconnectionTimeout()` now re-synchronizes `state.currentTurn` / `state.turnNumber` after removing an expired seat so multiplayer turn order stays coherent.
- `server/src/rooms/LobbyRoom.ts` now gives non-consented lobby disconnects a 30-second reconnection window, keeping host/guest waiting-room membership reserved until the promise rejects and cleanup runs.
- Room-to-lobby cleanup now uses a Colyseus presence topic instead of direct room references: `server/src/rooms/lobbyPresence.ts` defines the topic, `BaseGameRoom.onDispose()` publishes, and `LobbyRoom.onCreate()` / `onDispose()` subscribe and unsubscribe so disposed game rooms cannot linger in the lobby.
- Regression coverage lives in `server/src/__tests__/BaseGameRoom.test.ts`, `server/src/__tests__/TurnManager.test.ts`, and `server/src/__tests__/lobby-pregame.test.ts`.

## Cross-Agent Update — Wave 1 Complete (2026-03-14T18:55:06Z)

**From:** Squad Scribe  
**Event:** Wave 1 orchestration completed (8 PRs merged, 0 blockers, 1 conflict resolved)

**PRs Merged to dev:**
- PR #61: Player Reconnection (#35, #59) — **Your work, merged successfully**
- PR #67: Game Persistence (#33) — rebased on top of #61, conflict resolved, merged

**Key Achievements:**
- Connection stability: WebSocket heartbeat (10s ping, 3 retries) prevents idle timeouts
- Reconnection: 30s grace period with CONSENTED disconnect skip logic
- All existing tests pass; backward compatible with plugin system

**Cross-Agent Notes:**
- Hal approved your reconnection design; flagged #67 conflict which you resolved
- Gately's Backgammon plugin successfully uses your reconnection infrastructure
- Marathe's deployments enable you to ship reconnection to prod
- Joelle's plugin dev guide references your reconnection pattern

**Documentation Updated:**
- Pemulis reconnection decision now in .squad/decisions.md (canonical record)
- Session log created: `.squad/log/2026-03-14T18-55-06Z-p2-wave1-3.md`

**Next:** Wave 2 assignments ready when you are.

### Application Insights Telemetry Integration (2026-03-14)

- Implemented Application Insights telemetry integration for server-side observability (Issue #40, PR #75)
- Created `server/src/telemetry.ts` module that initializes Application Insights SDK from `APPLICATIONINSIGHTS_CONNECTION_STRING` env var
- Graceful degradation: telemetry no-ops when connection string not configured (local dev friendly)
- Integrated telemetry into server startup in `server/src/index.ts`:
  - Initialize telemetry before database connection
  - Track unhandled rejections and uncaught exceptions with source context
- Integrated lifecycle telemetry tracking in `BaseGameRoom`:
  - `room_created`: When game room is created (includes gameType, roomId, gameId)
  - `player_connected`: When player joins (includes isSpectator flag)
  - `player_reconnected`: When existing player reconnects
  - `player_disconnected`: When player leaves (includes phase, close code)
  - `game_started`: When game begins (includes playerCount)
  - `game_ended`: When game completes (includes resultType, durationSeconds)
- All telemetry calls wrapped in try/catch to prevent failures from disrupting game flow
- SDK configuration: enabled auto-collection for requests, performance metrics, exceptions, dependencies, and console logs
- Note: Daily ingestion cap configuration attempted but API doesn't support `maxBytesPerInterval` in config - cap should be set via Azure Portal instead

**Technical decisions:**
- Export `trackEvent`, `trackException`, `trackMetric`, and `flushTelemetry` wrappers for consistent API
- Use string properties for all custom dimensions (Application Insights requirement)
- No-op pattern when telemetryClient is null (connection string missing or initialization failed)
- Track custom events at key lifecycle moments vs relying solely on auto-collection for better business insights

## Cross-Agent Update — Local PostgreSQL Dev Infrastructure (2026-03-14T21:30:36Z)

**From:** Squad Scribe  
**Event:** Marathe completed local PostgreSQL setup for dev environment

**What Changed:**
- `docker-compose.yml` — Root service: postgres:15-alpine with named volume and health check
- `.env.example` — Template for `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playgrid_dev`
- Helper scripts — Database initialization and cleanup utilities
- All tests passed; build/lint successful

**Why This Matters for You:**
- **Database Target:** Your server code now has a stable, local PostgreSQL instance to target
- **Environment Variable:** Read `DATABASE_URL` from `.env` in your server initialization (see `.env.example` template)
- **No Azure for Dev:** Local-only per user directive; UAT/prod remain on Azure infrastructure
- **Production Parity:** Postgres 15 in dev matches production closely, reducing environment-specific bugs

**Action Items (when ready):**
1. Update server/src/index.ts to initialize database connection from `DATABASE_URL` env var
2. Verify game persistence queries (gameRepository.ts) work against the local database
3. Document connection string in dev setup guide for new team members

---

## 2026-03-15: Session Resilience — Server-Side Reconnection Implementation

**From:** Squad Scribe  
**Event:** Session completed — Server-side reconnection support landed

**What Changed:**
- Implemented presence-backed cleanup via `playgrid:lobby:game-room-disposed` topic
- BaseGameRoom wired `onPlayerReconnect` plugin hook
- LobbyRoom clears stale entries on room disposal
- 30s reconnection window fully integrated

**Coordination Notes:**
- **Gately (Client):** Client-side reconnect in parallel — persist token in sessionStorage, attempt startup reconnect before fresh lobby
- **Steeply (Tester):** Server tests green now; client contracts pinned as .todo() stubs pending Gately's client seams

**What Gately Needs from You:**
- onPlayerReconnect hook available for turn timer integration
- Presence topic stable for lobby cleanup
- 30s window working server-side before client attempted recovery

**Status:** ✅ Build + tests pass. Ready for Gately's cross-agent integration.

### Ready-check enforcement for waiting games (2026-03-15)

- `server/src/rooms/LobbyRoom.ts` now refuses `start_game` while any joined non-host waiting player is still `isReady = false`, and returns a lobby error instead of creating the live game room.
- Kept the existing host-start UX intact: the host still controls starting, but readiness is now enforced for every other joined player because the current waiting-room UI only exposes a Ready toggle to non-host participants.
- `client/src/ui/WaitingRoom.ts` now disables the host Start Game button until every joined non-host player is ready, and it restores the button state if the server rejects a start attempt.
- Regression coverage in `server/src/__tests__/lobby-pregame.test.ts` now includes the blocked-unready-start case plus the ready-then-start path.

## Cross-Agent Update — Ready-Check Enforcement & ACA Bootstrap (2026-03-15)

**From:** Marathe (DevOps)  
**Event:** ACA bootstrap placeholder resolved in parallel with ready-check work

- **Marathe completed:** Azure Container App bootstrap now works with `node:22-alpine` placeholder image + conditional startup logic. Eliminates blockers on infrastructure deployments before CI/CD pushes real image.
- **Impact to you:** Ready-check enforcement and reconnection work can proceed independently from infrastructure-level blockers. ACA infra is now stable for dev and UAT environments.
- **Deploy workflow:** `deploy-dev.yml` continues to handle image updates via `az containerapp update`; no changes needed to your game/systems code.


## Cross-Agent Update — Risk Game Plugin Triage (2026-03-15T01:40:25Z)

**From:** Squad Scribe  
**Event:** Hal completed triage of issue #80 "Add Risk game plugin"

**What This Means for You:**

Hal has triaged Risk and assigned you as the systems developer. Here's your scope:

**Phase 1: Core Game Logic & Plugin** (~350 lines + tests)
- RiskState schema definition (territories, armies, cards, turn phase)
- Turn phase transitions (reinforce → attack → fortify)
- Combat mechanics (dice rolls, loss calculation, cascading armies)
- Territory/card accounting (capture, trade-in validation, 5/4/3 sets)
- Win condition detection (territory control threshold)
- No UI in Phase 1; pure mechanics only

**Turn Structure:**
1. **Reinforce Phase** — Place armies on owned territories (mandatory min 1)
2. **Attack Phase** — Declare attacks, resolve dice rolls, cascade casualties
3. **Fortify Phase** — Move armies between adjacent owned territories (optional)

**Card Rules (Standard Risk):**
- Trade-in sets: 5 identical, 4 identical, 3 identical, or 1 of each
- Bonus armies: 2, 4, 6 per turn (increasing per trade)
- Jokers: Not using (simplifies Phase 1)

**Blockers:** None. Proceed with Phase 1 design.

**Coordination:**
- Steeply is writing test cases in parallel
- Gately is staging Phase 3 (map renderer) and will start after your Phase 1 stabilizes
- Your RiskState schema will lock the contract for Gately's renderer

**Architectural Notes:**
- Follows existing BaseGameRoom + IGamePlugin pattern
- Pure logic (no Colyseus coupling) for testability
- Only hidden info: opponent cards (classic Risk rules)
- Spectator-safe by design

**Precedent:** Risk is next in approved game order (Dominoes → Poker → Hearts/Spades → Chess → Risk).


### Risk Game Plugin Implementation (2026-03-15 - Issue #80, Phase 1)

**Architecture Pattern:**
- Followed the exact IGamePlugin pattern used by Checkers and Backgammon
- Plugin structure: `createState()` factory, lifecycle hooks (onPlayerJoin, onGameStart), action handlers, condition validators
- Server-authoritative state with all validation in the plugin
- Registration in `server/src/index.ts` via `gameRegistry.register(riskPlugin)`

**Key Files Created:**
- `shared/src/games/risk/RiskState.ts` - State schema with TerritoryState, RiskPlayerState, phase enums
- `server/src/games/risk/RiskPlugin.ts` - Main plugin implementing GamePlugin<RiskState>
- `server/src/games/risk/riskLogic.ts` - Pure game logic functions (combat, reinforcements, validation)
- `server/src/games/risk/territoryData.ts` - Static territory graph (42 territories, 6 continents, adjacencies)

**State Design:**
- Uses Colyseus Schema classes (TerritoryState extends Schema, RiskPlayerState extends Schema)
- MapSchema for territories and riskPlayers (keyed by territory ID and session ID)
- Turn phases: setup-pick, setup-place, reinforce, attack, fortify
- Game phases: setup (initial army placement), playing (standard turns)
- Hidden information: card counts stored server-side in RiskPlayerState.cardsHeld

**Game Logic:**
- Setup: Territories distributed round-robin, initial armies calculated by player count (40/35/30/25/20 for 2-6 players)
- Reinforce: Territory count ÷ 3 (min 3) + continent bonuses + card trade-ins (escalating 4,6,8,10,12,15,20...)
- Attack: Dice rolling (attacker up to 3, defender up to 2), highest vs highest comparison, territory conquest
- Fortify: Move armies between adjacent owned territories
- Cards: Earn one card per turn if you conquered a territory, trade 3 for bonus armies
- Win condition: Control all 42 territories

**Technical Notes:**
- Turn phases managed via string union type in shared, duplicated in server for type-checking
- Action handlers return ActionResult with success/error/endsTurn/endsGame flags
- Territory adjacency checked via static data lookups (areTerritoriesAdjacent)
- Combat dice rolls use Math.random(), sorted descending for comparison
- Plugin uses mode: "phased" with phases config for UI hints (not enforced by BaseGameRoom)

**Future Work (Phase 2/3):**
- Client UI rendering (territory map, attack/fortify interactions)
- Card UI (currently server tracks count only, no card types/visualization)
- Enhanced territory selection (graph connectivity validation for fortify paths)
- AI players or bot support

---

## 2026-03-15: Cross-Agent Update — PR #83 Revision Complete (Lockout Protocol)

**From:** Scribe (on behalf of Marathe)  
**Event:** PR #83 blockers resolved; lockout protocol applied per Hal's re-review requirement

**Situation:**
- Hal identified three critical blockers in PR #83 (Risk Game Plugin): incomplete test implementation (~48 `it.todo()` placeholders), territory data duplication (server/client drift risk), missing Phase 1 scope documentation.
- Original PR authors (you, Steeply, Gately) were locked out per protocol — revision could not proceed with original team.

**Resolution:**
- Marathe (DevOps) completed full revision: 60 executable tests, shared territory data refactored to `shared/src/games/risk/`, Phase 1 limitations documented in RiskPlugin.
- All blockers verified: `npm run build` ✅, `npm run lint` ✅, `npm run test` ✅ (60/60 passing).
- Commits: `816332c` (fix), `2692e8a` (docs).

**Impact on Your Work:**
- Your implementation is solid; revision was administrative (test completion + data structure move + documentation).
- Architectural standards captured in `.squad/decisions.md`:
  1. Shared static data in `shared/src/games/{game}/`
  2. No `it.todo()` in production PRs (real test implementations required)
  3. Explicit Phase 1 scope documentation
  4. PR atomicity (infra separate from features)

**Next Step:** Hal will re-review revised PR #83. Ready for merge once approved.


### Issue #82: Lobby duplicate player entry on browser refresh (2026-03-14)

**Problem:** After logging in and joining the lobby, refreshing the browser caused the player's name to appear twice (or more) in the online players list. The old session was not being properly cleaned up before the new connection was established.

**Root Cause:** In `LobbyRoom.onJoin()`, when a player reconnected within the 30-second `allowReconnection()` grace period, the existing session check would return early without broadcasting the updated online players list. This caused:
- Other clients may have seen a temporary disconnect notification
- Without re-broadcasting, they didn't get updated that the player was back
- Client state became inconsistent with server state, showing duplicates

**Fix:** Added `this.broadcastOnlinePlayers()` call in the existing session reconnection path (line 106 of `LobbyRoom.ts`), ensuring all clients receive consistent lobby state when a player reconnects within the grace period.

**Verification:** All tests passed (`npm run build && npm run lint && npm run test`). The fix is minimal and surgical — only adds the broadcast call that was missing from the reconnection path.

**PR #84:** Opened against `dev` branch.
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

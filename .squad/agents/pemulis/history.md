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

### ACA WebSocket routing uses browser default port in production (2026-03-15)

- `client/src/networking/ConnectionManager.ts#getServerUrl()` now treats only `localhost` and `127.0.0.1` as local development, applying `VITE_SERVER_PORT` there and using the browser location port elsewhere.
- This matches the ACA ingress model documented in `.squad/decisions.md`: browsers must connect to `wss://{hostname}` on the default HTTPS port while ACA proxies internally to container port `2567`.
- Pattern to remember for deployed Colyseus clients: when the app is served behind TLS-terminating ingress, do not hard-code the container port into the public WebSocket URL; prefer `window.location.port` so standard `443` stays implicit.
- Validation path for networking changes remains the repo root commands: `npm run build`, `npm run lint`, and `npm run test`.

### Lobby refresh session identity (2026-03-15)

- The duplicate-name bug in the lobby came from a mismatch between the lobby room's 30-second `allowReconnection()` window and the client always opening a fresh lobby session on browser refresh. Because `LobbyRoom` keyed presence by Colyseus `sessionId`, a refresh produced a second tracked session before the old reserved one expired.
- The durable fix is to give each browser tab a stable lobby `playerId` in `sessionStorage` (`playgrid.lobby-player-id`) and send it on every lobby join. That keeps refreshes in the same tab tied to one logical lobby user without merging separate tabs the way `localStorage` would.
- `LobbyRoom` now keeps a `sessionIdByPlayerId` index so a refreshed join can reclaim the prior session immediately, migrate any waiting-room membership/host ownership to the new `sessionId`, and rebroadcast `ONLINE_PLAYERS` without waiting for `onLeave()` timeout cleanup.
- Coverage lives in `server/src/__tests__/lobby-pregame.test.ts` for both plain lobby presence and waiting-room host transfer, and the repo-level verification path remains `npm run build && npm run test`.

### 2026-03-16: PR #121 & #122 Approvals and Lockout Escalation

- **PR #121 (CPU opponents)** — APPROVED after Marathe's rebase cleanup removed promote.yml scope leak
  - Implementation: `cpu-opponent` synthetic participant in lobby and game room
  - Turn scheduling via `clock.setTimeout(..., 200)` and the normal plugin action pipeline
  - Decision committed: `pemulis-cpu-opponents.md`

- **PR #122 (Head-to-head mode)** — Initial synthetic lifecycle fix committed
  - Root cause: controller-owned synthetics remained connected after controller left
  - Fix: Mirror controller connectivity to owned synthetics; release them on controller departure
  - Decision committed: `pemulis-h2h-lifecycle-fix.md`
  - Escalated to Steeply for timeout cleanup regression (lockout protocol: Gately → Pemulis → Steeply)

- **Decisions merged:** Both decisions now in `.squad/decisions.md`

### Shareable waiting-room links (2026-03-15)

- The waiting-room join identifier is the lobby `gameId`, not the eventual Colyseus `roomId`; while a game is still pre-start, clients must re-use `JOIN_GAME { gameId }` through the lobby room.
- No new server route is needed for invite links. `LobbyRoom.handleJoinGame()` already validates the important failure modes for shared links (`Game not found.`, `Game is full.`, and `Cannot join a game in progress as a player.`), so the client can safely drive invites with `?join={gameId}`.
- Waiting-room URL state should stay aligned with the scene: set `?join={gameId}` while a lobby waiting room is open, clear it when transitioning into the real game room, and let lobby reconnects/refreshes reuse that URL to restore the pregame flow.
- Client-side host detection for `GAME_JOINED` cannot rely only on the local `pendingTransition === "create"` flag. Refresh/auto-join paths must also treat `games.get(gameId)?.hostId === room.sessionId` as authoritative so the host keeps start controls after re-entering their waiting room.
- CPU Checkers now uses a fixed synthetic participant (`cpu-opponent`) that is added in both the lobby waiting roster and `BaseGameRoom` right before game start, which keeps the existing plugin lifecycle and turn order intact without modifying `CheckersPlugin`.
- `BaseGameRoom` can safely drive bot turns by scheduling a 200ms `clock.setTimeout()` whenever `state.currentTurn` belongs to the CPU, then replaying the normal action-validation/action-handler/game-end pipeline through a synthetic client object.
- The greedy MVP heuristic in `server/src/games/checkers/CpuOpponent.ts` is deterministic: captures win first, then king promotions, then moves that land closer to promotion. Regression coverage lives in `cpuOpponent.test.ts`, `BaseGameRoom.test.ts`, and `lobby-pregame.test.ts`.

### Shared-device controller lifecycle (2026-03-16)

- Head-to-head mode reuses one real `sessionId` to control a synthetic second `PlayerInfo`, so connectivity must be tracked at the controller level instead of treating the synthetic seat as independently online.
- When the controller disconnects, `BaseGameRoom` should immediately mark any controller-owned synthetic participants disconnected as well, then restore them only if the controller successfully reconnects.
- Permanent controller leaves in head-to-head mode should never award a forfeit to that synthetic seat; the correct cleanup path is a no-winner shutdown (`draw` / all players disconnected) followed by normal room disposal.

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

## Cross-Agent Update — Features Batch 2 (2026-03-15T21:26:56Z)

**From:** Squad Scribe  
**Event:** Session completed — Shareable waiting-room links feature landed

**What Happened:**

Your agent (agent-11) completed shareable waiting-room links feature alongside two Gately background agents (9-10) in UX polish batch:

1. **Shareable waiting-room links** (your work) — Added `?join={gameId}` URL parameter with copy-link button and auto-join on boot. Commit 2dc2725.
2. **Shared HUD status panel** (Gately agent-9) — Consolidated game status into HUD overlay for Phase 2+ games.
3. **Design-aligned lobby thumbnails** (Gately agent-10) — Lobby now uses extracted design prototype images.

**What's in Decisions:**

Shareable waiting-room links decision is now merged into `.squad/decisions.md` and removed from inbox.

**Team Notes:**

All three features validate cleanly end-to-end with `npm run build && npm run lint && npm run test`. Host detection fix (`games.get(gameId)?.hostId === room.sessionId`) ensures refresh resilience. The decision to reuse existing `JOIN_GAME` validation path (instead of new server endpoint) keeps the implementation small and audit-safe.

**Session Artifacts:**

- `.squad/orchestration-log/2026-03-15T21-26-56Z-pemulis-11.md` — Your agent's outcome
- `.squad/log/2026-03-15T21-26-56Z-features-batch-2.md` — Session summary with all three features


---

## 2026-03-16: Issue Scoping (Round 3) + CPU Opponent Design

**Event:** Round 3 orchestration — issue #86 scoped and approved

**Work Completed:**
- Issue #86 (CPU opponents): comprehensive scope document posted
- Architecture finalized: server-side bot player with greedy heuristic
- MVP scope defined: greedy heuristic only, Medium difficulty, Checkers only
- Complexity estimate: Small (~250 LOC)

**Decisions Made:**
1. CPU opponents: server-side bot (not client-side, not separate service)
2. AI strategy: greedy heuristic (not random, not Minimax for MVP)
3. Difficulty: Medium only for MVP; easy/hard deferred to Phase 2
4. Scope: Checkers only; extensible to Risk/Dominoes later

**Technical Decisions:**
- Bot is a PlayerInfo with synthetic sessionId ("cpu-opponent")
- Move selection via selectCpuMove() — applies automatically (no network)
- 200–500ms delay for UI feedback (use Colyseus clock.setTimeout)
- No plugin changes; leverages existing plugin system
- No schema changes; no persistence

**Files to Create/Modify:**
- New: server/src/games/checkers/CpuOpponent.ts (~80 lines)
- Modify: LobbyRoom.ts (~15 lines), BaseGameRoom.ts (~20 lines)
- Tests: checkersPlugin.cpu.test.ts, lobby-cpu.test.ts (~150 lines)

**Context Propagated:**
- Hal's action validation pattern (validateAction) aligns with CPU architecture
- Head-to-head mode (#115) client-side only; no server conflicts

**Next Steps:**
- Begin implementation of CpuOpponent.ts
- Update lobby to accept cpuOpponent option
- Implement CPU turn detection in BaseGameRoom

---

## Assigned Work: Issue #87 — CPU Opponents in Backgammon (2026-03-16)

**Status:** Triaged and routed to Pemulis  
**Triaged by:** Hal  
**Label:** `squad:pemulis`

**Context:**
Issue #87 requests CPU-controlled opponents in Backgammon to enable single-player gameplay. Hal's triage determined this is reusable work from PR #121 (Checkers CPU opponent pattern).

**Why routed to you:**
- Game systems work (AI, simulation) aligns with Pemulis role
- Pattern exists and proven: `server/src/games/checkers/CpuOpponent.ts`
- No framework changes needed
- Game-specific logic only: Backgammon move scoring (bearing-off priority, blot avoidance)

**Implementation Baseline:**
- Reuse Checkers `CpuOpponent.ts` structure
- Framework: `BaseGameRoom.executeCpuTurn()` (lines 590–620) handles CPU turns generically — no changes needed
- Scope: Single new module `server/src/games/backgammon/CpuOpponent.ts`
- Validation/move application utilities already available (tested in Checkers PR #121)

**Next Step:** Implement `server/src/games/backgammon/CpuOpponent.ts` with Backgammon-specific move scoring logic.

### Backgammon CPU opponent (2025-07-25)

- Implemented `server/src/games/backgammon/CpuOpponent.ts` with `selectCpuAction()` — returns either a roll action or a scored move action.
- Backgammon CPU turns are multi-action (roll → move × N), unlike Checkers which is single-action. The `queueCpuTurnIfNeeded()` loop in BaseGameRoom handles this naturally — each action completes, then the next CPU action is queued.
- `BaseGameRoom.executeCpuTurn()` was refactored into game-specific methods (`executeCheckersCpuTurn`, `executeBackgammonCpuTurn`) to handle different action types and payloads.
- CPU support gate in `BaseGameRoom.onCreate()` was widened from `gameType === "checkers"` to `gameType === "checkers" || gameType === "backgammon"`. The `isCpuTurn()` check was simplified to remove the hardcoded `plugin.id === "checkers"` guard.
- Scoring heuristic: bear off (1000) > hit blot (500) > bar entry (400) > make point (300) > prime bonus (150) > advancement. Penalties for leaving blots (-200) and breaking points (-100).
- Key file paths: `server/src/games/backgammon/CpuOpponent.ts`, `server/src/games/backgammon/__tests__/cpuOpponent.test.ts`
- PR #125, closes #87.

---

## Session 2026-03-16: Feature Completion & Blockers

**Role:** Implementation lead (Backgammon CPU), blocker resolver (PR #135)  
**Output:** PR #125 fix (pass action), PR #135 fix (Promise.race flakiness)  

**Summary:**
- Implemented Backgammon CPU in PR #125 → submitted
- Hal reviewed #125, found no-valid-moves bug → locked out by concurrent changes
- Gately fixed PR #125 with pass action (while Pemulis was locked out)
- Hal re-reviewed & approved #125 → merged
- Later: Hal reviewed Risk E2E (PR #135), found Promise.race flakiness
- Applied fix to PR #135: replaced Promise.race with explicit page.waitForFunction() checks
- Hal re-reviewed & approved #135 → merged

**Key Achievement:** Fixed flakiness blocker in E2E tests by identifying race condition root cause and implementing deterministic waiting pattern.

**Learnings:**
- Lockout protocol works: Pemulis locked out, Gately fixed correctly, re-approval succeeded
- E2E flakiness often stems from racing promises — explicit waits are more robust
- When locked out, trust peer to apply fix correctly and move forward on re-review

**Output:**
- PR #125 merged (Backgammon CPU)
- PR #135 merged (Risk E2E with deterministic waits)
- Issue #87 and #127 closed
- All 289 tests passing

### Risk reinforcement calculation bug fix (2026-03-16)

- Root cause: `endPhase` in `RiskPlugin.ts` calculated reinforcements for the CURRENT player (the one calling endPhase) then returned `endsTurn: true`, which advanced the turn to the NEXT player. The next player started their reinforce phase with 0 `armiesToPlace`. Affected both the setup→playing transition and the fortify→reinforce transition.
- Fix: Added `onTurnStarted?(state, newPlayerId)` lifecycle hook to the `GameLifecycle` interface in `shared/src/gamePlugin.ts`. `BaseGameRoom.advanceTurn()` now calls it after advancing the turn. `RiskPlugin` implements it to set `turnPhase = "reinforce"`, reset `earnedCardThisTurn`, and calculate reinforcements for the correct player.
- Removed the incorrect reinforcement calc from the setup→playing path and the phase-reset logic from the fortify→reinforce path in `endPhase`, since `onTurnStarted` now owns per-turn initialization.
- The `onTurnStarted` hook is optional on `GameLifecycle` — existing plugins (Checkers, Backgammon) are unaffected.
- Added 4 regression tests: `onTurnStarted` calculates reinforcements, `endPhase` doesn't leak reinforcements to the wrong player, setup→playing transition correctness.
- All 292 tests passing, build and lint clean.

## Session 2026-03-17: E2E Test Failure Triage and Fix Marathon

**Event:** Extended multi-hour session coordinating 4-agent E2E failure triage.  
**Role:** Systems Developer — Risk reinforcement bug fix, game plugin architecture  
**Output:** PR fixes merged, E2E suite 15/40 → 40/40, 292 unit tests passing, lint clean  

**Work:**
- **Risk reinforcement bug:** Root cause identified as calculation-before-turn-advance. Implemented `onTurnStarted` lifecycle hook to `IGamePlugin` interface.
  - Added `onTurnStarted?(state: TState, newPlayerId: string): void` to `GameLifecycle` in `shared/src/gamePlugin.ts`
  - Implemented hook in `BaseGameRoom.advanceTurn()` — called after turn advances
  - `RiskPlugin` now implements hook: calculates reinforcements, resets `turnPhase`, clears `earnedCardThisTurn`
  - Removed incorrect calc from `endPhase` (was leaking to wrong player)
  - Added 4 regression tests to `server/src/__tests__/risk.test.ts`
  - All optional — other plugins (Checkers, Backgammon) unaffected

**Decision Generated:** `.squad/decisions.md` (merged from inbox)
- `onTurnStarted` hook is canonical per-turn initialization pattern
- Extensible for future games: card deals, timer resets, etc.
- Replaces ad-hoc reinit logic scattered across action handlers

**Architecture Learnings:**
- Colyseus MapSchema silently drops new boolean schema fields → Don't add schema-level CPU indicators; use session ID instead
- Game plugin lifecycle ownership is critical: `advanceTurn()` must handle per-turn state setup, not action handlers

**Output:** 292 unit tests passing, E2E suite 40/40, lint clean. Risk reinforcement tests passing.


### 2026-03-17: Backgammon doubles — 4-move fix

- **Bug:** `getAvailableDice()` used a 2-boolean `usedDice` array to track doubles moves. After 2 moves both booleans were `true`, yielding `remainingCount = 0` — turn ended prematurely with 2 unused moves.
- **Fix:** Added `doublesMovesUsed: number` to `BackgammonState` schema. For doubles, the move action increments this counter instead of toggling `usedDice` booleans. `getAvailableDice()` now takes an optional third parameter `doublesMovesUsed` (default 0) and computes `4 - doublesMovesUsed` for doubles.
- **Scope:** Schema (`shared/src/games/backgammon/BackgammonState.ts`), logic (`backgammonLogic.ts`), plugin (`BackgammonPlugin.ts`), CPU opponent (`CpuOpponent.ts`), client renderer (`BackgammonRenderer.ts` — has its own local `getAvailableDice` copy), unit tests (`backgammon.test.ts`), E2E test (`backgammon.spec.ts`).
- **Pattern:** `usedDice` ArraySchema (2 booleans) is still used for non-doubles to track which specific die value was consumed. `doublesMovesUsed` is the counter only for doubles. Both are reset to default on turn end, roll, pass, and game start.
- **Key learning:** The client renderer has a LOCAL copy of `getAvailableDice` — not imported from server. Must be updated separately when the signature or logic changes.
- **Output:** 294 unit tests passing, lint clean, build clean.


### 2025-07-17: Backgammon E2E — bar entry handling in move loop

- **Bug:** The win-condition E2E test (`e2e/backgammon.spec.ts` line 672) move loop only tried board-to-board moves. When a capture sent an opponent piece to the bar, the server's `isValidMove()` enforced bar entry first (`from !== "bar"` → false). The test never sent `{ from: "bar", ... }` moves, so the player got stuck passing every turn.
- **Fix:** Added bar entry logic at the top of the move loop, before board move attempts. Checks `rolled.blackBar`/`rolled.redBar` for the current player. If bar count > 0, calculates entry point (Black: `die - 1`, Red: `24 - die`), checks destination isn't blocked (2+ opponent pieces), and sends `{ from: "bar", to: entryPoint, die }`. Falls through to board moves only when `barCount === 0`.
- **Also fixed:** The refresh block after successful moves wasn't syncing `rolled.blackBar` and `rolled.redBar`, which would cause stale bar counts on subsequent loop iterations after captures.
- **CPU opponent test:** Verified `e2e/cpu-opponent.spec.ts` doesn't need the fix — it plays a single human turn from the starting position where no pieces can be on the bar.
- **Output:** Build clean, lint clean (0 errors), 294 unit tests passing.

### Dominos game implementation (2026-03-17, issue #124)

- Created shared schema at `shared/src/games/dominos/DominosState.ts`: `DominoTile`, `BoardTile`, `DominosPlayerState`, and `DominosState` extending `BaseGameState`. Uses `defineTypes()` pattern. Board modeled as a linear chain with two open ends (`openEndA`/`openEndB`).
- Created server logic at `server/src/games/dominos/dominosLogic.ts`: pure functions for tile set generation, shuffling, dealing, matching, placement, scoring (domino win + blocked-round resolution), and starting-player determination (highest double).
- Created plugin at `server/src/games/dominos/DominosPlugin.ts`: implements `GamePlugin<DominosState>` with three actions (`play`, `draw`, `pass`), full lifecycle hooks, conditions, and `stateFilter` stub for hidden hand information.
- **Architecture decisions:**
  - Boneyard stored server-side only in a WeakMap-like `Map<DominosState, RawTile[]>` — never exposed in the Colyseus schema. Clients see only `boneyardCount`.
  - Board is a linear `ArraySchema<BoardTile>` chain, not a graph. Open ends tracked as two number fields. Sufficient for standard double-six rules; would need refactoring for Mexican Train or Chicken Foot variants.
  - Draw action does NOT end the turn — player keeps drawing until they can play or boneyard empties, then must pass if still blocked.
  - `stateFilter` returns full state as-is since Colyseus schema-level filtering handles transport; the real hidden-info enforcement is that the boneyard lives outside the schema entirely.
- Registered plugin in `server/src/index.ts`, exported schema from `shared/src/index.ts`.
- Build clean, lint clean (0 errors), 299 unit tests passing.

---

### 2026-03-17T19:44:31Z: Dominos game implementation finalized

- Dominos shared schema, server plugin, and client integration complete.
- **Handoff to Steeply:** Tested all pure logic functions in dominosLogic.ts (tile generation, matching, scoring). 50+ test cases, 382/382 passing.
- **Handoff to Gately:** Renderer implementation (DominosRenderer.ts, ~580 lines) with select-then-route interaction pattern and board visualization.
- **Coordinator fix:** getValidEnds() duplicate bug fixed (was pushing "a" twice).
- **PR #141:** squad/124-dominos → dev. Ready for review. Build clean, lint clean, all tests green.

### Dominos spinner & 4-way branching (2026-03-18)

- Implemented standard dominos spinner rule: first double played becomes the spinner, enabling 4-way branching (arms A, B, C, D).
- **Schema changes** (`shared/src/games/dominos/DominosState.ts`):
  - `BoardTile`: added `arm: string` (tracks which arm: "a"/"b"/"c"/"d"/"spinner"/"") and `isDouble: boolean`.
  - `DominosState`: added `openEndC`, `openEndD` (perpendicular arms, -1 = inactive), `spinnerTileId` (-1 = no spinner), `armACount`, `armBCount`.
- **Logic changes** (`server/src/games/dominos/dominosLogic.ts`):
  - `PlayEnd` type expanded from `"a" | "b"` to `"a" | "b" | "c" | "d"`.
  - `canPlayTile`, `hasPlayableTile`, `getValidEnds`, `isRoundBlocked` all take optional `openEndC`/`openEndD` params (default -1) for backward compatibility.
  - `placeTileOnBoard` rewritten with 6 cases: first-tile double (instant spinner), first-tile non-double, pre-spinner linear, double-becomes-spinner mid-chain (retroactive arm assignment), post-spinner A/B play, C/D perpendicular play.
  - C/D arms activate when both A and B arms have ≥1 tile after the spinner.
  - `toBoardTile` helper now sets `arm` and `isDouble`.
  - `getValidEnds` when A===B returns both ["a","b"] (both arms are distinct play targets after spinner).
- **Plugin changes** (`server/src/games/dominos/DominosPlugin.ts`):
  - `isPlayPayload` accepts "c" and "d" as valid end values.
  - All calls to `canPlayTile`, `getValidEnds`, `hasPlayableTile` now pass `state.openEndC`/`state.openEndD`.
- Updated one test expectation: `getValidEnds` with equal A/B now returns `["a","b"]` instead of `["a"]`.
- All 446 tests passing, build clean, no new lint errors.
- **Key design decision:** Spinner C/D arms don't activate immediately — they wait until both the A-side and B-side each have at least one tile played. This is standard tournament dominos rules.
- **Backward compatibility:** Before the spinner is played, the game still behaves as a 2-end linear chain. Optional params with -1 defaults preserve all existing call sites.

## 2026-03-17 Session: Dominos Spinner Rules (Orchestrated)

**Status:** Complete ✅  
**Cross-agent dependencies:** Gately, Steeply

Implemented standard dominos spinner rules with 4-way branching:
- First double becomes spinner (center)
- Arms C/D activate only after both A/B have ≥1 tile
- Backward-compatible optional params with -1 defaults
- Retroactive arm assignment when double becomes spinner mid-chain

**Decisions merged:**
- Pemulis: Dominos Spinner & 4-Way Branching Logic

**Build/Lint/Test:** ✅ All green (446 tests pass)

---

## Learnings

### 2026-03-18T20:30:00Z: Move History Core Infrastructure (P6.1)

**Task:** Built server-side move history recording system for all games.

**Architecture decisions implemented:**
- **Storage:** Server-side only, in-memory plain array (`private moveHistory: MoveEntry[]`), NOT in Colyseus schema
- **Delivery:** Attached to `GameResult.metadata.moveHistory` at game end (broadcast to all clients including spectators)
- **No schema modification:** History is ephemeral, dies with room, no network sync during game
- **CPU moves recorded:** CPU opponent actions tracked like player actions
- **Spectator visibility:** History broadcast in game result event

**Files created:**
- `shared/src/MoveEntry.ts` — Generic move entry interface with turnNumber, playerId, playerName, actionType, payload, timestamp, optional description

**Files modified:**
- `shared/src/gamePlugin.ts` — Added optional `formatMoveHistory?(state: TState, moves: MoveEntry[]): MoveEntry[]` to GamePlugin interface
- `shared/src/index.ts` — Exported MoveEntry type
- `server/src/game/BaseGameRoom.ts`:
  - Added `moveHistory: MoveEntry[]` private field
  - Added `recordMove(actionType, sessionId, payload)` private method
  - Added `getGameElapsedTime(): number` helper
  - Call `recordMove()` in `processAction()` after successful action execution
  - Reset `moveHistory = []` in `startGame()` alongside `gameStartTime`
  - Format and attach history to `GameResult.metadata.moveHistory` in `endGame()`

**Implementation patterns:**
- Move recording happens AFTER handler success, BEFORE game end check (line ~351 in processAction)
- Timestamp is ms since game start (using existing `this.gameStartTime`)
- Plugin can optionally format moves via `formatMoveHistory()` hook for human-readable descriptions
- Player name resolved from `this.state.players.get(sessionId)?.displayName ?? "Unknown"`

**Build/Lint/Test:** ✅ Build clean, lint clean (0 new errors)

**Key file paths:**
- Move entry interface: `shared/src/MoveEntry.ts`
- Plugin extension: `shared/src/gamePlugin.ts` (line ~37)
- Recording logic: `server/src/game/BaseGameRoom.ts` (recordMove ~line 719, processAction ~line 351, endGame ~line 476)

### Checkers formatMoveHistory implementation (2026-03-16)

- Implemented `formatMoveHistory` on `checkersPlugin` — the first game-specific move formatter. It annotates each `MoveEntry.description` with human-readable text based on move type.
- Description format:
  - Regular move: `"{Name} moved from {from} to {to}"`
  - Capture: `"{Name} captured at {to} (from {from})"`
  - King promotion: `"{Name} kinged at {to}"`
  - Capture + king: `"{Name} captured at {to} (from {from}), kinged at {to}"`
  - Multi-jump chain: `"{Name} captured {N} pieces"` (updates all entries in chain with running count)
- Coordinate notation converts board index to algebraic: col → A-H, row → 1-8 (index 0 = A1, index 63 = H8).
- Capture detection uses row delta (abs delta === 2). King promotion checks playerIndex: BLACK (0) → row 7, RED (1) → row 0.
- Multi-jump detection: consecutive captures by same player where prev entry's `to === current from`.
- Edge cases: missing payload fields produce no description; unknown player IDs skip king detection; original moves array is never mutated.
- 14 new unit tests in `server/src/games/checkers/__tests__/formatMoveHistory.test.ts`.
- All 506 tests pass, build and lint green.

**Key file paths:**
- Formatter logic: `server/src/games/checkers/CheckersPlugin.ts` (formatMoveEntries helper + formatMoveHistory method)
- Tests: `server/src/games/checkers/__tests__/formatMoveHistory.test.ts`

### Risk Quickstart mode (#156, PR #157) (2026-03-16)

- Implemented quickstart toggle for Risk that skips the tedious setup-pick and setup-place phases by randomly distributing territories and armies.
- **Option flow:** `quickstart` boolean passes through `CreateGamePayload` → `LobbyGameEntry` → `matchMaker.createRoom` options → `plugin.lifecycle.onCreate` → stored on `RiskState.quickstart`.
- **Core logic** in `performQuickstartSetup()` (`riskLogic.ts`): Fisher-Yates shuffle of all 42 territory IDs, round-robin assignment to players, 1 army per territory, remaining armies (using existing `calculateInitialArmies` formula) distributed randomly across each player's owned territories.
- **Phase transition:** When quickstart is enabled, `onGameStart` sets `gamePhase="playing"` and `turnPhase="reinforce"` immediately, grants first player reinforcements. No setup-pick or setup-place phases occur.
- **Plugin lifecycle pattern:** First use of `onCreate` hook in a game plugin. Used to extract `quickstart` from room options and persist on state before `onGameStart` runs (since `onGameStart` doesn't receive options).
- **UI:** Added `createToggleRow` for quickstart in `RiskSetupConfig.ts` with label "Quickstart" and description "Skip drafting — territories and armies assigned randomly".
- **Schema change:** Added `quickstart: boolean` to `RiskState` (Colyseus Schema v4, synced to clients).
- **Tests:** 15 new unit tests covering territory distribution evenness (2-6 players), army count correctness per player count, phase transitions, card/combat state initialization, first-player reinforcements, gameplay after quickstart, and backward compatibility of normal setup flow.
- All 521 tests pass, build and lint clean.

**Key file paths:**
- Quickstart logic: `server/src/games/risk/riskLogic.ts` (`performQuickstartSetup`, line ~208)
- Plugin hooks: `server/src/games/risk/RiskPlugin.ts` (`onCreate` and `onGameStart`)
- State schema: `shared/src/games/risk/RiskState.ts` (`quickstart` field)
- Client toggle: `client/src/ui/setup/RiskSetupConfig.ts`
- Tests: `server/src/__tests__/risk.test.ts` (Quickstart Mode describe block)

### Issue #161: BaseGameRoom disconnect/forfeit test failures (2026-03-19)

- **Root cause:** PR #159 (commit 0186c87) introduced the extensible turn timer system, which added a 6-second deferred `this.disconnect()` in `endGame()` via `this.clock.setTimeout(...)`. Since `createRoom()` in tests now provides a mock clock, the deferred path is always taken. Five pre-existing tests that assert `room.disconnect()` were not using fake timers, so the native `setTimeout` callback never fired before assertions ran.
- **Fix:** Added `vi.useFakeTimers()` at the start of each affected test and `await vi.advanceTimersByTimeAsync(6000)` before the disconnect assertion. The `afterEach` block already calls `vi.useRealTimers()` for cleanup.
- **Pattern to remember:** Any test that asserts `room.disconnect()` after a game-ending action must use fake timers and advance past the 6-second disconnect delay introduced in the turn timer system.
- **Affected tests:** "ends the game when an action reports endsGame", "does not hold a seat for a consented disconnect...", "does not award a forfeit win to the shared-device opponent...", "releases the reserved seat after the reconnection window expires", "cleans up the shared-device opponent when the controller times out".
- **Commit:** 266e002
### Dominos tile orientation rendering fix (2026-03-16)

- Fixed bug #155 where dominos tiles rendered with flipped orientation, showing invalid connections (e.g., 0 touching 4 when they should match).
- **Root cause:** The renderer's `drawBoardTile()` function was **ignoring the `exposedEnd` field** on `BoardTile` and always drawing `highPips` on the left/top and `lowPips` on the right/bottom, regardless of which pip should actually face the chain.
- **Server logic (correct):** `placeTileOnBoard()` in `dominosLogic.ts` calls `resolvePlay(tile, endValue)` which returns `newEndValue` (the pip facing outward after placement). This is stored in `BoardTile.exposedEnd`.
  - If `tile.highPips === endValue`, the tile connects via highPips, so `lowPips` is exposed.
  - Otherwise, the tile connects via lowPips, so `highPips` is exposed.
- **Fix:** Modified `drawBoardTile()` to respect `exposedEnd`:
  - **Horizontal orientation:** Draw `exposedEnd` on the **left** half, the other pip on the **right**.
  - **Vertical orientation:** Draw `exposedEnd` on the **top** half, the other pip on the **bottom**.
- Added 3 new tests in `dominosLogic.test.ts` to verify `exposedEnd` is correctly set during placement (highPips match, lowPips match, and double tile cases).
- All tests pass (515 total), build and lint green.
- Committed to existing PR branch `squad/155-dominos-placement` (PR #158 already open).

**Key file paths:**
- Renderer fix: `client/src/renderers/DominosRenderer.ts` (drawBoardTile method)
- State schema: `shared/src/games/dominos/DominosState.ts` (BoardTile with exposedEnd field)
- Placement logic: `server/src/games/dominos/dominosLogic.ts` (resolvePlay, toBoardTile, placeTileOnBoard)
- Tests: `server/src/games/dominos/__tests__/dominosLogic.test.ts` (exposedEnd verification tests)

**Pattern to remember:** When a game state schema includes orientation/directionality metadata (like `exposedEnd`), the renderer **must** use that field rather than assuming a fixed orientation based on `highPips`/`lowPips`. Server-authoritative state always wins.

### Dominos CPU opponents (2026-03-19, Issue #163)

- Created `server/src/games/dominos/CpuOpponent.ts` following the exact Checkers/Backgammon `CpuOpponent.ts` pattern.
- Exports `selectCpuAction(state: DominosState)` returning `{ actionType: "play" | "draw" | "pass", payload? }`.
- Decision tree: if hand has playable tile → play best; if not and boneyard > 0 → draw; else → pass.
- Scoring heuristics: doubles (+200), pip total (×10), flexibility (+50 per remaining matching tile in hand).
- Wired into `BaseGameRoom.executeCpuTurn()` via new `executeDominosCpuTurn()` method, same dispatch pattern as backgammon (multi-action per turn via `queueCpuTurnIfNeeded` loop).
- Enabled dominos in the `cpuOpponentEnabled` gate in both `BaseGameRoom.onCreate()` and `LobbyRoom.shouldEnableCpuOpponent()`.
- Added 10 unit tests in `server/src/games/dominos/__tests__/cpuOpponent.test.ts` covering play/draw/pass decisions, double preference, high-pip preference, end selection, flexibility scoring, perpendicular arm handling.
- Full test suite: 594 tests pass (up from 584), build clean, lint clean.
- Key insight: Dominos CPU uses the same multi-action pattern as Backgammon because `draw` returns `endsTurn: false`, so the CPU re-queues after each draw until it can play or must pass.

## Learnings

### Server-side formatMoveHistory() implementation (2026-03-19, P6.4 polish phase)

- Implemented `formatMoveHistory()` for Backgammon, Dominos, and Risk plugins, following the CheckersPlugin reference pattern.
- **Pattern:** Each plugin's `formatMoveHistory(state, moves)` iterates through the raw moveHistory, adds a human-readable `description` field to each entry, and optionally computes game-specific stats that are stored in metadata for the HistoryScreen.

**BackgammonPlugin (`server/src/games/backgammon/BackgammonPlugin.ts`):**
- Roll descriptions: "Rolled {die1} and {die2}" or "Rolled doubles: {die}"
- Move descriptions: "Moved from point {from} to point {to}", "Entered from bar to point {to}", "Bore off from point {from}" — with " (hit)" suffix when `payload.hit` is true
- Pass description: "No valid moves — passed"
- Stats: `doublesRolled`, `totalHits`, `bearOffs` per player, computed during formatting and attached to `buildGameResult` metadata

**DominosPlugin (`server/src/games/dominos/DominosPlugin.ts`):**
- Play descriptions: "Played [{a}|{b}] on {end} end" (uppercase end letter: A/B/C/D)
  - Pip values extracted from `payload.tile` array (client-side formatters store tile data in payload for server enrichment)
- Draw description: "Drew from boneyard"
- Pass description: "Passed"
- Stats: `tilesPlayed`, `tilesDrawn`, `passCount` per player, attached to `buildScoreResult` metadata

**RiskPlugin (`server/src/games/risk/RiskPlugin.ts`):**
- Territory pick: "Claimed {territory name}"
- Reinforce: "Reinforced {territory} (+{count})"
- Attack: "Attacked {target} from {source} (×{dice} dice)"
- Capture move: "Moved {count} armies into captured territory"
- Fortify: "Fortified {count} armies: {from} → {to}"
- Trade cards: "Traded {count} cards for reinforcements"
- End phase: "Ended phase"
- Territory names resolved via `getTerritoryName(territoryId)` helper that looks up `TERRITORIES` by ID (e.g., "eastern-united-states" → "Eastern United States")
- Stats: `totalAttacks`, `totalFortifies`, `territoriesControlled` per player, attached to `checkGameEnd` metadata

**Stats enrichment pattern:**
- During `formatMoveHistory()`, stats are tracked in a local `playerStats` object and stored in a temporary `state._formattedStats` property (using type assertion to avoid schema pollution).
- The corresponding `buildGameResult()` / `checkGameEnd()` function retrieves `_formattedStats` and merges it into the `metadata` object for client consumption by the HistoryScreen.
- This pattern keeps stats computation co-located with formatting while avoiding round-trips or state mutation.

**Test corrections:**
- Risk test file used incorrect territory IDs (`eastern_us` with underscores) — corrected to match actual TERRITORIES data (`eastern-united-states` with dashes).
- Dominos tests had inconsistent end casing expectations — standardized all to uppercase (A/B/C/D) to match human-readable intent.

**Validation:** All 672 tests pass (up from 660), build clean, lint warnings unchanged (pre-existing in docs/e2e).

**Key file paths:**
- BackgammonPlugin: `server/src/games/backgammon/BackgammonPlugin.ts` (`formatMoveEntries`, `buildGameResult`)
- DominosPlugin: `server/src/games/dominos/DominosPlugin.ts` (`formatMoveEntries`, `buildScoreResult`)
- RiskPlugin: `server/src/games/risk/RiskPlugin.ts` (`formatMoveEntries`, `checkGameEnd`, `getTerritoryName`)
- Reference: `server/src/games/checkers/CheckersPlugin.ts` (multi-jump chain detection pattern)
- Tests: `server/src/games/{game}/__tests__/formatMoveHistory.test.ts`

**Pattern to remember:** When adding game-specific enrichment beyond simple `description` strings (like stats aggregation), use a temporary `_formattedStats` property on state to pass data to the `buildGameResult` function without polluting the schema or requiring additional traversals.

### Game availability filtering via DISABLED_GAMES env var

Implemented per-deployment game availability using a `DISABLED_GAMES` environment variable (comma-separated denylist). Key decisions and touchpoints:

- **Parsing** lives in `server/src/config.ts` as an exported `parseDisabledGames()` function, making it independently testable.
- **Registration filtering** in `server/src/index.ts` — plugins are collected into a typed array and only registered if not in the disabled set. Required `as unknown as GamePlugin<Schema>` casts because `GamePlugin<T>` is contravariant on `T` (same pattern used by `GameRegistry.register` internally).
- **Shared types** added to `shared/src/lobbyTypes.ts`: `AVAILABLE_GAME_TYPES` message constant and `GameTypeInfo` interface. Auto-exported via the barrel wildcard in `shared/src/index.ts`.
- **LobbyRoom** sends `AVAILABLE_GAME_TYPES` to each client on join (all three join paths: new session, existing session rejoin, session reclaim).
- **Test mocks** in `lobby-pregame.test.ts` needed the new constant added to the hoisted `sharedExports` object and fuller metadata in `createPlugin()`.
- Existing `disabled-games.test.ts` had a top-level-await-inside-`describe` issue; fixed by moving the dynamic import into `beforeEach`.


---

## Cross-Agent Update — P7: Game Availability Per Environment (2026-03-20)

**Event:** Game availability feature complete — shared types, server registration, lobby message sender.

**Summary:** Implemented Hal's architecture for deployment-specific game filtering via DISABLED_GAMES env var.

**Outputs:**
- `shared/src/lobbyTypes.ts` — AVAILABLE_GAME_TYPES message constant, GameTypeInfo interface (id, name, playerCount, description, complexity, estimatedDuration)
- `server/src/config.ts` — parseDisabledGames() function, config.disabledGames Set
- `server/src/index.ts` — Filtered plugin registration loop, skips disabled games
- `server/src/rooms/LobbyRoom.ts` — sendAvailableGameTypes() method, called on all join paths
- `.env.example` — DISABLED_GAMES documentation

**Tests:** 21 new unit tests (disabled-games.test.ts) covering parsing edge cases and filtering. All 747 existing tests pass.

**Validation:** Build ✓, Lint ✓, Test ✓

**Status:** Ready for client and infra work. Feature merged into decisions.md (`pemulis-game-availability.md`).

### Chess Clock for Checkers (2026-01-XX — Issue #165)

**Objective:** Add chess clock (10-minute time banks per player) to Checkers with timeout handling, pause on disconnect, and tick-based countdown.

**Approach:**
- Added schema fields to CheckersState for player1TimeRemainingMs and player2TimeRemainingMs
- Implemented onTick lifecycle hook in CheckersPlugin to decrement the active player's clock each tick
- Modified checkGameEnd condition to detect clock timeout and declare the other player winner
- Clock automatically pauses when a player disconnects (existing isConnected logic)
- Leveraged BaseGameRoom's existing setSimulationInterval infrastructure for tick mechanism

**Implementation Details:**
- `shared/src/games/checkers/CheckersState.ts` — Added `@type("number")` decorated fields for both player clocks with 600000ms (10 min) defaults in constructor and defineTypes
- `server/src/games/checkers/CheckersPlugin.ts` — Added CHESS_CLOCK_ENABLED constant (true), INITIAL_TIME_BANK_MS constant (600000), onGameStart initialization of clocks, onTick handler that checks phase === "playing" and decrements current player's clock (with disconnect pause via isConnected check), checkGameEnd timeout detection with GameResult creation
- Clock automatically switches when currentTurn changes after action with endsTurn: true
- Used Math.max(0, clock - deltaTime) to prevent negative values
- Mapped sessionId → playerIndex via state.players to know which clock to decrement

**BaseGameRoom Integration:** No changes needed — existing infrastructure in BaseGameRoom.onCreate already sets up tick interval when plugin.lifecycle.onTick exists (lines 108-112), and calls plugin.lifecycle.onTick with deltaTime on each simulation interval.

**Validation:** Build ✓, Tests ✓ (all pass, no new tests added for this server-side feature yet)

**Status:** Server-side logic complete and verified. Ready for client UI integration to display clocks.


### Chess Clock Generalized to Base Layer (2026-03-20)

- Refactored chess clock from checkers-specific to a generic base-layer system
- Schema fields `player1TimeRemainingMs` and `player2TimeRemainingMs` moved from CheckersState to BaseGameState (default 0, set by config)
- Added `chessClockConfig?: { enabled: boolean; initialTimeBankMs: number }` to GamePlugin interface
- Chess clock tick logic moved from CheckersPlugin.onTick to BaseGameRoom.updateChessClocks (separate simulation interval)
- Chess clock timeout detection moved from CheckersPlugin.checkGameEnd to BaseGameRoom.checkChessClockTimeout
- CheckersPlugin now declares `chessClockConfig: { enabled: true, initialTimeBankMs: 600000 }` instead of hardcoded constants
- Client GameScene.ts now detects chess clock generically (checks if time fields > 0) instead of hardcoding `gameType === "checkers"`
- Tests updated to reflect BaseGameState inheritance pattern (fields default to 0, BaseGameRoom sets actual values)
- All validation passes: `npm run build && npm run test` (773 tests passed including 26 chess clock tests)
- Pattern ready for ANY 2-player game to opt in by adding chessClockConfig to their plugin

## Chess Clock System — Two-Phase Implementation (Issue #165) (2026-03-20)

**Role:** Systems Developer  
**Outcome:** ✅ Complete, both phases implemented and merged

### Phase 1: Checkers-Specific Implementation (Initial)

Implemented server-side chess clock logic for Checkers following Hal's architecture:
- Added player1/2TimeRemainingMs to CheckersState schema
- Config constants: CHESS_CLOCK_ENABLED=true, INITIAL_TIME_BANK_MS=600000
- Lifecycle hooks: onGameStart (init), onTick (decrement), checkGameEnd (timeout)
- Disconnect pause: Reuses existing isConnected pattern
- Integration: Zero changes to BaseGameRoom (reuses setSimulationInterval)

**Tests:** 26 unit tests covering initialization, tick, timeout, transitions, edge cases (all pass)

### Phase 2: Generic Refactor (Per Copilot Directive)

Promoted chess clock from checkers-specific to generic base-layer system:
- Moved time fields to BaseGameState (default 0)
- Created ChessClockConfiguration interface in IGamePlugin
- BaseGameRoom now owns updateChessClocks(), checkChessClockTimeout() logic
- CheckersPlugin declares config: `{ enabled: true, initialTimeBankMs: 600000 }`
- Removed checkers-specific onTick/timeout hooks
- Client generalized: checks if chessClockTime !== null && > 0 (not hardcoded to checkers)

**Impact:**
- DRY principle: Clock logic in one place (BaseGameRoom)
- Future-proof: Backgammon, Go, etc. enable chess clocks by adding config (no code duplication)
- Type-safe: Config validated at compile time
- All 773 tests pass (26 chess clock-specific)
- Zero breaking changes

**Learning:** Two-pass implementation strategy (specific → generic) balances speed of initial feedback with long-term reusability. Copilot directive provided clear scope adjustment (base-layer design).

### Disable chess clock for CPU games (2026-03-20)

- Added `!this.cpuOpponentEnabled` guard to all three chess-clock code paths in `BaseGameRoom.ts`: the simulation interval registration (`onCreate`), the clock initialization (`startGame`), and the timeout check (`processAction`).
- The `cpuOpponentEnabled` flag is already set from room options at `onCreate` time, so no new state or flags were needed — just three `&&` clauses.
- Important subtlety: without the guard on `checkChessClockTimeout()`, skipping clock initialization alone would cause an immediate timeout (clocks default to 0, and `<= 0` triggers forfeit).
- Added 3 integration tests to `chess-clock.test.ts` using the BaseGameRoom mock infrastructure: CPU game clocks stay at 0, no simulation interval registered for CPU games, human-vs-human clocks still work.
- Build, lint (no new errors), and all 776 tests pass.

---

### 2026-03-20: Orchestration Complete (Scribe)

Session finalized: Orchestration logs created, decisions merged, cross-agent references propagated. See `.squad/log/2026-03-20T15-15-24Z-scribe-session.md`.

**Related work:**
- Marathe: Dev→UAT workflow dispatch (parallel)
- Gately: Board coordinate labels (completed earlier, merged in this session)

**Decisions merged:** `pemulis-cpu-no-timer.md` → decisions.md

**Test Results:** 776 tests passing (all green)


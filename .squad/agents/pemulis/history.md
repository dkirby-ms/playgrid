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


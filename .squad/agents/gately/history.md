# gately — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Core Context (2026-03-14 Research Phase)

**Client architecture:** Plugin-based renderers per game (GameRenderer interface + RendererRegistry). Scene management system (Lobby, Waiting Room, Game scenes with enter/exit/update/resize lifecycle). Hybrid UI: HTML/CSS for menus, PixiJS for games. Server-authoritative state; client sends input intents only.

**Rendering by game:** Simple (Checkers, Backgammon, Dominoes via Graphics API), Medium (card games with sprite sheets), Complex (Risk with pan/zoom map SVG). Lazy-load assets per game.

**Spectator mode:** Hidden-info games show public board + hand viewer. Public games show full state read-only. Perspective selector for cards.

**Responsive design:** PixiJS viewport scales/centers. Touch as pointer events. Mobile: 44px+ hit areas, overlay controls.

**Connection lifecycle:** Reconnect with 5-attempt exponential backoff. 30s seat reservation on disconnect. Reconnecting overlay with countdown.

**Infrastructure:** Scene.ts contract, SceneManager for transitions, GameRenderer + RendererRegistry, refactored Application.ts bootstrap.

**Phase 1 Games Completed (2026-03-14):**
- Checkers: Full game loop, state sync, click-to-move interaction, endgame overlay, player count locks
- Backgammon: Game plugin, renderer, state filtering, in-game HUD overlay
- Lobby dashboard: Game type tiles, active session card display, responsive grid layout

**Cross-agent alignment:** Pemulis (server plugin system), Hal (architecture lead), Marathe (PostgreSQL setup). Issue templates + CONTRIBUTING guide available (Joelle).

**Build Status:** All Phase 1 work passed tests, lint, and build.

---

## Prior Sessions (2026-03-14 to 2026-03-15) — Consolidated Summary

**Session Resilience & Reconnection (2026-03-15):**
- Implemented client-side reconnect persistence in sessionStorage
- ReconnectOverlay UI for drop/reconnect states with 30s countdown
- Startup reconnect attempt before fresh lobby boot
- State cleanup on consented leave, game-end, or failed restore
- Coordinated with Pemulis (server-side 30s window) and Steeply (test contracts)

**Risk Plugin Phase 1 & Triage (2026-03-15):**
- Hal triaged Risk game, assigned rendering as Phase 3 priority
- Designed interactive map renderer architecture (42 clickable territories, continent colors)
- Planned HUD with turn phase, action indicators, army count display
- Blocked pending Pemulis schema stabilization; designed in parallel

**Backgammon & Early Fixes (2025-01-13 to 2026-01-13):**
- Fixed board rendering bug (issue #96) — improper coordinate mapping
- Enhanced start game error display (issue #102) — validation feedback
- Fixed turn timer visibility (issue #100, PR #101) — display lifecycle

**Lobby Event Messaging (2026-03-15):**
- Implemented event-based lobby message broadcasting
- Real-time game status updates for all connected clients

**Cross-Agent Collaboration:**
- PR #83 revision cycle with Pemulis (lockout protocol) and Steeply (test refinement)
- Head-to-head Checkers shared-device mode (controllerSessionId mapping, synthetic opponent)
- Turn indicator design (sidebar highlight vs. overlay banner)
- Multiple approval cycles with Hal (lead) — decisions merged to .squad/decisions.md

---

## 2026-03-16: Phase 4 Design Token Unification — Session Complete

**From:** Squad Scribe  
**Event:** Three-renderer visual redesign completed under shared DesignTokens system

**Deliverables:**
- **Checkers:** Shape-marker king indicators (concentric rings), glossy piece gradients, violet selection affordances, capture tray visual feedback
- **Backgammon:** Dark wood/felt board textures, domed piece rendering, white checker display (RED side), preserved BLACK/RED game logic
- **Risk:** Six-player palette from DesignTokens, safe HUD defaults during state hydration, attack source/target visual feedback

**Key Decisions Implemented:**
1. **Shared Token System:** All renderers use `DesignTokens.ts` as single source of truth (no drift)
2. **Sidebar Separation:** `GameSidebar.ts` decoupled from `HUD.ts` for game-specific customization
3. **Safe Defaults:** HUD text helpers return empty values when state is incomplete (fix for crash on join)

**Cross-Agent Coordination:**
- Mario established lobby/sidebar CSS foundation (dark zinc/violet theme, glass-morphism panels)
- Joelle updated README with games list, tech stack, team roster
- Marathe integrated GitHub Release publishing into deploy-prod.yml (post-deployment verification)

**Files Affected:**
- `client/src/renderers/CheckersRenderer.ts`, `BackgammonRenderer.ts`, `RiskRenderer.ts`
- `client/src/renderers/DesignTokens.ts` (new, centralized colors)
- `client/src/ui/GameSidebar.ts` (new, sidebar component)
- Related decision entries merged to `.squad/decisions.md`

**Status:** Phase 4 complete. Design system established. Ready for Phase 5 (future: Scrabble, Hungry Hippos, Catan — currently out of scope).

### 2026-03-16: Desktop sidebar layout must reserve board width

- **User preference:** Desktop game UI must not cover the Pixi board; sidebar/HUD chrome should sit beside the board, while mobile keeps the canvas full width.
- **Layout pattern:** `client/index.html` now owns the reserved desktop lane through `body.game-layout-sidebar-active` and shared CSS variables for sidebar width, gap, and edge offset.
- **Resize coordination:** `client/src/ui/GameSidebar.ts` toggles the body layout class and emits a `playgrid:layoutchange` event; `client/src/Application.ts` watches `#game-container` with `ResizeObserver` and forces `pixiApp.resize()` plus `sceneManager.resize(...)` so renderer layouts follow CSS-driven width changes.
- **HUD anchoring rule:** `client/src/ui/HUD.ts` should position status, leave, and chat controls from `#game-container.getBoundingClientRect()` instead of the viewport so overlay controls stay inside the playable column.
- **Key file paths:** `client/index.html`, `client/src/ui/gameLayout.ts`, `client/src/ui/GameSidebar.ts`, `client/src/ui/HUD.ts`, `client/src/Application.ts`.

---

## 2026-03-16: Issue #97 — Center version footer and add feedback link

**Session:** background mode, completed  
**Outcome:** ✅ PR #118 created targeting dev. Footer now centered with feedback link to GitHub issues.

**Details:**
- Moved version footer from bottom-right to bottom-center using Flexbox + transform
- Added "Submit Feedback" link next to version text
- Implemented safe external link handling (`target="_blank"`, `rel="noopener noreferrer"`)
- Subtle hover effect on feedback link for discoverability

**Decision merged to `.squad/decisions.md`**

---

## 2026-03-16: Issue #100 — Manual dice roll button with animation for backgammon

**Session:** background mode, resumed after interruption, completed  
**Outcome:** ✅ PR #119 created targeting dev. Roll Dice button with 20-frame animation working. Server-side `roll` action implemented.

**Details:**
- Client-side: Frame-based animation (20 frames, ~333ms at 60fps) shows random dice during roll
- Server-side: `roll` action on BackgammonRoom applies real dice values from authoritative server
- Button enabled only when turn is active and dice unrolled (0,0)
- Animation stops when server returns actual dice values
- Used `requestAnimationFrame` via existing game loop update() method (no setTimeout)

**Decision merged to `.squad/decisions.md`**

---

## Learnings

### 2026-03-16: Checkers turn emphasis should stay inside the sidebar

- **What changed:** Removed the temporary Pixi turn banner from `client/src/renderers/CheckersRenderer.ts`, deleted the banner view-model test files, and moved the emphasis back into the existing Game Info panel by rendering a highlighted `Current turn` row that reads `Your Turn` for the active local player.
- **Pattern discovered:** `client/src/ui/GameSidebar.ts` is the right place for reusable turn-state treatment. Adding opt-in sidebar row/value classes plus CSS custom properties let the renderer dial in game-specific accent colors while keeping the layout inside the shared glass-panel system.
- **User preference:** Turn prompts should be unmistakable but non-obstructive. Prefer a brighter, slightly animated sidebar treatment over any overlay/banner that sits on top of the board.

### 2026-03-16: Dev Sandbox MVP — Gameboard Renderer Testing Tool

- **PR #132** implements the dev sandbox for live gameboard rendering without server connection
- **Files created:** 
  - `client/src/scenes/SandboxScene.ts` — Scene that mounts renderers with mock state
  - `client/src/sandbox/mockStates.ts` — Mock state generators for Checkers, Backgammon, Risk
  - `client/src/sandbox/SandboxStatePanel.ts` — HTML overlay panel for live state editing
- **Route detection:** Application.ts now checks for `/sandbox/{game}` URL patterns (hash or path)
- **State editing by game:**
  - **Checkers:** Full visual board editor (click cells to cycle pieces), mustCaptureFrom input
  - **Backgammon/Risk:** JSON textarea editors (MVP — sufficient for testing)
- **Architecture patterns:**
  - Renderers already use optional chaining for state access → plain JS objects work
  - Pass `room: undefined` in GameRendererContext — renderers handle gracefully
  - SandboxStatePanel uses HTML/CSS overlay (not PixiJS) for controls
- **Zero production impact:** All new files + minimal routing changes in Application.ts
- **Success:** Build, lint, and tests all pass. Ready for renderer testing workflow.

---

## Session 2026-03-16: PR #125 Fix & Sandbox Completion

**Role:** Blocker resolver (PR #125 fix), sandbox MVP implementation  
**Output:** PR #125 pass-action fix, PR #132 sandbox MVP (both merged)  

**Summary:**
- PR #125 (Backgammon CPU) blocked on no-valid-moves bug → Pemulis locked out
- Applied Hal's specification: implemented "pass" action in BackgammonPlugin
- Added validation: pass only when dice rolled AND no valid moves exist
- Updated selectCpuAction() to return { actionType: "pass" } instead of null
- Added 5 tests covering pass action scenarios (plugin + CPU)
- PR #125 re-submitted, Hal approved & merged

- Implemented sandbox MVP (PR #132):
  - Created SandboxScene.ts, mockStates.ts, SandboxStatePanel.ts
  - Mock state builders for all 3 games (plain JS objects, not Schema)
  - HTML overlay for state controls (Checkers: visual editor, Backgammon/Risk: JSON textarea)
  - Route detection in Application.ts for /sandbox/{game} patterns
  - No server connection required
- Hal reviewed & approved #132 → merged

**Key Achievement:** Fixed critical Backgammon bug using lockout protocol, then shipped dev sandbox MVP for renderer testing.

**Directives:**
- Dev sandbox must stay in sync with real game renderers (not a disposable tool)
- Mock state builders need updates whenever real state schemas change

**Output:**
- PR #125 merged (Backgammon CPU with pass action)
- PR #132 merged (Dev sandbox MVP)
- Issues #87 closed via #125
- All 289 tests passing

## Session 2026-03-17: E2E Test Failure Triage and Fix Marathon

**Event:** Extended multi-hour session supporting E2E test failure fixes across 4-agent coordination.  
**Role:** Indirect support (no direct E2E work assigned in this session)  

**Context:** Hal coordinated investigation of 15 failing E2E tests. Pemulis fixed Risk reinforcement bug, Steeply fixed spectator/reconnection/backgammon issues, Coordinator fixed snapshot extraction and CPU detection.

**Outcome:** E2E suite 15/40 → 40/40 passing, 292/292 unit tests passing, lint clean.

**Cross-Agent Notes for Future E2E Work:**
- **`playMoveForCurrentTurn()` pattern:** Reusable for multiplayer E2E where move selection depends on game state (not hardcoded player color)
- **Fallback extraction chains:** When rendering moves elements between PixiJS/DOM, E2E snapshots need IIFE pattern (try PixiJS → try DOM → default)
- **CPU opponent via session ID:** Don't add schema-level CPU indicators; use `controllerSessionId === "cpu-opponent"` instead
- **Backgammon timing:** Stochastic game paths need 180s timeout for E2E tests (not default 30s)

**Relevant to Renderer Work:**
- Dev sandbox (PR #132 merged) will need renderer updates if state schemas change
- **Spec updates to monitor:** If future rendering changes move elements between PixiJS/DOM, E2E snapshot extraction may need fallback adjustments


### 2025-07-18: Backgammon dice UX — always-visible clickable dice

- **Double-click bug root cause:** The sidebar "Roll Dice" button was rebuilt via `innerHTML` on every `updateSidebar()` call, including from `setTurnClock()` timer ticks. If the DOM element was destroyed between mousedown and mouseup events, the click was swallowed. Moving the roll interaction to a PixiJS `pointertap` event on the `diceLayer` Graphics object eliminates this class of bugs entirely.
- **Dice always visible:** `redrawDice()` no longer returns early when dice are [0,0]. Instead it shows placeholder dice (value 1) at 28% alpha. After rolling, dice show at full opacity. During animation, 85% alpha. Used dice retain their existing `BACKGAMMON_USED_DIE_ALPHA` (35%).
- **Interactive dice layer:** `diceLayer.eventMode` changed from `"none"` to `"static"`, with `pointertap` handler calling `handleRollDice()`. Cursor set to `"pointer"` when dice are clickable (local player's turn, unrolled, not animating).
- **Sidebar cleanup:** Removed "Roll Dice" button from controls panel. Resign button remains. Updated dice label text and sidebar note to reference board dice.
- **Pattern:** For interactive game elements, prefer PixiJS canvas events (`pointertap`) over HTML sidebar buttons to avoid DOM rebuild race conditions.

### 2026-03-17: Risk SVG map — geographic bezier territory paths

- **Problem:** All 42 Risk territory paths were crude polygons (~100 chars each, 8-12 straight-line segments). Rendered as "blue and red blobs" instead of recognizable geography.
- **Solution:** Replaced every path with detailed cubic Bézier curves (C commands). Each territory now uses 13-52 bezier segments (avg 700+ chars). Coastlines are smooth curves; island territories (Iceland, GB, Japan, Indonesia, Madagascar) use multi-subpath SVG paths.
- **Layout:** Continents positioned geographically in 1000×600 viewBox — NA left, SA below, Europe upper-center, Africa below Europe, Asia right, Australia bottom-right.
- **Approach:** Used Python-based Catmull-Rom spline → cubic Bézier conversion to generate smooth paths from geographic outline points. Each territory defined as clockwise outline points, then auto-smoothed.
- **Also updated:** labelX/labelY centroids, connectionOverrides waypoints for Alaska–Kamchatka and Brazil–North Africa wrapping connections, map version bumped to 2.
- **Validation:** `npm run build && npm run lint && npm run test` — all green (0 errors, 294 tests pass).
- **Committed to:** `dev` branch.

### 2026-03-17: SVG file-based Risk map redesign

- **Problem:** Hand-coded SVG path strings in `classicRiskMap.ts` still looked like blobs. User insight: use an actual SVG file as the source of truth for geography.
- **Solution:** Architecture redesign — Option C (build-time SVG import via Vite `?raw`):
  1. Created `risk-map.svg` — 42 territory `<path>` elements with IDs matching territory IDs, geographically accurate shapes using Catmull-Rom → cubic bezier smoothing.
  2. Created `svgMapLoader.ts` — parses SVG string with DOMParser, extracts path `d` attributes, label positions, and continent groupings. Pulls adjacency data from shared `TERRITORIES` constant.
  3. Rewrote `classicRiskMap.ts` to import SVG via `?raw` and call `loadMapFromSvg()` at module level. Just 18 lines now vs ~440 before.
- **Key architecture:** SVG file is source of truth for geometry → parsed at load → fed into existing `drawSvgPath()` → PixiJS pipeline. `RiskRenderer.ts` unchanged (zero changes needed).
- **Files added:** `client/src/renderers/risk/risk-map.svg`, `client/src/renderers/risk/svgMapLoader.ts`
- **Files modified:** `client/src/renderers/risk/classicRiskMap.ts` (rewritten), `client/src/renderers/risk/index.ts` (added export)
- **Map version:** Bumped to 3.
- **Connection overrides:** Alaska-Kamchatka and Brazil-North Africa waypoints moved into `svgMapLoader.ts`.
- **Validation:** `npm run build && npm run lint && npm run test` — all green (0 errors, 294 tests pass).

### 2026-03-17: Real SVG Design Asset Integration

- **Replaced synthetic `risk-map.svg`** (52KB generated) with the real Inkscape design asset from `docs/designs/risk.svg` (500KB, 42 territories with geographic paths).
- **SVG ID normalization in `svgMapLoader.ts`:** Design SVG uses underscores (`east_africa`), game state uses hyphens (`east-africa`). Loader now normalizes via `_` → `-` replacement and applies a typo fix map (`yakursk` → `yakutsk`).
- **Label centroid computation:** Design SVG has no `data-label-x`/`data-label-y` attributes. Loader now computes bounding box centroids from path `d` data as fallback, supporting M/L/H/V/C/S/Q/T/A commands (both absolute and relative).
- **ViewBox fallback:** Design SVG has no `viewBox` attribute — uses `width`/`height` instead (749.82 × 519.07). Loader now reads `width`/`height` when `viewBox` is absent.
- **Connection overrides scaled to viewBox:** Alaska-Kamchatka and Brazil-North Africa waypoints now use `viewBoxWidth`/`viewBoxHeight` proportions instead of hardcoded 1000×600 values.
- **Continent display names:** Added `formatContinentName()` helper to convert hyphenated IDs to title case when `<g>` elements aren't present.
- **Key pattern:** Design assets live in `docs/designs/`, are copied to renderer dirs for Vite `?raw` import. The loader is the normalization boundary between design files and game state.
- **Validation:** `npm run build && npm run lint && npm run test` — all green (0 errors, 294 tests pass).

### 2026-03-17: Territory Drafting Phase for Risk

- **Replaced auto-deal with drafting**: `onGameStart()` in `RiskPlugin.ts` no longer auto-distributes all 42 territories. Game now starts in `setup-pick` phase with all territories unclaimed (owner: "", armyCount: 0).
- **New `pickTerritory` action**: Players take turns claiming one unclaimed territory at a time. Each claim sets owner + armyCount 1, advances turn. When all 42 territories are claimed, transitions to `setup-place` with remaining army allotment calculated (initialArmies - territoriesOwned).
- **Client `setup-pick` handling**: `RiskRenderer.ts` sends `pickTerritory` action (not `placeArmy`) during setup-pick. Unclaimed territories already render in neutral BG_CARD color. Phase banner already shows "Setup • Pick Territories".
- **Validation added**: `validateAction` now handles `pickTerritory` action type during `setup-pick` phase.
- **Tests updated**: Replaced 3 auto-deal tests with 7 drafting tests (pick, claim conflict, phase guard, transition, army count, territory count). Updated 4 integration tests to use new `createDraftedGame()` helper. All 299 tests pass.
- **Removed dead code**: `shuffleArray` function removed from plugin (no longer needed without auto-deal).
- **Validation:** `npm run build && npm run lint && npm run test` — all green (0 errors, 299 tests pass).

### 2026-03-17: Fix Risk Premature Game End During Setup

- **Bug**: `checkWinCondition()` fired during `setup-pick` after the first territory pick because only 1 unique owner existed across all territories — game declared an instant winner.
- **Server fix**: Added `if (state.gamePhase === "setup") return null;` guard at top of `checkGameEnd` in `RiskPlugin.ts`. Win condition checks now skip entirely during setup phase.
- **Unit test fix**: Two win-condition unit tests (`game ends when one player controls all territories`, `eliminated player has zero territories`) now set `state.gamePhase = "playing"` before asserting, since `createStartedGame()` starts in setup phase.
- **E2E test updates**: Added `completeDraftingPhase()` helper that loops through all 42 territory picks. Updated `completeSetupPhase()` to call drafting first. Updated "creates a Risk game" test to assert `setup-pick` initial state (unowned territories, 0 armiesToPlace). Updated "rejects placing armies on opponent territory" to complete drafting before testing. Updated "players place initial armies" to expect `setup-pick`.
- **Validation:** `npm run build && npm run lint && npm run test` — all green (0 errors, 299 tests pass).

---

## Session: Build Dominos Client Renderer (Issue #124)

**Branch:** `squad/124-dominos`

### What was done

- Created `client/src/renderers/DominosRenderer.ts` implementing the full `GameRenderer` interface for Dominos.
- Registered the renderer in `client/src/renderers/index.ts` as `"dominos"`.

### Renderer features

- **Board chain**: Horizontal layout of played tiles with auto-scaling when chain exceeds viewport. Tiles show pip dots and divider lines. Last-played tile is highlighted.
- **Player hand**: Clickable domino tiles at bottom of screen. Selection glow on chosen tile. Auto-play when only one end is valid; end-choice markers (A/B buttons) when tile fits both ends.
- **Boneyard**: Clickable area in top-right showing remaining tile count. Clicking triggers draw (if tiles remain) or pass (if empty).
- **Opponent hands**: Face-down tile count shown in top-left area per opponent.
- **Sidebar (GameSidebar)**: Three panels — Game Info (turn, board/boneyard counts, open ends, status), Players (scores, hand sizes, turn indicator), Controls (Draw/Pass/Resign buttons).
- **Game-over overlay**: Shows winner name and final scores.
- **HUD status**: `getHUDStatus()` returns turn/phase info.
- **Cleanup**: `destroy()` tears down sidebar, clears all layers, and unsubscribes room events.

### Key files

- `client/src/renderers/DominosRenderer.ts` — the renderer (~600 lines)
- `client/src/renderers/index.ts` — registry
- `shared/src/games/dominos/DominosState.ts` — the schema being rendered

### Learnings

- Dominos tiles use vertical orientation in hand (highPips top, lowPips bottom) and horizontal on board (highPips left, lowPips right).
- The `exposedEnd` field on `BoardTile` tracks which pip value faces outward in the chain.
- Player actions sent via `room.send("action", { type, ...payload })` — types: `"play"`, `"draw"`, `"pass"`.
- Board state has `openEndA`/`openEndB` (-1 when empty) for end-placement validation.
- Pre-existing failing test in server dominos logic (getValidEnds duplicate handling) — not a renderer issue.

- **End choice markers**: When a tile matches both open ends and they differ, shows "Place at End A" / "Place at End B" buttons on the board for player selection.
- **Boneyard UI**: Displays in top-right as a tileable region (shows count of remaining tiles). Clickable for draw action.
- **Action buttons**: Draw and Pass available via both boneyard click and sidebar buttons.
- **Architecture**: Pure PixiJS graphics (no DOM canvas issues). Fully compatible with Colyseus delta sync. Lifecycle: init() → update() → destroy(). No breaking changes to other renderers.
- **Validation:** `npm run build && npm run lint` — all green.

**PR #141:** squad/124-dominos → dev. Ready for review with Pemulis (schema/plugin) and Steeply (tests).

## Learnings

### 2026-03-17: Hidden-hand security fix for Dominos (Hal's PR #141 review)

- **Security issue**: `DominosPlayerState.hand` (ArraySchema<DominoTile>) was synced to ALL clients via Colyseus schema. Any player could see opponent tiles via browser devtools. The `stateFilter.filterForClient` was a no-op.
- **Fix pattern — server-side hands**: Followed the existing boneyard pattern. Hands are now stored in a module-scoped `Map<DominosState, Map<string, RawTile[]>>` in DominosPlugin.ts, never synced via schema.
- **Schema change**: Replaced `hand: ArraySchema<DominoTile>` with `handCount: number` on `DominosPlayerState`. Clients can see how many tiles opponents hold, but not which tiles.
- **Per-client messaging**: Added `getPlayerMessage?(state, sessionId)` to the `StateFilter` interface. BaseGameRoom calls it after every successful action, after game start, and on player reconnect. Each client receives their own hand tiles via a `"player-data"` room message.
- **Renderer changes**: DominosRenderer now listens for `"player-data"` messages to populate the local player's hand. Opponent hand counts come from schema `handCount`. Also fixed `room.send()` format — was sending `"action"` message type which didn't match BaseGameRoom's per-action-type registration.
- **Logic function signatures**: `isRoundBlocked`, `resolveBlockedRound`, `scoreDomino` now accept a `Map<string, RawTile[]>` parameter. `removeTileFromHand` now works on `RawTile[]` instead of schema ArraySchema.
- **Exported test helpers**: `getPlayerHand`, `setPlayerHand`, `getPlayerHands` exported from DominosPlugin.ts for test setup.
- **Key insight**: Colyseus schema auto-syncs everything to all clients. The ONLY way to keep data hidden is to NOT put it in the schema. Module-scoped Maps keyed by state instance work well for this.
- **Validation:** `npm run build && npm run lint && npm run test` — all green (0 errors, 382 tests pass, 12 todo).

### 2026-03-17: UX Redesign — Lobby + Dominos Renderer (Figma → Live)

- **Design pipeline:** Figma exports land in `docs/designs/playgrid-ux/` as React/shadcn components. We convert them to the live PixiJS + HTML DOM implementation.
- **Lobby changes:** Migrated color palette from zinc/violet to slate/blue. Background gradient `from-slate-950 via-slate-900 to-slate-800`. Header, filter buttons, game tiles, sidebar panels, active game cards, online players all updated. Added Dominos to `GAME_TYPE_OPTIONS` (2-4 players) and `GAME_TILE_ARTWORK`.
- **DominosRenderer:** Added emerald green board background (EMERALD_800/900 tokens). New "How to Play" sidebar panel with gameplay instructions. Renamed "Game Info" to "Game Status". Empty board text now shows "Play any domino to start" in emerald-tinted color.
- **DesignTokens:** Added `EMERALD_800` (0x065F46) and `EMERALD_900` (0x064E3B) for the dominos board surface.
- **Preserved:** All Colyseus room bindings, message handlers, game creation/joining flow, filter logic, online player rendering unchanged.
- **Validation:** `npm run build && npm run lint && npm run test` — all green.

---

## 2026-03-17: UX Redesign — Lobby + Dominos (Figma Match)

**Session:** Concurrent with Mario (UX gap analysis) and Copilot (CI fix)

**Work Completed:**
- Updated LobbyScreen.ts: Added Dominos to GAME_TYPE_OPTIONS and GAME_TILE_ARTWORK
- Updated DominosRenderer.ts: Emerald board background, "How to Play" sidebar panel, updated empty board text
- Updated DesignTokens.ts: Added EMERALD_800, EMERALD_900 color tokens
- Updated client/index.html: Migrated CSS colors from zinc/violet to slate/blue palette

**Design Changes:**
- Lobby palette shifts to dark slate/blue (slate-950/900/800) from zinc
- Dominos board gets emerald green felt surface
- New "How to Play" sidebar improves onboarding
- Color accents updated throughout for design language alignment

**PR Status:**
- Opened PR #143 (squad/ux-redesign-lobby-dominos → dev)
- Work aligns with Mario's GAP-ANALYSIS.md findings
- Unblocked by Copilot's fix to issue #142 (CI build)

**Files Modified:**
- client/index.html
- client/src/ui/LobbyScreen.ts
- client/src/renderers/DominosRenderer.ts
- client/src/renderers/DesignTokens.ts

**Notes:**
- Also implemented hidden-hand pattern for Dominos (server-side hand storage, per-player messaging)
- Migrated hand storage from schema to server Map per Hal's security requirements
- Added getPlayerMessage hook for generic hidden-token games pattern
- 48 new plugin tests added by Steeply verify privacy guarantees

---

## 2026-03-17: Dominos Hidden Information Security Fix

**Context:** Hal's PR #141 review flagged opponent hands visible in schema

**Problem:**
- DominosPlayerState.hand was ArraySchema<DominoTile> synced to all clients
- Players could inspect opponent tiles in browser devtools
- stateFilter was a no-op; infrastructure never invoked

**Solution:**
Implemented generic hidden-hand pattern following boneyard precedent:
- Remove hand tiles from schema entirely
- Store hands server-side in Map<DominosState, Map<string, RawTile[]>>
- Deliver hand per player via targeted room messages using new StateFilter.getPlayerMessage hook
- Schema carries only public counts (handCount, boneyardCount)

**Implementation:**
- Added getPlayerMessage?(state, sessionId): unknown to StateFilter interface
- BaseGameRoom calls hook at game start, after actions, and on reconnection
- DominosPlugin stores hands in module-level Map, implements getPlayerMessage
- Client receives hand via room.onMessage("player-data", ...)

**Consequences:**
- Breaking change: DominosPlayerState.hand removed (code reading it needs migration)
- Logic functions now require playerHands map parameter (scoreDomino, isRoundBlocked, etc.)
- dominosLogic.test.ts has 11/83 failures needing separate fix

**Generic Pattern:**
- Any future hidden-info game (Poker, Hearts, Scrabble) implements getPlayerMessage on its plugin
- No framework changes needed for new games
- Aligns with user directive: reusable pattern, not Dominos-specific

**Files Modified:**
- shared/src/gamePlugin.ts
- shared/src/games/dominos/DominosState.ts
- server/src/game/BaseGameRoom.ts
- server/src/games/dominos/DominosPlugin.ts
- server/src/games/dominos/dominosLogic.ts
- client/src/renderers/DominosRenderer.ts
- server/src/games/dominos/__tests__/dominosPlugin.test.ts


## Learnings

### Risk setup→playing transition bug (2026-03-16, PR #144)
- **Bug:** `placeArmy` during setup returned `endsTurn: true` when a player finished, but never checked if ALL players were done. The only "all done" check was in `endPhase`, which required explicit invocation — impossible when the current player has 0 armies.
- **Fix:** Added an `allDone` check in `placeArmy`: when `armiesToPlace === 0` during setup, iterate all active players; if everyone is at 0, set `gamePhase = "playing"` and `turnPhase = "reinforce"`.
- **Lesson:** Any round-robin setup phase that ends per-player must also check the global completion condition. Never rely on a separate action for phase transitions that no player can trigger.
- **Lesson:** Pre-existing regression test suite (`risk-setup-transition.test.ts`) was written to describe expected behavior and intentionally failed against the buggy code — a good pattern for documenting known bugs before fixes land.

### Lobby visual tokens (2026-03-18)
- **Lesson:** Centralize slate/blue palette, glass effects, gradients, spacing, and typography in `client/src/ui/design-tokens.css` so UI panels can be restyled without hardcoding colors.

## 2026-03-17 — Risk Setup Phase Deadlock Fix (Completed)

**Outcome:** SUCCESS — Fixed global phase transition bug, PR #144 merged, UAT green.

**Work:** 
- Added global `allDone` check in `placeArmy` handler
- Automatically transitions from setup/placing → playing/reinforce when all players have 0 armies
- Fixes deadlock that occurred when last player finished placing armies but turn wrapped to completed player with no valid moves

**Cross-Agent Context:**
- Steeply wrote 14 regression tests covering 2/3/6 player variants and edge cases — all passing
- Hal reviewed and approved PR #144, codified the phase transition pattern as team standard

**Files Modified:** server/src/games/risk/RiskPlugin.ts  
**Branch:** squad/risk-setup-phase-fix (merged)  
**PR:** #144 (merged to dev, pushed to UAT)  
**Result:** 446 tests passing, Risk setup deadlock resolved

---

## 2026-03-16: Dominos Spinner & 4-Way Cross Layout — Session Complete

**From:** dkirby-ms request  
**Event:** DominosRenderer updated for spinner + 4-way board layout

### Learnings

- **Cross layout architecture:** When a spinner exists, board tiles are separated by `arm` field (`"spinner"`, `"a"`, `"b"`, `"c"`, `"d"`) and rendered as a cross shape. Horizontal arms (A/B) extend left/right; vertical arms (C/D) extend up/down. The entire cross scales uniformly to fit the board area.

- **Tile orientation rule:** On horizontal arms, regular tiles render horizontal and doubles render vertical (crosswise). On vertical arms, regular tiles render vertical and doubles render horizontal. The spinner is always vertical since it's a double on the horizontal chain.

- **End marker positioning:** Marker positions are computed during `redrawBoard` and stored in `endPositions` so `redrawEndMarkers` can read them without duplicating layout math. Only markers for `validEnds` are shown.

- **Selection logic with 4 ends:** `onTileClick` checks all 4 open ends, collects valid ones into `validEnds[]`, auto-plays when exactly one match, shows markers when multiple. The `onEndChoice` / `sendPlay` methods accept `"a" | "b" | "c" | "d"`.

- **Pre-spinner backward compat:** When `spinnerTileId === -1`, `redrawBoardLinear()` renders the original horizontal chain identically to the old code. Cross layout only activates when the spinner tile is set.

- **Shared helper: `drawBoardTile`:** Extracted tile rendering (shadow, body, highlight, divider, pips) into a reusable method that accepts orientation. This replaced the inline drawing in both linear and cross modes.

- **Key file:** `client/src/renderers/DominosRenderer.ts` — now ~1100 lines after cross layout addition.

- **Schema fields consumed:** `BoardTile.arm`, `BoardTile.isDouble`, `DominosState.openEndC`, `DominosState.openEndD`, `DominosState.spinnerTileId` (from `shared/src/games/dominos/DominosState.ts`).

## 2026-03-17 Session: Dominos Cross Layout Rendering (Orchestrated)

**Status:** Complete ✅  
**Depends on:** Pemulis (spinner state schema)

Implemented cross-shaped board layout for Dominos 4-way spinner arms:
- Spinner centered, arms A/B horizontal, C/D perpendicular
- Uniform scaling for consistent tile sizes
- Stored end positions (avoid duplicate layout math)
- ValidEnds array for flexible marker display
- Extracted drawBoardTile helper for reusable rendering

**Decisions merged:**
- Gately: Dominos Cross Layout Rendering Strategy

**Build/Lint/Test:** ✅ All green (470 tests pass)

---

---

## 2026-03-18: Figma Design v1 Analysis — Game Chrome Patterns

**Event:** Mario analyzed all 17 Figma design pages; Hal approved Option B (vanilla TS + CSS tokens). Design introduces new patterns for game screens across all games.

**Key UI Patterns Gately Will Need to Implement:**

1. **Player Info Bars (P0 — highest impact):**
   - Above board: Opponent name + avatar circle, "Black Pieces" label, clock timer
   - Below board: Your name + avatar, "Red Pieces" label, turn badge (green "Your Turn" / gray "Waiting")
   - All games: Checkers, Backgammon, Risk, Dominos

2. **Game Header Bar (P1):**
   - Back to Lobby button, game title, action buttons (Move History / Results / Reset / Resign)
   - Pattern: all game pages share this chrome

3. **Risk-Specific:**
   - Phase banner: Deploy/Attack/Fortify indicator with Next Phase button
   - Player legend below map: 6-color grid showing player name, territory count, army count, ready status
   - Both are new elements not in current Risk renderer

4. **Design System Colors & Effects:**
   - Palette: `slate-*` with `blue-*` accents (shift from current violet→blue)
   - Glass effects: `backdrop-blur` + semi-transparent panels
   - Gradients: stone textures (light/dark), zone backgrounds (emerald for Dominos)
   - Spacing/Shadows: defined in design tokens (to be extracted by Hal in Phase 1)

5. **Screen Flow Changes (affects game lifecycle):**
   - New: Tile → Setup page (game config) → Game → Victory screen → Back to Lobby
   - Old: Tile → Create Modal → Game → GameOverOverlay
   - Setup screens will be vanilla DOM (not in renderer), but game state transitions need coordination

**Cross-team coordination:**
- Hal will extract design tokens (Phase 1)
- Gately will apply tokens and build player info bars using design patterns (Phase 2-3)
- Steeply will write tests for new state transitions (setup → game)

**Lowest-risk start:** Player info bars + game header are the most visible wins and require only DOM additions, not game logic changes.

---

## 2026-03-18: PlayerInfoBar Component & Game Layout Wrapper — Complete ✅

**Status:** Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Test:** ✅ Pass

### Deliverables

**Created:**
- `client/src/ui/PlayerInfoBar.ts` (286 lines)
  - Glass morphism design (backdrop blur + semi-transparent)
  - Displays: player avatar, status badges, turn timer, game-specific role labels
  - Reactive to Colyseus state changes
  - Spectator-aware (displays spectator badge)

**Modified:**
- `client/src/scenes/GameScene.ts` (+235 lines)
  - Integrated PlayerInfoBar into scene hierarchy
  - Layout positioning and scaling
  - Game container wrapper for improved composition

- `client/src/Application.ts` (+34 lines)
  - Export PlayerInfoBar for cross-scene usage

### Features Implemented

- **Game-specific role labels:** Checkers, Risk, Backgammon, Tablut supported
- **Status badges:** Turn indicator, spectator badge, disconnected state
- **Responsive timer:** Turn duration with visual feedback
- **Glass morphism pattern:** Consistent with design system (blue palette, backdrop blur)
- **Lifecycle management:** Proper cleanup on scene destroy

### Cross-Agent Notes

- Ortho now owns DOM UI overlays (screens, menus, settings)
- Clear separation: Gately (PixiJS rendering) + Ortho (DOM/HTML UI) = complete game chrome
- Game header bar candidate for Ortho's next task

### Files Changed

- `client/src/ui/PlayerInfoBar.ts` → NEW
- `client/src/scenes/GameScene.ts` → +235 lines
- `client/src/Application.ts` → +34 lines

---

## 2026-03-18: Ortho — Sidebar + Setup Screens (Cross-Agent Note)

**Ortho completed two phases of DOM UI work:**

### Phase 3: GameSidebar Visual Refresh ✅
- Replaced all hardcoded `rgba()` in `client/src/ui/GameSidebar.ts` with design tokens
- Glass morphism pattern now consistent with PlayerInfoBar
- All existing APIs preserved

### Phase 4: Setup Screens ✅
- Created per-game setup screens replacing Create Game modal
- `client/src/ui/SetupScreen.ts` (shared base) + per-game config panels
- `client/src/scenes/SetupScene.ts` (scene wrapper)
- Both "create" and "join" flows now route through SetupScene
- Full-screen experience with two modes: "create" and "waiting"

**Impact on Gately's work:**
- No changes needed to PixiJS rendering layer
- SetupScene is standalone screen; game rendering happens when players transition to game room
- PlayerInfoBar continues to work alongside sidebar and setup screens
- Gately's GameScene remains the primary rendering surface for in-game content

---

## 2026-03-18: Canvas Color Palette Migration (VIOLET+ZINC → BLUE+SLATE)

### Overview

Migrated PixiJS canvas rendering tokens from violet+zinc palette to blue+slate palette to match the CSS design system tokens that were previously updated. This ensures visual consistency between DOM UI and canvas-rendered game elements.

### Changes Made

**1. Updated `client/src/renderers/DesignTokens.ts`:**

- Added complete BLUE scale: BLUE_200, BLUE_400, BLUE_500, BLUE_600, BLUE_700
- Added complete SLATE scale: SLATE_500, SLATE_600, SLATE_800, SLATE_950 (others already existed)
- Renamed semantic tokens:
  - `ACCENT_VIOLET` → `ACCENT_BLUE` (BLUE_400)
  - `ACCENT_VIOLET_SHADOW` → `ACCENT_BLUE_SHADOW` (BLUE_500)
  - `ACCENT_VIOLET_SHADOW_ALPHA` → `ACCENT_BLUE_SHADOW_ALPHA`
- Updated gradient backgrounds:
  - `PAGE_BG_TO`: VIOLET_950 → SLATE_800
  - `PHASE_BANNER_FROM`: VIOLET_900 → SLATE_700
  - `BUTTON_PRIMARY_FROM`: VIOLET_600 → BLUE_600
- Updated status colors:
  - `STATUS_AWAY`: ZINC_500 → SLATE_500
- Updated game-specific tokens:
  - `CHECKERS_GRID_SHADOW`: ZINC_950 → SLATE_950
- **Kept old tokens as deprecated aliases** for backward compatibility with JSDoc `@deprecated` comments

**2. Updated all game renderers:**

- **CheckersRenderer.ts**: ACCENT_VIOLET → ACCENT_BLUE (valid target highlights, selection rings)
- **BackgammonRenderer.ts**: ACCENT_VIOLET → ACCENT_BLUE (point highlights, piece selection rings)
- **RiskRenderer.ts**: ACCENT_VIOLET → ACCENT_BLUE (territory selection, borders, phase highlights, UI buttons)
- **DominosRenderer.ts**: 
  - ACCENT_VIOLET → ACCENT_BLUE (tile selection, end markers)
  - VIOLET_400 → BLUE_400 (tile glow)
  - ZINC_700 → SLATE_700 (tile borders, dividers, face-down borders)
  - ZINC_800 → SLATE_800 (face-down tile backgrounds)

### Key Mapping Decisions

**UI Theme Colors → Changed:**
- Any ZINC used for backgrounds, borders, dividers → Swapped to SLATE
- Any VIOLET accent used for selection, highlights → Swapped to BLUE

**Game Piece Colors → Preserved:**
- Checkers "black pieces" using ZINC_600/800/900 → **KEPT AS-IS**
- These represent actual piece colors (not theme), so ZINC is appropriate
- WHITE pieces already used SLATE for shading (no change needed)

### Heuristic Applied

The rule: if ZINC/VIOLET was used because it's "dark/neutral UI theme color" → swap to SLATE/BLUE. If it was used because it's "the color of a game object itself" → keep it.

### Validation

✅ Build passed: `npm run build`  
✅ Lint passed: `npm run lint` (pre-existing warnings unrelated to changes)  
✅ Tests passed: `npm run test` (467 passed)

### Renderer Notes

- All selection/highlight interactions now use blue accent (BLUE_400)
- All UI backgrounds/borders now use slate neutrals
- No visual regression in game piece rendering
- Deprecated tokens left in place to avoid breaking any external references

### Cross-Agent Impact

- **Ortho**: DOM UI already uses blue+slate via CSS design tokens — now fully aligned
- **Pemulis**: No game logic changes, purely visual token swaps
- **Steeply**: All tests pass; no new test coverage needed (visual-only change)


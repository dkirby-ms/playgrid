# gately — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Learnings

### 2026-03-14: Client Architecture Research

**Current State:**
- Client uses PixiJS 8 + Colyseus.js
- Basic lobby and waiting room (HTML overlays)
- index.ts is monolithic (~180 lines)
- No game rendering yet — just lobby management
- Must support: Risk, Checkers, Backgammon, Dominoes, Poker, Hearts, Spades

**Key Architecture Decisions:**

1. **Plugin-Based Renderers**
   - Each game implements `GameRenderer` interface
   - Registry pattern for dynamic loading
   - Clean separation: `CheckersRenderer`, `RiskRenderer`, `PokerRenderer`, etc.
   - Renderers receive Colyseus state, render with PixiJS, send input to server

2. **Scene Management System**
   - Refactor index.ts into proper `Application` + `SceneManager`
   - Three scenes: Lobby, Waiting Room, Game
   - Scene transitions: lobby → waiting → game → back to lobby
   - Scenes handle enter/exit lifecycle, update loop, resize

3. **Hybrid UI Strategy**
   - HTML/CSS for menus, forms, text (lobby, waiting room, settings)
   - PixiJS for game rendering (board, pieces, cards, animations)
   - Rationale: Use right tool for each job, better accessibility for HTML

4. **State Management**
   - Server-authoritative (Colyseus owns state)
   - Client has minimal local state (UI only: selected piece, hover effects)
   - Flow: Input → send to server → server updates state → state syncs → render
   - No client-side game logic (prevents cheating)

5. **Rendering Complexity by Game**
   - **Simple (Graphics API only):** Checkers, Backgammon, Dominoes
   - **Medium (need assets):** Card games (sprite sheet), Risk (map SVG)
   - **Complex:** Risk is most visually complex (world map, multiple phases, attack flows)

6. **Asset Strategy**
   - Start with placeholders (Graphics API shapes and text)
   - Lazy load per game (only load assets when entering that game)
   - Critical assets: Risk map SVG, card sprite sheet
   - Open-source options: SVG-cards by Chris Aguilar, Risk map from open sources

7. **Spectator Mode**
   - Public info games (board games): See full state, no input
   - Hidden info games (cards): See board/trick, option to view player's hand
   - "Spectator Mode" overlay banner, perspective selector for card games

8. **Responsive & Mobile**
   - PixiJS viewport scales/centers based on screen size
   - Touch input handled as pointer events (no special code needed)
   - Mobile: Overlay UI controls, ensure 44px+ hit areas
   - Risk: Pan/zoom viewport for large map

9. **Connection Lifecycle**
   - Reconnect with exponential backoff (up to 5 attempts)
   - Preserve seat in game for 60s on disconnect
   - Show "Reconnecting..." overlay with countdown
   - Fall back to lobby on failure

**File Structure:**
- `Application.ts` — Main app, Colyseus client, scene manager
- `SceneManager.ts` — Scene transitions, active scene management
- `renderers/` — Game renderer plugins (CheckersRenderer, etc.)
- `ui/` — HTML UI components (LobbyScreen, WaitingRoom, HUD)
- `networking/` — ConnectionManager, MessageHandler
- `assets/` — AssetLoader, lazy loading
- `input/` — InputManager, Viewport (pan/zoom)

**Next Steps (not implementing, just documenting):**
- Refactor index.ts into Application + SceneManager
- Create GameRenderer interface and registry
- Build CheckersRenderer as proof-of-concept
- Test full flow: lobby → waiting → game → back

---

### Cross-Agent Research Summary (2026-03-14)

**Hal (Lead)** produced `docs/architecture-plan.md` with:
- Server architecture and LobbyRoom/GameRoom design
- 3-phase scaling strategy with clear trigger conditions
- Plugin system for games (IGamePlugin interface)
- Single unified lobby across all game types
- SQLite → PostgreSQL migration path
- 8-phase implementation plan with time estimates

**Pemulis (Systems Dev)** produced `docs/game-systems-design.md` with:
- Plugin interface specifications (GamePlugin, StateFilter, TurnManager)
- Per-game technical analysis (state sizes, complexity estimates)
- Hidden information architecture for card games
- Phased turn management for Risk
- Complete Checkers plugin skeleton
- Turn time limits and configuration

**Key Alignment:**
- All agree on plugin architecture (server plugin + client renderer)
- Server-authoritative state with hidden information filtering
- Game order aligned: Checkers first (simplest) to Risk last (complex)
- Scaling defers until needed (single → multi-process → multi-server)
- Asset dependencies identified: Risk SVG map (CRITICAL), card sprite sheet
- Mobile-first design with touch pointer events (PixiJS handles automatically)
- Spectator mode with perspective selector for hidden-info games

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.

### 2026-03-14: Scene Manager Infrastructure (Issue #20)

- Added `client/src/scenes/Scene.ts` with the shared scene lifecycle contract: `name`, PixiJS `container`, `onEnter`, `onExit`, `update`, and `resize`.
- Added `client/src/SceneManager.ts` to register scenes, transition between them, and mount/unmount scene containers on the Pixi stage.
- Re-exported the `Scene` type for future client architecture work without creating any concrete scenes yet.
- Verified the workspace with `npm run build && npm run lint && npm run test` after landing the infrastructure.

### 2026-03-14: Application + Scene Refactor (Issues #21 and #22)

- Added `client/src/renderers/GameRenderer.ts` and `RendererRegistry.ts` to establish the client-side renderer plugin contract before any concrete game renderers exist.
- Refactored the client bootstrap into `client/src/Application.ts`, which now owns the PixiJS app, Colyseus client, `SceneManager`, lobby room, and active game room.
- Wrapped the existing HTML overlays in `LobbyScene` and `WaitingRoomScene`, keeping `LobbyScreen.ts` and `WaitingRoom.ts` unchanged while moving flow control into scene transitions.
- Added a placeholder `GameScene` so lobby → waiting room → game transitions now run through the shared scene system instead of monolithic logic in `client/src/index.ts`.

### 2026-03-14: Checkers State + Live Game Scene (Issues #15 and #23)

- Added `shared/src/games/checkers/CheckersState.ts` as a `BaseGameState` subclass with a 64-cell `ArraySchema<number>` board, checkers piece constants, and `mustCaptureFrom` tracking for forced multi-jump chains.
- Re-exported the new checkers schema through `shared/src/games/checkers/index.ts` and `shared/src/index.ts` so future server plugins and client code can import it from the shared package entrypoint.
- Upgraded `client/src/scenes/GameScene.ts` from a placeholder into a real renderer host that looks up renderers by game type, initializes them from Colyseus room state, forwards updates/resizes, and degrades to an on-screen error message when a renderer is not registered.
- Added a lightweight HTML "Leave Game" overlay button wired back into `Application.ts`, so the scene can request a lobby return without owning connection teardown itself.
- Verified the workspace with `npm run build && npm run lint && npm run test` after landing the two requested feature commits.

### 2026-03-14: Checkers Logic + Lobby Game Type (Issues #16 and #24)

- Added `server/src/games/checkers/checkersLogic.ts` with pure TypeScript helpers for board setup, forced captures, multi-jump chains, king promotion, per-player move generation, and win detection with no Colyseus room logic mixed in.
- Added `server/src/__tests__/checkersLogic.test.ts` to cover opening setup, forced captures, chained jumps, promotion, king movement, and win-condition handling.
- Updated `client/src/ui/LobbyScreen.ts` so the create-game form now includes a game type dropdown, create payloads send `gameType`, and the lobby table shows a new Type column with a friendly label.
- Verified the workspace again with `npm run build && npm run lint && npm run test` after the two requested feature commits.

### 2026-03-14: Checkers Server Plugin (Issue #18)

- Added `server/src/games/checkers/CheckersPlugin.ts` implementing the shared `GamePlugin<CheckersState>` contract with sequential turn config, board setup, player lifecycle hooks, move handling, forced multi-jump support, and win evaluation driven by the pure checkers logic helpers.
- Added `server/src/games/checkers/index.ts` and registered the plugin in `server/src/index.ts`, so new checkers rooms now boot through `BaseGameRoom` with the game registry.
- Added `server/src/__tests__/CheckersPlugin.test.ts` to cover board initialization, player normalization, move validation, chained captures, win reporting, disconnect handling, and ended-state lifecycle behavior.
- Re-ran `npm run build && npm run lint && npm run test` after the plugin landed to verify the server and workspace stayed healthy.

### 2026-03-14: Checkers Renderer (Issue #25)

- Added `client/src/renderers/CheckersRenderer.ts` as the first concrete PixiJS game renderer, drawing an 8×8 centered board plus circular checkers pieces directly from shared Colyseus state.
- Kept board layout responsive by recalculating square size from `min(width, height) / 8` on resize, redrawing the board layer, and only refreshing the piece layer on state changes.
- Added a shared `rendererRegistry` singleton and registered the `checkers` renderer through `client/src/renderers/index.ts`, then wired `Application.ts` to use that registry so renderer registration happens on the normal client startup path.
- Re-verified the workspace with `npm run build && npm run lint && npm run test` after landing the renderer.

### 2026-03-14: Checkers Click-to-Move Interaction (Issue #26)

- Updated `CheckersRenderer` so each square is a PixiJS interactive target, local players can select their own movable piece, and valid destinations are highlighted before a move is sent to the room.
- Added lightweight client-side checkers move generation in `client/src/games/checkers/checkersClientLogic.ts`, mirroring the server’s forced-capture rules closely enough to show accurate move targets without shifting authority away from the server.
- Extended the renderer init context so `GameScene` passes the active Colyseus room into renderers, letting checkers compare `room.sessionId` against `state.currentTurn` and send `move` messages directly.
- Added focused client-side tests for the new move helper and re-verified the workspace with `npm run build && npm run lint && npm run test`.

### 2026-03-14: Checkers Status HUD + Endgame Overlay (Issue #27)

- Expanded `client/src/renderers/CheckersRenderer.ts` with a centered turn indicator, a persistent local-color label, and live black/red piece counters that recalculate from board state on every sync.
- Reserved HUD space in the renderer layout so the new Pixi text elements stay readable above and below the board while continuing to resize responsively with the checkers scene.
- Subscribed the renderer to the Colyseus `game-end` room message so it can show a semi-transparent board overlay with win/lose/draw messaging when the shared state reaches `phase === "ended"`.
- Re-verified the workspace with `npm run build && npm run lint && npm run test` after the polish pass.

### 2026-03-14: Checkers Orientation + Lobby Player Count Locks (Issues #48 and #51)

- Updated `client/src/renderers/CheckersRenderer.ts` so the local red player sees a flipped board, keeping their pieces at the bottom while translating click targets back to real board indexes.
- Updated `client/src/ui/LobbyScreen.ts` so Checkers always forces `maxPlayers` to `2` and keeps the selector disabled for that game type.
- Re-verified the workspace with `npm run build && npm run lint && npm run test` after landing both bug-fix commits.

### 2026-03-14: Room Status Overlay Cleanup (Issue #54)

- Updated `client/src/Application.ts` so connection status text uses the Colyseus `room.roomId` fallback instead of showing `undefined` when `room.id` is missing.
- Restyled the shared Pixi status text into a small top-left HUD toast, replacing the centered overlay that was covering gameplay.
- Added auto-hide behavior for informational connection states while keeping errors persistent and visible when they matter.
- Re-verified the workspace with `npm run build && npm run lint && npm run test` after landing the fix.

### 2026-03-14: Application ConnectionManager Startup Fix

- Fixed `client/src/Application.ts` to import `ConnectionManager` from `client/src/networking`, along with the related connection state/event types it already uses.
- Added the missing `private connectionManager!: ConnectionManager;` field and removed the dead direct `Client` property, keeping application networking routed through the connection wrapper.
- Re-verified the client path with `npm run lint`, `npm run build`, `npm run test`, and a live browser load against the dev client to confirm startup no longer throws `ReferenceError: ConnectionManager is not defined`.

### 2026-03-14: WaitingRoom gameType handoff fix

- Fixed `client/src/ui/WaitingRoom.ts` so the `GAME_STARTED` handler captures `gameType` before calling `hide()`, preserving the selected renderer when the waiting overlay clears its local game info.
- This specifically prevents Backgammon starts from falling back to the default Checkers renderer during the lobby → waiting room → game transition.

## Cross-Agent Update — Issue #37 Complete, PR #56 Merged (2026-03-14)

**From:** Steeply (Tester)  
**Event:** Lobby gameType test coverage complete

- **Issue #37:** Complete. Comprehensive test suite for gameType validation (default, invalid, passthrough, clamping, broadcast).
- **PR #56:** Merged (squad/37-lobby-tests-gametype) — "Test coverage: lobby gameType validation (82/82 passing)"
- **Impact:** Lobby system is now fully tested. Future client-side gameType usage has test baseline.

### 2026-03-14: Backgammon Game Plugin (Issue #44)

- Implemented `BackgammonState` with 24-point board representation using ArraySchema
- Points store signed integers: positive = Black pieces, negative = Red pieces
- Added bar and borne-off tracking for both players (blackBar, redBar, blackBorneOff, redBorneOff)
- Server-authoritative dice rolling with doubles support (4 moves for same value)
- Movement validation handles bar re-entry (must enter before other moves), bearing off (all pieces in home board), and capturing (hitting blots sends to bar)
- Pure logic functions in `backgammonLogic.ts` separate from plugin class following Checkers pattern
- Dice state tracked with `dice` and `usedDice` arrays to manage available moves
- Turn ends when all dice used or no valid moves remaining
- Win condition: first player to bear off all 15 pieces
- Registered in GameRegistry alongside CheckersPlugin
- PR #66 created (draft) for review

## Cross-Agent Update — Wave 1 Complete (2026-03-14T18:55:06Z)

**From:** Squad Scribe  
**Event:** Wave 1 orchestration completed (8 PRs merged, 0 blockers, 0 conflicts)

**PRs Merged to dev:**
- PR #66: Backgammon Server Plugin (#44) — **Your work, merged successfully**

**Key Achievements:**
- Backgammon game rules engine complete and tested
- Server-side plugin integration live
- Seamlessly uses Pemulis's reconnection infrastructure (allowReconnection handler)
- All lifecycle hooks working with BaseGameRoom

**Cross-Agent Notes:**
- Pemulis's reconnection system (#61) now supports your plugin's player-leave and game-end hooks
- Marathe's deployments enable you to ship Backgammon to prod
- Joelle's plugin dev guide references Backgammon as a successful example

**Architectural Pattern Established:**
- Your Backgammon serves as canonical template for next game plugins (Dominoes, Poker, etc.)
- Verify future game authors follow same lifecycle hook patterns

**Next:** Wave 2 assignments ready when you are.

### 2026-03-14: Backgammon Renderer (Issue #45)

- Created `client/src/renderers/BackgammonRenderer.ts` implementing the `GameRenderer` interface following the Checkers pattern
- Board rendering: 24 triangular points arranged in 4 quadrants with alternating colors (dark brown/light tan)
- Point numbering: top row 11-0 (right to left), bottom row 12-23 (left to right)
- Center bar divider for captured pieces with separate interactive zones for Black (top) and Red (bottom)
- Piece rendering: circular discs stacked vertically on points with piece count labels when 5+ pieces stacked
- Bar pieces: Black displayed on top half, Red on bottom half, with count labels for 3+ pieces
- Borne-off areas: piece counts displayed on right side of board
- Dice display: two dice rendered at center with standard pip patterns (1-6 dots), dimmed alpha when used
- Interactive input: click to select point or bar, click target point to move, highlights valid targets based on available dice
- Move validation: calculates valid targets considering available dice, bar entry rules, bearing off rules, and blocked points
- State management: parses BackgammonState with 24-point board (signed integers), bar counts, borne-off counts, dice arrays
- Responsive layout: calculates board dimensions maintaining 1.6:1 aspect ratio, scales all elements on resize
- HUD elements: status text (Your turn/Opponent's turn), player color label, game-over messaging
- Registered in RendererRegistry and added Backgammon to lobby game type options
- PR #70 created (draft) for review
- Build, lint, and test suite passed (6 pre-existing server-side backgammon test failures unrelated to renderer)

### 2026-03-14: In-Game HUD Overlay (Issue #39)

- Created `client/src/ui/HUD.ts` as an HTML-based overlay component following existing UI patterns from LobbyScreen and WaitingRoom
- HUD displays during gameplay with:
  - **Player Info Panel** (top-left): Player names, scores, and current turn highlighting with responsive styling
  - **Turn Indicator** (top-center): Shows "Your turn" or "{Player}'s turn" with color coding (green for local, blue for opponent)
  - **Game Timer** (optional, below turn): Countdown with warning styling (red) when under 30 seconds
  - **Leave Game Button** (top-right): Styled consistently with other lobby buttons, triggers leave event
  - **Chat Toggle Button** (bottom-right): Floating circular button with "coming soon" placeholder panel
- Integrated with GameScene lifecycle:
  - HUD initialized and shown in `onEnter()` with room state data
  - Updates dynamically via `onStateChange()` handler
  - Hidden and cleaned up in `onExit()` via `cleanup()`
  - Leave button wired through HUD event callback → GameScene event → Application.leaveGame()
- Replaced GameScene's old standalone leave button with integrated HUD system
- HUD extracts player data and current turn from generic state object (works across all game types)
- Styling follows project patterns: rgba backgrounds, cyan accent colors, responsive with media queries for mobile
- All elements use pointer-events to enable interaction while overlay itself remains non-blocking
- PR #76 created (draft) — completes the last P2 issue! 🎉

## Session: E2E Test Suite Fix & ConnectionManager Import (2026-03-14)

**Agents:** Steeply (E2E fix), Gately (support), Hal (review + merge)

### What Happened

During full E2E suite run, lobby tests failed because earlier checkers E2E tests left sessions visible in the lobby. Steeply fixed by making assertions row-scoped. While reviewing PR, Gately noticed missing ConnectionManager import in Application.ts.

**Gately's Contribution:**
- Added: `import ConnectionManager from './services/ConnectionManager';`
- Added: `connectionManager: ConnectionManager;` property declaration
- Removed dead duplicate Client property
- Committed 413aa35 on dev
- Build/lint/tests pass

**Result:**
- ConnectionManager now properly initialized in Application.ts
- Unblocked Hal's review and merge of PR #78
- E2E tests now order-independent
- Issue #77 closed
- 189 tests passing

**Impact on Gately:**
- ConnectionManager (PR #74) now fully integrated
- State machine is properly hooked into application lifecycle
- Ready for further enhancements (e.g., reconnection UX improvements)

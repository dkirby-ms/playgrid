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


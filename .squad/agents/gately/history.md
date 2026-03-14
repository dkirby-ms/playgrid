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


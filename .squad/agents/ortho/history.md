# Ortho — History

## Project Context

- **Project:** Playgrid — multiplayer board game platform
- **Stack:** TypeScript monorepo, Colyseus server, PixiJS client, shared types
- **Owner:** Dale Kirby (dkirby-ms)
- **Games:** Checkers, Backgammon, Risk, Dominos
- **My focus:** DOM UI layer — lobby, sidebar, setup screens, victory screens, player info bars

## Core Context

- Client uses PixiJS for game canvas + vanilla TypeScript DOM for overlays
- Design tokens extracted from Figma v1 in `client/src/ui/design-tokens.css` (slate/blue palette)
- Decision: No React adoption — stay vanilla TS for DOM layer
- Decision: Keep Activity Feed in lobby, use Setup pages instead of Create Game Modal
- Lobby reskinned with new design tokens (Phase 1+2 complete)
- P0 gap: Player info bars (opponent above, player below canvas) — missing from all 4 games
- SceneManager handles screen transitions
- `client/src/ui/LobbyScreen.ts` — lobby overlay
- `client/src/ui/GameSidebar.ts` — game sidebar
- `client/src/ui/HUD.ts` — game HUD
- Build: `npm run build` (shared → server → client)
- Lint: `npm run lint`
- Test: `npm test -- --run`

## Learnings

- **GameSidebar visual refresh (Phase 3):** Replaced all hardcoded `rgba()` values in `GameSidebar.ts` with design tokens from `design-tokens.css`. Key mappings: `rgba(255,255,255,0.08)` → `var(--border-light)`, `rgba(255,255,255,0.04)` → `var(--bg-card-dark)`, `rgba(126,207,255,*)` → `var(--accent-*)`, button gradients → `var(--gradient-button-primary/danger)`, note cards → `var(--notice-info-*)`. Added `font-family: var(--font-family)` to sidebar container, increased panel gap to `--space-lg` (1.5rem) to match Figma `space-y-6`, and added tablet breakpoint (768–1024px) for narrower sidebar. Panel headings bumped to `font-weight: 600` matching design. All existing DOM structure and `setPanelMarkup()` API preserved.
- **Pattern:** PlayerInfoBar and GameSidebar now both follow the same glass morphism token pattern: `var(--glass-bg)` background via `.glass-panel`, `var(--shadow-card)` shadows, `var(--border-light)` borders, `var(--bg-card-dark)` for inner cards.
- **Figma reference files:** `docs/designs/playgrid-v1/src/app/pages/{Game}Game.tsx` — sidebar uses `rounded-xl bg-slate-800/50 p-4 backdrop-blur-sm` panels, `space-y-6` gap, `text-lg text-white` headers, `text-sm text-slate-400` labels.
- **Setup Screens (Phase 4):** Built per-game setup screens replacing the inline Create Game modal. Architecture: `SetupScreen.ts` (shared base with glass-morphism two-column layout) + per-game config panels in `client/src/ui/setup/{Game}SetupConfig.ts` + `SetupScene.ts` (scene wrapper). Config panels use shared `configControls.ts` factories (option groups, toggles, steppers). Two modes: "create" (host configures before creating) and "waiting" (post-create player list + ready/start). The SetupScreen binds to the lobby room directly for `GAME_JOINED`, `GAME_PLAYERS`, `GAME_STARTED` messages. Both new game creation (tile click → setup) and joining existing games (Join btn → "waiting" mode) route through SetupScene. The old WaitingRoom.ts and WaitingRoomScene.ts are preserved for backward compatibility with e2e tests. LobbyEvent union type extended with `{ type: "setup"; gameType: string }`.
- **Key file paths for setup screens:** `client/src/ui/SetupScreen.ts`, `client/src/ui/setup/configControls.ts`, `client/src/ui/setup/{Checkers,Backgammon,Risk,Dominos}SetupConfig.ts`, `client/src/scenes/SetupScene.ts`. Overlay div `#setup-overlay` added to `client/index.html`.
- **Style injection pattern:** SetupScreen follows the same `injectStyles()` pattern as PlayerInfoBar — creates a `<style>` element with a unique ID, injects into `document.head`, uses CSS classes with design tokens exclusively.

---

## 2026-03-18: GameSidebar Refresh (Phase 3) + Setup Screens (Phase 4) — Complete ✅

**Status:** Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Test:** ✅ Pass (467 tests)

### Phase 3: GameSidebar Visual Refresh

**Modified:**
- `client/src/ui/GameSidebar.ts` — Full visual refresh with design tokens

**Deliverables:**
- All hardcoded `rgba()` replaced with CSS custom properties
- Glass morphism consistency: `--glass-bg`, `--shadow-card`, `--border-light`, `--bg-card-dark`
- Button tokens: `--gradient-button-primary`, `--gradient-button-danger`
- Note cards: `--notice-info-bg`, `--notice-info-border`, `--notice-info-text`
- Typography: `font-family: var(--font-family)`, panel headings `font-weight: 600`
- Spacing: Panel gap `--space-lg` (1.5rem) matching Figma
- Responsive: Tablet breakpoint 768–1024px
- All APIs and DOM structure preserved — purely visual refresh

### Phase 4: Setup Screens

**Created (8 new files, ~1,876 lines):**
- `client/src/ui/SetupScreen.ts` (base class)
  - Two-column layout: players (left), config (right)
  - Glass morphism design matching sidebar/PlayerInfoBar
  - Two modes: "create" and "waiting"
  - Direct binding to lobby room messages

- `client/src/scenes/SetupScene.ts` (scene wrapper)
  - Registered in SceneManager

- Per-game config panels:
  - `client/src/ui/setup/CheckersSetupConfig.ts`
  - `client/src/ui/setup/BackgammonSetupConfig.ts`
  - `client/src/ui/setup/RiskSetupConfig.ts`
  - `client/src/ui/setup/DominosSetupConfig.ts`

- `client/src/ui/setup/configControls.ts`
  - Shared factories: `createOptionGroup()`, `createToggleRow()`, `createStepper()`
  - Reusable across all config panels

- `client/src/ui/setup/index.ts` (barrel export)

**Modified:**
- `client/src/Application.ts` — Route "create" and "join" through SetupScene
- `client/src/ui/LobbyScreen.ts` — Game tiles navigate to setup
- `client/index.html` — Added `#setup-overlay` container

**Key decisions:**
- Full-screen setup experience (not modal)
- Game-specific config panels
- Server unchanged: Uses existing CREATE_GAME, GAME_JOINED, GAME_PLAYERS, GAME_STARTED messages
- WaitingRoom preserved for e2e backward compatibility
- LobbyEvent extended with `{ type: "setup"; gameType: string }`

### Cross-Agent Impact

**Gately (PixiJS Rendering):**
- No changes needed
- SetupScene is standalone screen; game rendering happens when players transition to game room
- Sidebar and SetupScreen complement Gately's game rendering layer

**Server Team:**
- No changes needed
- Setup screens use existing lobby room message protocol

**E2E Tests:**
- May need navigation updates (WaitingRoom preserved for backward compat)

### Patterns Established

1. **Glass Morphism Standard:** Sidebar, PlayerInfoBar, and SetupScreen all follow consistent token-based pattern
2. **Setup Screen Template:** Reusable for future overlay screens (settings, pause menu, victory screen, spectator controls)
3. **Config Panel Architecture:** Per-game implementations + shared control factories establish scalable pattern
4. **Design Token Discipline:** All visual styling references CSS custom properties from `design-tokens.css`

---

## 2026-07-22: Console Log Panel (#146) — Complete ✅

**Status:** Complete — PR #152
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Test:** ✅ Pass (467 tests)

### What was built

**Created:**
- `client/src/ui/ConsoleLog.ts` — Collapsible inline console log panel with timestamped, color-coded entries (info/success/warning/error). Glass morphism styling, ARIA accessibility, auto-scroll with manual scroll detection, unread badge.

**Modified:**
- `client/src/Application.ts` — ConsoleLog instantiation; all `setStatus()` calls, reconnection events, game-end results, and connection errors now route to console log
- `client/src/ui/LobbyScreen.ts` — `setConsoleLog()` setter; notices, connection errors, and lobby log events forwarded to console
- `client/src/scenes/LobbyScene.ts` — `setConsoleLog()` pass-through
- `client/index.html` — ReconnectOverlay restyled from full-screen modal to compact top-right toast; added `#console-log-container`

**NOT changed:** VictoryScreen.ts, SetupScreen.ts, GameOverOverlay.ts, server code

### Learnings

- **ConsoleLog pattern:** Follows same `injectStyles()` pattern as PlayerInfoBar/SetupScreen. Uses `#console-log-container` in index.html. Exposes `log()`, `info()`, `success()`, `warn()`, `error()` methods. Pass instance via `setConsoleLog()` to components that need it.
- **ReconnectOverlay reduced:** Changed from full-screen centered modal to compact top-right toast indicator using design tokens. Still functional for reconnection states, but no longer blocks gameplay.
- **Status message routing:** `setStatus()` in Application.ts now dual-writes to both PixiJS statusText and ConsoleLog. This means all status messages are persisted in scrollable history.
- **Dominos thumbnail fix:** `dominos.jpg` was missing from `client/public/game-thumbnails/`. Created `dominos.svg` (1200×900 SVG with domino tiles on dark background) and updated `GAME_TILE_ARTWORK` path in `LobbyScreen.ts` from `.jpg` to `.svg`. Added `onerror` fallback on game tile `<img>` elements to gracefully degrade to checkers thumbnail if any image fails to load.
- **Game thumbnail assets:** Located at `client/public/game-thumbnails/`. Checkers, backgammon, risk use JPEG (1200×900). Dominos uses SVG. Path mapping in `GAME_TILE_ARTWORK` constant in `LobbyScreen.ts` (line ~153).

---

## 2026-03-18: Dominos Lobby Thumbnail Fix — Complete ✅

**Status:** Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Requested by:** dkirby-ms

### What was fixed

**Problem:** Dominos game tile in lobby displayed broken image (thumbnail missing).

**Solution:**
- Created `dominos.svg` thumbnail at `client/public/game-thumbnails/dominos.svg`
- Updated `GAME_TILE_ARTWORK` constant in game configuration to reference `.svg` instead of `.jpg`
- Added `onerror` fallback handler on all game tile `<img>` elements to gracefully degrade to fallback image

**Files Modified:**
- `client/public/game-thumbnails/dominos.svg` (created)
- Game tile image component (added onerror fallback)

### Learnings

- **Thumbnail asset pattern:** Game tiles stored in `client/public/game-thumbnails/`. File extension must match `GAME_TILE_ARTWORK` path in config.
- **Defensive image loading:** Always add `onerror` fallback on `<img>` elements in game lists to prevent cascading UX breakage if a single image fails.

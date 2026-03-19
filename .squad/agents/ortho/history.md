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
- **Player Info Bars (P0):** Verified working across all games. Already had data flow (GameScene → updatePlayerInfoBars), mount points (game-info-top/bottom), and visibility toggle. Added subtle pulse animation to "Your Turn" status badge (2s ease-in-out with box-shadow glow). The bars follow glass-morphism pattern: `var(--glass-bg)`, `var(--shadow-card)`, `var(--border-light)`.
- **Game Header (P1):** Created new `GameHeader.ts` component for game scene chrome. Three-section layout: Back to Lobby (left) + Game Title (center) + Resign (right). Uses `var(--glass-bg-strong)` and `var(--glass-blur)` for header bar. Both actions trigger `leave_game` event (resign logic refinement deferred). Mount point `#game-header` added to game layout ABOVE `#game-info-top`. GameScene manages lifecycle: `initGameHeader()` / `destroyGameHeader()`. HUD's Leave button hidden when GameHeader is active (chat toggle stays visible).
- **Game chrome architecture:** Layout order is now: GameHeader → Opponent Info Bar → Canvas → Player Info Bar. All chrome components use the same glass-morphism token system and lifecycle pattern (init on enter, destroy on exit, visibility toggle via `display: none/flex`).

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

---

## 2026-03-19: Player Info Bars (P0) + Game Header (P1) — Complete ✅

**Status:** Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Test:** ✅ Pass (467 tests)

### P0: Player Info Bars — Verification & Completion

**Audit Results:**
- Player info bars WERE already working correctly
- Data flow: GameScene.ts → `updatePlayerInfoBars()` → PlayerInfoBar.update()
- Mount points created in Application.ts → `createGameLayout()`
- Visibility toggle working via `game-info-slot` CSS `display: none/flex`
- Bars show for all game types (checkers, backgammon, risk, dominos)

**Enhancement:**
- Added pulse animation to "Your Turn" status badge
- Keyframes: 2s ease-in-out infinite with opacity fade + box-shadow glow

**Modified:**
- `client/src/ui/PlayerInfoBar.ts` — Added `@keyframes status-pulse` animation to `.player-info-bar__status--active` class

### P1: Game Header Bar — New Component

**Created:**
- `client/src/ui/GameHeader.ts` (234 lines)
  - Three-section layout: Back to Lobby (left), Game Title (center), Resign (right)
  - Glass-morphism styling: `var(--glass-bg-strong)`, `var(--glass-blur)`, `var(--border-light)`
  - Event system: `onEvent()` callback for `back_to_lobby` | `resign`
  - Style injection pattern matching PlayerInfoBar
  - Responsive: Mobile stacks vertically, desktop horizontal

**Modified:**
- `client/src/Application.ts` — Added `#game-header` mount point to game layout (above `#game-info-top`)
- `client/src/scenes/GameScene.ts` — Integrated GameHeader lifecycle:
  - Import GameHeader and GameHeaderEvent types
  - Added `gameHeader` instance variable
  - `initGameHeader()` creates header, hides HUD Leave button
  - `destroyGameHeader()` removes header, restores HUD Leave button
  - `handleGameHeaderEvent()` routes both actions to `leave_game` event
  - `formatGameTitle()` capitalizes game type for display
  - Both actions (back_to_lobby, resign) trigger existing leave flow

**Architecture:**
- Game layout order: `#game-header` → `#game-info-top` → `#game-canvas-frame` → `#game-info-bottom`
- All chrome components follow same pattern: mount point in Application.ts, lifecycle in GameScene.ts, glass-morphism tokens in component styles
- HUD Leave button hidden when GameHeader active (no duplicate controls)
- Chat toggle remains in HUD (bottom-right floating button)

**Key Decisions:**
- Both Back and Resign trigger leave_game for now (resign can be refined later with proper game state updates)
- History and Results buttons omitted (those screens don't exist yet)
- Header uses stronger glass background (`var(--glass-bg-strong)`) for hierarchy vs info bars

### Cross-Agent Impact

**Gately (PixiJS Rendering):**
- No changes needed
- Game chrome is DOM overlay layer, doesn't affect canvas rendering

**Pemulis (Game Logic):**
- No changes needed
- GameHeader uses existing leave_game event flow
- Resign refinement (server-side game state update) deferred for future work

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
- **Dominos thumbnail fix (v2):** Replaced hand-made `dominos.svg` with proper Unsplash JPEG (`dominos.jpg`) sourced from the Figma design export (`docs/designs/playgrid-v1/src/app/pages/Lobby.tsx`). All four game thumbnails now consistently use `.jpg` format.
- **Game thumbnail assets:** Located at `client/public/game-thumbnails/`. All games (checkers, backgammon, risk, dominos) use JPEG. Path mapping in `GAME_TILE_ARTWORK` constant in `LobbyScreen.ts` (line ~153).
- **Design pipeline discipline:** Always reference `docs/designs/playgrid-v1/` Figma exports before implementing or fixing UI elements. The Figma Lobby.tsx contains Unsplash URLs for all game tile images. Don't hand-make assets when the design already specifies them.

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

---

## 2025-01-16: P3 — Lobby Tile Hover Enhancements — Complete ✅

**Status:** Complete  
**Build:** ✅ Pass | **Lint:** ⚠️ 3 errors in docs/designs (unrelated) | **Test:** ✅ Pass (467 tests)

### Enhancements Made

**Game Tile Hover Effects (Figma Alignment):**
- Updated `--shadow-hover` token: `rgba(59, 130, 246, 0.25)` → `rgba(59, 130, 246, 0.2)` to match Figma's `shadow-blue-500/20`
- Updated `--gradient-tile-overlay` to use pure black gradient (`rgba(0,0,0,*)`) instead of slate-950, matching Figma's `from-black/90 via-black/50 to-transparent`
- Updated game tile transition: `0.2s` → `0.3s` to match Figma spec (300ms)
- Verified existing hover implementation: ✅ `scale(1.05)` + blue shadow, ✅ image `scale(1.1)`, ✅ gradient overlay, ✅ active games count badge

**Sidebar Components Verification:**
- ✅ **Active Games List** — Already fully implemented in `LobbyScreen.ts` (lines 724-816). Shows game cards with name, type, player count, status badges (Waiting/Playing), join buttons for joinable games. Renders in `#active-games-list` container within `.active-games-panel` in sidebar.
- ✅ **Online Players List** — Already fully implemented in `LobbyScreen.ts` (lines 817-850). Shows player avatars with status dots (online/in-game), names, and status text. Renders in `.online-players-panel` with count badge. Updates on `ONLINE_PLAYERS` message from lobby room.
- ✅ **3-Column Layout** — Grid already configured: game library (2 cols) + sidebar (1 col) on desktop, stacks on mobile.

**Files Modified:**
- `client/src/ui/design-tokens.css` — Refined `--shadow-hover` and `--gradient-tile-overlay` tokens
- `client/index.html` — Updated game tile transition timing (0.2s → 0.3s)

**Architecture Notes:**
- Sidebar components kept inline within `LobbyScreen.ts` following existing vanilla TS monolithic pattern
- No separate component files created (`ActiveGamesList.ts`, `OnlinePlayersList.ts`) — would break existing architecture
- All rendering uses `renderActiveGamesList()` and `renderOnlinePlayers()` private methods
- Data flow: Lobby room messages → LobbyScreen state → render methods → sidebar panels

**Key Learnings:**
- Design token adjustments are critical for exact Figma matching — even small opacity differences (0.25 vs 0.2) matter for visual polish
- The lobby sidebar architecture was already complete with glass-morphism panels, proper data wiring, and interactive elements (join buttons, status badges)
- Transition timing consistency across hover effects (300ms standard) creates smoother, more cohesive UX


---

## 2026-07-24: PR #160 Review Fixes — Complete ✅

**Status:** Complete — PR #160 revision
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Test:** ✅ Pass (472 tests)

### What was fixed

**Problem:** Hal's review flagged two issues on Gately's PR #160 (branch `squad/149-drag-and-drop`):
1. `ghostLayer` referenced in `container.addChild()` but never declared — would throw at runtime
2. Memory leak in `redrawHand()` — each tile has `pointertap` + `pointerdown` listeners that weren't destroyed on redraw

**Solution:**
- Declared `ghostLayer` property: `private readonly ghostLayer = new Container();` (matching the pattern from other layers like `boardLayer`, `handLayer`, `dragLayer`)
- Fixed memory leaks in three `removeChildren()` call sites:
  - `redrawHand()` — destroy children before removing (prevents 2 listeners/tile leak)
  - `redrawBoard()` — destroy children before removing
  - `redrawEndMarkers()` — destroy children in all 4 end markers before removing
- Followed codebase pattern: `for (const child of layer.removeChildren()) child.destroy()`

**Files Modified:**
- `client/src/renderers/DominosRenderer.ts` — Added ghostLayer property, fixed 3 memory leaks

### Learnings

- **PixiJS memory management pattern:** Always destroy removed children that have event listeners. The standard pattern is:
  ```ts
  for (const child of layer.removeChildren()) {
    child.destroy();
  }
  ```
  Not: `layer.removeChildren()` (leaks listeners).
- **Layer declaration pattern:** All layers in `DominosRenderer` are `private readonly {name}Layer = new Container()` properties. `ghostLayer` needed the same treatment.
- **Cross-branch dependencies:** `ghostLayer` is likely from PR #158 (not yet merged), but it's already referenced in this PR's code. Declaring it locally prevents runtime errors until #158 merges.
- **Gately lockout protocol:** When Gately is locked out of revisions, I (Ortho) handle PixiJS renderer fixes. This was a clean handoff since the issues were isolated to the renderer file.
---

## 2026-07-23: HistoryScreen + View History Button — Complete ✅

**Status:** Complete
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Test:** ✅ Pass (506 tests)

### What was built

**Created (2 new files):**
- `client/src/ui/HistoryScreen.ts` — Full-screen DOM overlay for move history review
  - Glass-morphism panel matching VictoryScreen visual style
  - Header with title, game badge, close button (×)
  - Stats bar: total moves, duration, average move time
  - Scrollable move list with per-player color coding (up to 4 players)
  - Turn number badges, player names, formatted descriptions, timestamps
  - Footer with "Back to Results" button
  - Keyboard accessible (Escape to close, focus management)
  - `hs-` CSS class prefix to avoid conflicts
  - z-index 10001 (above VictoryScreen's 10000)

- `client/src/ui/historyFormatters.ts` — Per-game move formatting system
  - `MoveFormatter` interface: `formatMove()` + `getMoveIcon()`
  - Checkers formatter: move (➡️), capture (⚔️), king (👑) with A1-H8 notation
  - Default fallback formatter using `entry.description`
  - `getFormatter(gameType)` registry lookup

**Modified:**
- `client/src/ui/VictoryScreen.ts`
  - Extended `VictoryScreenEvent` union with `{ type: "view_history"; gameType: string }`
  - Enabled "View History" button (removed disabled/title, added click handler)
  - Updated CSS: removed disabled styles, added hover effect for active button

- `client/src/Application.ts`
  - Imported HistoryScreen + HistoryScreenData
  - Added `historyScreen` instance variable, instantiated alongside VictoryScreen
  - Extracted `showVictoryScreenWithHistory()` method for round-trip navigation
  - `view_history` event: hides VictoryScreen, shows HistoryScreen with moveHistory from `GameResult.metadata`, onClose re-shows VictoryScreen

### Learnings

- **HistoryScreen pattern:** Same `injectStyles()` pattern as VictoryScreen/PlayerInfoBar. Uses `#history-overlay` appended to document.body. Shows/hides via DOM manipulation. Escape key handler attached on show, removed on hide.
- **Round-trip overlay navigation:** VictoryScreen → HistoryScreen → back to VictoryScreen. Done by storing victory data and re-calling `showVictoryScreenWithHistory()` on close. No scene transition needed since both are DOM overlays.
- **Move history data flow:** `GameResult.metadata.moveHistory` is the `MoveEntry[]` array. Extracted as `Record<string, unknown>` in Application.ts, then cast.
- **Player color coding:** Up to 4 players supported via `hs-player-{0..3}` CSS classes, assigned by order of first appearance in move history.
- **Formatter extensibility:** Add new game formatters to the `formatters` record in `historyFormatters.ts`. Each gets a `MoveFormatter` implementation.
- **Game formatter payloads (P6.3):** Backgammon move payloads use `{ from: number|"bar", to: number|"off", die: number }` — points are 0-indexed, display as 1-indexed. Risk payloads use territory IDs (e.g., `"alaska"`) resolved to display names via `getTerritoryById()` from `@eschaton/shared`. Dominos play payloads only contain `{ tileId, end }` — pip values are server-side only; formatter checks for enriched `pips`/`a`/`b` fields and falls back gracefully.
- **Risk action types for history:** `pickTerritory`, `placeArmy`, `attack`, `captureMove`, `fortify`, `tradeCards`, `endPhase`. Attack payload lacks dice roll results (computed server-side), so display uses attacker dice count only.


### Task: Migrate modal status popups to ConsoleLog

**Commit:** `refactor: migrate modal status popups to ConsoleLog panel`

Replaced 15 transient modal/notification-bar calls with ConsoleLog across 7 files:
- **ReconnectOverlay** (Application.ts): 4 calls — showReconnecting/showReconnected/showFailure replaced with consoleLog.warn/success/error. Overlay infrastructure (hide/scheduling) left intact as no-op.
- **LobbyScreen**: 5 showNotice calls replaced with consoleLog.error.
- **LobbyScene**: showNotice method and onEnter notice now route through consoleLog.log().
- **SetupScreen**: 2 showError calls replaced with consoleLog.error. Added setConsoleLog setter.
- **WaitingRoom**: 1 showError call replaced with consoleLog.error. Added setConsoleLog setter.
- **Application.ts**: 2 lobbyScene.showNotice calls replaced with consoleLog.success/error. Wired consoleLog to SetupScene and WaitingRoomScene.

### Learnings

- **ConsoleLog API:** `info()`, `success()`, `warn()`, `error()`, `log(msg, level)`. Singleton class, instantiated in Application.ts. Passed to scenes/screens via `setConsoleLog()` setter pattern.
- **showNotice double-logging:** LobbyScreen.showNotice already logged to consoleLog internally (line 584). When replacing showNotice calls with direct consoleLog calls, the duplicate log path through showNotice is bypassed.
- **ReconnectOverlay still exists:** The overlay has a spinner + text, so its DOM and scheduling infrastructure was left in place. After this migration it's never shown (show* calls removed), but hide() calls remain as harmless no-ops.

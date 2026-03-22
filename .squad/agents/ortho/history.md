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
- **No scrollbars in sidebar status panes:** Removed `overflow-y: auto` and all scrollbar pseudo-element styling from `.sidebar-panel-content`. Changed to `overflow: hidden`. Also removed `max-height` constraint from `.game-sidebar-panel` so panels size naturally to their content. The outer `.game-sidebar` container retains `overflow-y: auto` for full-sidebar scroll when many panels are present. Rule: individual status panes must never show scrollbars.
- **HistoryScreen P6.4 Polish:** Player color palette expanded from 4 to 6 (players 0–5) for Risk support. Colors: blue, amber, purple, green, red, cyan — applied consistently to turn badges (`.hs-player-N`), player name labels, and stat bar fills (`.player-N`). The stat bar `buildStatBar` was clamped at `Math.min(playerIdx, 1)` — fixed to `Math.min(playerIdx, 5)`. Move cards upgraded to `rounded-lg` with subtle borders and `rgba(15,23,42,0.5)` slate background matching Figma's `bg-slate-900/50` pattern. Stats cards got `box-shadow`, `border-bottom` separators on titles, uppercase letter-spacing. Turn badges show `#N` format (matching Figma) at 40×40px. Mobile responsive: sidebar stacks below move list at `<768px` with `max-height: 300px` and `order: 2`. Overall container upgraded to `border-radius: var(--radius-2xl)` with ring shadow.

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


### Task: P6.4 Polish HistoryScreen to Figma design parity

**Commit:** `feat: polish HistoryScreen with stats sidebar and expandable moves`

Implemented comprehensive design enhancements to HistoryScreen based on Figma design references:

**1. Stats Sidebar (280px right panel)**
- Responsive layout: Desktop = right sidebar, Mobile (<768px) = stacks below
- General stats card: Total moves, Duration, Avg move time (extracted from metadata)
- Game-specific stat cards with visual comparison bars:
  - **Checkers**: Kings created, Captures comparison with per-player bars
  - **Backgammon**: Doubles rolled, Hits comparison with per-player bars
  - **Dominos**: Tiles played comparison, Total passes
  - **Risk**: Total attacks, Total fortifies
- Progress bar styling: Gradient fills, player-0 (blue) and player-1 (amber) color coding

**2. Expandable Move Details**
- Each move entry is now a collapsible card (button + details panel)
- Chevron icon (▼) rotates 180° on expand/collapse
- CSS transition: `max-height 0.3s ease-out` for smooth animation
- First move starts expanded by default (nice UX touch from designs)
- Details panel shows payload data in a responsive grid: `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`
- Min-height 44px for touch targets on mobile

**3. Enhanced "View History" Button (VictoryScreen)**
- Added 📜 icon before text
- Increased prominence: `border: 2px solid var(--pg-blue-500)` (was 1px slate)
- Hover effect: border-color shifts to blue-400, background to slate-600
- Button content uses flex layout with icon + text

**4. Empty State**
- Friendly message: "No moves were recorded for this game."
- 📋 icon (3rem, 0.5 opacity) above text
- Flex column layout, centered

**5. Mobile Responsive Refinements**
- @media (max-width: 768px): sidebar stacks below move list via flex-direction column
- @media (max-width: 480px): Full-screen panel (border-radius: 0), reduced padding, single-column detail grid
- Touch-friendly: min-height 44px on move headers, good tap targets
- Scrollbar styling works on touch (webkit-scrollbar rules)

**Modified:**
- `client/src/ui/HistoryScreen.ts` (362 → 1061 lines)
  - Widened container max-width: 720px → 1200px (accommodate sidebar)
  - Replaced flat stats bar with sidebar + main content flex layout
  - Refactored move list to use collapsible card pattern
  - Added `buildStatsSidebar()`, `addCheckersStats()`, `addBackgammonStats()`, `addDominosStats()`, `addRiskStats()` methods
  - Stats extraction from moveHistory payloads (e.g., `captured`, `hit`, `action` fields)
  - `buildStatBar()` helper for visual comparison bars
  - `formatLabel()` helper: camelCase → Title Case
  - CSS: Added `.hs-content`, `.hs-main-section`, `.hs-stats-sidebar`, `.hs-move-header`, `.hs-move-details`, `.hs-chevron`, `.hs-stats-card`, `.hs-stat-bar-*` classes

- `client/src/ui/VictoryScreen.ts`
  - Enhanced `.vs-btn-history` CSS: 2px blue border, flex layout
  - Refactored history button DOM creation to include icon + text

### Learnings

- **Flexbox layout for responsive sidebar:** Use `flex-direction: row` on desktop, `column` on mobile via media query. Sidebar has fixed width (280px) on desktop, 100% on mobile with max-height constraint.
- **Expandable panel CSS pattern:** Use `max-height: 0` → `max-height: 500px` (large enough to fit content) with `overflow: hidden` and `transition: max-height 0.3s ease-out`. More reliable than `height: auto` transitions.
- **Chevron rotation:** Simple `.expanded { transform: rotate(180deg); }` with transition on the base class.
- **First item expanded by default:** Check index in loop, apply `expanded` class conditionally on first render.
- **Stats from move payloads:** Iterate over moveHistory, cast payload to `Record<string, unknown>`, check for game-specific fields like `captured`, `hit`, `action`.
- **Visual comparison bars:** Calculate max value across all players, compute percentage width for each. Use player-index CSS classes (`.player-0`, `.player-1`) for color coding.
- **Grid auto-fit pattern:** `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))` auto-collapses to single column on narrow screens without media query.
- **Touch target sizing:** 44px minimum height for mobile tap targets (WCAG AA guideline).
- **Unused parameter prefix:** ESLint `@typescript-eslint/no-unused-vars` requires unused params to start with `_` (e.g., `_meta`, `_playerIndexMap`).
- **Add CPU Player button:** CPU opponent selection moved from game creation time to the waiting room. The host sees an "Add CPU Player" dashed-border slot in the player list (both WaitingRoom.ts and SetupScreen.ts). Sends `ADD_CPU_PLAYER`/`REMOVE_CPU_PLAYER` messages to the lobby room. CPU-supporting games: checkers, backgammon, dominos. The PvP/AI mode toggle was removed from CheckersSetupConfig and BackgammonSetupConfig, and the cpuOpponent checkbox removed from LobbyScreen's create modal. Invite section visibility now checks `players.some(p => p.isCPU)` instead of `gameInfo.cpuOpponent`.

- **Dynamic game availability (AVAILABLE_GAME_TYPES):** LobbyScreen now listens for an `AVAILABLE_GAME_TYPES` message from the server (imported from `@eschaton/shared`). The hardcoded `GAME_TYPE_OPTIONS` was renamed to `DEFAULT_GAME_TYPES` and serves as a fallback until the server sends the authoritative list. On receipt, the lobby tiles, create-game modal dropdown, and SetupScreen labels all update dynamically. A new `client/src/ui/gameTypeCache.ts` module provides `updateAvailableGameTypes()`, `getGameLabel()`, and `getPlayerCountLabel()` — shared between LobbyScreen and SetupScreen to avoid circular imports. The `GameTypeInfo` → `GameTypeOption` conversion is done by `gameTypeInfoToOption()` which expands the `playerCount: [min, max]` tuple into an array of selectable counts.

---

## Cross-Agent Update — P7: Game Availability Per Environment (2026-03-20)

**Event:** Game availability feature complete — client UI updated to consume server-provided game types.

**Summary:** Implemented dynamic game type rendering on client, replacing hardcoded game list with server-driven data.

**Outputs:**
- `client/src/ui/gameTypeCache.ts` (new) — Shared label cache (getGameLabel, getPlayerCountLabel) used by LobbyScreen and SetupScreen
- `client/src/ui/LobbyScreen.ts` — Renamed GAME_TYPE_OPTIONS to DEFAULT_GAME_TYPES (fallback), added AVAILABLE_GAME_TYPES handler, refreshGameTypeDropdown() method
- `client/src/ui/SetupScreen.ts` — Import game labels from gameTypeCache instead of local constants

**Design:** Fallback-first (defaults remain if message delayed), shared cache avoids circular imports, GameTypeInfo→GameTypeOption conversion preserves existing modal UX.

**Validation:** Build ✓, Lint ✓, Test ✓

**Status:** Ready for deployment. Feature merged into decisions.md (`ortho-game-availability.md`).


---

## 2026-03-20: Chess Clock UI for Checkers (Issue #165)

**Status:** Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass

### Task: Implement chess clock UI panel and player info bar time display

Implemented the chess clock UI for the Checkers game following Mario's design spec at `.squad/decisions/inbox/mario-chess-clock-design-spec.md`.

**1. GameSidebar Chess Clock Panel**
- Added new "Game Clock" sidebar panel (4th panel, between "Game Info" and "Move History")
- Two stacked clock items showing both players' remaining time
- Active player clock: Blue border ring (`--pg-blue-400`), gradient background, pulsing green dot, glow animation
- Inactive player clock: Dark subdued background (`--bg-card-dark`)
- Critical state (< 60 seconds): Red text (`--pg-red-400`), red border, faster pulse animation
- Clock time format: MM:SS with `font-variant-numeric: tabular-nums` (fixed-width monospace)
- Animations: `sidebar-clock-pulse` (2s), `sidebar-clock-highlight` (2s), `sidebar-clock-pulse-fast` (1s for critical)
- All animations respect `prefers-reduced-motion` accessibility setting

**2. Player Info Bars Chess Clock Display**
- Updated PlayerInfoBar to show per-player remaining time (not just active turn timer)
- GameScene checks `gameType === "checkers"` and extracts per-player times from state
- Opponent bar shows opponent's remaining time; player bar shows your remaining time
- Extracted chess clock times via `extractChessClockTime(state, playerIndex)` method

**3. CheckersRenderer Integration**
- Added `player1TimeRemainingMs` and `player2TimeRemainingMs` fields (defaults: 600000 = 10 min)
- Extracted chess clock data from Colyseus state in `applyState()` method
- Created `updateChessClockPanel()` method to populate the sidebar panel with live data
- Added `getPlayerByIndex(playerIndex)` helper to map player indices to player snapshots
- Chess clock panel updates on every state change and sidebar refresh

**4. Design Tokens & CSS**
- No new CSS custom properties required — all colors already exist in `design-tokens.css`
- Active clock gradient: `linear-gradient(135deg, var(--pg-slate-700), var(--pg-slate-800))`
- Active border: `2px solid var(--pg-blue-400)`
- Critical text: `var(--pg-red-400)`
- Pulsing dot: `var(--pg-green-500)` with box-shadow animation
- Mobile responsive: Clock time font-size scales down to 1.75rem on tablet (768-1024px)

**Modified:**
- `client/src/ui/GameSidebar.ts`
  - Added CSS classes: `.sidebar-clock-container`, `.sidebar-clock-item`, `.sidebar-clock-item--active`, `.sidebar-clock-item--critical`, `.sidebar-clock-time`, `.sidebar-clock-time--critical`, `.sidebar-clock-indicator`, `.sidebar-clock-player-name`
  - Added keyframe animations: `sidebar-clock-pulse`, `sidebar-clock-highlight`, `sidebar-clock-pulse-fast`
  - Added `getChessClockMarkup()` helper function to generate chess clock HTML

- `client/src/renderers/CheckersRenderer.ts`
  - Added fields: `player1TimeRemainingMs`, `player2TimeRemainingMs`
  - Modified `init()`: Added "game-clock" panel after "game-info"
  - Modified `applyState()`: Extract chess clock times from state
  - Modified `updateSidebar()`: Call `updateChessClockPanel()` to populate clock data
  - Added `updateChessClockPanel()`: Generate and update chess clock markup
  - Added `getPlayerByIndex()`: Map player index to PlayerSnapshot

- `client/src/ui/PlayerInfoBar.ts`
  - No changes — already supports `timerSeconds` display

- `client/src/scenes/GameScene.ts`
  - Modified `buildPlayerInfoData()`: Check for checkers game type, extract chess clock time per player
  - Added `extractChessClockTime()`: Extract player1/player2TimeRemainingMs from state by player index

### Learnings

- **Chess clock data flow:** Server adds `player1TimeRemainingMs` and `player2TimeRemainingMs` fields to CheckersState → Colyseus auto-syncs to client → CheckersRenderer extracts in `applyState()` → Sidebar panel and PlayerInfoBar both display the times
- **Active player detection:** Use `state.currentTurn` to get session ID, look up player in `this.players`, check `player.playerIndex` (0 = Black, 1 = Red)
- **Sidebar panel order:** Game Clock panel placed between "Game Info" and "Move History" for logical grouping (game state → clock → history → controls)
- **CSS animation best practice:** Always provide `@media (prefers-reduced-motion: reduce)` fallback with `animation: none` for accessibility
- **Monospace time display:** Use `font-family: 'Courier New', Consolas, monospace` + `font-variant-numeric: tabular-nums` for fixed-width digits (prevents layout shift as time counts down)
- **Critical time threshold:** Design spec specifies < 60 seconds for critical state (red text, red border, faster pulse)
- **Optional chaining on Colyseus state:** Always use `?.` when accessing state fields that may not exist yet (e.g., `stateWithClocks?.player1TimeRemainingMs`)
- **GameScene game-specific state access:** For game-specific state fields (like chess clock times), add extraction helpers to GameScene that check `gameType` and safely cast state to access those fields
- **PlayerInfoBar timer persistence:** Unlike turn timer (only shows for active player), chess clock time shows for BOTH players at all times — this required updating GameScene to extract per-player time instead of just active turn time
- **Design token reuse:** All Figma colors (`from-slate-700 to-slate-800`, `ring-2 ring-blue-400`, `text-red-400`, `bg-green-500 animate-pulse`) mapped directly to existing CSS custom properties — zero new tokens needed

**Status:** Implementation complete. Server-side chess clock logic (Pemulis) will populate `player1TimeRemainingMs` and `player2TimeRemainingMs` fields. UI is ready to display them.

## Chess Clock UI Implementation (Issue #165) (2026-03-20)

**Role:** Frontend Developer  
**Outcome:** ✅ Complete, UI implemented per design spec, integrated with server logic

Implemented chess clock UI for sidebar panel and player info bars following Mario's design spec and integrating Pemulis's server-side time fields.

**Architecture:**
```
CheckersState (player1/2TimeRemainingMs) 
  → Colyseus sync 
  → CheckersRenderer.applyState()
  → getChessClockMarkup()
  → GameSidebar.updatePanel("game-clock")
```

**Sidebar Panel (4th position):**
- Container: `.sidebar-clock-container` (flex column)
- Items: `.sidebar-clock-item`, `.sidebar-clock-item--active`, `.sidebar-clock-item--critical`
- Time: `.sidebar-clock-time` (2rem monospace, tabular-nums)
- Indicator: `.sidebar-clock-indicator` (8×8px pulsing green dot)

**Active State:**
- Gradient bg (slate-700 → slate-800)
- Blue border (2px solid --pg-blue-400)
- Glow box-shadow + pulse animation
- Green pulsing indicator dot

**Animations (respect prefers-reduced-motion):**
- `sidebar-clock-pulse` (2s) — Green dot pulse
- `sidebar-clock-highlight` (2s) — Blue glow pulse
- `sidebar-clock-pulse-fast` (1s) — Critical state red pulse

**Helper Functions:**
- `getChessClockMarkup()` — HTML generation with state-based CSS
- `extractChessClockTime()` — Safe state access (playerIndex → timeMs)

**Design Token Reuse:** All colors from existing tokens (zero new tokens needed).

**Testing:** Manual verification checklist (turn switching, critical state, animations, responsive).

**Learning:** Componentizing state extraction (getChessClockMarkup, extractChessClockTime) enables reuse across multiple game renderers. Design spec as executable contract prevents rework.

### Chess Clock Generalization & Turn Timer Removal (Client)

**Date:** 2026-03-21
**Context:** Turn timer fully replaced by chess clock for all 4 games

**Changes Made:**
- `RiskSetupConfig.ts` — Removed turn timer stepper from Advanced Settings
- `GameScene.ts` — Removed `extractTurnTimeRemaining()`, removed turn timer data from HUD init/update, removed turn timer fallback in `buildPlayerInfoData()`. Chess clock now sole timer source.
- `mockStates.ts` — Replaced `turnTimeRemaining` with `player1TimeRemainingMs`/`player2TimeRemainingMs` (600s default) on all mock states

**Key Insight:** The chess clock in `extractChessClockTime()` was already generic (not Checkers-specific). It maps playerIndex 0→player1, 1→player2, and returns null for index ≥2. This means Risk/Dominos with >2 players correctly show clocks for active pair only.

**Learning:** The HUD timer infrastructure (`gameTimer`/`showTimer` in HUD.ts) is now dead code — it only served the old turn timer. Can be cleaned up in a future pass once shared types are also updated.

## Team Updates (2026-03-21)

**Turn Timer Removal Session:** Removed client-side turn timer display (HUD countdown, Risk setup stepper) and updated mocks to chess clock schema. Coordinated with Pemulis on server-side removal. GameSidebar, PlayerInfoBar, all renderers already compatible with chess clock (no changes needed). HUD timer infrastructure is now dead code. Orchestration log: `.squad/orchestration-log/2026-03-21T12-29-57Z-ortho.md`.

### Time Control UI Wiring Fix (Client)

**Date:** 2025-03-21
**Context:** Chess clock time selection was disconnected — host's selection not sent to server, joining players saw wrong value

**Changes Made:**

1. **Shared types** (`shared/src/lobbyTypes.ts`):
   - Added `TimeControl` type: `"no-limit" | "blitz" | "rapid" | "classical"`
   - Added `TIME_CONTROL_MS` constant mapping TimeControl → milliseconds (no-limit uses MAX_SAFE_INTEGER for compatibility with number-typed state)
   - Added `timeControl?: TimeControl` to `CreateGamePayload`
   - Added `timeControl?: TimeControl` to `GameSessionInfo`

2. **CheckersSetupConfig.ts** (`client/src/ui/setup/CheckersSetupConfig.ts`):
   - Fixed `getPayloadOverrides()` to include `timeControl: timeGroup.getValue()`
   - Time selector options already matched TimeControl values ("no-limit", "blitz", "rapid", "classical")

3. **WaitingRoom.ts** (`client/src/ui/WaitingRoom.ts`):
   - Added `gameInfoEl` display element in header
   - Added `updateGameInfo()` method to display time control and head-to-head mode as chips
   - Time labels: "⏱ No Time Limit", "⏱ Blitz (3:00)", "⏱ Rapid (10:00)", "⏱ Classical (30:00)"
   - Display format: "⏱ Blitz (3:00) • 🖥 Shared Device" (space-separated chips)

4. **Styles** (`client/index.html`):
   - Added `.waiting-room-game-info` CSS (matches subtitle style with 8px top margin)

**Other Setup Configs:** Backgammon, Dominos, Risk don't have time selectors — no changes needed.

**Key Insight:** TIME_CONTROL_MS uses `Number.MAX_SAFE_INTEGER` for "no-limit" (not null) because BaseGameState's `player1TimeRemainingMs`/`player2TimeRemainingMs` are typed as `number`. Server code treats large values as unlimited.

**Learning:** When adding optional payload fields, check both the creation flow (host setup) AND the join flow (WaitingRoom display). The setup config collects the value, but the waiting room must show it to all players.

## Cross-Agent Update — Chess Clock Time Control Selection UI Wiring (2026-03-21)

**Event:** Time control selection wired from setup config through server payload to WaitingRoom display.

**Summary:** Ortho completed client-side wiring to send time control selection to server and display it to joining players. Fixed CheckersSetupConfig.getPayloadOverrides() to include timeControl field. Added WaitingRoom.updateGameInfo() to show time control chip alongside head-to-head mode setting. Established reusable pattern for future game config options.

**Outputs (Client):**
- `client/src/ui/setup/CheckersSetupConfig.ts` — timeControl included in payload overrides
- `client/src/ui/WaitingRoom.ts` — updateGameInfo() displays time control (e.g., "⏱ Blitz (3:00)")
- `client/index.html` — .waiting-room-game-info CSS styling

**Pattern Established:**
For adding new game config options:
1. Add to CreateGamePayload and GameSessionInfo in shared types
2. Include in setup config's getPayloadOverrides()
3. Display in WaitingRoom's updateGameInfo()

Benefits: All players see same config before game starts, no surprises, consistent extension pattern.

**Key Design:**
- TIME_CONTROL_MS uses MAX_SAFE_INTEGER for "no-limit" (number type requirement)
- Other setup configs (Backgammon, Dominos, Risk) unchanged (no time selectors)
- Display format combines time control with head-to-head mode: "⏱ Blitz (3:00) • 🖥 Shared Device"

**Status:** Client integration complete. All tests pass. Server-side plumbing (Pemulis) ready. Tests in progress (Steeply).

**Decisions merged:** chess-clock-time-control-selection, time-control-ui-pattern, no-scrollbars-sidebar


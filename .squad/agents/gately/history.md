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

## Learnings

### 2026-03-16: PR #122 Final Approval — Head-to-Head Mode Merged

- **Decisions merged:** `gately-head-to-head.md` and `gately-turn-indicator.md` now in `.squad/decisions.md`
- **Shared-device control model:** Synthetic `shared-device-opponent` seat controlled via `controllerSessionId` mapping
- **Turn indicator design:** Sidebar highlight instead of overlay banner (board stays visually clear)
- **Regression:** Steeply's timeout cleanup test confirmed synthetic player removal and proper game end
- **Merged to dev:** 2026-03-16 (after Pemulis→Steeply→Hal lockout cycle)

### 2026-03-16: Checkers shared-device head-to-head mode (Original Session)

- `client/src/ui/LobbyScreen.ts` and `server/src/rooms/LobbyRoom.ts` now support a Checkers-only `headToHeadMode` toggle, keep shared-device rooms single-seat in the waiting lobby, and start them with one real player.
- `shared/src/BaseGameState.ts` adds `PlayerInfo.controllerSessionId`; `server/src/game/BaseGameRoom.ts` uses that field to synthesize a `shared-device-opponent` seat so one Colyseus client can legally take both turns without replacing the normal turn-order flow.
- `client/src/renderers/CheckersRenderer.ts` detects when the local session controls both seats, rotates the board by the active color, allows input for whichever shared-device seat is up, and updates sidebar copy to describe Black/Red turns clearly.
- `client/src/scenes/GameScene.ts` now shows a transient pass-the-device prompt when the active shared-device seat changes.
- Regression coverage for the mode lives in `server/src/__tests__/BaseGameRoom.test.ts` and `server/src/__tests__/lobby-pregame.test.ts`, and the branch validates with `npm run build`, `npm run lint`, and `npm run test`.

### 2026-03-15: Client reconnect session resilience

- Added `client/src/ui/ReconnectOverlay.ts` plus `#reconnect-overlay` styles in `client/index.html` so game disconnects show reconnecting, reconnected, and return-to-lobby states without touching the Pixi render loop.
- `client/src/Application.ts` now owns active-game session persistence through `sessionStorage` key `playgrid.active-session`, storing `room.reconnectionToken`, `room.roomId`, `gameType`, and a timestamp whenever a game room join or reconnect succeeds.
- Startup recovery now happens before any fresh lobby join: `Application.ts` attempts `ConnectionManager.reconnect()` if the saved session is younger than 30 seconds, then falls back to `connectToLobby()` only after clearing stale reconnect state.
- Active game room lifecycle should bind `room.onDrop`, `room.onReconnect`, `room.onLeave`, and the `game-end` message together: keep reconnect state during drops, refresh it after reconnect, clear it on consented leave or natural game end, and return through `connectToLobby()` when a restored session has no live lobby room.
- Key paths for this flow: `client/src/Application.ts`, `client/src/networking/ConnectionManager.ts`, `client/src/ui/ReconnectOverlay.ts`, and `client/index.html`.

---

## 2026-03-15: Session Resilience — Client-Side Reconnection Implementation

**From:** Squad Scribe  
**Event:** Session completed — Client-side reconnect flow landed

**What Changed:**
- sessionStorage persistence under `playgrid.active-session`
- Startup reconnect attempt before fresh lobby boot
- ReconnectOverlay UI for drop/reconnect states
- State cleanup on consented leave, game-end, or failed restore

**Coordination Notes:**
- **Pemulis (Server):** Server-side 30s window + presence cleanup implemented in parallel
- **Steeply (Tester):** Server tests passing; client contracts as .todo() stubs ready for your seam availability

**What Pemulis Provided:**
- onPlayerReconnect hook wired for future turn timer integration
- Presence topic stable for lobby cleanup
- 30s reconnection window operational server-side

**Status:** ✅ Build + lint pass. End-to-end refresh recovery enabled within 30s window.

## Cross-Agent Update — Risk Game Plugin Triage (2026-03-15T01:40:25Z)

**From:** Squad Scribe  
**Event:** Hal completed triage of issue #80 "Add Risk game plugin"

**What This Means for You:**

Hal has triaged Risk and assigned you as the rendering lead. Your work is staged for Phase 3, starting after Pemulis stabilizes Phase 1.

**Phase 3: Interactive Map Renderer** (~600+ lines client code)
- Procedural map generation (42 territories, continent colors)
- Clickable territory regions (hit detection, highlights)
- Army count overlays (render army icons/numbers per territory)
- HUD with turn phase, action indicators, card count display
- Animation support for territory transitions

**Setup Phase UI** (shared responsibility with Phase 2):
- Territory selection interface (allow players to pick starting territories)
- Initial army placement UI (drag/click to place armies before game starts)
- Visual feedback (ownership colors, hover states, placement validation)

**Complexity Drivers:**
- 42 clickable regions (vs. 32 Checkers squares, 30 Backgammon points)
- Multi-continent layout with continent colors
- Real-time army count updates (cascading combat losses)
- Touch/mobile support (responsive design with 44px+ hit areas)

**Blockers:** Waiting for Pemulis to stabilize Phase 1 (RiskState schema contract).

**Coordination:**
- Pemulis is implementing core logic and will lock RiskState schema
- You can design Phase 3 UI/architecture in parallel
- Steeply is writing test cases for combat/phases (helps validate your rendering assumptions)

**Architectural Notes:**
- Use existing Scene.ts contract and SceneManager for transitions
- Leverage PixiJS viewport scaling (mobile responsive)
- Reference Checkers/Backgammon renderers (same architecture pattern)

**Precedent:** Risk is next in approved game order (Dominoes → Poker → Hearts/Spades → Chess → Risk).

---

## 2026-03-15T01:48:51Z: Risk Plugin Phase 1 Complete — Schema Locked for Phase 3

**From:** Squad Scribe  
**Event:** Pemulis completed Risk core logic; Steeply completed test suite (16 passing, 48 `.todo()`)

**Implementation Details for Your Phase 3 Work:**

### State Schema (Locked)

**File:** `shared/src/games/risk/RiskState.ts`

**Key Types:**
```typescript
interface RiskState extends GameState {
  territories: Territory[];           // 42 territories
  players: Player[];                  // 2-6 players
  turnPhase: 'reinforce' | 'attack' | 'fortify';
  currentPlayerIndex: number;
  cards: number;                      // Card count per player (no types in Phase 1)
  round: number;
}

interface Territory {
  id: number;                         // 0-41
  owner: number;                      // Player index or -1 (neutral)
  armies: number;
  continent: string;                  // 'NorthAmerica' | 'SouthAmerica' | ...
  neighbors: number[];                // Adjacency list (0-8 neighbors)
}

interface Player {
  id: string;
  index: number;
  color: string;                      // 'red' | 'blue' | 'green' | ...
  armies: number;                     // Reinforcement pool
  eliminated: boolean;
  cards: number;
}
```

### Game Logic (Pure Functions)

**File:** `server/src/games/risk/riskLogic.ts`

**Key Functions (all pure, reusable):**
- `calculateArmies(territories: Territory[], playerId: number)` → number (continent bonuses included)
- `isAdjacent(from: number, to: number)` → boolean (from territoryData.ts)
- `rollAttack(attackDice: number, defendDice: number)` → { attacker: number, defender: number } (casualties)
- `validateTrade(cards: number)` → boolean
- `getTradeBonus(cardCount: number)` → number (4→6→8→10→12→15→20...)
- `getWinner(players: Player[])` → Player | null

### Territory Data

**File:** `server/src/games/risk/territoryData.ts`

**Structure:**
```typescript
const TERRITORIES = [
  { id: 0, name: 'Alaska', continent: 'NorthAmerica', neighbors: [1, 2, 29] },
  // ... 42 total
];

function isAdjacent(from: number, to: number): boolean { ... }
function getContinent(territoryId: number): string { ... }
function getContinentBonus(continent: string): number { ... }
```

### Setup Sequence (for UI Design)

1. **Auto-Distribute Phase (Server):** Round-robin territory ownership to all players
2. **Setup-Place Phase (Interactive):** Players place remaining armies (40 − territories_owned) on their territories
   - Client sends `setupPlace(territoryId, count)` actions
   - Server validates: player owns territory, army pool > 0, count > 0
   - State updates via message
3. **Transition to Reinforce:** Once all armies placed, first player enters reinforce phase

### Action Signatures (for Client Integration)

**From RiskPlugin.ts:**
- `setupPlace(playerId: string, territoryId: number, count: number)` → void
- `reinforce(playerId: string, territoryId: number)` → void
- `attack(playerId: string, from: number, to: number, diceCount: number)` → void
- `fortify(playerId: string, from: number, to: number, armies: number)` → void
- `endPhase(playerId: string)` → void

### Rendering Notes for Phase 3

**Territory Layout:**
- 42 clickable regions (vs. 32 Checkers squares, 30 Backgammon points)
- Continent colors: North America (green), South America (yellow), Europe (purple), Africa (orange), Asia (red), Australia (blue)
- Hit detection: radius/polygon vs. center point (territories vary in size)

**Army Display:**
- Overlays per territory: icon/number showing army count
- Update on reinforce/attack/fortify actions

**Phase Indicator:**
- HUD shows current phase: "Reinforce", "Attack", "Fortify"
- Action buttons/prompts change per phase

**Setup UI (Shared Responsibility):**
- Phase 2: Territory selection interface + initial army placement drag/click UX
- Territory highlight on hover (shows neighbors for attack validation)
- Visual feedback: ownership colors, placement validation

**Mobile Responsiveness:**
- 44px+ hit areas for touchscreen
- Continent legend (color key)
- Responsive SVG/canvas with viewport scaling

### Coordination with Pemulis & Steeply

**Pemulis:** Will complete action handlers as Phase 1 progresses. RiskPlugin message signatures are stable.

**Steeply:** 48 `.todo()` integration tests document expected behavior. 16 pure logic tests pass (territory map, continent bonuses verified).

**Your Work:** Can begin procedural map generation and clickable region architecture immediately (schema locked, no blockers).


## Learnings

### Risk Game Client Renderer (Issue #80, Phase 3)
**Date:** 2025-01-XX  
**Files:**
- `client/src/renderers/RiskRenderer.ts` — Main game renderer (23KB)
- `client/src/games/risk/riskClientLogic.ts` — Client-side helper functions
- `client/src/renderers/index.ts` — Registered Risk in renderer registry

**Architecture:**
- Followed **exact Checkers pattern** for consistency
- Used PixiJS Container layers: mapLayer → territoryLayer → hudLayer
- Territory layouts: Procedural grid-based positioning (42 territories, 6 continents)
- Continent base colors with player color overlays for ownership
- Interactive Graphics per territory with event handlers

**Territory Interaction:**
- Setup phases: Click to place armies on available territories
- Attack phase: Two-click pattern (select owned → click enemy adjacent)
- Fortify phase: Two-click pattern (select owned → click owned adjacent)
- Valid target highlighting with green stroke

**HUD Components:**
- Status text (turn indicator)
- Phase text (current game phase)
- Armies to place counter
- End Phase button (conditional enable)
- Trade Cards button (visible only when ≥3 cards in reinforce phase)

**State Management:**
- Direct room message sending: `placeArmy`, `attack`, `fortify`, `tradeCards`, `endPhase`
- State-driven re-rendering via `onStateChange`
- Selection sync with state to handle server updates

**Pattern Compliance:**
- GameRenderer interface implementation
- Room context for Colyseus integration
- Resize handling with adaptive layout
- Standard init/onStateChange/update/destroy lifecycle

**Key Decisions:**
- Territory positions hardcoded in TERRITORY_LAYOUTS array (functional, not geographically perfect)
- Player colors cycle through 6-color palette
- Attack/fortify dice counts and army move amounts simplified (max dice, max-1 armies)
- No combat animation (dice results from server handled passively)

**Integration:**
- Registered in `rendererRegistry` with key "risk"
- Automatically loaded by GameScene when joining Risk room
- Build verified successfully (no compilation errors)

### 2026-03-15: Lobby card artwork without an asset pipeline

- `client/src/ui/LobbyScreen.ts` now owns self-contained lobby card art via inline SVG data URLs, which is the cleanest way to ship polished card backgrounds without creating a new asset pipeline or hosting path.
- The lobby game type config should carry both the marketing metadata (label, player-count copy) and the playable constraints (selectable max-player counts), so the create-game modal stays aligned with whatever cards the library is showing.
- Readability for image-backed cards is preserved in `client/index.html` by treating `.game-tile-image::before` as the shared contrast layer and adding text shadow to the tile name/meta instead of baking heavy darkness into each artwork asset.

### 2026-03-15: Game-over overlay implementation (Issue #81)

**Problem:** Games ended with no win/loss announcement — players immediately returned to lobby. Race condition: server broadcast game-end message then immediately disconnected clients before they could render the overlay.

**Solution:** Two-part fix in base game infrastructure (works for all game types):

**Server (`BaseGameRoom.ts`):**
- Added 6-second delay before disconnect in `endGame()` using `this.clock.setTimeout()`
- Graceful fallback: if `this.clock` is undefined (e.g., in tests), disconnect immediately
- Broadcast game-end message, persist to database, THEN schedule disconnect

**Client (`Application.ts` + new `GameOverOverlay.ts`):**
- Created `GameOverOverlay` component with result formatting (win/loss/draw/forfeit/timeout)
- Shows personalized messages based on `GameResult.type` and player's sessionId
- Auto-dismisses after 5 seconds with manual "Return to Lobby" button override
- Integrated into `Application.bindGameRoom()` → `handleGameEnd()` flow
- Clears reconnect overlay and active session before showing game-over

**CSS (`client/index.html`):**
- Game-over overlay styles (z-index 40, above reconnect at 30)
- Purple gradient theme matching app design
- Responsive layout with centered content panel

**Key architectural decisions:**
- Implemented at BaseGameRoom level, not per-game (universal solution)
- Uses same message flow as existing reconnect/HUD overlays
- Delay tuned to balance: long enough for client overlay display, short enough to feel responsive
- Result metadata can carry `winnerName` for enhanced messages (optional extension)

**Testing verified:**
- ✅ Build passes (all workspaces)
- ✅ Lint passes (0 errors, 15 pre-existing warnings)
- ✅ Tests pass (259/259, 12 todo)
- Clock fallback ensures tests don't break with immediate disconnect

**Files:**
- `server/src/game/BaseGameRoom.ts` — endGame() timing fix
- `client/src/ui/GameOverOverlay.ts` — new overlay component
- `client/src/Application.ts` — integration with game-end flow
- `client/index.html` — CSS styles for overlay

---

### 2026-03-15: Browser branding via bundled SVG favicon

- `client/index.html` now owns the browser-facing brand text with the title `Playgrid - Online Board Games` and a favicon link to `./favicon.svg`.
- Keeping the favicon as a standalone SVG beside `index.html` lets Vite fingerprint and bundle it automatically, which is cleaner than adding extra asset plumbing for a simple tab icon.
- The mark uses a compact board-grid layout with contrasting pieces so the multiplayer tabletop concept still reads clearly at favicon size.
- Production build verification confirmed the generated HTML points at the hashed favicon asset in `client/dist/assets/`.

### 2026-03-15: Lobby game tiles now use local design-photo thumbnails

- The provided Figma export archive lives at `docs/designs/project.zip`; it did not bundle binary images, but it did preserve the original tile photo URLs in `src/app/App.tsx`.
- For lobby reliability, the design photos were captured into local 1200x900 JPEG thumbnails under `client/public/game-thumbnails/` so the card art no longer depends on external hosts at runtime.
- `client/src/ui/LobbyScreen.ts` should keep game tile imagery as simple path mapping (`/game-thumbnails/*.jpg`) and render real `<img>` elements, while `client/index.html` owns the sizing contract with `object-fit: cover` for consistent 4:3 crops.
- The existing `.game-tile-image::before` gradient remains the right place for text contrast, so artwork can change without re-tuning every image.

### 2026-03-16: Checkers renderer redesign pass

- `client/src/renderers/CheckersRenderer.ts` should source board, piece, selection, and king colors from `DesignTokens.ts`; when a renderer-specific alias is missing (like `BOARD_LIGHT_SQUARE`, `BOARD_DARK_SQUARE`, or `KING_MARKER`), add it to the token file instead of reintroducing local hex constants.
- The Checkers redesign reads best in PixiJS when the selected piece carries the main affordance: a violet ring plus slight scale shift on the piece, violet destination markers on target squares, and hover emphasis only on actionable pieces.
- Captured-piece feedback is clearer as a small off-board tray of mini rendered pieces than as counts alone, because it keeps the board language consistent without touching game logic.
- Verified with `npm run build`; repo-wide lint still has unrelated pre-existing errors in `client/src/ui/GameSidebar.ts` and redesign doc pages, while targeted lint on `client/src/renderers/CheckersRenderer.ts` and `client/src/renderers/DesignTokens.ts` passes.

### 2026-03-16: Risk renderer redesign pass

- `client/src/renderers/RiskRenderer.ts` now follows the redesign language with a token-driven dark slate board, glass HUD banner, continent pills, and territory cards instead of raw continent/player hex constants.
- Risk ownership colors should always resolve from `DesignTokens.ts` via `PLAYER_COLORS` / `PLAYER_COLOR_ORDER`; continent accents can reuse that same six-color palette instead of inventing a second Risk-only color system.
- The clearest Pixi affordances for Risk were: hover scale plus light sheen, violet selection ring, player-color source glow during attacks, red-tinted attack targets, and white army counts with dark drop shadow inside a neutral badge.
- Sidebar player rows benefit from the same palette mapping and should include cards/territory/army counts inline so the HTML sidebar stays visually aligned with the Pixi board without changing any room message flow.
- Verified with `npm run build` from the repo root after updating `client/src/renderers/RiskRenderer.ts` and `client/src/renderers/DesignTokens.ts`.

### 2026-03-16: Backgammon renderer redesign pass

- `client/src/renderers/BackgammonRenderer.ts` should consume board, point, home-board, dice-tray, and checker gradients from `DesignTokens.ts`; if the redesign needs a new backgammon surface or alpha, add it to the token file instead of reintroducing renderer-local colors.
- The current backgammon room logic still uses `BLACK` and `RED`, but the redesign reads best by mapping the `RED` side to white/light checker visuals in the renderer only, leaving move validation and server messages untouched.
- Selection and hover feedback are clearest when the violet affordance sits on the top checker in a stack, while valid destinations stay as semi-transparent point markers and the board keeps separate frame, center-strip, and home-board treatments.
- Verified with `npm run build`.

## 2026-03-15: Cross-Agent Update — PR #83 Revision Complete (Lockout Protocol)

**From:** Scribe (on behalf of Marathe)  
**Event:** PR #83 blockers resolved; lockout protocol applied per Hal's re-review requirement

**Situation:**
- Hal identified three critical blockers in PR #83 (Risk Game Plugin): incomplete test implementation (~48 `it.todo()` placeholders), territory data duplication (server/client drift risk), missing Phase 1 scope documentation.
- Original PR authors (Pemulis, Steeply, you) were locked out per protocol — revision could not proceed with original team.

**Resolution:**
- Marathe (DevOps) completed full revision: 60 executable tests, shared territory data refactored to `shared/src/games/risk/`, Phase 1 limitations documented in RiskPlugin.
- All blockers verified: `npm run build` ✅, `npm run lint` ✅, `npm run test` ✅ (60/60 passing).
- Commits: `816332c` (fix), `2692e8a` (docs).

**Impact on Your Work:**
- Your Risk renderer implementation (RiskRenderer.ts) requires no changes; Marathe's revision was backend-focused (tests + data structure).
- Architectural standard captured in `.squad/decisions.md`: "Shared Static Data: Game configuration data (maps, adjacency graphs, card decks) MUST be located in `shared/src/games/{game}/` so both client (renderer) and server (logic) use a single source of truth."

**Next Step:** Hal will re-review revised PR #83. Ready for merge once approved.

---

## 2025-01-13: Backgammon Board Rendering Bug Fix (Issue #96)

**Problem:** When a host creates a backgammon game, the checkers board was rendered instead of the backgammon board. The root cause was in the game scene selection logic in `WaitingRoom.ts`.

**Investigation:**
- Found that `GameStartedPayload` (shared type) only included `gameId` and `roomId`, not `gameType`
- Client code in `WaitingRoom.ts` line 141 tried to get game type from cached `gameInfo?.gameType`
- When `gameInfo` was null (race condition when game cache hadn't been updated yet), it defaulted to `"checkers"`
- This caused backgammon and potentially other games to render with the wrong board

**Root Cause:** Timing issue where:
1. Host creates a backgammon game
2. `GAME_JOINED` message arrives at client
3. Game info might not be in cache yet (waiting for `GAME_UPDATED`)
4. When game starts, `GAME_STARTED` payload lacks `gameType`
5. Client defaults to "checkers" when `gameInfo` is null

**Solution:** Added `gameType` field to `GameStartedPayload` so the server explicitly provides the game type:
- **Shared Types** (`shared/src/lobbyTypes.ts`): Added `gameType: string` to `GameStartedPayload` interface
- **Server** (`server/src/rooms/LobbyRoom.ts`): Include `game.gameType` in `GAME_STARTED` payload
- **Client** (`client/src/ui/WaitingRoom.ts`): Use `payload.gameType` directly instead of fallback logic
- **Tests** (`server/src/__tests__/lobby-pregame.test.ts`): Updated 3 test assertions to include `gameType: "checkers"`

**Key Decisions:**
- Chose server-side fix over client-side workarounds (more reliable, eliminates race condition)
- Made gameType an explicit part of the game-start contract
- This fix benefits all game types, not just backgammon

**Validation:**
- ✅ Build passes (all workspaces)
- ✅ Lint passes (0 new errors)
- ✅ Tests pass (259 passed, 12 todo)

**Files Changed:**
- `shared/src/lobbyTypes.ts` — GameStartedPayload interface
- `server/src/rooms/LobbyRoom.ts` — GAME_STARTED payload construction
- `client/src/ui/WaitingRoom.ts` — gameType usage (removed fallback)
- `server/src/__tests__/lobby-pregame.test.ts` — test expectations

**PR:** #98 (merged to `dev`)

---

## 2025-01-13: Start Game Error Display Enhancement (Issue #102)

**Problem:** Error messages when trying to start a game without enough players were hard to see. The error only briefly modified the "Start Game" button text, which was easily missed by users.

**Investigation:**
- Server sends `LOBBY_ERROR` message when start-game validation fails (e.g., "At least 2 players are required")
- Client previously handled this by temporarily changing button text in `WaitingRoom.ts` (lines 156-159)
- Button text change was subtle and easily overlooked, especially if user wasn't looking at the button
- Error appeared in the same location as normal button state changes

**Root Cause:** No dedicated error display area in waiting room modal. Error feedback was competing with normal UI state changes.

**Solution:** Added dedicated error display inside the waiting room modal:
- **WaitingRoom.ts**:
  - Added `errorEl: HTMLDivElement` property to store error message element
  - Created error element in constructor with initial `display: none`
  - Added `showError(message: string)` method to display errors
  - Added `clearError()` method to hide errors
  - Error automatically clears when player state updates (join/leave/ready)
  - Error clears when modal hides
- **index.html**:
  - Added `.waiting-room-error` CSS class with red theme
  - Styling: red background (rgba(248, 113, 113, 0.12)), red border, red text
  - Positioned above control buttons for immediate visibility
  - Center-aligned text for clear readability

**Key Decisions:**
- Display error inline within modal rather than as toast/alert (keeps context)
- Auto-clear on player updates (avoids stale errors)
- Used red styling to clearly indicate error state
- Positioned above controls so it's visible near the Start Game button

**Validation:**
- ✅ Build passes (all workspaces)
- ✅ Lint passes (0 new errors)
- ✅ Tests pass (259 passed, 12 todo)

**Files Changed:**
- `client/src/ui/WaitingRoom.ts` — error display logic
- `client/index.html` — error styling

**PR:** #102 (created to `dev`)

---

## 2026-01-13: Turn Timer Visibility Fix (Issue #100 / PR #101)

**Problem:** Turn countdown timer was not visible during gameplay despite HUD component having timer display code. Players had no indication of remaining turn time.

**Root Cause Analysis:**
1. **Server-side**: TurnManager tracked `remainingTurnTimeMs` internally but had no method to expose it
2. **Shared State**: BaseGameState schema had no field for turn time remaining
3. **State sync**: No mechanism to broadcast timer updates from server to clients
4. **Client-side**: GameScene initialized HUD with `showTimer: false` and never updated it

**Solution - End-to-End Timer Synchronization:**

**Shared State (`BaseGameState.ts`):**
- Added `turnTimeRemaining: number` field to schema (synced via Colyseus)
- Default value 0 when no timer active

**Server (`TurnManager.ts`):**
- Added `getRemainingTimeSeconds()` method to calculate current remaining time in seconds
- Handles active/paused states correctly
- Accounts for elapsed time since timer started
- Returns 0 when timer not active

**Server (`BaseGameRoom.ts`):**
- Added `updateTurnTimeRemaining()` private method that queries TurnManager and updates state
- Clock interval broadcasts updates every second: `this.clock.setInterval(() => this.updateTurnTimeRemaining(), 1000)`
- Called on game start, turn advance, and state sync
- Gracefully handles missing clock in tests (same pattern as endGame 6s delay)

**Client (`GameScene.ts`):**
- Added `extractTurnTimeRemaining(state)` helper to extract timer from state
- Updated `initHUD()` and `updateHUD()` to pass timer data to HUD
- Enables timer display when `turnTimeRemaining > 0`
- HUD automatically shows/hides based on timer value

**Timer Display Behavior:**
- Shows MM:SS format (e.g., "1:45")
- Updates every second via server broadcasts
- Turns red border/text when under 30 seconds
- Only visible when > 0 (games with turn limits)
- Works with pause/resume on disconnect/reconnect

**Key Architectural Decisions:**
- Used existing Colyseus state sync (no custom messages needed)
- Server is source of truth for time calculations
- Client-side countdown in HUD is for display smoothness only
- 1-second broadcast interval balances network traffic vs. responsiveness
- Null-safe clock checks for test compatibility

**Files Changed:**
- `shared/src/BaseGameState.ts` — Added turnTimeRemaining field
- `server/src/game/TurnManager.ts` — Added getRemainingTimeSeconds() method
- `server/src/game/BaseGameRoom.ts` — Timer sync every second, update on turn changes
- `client/src/scenes/GameScene.ts` — Extract and pass timer to HUD

**Validation:**
- ✅ Build passes (all workspaces)
- ✅ Lint passes (0 new errors, 15 pre-existing warnings)
- ✅ Tests pass (259 passed, 12 todo)

**PR:** #101 (merged to `dev`)

**Design Pattern Established:**
When adding real-time game state that needs client visibility:
1. Add field to shared state schema (BaseGameState or game-specific state)
2. Server updates field on relevant events (turn changes, actions, etc.)
3. Add clock interval if continuous updates needed (like countdown timers)
4. Client extracts from state in scene's state change handler
5. Pass to UI components for display

This pattern avoids custom message protocols and leverages Colyseus's built-in state synchronization.


---

## 2026-03-15: Lobby Event Message Log Implementation

**Task:** Add real-time activity feed to lobby showing lobby events  
**PR:** https://github.com/dkirby-ms/playgrid/pull/103  
**Branch:** feat/lobby-message-log

### What Was Built

**Server-Side Event Broadcasting (LobbyRoom.ts):**
- Added `LOBBY_LOG_EVENT` message type for broadcasting lobby events to all connected clients
- Created `broadcastLobbyEvent()` helper that adds timestamps and broadcasts to all clients
- Integrated event broadcasting into key lobby lifecycle events:
  - Player joins: "👋 PlayerName joined the lobby"
  - Player leaves: "👋 PlayerName left the lobby"
  - Game creation: "🎮 PlayerName created a GameType game"
  - Game starts: "🚀 GameName started"
  - Game finishes: "🏁 GameName finished" (when game room disposes)
  - Player joins game: "🎲 PlayerName joined GameName"

**Shared Types (lobbyTypes.ts):**
- `LOBBY_LOG_EVENT` constant for message type
- `LobbyLogEventType` union: player_joined, player_left, game_created, game_started, game_finished, player_joined_game
- `LobbyLogEntry` interface with timestamp, type, message, and optional metadata (playerName, gameName, gameType, winner)

**Client-Side Display (MessageLog.ts + LobbyScreen.ts):**
- Created `MessageLog` component class for rendering scrollable event feed
- Component features:
  - 50-message circular buffer to prevent memory bloat
  - Auto-scroll to bottom on new messages
  - Timestamp formatting (HH:MM format)
  - Clean HTML rendering with event-type-specific styling
- Integrated message log panel into lobby sidebar (below Online Players)
- Added `LOBBY_LOG_EVENT` message handler that feeds events to the log

**UI Styling (index.html):**
- Added `.message-log-panel`, `.message-log-content`, `.message-log-list` styles
- Custom scrollbar styling (thin, dark theme)
- Event-type-specific border colors via `.message-log-entry--{type}` classes:
  - player_joined: green (#22c55e)
  - player_left: gray (#71717a)
  - game_created: purple (#7c3aed)
  - game_started: orange (#f59e0b)
  - game_finished: blue (#3b82f6)
  - player_joined_game: light purple (#a855f7)
- Responsive layout with max-height (400px) to prevent panel from dominating sidebar

### Technical Notes

**Event Broadcasting Pattern:**
- Server broadcasts events to ALL connected clients (not just participants)
- Events include human-readable messages with emoji for visual scanning
- Metadata (playerName, gameName, gameType) included for potential future filtering/search

**Memory Management:**
- 50-message cap implemented client-side via array shift when exceeding limit
- No server-side history persistence (events are ephemeral, not stored)

**Testing:**
- Updated `lobby-pregame.test.ts` mock to include `LOBBY_LOG_EVENT` constant
- All 259 tests pass after changes
- No new lint warnings introduced

**Future Enhancement Opportunities:**
- Winner information on game_finished events (requires GameRoomDisposedMessage enhancement)
- Event filtering by type (show only game events, hide player joins/leaves)
- Persistent event history (store last N events in lobby state for late joiners)
- Click-to-join on game event messages

### Key Files Modified
- `shared/src/lobbyTypes.ts` — Added event types and interfaces
- `server/src/rooms/LobbyRoom.ts` — Added event broadcasting to lifecycle hooks
- `client/src/ui/MessageLog.ts` — New component for rendering event feed
- `client/src/ui/LobbyScreen.ts` — Integrated message log panel and handler
- `client/index.html` — Added CSS styles for message log UI
- `server/src/__tests__/lobby-pregame.test.ts` — Updated mock for new constant

**Status:** ✅ Feature complete, PR created to dev branch

### 2026-03-15: Shared in-game status panel for renderer HUDs

- Refactored `client/src/ui/HUD.ts` into a single reusable status panel pattern that groups status copy, the turn clock, and player roster in one card instead of scattering them across separate overlay widgets.
- Added optional `getHUDStatus()` support to the `GameRenderer` contract so individual renderers can feed game-specific status copy and accents into the shared panel without coupling `GameScene` to per-game rules.
- `client/src/renderers/CheckersRenderer.ts` is the first adopter: the old canvas status copy moved into the shared HUD while the board keeps only board-specific counters and the game-over overlay.
- Adoption path for future games is now: keep roster/timer in `HUD`, implement `getHUDStatus()` in the renderer when a game needs custom turn/state text, and leave renderer-owned canvas HUD elements for board-specific info only.

## Cross-Agent Update — Features Batch 2 (2026-03-15T21:26:56Z)

**From:** Squad Scribe  
**Event:** Session completed — 3 features landed with git history

**What Happened:**

Three background agents (Gately agents 9-10, Pemulis agent 11) completed UX polish batch:

1. **Shared HUD status panel** (agent-9) — Consolidated game status (turn, players, timer) into `HUD.ts` overlay instead of per-game canvas copy. Checkers migrated. Commit df7ad2f.
2. **Design-aligned lobby thumbnails** (agent-10) — Replaced SVG tiles with extracted design prototype images in `client/public/game-thumbnails/`. Commit 232a3ce.
3. **Shareable waiting-room links** (agent-11) — Added `?join={gameId}` parameter with copy-link button and auto-join on boot. Commit 2dc2725.

**What This Means for You:**

All three decisions are now merged into `.squad/decisions.md` and archived from inbox. The HUD status panel pattern is ready for Phase 2/3 adoption.

**For Your Phase 3 Work:**

Risk game plugin (rendering phase) now has a stable HUD contract: implement `getHUDStatus()` on `RiskRenderer` to opt into the shared status panel, just like Checkers did. The optional method keeps the HUD functional for games that don't implement it yet.

**Validation:**

- ✅ All commits pass `npm run build && npm run lint && npm run test`
- ✅ Lobby rendering verified with thumbnail images
- ✅ Waiting room UX functional (copy link, auto-join)
- ✅ Game HUD tested in Checkers player + spectator modes
- ✅ No regressions in existing reconnect/scene/renderer flows

**Session Artifacts:**

- `.squad/orchestration-log/2026-03-15T21-26-56Z-{gately-9,gately-10,pemulis-11}.md` — Individual agent outcomes
- `.squad/log/2026-03-15T21-26-56Z-features-batch-2.md` — Session summary


---

## Learnings

### Checkers Piece Visual Enhancement (2025)

**File Path:** `client/src/renderers/CheckersRenderer.ts`

**Architecture Pattern: PixiJS v8 FillGradient for 3D Effects**

Replaced flat-colored checkers pieces with polished tactile-looking pieces using PixiJS v8 `FillGradient` API with radial gradients. Key implementation details:

1. **Gradient Creation Efficiency:** Created gradients ONCE before the piece loop, then selected the appropriate gradient (black or red) inside the loop based on piece type. This avoids recreating gradient objects for every piece.

2. **3D Dome Effect:** Used radial gradients with offset center point `{ x: 0.42, y: 0.38 }` to simulate lighting from upper-left, creating a dome/sphere appearance. Three color stops: highlight (offset 0), base color (offset 0.5), shadow (offset 1).

3. **Drop Shadow:** Added subtle drop shadow by drawing a slightly offset (centerX + 2, centerY + 3) and larger (radius * 1.05) dark circle behind each piece with 35% alpha.

4. **Specular Highlight Ring:** Added white semi-transparent ring at top of piece (centerY - pieceRadius * 0.15) with 60% of piece radius for specular highlight effect.

5. **King Marker Enhancement:** Replaced plain "K" text with crown emoji "♛" and added drop shadow effect to the text for better visual depth.

6. **Color Constants:** Used existing constants (`BLACK_PIECE_COLOR`, `BLACK_PIECE_HIGHLIGHT`, `BLACK_PIECE_SHADOW`, etc.) and converted to CSS hex strings via `toCssHexColor()` helper for gradient colorStops compatibility.

**User Preference:** Prioritize visual polish and tactile feel in game pieces. Gradient effects and drop shadows preferred over flat colors.

**Pattern Reusability:** This FillGradient radial gradient pattern can be applied to other game pieces (Risk armies, Connect4 pieces, etc.) for consistent visual quality across games.

### 2026-03-16: Shared turn clocks belong in the sidebar, not the HUD overlay

- `client/src/ui/HUD.ts` can keep ownership of the countdown interval without rendering any game-status DOM by exposing timer ticks through `onTimerChange(...)`.
- `client/src/scenes/GameScene.ts` is the clean bridge for shared turn clocks: feed it `turnTimeRemaining` from Colyseus once, then forward ticks to renderer-specific sidebars through the optional `setTurnClock()` hook.
- `client/src/ui/GameSidebar.ts` should own the turn-clock formatting and badge styling so Checkers, Risk, and Backgammon all get the same glass-panel treatment and low-time warning colors.

## Cross-Agent Update — Checkers Piece Visual Polish (2026-03-15T23:36:21Z)

**From:** Squad Scribe  
**Event:** Agent completed — CheckersRenderer enhanced with 3D gradient pieces

**What Happened:**

Gately (Game Dev) completed visual enhancement to checkers pieces:

- Replaced flat-colored pieces with PixiJS v8 `FillGradient` radial gradients
- Added 3D dome effect with offset center `{ x: 0.42, y: 0.38 }`
- Added drop shadow layer for depth perception
- Added specular highlight ring for shininess
- Replaced "K" text king markers with crown emoji (♛)
- Pattern optimized: gradients created once outside loop, selected inside

**Decision Captured:**

**PixiJS FillGradient Pattern for Game Piece Rendering** — Approved. This pattern is now the standard for all circular game pieces (Risk armies, Connect4, Go stones, Poker chips).

**Validation:**

- ✅ Build passes (`npm run build && npm run lint && npm run test`)
- ✅ Pieces render with 3D tactile appearance
- ✅ No performance regressions

**For Your Future Work:**

Risk renderer rendering phase can now adopt this pattern for armies/territories. Geometry applies to any circular game element.

**Session Artifacts:**

- `.squad/orchestration-log/2026-03-15T23-36-21Z-gately.md` — Orchestration outcome
- `.squad/log/2026-03-15T23-36-21Z-checkers-piece-gradients.md` — Session summary
- `.squad/decisions.md` — FillGradient pattern decision merged

### 2026-03-16: Risk HUD state sync must fail soft

- `client/src/renderers/RiskRenderer.ts` can render HUD text before Colyseus finishes syncing `currentTurn` and `turnPhase`, so text helpers must never forward those fields directly into Pixi `Text.text`.
- Prefer safe helper defaults over an `updateHUD()` early return here: blank labels clear the HUD during hydration instead of leaving stale status text from an older frame or session.
- Pixi's `addChild` deprecation warning in this renderer comes from `graphic.addChild(armyText)` and `graphic.addChild(nameText)` inside `redrawMap()`, where `Text` children are attached directly to `Graphics` territory nodes.
- Validation for this fix: `npm run build` and `npm run test` both passed after the HUD safeguards landed.

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

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
### 2026-03-14: Client Architecture Research

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
### 2026-03-14: Client Architecture Research

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

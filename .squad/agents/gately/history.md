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


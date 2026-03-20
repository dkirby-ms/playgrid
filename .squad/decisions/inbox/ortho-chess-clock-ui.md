# Chess Clock UI Implementation — Checkers Game

**Date:** 2026-03-20  
**Agent:** Ortho (Frontend Dev)  
**Issue:** #165 — Feature Request: Checkers Game Clock (Chess Clock Style)  
**Design Spec:** `.squad/decisions/inbox/mario-chess-clock-design-spec.md`  
**Status:** Complete ✅

## Overview

Implemented the chess clock UI for the Checkers game with two display locations:
1. **Game Clock sidebar panel** — Dedicated panel showing both players' clocks stacked vertically
2. **Player info bars** — Per-player time display in the bars above/below the board

The server-side implementation (by Pemulis) adds `player1TimeRemainingMs` and `player2TimeRemainingMs` fields to CheckersState. The client UI is now ready to display these values.

## Architecture Decisions

### 1. Data Flow Pattern

```
Server CheckersState 
  → { player1TimeRemainingMs, player2TimeRemainingMs }
  → Colyseus auto-sync
  → CheckersRenderer.applyState() extracts times
  → updateChessClockPanel() generates HTML
  → GameSidebar.updatePanel("game-clock", markup)
```

For player info bars:
```
GameScene.updatePlayerInfoBars()
  → buildPlayerInfoData() checks gameType === "checkers"
  → extractChessClockTime(state, playerIndex)
  → PlayerInfoBar.update({ timerSeconds })
```

### 2. Sidebar Panel Placement

The "Game Clock" panel is inserted as the 4th panel in this order:
1. Game Info (turn, piece counts, status)
2. **Game Clock** (new)
3. Move History
4. Controls

**Rationale:** Logically groups game state → clock → history → actions. Clock is more important than history for active gameplay.

### 3. Active Player Detection

- Use `state.currentTurn` (session ID) → look up in `this.players` map → check `player.playerIndex`
- Black pieces = player index 0 = `player1TimeRemainingMs`
- Red pieces = player index 1 = `player2TimeRemainingMs`

### 4. Critical Time Threshold

- **Normal state:** Time ≥ 60 seconds
- **Critical state:** Time < 60 seconds
  - Text color: `var(--pg-red-400)` (bright red)
  - Border: Changes from blue to red
  - Animation: Faster pulse (1s instead of 2s)

### 5. PlayerInfoBar Time Display Change

**Before:** Timer only shown for the active player (turn timer)  
**After (Checkers only):** Timer shown for BOTH players at all times (chess clock)

This required updating `GameScene.buildPlayerInfoData()` to check `gameType === "checkers"` and extract per-player time instead of just active turn time.

### 6. Design Token Reuse

All colors from the Figma design mapped directly to existing CSS custom properties in `design-tokens.css`:

| Figma Design | CSS Custom Property | Usage |
|---|---|---|
| `from-slate-700 to-slate-800` | `--pg-slate-700`, `--pg-slate-800` | Active clock gradient background |
| `ring-2 ring-blue-400` | `--pg-blue-400` | Active clock border (2px solid) |
| `text-red-400` | `--pg-red-400` | Critical time text color |
| `bg-green-500 animate-pulse` | `--pg-green-500` | Active indicator pulsing dot |
| `bg-slate-900/50` | `--bg-card-dark` | Inactive clock background |
| `text-slate-400` | `--pg-slate-400` | Player name label |
| `text-white` | `--text-primary` | Clock time display |

**Zero new design tokens were needed.**

## CSS Classes Added

All classes added to `client/src/ui/GameSidebar.ts`:

- `.sidebar-clock-container` — Flex column container with gap
- `.sidebar-clock-item` — Individual clock card (inactive state)
- `.sidebar-clock-item--active` — Active player clock (blue border, glow, animation)
- `.sidebar-clock-item--critical` — Critical time state (red border, red background tint)
- `.sidebar-clock-time` — Clock time display (2rem, monospace, tabular-nums)
- `.sidebar-clock-time--critical` — Critical time text (red color, bold)
- `.sidebar-clock-indicator` — Pulsing green dot (8×8px circle)
- `.sidebar-clock-player-name` — Player name label above clock time

## Animations

Three keyframe animations added:

1. **`sidebar-clock-pulse`** (2s ease-in-out infinite)
   - Target: `.sidebar-clock-indicator` (green dot)
   - Effect: Opacity pulse + box-shadow glow

2. **`sidebar-clock-highlight`** (2s ease-in-out infinite)
   - Target: `.sidebar-clock-item--active`
   - Effect: Box-shadow glow pulse (16px → 24px)

3. **`sidebar-clock-pulse-fast`** (1s ease-in-out infinite)
   - Target: `.sidebar-clock-item--active.sidebar-clock-item--critical .sidebar-clock-indicator`
   - Effect: Faster red pulse for critical state

All animations respect `@media (prefers-reduced-motion: reduce)` and are disabled in that case.

## Helper Functions

### `getChessClockMarkup()` in GameSidebar.ts

```typescript
getChessClockMarkup(
  player1TimeMs: number,
  player2TimeMs: number,
  activePlayerIndex: number,
  player1Name: string,
  player2Name: string,
): string
```

- Converts milliseconds to seconds (Math.ceil)
- Determines active/inactive state based on activePlayerIndex
- Determines critical state (< 60 seconds)
- Generates HTML with conditional CSS classes
- Returns complete markup string for the chess clock panel

### `extractChessClockTime()` in GameScene.ts

```typescript
extractChessClockTime(state: unknown, playerIndex: number): number | null
```

- Safely casts state to `Record<string, unknown>`
- Returns `player1TimeRemainingMs` for playerIndex === 0
- Returns `player2TimeRemainingMs` for playerIndex === 1
- Returns null if field not found or invalid playerIndex

## Files Modified

- ✅ `client/src/ui/GameSidebar.ts` — CSS classes, animations, `getChessClockMarkup()` helper
- ✅ `client/src/renderers/CheckersRenderer.ts` — State extraction, panel update, `getPlayerByIndex()` helper
- ✅ `client/src/scenes/GameScene.ts` — Per-player time extraction for checkers, `extractChessClockTime()` helper
- ✅ `client/src/ui/PlayerInfoBar.ts` — No changes (already supports timerSeconds)

## Testing Notes

**Manual Testing:**
1. Start a checkers game (2 players)
2. Verify "Game Clock" panel appears in sidebar (4th panel)
3. Verify both player clocks display with initial time (10:00)
4. Verify active player clock has blue border, glow, and pulsing green dot
5. Verify inactive player clock has dark background, no animation
6. Make a move → verify active clock switches to other player
7. (Once server logic is complete) Verify times count down correctly
8. (Once server logic is complete) Verify critical state (< 60s) shows red text, red border, faster pulse

**Integration:**
- Server must implement `player1TimeRemainingMs` and `player2TimeRemainingMs` fields in CheckersState
- Server must decrement active player's time on each turn
- Server should send state updates frequently enough for smooth countdown (recommend every 1s)

## Future Considerations

1. **Sound effects:** Could add tick sound for critical state (< 10 seconds)
2. **Time increment modes:** Fischer clock, Bronstein delay (requires server changes)
3. **Time presets:** Different time controls (5+0, 3+2, etc.) in game setup
4. **Other games:** Risk, Backgammon could also benefit from chess clock system

## Decision Record

**What:** Chess clock UI implementation for Checkers  
**Why:** Player requested feature (#165) to add time pressure and improve competitive play  
**How:** New sidebar panel + player info bar time display + CSS animations  
**Impact:** Client UI ready; waiting on server-side chess clock logic (Pemulis)  
**Reviewed:** Mario (design spec), Ortho (implementation)  
**Status:** Complete ✅  
**Build:** ✅ Pass | **Lint:** ✅ Pass

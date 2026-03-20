# Chess Clock Architecture for Checkers

**Author:** Hal (Lead)  
**Date:** 2026-03-20  
**Status:** Proposed  
**Context:** Figma design shows chess-style game clock (cumulative time banks per player) for Checkers

---

## Problem

Current `turnTimeRemaining` is a per-turn countdown that resets each turn. Chess clock = cumulative time bank per player that depletes across entire game.

---

## Schema Changes

**Location:** `shared/src/games/checkers/CheckersState.ts` (checkers-specific, not BaseGameState)

Add two new fields:
```typescript
declare player1TimeRemainingMs: number;  // Player 0's time bank (ms)
declare player2TimeRemainingMs: number;  // Player 1's time bank (ms)
```

**Rationale:** Checkers-specific fields keep BaseGameState generic. Other games may never use chess clocks (Risk uses phased turns, Dominos is async).

---

## Configuration

**Location:** `server/src/games/checkers/CheckersPlugin.ts`

Add new config object in plugin:
```typescript
chessClockConfig: {
  enabled: boolean;           // Default: false (MVP feature flag)
  initialTimeBankMs: number;  // Default: 600000 (10 minutes)
}
```

**Rationale:** Plugin-level config keeps it game-specific. Can extend to `TurnTimerConfig` later if other games need it. MVP hardcodes 10min banks; room setup UI deferred to P7+.

---

## Server Logic

**Location:** `server/src/game/BaseGameRoom.ts` (new methods) + `server/src/games/checkers/CheckersPlugin.ts` (lifecycle hook)

### Tick Mechanism
- **Where:** New `onTick()` lifecycle hook in CheckersPlugin (called from BaseGameRoom's existing `setInterval` at 1Hz)
- **What:** Decrement active player's time bank by 1000ms per second
- **Switch:** When `processAction()` completes successfully and `endsTurn=true`, reset turn timer, switch active clock

### Timeout Handling
- **Trigger:** When active player's time bank reaches 0
- **Action:** Call existing `handleTurnTimeout()` → apply penalty (auto-pass or forfeit per `TurnTimerConfig`)
- **Fallback:** If no `TurnTimerConfig`, auto-forfeit

**Pseudo-code:**
```typescript
// CheckersPlugin.lifecycle.onTick
onTick(state: CheckersState, deltaMs: number) {
  if (state.phase !== 'playing' || !chessClockConfig.enabled) return;
  
  const currentPlayer = state.players.get(state.currentTurn);
  if (!currentPlayer) return;
  
  if (currentPlayer.playerIndex === 0) {
    state.player1TimeRemainingMs = Math.max(0, state.player1TimeRemainingMs - deltaMs);
    if (state.player1TimeRemainingMs === 0) {
      // Trigger timeout via BaseGameRoom callback
    }
  } else {
    state.player2TimeRemainingMs = Math.max(0, state.player2TimeRemainingMs - deltaMs);
    // Same timeout logic
  }
}
```

---

## Client Display

### Data Flow
1. **State sync:** CheckersState schema fields auto-sync to client via Colyseus
2. **GameScene → PlayerInfoBar:** Existing `updatePlayerInfoBars()` already pulls `turnTimeRemaining` for active player; extend to pull per-player time banks from CheckersState
3. **New Sidebar Panel:** GameSidebar.addPanel("chess-clock", ...) with two stacked clocks

### Rendering
- **PlayerInfoBar:** Show per-player time bank (not turn timer) when chess clock enabled
- **Sidebar:** New "Game Clock" panel with two rows:
  - Player 1 (Black): time remaining, active ring if currentTurn = player1
  - Player 2 (Red): time remaining, active ring if currentTurn = player2
- **Critical state:** Red text when < 60s (reuse existing `sidebar-turn-clock--critical` CSS)

**Location:** `client/src/scenes/GameScene.ts` (bridge logic), `client/src/ui/GameSidebar.ts` (panel markup), `client/src/ui/PlayerInfoBar.ts` (per-player display)

---

## Scope

### MVP (This PR)
- Schema fields in CheckersState
- Config flag in CheckersPlugin (default: false)
- Server tick logic (onTick hook)
- Timeout handling (reuse existing penalty system)
- Client display (sidebar panel + player info bars)

### Deferred (Future PRs)
- Time increments (Fischer clock: +Xs per move)
- Configurable time in room setup UI
- Generalize to BaseGameState (if other games need it)
- Spectator-friendly time formatting (hours:minutes)

---

## Files to Change

### Shared
- `shared/src/games/checkers/CheckersState.ts` — Add player1TimeRemainingMs, player2TimeRemainingMs fields

### Server
- `server/src/games/checkers/CheckersPlugin.ts` — Add chessClockConfig, implement onTick hook
- `server/src/game/BaseGameRoom.ts` — Add onTick interval call (if not already present), wire timeout callback

### Client
- `client/src/scenes/GameScene.ts` — Extract per-player time banks, pass to PlayerInfoBar + Sidebar
- `client/src/ui/GameSidebar.ts` — Add chess clock panel markup generator
- `client/src/ui/PlayerInfoBar.ts` — Display per-player time bank (when chess clock enabled)

---

## Open Questions

1. **Pause on disconnect?** Current turn timer pauses on reconnection timeout. Should chess clock also pause?  
   **Recommendation:** Yes — use existing `pauseTurnTimerFor()` logic to also pause time bank depletion.

2. **Persist time banks in DB?** Current system doesn't persist in-progress games.  
   **Recommendation:** No — out of scope for MVP. Reconnection within 30s keeps state in memory.

3. **UI toggle for chess clock?** Feature flag in code or user-facing toggle?  
   **Recommendation:** Code flag for MVP (hardcoded `enabled: false`). UI toggle in P7+ room setup.

---

## Testing Strategy

- **Unit tests:** CheckersPlugin.onTick logic (time depletion, timeout trigger)
- **E2E tests:** Grey-box test with `__PLAYGRID_E2E__.app.gameRoom.state.player1TimeRemainingMs` assertions
- **Manual test:** Enable flag, play game, verify clocks count down and switch correctly

---

## Risk Assessment

**Low Risk:**
- Additive changes only (no breaking changes to existing turn timer)
- Feature flag prevents accidental activation
- Reuses existing timeout/penalty infrastructure

**Medium Risk:**
- Client-side complexity in GameScene (per-player time extraction)
- Sidebar panel z-order conflicts (mitigated by existing glass-panel stacking)

**Mitigation:**
- Phased rollout: Server logic first, client display second
- Reuse existing timer CSS classes (no new design system patterns)

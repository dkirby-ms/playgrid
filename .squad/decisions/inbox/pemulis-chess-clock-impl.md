# Decision: Checkers Chess Clock Server Implementation

**Date:** 2026-01-XX  
**Author:** Pemulis (Systems Dev)  
**Status:** ✅ Implemented  
**Related:** Issue #165, hal-chess-clock-architecture.md

## Context

Implemented the server-side chess clock logic for Checkers per Hal's architecture proposal. This adds per-player time banks (10 minutes each) with tick-based countdown, timeout detection, and automatic pause on disconnect.

## Decision

### Schema Changes

Added two fields to `CheckersState` (NOT BaseGameState):
```typescript
@type("number") player1TimeRemainingMs: number = 600000;
@type("number") player2TimeRemainingMs: number = 600000;
```

These fields are:
- Synced to all clients via Colyseus schema
- Initialized in CheckersState constructor with 10-minute defaults
- Registered in defineTypes with `"number"` type

### Plugin Configuration

Added constants to CheckersPlugin:
- `CHESS_CLOCK_ENABLED = true` — Feature flag (enabled by default)
- `INITIAL_TIME_BANK_MS = 600000` — 10 minutes per player

### Lifecycle Hooks

**onGameStart:**
- Initializes both player clocks to INITIAL_TIME_BANK_MS
- Runs once at game start after player indices are assigned

**onTick:**
- Checks phase === "playing" before ticking
- Gets current player via state.currentTurn
- Pauses if player.isConnected === false (reuses existing reconnection pattern)
- Decrements active player's clock by deltaTime
- Uses Math.max(0, clock - deltaTime) to prevent negatives
- Maps currentTurn sessionId → playerIndex to determine which clock field to update

### Game End Detection

Modified `checkGameEnd` condition:
- Checks clock timeouts BEFORE checking board win conditions
- When a clock hits 0, returns GameResult with:
  - `type: "timeout"`
  - `winnerId` set to the other player
  - `metadata.reason: "chess_clock_timeout"`
  - `metadata.timedOutPlayerId` for the losing player
- Existing board-based win conditions remain unchanged

### Clock Switching

No explicit switching logic needed:
- Clock automatically switches when `currentTurn` changes
- This happens after processAction completes with `endsTurn: true`
- The next tick reads the new currentTurn and decrements the correct clock

### Integration with BaseGameRoom

Zero changes to BaseGameRoom required:
- Existing `setSimulationInterval` already calls plugin.lifecycle.onTick when defined
- Tick interval already set up in BaseGameRoom.onCreate (lines 108-112)
- deltaTime parameter already provided to onTick

## Rationale

### Why ENABLED constant instead of config?
- Hal's proposal suggested `chessClockConfig: { enabled: true }` but implementation uses a top-level constant
- Simpler for a checkers-only feature with no runtime configuration needs
- Easy to convert to plugin config object later if other games need chess clocks

### Why check phase === "playing"?
- Prevents clocks from ticking during "waiting" or "ended" phases
- Consistent with existing turn timer behavior
- No wasted CPU cycles on games that haven't started

### Why pause on disconnect?
- Reuses existing reconnection pattern (30-second window)
- Fair: players shouldn't lose time while trying to reconnect
- Implemented via simple `!player.isConnected` check in onTick

### Why timeout check in checkGameEnd vs onTick?
- checkGameEnd is called after every action AND on periodic checks
- Ensures timeout is detected even if no actions occur
- Consistent with other game-end conditions (board wins, disconnects)
- BaseGameRoom's flow already handles GameResult and calls plugin.onGameEnd

## Files Modified

1. **shared/src/games/checkers/CheckersState.ts**
   - Added player1TimeRemainingMs and player2TimeRemainingMs fields
   - Added schema decorators and defineTypes entries

2. **server/src/games/checkers/CheckersPlugin.ts**
   - Added CHESS_CLOCK_ENABLED and INITIAL_TIME_BANK_MS constants
   - Implemented onGameStart clock initialization
   - Implemented onTick clock decrement with disconnect pause
   - Modified checkGameEnd to detect timeouts

## Validation

- ✅ Build passes (`npm run build`)
- ✅ All tests pass (`npm run test`)
- ✅ No lint violations introduced
- ✅ Schema fields sync correctly to clients (verified by successful build with Colyseus schema compiler)

## Next Steps

**Client Integration (Gately's domain):**
- Display both clocks in CheckersRenderer
- Format milliseconds as MM:SS
- Visual indicator for active player's clock
- Warning state when clock < 60 seconds
- Handle timeout GameResult with appropriate UI

**Testing:**
- E2E test for clock countdown
- E2E test for timeout victory
- E2E test for pause on disconnect
- Unit tests for onTick edge cases

**Future Enhancements:**
- Optional increment-per-move (Fischer clock)
- Configurable time banks via room options
- Chess clock support for other 2-player games (Backgammon, Dominoes)

## Notes

- Clock values are in milliseconds for precision (deltaTime from setSimulationInterval is in ms)
- Default 10-minute time banks match common online chess clock settings
- No Fischer clock increment in this implementation (can add later if needed)
- Feature is additive — does not affect existing turn timer functionality
- Chess clock is independent of turn timer (both can coexist)

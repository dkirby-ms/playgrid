# Chess Clock System Generalized to Base Layer

**Author:** Pemulis  
**Date:** 2026-03-20  
**Status:** Implemented  
**Context:** Issue #165 — Feature Request: Checkers Game Clock (Chess Clock Style)

## Decision

The chess clock system has been refactored from a checkers-specific implementation to a generic base-layer feature that any 2-player game can opt into via plugin configuration.

## Implementation Details

### Schema Changes (shared/)
- **BaseGameState.ts**: Added `player1TimeRemainingMs` and `player2TimeRemainingMs` fields (default 0)
- **CheckersState.ts**: Removed chess clock fields (now inherited from BaseGameState)

### Plugin Interface (shared/)
- **gamePlugin.ts**: Added `chessClockConfig?: ChessClockConfiguration` to GamePlugin interface
  ```typescript
  export interface ChessClockConfiguration {
    enabled: boolean;
    initialTimeBankMs: number;
  }
  ```

### Server Logic (server/)
- **BaseGameRoom.ts**:
  - Added `updateChessClocks(deltaTime)` method (called via separate simulation interval)
  - Added `checkChessClockTimeout()` method (called after action processing)
  - Initialize clock values in `startGame()` based on plugin config
  - Clock automatically pauses when player disconnects (checks `isConnected`)
- **CheckersPlugin.ts**:
  - Removed `CHESS_CLOCK_ENABLED` and `INITIAL_TIME_BANK_MS` constants
  - Removed `onTick` lifecycle hook (logic moved to BaseGameRoom)
  - Removed chess clock timeout check from `checkGameEnd` (logic moved to BaseGameRoom)
  - Added `chessClockConfig` declaration:
    ```typescript
    chessClockConfig: {
      enabled: true,
      initialTimeBankMs: 600000, // 10 minutes
    }
    ```

### Client Changes (client/)
- **GameScene.ts**: Made chess clock detection generic
  - Instead of `if (this.gameType === "checkers")`, checks if `chessClockTime !== null && chessClockTime > 0`
  - Works for ANY game that has chess clock enabled

### Tests (server/)
- **chess-clock.test.ts**: Updated to reflect new architecture
  - Schema fields now default to 0 (BaseGameRoom sets actual values based on config)
  - Test comments updated to reference BaseGameRoom instead of CheckersPlugin
  - All 26 tests pass

## Rationale

The original implementation hardcoded chess clock logic into CheckersPlugin. This violated the principle of "design for reusability" — when we later want chess clocks in Backgammon or other 2-player games, we'd have to duplicate the same logic.

By moving the chess clock to the base layer:
1. **DRY**: Clock tick/timeout logic lives in one place (BaseGameRoom)
2. **Opt-in**: Games enable via `chessClockConfig`, not code duplication
3. **Extensible**: Future games (Backgammon, Go, etc.) can use chess clocks without server changes
4. **Type-safe**: Config is part of the plugin interface, validated at compile time

## Alternatives Considered

1. **Keep it checkers-specific**: Rejected — would require duplication for other games
2. **Make it a separate plugin/addon**: Rejected — too heavy, chess clock is a simple timer feature
3. **Add to turnConfig**: Rejected — chess clock is orthogonal to turn timers (different semantics)

## Impact

- **No breaking changes**: Existing CheckersPlugin behavior unchanged for end users
- **Future-proof**: ANY 2-player game can now opt into chess clocks
- **Validation**: All tests pass (773 tests including 26 chess clock-specific tests)
- **Build**: Clean build with no errors

## Files Modified

**Shared:**
- `shared/src/BaseGameState.ts` — Added clock fields
- `shared/src/games/checkers/CheckersState.ts` — Removed clock fields
- `shared/src/gamePlugin.ts` — Added ChessClockConfiguration interface

**Server:**
- `server/src/game/BaseGameRoom.ts` — Added clock tick/timeout logic
- `server/src/games/checkers/CheckersPlugin.ts` — Added config, removed onTick/timeout logic

**Client:**
- `client/src/scenes/GameScene.ts` — Made chess clock detection generic

**Tests:**
- `server/src/__tests__/chess-clock.test.ts` — Updated for new architecture

## Next Steps

Future games (Backgammon, Go, etc.) can enable chess clocks by adding:
```typescript
chessClockConfig: {
  enabled: true,
  initialTimeBankMs: 600000,
}
```

No server-side code changes needed!

### Pemulis: Extensible Turn Timer with Penalty Escalation

**Status:** Proposed  
**Date:** 2026-03-19  
**PR:** #159  
**Issue:** #148 (sub-item 2)

Replace the hard instant-loss turn timeout with a configurable penalty escalation chain. Plugins opt in via `turnTimerConfig` on `TurnConfiguration`.

**Design decisions:**

1. **Penalty escalation is plugin-configured, not hardcoded.** Each game defines its own ordered `penalties[]` array. The framework applies them by index on successive timeouts, repeating the last penalty when exhausted. This keeps the timer system generic for any turn-based game.

2. **`onAutoPass` returns boolean for control flow.** `false` = framework advances turn (default). `true` = plugin handled it, same player keeps turn with timer reset. This supports phased games like Risk where auto-pass may only skip a phase, not the whole turn.

3. **Per-player timeout tracking with configurable reset scope.** `resetCountPerTurn: true` clears a player's timeout count when their turn ends, giving them fresh warnings each turn. Default (`false`) accumulates across the game for stricter escalation.

4. **Client state via schema + broadcast messages.** `timerWarningActive` boolean on `BaseGameState` lets clients show warning indicators via schema sync. `turn-timer-warning` broadcast messages carry the specific warning text. No new schema classes needed.

5. **`TurnManager.resetTimer()` added for warning penalties.** Restarts the timer for the current player without advancing turns. Keeps TurnManager's API clean and testable.

**Risk configuration:** 90s turns, [warning, final warning, auto-pass]. Risk's `onAutoPass` auto-places remaining reinforcements, resolves pending capture-moves, and resets turn phase to reinforce.

**Backward compatible:** Games without `turnTimerConfig` use the existing `turnTimeLimit` with instant-loss behavior unchanged.

**Impact:**
- Shared types: `TurnTimerConfig`, `TurnTimerPenalty`, `onAutoPass` lifecycle hook
- Server: `BaseGameRoom` penalty engine, `TurnManager.resetTimer()`
- Risk: Turn timer config + auto-pass handler
- Client: Can consume `timerWarningActive` and `turn-timer-warning` messages (no client changes in this PR)

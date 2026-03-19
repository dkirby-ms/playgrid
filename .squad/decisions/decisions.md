# Decision Log

> Canonical merged decisions from all squad agents. Updated continuously. New entries appended at top.

---

## [2026-03-19] Fix #161: Adopt fake timers for setTimeout-based tests
**Decision:** When testing async code that uses `clock.setTimeout()` (Colyseus timers), always initialize with `vi.useFakeTimers()` before the test and advance time past expected delays with `vi.advanceTimersByTime()`.

**Rationale:** PR #159 refactored turn timer logic, wrapping `endGame().disconnect()` in a 6-second deferred callback. Tests without fake timers couldn't trigger the callback, causing timeouts. Five tests required this fix.

**Owner:** Pemulis  
**Status:** Implemented (commit 266e002)  
**Impact:** Ensures timer-based game logic is reliably testable going forward.

---

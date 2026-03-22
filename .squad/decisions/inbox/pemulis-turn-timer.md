### Pemulis: Reusable Turn Timer System

**Status:** Implemented
**Date:** 2026-03-19
**PR:** (pending — squad/148-turn-timer)
**Issue:** #148

Implemented a reusable per-turn timer with escalating penalties for all turn-based games.

**Architecture:**
- **Module:** Standalone `TurnTimer` class using Colyseus `clock.setInterval` (NOT setTimeout/setInterval)
- **Configuration:** New `TurnTimerConfiguration` interface on `GamePlugin` — each game opts in independently
- **State sync:** `turnTimeRemaining`, `timerWarningActive`, `turnTimeoutCount` on `BaseGameState` for client countdown UI
- **Escalation:** Timeouts 1..(maxTimeouts-1) → warning + timer reset; timeout at maxTimeouts → auto-pass or forfeit (configurable)
- **Integration:** BaseGameRoom creates/starts/resets/pauses/resumes/stops the timer at each turn lifecycle point

**Rationale:**
- Previous behavior: chess clock timeout → immediate game loss. Unacceptable UX for casual multiplayer (Risk, Dominos).
- Turn timer is complementary to chess clock: per-turn countdown with grace periods vs. cumulative time bank.
- Standalone class keeps BaseGameRoom from growing further, mirrors TurnManager pattern.
- Colyseus clock ensures proper server-side timing without setTimeout drift.
- Escalating penalties give players fair warning before consequences.

**Alternatives Considered:**
- Inline in BaseGameRoom — Rejected: would bloat the room class, harder to test in isolation
- Modify chess clock to add per-turn limits — Rejected: different concerns (cumulative vs per-turn)
- Client-side timers — Rejected: must be server-authoritative per project conventions

**Risk wiring (proof of concept):**
- 120s per turn, 15s warning threshold, 3 timeouts → auto-pass
- Coexists with existing chess clock (total time bank)

**Impact:**
- Any turn-based game can add `turnTimerConfig` to opt in
- Clients can read `turnTimeRemaining` / `timerWarningActive` / `turnTimeoutCount` for UI
- `turn-timer-warning` message broadcast for client-side notification display
- No breaking changes — fully optional, backward compatible

**Files:**
- `server/src/game/TurnTimer.ts` (new module)
- `server/src/__tests__/TurnTimer.test.ts` (22 new tests)
- `shared/src/gamePlugin.ts` (TurnTimerConfiguration interface)
- `shared/src/BaseGameState.ts` (turnTimeoutCount field)
- `shared/src/index.ts` (export)
- `server/src/game/BaseGameRoom.ts` (integration)
- `server/src/games/risk/RiskPlugin.ts` (proof of concept wiring)

# Decision: `onTurnStarted` lifecycle hook

**Author:** Pemulis  
**Date:** 2026-03-16  
**Status:** Implemented  

## Context

The Risk plugin had a reinforcement calculation bug: reinforcements were computed for the wrong player during turn transitions. The root cause was that `endPhase` calculated reinforcements before returning `endsTurn: true`, which then advanced the turn to a different player.

## Decision

Added `onTurnStarted?(state: TState, newPlayerId: string): void` to the `GameLifecycle` interface. `BaseGameRoom.advanceTurn()` calls it after the turn advances. This gives plugins a reliable hook for per-turn initialization that fires for the correct player.

## Impact

- **RiskPlugin** uses it to calculate reinforcements, reset `turnPhase` to "reinforce", and clear `earnedCardThisTurn`.
- **Other plugins** (Checkers, Backgammon) are unaffected — the hook is optional.
- **Future games** can use this for any per-turn setup (deal cards, reset timers, etc.) without coupling to action handlers.

## Files Changed

- `shared/src/gamePlugin.ts` — added `onTurnStarted` to `GameLifecycle`
- `server/src/game/BaseGameRoom.ts` — call hook in `advanceTurn()`
- `server/src/games/risk/RiskPlugin.ts` — implement hook, remove wrong calc from `endPhase`
- `server/src/__tests__/risk.test.ts` — 4 regression tests

# Decision: Guard checkGameEnd during setup phase

**Author:** Gately  
**Date:** 2026-03-17  
**Status:** Proposed  

## Context

After implementing the territory drafting phase (`setup-pick`), `checkWinCondition()` in `checkGameEnd` would fire prematurely — the first player to pick a territory was the only owner, so `owners.size === 1` declared an instant winner.

## Decision

Add an early return `if (state.gamePhase === "setup") return null;` at the top of `checkGameEnd` in `RiskPlugin.ts`. Win condition evaluation is meaningless during setup since territories are still being distributed.

## Impact

- Prevents false game-end during both `setup-pick` and `setup-place` phases
- Unit tests that test win conditions must set `state.gamePhase = "playing"` explicitly
- Pattern applies to any future game plugin where setup phase has partial state

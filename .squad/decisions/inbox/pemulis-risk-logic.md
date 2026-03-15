# Decision: Risk Plugin Architecture

**Agent:** Pemulis (Systems Dev)  
**Date:** 2026-03-15  
**Issue:** #80 (Phase 1 - Core Game Logic & Plugin)  
**Status:** Implemented  

## Context

Implemented the Risk game plugin following the established IGamePlugin pattern used by Checkers and Backgammon. Risk is significantly more complex than previous games with multi-phase turns, territory ownership, card mechanics, and variable player counts (2-6).

## Decisions Made

### 1. Setup Phase Strategy

**Decision:** Territories auto-distributed round-robin at game start, followed by a setup-place phase for initial army placement.

**Rationale:**
- Original Risk has a manual territory selection phase, but it's tedious and slows game start
- Round-robin distribution ensures fair territory distribution
- Players then place their remaining armies strategically (40-territories_owned initial armies)
- This matches digital Risk implementations and reduces setup time

**Alternative Considered:** Manual pick-one-at-a-time setup phase (too slow for async web play)

### 2. Card Mechanics Simplification

**Decision:** Track card count only (no card types: Infantry/Cavalry/Artillery), trade-in any 3 cards for escalating bonus.

**Rationale:**
- Phase 1 has no card UI, so tracking types would be wasted complexity
- Simplified trade-in (any 3 cards) removes the "forced trade when no valid set" edge case
- Escalating bonus (4→6→8→10→12→15→20...) preserves the Risk endgame acceleration
- Can add card types in Phase 2 if UI supports it

**Trade-off:** Less strategic depth than full card rules, but simpler implementation

### 3. Turn Phase Management

**Decision:** Use string union types for turnPhase in state, enforce phase transitions in action handlers.

**Rationale:**
- BaseGameRoom doesn't enforce phased turn config automatically
- Each action handler validates the current phase before executing
- endPhase action transitions between reinforce→attack→fortify→reinforce
- Simple state machine that client can render visually

**Alternative Considered:** Separate state machine class (over-engineered for current needs)

### 4. Combat Resolution

**Decision:** Pure server-side dice rolling with immediate resolution (no "roll until one side loses" loop).

**Rationale:**
- Each attack action is one dice throw, client can call multiple times
- Gives players control over when to stop attacking
- Allows for UI animation between rolls
- Server-authoritative dice (no client prediction/cheating)

**Trade-off:** More client→server round trips, but better for web play UX

### 5. Territory Adjacency Data Structure

**Decision:** Static const arrays with adjacency lists in territoryData.ts, helper functions for lookups.

**Rationale:**
- Territory graph never changes, so hardcode it
- Simple array lookups for adjacency checks (O(n) but n≤8 for any territory)
- Easy to verify correctness by reading the data
- No need for graph library or complex data structures

**Alternative Considered:** Adjacency matrix (harder to read, same performance for our graph size)

## Integration Notes

- Plugin registered in `server/src/index.ts` alongside Checkers and Backgammon
- State schema exported from `shared/src/games/risk/index.ts` for client access
- All game logic in `riskLogic.ts` is pure functions (testable, reusable)
- No client changes needed yet (Phase 1 is server-only)

## Open Questions for Phase 2

1. Should fortify require contiguous territory paths or just adjacency?
2. How to handle attack animations with rapid consecutive attacks?
3. Card UI: show card types retroactively or keep simplified system?
4. Territory map rendering: SVG overlay or canvas-based?

## Related Files

- `server/src/games/risk/RiskPlugin.ts`
- `server/src/games/risk/riskLogic.ts`
- `server/src/games/risk/territoryData.ts`
- `shared/src/games/risk/RiskState.ts`

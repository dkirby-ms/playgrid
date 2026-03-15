# Decision: Risk Test Strategy — Pure Logic First, Integration Later

**Date:** 2026-03-15  
**Agent:** Steeply (Tester)  
**Issue:** #80 (Risk game plugin)  
**Status:** Implemented  

## Decision

For complex game plugins like Risk (3× more complex than Checkers/Backgammon), use a phased test strategy:

1. **Phase 1: Pure Logic Tests** — Test static data and pure functions immediately
2. **Phase 2: Integration Stubs** — Write `.todo()` tests for plugin actions/lifecycle
3. **Phase 3: Incremental Activation** — Convert `.todo()` to executable tests as implementation completes

## Rationale

**Why Pure Logic First?**
- Validates core game rules independently of plugin integration
- Provides immediate value (16/64 tests passing on first commit)
- Enables parallel work: Pemulis implements, Steeply validates
- Catches errors in static data early (territory map, adjacency graph, continent bonuses)

**Why `.todo()` for Integration?**
- Documents expected behavior as executable specifications
- Prevents brittle "mock everything" tests that don't test real behavior
- Shows test coverage gaps in CI without blocking green builds
- Easy conversion: just remove `.todo()` when implementation lands

**Why Incremental Activation?**
- Risk has 4 distinct phases (setup, reinforce, attack, fortify) that complete independently
- Integration tests can activate phase-by-phase as Pemulis delivers
- Reduces coordination overhead: no waiting for "all or nothing" completion
- Maintains green CI throughout development

## Implementation (Risk Game)

**64 Total Tests:**
- 16 passing (pure logic): territory map, reinforcements, card trade-ins, initial armies
- 48 `.todo()` (integration): plugin actions, lifecycle, state transitions, combat, win conditions

**File Structure:**
```
server/src/__tests__/risk.test.ts (follows Backgammon pattern)
```

**Imports:**
- Uses actual implementation: `RiskPlugin`, `riskLogic`, `territoryData`
- No mocks for data structures or pure functions
- Clear TODOs for missing action handlers

## Cross-Agent Impact

**Pemulis (Systems Dev):**
- Test expectations documented before implementation complete
- Pure logic functions validated immediately (green tests = confidence)
- `.todo()` tests serve as acceptance criteria for plugin actions

**Gately (Game Dev):**
- Can reference test coverage when building UI (knows what server validates)
- `.todo()` tests hint at client-side testing needs (e.g., card display, dice animation)

**Future Game Plugins:**
- Template for complex games: validate pure logic first, defer integration
- Reduces "test everything at once" pressure that delays first commit
- Shows coverage gaps without red CI

## Alternative Considered

**"Wait for full implementation, then test":**
- ❌ Delays feedback to Pemulis
- ❌ No visibility into coverage gaps during development
- ❌ Risk of discovering logic errors late (e.g., territory adjacency bugs)

**"Mock everything, test actions now":**
- ❌ Brittle tests coupled to internal structure
- ❌ False confidence: tests pass but real integration fails
- ❌ Duplicate work when switching to real implementation

## Recommendation

**Adopt this pattern for all future complex game plugins** (Dominoes, Poker, etc.):
1. Identify pure logic (static data, calculations, validators)
2. Test pure logic immediately with actual implementation
3. Write `.todo()` integration tests as specification
4. Convert `.todo()` to executable tests as plugin actions complete

This balances immediate validation with practical coordination for parallel development.

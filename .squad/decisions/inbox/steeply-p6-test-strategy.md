# P6.1 Move History Test Strategy

**Agent:** Steeply  
**Date:** 2026-03-17  
**Context:** Writing tests for move history system being built by Pemulis in parallel

## Decision: Test-Before-Implementation Pattern for Parallel Development

When writing tests for a feature being implemented in parallel by another agent:

1. **Write comprehensive test stubs using `it.skip()`** for tests that depend on implementation
   - Allows TypeScript compilation and validates test structure
   - Serves as executable documentation of expected behavior
   - Can be unskipped incrementally as implementation progresses

2. **Keep passing tests for interface/type validation** that don't require runtime implementation
   - MoveEntry type structure validation
   - Import checks
   - Contract validation with mock data

3. **Follow existing test patterns** from the codebase
   - Use same setup helpers (createStartedGame, performMove, etc.)
   - Match import patterns (vi.mock + dynamic import)
   - Use same assertion style

4. **Test the contract, not the implementation**
   - Don't assume internal implementation details
   - Test through public plugin interfaces
   - Focus on observable behavior (GameResult metadata, state changes)

## Key Test Patterns Established

### For Move History Tests:
- Test MoveEntry structure first (validates types compile)
- Test move recording through game actions (integration style)
- Test history delivery through GameResult
- Test edge cases: empty history, invalid moves, CPU moves
- Test plugin integration points: formatMoveHistory()

### For Game State Tests:
- Use plugin actions as the entry point
- Validate state changes through schema properties
- Use helper functions to create controlled game states
- Test multi-step sequences (multi-jump moves)

## Benefits of This Approach

1. **Parallel efficiency** — Tester and implementer work simultaneously
2. **Clear contract** — Tests document expected behavior before implementation
3. **Early compilation** — Catches type errors immediately
4. **Incremental validation** — Unskip tests as implementation progresses
5. **Regression protection** — Tests are ready when implementation merges

## Applying This Pattern

Use this pattern when:
- Multiple agents working on related features
- Architecture/spec is clear but implementation is in progress
- Test coverage is critical for the feature
- You want executable documentation of expected behavior

Avoid when:
- Architecture is still being explored
- Spec is likely to change significantly
- Implementation details will inform test design

# Decision: PR #125 Re-Review — Backgammon CPU Pass Action

**Author:** Hal (Lead)
**Date:** 2026-03-16
**Status:** Approved & Merged

## Context

PR #125 (feat: CPU opponents in Backgammon, issue #87) was rejected because `selectCpuAction` returned `null` when the CPU rolled dice with no valid moves, which triggered `handleTurnTimeout` and forfeited the game.

Gately fixed this by introducing a `pass` action — a proper backgammon mechanic where a player with no legal moves passes their turn.

## Decision

Approved the pass-action fix and merged PR #125 to dev.

## Rationale

1. **Correct game mechanics:** Passing when no moves exist is standard backgammon rules
2. **Validation prevents abuse:** Pass is only allowed when dice are rolled AND no valid moves exist
3. **Clean integration:** Pass flows through the existing action processing pipeline (no special-case paths)
4. **Good test coverage:** 5 tests cover the fix (3 plugin tests + 2 updated CPU tests)
5. **Build/lint/test all green:** 289 tests pass, 0 lint errors

## Impact

- CPU opponents in Backgammon now handle all game states correctly
- Pattern established: games with no-move situations need explicit pass/skip actions in the plugin
- All future game plugins should avoid returning `null` from CPU action selectors for recoverable game states

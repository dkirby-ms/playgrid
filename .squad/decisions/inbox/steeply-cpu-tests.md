# Decision: Dominos CPU Test Contract

**Author:** Steeply (Tester)
**Date:** 2026-03-20
**Related:** Issue #163

## Context

Writing anticipatory tests for Dominos CPU opponents before Pemulis lands the implementation.

## Decision

The test file assumes `selectCpuMove` follows the same pattern as checkers (`selectCpuMove`) and backgammon (`selectCpuAction`):

- **Signature:** `selectCpuMove(state: DominosState, hand: RawTile[]): { tileId: number; end: PlayEnd } | null`
- **Returns null** when no playable tile exists (caller handles draw/pass)
- **Pure function** — no side effects, no state mutation
- **Heuristics tested:** double preference, higher-pip-total preference, valid end selection
- **File location expected:** `server/src/games/dominos/dominosCpu.ts`

## Impact

Pemulis should export `selectCpuMove` from `dominosCpu.ts` matching this contract. If the signature differs, the tests will need adjustment — but the scenarios remain valid.

## Status

24 tests written, all gated via `describe.skipIf`. Build/lint/test green.

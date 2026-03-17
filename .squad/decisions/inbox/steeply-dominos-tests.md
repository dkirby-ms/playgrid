# Decision: Dominos Test Strategy

**Author:** Steeply  
**Date:** 2026-03-17  
**Scope:** Issue #124 — Dominos game logic

## Decision

Dominos test file (`server/src/games/dominos/__tests__/dominosLogic.test.ts`) tests the **pure logic functions** exported by `dominosLogic.ts`, not the plugin layer. This matches the checkers test pattern where `checkersLogic.test.ts` tests logic and `BaseGameRoom.test.ts` tests plugin lifecycle.

## Rationale

- Pure function tests are stable, fast, and don't require mocking Colyseus infrastructure
- Plugin-layer tests (actions: play/draw/pass, lifecycle: onGameStart) belong in a separate test file once the plugin is final
- Edge cases (blank tiles, spinner ends, tie-breaking, all-doubles hands) are covered at the logic level where they're cheapest to test

## Impact

- Pemulis: Tests import from `../dominosLogic.js` — function signatures must stay stable
- Future: A `DominosPlugin.test.ts` file should be added for action validation and game lifecycle integration tests

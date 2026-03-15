# Skill: Order-Independent Lobby E2E

## Purpose
Use this pattern when Playwright lobby tests run in a suite that shares one server process and other specs may leave lobby rows behind.

## Applies when
- `npx playwright test` runs multiple E2E specs against the same Playwright-managed server
- The lobby list can contain legitimate leftover sessions from earlier specs
- A test only needs to verify create, update, or removal of its own session row

## Core pattern
1. Generate a unique game name per test.
2. Assert that the specific row for that name does not exist before the test action.
3. Perform the lobby action (create, join, leave, remove).
4. Assert on that row's contents and disappearance, not on global empty-table state.
5. Treat `.lobby-empty-row` as optional UI polish, not as a suite-wide invariant.

## PlayGrid-specific note
In PlayGrid, `e2e/checkers.spec.ts` can leave in-progress sessions visible to later tests during the same `npx playwright test` run, so the safest assertions in `e2e/lobby.spec.ts` are row-scoped via `gameRow(page, gameName)`.

## Reference files
- `e2e/lobby.spec.ts`
- `e2e/checkers.spec.ts`
- `playwright.config.ts`

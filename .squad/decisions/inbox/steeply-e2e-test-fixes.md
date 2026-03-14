# Steeply decision: make lobby E2E order-independent

## Context
The full `npx playwright test` run executes checkers E2E before lobby E2E against one shared Playwright-managed server instance.

## Decision
Lobby list tests should assert on the unique game row they create and remove, not on the entire lobby being empty.

## Why
Earlier checkers specs legitimately leave in-progress sessions visible in the lobby, which makes `.lobby-empty-row` a brittle assertion in the full suite even though the target game create/remove flow still works.

## Impact
Future lobby/browser E2E should use unique names and row-scoped assertions to stay order-independent inside the shared suite.

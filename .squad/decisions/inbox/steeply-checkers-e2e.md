# Steeply — Checkers E2E selector update

## Decision
Game-specific Playwright suites must reuse the current lobby interaction pattern instead of legacy table-era selectors.

## Why
The Checkers E2E suite broke after lobby UI changes because it still expected the old "Game Lobby" shell, inline game-name input, and table rows. The reliable flow is the same one proven in lobby.spec.ts: assert `#lobby-overlay.visible`, create games through `#create-game-modal`, join through the test's unique `.active-game-card`, then hand off gameplay assertions to the `?e2e=1` browser harness.

## Impact
Future game-plugin E2E coverage should treat lobby selectors as shared infrastructure and avoid duplicating stale assumptions. That keeps plugin suites aligned with lobby refactors and preserves the grey-box pattern for PixiJS games.

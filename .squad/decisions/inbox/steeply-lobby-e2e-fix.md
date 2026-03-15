# Steeply decision inbox — lobby E2E fix

## Context
Issue #91 exposed that the lobby Playwright suite had drifted from the shipped UI and was still making table-era assumptions. The suite also has to survive shared-server Playwright runs where older specs can leave waiting games behind.

## Decision
Lobby E2E coverage should target only the unique session created by the test and should use current UI seams:
- save display names by blurring `input[name="player-name"]`
- create games through `#create-game-modal`
- find sessions via the test's unique `.active-game-card`
- use exact/scoped button locators when labels overlap (`Create Game`, `Ready`, `Start Game`)

## Why
This makes the suite order-independent, resilient to shared lobby state, and aligned with the current accessible UI instead of the removed table layout.

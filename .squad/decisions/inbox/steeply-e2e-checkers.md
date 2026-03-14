# Steeply — E2E Checkers testing note

## Decision
Use a lightweight browser-only E2E harness for gameplay tests: expose the live `PlaygridApp` instance from `client/src/index.ts` only when the app is loaded with `?e2e=1`, then have Playwright drive lobby/waiting-room UI normally while sending Checkers moves through the real browser `gameRoom` connection.

## Why
- Checkers gameplay is rendered on a Pixi canvas, so DOM-driven move automation is brittle.
- Using the same room objects that the browser players already joined keeps coverage end-to-end and avoids fake test clients taking player seats.
- The suite can assert win/loss messaging, promotion, king movement, invalid-action errors, and synchronized state changes deterministically.

## Operational note
Root `playwright.config.ts` now targets the server-served app on `http://127.0.0.1:2567` and starts E2E by building the client bundle, then running the server in development mode.

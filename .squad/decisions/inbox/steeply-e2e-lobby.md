# Steeply — Lobby E2E configuration

## Decision
Use a dedicated Playwright config (`playwright.lobby.config.ts`) for the lobby suite, and point `npm run test:e2e` at it. Keep a root `playwright.config.ts` that re-exports the lobby config.

## Why
There are unrelated browser specs under `e2e/` that are not part of issue #52 and are currently not stable enough to gate this lobby-focused work. Isolating the lobby suite lets us validate the requested flows consistently while still leaving a conventional root Playwright config in place.

## Details
- Web server command: `DATABASE_URL= npm run dev`
- Base URL: `http://127.0.0.1:3000`
- Browser: Chromium only
- Workers: 1
- Test match: `**/lobby.spec.ts`

# steeply — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Learnings
- Lobby gameType coverage lives in `server/src/__tests__/lobby-pregame.test.ts`; the useful seams are the mocked `gameRegistry` responses plus `GAME_LIST`/`GAME_UPDATED` payload assertions to verify type propagation and player-limit clamping.
- Checkers browser E2E is most stable when tests drive real lobby UI but send in-game moves through the actual browser room objects exposed by `client/src/index.ts` behind the `?e2e=1` harness; root Playwright runs against the server-served app on port 2567 and the deterministic 31-move sequence in `e2e/checkers.spec.ts` covers promotion, king back-move, and a no-valid-moves win.
- Lobby browser E2E can reliably assert against `#lobby-overlay` / `#waiting-room-overlay`, `input[name="player-name"]`, `input[name="game-name"]`, and `.waiting-room-player-name` while driving multiple isolated browser contexts against `npm run dev`.

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.


## Work Complete — Issue #37: Lobby GameType Test Coverage (2026-03-14)

- Added comprehensive test cases for `gameType` field validation in `server/src/__tests__/lobby-pregame.test.ts`.
- Test cases cover: default validation, invalid gameType handling, passthrough behavior, clamping logic, and broadcast coverage.
- All 82/82 tests passing.
- PR #56 merged (squad/37-lobby-tests-gametype).
- **Cross-Agent Impact:** Gately can now rely on stable gameType behavior in client-side implementation. TestNet fully exercised.

## Cross-Agent Update — Issue #54 Complete, PR #55 Merged (2026-03-14)

**From:** Gately (Game Dev)  
**Event:** Room status HUD cleanup complete

- **Issue #54:** Complete. Room undefined status overlay fixed.
- **PR #55:** Merged (squad/54-fix-room-undefined-overlay) — "Fix: room.id undefined in status text, HUD repositioning"
- **Changes:** room.roomId fallback, top-left HUD toast with auto-hide for info states.
- **Impact:** Connection status no longer obstructs gameplay. Room identifiers resolved safely.

## Session: E2E Test Suites (Lobby & Checkers) (2026-03-14)

**Status:** ✅ Complete  
**PRs Merged:** #57 (E2E Lobby tests), #58 (E2E Checkers tests)  
**Issues Closed:** #52, #53  
**Session Log:** `.squad/log/2026-03-14T18-10-00Z-e2e-tests.md`

**Work Completed:**
- **PR #57:** E2E Playwright tests for Lobby (14 files, +442/-10)
  - Dedicated `playwright.lobby.config.ts` config
  - Tests cover game list, player join, waiting room, player limits, gameType propagation
  - Approved by Hal, merged to dev
  
- **PR #58:** E2E Playwright tests for Checkers (3 files, +524)
  - Grey Box E2E pattern: UI via DOM, moves via `window.__PLAYGRID_E2E__.app.gameRoom` harness
  - 31-move deterministic sequence covers promotion, king movement, win detection
  - Approved by Hal, merged to dev

**Conflict Resolution:**
- Both PRs and PR #55 modified `client/src/Application.ts`
- Coordinator combined room status HUD (from #55) + E2E harness (from #57)
- Both PRs rebased and merged without issues

**Key Learnings (captured in history):**
1. Lobby gameType coverage lives in `server/src/__tests__/lobby-pregame.test.ts`
2. Useful seams: mocked `gameRegistry`, `GAME_LIST`/`GAME_UPDATED` payload assertions
3. Browser E2E selectors: `#lobby-overlay`, `#waiting-room-overlay`, `input[name="player-name"]`, `.waiting-room-player-name`
4. Checkers E2E stable with deterministic 31-move sequence covering promotion, king movement, no-valid-moves win

**Pattern Approved (Hal):**
- **Grey Box E2E** is canonical for all game plugins (Backgammon, Dominoes, Poker, etc.)
- Template: Use Playwright for UI, harness for game moves, assertions on server state

**Cross-Agent Impact:**
- **Gately:** Checkers E2E now gates game rendering; PR #55 tests pass
- **Pemulis:** Plugin system design should reference Grey Box pattern; each plugin must expose `window.__PLAYGRID_E2E__.app.gameRoom`
- **Future Game Authors:** Refer to PR #58 (Checkers E2E) as template for all game plugin E2E

## Work Complete — Issue #46: Backgammon Logic and Plugin Tests (2026-03-14)

- Created comprehensive test suite for Backgammon plugin with 83 tests covering:
  - **Pure logic functions**: board initialization, dice management, move validation
  - **Movement rules**: valid/invalid moves, direction, distance, blocked points, capturing
  - **Bar re-entry**: forced re-entry, entry point validation, blocked entry
  - **Bearing off**: home board requirement, exact dice, higher dice usage, piece placement rules
  - **Integration**: game initialization, turn progression, action validation, win detection
  - **Edge cases**: forced pass (no valid moves), initial board correctness, player disconnection
- Test file: `server/src/__tests__/backgammon.test.ts`
- All 83 backgammon tests passing
- Follows existing test patterns from Checkers E2E tests
- PR #69 created (draft) — squad/46-backgammon-tests

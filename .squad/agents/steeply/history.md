# steeply — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Cross-Agent Update — PR #122 Final Fix & Approval (2026-03-16)

**Lockout Protocol Escalation:** Gately → Pemulis → Steeply

- **Issue:** Pemulis's lifecycle fix did not cover the `handleReconnectionTimeout` cleanup path
- **Fix:** Ensured `finalizeParticipantDeparture` is called, which properly triggers `releaseControllerOwnedParticipants`
- **Regression Test:** Added coverage in `BaseGameRoom.test.ts` confirming synthetic player removal and draw outcome (not forfeit)
- **Build:** Passed
- **Re-review:** Hal approved (third review cycle)
- **Status:** PR #122 merged to `dev` ✅

---

## Learnings
- Lobby gameType coverage lives in `server/src/__tests__/lobby-pregame.test.ts`; the useful seams are the mocked `gameRegistry` responses plus `GAME_LIST`/`GAME_UPDATED` payload assertions to verify type propagation and player-limit clamping.
- Checkers Playwright coverage has to follow the current lobby UI, not the old table flow: open `#create-game-modal`, scope joins to the unique `.active-game-card`, and assert the visible lobby shell as "Board Game Lounge" before using the `?e2e=1` harness for in-game state.
- Checkers browser E2E is most stable when tests drive real lobby UI but send in-game moves through the actual browser room objects exposed by `client/src/index.ts` behind the `?e2e=1` harness; root Playwright runs against the server-served app on port 2567 and the deterministic 31-move sequence in `e2e/checkers.spec.ts` covers promotion, king back-move, and a no-valid-moves win.
- Lobby browser E2E can reliably assert against `#lobby-overlay` / `#waiting-room-overlay`, `input[name="player-name"]`, `input[name="game-name"]`, and `.waiting-room-player-name` while driving multiple isolated browser contexts against `npm run dev`.
- The root Playwright run (`npx playwright test`) shares one server process across `e2e/checkers.spec.ts` and `e2e/lobby.spec.ts`, so lobby tests must key off their unique game row in `e2e/lobby.spec.ts` instead of assuming the table starts empty after earlier specs leave in-progress sessions visible.
- `client/src/Application.ts` must import `ConnectionManager`/`ConnectionState` from `client/src/networking/index.ts`; if that wiring is missing, the browser dies at startup before `#lobby-overlay` ever renders and the E2E suite collapses immediately.
- `server/src/__tests__/BaseGameRoom.test.ts` is the right seam for reconnection behavior: instantiate the room off the prototype, stub `allowReconnection`, and assert outcomes through lifecycle hooks plus room state instead of poking private helpers.
- `server/src/__tests__/lobby-pregame.test.ts` already exposes the waiting-room seams needed for disconnect coverage (`waitingPlayers`, `sessions`, `currentGameId`), so lobby reconnection tests should stay there and assert membership preservation/removal behavior directly.
- There is no real client-side `PlaygridApp` harness yet; for startup/sessionStorage reconnect work, Vitest `.todo()` coverage is the safe placeholder until Gately lands the application-side session persistence flow and a controllable `ConnectionManager` seam.
- Issue #91 lobby E2E failures came from stale selectors and brittle assumptions: the suite still targeted the old table UI (`.lobby-table`, `Save Name`) and assumed an empty lobby, while the current UI uses header blur-to-save, a create-game modal, active-game cards, and exact button labels that collide unless selectors are scoped. The reliable pattern is: save names by blurring `input[name="player-name"]`, create unique games through `#create-game-modal`, assert only against the unique `.active-game-card` for that test, and use exact/scoped button locators so shared server state from earlier specs cannot poison lobby assertions.

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

## Session: E2E Test Suite Fix & ConnectionManager Import (2026-03-14)

**Agents:** Steeply (lead), Gately (support), Hal (review + merge)

### What Happened

Full E2E suite was failing because lobby tests made order-dependent assertions. When checkers E2E ran first, it left sessions in the lobby. Lobby E2E then failed because it expected an empty lobby.

**Steeply's Fix:**
1. Made lobby assertions row-scoped: assert only on game row created by the test, not entire lobby
2. Used unique game names (`Test Game ${timestamp}`) to avoid collisions
3. Tests now pass in any order

**Side Discovery (Gately):**
- ConnectionManager was missing its import in Application.ts
- ConnectionManager property was never initialized
- Without it, connection lifecycle wasn't managed
- Fixed in same PR

**Review & Merge (Hal):**
- Approved PR #78
- Rebased on dev: one automatic conflict resolution (Gately's earlier fix)
- Squash-merged as c740333
- Closed issue #77
- 189 tests passing

**Decision Recorded:**
- Lobby E2E best practice: use unique names + row-scoped assertions
- Prevents test coupling and enables order-independent suites
- Recorded in decisions.md

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

---

## 2026-03-15: Session Resilience — Two-Layer Test Coverage

**From:** Squad Scribe  
**Event:** Session completed — Reconnection test strategy landed

**What Changed:**
- 4 concrete server-side behavioral tests (green)
- 14 named .todo() contract stubs (client + cross-agent)
- Full reconnection matrix contracts pinned in CI

**Coordination Notes:**
- **Pemulis (Server):** Server-side tests passing for 30s window, cleanup, forfeit scenarios
- **Gately (Client):** Client seams available now; contracts ready for conversion from .todo() to executable tests

**Test Coverage Strategy:**
1. **Server layer (green now):** allowReconnection window, consented leave, timeout forfeits, lobby cleanup
2. **Client layer (pinned as contracts):** sessionStorage persistence, startup reconnect, reconnecting UI, edge cases

**Action for Future Work:**
Finishing agent should convert .todo() stubs to executable tests using Pemulis/Gately seams now available.

**Status:** ✅ Tests pass. Contracts visible in CI without brittle timing dependencies.

## Work Complete — Issue #80: Risk Game Test Suite (2026-03-15)

- Created comprehensive test suite with 64 tests covering Risk game mechanics
- 16 tests passing immediately (territory map, reinforcements, card trade-ins, initial armies)
- 48 tests structured as `.todo()` awaiting Pemulis's plugin action implementations
- Test file: `server/src/__tests__/risk.test.ts`
- Follows Backgammon test pattern (root `__tests__` directory)
- Uses actual imports from Pemulis's implementation (RiskPlugin, riskLogic, territoryData)

**Coverage Areas:**
1. **Territory & Map:** 42-territory validation, adjacency symmetry, continent bonuses
2. **Setup Phase:** Initial army allocation (2-6 players), territory selection
3. **Reinforce Phase:** Territory-based reinforcements, continent bonuses, card trade-ins
4. **Attack Phase:** Validation, dice mechanics, combat resolution, territory capture
5. **Fortify Phase:** Path validation, army movement constraints
6. **Win Conditions:** Territory control, elimination, card transfer
7. **Edge Cases:** Multi-player games, no valid moves, forced trades, disconnection

**Key Learnings:**
- Risk tests follow Backgammon pattern: root `__tests__` directory, not game-specific subdirectory
- Pemulis delivered clean separation: `territoryData.ts` (static map), `riskLogic.ts` (pure functions), `RiskPlugin.ts` (actions)
- Test strategy: validate pure logic functions first (passing), defer plugin integration tests to `.todo()` until actions complete
- Used actual TERRITORIES, CONTINENTS, and logic functions rather than mocks—enables immediate validation
- Combat resolution needs deterministic testing approach (stochastic dice currently uses Math.random)

**Coordination:**
- Pemulis has core logic functions ready: `calculateReinforcements`, `getCardTradeInValue`, `checkWinCondition`, attack/fortify validators
- Plugin action handlers still in progress—48 integration tests remain as `.todo()`
- Tests ready for incremental conversion as Pemulis completes action implementations

---

## 2026-03-15: Cross-Agent Update — PR #83 Revision Complete (Lockout Protocol)

**From:** Scribe (on behalf of Marathe)  
**Event:** PR #83 blockers resolved; lockout protocol applied per Hal's re-review requirement

**Situation:**
- Hal identified three critical blockers in PR #83 (Risk Game Plugin): incomplete test implementation (~48 `it.todo()` placeholders), territory data duplication (server/client drift risk), missing Phase 1 scope documentation.
- Original PR authors (Pemulis, you, Gately) were locked out per protocol — revision could not proceed with original team.

**Resolution:**
- Marathe (DevOps) completed full revision: 60 executable tests, shared territory data refactored to `shared/src/games/risk/`, Phase 1 limitations documented in RiskPlugin.
- All blockers verified: `npm run build` ✅, `npm run lint` ✅, `npm run test` ✅ (60/60 passing).
- Commits: `816332c` (fix), `2692e8a` (docs).

**Impact on Your Work:**
- Your test suite structure remains the baseline; Marathe filled in the `.todo()` placeholders with real test implementations.
- Architectural standard captured in `.squad/decisions.md`: "Test Implementation: PR descriptions must accurately reflect test coverage. `it.todo()` placeholders do not count as implemented tests. Critical game logic must be tested before merge."

**Next Step:** Hal will re-review revised PR #83. Ready for merge once approved.


## Checkers E2E Tests — Full Suite (2026-03-15)

**Session:** Built comprehensive E2E test suite for Checkers game

**Outcome:** ✅ COMPLETED

**Artifacts:**
- File: `e2e/checkers.spec.ts`
- Tests: Modal-based game creation, card-based joining, lobby flow integration
- Status: All passing
- PR: #93 (opened)

**Design Approach:**
- Follows patterns established in PR #92 (lobby E2E fix)
- Uses current UI seams: modal selectors, game card targeting
- Tests order-independent and compatible with shared-server Playwright runs
- Scoped button locators to prevent label collisions

**Dependencies:**
- Depends on PR #92 (merged) for lobby E2E foundation patterns
- Awaiting review before merge

---

## Cross-Agent Update — Lobby E2E Standardization (2026-03-15)

**From:** Hal (Lead)

**Event:** PR #92 (Lobby E2E fix) approved and merged

- **Review outcome:** ✅ APPROVED — fix properly addresses test isolation root cause
- **Standard established:** Lobby E2E tests must use current UI seams and target unique test-created sessions
- **Impact:** Your Checkers E2E suite correctly implements this standard (PR #93)
- **Next step:** Hal will review PR #93


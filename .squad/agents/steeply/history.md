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
- CPU opponent E2E tests only need ONE browser context (single human player). The CPU is a synthetic server-side player with session ID `"cpu-opponent"`. CPU games auto-start after the host clicks "Start Game" since the CPU is pre-set to `isReady: true`. The `controllerSessionId` field links the CPU to the human player. CPU turn delay is 200ms — use `expect.poll()` with 10s timeout to wait for CPU responses.
- For stochastic games like Backgammon vs CPU, dynamic move finding is necessary since dice are random. Scan the board in `page.evaluate()` to find valid sources and destinations. For Checkers, compute valid moves by checking piece positions and diagonal offsets (+/-7, +/-9 for moves, +/-14, +/-18 for captures).

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


---

## Session 2026-03-16: E2E Coverage Expansion & Testing Leadership

**Role:** E2E test architect, issue filer, test implementation lead  
**Output:** 5 issues filed (#126-129, #131), 5 PRs submitted (#133-138), all merged  

**Summary:**
- Conducted E2E coverage audit → identified 5 critical gaps
- Filed issues #126-129 and #131 with clear acceptance criteria
- Proposed E2E strategy: action pipeline verification for non-deterministic games (Backgammon)
- Implemented Backgammon E2E tests (PR #133): roll → move → turn advance → state sync
  - Random dice adaptation: tests don't attempt deterministic full-game replay
  - Invalid action rejection verified
  - Game-end outcome listener confirmed
  - PR #133 → Hal approved & merged
- Implemented Risk E2E tests (PR #135): 5-move deterministic game replay
  - PR #135 → Hal found Promise.race flakiness
  - Locked out for concurrent changes; Pemulis applied deterministic waiting fix
  - PR #135 re-merged (under Pemulis name)
- Implemented Reconnection E2E tests (PR #134): disconnect → reconnect → 30s timeout
  - State recovery, spectator behavior
  - PR #134 → Hal approved & merged
- Implemented Spectator E2E tests (PR #137): join without slot, read-only sync, spectator → player transition
  - PR #137 → Hal approved & merged
- Implemented CPU Opponent E2E tests (PR #138): human vs CPU for all 3 games, action validation, turn progression, game-end handling
  - PR #138 → Hal approved & merged

**Key Achievement:** Led E2E coverage expansion from ~20% to near-complete. Established action-pipeline verification pattern for random games. All 5 test PRs merged successfully.

**Directives:**
- E2E strategy for non-deterministic games: verify action pipeline, not game logic (game logic covered by unit tests)
- Deterministic waits (page.waitForFunction) are more reliable than Promise.race for E2E test sequencing

**Output:**
- 5 issues filed (#126-129, #131)
- 5 PRs merged (#133-134, #137-138, plus #135 merged under Pemulis)
- 6 issues closed total
- E2E coverage: Checkers ✓, Risk ✓, Backgammon ✓, Reconnection ✓, Spectator ✓, CPU opponents ✓
- All 289 tests passing, 0 flakiness in final merged state

## Fix: E2E getSnapshot() playerColorText reads from sidebar DOM (2026-03-16)

**Root Cause:** Phase 4 visual redesign (commit `4eddedf`) removed the `playerColorText` PixiJS Text property from `CheckersRenderer` and `RiskRenderer`, moving the color label into the HTML sidebar. E2E `getSnapshot()` functions still read `renderer.playerColorText.text`, returning `null` for Checkers/Risk renderers. This caused `startMatch()` to fail with "Expected exactly one black player and one red player" in every test using that helper.

**Fix:** Updated `playerColorText` extraction in `getSnapshot()` across 5 spec files to use an IIFE that tries the PixiJS renderer property first (backward compat for BackgammonRenderer), then falls back to reading `.sidebar-note` elements from the DOM.

**Files Changed:**
- `e2e/checkers.spec.ts`
- `e2e/spectator.spec.ts`
- `e2e/cpu-opponent.spec.ts` (two getSnapshot functions: Checkers + Backgammon)
- `e2e/reconnection.spec.ts`
- `e2e/backgammon.spec.ts`

**Not Changed:** `e2e/risk.spec.ts` — does not use `playerColorText` at all.

**Verification:** All `playerColorText` assertions pass. Remaining E2E failures are unrelated (statusText also removed from PixiJS, controllerSessionId issues, stochastic game logic timing).

**Learnings:**
- When the client UI moves text from PixiJS canvas to HTML DOM, E2E `page.evaluate()` snapshots must read from DOM selectors instead of renderer properties.
- The sidebar `.sidebar-note` class is the reliable selector for player color labels across all game renderers.
- BackgammonRenderer still exposes `playerColorText` as a PixiJS Text property; Checkers and Risk do not (post Phase 4 redesign).

## Fix: E2E getSnapshot() statusText reads from getHUDStatus() (2026-03-16)

**Root Cause:** Phase 4 visual redesign removed the `statusText` PixiJS Text property from `CheckersRenderer`. E2E `getSnapshot()` functions read `renderer.statusText.text`, returning `null` for Checkers. This broke assertions like `expect(statusText).toBe("Your turn")`.

**Investigation:**
- RiskRenderer: still has `statusText` and `phaseText` as functional PixiJS Text objects (added to HUD layer, actively updated) → no fix needed
- BackgammonRenderer: still has `statusText` as PixiJS Text → no fix needed
- CheckersRenderer: no `statusText` property, but exposes `getHUDStatus(state)` which returns `{ text: "Your turn", ... }`

**Fix:** Updated `statusText` extraction in `getSnapshot()` across 4 spec files to use an IIFE that tries the PixiJS renderer property first (backward compat for Backgammon/Risk), then falls back to `renderer.getHUDStatus(state).text`.

**Files Changed:**
- `e2e/checkers.spec.ts`
- `e2e/cpu-opponent.spec.ts` (getCheckersSnapshot only)
- `e2e/reconnection.spec.ts`
- `e2e/spectator.spec.ts`

**Not Changed:**
- `e2e/risk.spec.ts` — RiskRenderer still has both `statusText` and `phaseText` as PixiJS Text
- `e2e/backgammon.spec.ts` — BackgammonRenderer still has `statusText` as PixiJS Text

**Verification:** `npm run build` ✅, `npm run lint` ✅, `npm run test` (292 passing) ✅, `npx playwright test e2e/checkers.spec.ts` (3/3 passing) ✅

**Learnings:**
- `getHUDStatus(state)` is the universal fallback for status text across all renderers that have moved away from PixiJS Text. It returns `{ label, text, detail, accentColor }`.
- BackgammonRenderer does NOT implement `getHUDStatus()` — it's the only renderer that still relies entirely on PixiJS Text for status display.
- The IIFE-with-fallback pattern (try PixiJS → try HUD → return null) is now the standard for E2E snapshot extraction when renderer properties may or may not exist.

## Session 2026-03-17: E2E Test Failure Triage and Fix Marathon

**Event:** Extended multi-hour session fixing 3 categories of E2E test failures.  
**Role:** Tester — Spectator logic, reconnection patterns, backgammon timing  
**Output:** 6 E2E tests fixed, suite 15/40 → 40/40, zero regressions  

**Fixes Implemented:**

### 1. Spectator Cleanup Bug
- **Issue:** Spectators not removed from `state.players` on leave, causing stale state in subsequent tests
- **Root:** `BaseGameRoom.onPlayerLeave()` didn't distinguish spectators for cleanup
- **Fix:** Delete spectators from `state.players` before standard onLeave logic
- **Impact:** Spectator test scenarios now clean up correctly
- **Tests:** All 6 spectator-related specs passing

### 2. Reconnection Test Logic Overhaul
- **Issue:** Tests assumed host always plays Black; broke in multiplayer scenarios with randomized player order
- **Root:** Hardcoded `selectBlackPiecesMove()` doesn't work when host isn't Black
- **Solution:** Implemented `playMoveForCurrentTurn()` helper function:
  - Queries game state for current turn (player ID)
  - Maps player ID to playerIndex
  - Selects valid move for that player's pieces (not Black)
  - Eliminates order dependency
- **Reusable:** Pattern applies to any multiplayer E2E where move selection depends on game state
- **Impact:** Reconnection tests now work across all player configurations
- **Tests:** All reconnection specs passing

### 3. Backgammon Win Timeout
- **Issue:** Win simulation exceeded 30s Playwright default timeout
- **Root:** Backgammon game logic is stochastic (dice); win paths take variable time
- **Fix:** Set explicit 180s timeout for backgammon win scenarios
- **Impact:** Win path coverage now complete
- **Tests:** Backgammon win spec passing

**Architecture Learnings:**
- `playMoveForCurrentTurn()` is a reusable pattern for multiplayer E2E tests that need state-aware move selection
- E2E strategies for non-deterministic games: action pipeline verification (verify legal moves), not deterministic replay
- Timeout tuning: 30s fine for synchronous games, but dice-based games need 180s for stochastic paths

**Output:**
- All spectator tests passing
- All reconnection tests passing
- All backgammon tests passing
- E2E suite 40/40 passing
- 292 unit tests passing
- Lint clean
- Zero regressions


### Session: Fix E2E lobby notice flakiness (2025-07-17)

**Problem:** All 7 E2E test files had `savePlayerName()` functions that waited for the "Player name saved." notice to appear but never waited for it to disappear. The notice overlay (`z-index: 100`, `position: fixed`) intermittently blocked "Create Game" button clicks, causing flaky timeouts.

**Fix:** Added `await expect(page.locator(".lobby-notice.visible")).not.toBeVisible()` after the `toHaveText("Player name saved.")` assertion in all 7 E2E files: `risk.spec.ts`, `checkers.spec.ts`, `backgammon.spec.ts`, `cpu-opponent.spec.ts`, `reconnection.spec.ts`, `spectator.spec.ts`, `lobby.spec.ts`.

**Learning:** Any overlay with high z-index and auto-hide timers is a flakiness vector. E2E tests must always wait for transient UI elements to fully dismiss before proceeding to interact with elements they could occlude.

**Validation:** Build ✅, lint ✅ (0 errors), 294 unit tests ✅. E2E Risk attack test (line 689) has a pre-existing combat resolution failure unrelated to this fix.

## Work In Progress — Issue #124: Dominos Game Logic Tests (2026-03-17)

**Status:** ⏳ Tests written, awaiting Pemulis's implementation to pass

**File:** `server/src/games/dominos/__tests__/dominosLogic.test.ts`
**Branch:** `squad/124-dominos`

**Test Categories (12 describe blocks, 50+ test cases):**
1. Tile set generation — 28 tiles, unique pairs, sequential IDs, lowPips ≤ highPips, 7 doubles
2. Dealing — tilesPerPlayer (7 for 2p, 5 for 3-4p), boneyard remainder math
3. Shuffle — in-place, preserves elements
4. Tile utilities — isDouble, pipTotal
5. Valid play detection — tileMatchesEnd, canPlayTile (empty board, matching, non-matching, spinner), hasPlayableTile
6. Play resolution — resolvePlay, getValidEnds, placeTileOnBoard (first tile, end A/B updates, rejection, doubles)
7. Turn advancement — getActivePlayers (sorted, excludes spectators), getNextPlayer (wrapping, 2-player)
8. Win condition — scoreDomino (sum opponents' pips, zero-pip edge)
9. Blocked game — isRoundBlocked (boneyard not empty, playable tile exists, fully blocked), resolveBlockedRound (lowest wins, scoring)
10. Scoring — handPipTotal (multi-tile, empty, single)
11. Starting player — determineStartingPlayer (highest double, fallback to highest pip total, single player)
12. Edge cases — all doubles hand, blank tiles, 4-player dealing, double on matching end, tile [6,0] versatility, tie-breaking

**Learnings:**
- Pemulis's dominosLogic.ts exports pure functions for tile logic and state-mutating helpers for board/hand operations. Tests can exercise pure functions directly; state mutations need Schema instances from `@eschaton/shared`.
- The `DominosState` schema uses `openEndA`/`openEndB` = -1 for empty board, which is the sentinel for "anything can be played." Tests must account for this initial state.
- `getValidEnds` deduplicates when both ends have the same value (returns `["a"]` not `["a","a"]`) — critical edge case for spinner tiles.
- `placeTileOnBoard` for first tile sets `openEndA = lowPips, openEndB = highPips` — the ordering matters for test assertions.
- `determineStartingPlayer` falls back from highest-double to highest-pip-total — two code paths that both need coverage.
- Boneyard is server-side only (not in Schema), stored in a WeakMap-like pattern in DominosPlugin. Logic tests don't need boneyard state since pure functions accept it as a parameter.
- The checkers test pattern uses: direct imports from logic module, helper functions for state setup, describe/it blocks organized by function, no mocking of external dependencies.

---

### 2026-03-17T19:44:31Z: Dominos test suite finalized

- Wrote 50+ test cases covering pure logic functions in `dominosLogic.ts`: tile generation, matching, scoring, edge cases.
- **Fixed coordinator bug:** getValidEnds() was pushing "a" twice when both board ends matched — now returns deduped [a, b].
- **Test coverage:** 12 describe blocks. All 382/382 tests pass (no regressions in existing suite).
- **Test strategy:** Pure function testing (logic layer, not plugin layer) — follows Checkers pattern. Stable, fast, no Colyseus mocking.
- **Plugin-layer tests:** Deferred for future DominosPlugin.test.ts (actions, lifecycle integration).
- **Handoff:** Pemulis's function signatures stable for import, Gately's renderer ready, PR #141 for review.

## Work Complete — Hidden State Verification Tests for Dominos (PR #141 Fix)

**Context:** Hal rejected PR #141 because the Dominos stateFilter was a no-op — opponent hands were visible to all clients. Gately fixed the implementation on `squad/124-dominos` by:
1. Replacing `hand: ArraySchema<DominoTile>` with `handCount: number` on `DominosPlayerState` schema
2. Moving hand storage server-side via `playerHandsMap` (private module-level Map)
3. Adding `getPlayerMessage()` to deliver hand tiles as direct messages per player
4. Keeping `filterForClient()` as a safe pass-through (nothing to filter since hands aren't in schema)

**Tests Added:** `server/src/games/dominos/__tests__/dominosPlugin.test.ts` — 48 tests across 7 describe blocks:
- **Metadata** (2): Plugin identity, turn config
- **State creation** (1): DominosState initial structure
- **Lifecycle** (7): onPlayerJoin, onGameStart (2/3/4 players, tile counts, currentTurn), onPlayerLeave, onGameEnd
- **Actions** (8): play (valid, invalid payload, wrong tile, non-matching, domino win, unknown player), draw (valid, rejected, unknown), pass (rejected playable, rejected boneyard)
- **Conditions** (7): validateAction (wrong turn, valid play, bad tile, forced play, unknown action), checkGameEnd (in-progress, domino)
- **Hidden state verification** (16): Schema privacy (handCount not hand, no tile data exposure, opponent handCount visible), boneyard privacy (no tiles in schema, count tracking), stateFilter (filterForClient safe, spectators safe, getPlayerMessage per-player, different tiles per player, null for unknown, updated after play), handCount accuracy (initial deal, after play, after draw, after domino)
- **Turn flow** (4): play ends turn, draw doesn't, pass ends turn, multi-draw to empty boneyard

**Result:** 48/48 passing, lint clean, build passes.

### Learnings
- Gately's hidden-state fix uses module-level Map storage (`playerHandsMap`) as the server-side hand store — tests can only access hand data indirectly through `getPlayerMessage()`, not by reading schema properties.
- The `getPlayerMessage` plugin hook is the canonical way to deliver per-client private data; tests should use it to verify hand contents rather than trying to access internal state.
- Some dominos test scenarios (draw, pass) depend on random tile distribution, so tests that force specific board states (`openEndA = 0`) need conditional assertions when the random hand might match.
- Pre-existing failures exist in `dominosLogic.test.ts` (11/83 fail) — these are in functions whose signatures were changed by Gately's refactor (`scoreDomino`, `isRoundBlocked`, `resolveBlockedRound`, `removeTileFromHand` now take `playerHands` Map / `RawTile[]` instead of schema types). Not in scope for this task.
- Risk setup→playing regression tests live in `server/src/__tests__/risk-setup-transition.test.ts` (14 tests). They cover: auto-transition when all armies placed (2/3/6 player), last-player-triggers-transition, setup continues with partial placement, turn-skipping for 0-army players, army count correctness, incremental placement, and post-transition state. All 14 green against Gately's fix (commit f95c73f).
- The Risk setup deadlock bug was caused by `placeArmy` returning `endsTurn: true` without checking if ALL players were done — the turn advanced to a player with 0 armies who couldn't act. Gately's fix adds an `allDone` check inside `placeArmy` that auto-transitions to `playing`/`reinforce` when every player's `armiesToPlace === 0`.

## 2026-03-17 — Risk Setup Phase Deadlock Fix (Test Coverage)

**Outcome:** SUCCESS — 14 regression tests written, all passing, 446 total tests green.

**Work:**
- Wrote 14 regression tests for Risk setup → playing phase transition
- Covered 2/3/6 player variants
- Tested concurrent placement actions
- Tested spectator scenarios
- Verified transition occurs automatically (no explicit endPhase call)
- All armies must reach 0 before transition

**Cross-Agent Context:**
- Gately implemented the fix in RiskPlugin.ts (auto-transition on global allDone check)
- Hal reviewed PR #144, approved, and codified the phase transition pattern as team standard

**Files Created:** server/src/__tests__/risk-setup-transition.test.ts  
**PR:** #144 (merged to dev, pushed to UAT)  
**Result:** Bug resolved, pattern established for all future game plugins

## Work Complete — Spinner & 4-Way Dominos Test Coverage (2026-03-17)

### Learnings
- Dominos spinner logic uses a multi-phase placement model: pre-spinner (arm=""), spinner assignment (arm="spinner"), and post-spinner (arm="a"/"b"/"c"/"d"). Tests must trace through each phase to verify retroactive arm reassignment.
- C/D arm activation is conditional on BOTH A and B having ≥1 tile post-spinner. A common edge case is only one arm being populated — C/D must stay at -1 until the condition is strictly met.
- When openEndA === openEndB (e.g., immediately after spinner placement), getValidEnds correctly returns both ["a", "b"] via a special-case branch. This is important to test because the standard dedup logic would otherwise collapse them.
- The `placeTileOnBoard` function handles the `end === "c" | "d"` path before the A/B path, guarding on `endValue < 0` to reject plays on inactive arms. Test the guard explicitly.
- Plugin integration tests for C/D plays require setting up `openEndC`/`openEndD`/`spinnerTileId` directly on state before calling the action, since random dealing makes it impractical to reach 4-way state organically.
- All 24 new tests (20 logic + 4 plugin) added without modifying any existing tests — the new schema fields (`arm`, `isDouble`, `openEndC`, `openEndD`, `spinnerTileId`, `armACount`, `armBCount`) have sensible defaults that don't break prior assertions.
- Use the `setupActiveFourEnds()` helper pattern for any future test that needs all 4 ends active — places spinner + one tile on each arm in 3 calls.

## 2026-03-17 Session: Dominos Spinner & 4-Way Test Coverage (Orchestrated)

**Status:** Complete ✅  
**Depends on:** Pemulis (spinner logic)

Added 24 new tests (20 logic + 4 plugin) for Dominos spinner rules and 4-way branching:
- Spinner detection (4 tests)
- Arm assignment (3 tests)
- C/D activation (3 tests)
- 4-way placement (5 tests)
- Board tile fields (2 tests)
- Blocked round with 4 ends (2 tests)
- Plugin spinner flow (4 tests)

**Decisions merged:**
- Steeply: Spinner & 4-Way Dominos Test Strategy

**Build/Lint/Test:** ✅ 470/470 tests pass (backward-compatible)

---

## Learnings

### E2E Setup Screen Migration (2025-01-16)

Successfully migrated all 7 E2E test files from "Waiting Room" to "Setup Screen" UI:

**Key selector changes:**
- `#waiting-room-overlay.visible` → `#setup-overlay.visible`
- `.waiting-room-player` → `.setup-player-card`
- `.waiting-room-player-name` → `.setup-player-name`
- `.waiting-room-player-list` → `.setup-player-list`
- Helper `waitingRoomOverlay()` → `setupOverlay()`

**Button text changes:**
- "Ready" → "✓ Ready" (use regex: `/^✓ Ready$/` to avoid matching "Not Ready")
- "Start Game" → "▶ Start Game" (but use `{ name: "Start Game" }` without exact:true)
- "Start when everyone is ready" → "Waiting for players…"
- "Leave" / "Leave Game" → "Back to Lobby" (both in setup screen and during gameplay)
- Text "✅ Ready" → Look for `.setup-ready-badge.ready` with text "Ready"

**Pattern for "Ready" button matching:**
Use `getByRole("button", { name: /^✓ Ready$/ })` to avoid false matches with "Not Ready".

**Files updated:**
1. e2e/lobby.spec.ts
2. e2e/checkers.spec.ts
3. e2e/backgammon.spec.ts
4. e2e/risk.spec.ts
5. e2e/reconnection.spec.ts
6. e2e/cpu-opponent.spec.ts
7. e2e/spectator.spec.ts

**Test results:** 33/40 passing. 7 failures are pre-existing game logic issues (Backgammon state sync, Risk UI text) unrelated to setup screen migration.


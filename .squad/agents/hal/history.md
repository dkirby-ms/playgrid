# hal — History

## Core Context

**Project:** playgrid — Play classic games with friends (Studio: eschaton-studio, Created: 2026-03-14)

**Architecture (Approved):**
- Plugin-based games (each game implements IGamePlugin interface)
- Integrated spectators (same GameRoom, isSpectator flag)
- Single LobbyRoom for all game types
- PostgreSQL from day one (not SQLite migration)
- 3-phase scaling: Phase 1 (single process), Phase 2 (multi-process 50+ concurrent), Phase 3 (multi-server)
- Colyseus 0.16, PixiJS 8, strict TypeScript
- Game implementation order: Checkers → Backgammon → Dominoes → Poker → Hearts/Spades → Chess → Risk

**Cloud Infrastructure (Approved):**
- Azure Container Apps (Consumption plan, Phase 1: single replica)
- PostgreSQL Flexible Server from day one
- GitHub Actions CI/CD (adapted from primal-grid reference)
- Phase 2: Redis for Colyseus RedisPresence, Static Web Apps for CDN
- Cost: Phase 1 ~$20-30/mo, Phase 2 ~$90-140/mo

**Current Codebase:**
- Server: Working LobbyRoom + skeleton GameRoom (tick-based, no game logic)
- Client: Monolithic index.ts (PixiJS app + HTML lobby/waiting overlays)
- Shared: Player/GameState schemas + lobby message types
- Monorepo with npm workspaces, vitest, TypeScript strict mode
- Lobby test suite: 431 lines (quality baseline)
- No Dockerfile, no CI/CD, no game plugin system yet

**Backlog (Approved - 38 items):**
- P0 (7): Env config, static serving, PostgreSQL connection, DB schema, Dockerfile, CI, lint
- P1 (16): Plugin system (4), Checkers logic (4), Client architecture (5), Renderer (3)
- P2 (15): Deployment pipelines, persistence, reconnection, spectators, second game, docs, monitoring

**Critical Path:** env-config → static-serving → shared-game-types → base-game-state → base-game-room → checkers-plugin → e2e-checkers

**Team Assignments:**
- Pemulis: 10 items (P0 + P1A server infra) — start with env-config
- Gately: 11 items (P1B–D game logic + client + renderers) — start with scene-manager
- Marathe: 5 items (CI/CD + Docker + Bicep) — start with ci-pipeline
- Steeply: 6 items (tests, blocked until code lands)
- Joelle: 2 items (docs, blocked on P1 stability)

---

## Cross-Agent Update — PR #121 & #122 Reviews Complete (2026-03-16)

**Event:** Both PRs approved and merged to `dev` after lockout protocol

- **PR #121 (CPU opponents, Issue #86):** First rejection → re-review approved (Marathe cleaned promote.yml scope leak via rebase) → Merged
- **PR #122 (Head-to-head mode, Issue #115):** First rejection → second rejection (Pemulis fixed synthetic lifecycle) → third review approved (Steeply added timeout regression test) → Merged
- **Decisions merged:** 7 inbox decisions now in `.squad/decisions.md`
- **Cross-agent:** Lockout protocol executed (Gately → Pemulis → Steeply chain on PR #122)

---

## Session Logs

### 2026-03-14: Cross-Agent Architecture Alignment
- Pemulis: game-systems-design.md (TypeScript interfaces, per-game analysis, hidden-info architecture)
- Gately: client-architecture.md (scene management, renderer plugin system, asset requirements)
- Hal: Validated alignment across all three agents on plugin architecture, scaling strategy, game order
- User answer: PostgreSQL from day one (not SQLite migration), primal-grid as CI/CD reference

### 2026-03-14: Architecture Documents Updated
- Updated docs/architecture-plan.md with PostgreSQL decision, Azure Container Apps strategy (Section 2.1)
- game-systems-design.md and client-architecture.md validated (no updates needed)

### 2026-03-14T13:08:51Z: Backlog Decomposition
- Decomposed full project into 38 work items across P0/P1/P2
- Created docs/backlog.md with all items, dependencies, role assignments
- Key decisions: P0 infrastructure-only, GameRoom preservation, 3 parallel work streams
- All agents can now pick up work from backlog (no blockers identified)

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.

## Session: E2E Test Suites (Lobby & Checkers) (2026-03-14)

**Status:** ✅ Complete  
**PRs Merged:** #57 (E2E Lobby tests), #58 (E2E Checkers tests)  
**Issues Closed:** #52, #53  
**Session Log:** `.squad/log/2026-03-14T18-10-00Z-e2e-tests.md`

**Work Completed:**
- **Steeply:** Wrote comprehensive E2E test suites for Lobby (PR #57) and Checkers (PR #58)
- **You (Hal):** Reviewed both PRs, approved both, documented testing strategy decisions
- **Coordinator:** Resolved merge conflicts in Application.ts, merged both PRs to dev

**Key Decisions Approved:**
1. **Grey Box E2E Pattern** — All game plugins must use Playwright for UI + `window.__PLAYGRID_E2E__.app.gameRoom` harness for moves. Assertions on server state, not pixel output.
2. **Dedicated Lobby Config** — `playwright.lobby.config.ts` isolates lobby tests from unrelated specs.
3. **PR Review Gate** — PRs targeting `dev` must be independently reviewable; no unrelated commits from stacked branches without rebase.

**Pattern Established:**
- Checkers E2E (PR #58) is the canonical template for all future game plugins (Backgammon, Dominoes, Poker, etc.)
- Grey Box E2E approach documented in decisions.md and session log

**Cross-Agent Impact:**
- **Gately:** Checkers E2E gates game rendering work; PR #55 (room status HUD) is tested and merged
- **Pemulis:** Plugin system design should reference Grey Box E2E; each plugin author must expose `window.__PLAYGRID_E2E__.app.gameRoom`
- **Future:** Template available for all game plugin E2E testing


## Cross-Agent Update — Wave 1 Complete (2026-03-14T18:55:06Z)

**From:** Squad Scribe  
**Event:** Wave 1 orchestration completed (8 PRs merged, 0 blockers, 1 conflict resolved)

**PRs Merged to dev:**
- PR #60: Deploy Dev (Marathe)
- PR #61: Player Reconnection (Pemulis) — **Issue #35, #59 closed**
- PR #62: Developer Docs (Joelle)
- PR #63: Deploy UAT (Marathe)
- PR #64: Plugin Dev Guide (Joelle)
- PR #65: Deploy Prod (Marathe)
- PR #66: Backgammon Plugin (Gately)
- PR #67: Game Persistence (Pemulis) — rebased & merged after conflict with #61

**Key Achievements:**
- Reconnection infrastructure now live (WebSocket heartbeat + 30s grace period)
- All 3 deployment pipelines implemented
- Backgammon plugin successfully integrates with reconnection system
- Developer onboarding docs complete

**Cross-Agent Notes for You:**
- Pemulis's reconnection solution is now the foundation for all game plugins
- Gately's Backgammon seamlessly integrated with reconnection
- Marathe's deployment pipelines are ready for prod rollout
- Joelle's plugin dev guide should help future game authors

**No blockers going forward.** All agents ready for Wave 2 assignments.


## Learnings

- **Randomness in Tests:** Risk combat tests failed 42% of the time due to low sample size. Random mechanics need robust buffers (20 vs 1 army) or mocks. Fixed in PR #83.


### Wave 4 PR Reviews (2026-03-14)

**Session:** Reviewed and merged 4 draft PRs targeting dev branch in dependency-safe order

**PRs Merged:**
1. **PR #68 (Marathe) — Azure Bicep infrastructure-as-code:** Comprehensive IaC for dev/uat/prod environments. Key review points: proper RBAC (AcrPull, Key Vault Secrets User), managed identity instead of admin credentials, OIDC for GitHub Actions, environment-specific resource sizing, health probes configured. Security posture solid. ✅ Approved, merged cleanly.

2. **PR #69 (Steeply) — Backgammon logic and plugin tests:** 83 comprehensive tests covering pure logic functions, movement rules, bar re-entry, bearing off, edge cases. Test patterns follow Checkers E2E template. Excellent coverage of backgammon-specific rules (forced re-entry, exact dice vs. higher dice for bearing off). ✅ Approved, merged cleanly.

3. **PR #70 (Gately) — Backgammon renderer (client):** 1400+ line procedural renderer following GameRenderer pattern. Review highlights: proper RendererRegistry integration, procedural graphics (no assets), spectator-safe (read-only state observation), LobbyScreen integration for game type selection. Merge conflict with #68 (infra) and #69 (tests) — resolved via git merge, all tests passed. ✅ Approved, merged after conflict resolution.

4. **PR #71 (Pemulis) — Spectator mode:** Server + client spectator support. Key changes: `maxClients = maxPlayersConfig + 100` (100 spectator slots), `isSpectator` flag prevents actions, LobbyRoom validates spectator joins (only in_progress games), client "Watch" button. **Test failure identified:** BaseGameRoom.test.ts expected `maxClients = 3` but got `103`. Fixed by updating test expectation and adding explanatory comment. Merge conflict with #70 (renderer) — resolved via git merge, all tests passed. ✅ Approved, merged after test fix and conflict resolution.

**Review Standards Applied:**
- Bicep: Verified secure resource definitions, proper parameterization, RBAC over credentials
- Tests: Verified edge case coverage, test isolation, Vitest patterns
- Renderer: Verified GameRenderer interface compliance, procedural rendering, RendererRegistry integration
- Spectator: Verified isSpectator action rejection, maxClients handling, lobby integration

**Conflict Resolution Pattern:**
- When gh pr merge fails with "not mergeable", use: `gh pr checkout {N} && git fetch origin dev && GIT_EDITOR=true git merge origin/dev && git push`
- Always verify CI passes after conflict resolution before final merge

**Test Failure Handling:**
- Pre-existing failures (mentioned by team) are acceptable to merge through
- New failures introduced by PR changes must be fixed before merge
- PR #71 introduced a new test failure due to legitimate implementation change — fixed by updating test expectation to match new behavior

### Wave 5 PR Reviews (2026-03-14)

**Session:** Reviewed and merged 4 P2 draft PRs targeting dev branch — all clean merges, no conflicts

**PRs Merged:**
1. **PR #72 (Steeply) — Game persistence layer tests:** 453 lines of comprehensive unit tests for gameRepository (createGame, endGame, addParticipant). Key review points: proper mock patterns, extensive edge case coverage (concurrent operations, constraint violations, null handling, database failures), clean separation of concerns. All tests use vi.fn() mocks for database isolation. ✅ Approved, merged cleanly.

2. **PR #73 (Marathe) — Discord webhook composite action:** DRY refactor extracting 180+ lines of duplicated curl logic into reusable `.github/actions/discord-notify/action.yml`. Review highlights: proper composite action pattern, enhanced notification fields (deployment URL, shortened SHA, workflow links), uses `if: always()` with `${{ job.status }}` for cleaner conditional logic, consistent Discord embed format across all envs. Net -22 lines, significant maintainability win. ✅ Approved, merged cleanly.

3. **PR #74 (Gately) — Client connection manager:** Clean extraction of Colyseus connection logic from Application.ts into dedicated ConnectionManager class. Review highlights: state machine (DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING), exponential backoff reconnection (max 5 attempts, 1s-30s delays), event-driven architecture for state changes and errors, proper cleanup in Application.ts (removed duplicate onError handlers). Complements server-side reconnection (PR #61). ✅ Approved, merged cleanly.

4. **PR #75 (Pemulis) — Application Insights integration:** Azure Application Insights telemetry for server observability. Review highlights: graceful no-op when APPLICATIONINSIGHTS_CONNECTION_STRING not configured (local dev friendly), tracks 6 custom lifecycle events (room_created, player_connected/reconnected/disconnected, game_started/ended), process-level exception tracking (unhandledRejection, uncaughtException), all tracking wrapped in try/catch to prevent game disruption. Added `applicationinsights@3.14.0` dependency. ✅ Approved, merged cleanly.

**Review Standards Applied:**
- Tests (PR #72): Verified comprehensive mock patterns, concurrent operation handling, error path coverage, test isolation
- Discord webhook (PR #73): Verified composite action best practices, webhook format consistency, secret handling, proper use of `${{ job.status }}`
- Connection manager (PR #74): Verified state machine correctness, exponential backoff algorithm, clean extraction from Application.ts, event listener patterns
- App Insights (PR #75): Verified graceful degradation, custom event selection, no performance impact (async telemetry), proper exception context tracking

**All merges successful, no conflicts, no test failures.** Clean Wave 5 completion.

### PR #78 Review — E2E Test Suite Stabilization (2026-03-14)

**Session:** Reviewed and merged Steeply's E2E test fixes (issue #77)

**PR #78 (Steeply) — E2E test suite stabilization:** Squash merged to dev (commit c740333)

**Primary Changes:**
- **Lobby E2E order-independence:** Replaced global empty-state assertions (`.lobby-empty-row`) with row-scoped checks using `gameRow(page, uniqueName)`. Tests now only verify their own game row, not global lobby state.
- **Test isolation rationale:** Full `npx playwright test` runs checkers E2E before lobby E2E against one shared server. Checkers legitimately leaves in-progress sessions visible, making global empty assertions brittle.
- **Documentation:** Added reusable skill pattern (`.squad/skills/order-independent-lobby-e2e/SKILL.md`) and decision doc for future E2E authors.

**Application.ts Conflict Resolution:**
- Steeply's branch included ConnectionManager import fix, but Gately already fixed this directly on dev (commit 413aa35)
- Rebase on dev auto-resolved cleanly — both fixes were byte-for-byte identical
- No manual conflict resolution needed

**Review Assessment:**
- ✅ E2E pattern is sound: row-scoped assertions prevent test coupling
- ✅ Selectors are stable: uses `gameRow(page, gameName)` helper for consistent locators
- ✅ Timing handled properly: no flaky waits, existing patterns sufficient
- ✅ Documentation: skill captures reusable pattern for future game E2E tests

**Merge Process:**
1. Checked out branch `squad/77-fix-e2e-tests` and rebased on dev — clean rebase (auto-resolved Application.ts)
2. Force-pushed rebased branch: `git push --force-with-lease`
3. Verified build + tests: 10 test files, 189 tests passed (expected PostgreSQL connection errors ignored — no DB running locally)
4. Marked PR ready: `gh pr ready 78`
5. Squash merged: `gh pr merge 78 --squash --delete-branch`
6. Closed issue #77: `gh issue close 77`

**Key Learnings:**
- When two branches fix identical bugs, git rebase auto-resolves without conflicts
- Shared Playwright server requires order-independent test assertions
- Row-scoped E2E assertions > global state checks for robustness
- Skill pattern docs help standardize testing practices across game plugins

## Session: E2E Test Suite Fix & ConnectionManager Import (2026-03-14)

**Agents:** Steeply (E2E fix), Gately (support), Hal (lead review + merge)

### What Happened

Steeply fixed order-dependent E2E test assertions by making them row-scoped. During the process, Gately fixed missing ConnectionManager import. Hal reviewed both changes, rebased on dev (auto-resolved conflict with Gately's fix), squash-merged, and closed issue #77.

**Hal's Leadership:**
1. **Code Review:** Approved PR #78
   - Validated lobby E2E pattern (row-scoped, order-independent)
   - Validated ConnectionManager import fix
   - Assessed testing approach and best practices

2. **Git Rebase:**
   - Rebased PR #78 on dev
   - Auto-resolved merge conflict with Gately's earlier commit (413aa35)
   - No manual intervention needed

3. **Verification:**
   - Full test suite: 189 tests passing ✓
   - No regressions ✓

4. **Merge & Issue Closure:**
   - Squash-merged PR #78 as c740333
   - Closed issue #77
   - Branch deleted automatically

**Decisions Made:**
- Lobby E2E tests must use unique names + row-scoped assertions
- E2E suite should be order-independent and runnable in any order
- Recorded in decisions.md for team reference

**Cross-Team Impact:**
- E2E infrastructure is now stable
- Future game E2E tests should follow this pattern
- No more flaky test failures due to test ordering

## 2026-03-15 Update (Shared CAE Infrastructure)
- **Infrastructure Decision Merged:** UAT and prod now share Container Apps Environment (`playgrid-shared-cae`) and Log Analytics workspace (`playgrid-shared-logs`) for cost optimization and deterministic convergence. Dev maintains isolated CAE.
- **Scaling Alignment:** This aligns with the approved single-replica Phase 1 strategy; scales cleanly when multi-server support arrives
- **Related:** Marathe's Bicep restructure enables conditional CAE creation via `containerAppEnvResourceId` parameter

## 2026-03-15 — Issue #80 Triage: Risk Game Plugin

**Triaged Issue:** #80 — "Add Risk game plugin" (opened by dkirby-ms)

**Complexity Assessment:** HIGH  
**Assignment:** Pemulis (game systems) + Gately (rendering)  
**Status:** Ready for decomposition and sprint assignment

### Findings

Risk is materially more complex than existing games:

1. **Existing Games (Baseline):**
   - Checkers: 331 lines game logic + 223 lines plugin = 554 lines total server
   - Backgammon: 351 lines game logic + 295 lines plugin = 646 lines total server

2. **Risk Complexity Drivers:**
   - **Map & Territory System:** 42 territories + 6 continents (vs. Backgammon's 30 points or Checkers' 32 squares)
   - **Multi-Phase Turns:** Reinforce → Attack → Fortify with conditional transitions
   - **Stochastic Combat:** Dice resolution with cascading losses
   - **Card Mechanics:** Trade-in validation and set collection
   - **Setup Phase:** Territory selection + army placement UX (2–6 players)
   - **Visual Complexity:** 600+ line interactive map (vs. Backgammon's ~400 lines procedural renderer)

3. **Architectural Fit:**
   - ✅ Follows plugin pattern (BaseGameRoom + GamePlugin interface)
   - ✅ Pure logic separation testable
   - ✅ Spectator-safe (hidden info = opponent cards only)

### Assignment Rationale

- **Pemulis:** Risk game logic, turn manager, combat simulation, territory/card state management (~300–350 lines)
- **Gately:** Interactive map renderer, setup phase UI, phase/action HUD (~600+ lines procedural graphics)
- **Shared Effort:** Coordinate on setup phase (territory selection, initial placement) — requires both systems + rendering

### Decomposition Recommendation

Split into 3 sub-issues to manage scope:
1. **Core Game Logic & Plugin** (Pemulis) — no UI, pure mechanics
2. **Setup & Territory Management** (shared)
3. **Interactive Map Renderer** (Gately)

### Scope Clarifications Needed

⚠️ **Card mechanics partially specified.** Recommend clarifying:
- Standard Risk (5,4,3 + jokers) or custom?
- Card visual UI in Phase 1 or Phase 2?

Suggestion: Implement server-side validation, show card count only in Phase 1.

### Decision: Triage Completed

Added squad:pemulis and squad:gately labels. Posted triage comment with decomposition + scope recommendations. Ready for sprint assignment.

### PR #83 Review — Risk Game Plugin (2026-03-15)

**Session:** Reviewed "feat: Add Risk game plugin" (PR #83)

**Outcome:** ❌ Changes Requested

**Key Issues Identified:**
1.  **Missing Tests:** PR claimed 64 tests, but ~48 were `it.todo()` placeholders. Critical logic (combat, win conditions) untested.
2.  **Architectural Duplication:** `TerritoryData` existed in both Server (logic) and Client (renderer), risking desync.
3.  **Logic Simplifications:** Found 3 major deviations from Standard Risk (Card sets, Fortify paths, Attack movement) not explicitly documented as scope cuts.
4.  **Bundled Changes:** PR included unrelated Local PostgreSQL infrastructure (Marathe's work), complicating the review.

**Action Items:**
- Pemulis/Steeply: Implement missing tests for combat & movement.
- Pemulis/Gately: Refactor `territoryData.ts` to `shared/`.
- Hal: Clarify scope on Card mechanics and Fortify rules.

**Learnings:**
- Complex games like Risk require strict shared data models to prevent client/server drift.
- "Test count" metrics in PRs need verification against actual implementation (checking for TODOs).
- PRs bundling unrelated infra changes degrade review quality; enforce atomicity where possible.

## Cross-Agent Update — PR #83 Review Completed and Routed (2026-03-15)

**Event:** Risk game plugin review (PR #83) completed and revision work routed to Marathe

- **Review outcome:** Changes requested — identified 4 architectural gaps
- **Issues found:** Missing tests (48 of 64 were `it.todo()` placeholders), duplicated territory data, undocumented scope cuts, bundled infrastructure changes
- **Decisions created:** Four new game implementation standards for Risk and future games recorded in `.squad/decisions.md`
- **Routing:** PR revision routed to Marathe due to original author lockout (Pemulis, Steeply, Gately)
- **Impact:** Future game plugins must follow strict shared data models, explicit test implementation, and documented scope cuts

## PR #83 Approved and Merged (2026-03-15)

**Event:** Hal re-reviewed PR #83 after Marathe's revisions

- **Outcome:** ✅ APPROVED
- **Review scope:** Verified all four architectural standards met
  - Tests: All 60 tests now implemented (no `it.todo()` placeholders in critical logic)
  - Shared data: TerritoryData migrated to `shared/src/games/risk/`
  - Scope transparency: Phase 1 limitations explicitly documented
  - PR atomicity: Infrastructure changes separated
- **Blocker resolution:** Flaky random test fixed using robust implementation (sufficient sample sizes per new standard)
- **Action:** PR merged to dev (squash). Branch deleted. Issue #80 closed.
- **Follow-up triage:** Created issues #81 (test resilience, assigned to Gately+Pemulis) and #82 (rule scope documentation, assigned to Pemulis)
- **Impact:** Risk game plugin now ready for production. Test resilience and rule documentation standards established for future games.


## PR #92 Review — Lobby E2E Fix (2026-03-15)

**Session:** Reviewed "fix: Lobby E2E suite isolation" (PR #92)

**Outcome:** ✅ APPROVED

**Key Validation:**
- Fix properly addresses root cause of test isolation (issue #91)
- Test logic targets unique session created by test
- Uses current UI seams: player name input blur, create game modal, game card selector
- Button locators scoped to avoid label overlap (`Create Game`, `Ready`, `Start Game`)
- Makes suite order-independent and resilient to shared lobby state
- Aligned with current accessible UI (removes table-era assumptions)

**Action:** PR merged (squash). Branch deleted. Issue #91 closed.

**Decision Merged:** Steeply's lobby E2E test pattern decision recorded in `.squad/decisions.md`.

---

## E2E Test Readiness — Checkers Suite (2026-03-15)

**Cross-Agent Update from Steeply:**
- Checkers E2E tests created (`e2e/checkers.spec.ts`)
- Full game flow coverage: modal-based creation, card-based joining, lobby integration
- All tests passing
- PR #93 opened, awaiting review
- Follows patterns from PR #92 (current UI seams, scoped locators)

---

## PR #101 & #102 Review — Turn Timer & Error Display (2026-01-13)

**Session:** Reviewed and merged two PRs from Gately

### PR #101: Turn Timer Visibility ✅ MERGED
**Branch:** fix/turn-timer-visibility → dev

**Problem:** Turn countdown timer was invisible during gameplay despite HUD having display code.

**Solution:**
- Added `turnTimeRemaining: number` field to BaseGameState schema
- Server: TurnManager.getRemainingTimeSeconds() calculates remaining time
- Server: BaseGameRoom broadcasts updates every second via clock.setInterval()
- Client: GameScene extracts timer from state and passes to HUD
- HUD shows MM:SS format, red border when < 30 seconds

**Code Quality:**
- ✅ Clean end-to-end implementation leveraging Colyseus state sync
- ✅ Server is source of truth for time calculations
- ✅ Proper null-safe clock checks for test compatibility
- ✅ Good architectural pattern documented in Gately's history
- ✅ Build/lint/tests pass (259 passed, 12 todo)

**Files Changed:**
- shared/src/BaseGameState.ts
- server/src/game/TurnManager.ts
- server/src/game/BaseGameRoom.ts
- client/src/scenes/GameScene.ts

**Merge Notes:** Had conflicts with recent dev commits (PR #99). Resolved by merging origin/dev into feature branch before final merge.

### PR #102: Start-Game Error in Modal ✅ MERGED
**Branch:** fix/start-game-error-in-modal → dev

**Problem:** Error messages when starting game without enough players were hard to see (only changed button text briefly).

**Solution:**
- Added dedicated error display element in waiting room modal
- Red styling (rgba(248, 113, 113, 0.12) background, red border, red text)
- Auto-clears on player state updates and modal hide
- showError() and clearError() methods for control

**Code Quality:**
- ✅ Improves UX significantly - error is now prominent and clear
- ✅ Good design choice to keep error in context (modal) vs toast
- ✅ Auto-clear logic prevents stale errors
- ✅ Build/lint/tests pass

**Files Changed:**
- client/index.html (CSS for .waiting-room-error)
- client/src/ui/WaitingRoom.ts (error display logic)

**Merge Notes:** Required update after PR #101 merged. Both PRs touched WaitingRoom.ts, conflicts resolved cleanly.

**Overall Assessment:**
Both PRs demonstrate good engineering practices:
- Proper root cause analysis documented
- Clean implementations without over-engineering
- Tests maintained
- Architectural patterns established and documented


---

## PR #103 Review — Lobby Activity Feed (2026-03-15)

**Session:** Reviewed "feat: add lobby event message log" (PR #103, by Gately)

**Outcome:** ✅ APPROVED & MERGED

**Feature Summary:**
Real-time activity feed in lobby showing:
- Player joins/leaves (green/gray borders)
- Game creation (purple)
- Game starts (orange)
- Game finishes (blue)
- Player joining games (purple variant)

**Code Quality Assessment:**

✅ **Architecture:**
- Clean server-client event flow using LOBBY_LOG_EVENT message
- Server is source of truth for all events
- Proper type safety with LobbyLogEntry in shared types
- Consistent with existing event patterns (GAME_UPDATED, ONLINE_PLAYERS, etc.)

✅ **Memory Management:**
- 50-message limit implemented (maxMessages)
- FIFO eviction when limit exceeded
- Efficient array-based storage

✅ **UI Implementation:**
- MessageLog class encapsulates all log behavior
- Auto-scrolls to bottom on new messages
- Color-coded borders by event type (semantic visual feedback)
- Styled scrollbar matches existing design system
- Timestamp formatting (HH:MM)

✅ **Event Coverage:**
- Player lifecycle: player_joined, player_left
- Game lifecycle: game_created, game_started, game_finished
- Player-game interactions: player_joined_game
- All key lobby events captured

✅ **Type Safety:**
- LobbyLogEventType union properly defined
- LobbyLogEntry interface consistent across client/server/shared
- Import from @eschaton/shared in MessageLog.ts

✅ **Testing:**
- Test mock updated with LOBBY_LOG_EVENT constant
- All tests pass (259 passed, 12 todo)
- Lint and build successful

**Files Changed:**
- client/index.html — Activity feed panel styles (91 lines CSS)
- client/src/ui/LobbyScreen.ts — MessageLog integration, event handler
- client/src/ui/MessageLog.ts — New class for message rendering (79 lines)
- server/src/rooms/LobbyRoom.ts — Event broadcasting at all key points
- shared/src/lobbyTypes.ts — LobbyLogEntry and LobbyLogEventType types
- server/src/__tests__/lobby-pregame.test.ts — Mock updated

**Design Strengths:**
1. **Encapsulation:** MessageLog is self-contained with clear API (addMessage, clear, destroy)
2. **Performance:** Bounded memory usage prevents growth issues in long-running lobbies
3. **UX:** Color-coding and emojis make events easy to scan at a glance
4. **Consistency:** Follows established patterns from existing panels (Active Games, Online Players)
5. **Maintainability:** Event broadcasting centralized in LobbyRoom private method

**Merge Details:**
- Squash merged to dev
- Branch feat/lobby-message-log deleted (local + remote)
- No conflicts, clean fast-forward

**Impact:**
Lobby now provides real-time situational awareness. Players can see activity without manually checking panels. Excellent addition to the pre-game experience.


## Session: Redesign Package Analysis & Decomposition (2026-03-15)

**Status:** ✅ Complete  
**Deliverables:**
- Comprehensive implementation plan: `/home/saitcho/.copilot/session-state/8d799195-d99c-423c-adab-b96d65264eaa/plan.md`
- Architectural decision: `.squad/decisions/inbox/hal-redesign-decomposition.md`

**Context:**
User provided redesign package at `docs/designs/redesign/` with React/Tailwind reference implementations for:
- Lobby redesign (181 lines)
- Game redesigns: Checkers (272 lines), Backgammon (325 lines), Risk (385 lines)
- New games: Scrabble (364 lines), Hungry Hippos (373 lines), Catan (415 lines)

**Key Decisions:**

1. **Sidebar Architecture:** Create separate `GameSidebar.ts` component (not expand HUD)
   - Separation of concerns: HUD = top-bar status, Sidebar = game-specific panels
   - Game-specific customization via panel API
   - Files: `client/src/ui/GameSidebar.ts`, per-game sidebars in `client/src/games/*/`

2. **Design System Extraction:** Centralized reference documents
   - `docs/design-system.md` — human-readable color palette, typography, visual patterns
   - `client/src/renderers/DesignTokens.ts` — PixiJS hex constants
   - Dark zinc/violet theme, glass-morphism patterns, player color system

3. **New Game Order:** Complexity-based sequencing (simplest → hardest)
   - Scrabble (grid-based, 10 days) → Hungry Hippos (real-time, 15 days) → Catan (hex grid, 24 days)
   - Rationale: Validate patterns early, learn lessons before most complex game

4. **Risk Renderer:** Fix crash bugs (4.1) before visual redesign (4.4)
   - Stability first, visual polish second
   - Time-box investigation to 3 days

5. **Ship Strategy:** 5 incremental milestones (not big-bang)
   - M1: Design + Lobby + Sidebar (3 weeks)
   - M2: Existing game visuals (2 weeks)
   - M3: Scrabble (2 weeks)
   - M4: Hungry Hippos (3 weeks)
   - M5: Catan (4-6 weeks)

**Parallelization Strategy:**
- Stream A: Design System + Lobby (low risk, UI agent)
- Stream B: Sidebar System (medium risk, UI agent)
- Stream C: Visual Redesigns (high risk, renderer agent)
- Stream D/E/F: New Games (independent, full-stack agents)
- Potential: 4 agents working simultaneously

**Complexity Estimates:**
- Total: 82 days (16 weeks)
- With 1 dev: 4-5 months
- With 2 devs: 2-3 months
- With 4 devs: 6-8 weeks

**Risk Assessment:**
- High Risk: Risk crash (unknown scope), Catan complexity, Hungry Hippos physics
- Medium Risk: Sidebar integration, Backgammon visual (large file)
- Low Risk: Design extraction, Lobby redesign, Scrabble

**Files Created:**
- 17 new files (design system, sidebars, 3 new games × 3 files each)
- 5 modified files (lobby, HUD, 3 game renderers)

## Learnings

### Architecture Patterns

1. **Sidebar Component Pattern**
   - When UI grows complex, separate concerns rather than expanding monolithic components
   - Panel API (`addPanel(id, title, content)`) provides clean extension point
   - Game-specific sidebars in `client/src/games/*/` co-located with game logic

2. **Design System Bridge**
   - React/Tailwind designs → PixiJS requires translation layer
   - Dual artifacts: human docs + typed constants
   - Color conversion: oklch → hex for PixiJS, CSS variables for HTML/DOM

3. **Visual Design Language**
   - Dark theme: zinc-900 base, violet-950 accents
   - Glass-morphism: `bg-zinc-800/50 backdrop-blur-sm`
   - Piece gradients: 3-color (`from-X via-Y to-Z`) with inner highlight for glossy effect
   - Hover effects: scale-105, brightness-110, shadow-violet-500/20

4. **New Game Complexity Tiers**
   - Simple: Grid-based, turn-based (Checkers, Scrabble)
   - Medium: Real-time input, physics/animation (Hungry Hippos)
   - Complex: Hex grids, resource management, multi-phase (Risk, Catan)

### User Preferences

1. **Incremental Delivery:** User prefers shipping in milestones over big-bang releases
2. **Visual Priority:** Design system and lobby refresh are high priority (quick wins)
3. **Stability First:** Fix crash bugs before visual polish

### Key File Paths

- Design reference: `docs/designs/redesign/src/app/pages/*.tsx`
- Design system: `docs/designs/redesign/src/styles/theme.css`
- Existing renderers: `client/src/renderers/*.ts`
- Game sidebars: `client/src/games/*/\*Sidebar.ts` (new pattern)
- Shared schemas: `shared/src/games/*/\*State.ts`
- Server rooms: `server/src/rooms/*Room.ts`

### Technical Insights

1. **PixiJS Gradients:** Use `FillGradient` for multi-color piece effects (already in CheckersRenderer)
2. **Glass-morphism CSS:** `backdrop-blur-sm` requires browser support, fallback to solid bg
3. **Hex Grid Math:** Catan will need axial/cube coordinate system for hex layout
4. **Real-time Physics:** Hungry Hippos may need hybrid client prediction + server authority
5. **Word Validation:** Scrabble needs dictionary (SOWPODS or TWL), decide client vs server validation


---

## 2026-03-16: PR Review (Round 3) + Issue Scoping

**Event:** Round 3 orchestration — PR merges & scoping decisions

**Work Completed:**
- PR #118 (footer): approved, merged
- PR #119 (Backgammon dice): approved, merged
- Issue #115 (head-to-head): scoped, decision posted, approved
- Issue #100, #97: closed (stale)

**Decisions Made:**
1. PR #118 & #119 both merge-ready (low-risk, tests pass)
2. Issue #115: proceed with client-side view switching (Checkers MVP, Backgammon Phase 2, ~1.5–2 days, low risk)

**Context Propagated:**
- Action validation pattern (validateAction hook) confirmed consistent across Checkers & Backgammon
- Head-to-head scoping affects client team (Gately) — no server changes needed

**Next Steps:**
- Assign #115 to Gately (client-side renderer logic)
- Assign #86 to Pemulis (server-side CPU opponent)

## Learnings
- **Head-to-Head Mode Lifecycle:** Synthetic players (shared device) require explicit cleanup in *all* departure paths, including reconnection timeouts. The initial implementation missed the timeout branch, leading to orphaned state.
- **Testing Timers:** Regression tests for reconnection windows must explicitly verify side effects (like synthetic player removal) after the timeout promise rejects.

## Issue #87 Triage: CPU Opponents in Backgammon

### Learning: CPU Opponent Pattern

**File structure:**
- Game-specific CPU module: `server/src/games/{game}/CpuOpponent.ts`
- Exports a single `selectCpuMove(state: GameState): Move | null` function
- Uses game logic utilities (validation, move application) to score candidate moves

**Integration:**
- No changes to `BaseGameRoom.ts` needed (already generic for CPU turns)
- `BaseGameRoom.isCpuTurn()` checks if player is `CPU_OPPONENT_SESSION_ID` and game is "checkers"
- When CPU turn arrives, `executeCpuTurn()` calls `selectCpuMove()` and processes the move via the action handler
- CPU move strategy in Checkers: Score moves by capture priority (1000 points), king promotion (100), and advancement toward opponent's side

**Backgammon adaptations:**
- Scoring will differ: prioritize bearing off pieces, avoid/minimize blots (exposed pieces vulnerable to capture)
- Use existing `backgammonLogic.ts` move validation and application functions
- Pattern is proven; low risk implementation for Pemulis

### Decision: Route to Pemulis

Per routing.md: "Game systems" → Pemulis. CPU opponent is pure simulation/AI — not rendering (Gately) or testing framework (Steeply).

**Label assigned:** `squad:pemulis`

## 2026-03-16: Issue #87 Completion — PR #125 (Backgammon CPU)

**Status:** Completed by Pemulis  
**PR:** #125 (draft)

Pemulis successfully implemented CPU opponent for Backgammon following the Checkers pattern from PR #121. Also generalized the BaseGameRoom CPU framework to support multiple games without game-specific gates.

**Key Changes:**
- `server/src/games/backgammon/CpuOpponent.ts` — Scoring heuristic (bear off > blots > points > advance)
- `server/src/game/BaseGameRoom.ts` — Widened CPU support gate, split executeCpuTurn into dispatchers
- 8 new tests, all 286 tests passing

**Ready for:** Code review (Hal), merge decision pending


### PR #125 Re-Review — Backgammon CPU No-Valid-Moves Fix (2026-03-16)

**Session:** Re-reviewed PR #125 after Gately's fix for the no-valid-moves forfeit bug
**Verdict:** APPROVED and merged to dev

**Bug:** `selectCpuAction` returned `null` when CPU had no valid moves after rolling dice, triggering `handleTurnTimeout` which forfeited the game.

**Fix (Gately):**
- Added `pass` action to BackgammonPlugin — resets dice, ends turn (`endsTurn: true`)
- CPU returns `{ actionType: "pass" }` instead of `null`
- Validation rejects pass when valid moves exist or dice not rolled (anti-abuse)
- 3 new plugin tests + 2 updated CPU tests

**Verification:** All 289 tests pass, build clean, lint clean (0 errors).

## Learnings

- **Null returns from CPU action selectors are dangerous.** When a game has multi-step turns (roll → move), the CPU action selector must always return a valid action type. The `null` path in BaseGameRoom triggers forfeit. Games with no-move situations (backgammon, chess stalemate) need explicit pass/skip actions in the plugin.

---

## 2026-03-16: PR #132 Review — Dev Sandbox Feature

**Status:** APPROVED  
**Reviewer:** Hal  
**Branch:** origin/squad/sandbox-dev-tool  
**Author:** Gately

### Review Summary

Gately implemented the Game Dev Sandbox (Issue #130) — a development-only testing tool for rendering game boards with mock state, no server connection. Sandbox provides live state tweaking via an HTML panel overlay, enabling rapid renderer prototyping and debugging.

### Scope Compliance

Checked against `.squad/decisions/inbox/hal-sandbox-scope.md`:

**✓ Architecture:**
- SandboxScene mounts renderer with plain JS objects (not Colyseus Schema)
- Route detection in Application.ts for `/sandbox/{game}` patterns
- HTML overlay panel (separate from PixiJS) for state controls
- Zero pollution of existing GameScene, LobbyScene, WaitingRoomScene
- All sandbox code isolated in `client/src/sandbox/` + new `client/src/scenes/SandboxScene.ts`

**✓ Type Safety:**
- Renderers already use optional chaining (`state?.board`, `state?.territories?.get()`) — verified in CheckersRenderer, BackgammonRenderer, RiskRenderer
- Mock state interfaces define all required fields
- GameRendererContext.room passed as `undefined` — renderers handle gracefully
- No unsafe casts

**✓ State Mutation:**
- Mock state is plain JavaScript objects (not Schema instances)
- Mutations local to browser only; no network calls
- StatePanel re-renders visuals after mutation via `renderer.onStateChange(state)`

**✓ Memory Leaks:**
- SandboxStatePanel.destroy() removes DOM element, nulls callback
- SandboxScene.cleanup() properly nulls renderer, statePanel, currentState
- Container.removeChild() called before null
- cleanup() invoked on onExit()

**✓ Build Passes:**
- `npm run build`: ✓ PASS (778 modules, 2.05s)
- `npm run lint`: ✓ PASS (0 new errors, pre-existing warnings only)
- `npm run test`: ✓ PASS (289 passed, 12 todo)

**✓ Renderer Compatibility:**
- Checkers: Full visual board editor (click to cycle pieces)
- Backgammon: JSON textarea editor
- Risk: JSON textarea editor
- All renderers handle `room: undefined` in context

**✓ Per-Game Controls:**
- Checkers: Full visual board editor + mustCaptureFrom input
- Backgammon: JSON editor for points, dice, bar, borne-off
- Risk: JSON editor for territories, phases

**✓ MVP Scope:**
- Route detection ✓
- Mock generators for all 3 games ✓
- State panel for Checkers ✓
- State panel UI for Backgammon/Risk (MVP JSON) ✓
- No persistence / validation (as scoped) ✓

### Code Quality

**Strengths:**
1. Clean separation of concerns (PixiJS renderer + HTML dev tools)
2. SandboxScene properly implements Scene interface
3. Error handling for missing gameType / renderer
4. No hardcoded dependencies on production game code
5. Decision doc clear and well-reasoned

**No Issues Found:**
- No unsafe casts or undefined references
- No event listener leaks
- No console spam or debug code
- No secrets or sensitive data
- No production code changes beyond route detection

### Verdict

**✅ APPROVED**

This PR implements the sandbox exactly as scoped. The architecture is clean, type-safe, and zero-risk to production. Renderers already support plain JS objects via optional chaining. All validation checks pass.

### Learnings

- **Optional Chaining Adoption:** Playgrid renderers were already designed to handle both Colyseus Schema and plain objects via optional chaining. The sandbox leverages this pattern cleanly without requiring any renderer changes. This is a sign of good forward-thinking design during the renderer architecture phase.
- **HTML Overlay for Dev Tools:** The decision to use HTML/CSS forms for state controls (not PixiJS UI) is pragmatic. Dev tools don't need to be polished; speed of implementation matters more. Future iterations can add PixiJS-native controls if needed, but for MVP, HTML is the right call.
- **Scene Isolation:** By treating sandbox as a full Scene (not a modal on top of the game), Gately avoided the complexity of UI layering and state management within GameScene. Clean separation enables easy on/off and no side effects.

---

## 2026-03-16: PR #138 Review — CPU Opponent E2E Tests (Issue #131)

**Status:** ✅ APPROVED  
**Reviewer:** Hal  
**Branch:** origin/squad/131-cpu-e2e  
**Author:** dkirby-ms (Steeply)

### Review Summary

Steeply delivered CPU opponent E2E tests — the final E2E gap issue. Six tests (717 lines) covering Checkers and Backgammon CPU creation, move response, and multi-turn progression. Includes minimal production code changes to enable Backgammon CPU in lobby validation.

### Key Findings

**Test Quality:** 
- ✓ 3 Checkers tests: creation, move response, multi-turn progression (dynamic move finding)
- ✓ 3 Backgammon tests: creation, move + roll response, multi-turn with pass action handling
- ✓ Proper grey-box pattern using `__PLAYGRID_E2E__` harness
- ✓ 19 uses of `expect.poll()` with generous timeouts (10s for CPU, 3s for moves)
- ✓ No hardcoded sleeps or race conditions

**Production Code (Critical Review):**
- Client: `supportsCpuOpponent()` extended from `checkers` to `checkers || backgammon` (1 line)
- Server: `shouldEnableCpuOpponent()` extended same way (1 line)
- Error message generalized to support future games
- Risk assessment: LOW — minimal change, leverages existing BaseGameRoom CPU logic (game-agnostic)

**Backgammon Pass Action:**
- ✓ Test scenario at line 659: "verify CPU handles all situations (moves and passes)"
- ✓ Explicit pass action sent when human has no valid moves
- ✓ Tests that CPU responds after pass, confirming no forfeit
- ✓ Covers the fix from PR #134

**Build & Validation:**
- ✓ `npm run build` — PASS (778 modules, 2.12s)
- ✓ `npm run lint` — PASS (0 new errors)
- ✓ `npm run test` — PASS (289 tests, all green)

### Learnings

**E2E Test Maturity:** Playgrid E2E suite is now comprehensive across 3 games. CPU tests demonstrate excellent pattern consistency — new test file reads exactly like existing checkers/backgammon specs. Team has settled on clean grey-box approach with proper polling. This is production-quality test infrastructure.

**Production Code at Scale:** When enabling features across games, the pattern is simple: extend one condition from game-specific to multi-game check. The fact that both Checkers and Backgammon CPU just work with the same lobby validation tells us the BaseGameRoom plugin architecture is doing its job correctly — games inherit what they need, no special wiring required.

**Risk of Minimal Changes:** Temptation is to overthink small PRs like this. But 2-line production changes that follow existing patterns and leverage battle-tested infrastructure (BaseGameRoom CPU logic) are actually LOWER risk than larger PRs. The review should confirm: (1) is this a recognized pattern? (2) does this extend it correctly? (3) are all tests green? Yes to all three → ship it.

### Verdict

**APPROVED** — This PR closes Issue #131 with excellent test coverage and safe, minimal production code changes. The E2E suite is now feature-complete for CPU opponents in both Checkers and Backgammon.

---

## Session 2026-03-16: Full Feature Completion & E2E Coverage Sprint

**Role:** Lead reviewer & architect  
**Key Reviews:** PR #125 (initial + re-review), #132, #133, #134, #135 (initial + re-review), #137, #138  
**Critical Decisions:** Backgammon pass action, sandbox architecture, E2E strategy for random games  

**Summary:**
- Triaged Backgammon CPU issue (#87) → assigned to Pemulis
- Reviewed PR #125, identified critical no-valid-moves bug → required "pass" action
- Locked out Pemulis, Gately applied fix, re-approved #125 → merged
- Scoped and reviewed dev sandbox MVP → merged #132
- Approved E2E coverage expansion (5 issues filed) → Steeply assigned
- Reviewed Backgammon E2E (#133) → approved & merged
- Reviewed Risk E2E (#135), found Promise.race flakiness → locked out Steeply, Pemulis fixed, re-approved & merged
- Reviewed Reconnection (#134), Spectator (#137), CPU opponents (#138) E2E tests → all approved & merged

**Key Achievement:** Led team through 7 PR reviews (2 rejections, both resolved on lockout protocol + re-review). E2E coverage expanded from ~20% to near-complete.

**Directives Captured:**
1. Backgammon pass action is valid game mechanic, not a workaround
2. Dev sandbox must stay in sync with real game renderers
3. E2E strategy for non-deterministic games: action pipeline verification, not deterministic replay

**Output:**
- Session orchestration log: `.squad/orchestration-log/2026-03-16T22-47-43Z-full-session.md`
- Session log: `.squad/log/2026-03-16T22-46-00Z-full-session.md`
- 7 PRs merged, 7 issues closed, 289 tests passing, 0 lint errors

---

## Session: Triage Game Requests #107 & #124 (2026-03-16T22:40:00Z)

**Event:** Triaged two open game feature requests; classified one as blocked, one as ready.

**Issue #107 (Scrabble):**
- **Status:** Blocked — Needs Clarification
- **Action:** Added triage comment requesting scope details
- **Reason:** Submission contains only the word "Scrabble"; no rules, player count, dictionary strategy, or rendering constraints. Word validation is architecturally critical and cannot be assumed.
- **Next:** Author must provide details before assignment to Pemulis + Gately.

**Issue #124 (Dominos):**
- **Status:** Ready for Work
- **Assigned to:** Pemulis (game systems) + Gately (rendering)
- **Labels:** `squad:pemulis`, `squad:gately`
- **Complexity:** Large (L) — Full plugin (server, shared, client) following proven Checkers/Backgammon pattern
- **Estimate:** ~1000–1500 lines (server plugin ~300–400, shared schema ~100–150, client renderer ~400–600, E2E tests ~200–300)
- **Blocked on:** Infrastructure stability (Checkers + Backgammon merged, reconnection live, E2E pattern proven)
- **Action:** Added detailed triage comment with execution plan (Phase 1: Pemulis server logic, Phase 2: Gately rendering, Phase 3: Steeply E2E tests)

**Decision Generated:** `.squad/decisions/inbox/hal-triage-new-games.md`
- Triage summary comparing both issues
- Execution plan for Dominos plugin (3-phase approach)
- Policy proposal: Require game requests to include rules summary, player count, complexity indicators, and dependencies

**Cross-Agent Context:**
- Pemulis + Gately are ready for this work immediately after Wave 4 PM review/merge (likely 2026-03-17+)
- This follows the Wave 4 pattern: new game plugin work is post-infrastructure-stable work
- E2E test strategy proven in PR #58 (Checkers tests by Steeply); Dominos tests will reuse that grey-box pattern


## Session 2026-03-17: E2E Test Failure Triage and Fix Marathon

**Event:** Extended multi-hour coordinated session to triage 15 failing E2E tests and drive fixes to 40/40 passing.  
**Role:** Lead Triager & Coordinator — Root cause analysis, assignment delegation, cross-agent sync  
**Output:** E2E suite 15/40 → 40/40, 292 unit tests passing, lint clean, zero regressions  

**Triaged Issues:**
1. **E2E Snapshot Extraction (6 specs)** — Phase 4 sidebar redesign broke `playerColorText`/`statusText` selectors → Fallback chain solution → Coordinator
2. **Risk Reinforcement Bug** — Turn advance before reinforcement calc → `onTurnStarted` lifecycle hook → Pemulis
3. **CPU Opponent Detection** — Schema-level boolean sync unreliable → Session ID detection pattern → Coordinator
4. **Spectator Cleanup** — Spectators not deleted from `state.players` on leave → Plugin-level fix → Steeply
5. **Reconnection Test Logic** — Host=Black assumption broke in multiplayer → `playMoveForCurrentTurn` helper → Steeply
6. **Risk Error Assertions** — Mismatched server responses → Coordinator alignment
7. **Backgammon Timeout** — 30s Playwright timeout insufficient for win sim → 180s timeout → Steeply

**Decisions Generated:** `.squad/decisions.md` (merged from inbox)
- `onTurnStarted` hook as canonical per-turn initialization for all plugins
- Game request triage gate policy (require scope, player count, complexity indicators)
- Dominos (#124) triaged as Large (L), ready for Pemulis + Gately after Wave 4

**Architecture Learnings Documented:**
- Colyseus MapSchema silently drops new boolean fields → Don't add schema-level feature flags; use session ID constants
- CPU detection pattern: `controllerSessionId === "cpu-opponent"` (not schema)
- Reconnection test pattern: `playMoveForCurrentTurn()` helper queries state for current turn, not assuming host=Black
- Fallback extraction chains for E2E snapshots when rendering moves elements between PixiJS/DOM

**Output:** 
- Session logs: `.squad/log/2026-03-17T12-31-26Z-e2e-fix-marathon.md`
- Orchestration logs: 4 agent logs in `.squad/orchestration-log/`
- All 40 E2E tests passing
- All 292 unit tests passing
- Lint clean
- Zero regressions
- Cross-agent coordination via orchestration logs and decisions.md


## 2026-03-17: PR #139 Review — Risk SVG Map (Completed)

**Session:** Single-agent review gate  
**Outcome:** ✅ APPROVED

**Review Summary:**
- PR #139 (squad/136-risk-svg-map → dev) passed full review
- Clean architecture: Map definition format separates geometry from rendering
- All 42 territories verified, correct adjacency, correct SVG parser
- Zero issues found

**Decision Logged:**
- Risk SVG Map Architecture decision merged to `.squad/decisions.md`
- Key rules: RiskMapDefinition canonical type, SVG path parser support (M/L/H/V/C/S/Q/T/Z), label z-ordering, symmetric adjacency requirement, ConnectionOverrides for custom topology

**Actions:**
- PR merged (squash) into dev
- Branch squad/136-risk-svg-map deleted
- Issue #136 closed

**Output:**
- Orchestration log: `.squad/orchestration-log/2026-03-17T14-55-20Z-hal.md`
- Session log: `.squad/log/2026-03-17T14-55-20Z-hal-pr139-review.md`
- Decisions updated: `.squad/decisions.md` (Risk SVG Map Architecture entry)


## 2026-03-17: PR #141 Review — Dominos (#124)

**Session:** Code review gate
**Outcome:** ❌ REJECTED — Request Changes

**Blocking Issue:**
- `stateFilter.filterForClient` is a no-op — returns full state to all clients
- `BaseGameRoom` never invokes `filterForClient` (dead interface infrastructure)
- No Colyseus `@filter`/`@filterChildren` decorators anywhere in codebase
- Result: All `DominosPlayerState.hand` tiles synced to every client — trivially cheatable via devtools
- Despite `hasHiddenInformation: true` in plugin metadata, no enforcement exists

**Non-Blocking Notes:**
- Double-scoring in action + checkGameEnd (works single-round, fragile if extended)
- No plugin-level action tests (pure logic well-tested at 779 lines)
- Module-level `boneyards` Map minor leak risk on abnormal disposal

**What's Good:**
- Clean logic/plugin separation pattern
- Boneyard correctly server-only (Map keyed by state instance)
- Thorough pure-logic tests
- Renderer follows established patterns, proper cleanup in destroy()

**Learnings:**
- The `StateFilter` interface in `shared/src/gamePlugin.ts` is dead code — defined but never consumed by BaseGameRoom
- First game with truly hidden information (checkers/backgammon are perfect-info, risk hidden-info not implemented)
- Colyseus schema filtering requires either `@filter`/`@filterChildren` decorators or manual serialization intervention — cannot rely on plugin-level filter functions without framework wiring
- SKILL.md documents can encode incorrect assumptions — verify claimed patterns against actual framework behavior

**Assignment:**
- Pemulis: Implement actual state filtering (framework-level or Colyseus decorators)
- Steeply: Add plugin action tests after filtering fix

**Output:**
- PR review comment posted on #141
- Decision: `.squad/decisions/inbox/hal-dominos-review.md`

## 2026-03-17: Reviewed PR #143 (UX Redesign)

**Status:** Approved (PR author self-review via CLI)

**Analysis:**
- **Code Quality:** Type-safe, correct schema access, proper cleanup.
- **Design:** Implementation matches Figma spec (Emerald/Slate palette).
- **Architecture:** "How to Play" panel pattern in `GameSidebar` is reusable and improves onboarding.

**Learnings:**
- **Design-First Workflow:** The Figma → React → Live implementation pipeline yields high fidelity results quickly.
- **Onboarding Pattern:** The "How to Play" sidebar panel should be standard for all games (Checkers, Backgammon, etc.) moving forward.

**Output:**
- PR review comment posted on #143

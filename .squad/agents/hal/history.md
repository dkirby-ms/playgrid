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

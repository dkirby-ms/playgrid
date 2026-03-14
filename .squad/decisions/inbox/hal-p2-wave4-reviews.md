# Wave 4 PR Review Summary — Hal

**Date:** 2026-03-14  
**Reviewer:** Hal (Lead)  
**PRs Reviewed:** 4 (all targeting `dev`)

---

## PR #68 — Azure Bicep Infrastructure (Marathe)

**Status:** ✅ APPROVED & MERGED  
**Branch:** `squad/32-azure-bicep`  
**Closes:** #32

### Review Summary

Comprehensive infrastructure-as-code implementation for PlayGrid deployment across dev/uat/prod environments.

**Strengths:**
- **Security-first design:** System-assigned managed identity with RBAC (AcrPull, Key Vault Secrets User) — no stored credentials
- **OIDC authentication:** GitHub Actions uses federated identity, not long-lived secrets
- **Environment parameterization:** Dev/UAT use Burstable SKU, Prod uses GeneralPurpose with longer backup retention
- **PostgreSQL from day one:** Aligns with team decision; no SQLite migration needed
- **Health probes:** Liveness + readiness at /health endpoint ensures Container App responsiveness
- **Key Vault integration:** Connection strings retrieved via managed identity, not environment variables

**Architecture Alignment:**
- Single replica (Phase 1 constraint)
- Consumption workload profile (cost-optimized)
- Ready for Phase 2 scaling (Redis + multi-replica) when needed

**Merge:** Clean, no conflicts.

---

## PR #69 — Backgammon Logic and Plugin Tests (Steeply)

**Status:** ✅ APPROVED & MERGED  
**Branch:** `squad/46-backgammon-tests`  
**Closes:** #46

### Review Summary

Comprehensive test suite with 83 tests covering all backgammon rules.

**Test Coverage:**
- **Pure logic functions:** Board initialization, dice management, move validation
- **Movement rules:** Valid/invalid moves, direction, distance, blocked points, capturing
- **Bar re-entry:** Forced re-entry before other moves, entry point validation, blocked entry
- **Bearing off:** Home board requirement, exact dice vs. higher dice usage, piece placement rules
- **Integration tests:** Game initialization, turn progression, action validation, win detection
- **Edge cases:** Forced pass (no valid moves), initial board correctness, player disconnection

**Quality:**
- Follows Checkers E2E template pattern (established in PR #58)
- Clear test names, isolated test cases, no shared mutable state
- Uses Vitest patterns consistently with rest of codebase

**Merge:** Clean, no conflicts.

---

## PR #70 — Backgammon Renderer (Gately)

**Status:** ✅ APPROVED & MERGED (after conflict resolution)  
**Branch:** `squad/45-backgammon-renderer`  
**Closes:** #45

### Review Summary

1408-line client-side renderer implementing procedural graphics for backgammon.

**Implementation Highlights:**
- **GameRenderer pattern:** Correctly implements interface with `onEnter`, `onStateChange`, `update`, `resize`, `destroy`
- **Procedural rendering:** All graphics drawn with PixiJS Graphics API — no sprite assets required
- **RendererRegistry integration:** Registered as `backgammon` alongside `checkers`
- **LobbyScreen integration:** Added "Backgammon" to game type options
- **Spectator-safe:** Renderer is read-only; all state changes driven by server

**Code Quality:**
- Clear geometry calculations with named constants
- Proper layer management (board → pieces → overlay)
- Responsive layout with dynamic sizing
- Stack rendering with overflow counts (>5 pieces shows count label)

**Conflicts:** Merge conflict with PR #68 (infra files) and PR #69 (test files). Resolved via `git merge origin/dev` after both were merged.

**Merge:** Resolved conflicts, CI passed, merged successfully.

---

## PR #71 — Spectator Mode (Pemulis)

**Status:** ✅ APPROVED & MERGED (after test fix and conflict resolution)  
**Branch:** `squad/36-spectator-mode`  
**Closes:** #36

### Review Summary

Integrated spectator support for joining in-progress games as observers.

**Server Changes:**
- **BaseGameRoom:** `maxClients = maxPlayersConfig + 100` (allows 100 spectators beyond player slots)
- **Action validation:** Spectators blocked from performing moves (early return with error message)
- **LobbyRoom:** Only allows spectator joins to `in_progress` games; blocks spectators from `waiting` games

**Client Changes:**
- **Application:** `joinGame()` accepts `spectator` flag, passes to Colyseus `joinById(roomId, { spectator: true })`
- **LobbyScreen:** "Watch" button appears for `in_progress` games with `canSpectate: true`
- **Status text:** Displays "Spectating" instead of "Connected" when spectator flag is true

**Test Failure (Fixed):**
- **Issue:** BaseGameRoom.test.ts expected `maxClients = 3` but got `103` (maxPlayers + 100 spectator slots)
- **Root cause:** Legitimate implementation change to support spectators
- **Fix:** Updated test expectation to `expect(room.maxClients).toBe(103)` with explanatory comment
- **Verification:** All tests passed after fix

**Conflicts:** Merge conflict with PR #70 (renderer changes to LobbyScreen.ts). Resolved via `git merge origin/dev` after #70 was merged.

**Merge:** Fixed test, resolved conflicts, CI passed, merged successfully.

---

## Key Learnings

### Conflict Resolution Pattern
When `gh pr merge` fails with "not mergeable":
1. `gh pr checkout {N}`
2. `git fetch origin dev && GIT_EDITOR=true git merge origin/dev`
3. `git push origin {branch}`
4. Wait for CI to pass
5. Retry merge

### Test Failure Handling
- **Pre-existing failures:** Acceptable if known to team (e.g., "6 server test failures" mentioned in brief)
- **New failures from PR changes:** Must be fixed before merge
- PR #71 introduced a new failure due to legitimate implementation change → fixed by updating test expectations

### Security Review Checklist (for infra PRs)
- ✅ Managed identity over admin credentials
- ✅ RBAC role assignments scoped to minimum privileges
- ✅ OIDC for CI/CD (no long-lived PATs)
- ✅ Secrets in Key Vault, not environment variables
- ✅ Parameterized for environment-specific sizing

---

## Outcome

**All 4 PRs successfully merged to `dev` in dependency-safe order.**

- PR #68 → Clean merge (independent infrastructure)
- PR #69 → Clean merge (independent test files)
- PR #70 → Conflict resolved, merged (renderer depends on backgammon plugin)
- PR #71 → Test fixed, conflict resolved, merged (spectator mode touches shared server/client code)

**Next:** Wave 4 complete. Backgammon is fully playable with tests, renderer, and spectator support. Infrastructure is production-ready.

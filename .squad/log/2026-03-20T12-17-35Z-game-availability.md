# Session Log: Game Availability Feature

**Timestamp:** 2026-03-20T12:17:35Z  
**Summary:** Completed full implementation of game availability filtering via DISABLED_GAMES env var.

## Overview

Five-agent sprint successfully delivered deployment-specific game visibility control. All components shipped: architecture (Hal), shared types + server (Pemulis), client UI (Ortho), infra + CI (Marathe), comprehensive tests (Steeply).

## Agents & Output

| Agent | Task | Status |
|-------|------|--------|
| Hal | Architecture design | ✓ Completed |
| Pemulis | Shared types, server registration | ✓ Completed |
| Ortho | Client UI integration | ✓ Completed |
| Marathe | Infra env var, CI, bug fixes | ✓ Completed |
| Steeply | Unit + e2e tests (29 new) | ✓ Completed |

## Key Decisions

- **DISABLED_GAMES env var:** Denylist approach (empty = all enabled), parsed at startup, prod disables Risk
- **Server-driven types:** New `AVAILABLE_GAME_TYPES` message from server to client eliminates client hardcoding
- **Filtering at registration:** Simplest, most performant approach — registry is the source of truth
- **Client fallback:** `DEFAULT_GAME_TYPES` constant provides graceful degradation if message delayed

## Validation

- Build: ✓ Pass
- Lint: ✓ Pass
- Tests: ✓ 747 existing + 29 new all pass
- Infra: ✓ Prod deployments will auto-disable Risk

## Files Changed

**Shared:** `shared/src/lobbyTypes.ts`, `shared/src/index.ts`  
**Server:** `server/src/config.ts`, `server/src/index.ts`, `server/src/rooms/LobbyRoom.ts`, `.env.example`  
**Client:** `client/src/ui/gameTypeCache.ts` (new), `client/src/ui/LobbyScreen.ts`, `client/src/ui/SetupScreen.ts`  
**Infra:** `infra/main.bicep`, `deploy-prod.yml`, `set-repo-secrets.sh` (fix)  
**Tests:** `server/src/__tests__/disabled-games.test.ts` (new), `e2e/tests/lobby-available-games.test.ts` (new)

## Next Steps

Feature is production-ready. Deploy on next release cycle.

## Post-Session Notes

**History File Sizes (for next scribe cycle):**
- gately/history.md: 104KB (summarize)
- hal/history.md: 77KB (summarize)
- marathe/history.md: 48KB (summarize)
- mario/history.md: 16KB (summarize)
- ortho/history.md: 31KB (summarize)
- pemulis/history.md: 95KB (summarize)
- steeply/history.md: 48KB (summarize)

These files accumulated during the P6 (move history) and P7 (game availability) cycles. Future scribe sessions should create `## Core Context` sections consolidating pre-P6 entries into a single archival block, keeping recent (P6+) entries verbose for traceability.

Decision files (.squad/decisions/inbox/ + .squad/decisions.md) are healthy. All game-availability decision files merged and inbox cleared.

Orchestration logs archived for audit trail (timestamp-keyed, immutable).

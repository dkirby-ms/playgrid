# Decision Log

> Canonical merged decisions from all squad agents. Updated continuously. New entries appended at top.

---

## [2026-03-20] Promote Workflow — Push-Only Option for Idempotent Releases
**Decision:** Added `none` bump_type option to promote workflow. When selected, version bump, commit, and push steps are skipped; tag creation and PR creation proceed with the existing version.

**Rationale:** The v0.3.0 double-bump incident revealed that if late workflow steps fail, re-running triggers another version bump. The push-only mode makes recovery simple: re-run with `bump_type: none` to complete the release without altering version.

**Owner:** Marathe (DevOps)  
**Status:** Implemented (.github/workflows/promote.yml)  
**Impact:** Release process is now idempotent. Operators can recover from late-stage failures without manual version revert.

---

## [2026-03-20] Move DISABLED_GAMES to GitHub Actions environment variable
**Decision:** Replace hardcoded `DISABLED_GAMES` value with `${{ vars.DISABLED_GAMES }}` in deploy workflows (prod + UAT). Removed hardcoded conditional from Bicep template. Seed initial value via `set-repo-secrets.sh`.

**Rationale:** Disabled games can now be changed per environment from GitHub UI (Settings → Environments → Variables) with zero code changes. UAT and prod can be configured independently.

**Owner:** Marathe (DevOps)  
**Status:** Implemented (deploy workflows + infra)  
**Impact:** Environment-specific game toggles without code redeploy. Safe default: unset var means all games enabled.

---

## [2026-03-20] Lobby: ADD_CPU_PLAYER / REMOVE_CPU_PLAYER messages
**Decision:** Added two new lobby message types for hosts to add/remove CPU opponents from waiting games: `ADD_CPU_PLAYER` and `REMOVE_CPU_PLAYER`. Both require `{ gameId: string }` payload. Server validates host identity, game status, CPU support gate, and capacity.

**Rationale:** CPU opponents were previously only configurable at creation time via `cpuOpponent` flag. This couples CPU toggling to create flow, preventing hosts from adding/removing CPU from waiting room. New messages decouple this.

**Owner:** Gately (Game Dev)  
**Status:** Implemented (shared + server)  
**Impact:** Hosts can now dynamically add/remove CPU mid-wait. Client (Ortho) exports new message constants and payload types. Test suite (Steeply) updated.

---

## [2026-03-20] Dominos CPU Opponents — Architecture & Implementation Plan
**Decision:** CPU opponent support for Dominos leverages existing BaseGameRoom framework (proven in Checkers & Backgammon). Strategy: prefer plays > draws > pass; score plays by hand-size reduction + chain length. New module: `CpuOpponent.ts`. Integration: add `executeDoominosCpuTurn()` to BaseGameRoom; update `shouldEnableCpuOpponent()` in LobbyRoom.

**Rationale:** Dominos fits the existing CPU pattern (synthetic client + delayed callback + action dispatch). Move selection differs (ternary action space), but heuristic strategy avoids expensive minimax. Simple and proven.

**Owner:** Hal (Architecture)  
**Status:** Triaged, Ready for Sprint Planning (issue #163)  
**Scope:** Medium (~6 hours, Pemulis 3–4h + Steeply 2–3h)  
**Impact:** Dominos gets single CPU opponent. Reusable CPU framework scales to new games without reinvention.

---

## [2026-03-20] Shared game status lives in the HTML HUD overlay
**Decision:** Use shared `HUD.ts` overlay as reusable game status panel. Renderers opt into custom copy via optional `getHUDStatus()` method on GameRenderer contract.

**Rationale:** Status was split between overlay (generic: turn/timer/players) and renderer (game-specific text). Single panel consolidates the mental model. Renderer ownership stays clean; optional hook gives future games a low-friction path to adoption.

**Owner:** Gately (Game Dev / Rendering)  
**Status:** Implemented (Checkers)  
**Impact:** Future games (Backgammon, Risk) get clearer HUD pattern. CheckersRenderer moved status out of canvas; GameScene now passes renderer-provided status into shared HUD.

---

## [2026-03-20] Local Lobby Thumbnails from Design Prototype
**Decision:** Use locally served thumbnail files in `client/public/game-thumbnails/` sourced from design prototype, instead of inline SVG or remote URLs.

**Rationale:** Keeps lobby visually aligned with approved design. Avoids third-party image host dependency. Fits existing Vite public asset path; works naturally with 4:3 tile layout + `object-fit: cover`.

**Owner:** Gately (Game Dev / Rendering)  
**Status:** Proposed  
**Impact:** `LobbyScreen` maps game types to stable local asset paths. Asset swaps only need file + path update, no rendering logic changes.

---

## [2026-03-16] User Directive: HUD Sidebar Consolidation
**By:** dkirby-ms (via Copilot)  
**What:** Old HUD status panel (turn info, player list, timer) is redundant now that GameSidebar exists. Remove status panel overlay; move turn clock into sidebar's game info panel.

**Status:** User request captured for team memory  
**Impact:** Simplifies HUD chrome; consolidates player/turn info into single sidebar location.

---

## [2026-03-19] Fix #161: Adopt fake timers for setTimeout-based tests
**Decision:** When testing async code that uses `clock.setTimeout()` (Colyseus timers), initialize with `vi.useFakeTimers()` before test and advance time with `vi.advanceTimersByTime()`.

**Rationale:** PR #159 refactored turn timer logic. Tests without fake timers couldn't trigger 6-second deferred callbacks, causing timeouts. Five tests required this fix.

**Owner:** Pemulis  
**Status:** Implemented (commit 266e002)  
**Impact:** Timer-based game logic is reliably testable going forward.

---

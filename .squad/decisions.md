# Decisions

Team decisions are recorded here. Append-only — never edit existing entries.


## Session: Session Resilience — Client-Server Reconnection (2026-03-15)

### Pemulis: Presence-backed Reconnect Cleanup

**Status:** Approved  
**Date:** 2026-03-15  

Use a Colyseus presence topic (`playgrid:lobby:game-room-disposed`) for game-room → lobby cleanup, rather than keeping direct references between `BaseGameRoom` and `LobbyRoom`.

**Rationale:**
- Loose coupling: Game rooms only publish disposal facts; lobby decides how to clear stale entries
- Compatible with Colyseus local presence today; remains compatible with Redis presence if scaled later
- Centralizes lobby cleanup in one place: Removing a dead in-progress game also clears stale `currentGameId` assignments for connected lobby sessions
- Extends existing plugin lifecycle contract to expose `onPlayerReconnect` hook for turn timer integration

**Impact:**
- Server-side reconnection window and cleanup fully implemented
- LobbyRoom clears stale entries on game room disposal
- Plugin system ready for turn timer pause/resume during reconnect window

**Files Modified:**
- server/src/rooms/lobbyPresence.ts
- server/src/game/BaseGameRoom.ts
- server/src/rooms/LobbyRoom.ts

---

### Gately: Client Reconnect UX & sessionStorage Persistence

**Status:** Approved  
**Date:** 2026-03-15  

Persist only active game reconnect state in `sessionStorage` under `playgrid.active-session`, and restore it in `client/src/Application.ts` before booting a fresh lobby room. Drive the in-game reconnect UX from the Colyseus room lifecycle (`onDrop`, `onReconnect`, `onLeave`) while clearing stored state only on consented leave, `game-end`, or failed restore.

**Rationale:**
- Server already reserves seats for 30 seconds during active games, so the browser must try reclaiming that seat before opening a fresh lobby session
- `sessionStorage` matches the desired lifecycle: Survives refresh, clears on tab close, avoids reviving dead sessions across future browser launches
- Same-tab drops need visible feedback without bouncing players straight back to lobby; transient drops and final reconnect failure are separate states
- Enables end-to-end recovery across browser refresh within the 30s reconnect window

**Implementation:**
- Persist `room.reconnectionToken` + minimal active-game metadata (gameType, spectator flag, timestamp) on room join
- Attempt `client.reconnect(savedToken)` before creating fresh lobby session on startup
- Clear persisted state on: consented leave, game-end, or reconnect-window expiry/failure
- Bind `room.onDrop` and `room.onReconnect` to drive visible reconnecting/resumed states

**Impact:**
- Players can refresh mid-game and rejoin within 30s window
- Visible reconnecting UI prevents silent SDK behavior
- Tab close automatically clears stale session tokens
- Works with existing 30s server-side reconnection window

**Files Modified:**
- client/src/Application.ts
- client/src/networking/ConnectionManager.ts
- client/src/ui/ReconnectOverlay.ts
- client/index.html

---

### Steeply: Reconnect Test Strategy — Two-Layer Coverage

**Status:** Approved  
**Date:** 2026-03-15  

Land reconnection coverage in two layers:
1. Add concrete server-side behavioral tests where current seams already exist (`BaseGameRoom` and lobby pregame tests)
2. Add explicit Vitest `.todo()` contracts for client startup/sessionStorage reconnect behavior and server/client edge cases

**Rationale:**
- Pemulis and Gately are landing implementation in parallel, but current branch does not expose stable client seams for session persistence or finished server reconnect lifecycle
- Shipping green explicit TODO contracts keeps expected behavior visible in CI without forcing brittle implementation-coupled tests or breaking suite before feature lands
- Two-layer approach allows staging: Server tests green now; client/cross-agent tests pinned as contracts for finishing agent to convert from `.todo()` to executable coverage

**Coverage:**
- **Server tests (green):** allowReconnection window, consented leave, timeout forfeits, lobby cleanup
- **Client contracts (TODO):** sessionStorage persistence, startup reconnect attempt, reconnecting UI states, server/client edge cases covering full reconnection matrix

**Impact:**
- Server regressions around `allowReconnection`, consented leave, timeout forfeits covered now
- Remaining reconnect requirements pinned as named tests; finishing agent can convert from `.todo()` without reinventing matrix
- CI shows expected contracts without flaky timing-dependent tests

**Files Modified:**
- e2e/reconnection.test.ts (new)
- e2e/lobby.test.ts (updated with reconnection contracts)

---

## Session: Previous — Player Reconnection Support (2026-03-14)

*This session completed Phase 1 of reconnection: server-side 30s window support.*

**Pemulis:** Implemented `allowReconnection(client, timeout)` in `BaseGameRoom.onLeave()` with 30s default, heartbeat config, and CONSENTED disconnect distinction.

**Status:** Implemented  
**Follow-up:** Client-side UI and end-to-end recovery (completed in 2026-03-15 session above)

---

### Marathe: Dual Custom Domains by Environment (2026-03-15)

**Status:** Proposed  
**Date:** 2026-03-15  

Use separate optional Bicep parameters for Container App custom domains: `customDomainUat` for UAT and `customDomainProd` for production.

**Decision:**
- Keep dev deployments domain-free by default
- Select the active custom domain from `environmentName` inside `infra/main.bicep`
- Only emit ACA ingress `customDomains` when the selected environment-specific value is non-empty

**Rationale:**
- Matches the repo's single-template-per-environment pattern without reintroducing duplicated Bicep
- Avoids accidental prod-domain reuse in UAT or vice versa
- Preserves backward compatibility for existing dev deployments and any environment with no custom domain configured

**Files:**
- infra/main.bicep
- infra/main.bicepparam

---

### Pemulis: Ready-Check Enforcement for Non-Host Players (2026-03-15)

**Status:** Approved  
**Date:** 2026-03-15  

For the current waiting-room flow, enforce that all joined non-host players must have `isReady = true` before the host can execute `start_game`.

**Rationale:**
- The waiting-room UX gives the host the Start Game control but does not expose a Ready toggle for the host
- Treating the host as a starter/coordinator and enforcing readiness only on non-host players fixes issue #79 without introducing a larger UX change mid-stream
- Simpler than requiring explicit "host ready" interaction

**Follow-up:**
If we later want a true "every participant explicitly readies" flow, add a separate host-ready interaction first and then tighten the server rule to match it.

**Implementation:**
- Server validation in `BaseGameRoom` or game-specific logic
- Client: Start button disabled until ready is confirmed
- Tests: Regression coverage added

---

### Marathe: ACA Bootstrap Placeholder Image (2026-03-15)

**Status:** Approved  
**Date:** 2026-03-15  

Keep infrastructure deployment independent from image availability. Seed the Azure Container App with a public `node:22-alpine` bootstrap image and conditional startup logic:
1. Start the real app when `/app/public/server/dist/src/index.js` exists
2. Serve a tiny HTTP placeholder with `/health` on port `2567` when no app image has been pushed yet

**Rationale:**
- Prevents first-time ACA provisioning from failing against an empty ACR
- Keeps probes and ingress aligned with the real runtime contract (`/health`, port `2567`)
- Preserves the existing deploy workflow shape instead of adding extra bootstrap-only pipeline steps
- The real PlayGrid image is CI/CD's responsibility via `deploy-dev.yml`; the placeholder is only for first-deploy bootstrap

**Implementation:**
- `infra/main.bicep` deploys the bootstrap image and health-check configuration
- `.github/workflows/deploy-dev.yml` already handles the handoff after pushing the real image via `az containerapp update`
- No manual redeployment needed on subsequent CI/CD image updates

**Impact:**
- Infra deploys can succeed before the first app image exists
- Subsequent CI deploys replace the placeholder with the real application image without extra steps


---

### Marathe: Shared CAE Environment for UAT + Prod (2026-03-15)

**Status:** Approved  
**Date:** 2026-03-15  

Keep `infra/main.bicep` as a single per-environment deployment template, but treat Container Apps Environment infrastructure as shared for non-dev environments:
- `dev` keeps its own CAE/log workspace
- `uat` and `prod` default to the shared names `playgrid-shared-cae` and `playgrid-shared-logs`
- `deploy-infra.yml` accepts optional `container_app_env_resource_id` so the second environment can explicitly target the first environment's CAE when resource groups differ

**Rationale:**
- Preserves the existing manual `workflow_dispatch` deployment shape
- Gives UAT/prod deterministic shared resource names so repeated deployments converge on the same CAE definition
- Avoids CAE drift by also sharing the attached Log Analytics workspace instead of letting UAT/prod point the same CAE at different workspaces
- Keeps dev isolated for low-risk testing and experimentation

**Related:** User directive (2026-03-15T01:20:26Z) — UAT and prod can share the same Container Apps Environment for cost optimization.


---

## Session: Risk Game Plugin Triage (2026-03-15)

### Hal: Risk Game Plugin Triage (Issue #80)

**Status:** Approved for Sprint Assignment  
**Date:** 2026-03-15  
**Assignees:** Pemulis (squad:pemulis), Gately (squad:gately)  

Triaged issue #80 "Add Risk game plugin" and determined complexity, scope risks, and team assignments. Risk is materially more complex than Checkers or Backgammon (900+ lines vs. 550–650) due to territory system (42 regions), multi-phase turns (reinforce → attack → fortify), stochastic combat (dice rolls), card mechanics, setup UX, and visual complexity.

**Architectural Alignment:**
- ✅ Plugin Pattern: Follows existing BaseGameRoom + GamePlugin interface
- ✅ Pure Logic: Game mechanics separated from Colyseus (testable in isolation)
- ✅ Spectator-Safe: Only hidden info = opponent cards (classic Risk rules)

**Team Assignment:**
- **Pemulis (Game Systems):** Risk game logic plugin + state management. Turn phases, combat dice resolution, territory/card state, card trade-in validation. ~350 lines server code + tests.
- **Gately (Game Dev / Rendering):** Interactive Risk map renderer (procedural graphics). Setup phase territory selection UI, HUD, army placement visualization. ~600+ lines client code.

**Decomposition (3 Sub-Issues):**
1. **Core Game Logic & Plugin** (Pemulis) — RiskState schema, turn phases, combat mechanics, territory/card accounting, win detection. No UI; pure mechanics.
2. **Setup & Territory Management** (Shared) — Territory selection phase, initial army placement rules, setup validation.
3. **Interactive Map Renderer** (Gately) — Procedural map, clickable territories, army overlays, phase/action indicators.

**Scope Clarifications:**
- Card Mechanics: Accept standard Risk 5/4/3 trade-in set rules. In Phase 1, implement server-side validation + card count UI only. Defer card animation/visuals to Phase 2.

**Rationale:**
- Risk is next in approved game implementation order (after Dominoes → Poker → Hearts/Spades → Chess).
- Timing is appropriate.
- Decomposition prevents scope creep and enables parallel work (core logic → setup → rendering).


---

## Session: Risk Plugin Implementation Phase 1 (2026-03-15)

### Pemulis: Risk Plugin Architecture

**Status:** Implemented  
**Date:** 2026-03-15  
**Issue:** #80 (Phase 1 - Core Game Logic & Plugin)  

Implemented the Risk game plugin following the established IGamePlugin pattern used by Checkers and Backgammon. Risk is significantly more complex than previous games with multi-phase turns, territory ownership, card mechanics, and variable player counts (2-6).

**Decision 1: Setup Phase Strategy**

Territories auto-distributed round-robin at game start, followed by a setup-place phase for initial army placement.

Rationale: Original Risk manual territory selection is tedious and slows web play. Round-robin ensures fair distribution. Players then place remaining armies strategically (40−territories_owned). Matches digital Risk implementations; reduces setup time. Alternative considered: manual pick-one-at-a-time (too slow for async web play).

**Decision 2: Card Mechanics Simplification**

Track card count only (no card types: Infantry/Cavalry/Artillery). Trade any 3 cards for escalating bonus (4→6→8→10→12→15→20...).

Rationale: Phase 1 has no card UI; tracking types wastes complexity. Simplified trade-in removes "forced trade when no valid set" edge case. Escalating bonus preserves Risk endgame acceleration. Can add card types in Phase 2 if UI supports it. Trade-off: less strategic depth than full card rules, but simpler implementation.

**Decision 3: Turn Phase Management**

Use string union types for turnPhase in state, enforce phase transitions in action handlers.

Rationale: BaseGameRoom doesn't enforce phased turn config automatically. Each action handler validates current phase before executing. endPhase action transitions between reinforce→attack→fortify→reinforce. Simple state machine that client can render visually. Alternative considered: separate state machine class (over-engineered).

**Decision 4: Combat Resolution**

Pure server-side dice rolling with immediate resolution (no "roll until one side loses" loop). Each attack action is one dice throw; client can call multiple times.

Rationale: Gives players control over when to stop attacking. Allows UI animation between rolls. Server-authoritative dice (no client cheating). Trade-off: more client→server round trips, better for web UX.

**Decision 5: Territory Adjacency Data Structure**

Static const arrays with adjacency lists in territoryData.ts, helper functions for lookups.

Rationale: Territory graph never changes; hardcode it. Simple array lookups for adjacency checks (O(n) but n≤8 for any territory). Easy to verify correctness by reading the data. Alternative considered: adjacency matrix (harder to read, same performance).

**Integration Notes:**
- Plugin registered in `server/src/index.ts` alongside Checkers and Backgammon
- State schema exported from `shared/src/games/risk/index.ts` for client access
- All game logic in `riskLogic.ts` is pure functions (testable, reusable)
- No client changes needed yet (Phase 1 is server-only)

**Files Created:**
- `server/src/games/risk/RiskPlugin.ts`
- `server/src/games/risk/riskLogic.ts`
- `server/src/games/risk/RiskState.ts`
- `server/src/games/risk/territoryData.ts`
- `shared/src/games/risk/index.ts`

**Open Questions for Phase 2:**
1. Should fortify require contiguous territory paths or just adjacency?
2. How to handle attack animations with rapid consecutive attacks?
3. Card UI: show card types retroactively or keep simplified system?
4. Territory map rendering: SVG overlay or canvas-based?

---

### Steeply: Risk Test Strategy — Pure Logic First, Integration Later

**Status:** Implemented  
**Date:** 2026-03-15  
**Issue:** #80 (Risk game plugin)  

For complex game plugins like Risk (3× more complex than Checkers/Backgammon), use a phased test strategy:

1. **Phase 1: Pure Logic Tests** — Test static data and pure functions immediately
2. **Phase 2: Integration Stubs** — Write `.todo()` tests for plugin actions/lifecycle
3. **Phase 3: Incremental Activation** — Convert `.todo()` to executable tests as implementation completes

**Decision Rationale:**

**Why Pure Logic First?**
- Validates core game rules independently of plugin integration
- Provides immediate value (16/64 tests passing on first commit)
- Enables parallel work: Pemulis implements, Steeply validates
- Catches errors in static data early (territory map, adjacency graph, continent bonuses)

**Why `.todo()` for Integration?**
- Documents expected behavior as executable specifications
- Prevents brittle "mock everything" tests that don't test real behavior
- Shows test coverage gaps in CI without blocking green builds
- Easy conversion: just remove `.todo()` when implementation lands

**Why Incremental Activation?**
- Risk has 4 distinct phases (setup, reinforce, attack, fortify) that complete independently
- Integration tests can activate phase-by-phase as Pemulis delivers
- Reduces coordination overhead: no waiting for "all or nothing" completion
- Maintains green CI throughout development

**Implementation (Risk Game):**

64 Total Tests:
- 16 passing (pure logic): territory map, reinforcements, card trade-ins, initial armies
- 48 `.todo()` (integration): plugin actions, lifecycle, state transitions, combat, win conditions

**Test Categories:**
- Territory Map (4): initialization, continent assignment, adjacency graph, continent bonus
- Initial Setup (3): territory distribution, army allocation, player colors
- Reinforcement (4): army pool deduction, continent bonus, edge cases
- Card Mechanics (5): count tracking, trade-in validation, escalating bonus
- Plugin Lifecycle (8): onCreate, onJoin, onLeave, turn order, state transitions
- Reinforce Phase (12): setupPlace action, army placement, state updates
- Attack Phase (14): territory validation, combat resolution, conquest mechanics
- Fortify Phase (6): movement validation, army transfer, edge cases
- Win Conditions (8): solo player detection, game end, final state, elimination

**File:** `server/src/__tests__/risk.test.ts` (follows Backgammon pattern)

**Imports:** Actual implementation (RiskPlugin, riskLogic, territoryData) with no mocks.

**Cross-Agent Impact:**

**Pemulis (Systems Dev):** Test expectations documented before implementation complete. Pure logic functions validated immediately (green tests = confidence). `.todo()` tests serve as acceptance criteria for plugin actions.

**Gately (Game Dev):** Can reference test coverage when building UI (knows what server validates). `.todo()` tests hint at client-side testing needs.

**Recommendation:** Adopt this pattern for all future complex game plugins (Dominoes, Poker, etc.):
1. Identify pure logic (static data, calculations, validators)
2. Test pure logic immediately with actual implementation
3. Write `.todo()` integration tests as specification
4. Convert `.todo()` to executable tests as plugin actions complete

This balances immediate validation with practical coordination for parallel development.


---

## Session: Risk Game Plugin Phase 3 Complete (2026-03-15)

### Gately: Risk Client Renderer Architecture

**Status:** Implemented  
**Date:** 2026-03-15

Implemented Risk game client renderer following the established Checkers pattern with PixiJS.

**Context:**
Phase 3 of Risk game plugin (#80) required an interactive map renderer on the client side. Server-side state (RiskState) and logic (RiskPlugin) were already completed by Pemulis in Phase 1.

**Key Decisions:**

1. **Territory Layout:** Hardcoded procedural grid-based positioning for 42 territories
   - Functional over geographically accurate (matches task requirement)
   - Faster initial implementation vs. SVG import or geographic data
   - Easy to adjust positions for visual balance
   - Keeps bundle size small (no external map data)

2. **Rendering Layers:** Three-layer Container structure: mapLayer → territoryLayer → hudLayer
   - Follows Checkers pattern exactly (team consistency)
   - Clean separation of concerns
   - Easy z-ordering for overlays

3. **Territory Interaction:** Two-click pattern for attack/fortify, single-click for place
   - Setup/Reinforce: Click owned territory → place army (immediate)
   - Attack: Click owned → click adjacent enemy (two-step)
   - Fortify: Click owned → click adjacent owned (two-step)
   - Consistent with card game and board game UX patterns

4. **State Management:** Direct Colyseus room message sending with reactive re-rendering
   - Messages: `placeArmy({ territoryId })`, `attack({ from, to, attackDiceCount })`, `fortify({ from, to, armyCount })`, `tradeCards({})`, `endPhase({})`
   - Server-authoritative (client sends intents, not state changes)
   - Re-render driven by onStateChange events

5. **Simplified Game Parameters:** Attack uses max dice (3 attacker, 2 defender based on armies); Fortify moves max-1 armies
   - Reduces UI complexity for MVP
   - Can add detailed controls later if needed
   - Most players use max dice anyway (optimal strategy)

**Alternatives Considered:**
- Geographic SVG Map: Rejected (overkill for Phase 3, larger bundle, more complex hit detection)
- Three-click Attack Pattern: Rejected (extra friction, Checkers uses two-click)
- Client-side Combat Calculation: Rejected (server must be authoritative, risk of desync)

**Implementation:**
- `client/src/renderers/RiskRenderer.ts` (23KB)
- `client/src/games/risk/riskClientLogic.ts` (helper functions)
- `client/src/renderers/index.ts` (registry entry)
- Registered with key "risk", auto-loaded by GameScene

**Validation:**
- ✅ Build passes (npm run build)
- ✅ No TypeScript errors
- ✅ Follows GameRenderer interface
- ✅ Consistent with Checkers pattern
- ✅ All phases supported (setup-pick, setup-place, reinforce, attack, fortify)

**Cross-Agent Impact:**
- Hal (Architect): No architectural changes needed, adheres to GameRenderer contract
- Pemulis (Backend): Client consumes server state schema correctly, message types match
- Steeply (Testing): Can write client integration tests against GameRenderer interface
- Joelle (Docs): May want to document Risk UI controls for players

**Future Enhancements:**
1. Combat animation (dice roll visualization)
2. Territory capture animation (color transition)
3. Card trade UI
4. Detailed dice count selection for attack
5. Fortify army count slider
6. Territory name search/filter
7. Minimap for large displays
8. Zoom/pan controls for mobile


---

## Session: Post-Work Review and Fixes (2026-03-15)

### Gately: Lobby Card Backgrounds via Inline SVG Data URLs

**Status:** Approved  
**Date:** 2026-03-15

Use inline SVG data URLs generated in `client/src/ui/LobbyScreen.ts` for lobby game library card artwork, with CSS overlay/shadow treatment in `client/index.html` to keep labels readable.

**Rationale:**
- Keeps artwork fully self-contained in lobby UI code; no new asset pipeline required
- Lightweight and easy to tweak with bespoke art direction per card
- One shared CSS contrast layer instead of duplicating overlays inside assets
- Fits existing HTML/CSS lobby architecture

**Files:**
- `client/src/ui/LobbyScreen.ts`
- `client/index.html`

---

### Marathe: Fix Shared CAE Dependency and PostgreSQL Password Requirement

**Status:** Approved  
**Date:** 2026-03-15

Keep shared UAT/prod Container Apps Environment (CAE) architecture, but make `Microsoft.App/containerApps` explicitly depend on the conditionally created `Microsoft.App/managedEnvironments` resource when `containerAppEnvResourceId` is empty. Require PostgreSQL administrator password at deployment time with no empty default.

**Rationale:**
- Template was computing CAE resource ID as string without creating ARM dependency edge
- First-time deployments could attempt container app before managed environment existed, causing `ManagedEnvironmentNotFound`
- Empty password fallback caused late deployment failures instead of fast validation
- First-time deployments can now create shared CAE and dependent container app in one run

**Impact:**
- Cross-resource-group reuse still works via `containerAppEnvResourceId`
- Manual deploys must provide `POSTGRES_ADMIN_PASSWORD`, avoiding accidental empty passwords

**Files:**
- `infra/main.bicep`
- `infra/main.bicepparam`

---

### Hal: Risk Game Implementation Standards

**Status:** Approved  
**Date:** 2026-03-15

Establish four architectural standards from PR #83 review:

1. **Shared Static Data:** Game configuration data (maps, adjacency graphs, card decks) MUST be located in `shared/src/games/{game}/` so both client (renderer) and server (logic) use a single source of truth.
2. **Test Implementation:** PR descriptions must accurately reflect test coverage. `it.todo()` placeholders do not count as implemented tests. Critical game logic (combat, movement, win conditions) must be tested before merge.
3. **Scope Transparency:** Intentional simplifications of game rules MUST be explicitly documented as "Phase 1 Limitations" in the PR description to distinguish from bugs.
4. **PR Atomicity:** Infrastructure changes should be in separate PRs from feature work to keep reviews focused.

**Rationale:**
- Prevents client/server state drift through shared data models
- Test metrics in PRs require verification; unclear coverage masks incomplete implementation
- Scope cuts need explicit documentation to prevent confusion with bugs or incomplete features
- Bundled unrelated changes degrade review quality and increase risk of regression

**Files:**
- PR #83 follow-up work (routed to Marathe)

---

### Hal: Robust Testing for Random Mechanics

**Status:** Decided  
**Date:** 2026-03-15

Tests involving randomness must be either:
1. **Mocked:** Use `vi.spyOn(Math, 'random')` to force outcomes.
2. **Robust:** Use sufficient sample sizes and buffers (e.g., 20 armies vs 1, not 3 vs 1) to make failure statistically impossible.

Flaky tests are treated as broken code.

**Context:** Combat test in PR #83 had 42% failure rate due to reliance on `Math.random` with low sample size and tight constraints. Fixed by implementing robust test with sufficient armies to make statistical failure impossible.

**Rationale:**
- Test reliability is foundational to CI/CD trust
- Mocking forces deterministic outcomes; robustness makes randomness statistical noise
- Tests that fail randomly waste developer time and obscure real regressions
- Forces better test design (larger sample sizes, statistical buffers)


---

### Steeply: Lobby E2E Test Isolation & Current UI Patterns

**Status:** Approved  
**Date:** 2026-03-15  

Lobby E2E coverage should target only the unique session created by the test and should use current UI seams:
- Save display names by blurring `input[name="player-name"]`
- Create games through `#create-game-modal`
- Find sessions via the test's unique `.active-game-card`
- Use exact/scoped button locators when labels overlap (`Create Game`, `Ready`, `Start Game`)

**Rationale:**
- Makes the suite order-independent and resilient to shared lobby state
- Aligns with current accessible UI instead of removed table layout
- Removes table-era assumptions that caused issue #91

**Context:** Issue #91 exposed lobby Playwright suite drift from shipped UI and fragility under shared-server runs.

**PR:** #92 (merged)

---

## Session: Healthcheck Fix (2026-03-15)

### Marathe: Environment Variables Include Protocol Prefix

**Status:** Implemented  
**Date:** 2026-03-15  

GitHub environment variables for URLs MUST include the protocol prefix (`https://`). Workflows should use these variables directly without adding or removing protocol prefixes.

**Decision:**
- `CONTAINER_APP_FQDN` already includes `https://` protocol
- Workflows must not prepend additional protocol
- Environment variables should be used as-is for health checks, notifications, and logs

**Rationale:**
1. **Consistency with Infrastructure Outputs:** Bicep template outputs `containerAppFqdn` as complete URL with protocol
2. **Reduced Error Surface:** No protocol manipulation required — variables are directly usable
3. **Direct Usability:** Variables work in Discord notifications, logs, health checks without transformation
4. **Fail-Safe:** Missing protocol becomes immediately obvious rather than silently malformed

**Implementation:**
- Fixed `.github/workflows/deploy-uat.yml` (commit ad8d0a8)
- Fixed `.github/workflows/deploy-prod.yml` (commit d5ccb85)

**Consequences:**
- ✅ Health checks now construct valid URLs
- ✅ Deployments no longer fail at verification step
- ✅ Consistent URL handling across workflows
- ✅ Discord notifications show clickable URLs correctly

---

### Steeply: Checkers E2E Selector Update

**Status:** Approved  
**Date:** 2026-03-15  

Game-specific Playwright suites must reuse the current lobby interaction pattern instead of legacy table-era selectors.

**Decision:**
Game E2E coverage should assert `#lobby-overlay.visible`, create games through `#create-game-modal`, join through test's unique `.active-game-card`, then hand off gameplay assertions to `?e2e=1` browser harness.

**Rationale:**
- Proves the pattern from lobby.spec.ts works for game-specific assertions
- Keeps plugin suites aligned with lobby refactors
- Avoids duplicating stale assumptions
- Preserves grey-box pattern for PixiJS games

**Impact:**
Future game-plugin E2E coverage should treat lobby selectors as shared infrastructure and avoid stale assumptions from legacy UI patterns.

---

## Session: Features Batch 2 (2026-03-15)

### Gately: Shared Game Status Lives in the HTML HUD Overlay

**Status:** Implemented  
**Date:** 2026-03-15  
**Author:** Gately (Game Dev / Frontend / Rendering)

## Context

Checkers was showing turn state in two different places: the shared HUD overlay owned the generic waiting/timer widgets, while the renderer also painted its own in-canvas status copy. That split made the status treatment feel temporary and would force every new game to reinvent the same player/turn/timer panel.

## Decision

Use the shared `client/src/ui/HUD.ts` overlay as the reusable game status panel, and let renderers opt into custom copy through an optional `getHUDStatus()` method on the `GameRenderer` contract.

## Why

1. **One panel, one mental model** — player list, current turn, timer, and status text now live together instead of being split between overlay chrome and canvas text.
2. **Renderer ownership stays clean** — renderers still own board-specific HUD elements, but game-state copy can be handed off to a shared panel without `GameScene` learning game rules.
3. **Future games get a low-friction hook** — Backgammon, Risk, or later games can adopt the same panel by implementing one optional status method instead of duplicating layout work.

## Consequences

- ✅ Checkers status copy moved out of the Pixi canvas and into the shared HUD panel
- ✅ `GameScene` can pass renderer-provided status metadata into the HUD without hardcoding per-game branches
- ✅ Future renderer work has a clear split between shared overlay status and board-local counters/buttons

## Files Affected

- `client/src/ui/HUD.ts`
- `client/src/scenes/GameScene.ts`
- `client/src/renderers/GameRenderer.ts`
- `client/src/renderers/CheckersRenderer.ts`

---

### Gately: Local Lobby Thumbnails from Design Prototype

**Date:** 2026-03-15
**Status:** Implemented
**Author:** Gately (Game Dev / Frontend / Rendering)

## Decision

Use locally served thumbnail files in `client/public/game-thumbnails/` for lobby game tiles, sourced from the original design prototype artwork, instead of inline SVG art or runtime-hotlinked remote image URLs.

## Context

The shipped lobby tiles were using hand-authored SVG illustrations in `client/src/ui/LobbyScreen.ts`. The design prototype archive (`docs/designs/project.zip`) contained the intended photographic tile artwork references, but not bundled image binaries.

## Rationale

- Keeps the lobby visually aligned with the approved design direction.
- Avoids runtime dependency on third-party image hosts.
- Fits the existing Vite public asset path cleanly with no new asset-loading framework.
- Works naturally with the existing 4:3 tile layout by pairing local files with `object-fit: cover`.

## Impact

- `LobbyScreen.ts` maps game types to stable local asset paths.
- `client/index.html` remains responsible for thumbnail crop behavior and overlay readability.
- Future tile artwork swaps only need asset replacement and path updates, not new rendering logic.

---

### Pemulis: Shareable Waiting-Room Links

**Status:** Implemented  
**Date:** 2026-03-15  
**Author:** Pemulis (Systems / Server)

## Context

Waiting rooms already have a stable lobby-side `gameId`, and `LobbyRoom.handleJoinGame()` already understands that identifier before a real Colyseus game room exists. The feature request is to let hosts share a direct invite link that can reopen the app and send the recipient into that waiting room automatically.

## Decision

Use the existing lobby `gameId` as the shareable join token and encode it in the browser URL as `?join={gameId}`.

- Do **not** add a new HTTP endpoint or a separate join-token service.
- Keep the URL synced while the client is in a waiting room.
- Clear the `join` parameter when transitioning into the live game room.
- On lobby boot/reconnect, if `join` is present, immediately send the existing `JOIN_GAME { gameId }` message to the lobby room.

## Rationale

This reuses the validated server join path and preserves all current edge-case handling for missing/full/started games. It also keeps the implementation small and robust: invite links work before a Colyseus `roomId` exists, and reconnects/refreshes can re-enter the waiting room without inventing a second session model.

## Impact

- Server contract remains unchanged for production code.
- Waiting-room invites become copyable and deep-linkable.
- Host/guest refresh flows can reuse the same link semantics in pregame.

---

## Session: User Directive (2026-03-15)

### User Directive: E2E Test Suite Required for New Games

**Date:** 2026-03-15  
**Status:** Approved  
**By:** dkirby-ms (via Copilot)

## Decision

Any new game added to the project must have an accompanying end-to-end (E2E) test suite.

## Why

User request — captured for team memory. E2E coverage ensures shipped games work end-to-end and protects against regressions as the framework evolves.

## Impact

Phase 2 and Phase 3 games (Dominoes, Backgammon, Risk) must include E2E tests covering core gameplay flows.


---

## Session: Checkers Piece Visual Polish (2026-03-15)

### Gately: PixiJS FillGradient Pattern for Game Piece Rendering

**Status:** Approved  
**Date:** 2026-03-15  

Adopted PixiJS v8 `FillGradient` with radial gradients as the standard pattern for rendering game pieces with 3D depth effects.

**Implementation Pattern:**
1. **Radial gradient with offset center** — Center point at `{ x: 0.42, y: 0.38 }` simulates lighting from upper-left
2. **Three-stop gradient** — Highlight (0), base color (0.5), shadow (1) for dome effect
3. **Drop shadow layer** — Slight offset behind main piece for depth
4. **Specular highlight ring** — White semi-transparent circle at top for shininess
5. **Gradient reuse** — Create gradients once outside loops for performance

**Rationale:**
- Visual polish improves user experience and perceived quality
- Pattern is reusable across all game types (Risk, Connect4, etc.)
- PixiJS v8 native support ensures good performance
- Consistent visual language across game pieces

**Implications:**
- Risk armies/territories can adopt this pattern
- Connect4 pieces, Go stones, Poker chips benefit from same approach
- Pattern should be documented in rendering guidelines for future consistency
- Could extract to shared utility function if widely adopted

**Related Files:**
- `client/src/renderers/CheckersRenderer.ts` — Reference implementation

**Tags:** #rendering #pixi-js #game-pieces #visual-polish #pattern

---

## Session: Phase 4 Design Unification (2026-03-16)

### User Directive: Phase 5 Out of Scope

**Status:** Confirmed  
**Date:** 2026-03-16  
**Author:** dkirby-ms (via Copilot)

No new game implementations. Phase 5 (Scrabble, Hungry Hippos, Catan) is out of scope. The design references for those games exist but are for future consideration only.

**Why:** User request — captured for team memory

---

### Gately: Checkers Redesign Uses Shape Markers and Capture Trays

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Aligning `client/src/renderers/CheckersRenderer.ts` with the redesign and shared design-token system.

Use token-driven shape rendering for the redesigned Checkers board: kings are marked with a yellow concentric ring instead of a crown glyph, and captured pieces are shown as small off-board rendered pips instead of numeric counts alone.

**Rationale:**
- Removes typography dependence from king state, so the marker stays legible across browsers, fonts, and future Pixi text changes.
- Keeps the board language consistent by reusing the same piece gradients and shadows for captured-piece feedback.
- Concentrates interaction feedback on the piece itself (selection ring, hover lift) while keeping destination feedback on squares, which matches the redesign's affordance hierarchy.

**Files Affected:**
- `client/src/renderers/CheckersRenderer.ts`
- `client/src/renderers/DesignTokens.ts`

---

### Gately: Backgammon Redesign Keeps Logic Colors but Renders White Checkers

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Aligning `client/src/renderers/BackgammonRenderer.ts` with the redesign reference and shared `DesignTokens.ts` system.

Keep the existing backgammon game logic keyed on `BLACK` and `RED`, but render the `RED` side as white/light checkers in the Pixi renderer and label player-facing UI accordingly.

**Rationale:**
- Preserves the existing server/client move logic, filtered state shape, and interaction handlers without a risky game-rules refactor.
- Matches the redesign reference, which is visually organized around black-vs-white pieces instead of black-vs-red.
- Lets `DesignTokens.ts` own the visual mapping cleanly, so future renderer passes can reuse the same piece gradients, home-board surfaces, and selection affordances.

**Files Affected:**
- `client/src/renderers/BackgammonRenderer.ts`
- `client/src/renderers/DesignTokens.ts`

---

### Gately: Risk Renderer Uses Shared Six-Player Palette

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Risk visual redesign in `client/src/renderers/RiskRenderer.ts`

Use `client/src/renderers/DesignTokens.ts` as the single source of truth for Risk ownership, HUD, and board accents, with continent labels reusing the shared six-player palette instead of defining a separate Risk-only color table.

**Rationale:**
- Keeps Risk visually aligned with the redesign system and the documented player palette in `docs/design-system.md`.
- Prevents future drift between React design references and Pixi renderers by making ownership colors, borders, and HUD accents resolve through the same shared tokens.
- Lets renderer interaction states stay readable: player-color source glow for attack origin, red tint for attack targets, and violet for generic selection/valid-state emphasis.

**Files Affected:**
- `client/src/renderers/RiskRenderer.ts`
- `client/src/renderers/DesignTokens.ts`

**Follow-Up Note:**
If other board renderers are redesigned, add any missing gradient helpers or aliases to `DesignTokens.ts` first so renderer files can stay free of local color constants.

---

### Gately: Risk HUD Safe Defaults During State Hydration

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Fixing the join-time Risk renderer crash in `client/src/renderers/RiskRenderer.ts`

Keep `updateHUD()` active during Risk state hydration, but require the HUD text helpers to return safe empty values whenever `currentTurn`, `turnPhase`, or the local session id are not ready yet.

**Rationale:**
- Prevents Pixi `Text.text` from receiving `undefined` during the initial Colyseus sync window.
- Clears the HUD cleanly while state is incomplete instead of freezing whatever labels happened to be on screen previously.
- Localizes the sync-tolerance logic in `getStatusLabel()` and `getPhaseLabel()` without changing the rest of the button/HUD flow.

**Files Affected:**
- `client/src/renderers/RiskRenderer.ts`

**Follow-Up Note:**
Pixi's v8 deprecation warning still comes from `graphic.addChild(armyText)` and `graphic.addChild(nameText)` in `redrawMap()`. Those text nodes should move under `Container` parents when the renderer gets a broader rendering cleanup pass.

---

### Marathe: GitHub Release Publishing in Prod Deploy Workflow

**Status:** Implemented  
**Date:** 2026-03-16  
**Decider:** Marathe (DevOps/CI-CD)

**Context:** The production deployment workflow triggers on `v*` tags and deploys to Azure Container Apps, but did not create GitHub Releases. This required manual release creation after successful deployments.

**Decision:** Integrate release publishing into `deploy-prod.yml` rather than creating a separate release workflow. The release step is added after the health check and before Discord notification, with a conditional to only run on tag pushes (`if: github.ref_type == 'tag'`).

**Rationale:**
- **Post-deployment verification:** Releases should only be created after the deployment passes health checks. A separate workflow would run immediately on tag push, potentially creating releases for failed deployments.
- **Atomic operation:** The workflow now represents a complete atomic operation: deploy → verify → release → notify.
- **Clean conditional handling:** Using `if: github.ref_type == 'tag'` cleanly handles manual deploys via `workflow_dispatch` (which don't have tags and shouldn't create releases).
- **Logical coupling:** A release represents a deployed version. The release step should be tightly coupled with the deployment it represents.

**Implementation Details:**
- Updated permissions from `contents: read` to `contents: write`
- Uses gh CLI with `--generate-notes` for automatic changelog
- Added `--latest` flag to mark as latest release on repo homepage

**Files Affected:**
- `.github/workflows/deploy-prod.yml`

---

### Mario: Checkers UX Review Priorities

**Status:** Proposed  
**Date:** 2026-03-16  
**Author:** Mario (UX Consultant)

Prioritize clarity fixes over further visual polish in Checkers. The next UX pass should first eliminate HUD overlap, strengthen move affordances, and introduce responsive HUD compaction before adding more decorative rendering treatment.

**Why:**
1. The shared HUD and the Leave Game button currently compete for the same top-right space, which breaks the intended "one panel, one mental model" direction.
2. Move feedback relies on a small green dot and cursor change; it works, but it asks players to inspect the board instead of instantly reading it.
3. Fixed top/bottom board reservations make narrow screens feel underused because the board is pushed down even when vertical room is available.
4. The new gradient pieces are attractive, but the `♛` king marker is still typography-dependent and less robust than a shape-led indicator.

**Implementation Direction:**
- Keep the shared HTML HUD for status/player copy, but guarantee a no-overlap layout with the Leave Game button.
- Upgrade move feedback to a two-layer system: persistent selected state + larger destination affordance + hover preview on actionable squares.
- On narrow viewports, compact or relocate HUD chrome so the board can sit closer to the top safe area.
- Prefer a shape-based king marker (double ring or vector crown badge) over the current text glyph.


---

### 2026-03-16T01:16Z: User directive
**By:** dkirby-ms (via Copilot)
**What:** The old HUD status panel (turn info, player list, timer) is redundant now that the GameSidebar exists. Remove the status panel overlay and move the turn clock into the sidebar's game info panel instead.
**Why:** User request — captured for team memory

---

### 2026-03-16T01:23Z: Game sidebar reserves board space on desktop
**By:** Gately
**What:** When the in-game sidebar is visible on desktop, reserve a right-side layout lane for it by shrinking `#game-container` instead of floating the sidebar over the Pixi canvas. Coordinate HUD/canvas updates through a shared layout event and `ResizeObserver`.
**Why:** User request — the board must remain fully visible, and DOM overlay chrome should anchor to the board column instead of obscuring gameplay.

---

### 2026-03-16T02:22Z: Shared game status lives in the sidebar, not the HUD overlay
**By:** Gately
**What:** Remove the redundant shared HUD status card and keep `HUD.ts` focused on overlay chrome (Leave + chat) plus turn-clock timing. Renderer sidebars now own the visible game status, player info, and turn clock via a shared `GameSidebar` clock helper and `GameRenderer.setTurnClock()` hook.
**Why:** User request — the sidebar already surfaces game status and players, so duplicating that data in the HUD wasted screen space and split the same state across two UI surfaces. Centralizing visible status inside sidebar panels keeps the board column cleaner while preserving one shared countdown source.

---

### Gately: Version Footer: Center + Feedback Link

**Status:** Implemented  
**Date:** 2026-03-15  
**Author:** Gately (Game Dev - Frontend)  
**Issue:** #97  
**PR:** #118  

## Context

The version footer was positioned bottom-right and included only the version number. Needed to center it and add a feedback link to encourage user issue reporting.

## Decision

Moved version footer from bottom-right to bottom-center using Flexbox and CSS transforms. Added "Submit Feedback" link next to version.

## Implementation Details

- **Layout:** Flexbox with centered positioning using `left: 50%; transform: translateX(-50%)`
- **Structure:** Version text + separator bullet + feedback link
- **Link behavior:** Opens in new tab (`target="_blank"`) with security (`rel="noopener noreferrer"`)
- **Styling:** Subtle hover effect (opacity transition from 0.4 to 0.7) for feedback link
- **Pointer events:** Version text and separator are non-interactive; only link is clickable

## Why This Approach

1. **Center positioning** — Uses transform instead of margin for precise centering across all viewport widths
2. **Flexbox** — Easier to maintain gap spacing and alignment vs. manual positioning
3. **Inline hover handlers** — Kept simple since this is a one-off UI element
4. **Security attributes** — `rel="noopener noreferrer"` prevents tab-nabbing attacks on external links

## Future Considerations

If we add more footer links, consider extracting styles into a shared footer component.

**Files Affected:**
- `client/src/ui/HUD.ts` (footer JSX)
- `client/src/ui/gameLayout.ts` (footer styling)

---

### Gately: Dice Roll Animation Implementation

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately (Game Dev - Frontend/Rendering)  
**Issue:** #100  
**PR:** #119  

## Context

Backgammon needed a manual dice roll button instead of automatic rolling. Players should see visual feedback as dice are "rolling" before the server returns the actual values.

## Decision

Implemented client-side dice roll animation using frame-based approach:

### Animation Approach
- **Duration:** 20 frames (~333ms at 60fps)
- **Method:** Random dice faces shown each frame during animation
- **Trigger:** Button click sends "roll" action to server, starts animation immediately
- **Stop:** Animation stops when server returns real dice values (dice > 0)

### Why This Approach
1. **Frame-based vs Time-based:** Used frame counter instead of deltaTime for predictable, consistent duration
2. **requestAnimationFrame:** Leveraged existing game loop update() method - no setTimeout/setInterval (per team pattern)
3. **State-driven:** Animation state (`isRollingDice`) integrates cleanly with existing state management
4. **Server authoritative:** Client animation is purely visual - server determines actual dice values

### Technical Details
- Added 3 new class properties: `isRollingDice`, `rollAnimationFrame`, `rollAnimationDuration`
- Modified `redrawDice()` to show random values when `isRollingDice === true`
- Updated `update()` to advance animation frame counter
- Modified `applyState()` to stop animation when server sends real dice values
- Button enabled/disabled based on turn state and dice values (0,0 = unrolled)

### Button UX
- Enabled: Player's turn AND dice are 0,0 (unrolled) AND not currently animating
- Disabled: Otherwise
- Located: Sidebar controls panel, consistent with existing button styling

## Alternative Considered

Could have used CSS animation on HTML dice elements, but:
- Would require duplicating dice rendering logic
- PixiJS canvas-based rendering is already in place
- Random value animation simpler with direct Graphics API access

## Future Enhancement Opportunities
- Add sound effect on roll
- Add easing to animation (slow down at end)
- Vary animation duration based on dice values (longer = higher suspense)

**Files Affected:**
- `client/src/renderers/BackgammonRenderer.ts` (animation, button)
- `server/src/games/backgammon/BackgammonRoom.ts` (roll action)
- `shared/src/games/backgammon/BackgammonState.ts` (state schema)

---

## Session: PR Reviews & Issue Scoping (2026-03-16)

### Hal: PR #118 & #119 Review & Merge

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal  

Both pull requests reviewed, approved, and merged with squash.

#### PR #118: Footer UI
- **What:** Center version footer, add feedback link.
- **Review:** Clean UI change, proper security attributes, builds pass.
- **Verdict:** Low-risk cosmetic change. ✅ Merged.

#### PR #119: Backgammon Manual Dice Roll
- **What:** Manual dice roll button with animation for Backgammon.
- **Architecture:**
  - Client animation runs frame-based in `update()` loop (not setTimeout/setInterval per team pattern).
  - Server action validates through `validateAction()` hook (centralized, not duplicated).
  - Animation stops on state sync from server.
- **Review Checklist:**
  - ✅ Type safety — clean, no unsafe casts
  - ✅ State mutation — server-side only
  - ✅ No setTimeout/setInterval — uses game loop
  - ✅ Colyseus optional chaining — proper null checks
  - ✅ Event listeners — existing pattern, cleanup in place
  - ✅ Tests — updated and passing
- **Pattern Note:** Action handlers rely on `validateAction` for turn enforcement (consistent with existing `move` action). This is defense-in-depth: validation is centralized, not duplicated in handlers.
- **Verdict:** Solid implementation. ✅ Merged.

#### Housekeeping
- Closed issue #97 (duplicate).
- Closed issue #100 (obsolete).

---

### Hal: Scope Head-to-Head Mode for 2-Player Games (Issue #115)

**Status:** Proposal  
**Decision Owner:** Hal (Lead)  
**Issue:** #115  
**Date:** 2026-03-16  

#### Summary

Enable 2-player games (Checkers, Backgammon) to be played on a single shared device by allowing the board to rotate/flip between turns. This is a **Medium-scope feature** with **high value** for in-person play.

#### Recommendation

Implement now with a phased approach (Checkers MVP first, then Backgammon).

#### Architecture: Client-Side View Switching

Both players connect to the same game room via a single device client. The renderer dynamically determines board perspective based on whose turn it is (via `currentTurn` in state). Existing `isFlipped` logic in CheckersRenderer and similar patterns in BackgammonRenderer already support this—**no schema changes needed.**

**Key insight:** The renderer must switch from "show the board for the local player" to "show the board for the active turn player." This is a logic change, not an architectural change.

#### Server Impact

**Minimal.** No breaking changes:
- Existing `playerIndex` and `currentTurn` fields already support this use case.
- Server validation (checking that `sessionId` matches the current turn) works unchanged.
- Optional: Add `headToHeadMode` flag for telemetry (cosmetic).

#### Client Impact

**Moderate. 3–4 files:**
1. **LobbyScreen** — Add "Play on Shared Device?" toggle.
2. **CheckersRenderer** — Update `getLocalPlayerColor()` to use active turn player, not session-based player.
3. **BackgammonRenderer** — Same update (reuse pattern).
4. **GameScene / GameSidebar** — Add turn indicator UI and listener for turn changes.

No breaking changes to the GameRenderer interface or state schemas.

#### Complexity & Effort

- **Estimate:** 1.5–2 days (developer).
- **Breakdown:**
  - Renderer logic: 2–4 hours
  - Lobby UI: 1–2 hours
  - Testing & integration: 2–3 hours
  - Polish (deferred): animations, input locks, orientation hints

#### Risks

1. **Session Sharing:** Both players on one session; disconnect affects both. ✅ Acceptable for local play.
2. **Perspective Confusion:** Without a clear turn indicator, players may be unsure whose board they're looking at. ✅ Mitigated by UI "Player X's Turn" prompt.
3. **Input Timing:** A player could tap before their turn. ✅ Server validation prevents illegal moves; UX can improve with ready confirmation.

#### Implementation Plan

**Phase 1: Checkers (MVP)**
- Implement dynamic perspective logic in CheckersRenderer.
- Add lobby toggle and turn indicator.
- E2E test with two tabs.

**Phase 2: Backgammon**
- Port logic to BackgammonRenderer.
- Test with same E2E pattern.

**Phase 3: Polish (future)**
- Input lock UI.
- Board rotation animation.
- Device orientation lock detection.

#### Decision

✅ **Proceed with implementation.**
- Start with Checkers.
- Use existing state schema (no migrations).
- Follow the proposed phased approach.
- Aim for merge to `main` within 2 sprints.

---

### Pemulis: Scope CPU Opponents for Checkers (Issue #86)

**Status:** Proposal  
**Decision Owner:** Pemulis (Systems Dev)  
**Issue:** #86  
**Date:** 2026-03-16  

#### Problem Statement

Players currently need another human to play Checkers. This prevents single-player experience and limits engagement for users without friends available. We need a CPU opponent to play Checkers as the RED player while humans play as BLACK.

#### Architecture: Server-Side Bot Player

**Why server-side bot (not alternatives):**
- **Separate AI service?** Overkill for Checkers; adds latency, complexity, separate deployment.
- **Client-side AI?** Breaks server-authority; clients could cheat. Not viable.
- **Deferring to future?** Blocks single-player mode now; no architectural blocker.

#### How It Works

1. **Bot Creation:** When a human creates a single-player game, `LobbyRoom` optionally creates a CPU opponent.
2. **Bot Registration:** Create `PlayerInfo` with synthetic `sessionId` = `"cpu-opponent"`.
3. **Move Selection:** When `TurnManager.getCurrentPlayer()` returns the CPU's `sessionId`, call `selectCpuMove(state, difficulty)` → apply automatically (no network round-trip).
4. **Timing:** CPU should have a brief delay (200–500ms) for UI feedback.

#### AI Strategy: Greedy Heuristic (Recommended)

| Algorithm | Strength | Complexity | Code |
|-----------|----------|-----------|------|
| **Random** | Weak | Trivial | Pick any legal move at random |
| **Greedy Heuristic** | Medium | Low | Prefer captures, promotions, advancement |
| **Minimax + α-β** | Strong | Medium | Tree search with evaluation |

**Greedy Heuristic Algorithm:**
1. Get all legal moves
2. Filter & rank by:
   - Captures (highest priority — forced captures handled by rules)
   - King promotion (advance pieces toward back row)
   - Piece advancement (move toward opponent)
3. For ties, pick randomly (unpredictability)
4. Return highest-ranked move

**Why greedy:**
- **Fast:** O(m log m) where m ≈ 12 legal moves, instant execution.
- **Playable:** Captures pieces, promotes kings, feels like a real player.
- **Clean:** Evaluation function isolated, testable, easy to tune.
- **Scalable:** Can add Minimax later without rewriting core.

#### Difficulty Levels (Greedy + Tuning)

| Difficulty | Behavior |
|-----------|----------|
| **Easy** | Random move from legal set; or greedy with 50% random noise |
| **Medium** | Pure greedy: captures → promotions → advancement |
| **Hard** | Greedy + future risk: avoid moves that set up opponent captures; prefer defensive placements |

#### Room & Lobby Changes

**Lobby (`LobbyRoom.ts`):**
- Accept `cpuOpponent: boolean` and `cpuDifficulty: "easy" | "medium" | "hard"` options.
- Validate: only allow if `maxPlayers === 1` or single human in 2-player game.
- Pass options to game room creation.

**Game Room (`BaseGameRoom.ts`):**
- Store CPU options in `BaseGameRoomOptions`.
- In `onCreate()`: if `cpuOpponent`, create bot via `onPlayerJoin()` with synthetic sessionId.
- In turn execution: detect CPU turn, schedule delayed move (200ms), apply automatically.

**Checkers Plugin (`CheckersPlugin.ts`):**
- **No changes.** Plugin is already generic; doesn't care if player is human or bot.

#### Complexity Estimate: **SMALL**

**LOC Breakdown:**
- **New file:** `CpuOpponent.ts` (~80 lines) — move selection, heuristic evaluation
- **Lobby changes:** `LobbyRoom.ts` (~15 lines) — accept options, validate, pass to room
- **Game room changes:** `BaseGameRoom.ts` (~20 lines) — store options, detect CPU turn, schedule move
- **Tests:** `checkers.cpu.test.ts` (~100 lines) + `lobby-cpu.test.ts` (~50 lines)

**Total:** ~250 LOC including tests. **No schema changes, no plugin changes.**

#### Why Small

1. **No plugin changes** — plugin is already generic.
2. **Reuses existing state sync** — Colyseus already broadcasts CPU moves.
3. **No new game rules** — just move selection on an existing game.
4. **No persistence** — CPU games are ephemeral.
5. **No auth/multiplayer** — single-player only, simpler lifecycle.

#### Risk Areas & Mitigation

- **Turn timing:** CPU moves must be async (delayed) to feel responsive. Use Colyseus `clock.setTimeout()` for determinism.
- **Disconnection:** If human leaves, game ends cleanly via existing `onPlayerLeave()` logic.
- **Spectators:** CPU moves go through the same state mutation; spectators see them automatically.

#### MVP (Phase 1)

1. **Implement greedy heuristic CPU** (not random).
   - Reason: Random is not fun; greedy is minimal playable AI.
2. **Medium difficulty only** (no easy/hard yet).
   - Reason: Scope reduction; tuning is follow-up polish.
3. **Checkers only** (no other games).
   - Reason: Simplest; pattern proven here extends to Risk or Dominoes.
4. **No persistent CPU profiles.**
   - Reason: Out of scope; single-player sandbox.

#### Nice to Have (Phase 2)

- Easy/hard difficulty modes via heuristic tuning.
- Minimax for harder AI.
- Win/loss stats tracking.
- Multiple CPU opponents for future multiplayer AI games (Risk, Poker).

#### Out of Scope

- Chat/personality for CPU.
- Learning AI (reinforcement learning).
- Replays or analysis of CPU games.

#### Acceptance Criteria

A human player can:
1. ✅ Create a single-player Checkers game from the lobby.
2. ✅ See the CPU opponent join the game as player 2 (RED).
3. ✅ Play a complete game (move, capture, promote, win/lose) against the CPU.
4. ✅ CPU makes legal moves.
5. ✅ CPU doesn't hang the turn (~200ms move time).
6. ✅ Winning/losing against CPU counts the same as PvP.

#### Decision

✅ **Proceed with implementation.**
- Implement greedy heuristic (not random, not Minimax yet).
- Start with Checkers, Medium difficulty only.
- Follow MVP scope above.
- Can extend to other games and difficulty modes later.

---

---

## Session: PR #121 & #122 Review & Merge (2026-03-16)

### Pemulis: CPU Opponent Wiring (Issue #86)

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal (after Marathe rebase cleanup)

Represent the Checkers CPU opponent as a fixed synthetic participant (`cpu-opponent`) across both lobby pregame state and the server game room, and let `BaseGameRoom` schedule its turns through the normal plugin action pipeline.

**Rationale:**
- Keeps `CheckersPlugin` unchanged and human/CPU-agnostic.
- Reuses existing player ordering, win detection, reconnection, and renderer state sync.
- Makes single-player waiting rooms understandable to players because the CPU appears as a ready roster slot before start.

**Implementation Notes:**
- `LobbyRoom` accepts `cpuOpponent: true` only for Checkers and seeds a ready `PreGamePlayerInfo` for `cpu-opponent`.
- `BaseGameRoom` injects the synthetic player on first human join, then uses `clock.setTimeout(..., 200)` to trigger `selectCpuMove()` and replay `move` through the existing validate/handle/end-turn flow.
- Current MVP heuristic is deterministic: captures > promotions > advancement toward promotion.

---

### Pemulis: Head-to-Head Synthetic Lifecycle Follow-up (Issue #115)

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal (via Steeply's regression test)

Treat controller-owned synthetic participants as dependent lifecycle state:

1. Mirror the controller's connectivity onto any synthetic players it owns.
2. Restore those synthetic players only when the controller actually reconnects.
3. If the controller leaves permanently, do not award a forfeit to the owned synthetic seat; end the room with a no-winner cleanup path instead.

**Rationale:**
Head-to-head mode still has only one real device connection. Awarding wins to a synthetic seat owned by that same device breaks match semantics and prevents proper room disposal.

**Implementation Note:**
Current fix lives in `server/src/game/BaseGameRoom.ts` with regression coverage in `server/src/__tests__/BaseGameRoom.test.ts`. `handleReconnectionTimeout` now calls `finalizeParticipantDeparture`, which correctly triggers `releaseControllerOwnedParticipants`.

---

### Gately: Shared-Device Head-to-Head Control Model (Issue #115)

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal (third review, after Steeply's timeout fix)

For shared-device Checkers, keep both seats represented as normal room participants, but make the second seat a synthetic server-side participant whose `controllerSessionId` points at the real client holding the device.

**Rationale:**
- Reuses the existing `currentTurn`, turn manager, renderer, and endgame assumptions that already expect per-seat players.
- Keeps move authorization server-authoritative: the active seat still owns the turn, while the controller mapping lets one device submit actions for that seat.
- Contains the mode-specific branching to room join/action routing instead of duplicating Checkers logic for a separate offline mode.

**Implementation Notes:**
- Added `controllerSessionId` to `shared/src/BaseGameState.ts` so client and server can agree on who controls a seat.
- `server/src/game/BaseGameRoom.ts` synthesizes `shared-device-opponent` for head-to-head rooms and remaps incoming actions when the controlled seat is active.
- `server/src/rooms/LobbyRoom.ts` only enables the mode for Checkers and blocks extra non-spectator joins to waiting shared-device rooms.
- `client/src/renderers/CheckersRenderer.ts` and `client/src/scenes/GameScene.ts` read the controller mapping to rotate perspective and show pass-the-device prompts.

---

### Gately: Checkers Turn Indicator Design (Issue #115)

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal (third review)

Keep urgent turn feedback for Checkers inside the shared sidebar instead of rendering a separate board overlay banner.

**Rationale:**
- The board should stay visually clear while players are choosing moves.
- The existing `Game Info` panel already owns turn context, so emphasis belongs there.
- A highlighted sidebar row with subtle animation is noticeable without blocking pieces or targets.

**Implementation Notes:**
- Removed the Pixi banner layer and its view-model helper files.
- Added opt-in highlighted sidebar row/value styles in `client/src/ui/GameSidebar.ts`.
- `client/src/renderers/CheckersRenderer.ts` now renders `Your Turn` with token-driven accent colors and a soft pulse only when the local player is active.

---

### Marathe: Promote Workflow & Version Bumping

**Status:** Approved  
**Date:** 2026-03-16  

Add a dedicated manual GitHub Actions workflow at `.github/workflows/promote.yml` to handle dev→prod promotions with a controlled version bump.

**Rationale:**
- Production promotion should be explicit and operator-driven instead of tied to every branch merge.
- The repo is an npm workspace monorepo, so release version bumps must keep the root package, workspace packages, and lockfile aligned.
- Opening the `dev` → `prod` PR from the workflow keeps the release handoff transparent while still producing a release tag for downstream prod deployment automation.

**Implementation Notes:**
- Triggered by `workflow_dispatch` with `bump_type` choice input (`minor` or `major`).
- Checks out `dev`, configures `github-actions[bot]`, bumps versions in `package.json`, `client/package.json`, `server/package.json`, and `shared/package.json`, and refreshes `package-lock.json` with `npm install --package-lock-only --ignore-scripts --legacy-peer-deps`.
- Commits the bump to `dev`, creates `v*` tag, opens the `dev` → `prod` PR with `gh pr create`, then pushes the tag.
- Uses SHA-pinned `actions/checkout` and `actions/setup-node`, plus `contents: write` and `pull-requests: write` permissions.

---

### Marathe: Automatic Dev Patch Bump (Version Management)

**Status:** Approved  
**Date:** 2026-03-16  

Keep the automatic patch-version increment inside `.github/workflows/ci.yml` as a dedicated `version-bump` job that runs only after successful pushes to `dev`.

**Rationale:**
- The existing CI workflow already gates `dev` pushes with build, lint, and test, so adding the patch bump as a dependent job keeps the release signal coupled to the validated commit.
- PlayGrid is an npm workspace monorepo, so the bump must update the root package, all workspace package manifests, and `package-lock.json` together.
- Using a `[skip ci]` commit message on the bot-generated version commit prevents an infinite CI loop without needing a second workflow.

**Implementation Notes:**
- `build-test` continues to run for both `push` and `pull_request` events targeting `dev`.
- `version-bump` uses `if: github.event_name == 'push'`, job-level `contents: write`, SHA-pinned `actions/checkout` and `actions/setup-node`, and the same `github-actions[bot]` git identity pattern as `promote.yml`.
- The bump command sequence is `npm version patch --no-git-tag-version`, `npm pkg set version=...` for `client`, `server`, and `shared`, then `npm install --package-lock-only --ignore-scripts --legacy-peer-deps` before committing and pushing back to `dev`.

---

### Hal: PR #122 — Head-to-Head Mode Final Approval

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal

Approved the fix for the reconnection timeout issue in Head-to-Head mode.

**Verification:**
- **Code:** `handleReconnectionTimeout` now calls `finalizeParticipantDeparture`, which correctly triggers `releaseControllerOwnedParticipants`.
- **Tests:** New regression test in `BaseGameRoom.test.ts` confirms synthetic player is removed and game ends in a draw (not forfeit) when controller times out.
- **Build:** Passed.

---

---

### Hal: Route Issue #87 (CPU Opponents in Backgammon) to Pemulis

**Status:** Approved  
**Date:** 2026-03-16  

Route to **Pemulis** (Systems Dev) with label `squad:pemulis`.

**Rationale:**
- **Pattern exists:** PR #121 established CPU opponent pattern in Checkers. Backgammon implementation follows the same architecture — no new patterns needed.
- **Routing fit:** Per `routing.md`, game systems (AI, simulation) → Pemulis. CPU opponent is pure simulation logic, not rendering or test framework work.
- **Scope is tight:** Implementation is a single module (`server/src/games/backgammon/CpuOpponent.ts`) with clear interfaces and proven patterns from Checkers.

**Implementation Notes for Pemulis:**
- **Reference:** `server/src/games/checkers/CpuOpponent.ts` for move selection structure
- **Framework:** CPU turns are already managed generically in `BaseGameRoom.executeCpuTurn()` — no framework changes needed
- **Game-specific logic:** Backgammon move scoring will differ from Checkers (prioritize bearing off, avoid blots) but reuses game validation/move application utilities

---

### Copilot: CI Failures Should Create Automatic Issues

**Status:** Captured  
**Date:** 2026-03-16  
**Source:** User directive via Copilot

CI failures should automatically create a GitHub issue tagged to the squad.

**Rationale:** User request — captured for team memory. Formal implementation approved separately (see Marathe decision below).

---

### Marathe: CI Failure Auto-Issue on Dev

**Status:** Approved  
**Date:** 2026-03-16  
**Requested by:** dkirby-ms

Add a `create-failure-issue` job to `.github/workflows/ci.yml` that runs only when `build-test` fails on `push` events to `dev`, and creates a deduplicated GitHub issue labeled `squad` and `bug` via `gh issue create`.

**Implementation details:**
- Job-level guard uses `if: failure() && github.event_name == 'push' && github.ref == 'refs/heads/dev'`
- Job depends on `build-test` and has `issues: write` permission
- The issue title includes the short commit SHA and `CI build failure`
- The issue body includes the workflow run link, commit message, commit author, and branch
- Duplicate issues are prevented by checking existing titles first with `gh issue list`

**Rationale:**
- CI failures on `dev` should become immediately actionable backlog items for Ralph and squad triage
- Using `gh` keeps the workflow simple and avoids introducing another third-party action surface
- Deduplication prevents repeated failing pushes for the same commit from spamming the issue tracker

**Related operational fix:**
- `server/package.json` now declares `@colyseus/schema` explicitly so CI installs do not rely on root hoisting for `server/src/game/GameRegistry.ts`

---

### Pemulis: Generalized CPU opponent framework in BaseGameRoom

**Status:** Approved  
**Date:** 2026-03-16  
**PR:** #125  
**Issue:** #87  

Generalized the CPU opponent framework to support multiple games by:
1. Widening the `cpuOpponentEnabled` gate to accept `"checkers" || "backgammon"`
2. Removing the `plugin.id === "checkers"` guard from `isCpuTurn()`
3. Splitting `executeCpuTurn()` into game-specific dispatchers (`executeCheckersCpuTurn`, `executeBackgammonCpuTurn`)

**Rationale:**
Backgammon requires multi-action CPU turns (roll then move × N), which differs from Checkers' single-action turns. Rather than force a one-size-fits-all interface, each game gets its own executor method. The existing `queueCpuTurnIfNeeded()` loop naturally handles the multi-step flow.

**Future Games:**
Future games wanting CPU support need to:
1. Create a `CpuOpponent.ts` with a selection function
2. Add the gameType to the `cpuOpponentEnabled` gate
3. Add an `execute{Game}CpuTurn()` method in BaseGameRoom

# Decision: PR #125 Re-Review — Backgammon CPU Pass Action

**Author:** Hal (Lead)
**Date:** 2026-03-16
**Status:** Approved & Merged

## Context

PR #125 (feat: CPU opponents in Backgammon, issue #87) was rejected because `selectCpuAction` returned `null` when the CPU rolled dice with no valid moves, which triggered `handleTurnTimeout` and forfeited the game.

Gately fixed this by introducing a `pass` action — a proper backgammon mechanic where a player with no legal moves passes their turn.

## Decision

Approved the pass-action fix and merged PR #125 to dev.

## Rationale

1. **Correct game mechanics:** Passing when no moves exist is standard backgammon rules
2. **Validation prevents abuse:** Pass is only allowed when dice are rolled AND no valid moves exist
3. **Clean integration:** Pass flows through the existing action processing pipeline (no special-case paths)
4. **Good test coverage:** 5 tests cover the fix (3 plugin tests + 2 updated CPU tests)
5. **Build/lint/test all green:** 289 tests pass, 0 lint errors

## Impact

- CPU opponents in Backgammon now handle all game states correctly
- Pattern established: games with no-move situations need explicit pass/skip actions in the plugin
- All future game plugins should avoid returning `null` from CPU action selectors for recoverable game states

---

## Backgammon CPU Opponent Review Cycle — Initial Phase (2026-03-16)

### Hal: PR #125 Code Review — CPU Opponents in Backgammon (Initial Review)

**Status:** Changes Requested  
**Date:** 2026-03-16  
**PR:** #125 (squad/87-backgammon-cpu → dev)  
**Author:** Pemulis  

**Decision:** Request changes before merge. One critical bug found.

**Critical Issue:**
When the CPU has no valid moves after rolling dice (a normal Backgammon state), `selectCpuAction` returns `null`, causing `executeBackgammonCpuTurn` to call `handleTurnTimeout`, which ends the game with a forfeit. This is incorrect — the turn should pass to the opponent.

**Required Fix:**
1. Add a `"pass"` action to `BackgammonPlugin` — resets dice, returns `endsTurn: true`
2. Validate pass only when dice are rolled and `hasValidMoves()` returns false
3. `selectCpuAction` returns `{ actionType: "pass" }` for this case (not `null`)
4. Add test for this scenario

**Notes:**
- This also fixes a pre-existing gap for human players in the same scenario
- Overall implementation quality is good; this is the only blocking issue
- Pemulis should fix and re-request review

---

### Gately: PR #125 Fix Implementation — Backgammon CPU "pass" Action

**Status:** Completed, Ready for Re-Review  
**Date:** 2026-03-16  
**PR:** #125 (squad/87-backgammon-cpu → dev)  
**Context:** Applied Hal's recommended fix (Pemulis locked out due to concurrent changes)

**Decision:** Implement "pass" action to resolve CPU no-valid-moves bug per Hal's specification.

**Changes Applied:**
1. Added `"pass"` action to `BackgammonPlugin.executeAction()`
   - Validates: dice rolled AND `!hasValidMoves()`
   - Returns `{ endsTurn: true }` (resets dice, passes turn)
   
2. Updated `selectCpuAction()` in BackgammonCpuOpponent
   - Returns `{ actionType: "pass" }` instead of `null` when no moves exist
   
3. Tests added (3 new, 2 updated)
   - Scenario: CPU has dice but no legal moves → must pass
   - Human player in same state → also respects pass logic
   - Edge cases: pass when dice not rolled (rejected), pass when moves exist (rejected)

**Verification:**
- All 289 tests pass
- No regressions detected
- PR pushed for re-review by Hal

**Notes:**
- Pemulis was locked out due to concurrent fix work; Gately applied the changes
- This fix also resolves the gap for human players in the same scenario (bonus improvement)
- Implementation matches Hal's recommendation exactly

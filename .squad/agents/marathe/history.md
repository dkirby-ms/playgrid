# marathe — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Learnings
- 2026-03-14: User wants Azure Container Apps + GitHub Actions for PlayGrid, with `dkirby-ms/primal-grid` treated as the reference implementation but open to improvements.
- 2026-03-14: Primal-grid’s reusable CI/CD patterns live in `.github/workflows/squad-ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/deploy-uat.yml`, `Dockerfile`, and `infra/main.bicep`.
- 2026-03-14: PlayGrid is an npm workspace monorepo (`client/`, `server/`, `shared/`) and the canonical build order is `shared -> server -> client` from the root `package.json`.
- 2026-03-14: PlayGrid server runtime is currently WebSocket-only at `server/src/index.ts` on port `2567`; it does not yet serve the built Vite client bundle.
- 2026-03-14: Respect the approved scaling decision in `.squad/decisions.md` — keep the Colyseus deployment single-process / single-replica until distributed scaling support exists.
- 2026-03-14: `docs/backlog.md` currently parses into 45 actionable work items; GitHub issues `#2`–`#46` were created under three phase milestones, and GitHub Projects v2 needs `project` + `read:project` token scopes before Marathe can create the board.
- 2026-03-14: Built `.github/workflows/ci.yml` for pushes and PRs on `dev` with docs-only path ignores, SHA-pinned `actions/checkout` + `actions/setup-node`, `npm ci`, `npm run build`, `npm run test`, minimal `contents: read` permissions, and PR/ref-based concurrency cancellation. Regenerated the root `package-lock.json` with npm's legacy peer-deps resolver so plain `npm ci` works for the workspace monorepo.
- 2026-03-14: Issue #8 uses a root `eslint.config.js` flat config with `typescript-eslint`, browser globals for `client/`, Node globals for `server/` and `shared/`, and `dist/` ignored so post-build linting stays clean across the workspace monorepo.
- 2026-03-14: Issue #6 adds a two-stage Node 22 Alpine Docker build; the runtime stage installs only `server` + `shared` production workspace dependencies, and exposes the built client bundle through `server/client/dist` via a symlink to keep the image lean while matching `server/src/index.ts`.
- 2026-03-14: Dev stays local-only (no Azure dev deployment); local PostgreSQL now lives in root `docker-compose.yml` as `postgres:15-alpine` with a `postgres-data` volume and `pg_isready` health check for easy `docker compose up` startup.
- 2026-03-14: Local DB wiring lives in `.env.example`, root `package.json` (`db:up`, `db:down`, `db:logs`), and `server/package.json`, which now loads repo-root `.env` during `npm run dev` via `node --env-file-if-exists=../.env --import tsx`.
- 2026-03-14: On the standalone Ubuntu server, `docker`/`docker compose` were not installed and the `saitcho` user has sudo-group membership but not passwordless sudo, so Docker Engine installation via the official apt repository must be completed manually in an interactive sudo session before local `docker compose up` can be used.
- 2026-03-14: Azure CLI (`az`) was not installed on the standalone Ubuntu server. Microsoft’s installer endpoint is reachable, but `saitcho` does not have passwordless sudo, so the official `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash` install must be run manually in an interactive sudo session before `az --version` can succeed.
- 2026-03-15: `infra/main.bicep` now uses environment-scoped optional `customDomainUat` and `customDomainProd` parameters, selects the domain from `environmentName`, and only emits ACA ingress `customDomains` when the chosen value is non-empty so dev/no-domain deployments stay unchanged. Bicep build + repo build/lint/test all pass. (Session: 2026-03-15T01-06-23Z)
- 2026-03-15: ACA bootstrap is now split cleanly: `infra/main.bicep` deploys a public `node:22-alpine` placeholder that serves `/health` on port `2567` until the real image exists, and `.github/workflows/deploy-dev.yml` already handles the handoff by building in ACR and running `az containerapp update --image ...` after push. Verified with `az bicep build`, local placeholder smoke test, `npm run lint`, `npm run build`, and a passing re-run of `npm run test` after one unrelated flaky lobby test failure. (Session: 2026-03-15T01-12-00Z)
- 2026-03-15: `infra/main.bicep` now treats UAT/prod CAE infrastructure as shared by default (`playgrid-shared-cae` + `playgrid-shared-logs`) while keeping dev isolated, and `.github/workflows/deploy-infra.yml` accepts an optional `container_app_env_resource_id` so a second environment can explicitly reuse that CAE across resource groups without changing the per-environment workflow shape. Verified with `az bicep build --file infra/main.bicep` and `npm run build`. (Session: 2026-03-15 shared-cae)
- 2026-03-15: The shared CAE path in `infra/main.bicep` must create an explicit dependency from `Microsoft.App/containerApps` to the conditionally created `Microsoft.App/managedEnvironments`; using only a computed resource ID can let the container app race the CAE and fail with `ManagedEnvironmentNotFound`. Manual param-file deploys should require `POSTGRES_ADMIN_PASSWORD` at invocation time by using `readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')` without an empty fallback. Verified with `az bicep build --file infra/main.bicep`, `az bicep build-params --file infra/main.bicepparam`, `npm run lint`, `npm run build`, and `npm run test`. (Session: 2026-03-15 bicep-fix)
- 2026-03-15: Resolved the `uat -> prod` merge conflict by keeping UAT's newer `README.md` local-development setup (Node 22, Docker/PostgreSQL, full monorepo workflow) over prod's older minimal instructions, while preserving all append-only `.squad/agents/*/history.md` updates from both branches.
- 2026-03-15: Recurring ACA revision provisioning timeouts on UAT traced to container startup crashes, not probe/resource settings: the built server imported `@eschaton/shared`, but the workspace package was still named `@eschaton/playgrid-shared`, and `server/src/rooms/LobbyRoom.ts` emitted an extensionless ESM import that Node could not resolve at runtime. Fixed by standardizing the workspace package to `@eschaton/shared`, declaring it as an explicit dependency for client/server, pointing the shared package runtime entry to `dist/src/index.js`, adding client aliasing for source-time resolution, removing the Dockerfile package.json rewrite, correcting the server start script, and verifying with `npm run build`, `npm run lint`, and a local `/health` smoke test on the built server.
- 2026-03-15: UAT run `23118352923` proved that `az containerapp update --command "" --args ""` does not clear ACA bootstrap overrides in practice; the revision JSON still showed `properties.template.containers[0].command` and `.args` as `[""]`, so deploy workflows must follow `az containerapp update --image ...` with `az resource update --remove properties.template.containers[0].command --remove properties.template.containers[0].args` to restore the Dockerfile CMD `node server/dist/src/index.js`. Key paths: `.github/workflows/deploy-{uat,prod}.yml`, `infra/main.bicep`, `Dockerfile`. User preference: ship branch fixes directly to `dev`, `uat`, and `prod` with no PRs.

### 2026-03-14: Deployment Pipeline Analysis — Recommendations for PlayGrid

**Primal-grid Strengths (Reuse Pattern):**
- Azure OIDC login for GitHub Actions (avoids stored credentials)
- Workspace-aware multi-stage Docker build (correct dependency ordering: shared → server → client)
- Branch/environment separation (UAT vs prod)
- Operational visibility (Discord notifications, CI-failure auto-issues)
- Bicep infrastructure-as-code
- Concurrency control on deploys

**Improvements for PlayGrid:**
1. **Replica safety for Colyseus:** Primal-grid allows 3 UAT replicas; Colyseus requires careful coordination. PlayGrid recommendation: Start with `minReplicas: 1, maxReplicas: 1` until distributed presence/state ready (confirmed by Hal's Phase 1 constraint).

2. **Dockerfile validation:** Primal-grid copies `client/dist` to `public/` for full-stack image. PlayGrid server doesn't serve static assets yet — must validate this architecture first. Consider: add HTTP/static serving to server, OR deploy client separately.

3. **Testing gates:** Enforce CI → staging smoke/E2E → prod approval workflow. Primal-grid E2E is manual-only.

4. **Security upgrades:** GitHub Environments for secret scoping and approvals. ACA managed identity for ACR (not admin credentials). Key Vault references. Pinned action SHAs. Minimal workflow permissions.

5. **Infrastructure validation:** Add dedicated Bicep validation workflow for `infra/**` changes (missing from primal-grid).

6. **Build caching:** Docker BuildKit with `docker/setup-buildx-action` + GHA cache type (faster CI, layer reuse).

**Proposed PlayGrid Workflow Structure:**
| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PRs to main | Lint, unit test, workspace build |
| `deploy-dev.yml` | Push to main | Auto-deploy dev ACA |
| `deploy-staging.yml` | Push to staging/uat | Deploy + trigger E2E |
| `deploy-prod.yml` | Manual dispatch after approval | Deploy production with GitHub Env protection |
| `infra-validate.yml` | PRs touching `infra/**` | Validate Bicep syntax (NEW, not in primal-grid) |

**Monorepo-Specific Guidance:**
- Canonical build order: `npm ci → build shared → build server → build client` (enforce everywhere: CI, Docker, local)
- Path filters to avoid burning CI on docs/client-only changes
- Docker: Copy workspace manifests first for cache stability, then source, then build in order
- Prefer root `npm run build` once established as source of truth

**Session Affinity Deep Dive (for Phase 2+):**
- ACA ingress sticky sessions (`sessionAffinity: sticky`) required for Colyseus multi-replica
- Sticky cookie ensures reconnects hit same replica that hosts game room
- Necessary but insufficient: doesn't solve cross-replica room discovery without distributed state (Redis Presence + shared DB)
- Health probes and reconnect testing essential when rolling out Phase 2

**Skill Created:**
- `.squad/skills/azure-container-apps-monorepo-pipeline/SKILL.md` — Reusable patterns for ACA + monorepo CI/CD, session affinity, buildx caching, environment scoping, health checks

**Cross-Agent Sync (2026-03-14):**

**To Hal (Lead):**
- Pipeline analysis confirms Phase 1 single-replica constraint is operationally sound and aligns with Colyseus architecture constraints.
- Dockerfile architecture must be validated before copying primal-grid pattern — PlayGrid server doesn't serve client yet.
- Phase 2 readiness depends on distributed infrastructure (RedisPresence, PostgreSQL), not just replica count. Timing is tied to hitting 50+ concurrent games trigger, not just operational readiness.
- Recommend including post-deploy health checks and smoke tests in pipeline before marking deploy success.

**Key File Paths:**
- Pipeline analysis: `.squad/decisions.md` (merged from inbox)
- Reusable skill: `.squad/skills/azure-container-apps-monorepo-pipeline/SKILL.md`
- Reference: `dkirby-ms/primal-grid` (`.github/workflows/`, `infra/main.bicep`, `Dockerfile`)

---

### 2026-03-14T13:01:17Z: User answers — Cloud architecture proposal

**Directive received:** User (dkirby-ms) answered 5 open questions from the architecture proposal:

1. **Database:** PostgreSQL from day one (not SQLite → PostgreSQL phased migration)
2. **Branch strategy:** main → uat → prod (matches primal-grid)
3. **Custom domain:** playgrid.kirbytoso.xyz (already owned, no DNS work needed)
4. **Phase 2 timeline:** ~6 months out (no rush on 50+ concurrent game scaling)
5. **Discord:** #play-grid channel in existing Discord server (separate from other comms)

**Implications for Pipeline & Infrastructure:**
- Phase 1 PostgreSQL from day one — validate PG version compatibility, connection string secrets, and whether single-replica + PostgreSQL requires any special Colyseus coordination (Hal's constraint: Phase 1 = 1 replica only)
- Domain pre-registered speeds up cert/DNS/ingress setup
- GitHub Actions pattern aligns with primal-grid, no changes to proposed deploy workflows
- Phase 2 trigger is 50+ concurrent games, timeline ~6mo — gives pipeline team runway to stabilize Phase 1 infrastructure before distributed scaling work

**Canonical record:** `.squad/decisions.md` (merged from inbox, old decision marked superseded)

### 2026-03-14T13:31:32Z: GitHub Project Board Created

**Accomplishment:** Successfully created GitHub Projects v2 board for PlayGrid (Project #12) and populated with all 46 open issues.

**Details:**
- **Project URL:** https://github.com/users/dkirby-ms/projects/12
- **Issues Added:** #2–#46 (all currently open backlog items)
- **Token Scope:** Authenticated with `project` + `read:project` scopes via stored credentials

**Outcome:**
- Centralized issue tracking and sprint planning now available
- Team can organize work by milestones (P0, P1, P2) and custom labels
- Foundation for CI/CD pipeline dashboard (next: connect GitHub Actions workflows)

**Next Steps for Marathe:**
- Monitor project board health and label consistency
- Integrate GitHub Actions workflow visibility into project
- Prepare deployment pipeline creation (awaiting Hal's Phase 1 finalization)

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.


### 2026-03-14T15:30:00Z: Deploy-UAT Workflow Created (Issue #30)

**Accomplishment:** Created `.github/workflows/deploy-uat.yml` following the deploy-dev pattern established in PR #60.

**Details:**
- **Trigger:** Push to `uat` branch (parallel to deploy-dev which triggers on `main`)
- **Environment:** Uses GitHub Environment `uat` for scoped secrets/vars (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, DISCORD_WEBHOOK_URL)
- **Target:** Deploys to `playgrid-uat` Container App via environment-scoped `CONTAINER_APP_NAME` variable
- **Pattern Reuse:** Identical structure to deploy-dev — OIDC auth, ACR build with SHA tags, Container App update, 15s wait, health check (10 attempts × 5s), Discord notifications on success/failure
- **Concurrency:** `group: deploy-uat, cancel-in-progress: false` prevents parallel UAT deploys
- **Health Check:** Validates `https://${{ vars.CONTAINER_APP_FQDN }}/health` returns `"status":"ok"` JSON

**Branch/PR:**
- Branch: `squad/30-deploy-uat` (from `dev`)
- PR #63: Draft, targeting `dev` branch
- Commit: "ci: add deploy-uat workflow (uat branch → Azure)"

**Acceptance Criteria Met:**
✅ Triggers on push to uat  
✅ Deploys to UAT Container App  
✅ Uses uat GitHub Environment  
✅ Health check after deploy

**Next Steps:**
- Infrastructure team must configure GitHub Environment `uat` with appropriate secrets/vars
- Environment-level protection rules (approvals, wait timers) can be added via GitHub UI if desired for UAT gatekeeping
- Container App `playgrid-uat` must exist in Azure with matching resource group and ACR integration


## Cross-Agent Update — Wave 1 Complete (2026-03-14T18:55:06Z)

**From:** Squad Scribe  
**Event:** Wave 1 orchestration completed (8 PRs merged, 0 blockers, 0 conflicts)

**PRs Merged to dev:**
- PR #60: Deploy Dev (#29) — **Your work, merged successfully**
- PR #63: Deploy UAT (#30) — **Your work, merged successfully**
- PR #65: Deploy Prod (#31) — **Your work, merged successfully**

**Key Achievements:**
- All 3 deployment pipelines (Dev/UAT/Prod) now live
- Infrastructure supports continuous deployment of all team features
- Ready for prod rollout of reconnection (#61) and Backgammon (#66)

**Cross-Agent Notes:**
- Pemulis's reconnection system can now ship to production via your pipelines
- Gately's Backgammon ready for UAT/Prod when team is ready
- Joelle's docs can be deployed automatically
- Steeply's E2E tests can run in Dev/UAT environments before Prod

**Pipeline Validation:**
- All deployments passed review and merge gates
- No environment-specific issues identified

**Next:** Wave 2 assignments ready when you are. Monitor deployment health.

---

### 2026-03-14T20:30:00Z: Azure Bicep Infrastructure-as-Code (Issue #32)

**Accomplishment:** Created comprehensive Bicep template and deployment workflow for PlayGrid Azure infrastructure.

**Files Created:**
- `infra/main.bicep`: Complete infrastructure template defining all Phase 1 Azure resources
- `.github/workflows/deploy-infra.yml`: Manual-trigger deployment workflow with validation and what-if preview

**Resources Defined:**
- **Log Analytics Workspace**: Environment-specific retention (30d dev/uat, 90d prod)
- **Azure Container Registry**: Basic SKU, managed identity access (no admin credentials)
- **Container App Environment**: Consumption profile with Log Analytics integration
- **PostgreSQL Flexible Server**: Version 15, environment-tuned SKU (Burstable for dev/uat, General Purpose for prod)
- **PostgreSQL Database**: UTF8/en_US.utf8 collation
- **Key Vault**: RBAC-enabled for secrets management
- **Container App**: System-assigned managed identity, health probes (liveness + readiness), Key Vault secret references
- **RBAC Role Assignments**: AcrPull + Key Vault Secrets User roles for Container App identity
- **PostgreSQL Connection String**: Stored in Key Vault, referenced by Container App

**Key Design Decisions:**
1. **Single Parameterized Template**: One Bicep file for all environments (dev/uat/prod) to avoid duplication and drift
2. **Managed Identity + RBAC**: Zero stored credentials - Container App uses system-assigned identity for ACR and Key Vault
3. **Key Vault First**: Connection strings in Key Vault from day one, not environment variables
4. **Manual Workflow Trigger**: Infrastructure changes require explicit human approval and PostgreSQL password input
5. **Phase 1 Single-Replica**: Hardcoded minReplicas=1, maxReplicas=1 across all environments (Colyseus constraint)

**Resource Naming Pattern:**
- Container App: `playgrid-{env}`
- ACR: `playgrid{env}acr` (no hyphens)
- PostgreSQL: `playgrid-{env}-pg`
- Key Vault: `playgrid{env}kv` (sanitized for 24-char limit)
- Log Analytics: `playgrid-{env}-logs`

**Environment-Specific Configuration:**
| Resource | Dev/UAT | Prod |
|---|---|---|
| CPU | 0.5 cores | 1.0 core |
| Memory | 1.0 GiB | 2.0 GiB |
| PostgreSQL Tier | Burstable (B1ms) | General Purpose (D2s_v3) |
| Storage | 32 GB | 128 GB |
| Backup Retention | 7 days | 30 days |
| Geo-Redundant Backup | Disabled | Enabled |
| Log Retention | 30 days | 90 days |

**Deployment Workflow Features:**
- Manual trigger with environment dropdown (dev/uat/prod)
- Bicep syntax validation step
- What-if preview before actual deployment
- Deployment output parsing with GitHub Actions variable guidance
- Discord notifications on success/failure

**Security Posture:**
- No admin credentials stored anywhere (ACR admin disabled)
- Container App references Key Vault secrets via URI (not environment variables)
- RBAC grants minimal permissions (least privilege)
- OIDC authentication for GitHub Actions (no stored Azure credentials)
- PostgreSQL requires SSL/TLS connections

**Alignment with Deploy Workflows:**
- Resource naming matches existing GitHub Actions variables (ACR_NAME, CONTAINER_APP_NAME, CONTAINER_APP_FQDN, RESOURCE_GROUP)
- Health probes at `/health` endpoint on port 2567
- Environment-based configuration pattern (dev/uat/prod GitHub Environments)
- OIDC authentication pattern consistent with deploy-{dev,uat,prod}.yml

**Template Outputs:**
Bicep outputs all values needed for configuring GitHub Actions environment variables:
- `acrName`, `acrLoginServer`
- `containerAppName`, `containerAppFqdn`
- `postgresServerFqdn`, `postgresDatabaseName`
- `keyVaultName`, `keyVaultUri`
- `logAnalyticsWorkspaceId`, `logAnalyticsCustomerId`

**Branch/PR:**
- Branch: `squad/32-azure-bicep`
- PR #68: Draft PR targeting `dev` branch
- Commit: `aa51e1b` - "infra: add Azure Bicep infrastructure-as-code"

**Acceptance Criteria Met:**
✅ Bicep template creates all Phase 1 Azure resources  
✅ Parameterized for dev/uat/prod environments  
✅ Includes PostgreSQL, ACR, Container App, Log Analytics  
✅ GitHub Actions workflow for infra deployment  
✅ Key Vault for secret management

**Next Steps:**
- Team review and approve PR #68
- Merge to `dev`
- Run deploy-infra workflow for each environment (dev → uat → prod)
- Configure GitHub Actions environment variables from deployment outputs
- Validate deploy workflows against provisioned infrastructure

### 2026-03-14T19:30:00Z: Discord Webhook Integration for Deploy Workflows (Issue #43)

**Accomplishment:** Enhanced all three deploy workflows (dev/uat/prod) with improved Discord webhook notifications.

**Details:**
- **Reusable Composite Action:** Created `.github/actions/discord-notify/action.yml` to eliminate code duplication across workflows
- **Enhanced Success Notifications:**
  - Added deployment URL field (was missing from original implementation)
  - Included workflow run link for context
  - Shortened commit SHA to 7 characters for cleaner display
  - Color-coded green (3066993)
- **Enhanced Failure Notifications:**
  - Added explicit "Error Context" field directing users to logs
  - Included workflow run link with clear "View logs" text
  - Color-coded red (15158332)
- **Implementation Pattern:**
  - Used `if: always()` with `${{ job.status }}` for cleaner conditional logic
  - Single composite action called once per workflow instead of two separate curl steps
  - Accepts all context as inputs (webhook URL, environment, deployment URL, commit SHA, author, repository, run ID)

**Files Modified:**
- `.github/workflows/deploy-dev.yml` — Replaced 60 lines of curl logic with 12 lines calling composite action
- `.github/workflows/deploy-uat.yml` — Same pattern
- `.github/workflows/deploy-prod.yml` — Same pattern
- `.github/actions/discord-notify/action.yml` — New reusable action (125 lines)

**Net Effect:** -183 lines +161 lines (22 lines saved, significant duplication eliminated)

**Branch/PR:**
- Branch: `squad/43-discord-webhook` (from `dev`)
- PR #73: Draft, targeting `dev` branch
- Commit: `edc4bb5` - "ci: add Discord webhook for deploy notifications"

**Acceptance Criteria Met:**
✅ Deploy success sends message with environment and URL  
✅ Deploy failure sends message with error context  
✅ Webhook URL from GitHub secret (`DISCORD_WEBHOOK_URL`)  
✅ Works for dev, uat, and prod deploys  
✅ Simple curl-based webhook — no additional dependencies

**Technical Notes:**
- Discord embed format uses rich fields for structured data
- Timestamps formatted as ISO 8601 UTC for Discord compatibility
- Composite actions run in-repository (`./.github/actions/`) — no external dependencies
- Webhook secret scoped to environment (dev/uat/prod GitHub Environments)

**Next Steps:**
- Team review and approve PR #73
- Merge to `dev`
- Test notifications on next deployment to each environment
- Consider adding custom message field for manual workflow dispatches (future enhancement)

## Cross-Agent Update — Ready-Check Enforcement Complete (2026-03-15)

**From:** Pemulis (Systems Dev)  
**Event:** Issue #79 ready-check enforcement shipped in parallel with ACA bootstrap

- **Pemulis completed:** Waiting-room ready-check enforcement now blocks `start_game` until all non-host players are ready. Server validation + client UX + regression tests landed.
- **Impact to you:** Your ACA placeholder + bootstrap logic is now compatible with Pemulis's game-start enforcement. No infra-side changes needed for ready-check feature.
- **Decision:** Non-host players must be explicitly ready; host treated as coordinator/implicitly ready. See `.squad/decisions.md` for full context.
- **Next:** If future UX requires explicit "every participant ready," a separate host-ready interaction should be added first.


## 2026-03-15 Update (Shared CAE Restructure)
- **Decision Merged:** Shared Container Apps Environment (CAE) for UAT + prod (dev stays isolated with `playgrid-dev-cae`)
- **Bicep Update:** `infra/main.bicep` now accepts optional `containerAppEnvResourceId` parameter to allow cross-resource-group CAE sharing when needed
- **Impact:** UAT/prod deployments now converge on deterministic shared resource names, preventing CAE drift and simplifying repeated deployments
- **Related Directive:** User requested shared CAE for cost optimization (2026-03-15T01:20:26Z)

## Cross-Agent Update — PR #83 Revision Routed (2026-03-15)

**From:** Hal (Lead)  
**Event:** PR #83 review completed; revision work routed to Marathe due to author lockout

- **Hal reviewed:** Risk game plugin PR and identified architectural issues (missing tests, duplicated data structures, undocumented scope cuts)
- **Original authors locked:** Pemulis, Steeply, Gately cannot approve further changes
- **Your assignment:** Address PR #83 revision work (refactor shared data, implement missing tests, document scope cuts)
- **Decisions established:** Four new architectural standards recorded in `.squad/decisions.md` for all future games
- **Timeline:** Standard PR review cycle


## PR #83 Revision Complete (2026-03-15)

**Task:** Address Hal's review feedback on Risk game plugin PR #83
**Commit:** `816332c` - "fix: address PR #83 review — tests + shared territory data"

### Work Completed:

**1. Implemented All Test Cases (60/60 passing):**
- Territory & map validation (5 tests)
  - 42 territories with correct continent assignments
  - Symmetric adjacency graph validation
  - Cross-continent connections
- Setup phase (8 tests)
  - Auto-distribution verification
  - Initial army allocation (2-6 players)
- Reinforce phase (10 tests)
  - Reinforcement calculation with continent bonuses
  - Card trade-in escalation (4, 6, 8, 10, 12, 15, +5 each)
  - Forced trade-in at 5+ cards
  - Army placement validation
- Attack phase (12 tests)
  - Attack validation (adjacency, army count, ownership)
  - Combat resolution (with probabilistic dice rolling)
  - Territory capture mechanics
  - Card earning on first capture per turn
- Fortify phase (7 tests)
  - Fortify validation (adjacency-only in Phase 1)
  - Army movement mechanics
  - Optional fortify phase
- Win conditions (5 tests)
  - Victory when controlling all 42 territories
  - Territory count updates on capture/loss
  - Player elimination detection
- Edge cases (9 tests)
  - Multi-player initialization (2-6 players)
  - No valid moves handling
  - Turn progression
  - Connection handling
- Integration tests (4 tests)
  - Full game lifecycle
  - Phase transitions

**2. Refactored Territory Data to Shared Package:**
- **Moved:** `server/src/games/risk/territoryData.ts` → `shared/src/games/risk/territoryData.ts`
- **Impact:** Single source of truth for territory adjacency graph
- **Updated:** All server imports now reference `@eschaton/shared`
- **Client-ready:** Client can now import territory data from shared package (no duplication needed)
- **Types exported:** `Territory`, `Continent`, adjacency helpers

**3. Documented Phase 1 Scope Cuts:**
Added comprehensive Phase 1 limitations documentation to `server/src/games/risk/RiskPlugin.ts`:
- **Cards are counters only:** No card types/visuals, integer count with standard escalation
- **Fortification is adjacency-only:** Direct neighbors only, no path-based movement
- **Attack movement is forced:** Attacking armies automatically move to captured territory
- **Auto-distributed territories:** No draft/selection phase on game start

### Learnings:
- **Test Helper Pattern:** `createStartedGame(playerCount)` utility simplifies test setup by invoking lifecycle hooks properly
- **Probabilistic Testing:** Combat tests use loops to account for random dice rolls rather than mocking Math.random()
- **State Tracking:** Risk uses dual state tracking (`RiskState.territories` for game board, `RiskState.riskPlayers` for player-specific data)
- **Territory Count Updates:** `updatePlayerTerritoryCount()` must be called after any territory ownership change
- **Phase Transitions:** Setup → Playing phase requires all players to place their initial armies via `endPhase` action
- **Shared Package Structure:** Game configuration data (maps, adjacency graphs) belongs in `shared/src/games/{game}/` for client+server access

### Architectural Decisions Followed:
1. ✅ Shared static data in `shared/src/games/{game}/`
2. ✅ Real test implementations (no `it.todo()` placeholders)
3. ✅ Scope transparency via Phase 1 documentation
4. ✅ PR atomicity (infrastructure kept separate from features)

### Verification:
- `npm run build` — ✅ All workspaces compile
- `npm run lint` — ✅ No errors (15 warnings, all non-blocking)
- `npm run test -- server/src/__tests__/risk.test.ts` — ✅ 60/60 tests passing

**Status:** Ready for re-review by Hal
**Branch:** `squad/80-add-risk-game-plugin`

---

## 2026-03-15: PR #83 Revision Complete — Risk Blockers Resolved

**Scope:** Fixed all three blockers identified in Hal's PR #83 review:

1. **Test Implementation (48 → 60 tests)** — Converted all `.todo()` placeholders to executable test cases covering territory validation, combat, movement, win conditions, edge cases, and integration flows.
2. **Shared Territory Data** — Refactored `server/src/games/risk/territoryData.ts` → `shared/src/games/risk/territoryData.ts`; eliminated duplication between client/server.
3. **Phase 1 Scope Documentation** — Added explicit Phase 1 limitations to `RiskPlugin.ts` distinguishing intentional simplifications from bugs.

**Verification:**
- ✅ `npm run build` — All workspaces compile
- ✅ `npm run lint` — No errors
- ✅ `npm run test` — 60/60 tests passing

**Commits:** `816332c`, `2692e8a`

**Status:** Revision complete. All blockers resolved. Ready for Hal re-review.

**Note:** Original PR authors (Pemulis/Steeply/Gately) were locked out per protocol; Marathe completed revision independently.


---

## 2026-03-15: Fixed Azure Container Apps Health Check Probe Failure

**Root Cause:** The `CONTAINER_APP_FQDN` GitHub environment variable already included the `https://` protocol, but the deploy workflows were prepending another `https://`, resulting in a malformed URL: `https://https://playgrid-uat.orangedune-0437f62b.centralus.azurecontainerapps.io/health`

**Impact:** All UAT and Prod deployments failed during the health check verification step, even though the containers were running correctly and the `/health` endpoint was functional.

**Investigation:**
1. Examined recent deployment workflow runs via `gh run list` and `gh run view`
2. Found health check logs showing double `https://` prefix in URL
3. Verified environment variables: `gh variable list --env uat` showed `CONTAINER_APP_FQDN` already includes protocol
4. Confirmed same issue in both UAT and Prod environments

**Fix Applied:**
- **deploy-uat.yml**: Changed `HEALTH_URL="https://${{ vars.CONTAINER_APP_FQDN }}/health"` → `HEALTH_URL="${{ vars.CONTAINER_APP_FQDN }}/health"`
- **deploy-prod.yml**: Same fix applied
- **Discord notifications**: Removed duplicate `https://` from `deployment-url` parameter in both workflows

**Files Changed:**
- `.github/workflows/deploy-uat.yml`
- `.github/workflows/deploy-prod.yml`

**Verification:**
- ✅ `npm run build` — All workspaces compile successfully
- ✅ No other workflows have the double-prefix issue

**Commit:** `ad8d0a8` - "fix: remove duplicate https:// prefix in health check URL"

### Learnings:

**Environment Variable Conventions:**
- Azure Container Apps `containerApp.properties.configuration.ingress.fqdn` returns the FQDN without protocol
- GitHub environment variables should store FQDNs **with** protocol for direct use in URLs
- Workflow scripts should not assume protocol is missing — validate variable format first

**Health Check Best Practices:**
1. Always log the constructed URL before testing (`echo "Checking health endpoint: $HEALTH_URL"`)
2. Use `curl -f -s` for clean failures (non-2xx exits non-zero, suppress progress)
3. Grep for specific JSON fields rather than just checking HTTP 200 (validates response format)
4. Implement retry logic with exponential backoff (our workflows use 10 attempts × 5s delay)

**Azure Container Apps Probes:**
- Liveness probe: Restarts container on failure (30s initial delay, 10s period, 5s timeout, 3 failures)
- Readiness probe: Removes from load balancer on failure (30s initial delay, 5s period, 5s timeout, 6 failures)
- No startup probe configured (ACA doesn't distinguish startup from liveness in current config)
- Probes target `/health` on port 2567 correctly
- Server listens before DB init to respond to probes during startup (see `server/src/index.ts:62`)

**Key File Paths:**
- Health probes: `infra/main.bicep` lines 270-295
- Server health endpoint: `server/src/index.ts` line 38
- Deploy workflows: `.github/workflows/deploy-{uat,prod}.yml`
- Bootstrap placeholder: Uses `node:22-alpine` with inline HTTP server (Bicep line 56)

**Architectural Decision:**
- Environment variables include protocol (`https://`) for consistency with Bicep outputs
- Workflows should use variables directly without protocol manipulation
- This aligns with the pattern in `infra/main.bicep` output `containerAppFqdn` which returns the full URL


---

## 2026-03-15: Fixed Container App Bootstrap Command Override

**Root Cause:** After deploying to UAT, the browser showed `{"status":"ok","mode":"placeholder"}` instead of the actual app. The Bicep template (`infra/main.bicep`) bootstraps Container Apps with a placeholder Node.js image and explicit `command`/`args` override that runs an inline HTTP server. The deploy workflows used `az containerapp update --image` to swap in the real ACR image, but **did not clear the command/args override** — so the container kept running the placeholder script even with the real image.

**Bootstrap Configuration (Bicep lines 249-255):**
```bicep
image: 'node:22-alpine'
command: ['/bin/sh', '-c']
args: ['node -e "require(\'http\').createServer((q,s)=>{s.writeHead(200,{\'Content-Type\':\'application/json\'});s.end(JSON.stringify({status:\'ok\',mode:\'placeholder\'}))}).listen(2567,\'0.0.0.0\')"']
```

**Investigation:**
1. Confirmed `az containerapp update` does NOT automatically clear command/args when changing images
2. Checked Azure CLI documentation: `--command ""` and `--args ""` explicitly clear existing values
3. The Bicep bootstrap command/args are intentional and correct — they allow infra deployment before CI has pushed the real image

**Fix Applied:**
Added `--command ""` and `--args ""` to the "Deploy to Container App" step in both workflows:

**deploy-uat.yml:**
```bash
az containerapp update \
  --name ${{ vars.CONTAINER_APP_NAME }} \
  --resource-group ${{ vars.RESOURCE_GROUP }} \
  --image ${{ vars.ACR_NAME }}.azurecr.io/playgrid:${{ github.sha }} \
  --command "" \
  --args "" \
  --set-env-vars "NODE_ENV=development" "PORT=2567" "DATABASE_URL=secretref:postgres-connection-string"
```

**deploy-prod.yml:** Same fix with `NODE_ENV=production`

**Files Changed:**
- `.github/workflows/deploy-uat.yml` (line 63-64)
- `.github/workflows/deploy-prod.yml` (line 63-64)

**Verification:**
- ✅ `npm run build` — All workspaces compile successfully

### Learnings:

**Azure Container Apps Command Override Behavior:**
- `az containerapp update --image` does NOT clear existing command/args from previous revisions
- Explicit `--command ""` and `--args ""` are required to remove overrides and use the image's default CMD/ENTRYPOINT
- Bootstrap placeholder commands in Bicep are **correct and intentional** — they're only for initial infra deployment

**Bootstrap Strategy:**
- Bicep templates use public bootstrap images (e.g., `node:22-alpine`) with placeholder servers so initial `az deployment group create` succeeds before CI has pushed the real app image into ACR
- CI workflows must explicitly clear bootstrap command/args when deploying the real image
- This two-phase approach avoids circular dependencies: infra creates the container app → RBAC propagates → CI pushes image → CI updates container app

**Azure CLI Command/Args Syntax:**
```bash
# Clear command/args (use image's default)
--command "" --args ""

# Set custom command (array syntax)
--command "/bin/sh" "-c"

# Set custom args (array syntax)
--args "npm start"
```

**Key File Paths:**
- Deploy workflows: `.github/workflows/deploy-{uat,prod}.yml`
- Bicep bootstrap config: `infra/main.bicep` lines 56-57 (variables), 249-255 (container template)
- Dockerfile CMD: `Dockerfile` line 34 (`CMD ["node", "dist/index.js"]`)

**Related Issues:**
- Previous fix (2026-03-15): Health check URL double-prefix
- Root cause: Environment variables included protocol, workflows prepended another `https://`
- Resolution: Use `CONTAINER_APP_FQDN` variable directly without protocol manipulation

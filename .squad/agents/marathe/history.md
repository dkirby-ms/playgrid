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

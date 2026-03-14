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

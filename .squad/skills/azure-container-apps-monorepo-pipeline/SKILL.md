# Skill: Azure Container Apps Monorepo Pipeline

## Purpose
Use this pattern when a TypeScript monorepo needs GitHub Actions CI/CD and Azure Container Apps deployment with shared package dependencies.

## Applies when
- The repo uses npm workspaces
- A shared package feeds both client and server
- GitHub Actions is the CI/CD system
- Azure Container Apps is the deployment target
- The app includes real-time or WebSocket traffic

## Core pattern
1. Install from the repo root with workspace support.
2. Build in dependency order: `shared -> server -> client`.
3. Keep CI and deploy separate.
4. Use Azure OIDC (`azure/login`) instead of stored Azure credentials.
5. Deploy through environment-specific workflows or a reusable deploy workflow.
6. Use GitHub Environments for approvals and scoped secrets.
7. Keep WebSocket game servers at one replica until distributed presence/state exists.

## Recommended workflows
- `ci.yml` — lint, test, build, optional Docker smoke build
- `deploy-dev.yml` — automatic dev deploy
- `deploy-staging.yml` — staging/UAT deploy + verification
- `deploy-prod.yml` — protected production deploy
- `e2e.yml` — post-deploy browser/API checks with artifact upload
- `infra-validate.yml` — validate Bicep/Terraform changes
- `promote.yml` — optional PR-based environment promotion

## Implementation checklist
- [ ] Root `package.json` is the source of truth for workspace build order
- [ ] Dockerfile copies workspace manifests before source for cache stability
- [ ] Docker image only contains artifacts the runtime actually serves
- [ ] `actions/setup-node` enables npm cache
- [ ] Docker builds use BuildKit cache (`cache-to/cache-from type=gha`)
- [ ] GitHub Environments exist for `dev`, `staging`, `prod`
- [ ] Workflow permissions are minimal
- [ ] Secrets come from environment-scoped secrets, managed identity, or Key Vault where possible
- [ ] Test and deploy failures upload actionable artifacts/logs
- [ ] Deployment concurrency prevents overlapping releases per environment

## WebSocket / Colyseus note
For Azure Container Apps, sticky sessions help reconnect behavior but do not make a room-based multiplayer server horizontally safe on their own. Until presence, matchmaking, and room state are externalized, keep the server at one replica in all environments.

## PlayGrid-specific note
PlayGrid currently has a workspace layout of `client/`, `server/`, and `shared/`, and the server listens on WebSocket port `2567`. Do not copy a full-stack Dockerfile that includes `client/dist` unless the runtime is updated to serve those static files.

## Reference files
- `package.json`
- `server/src/index.ts`
- `.squad/decisions.md`
- Reference repo: `dkirby-ms/primal-grid`
  - `.github/workflows/deploy.yml`
  - `.github/workflows/deploy-uat.yml`
  - `.github/workflows/squad-ci.yml`
  - `infra/main.bicep`
  - `Dockerfile`

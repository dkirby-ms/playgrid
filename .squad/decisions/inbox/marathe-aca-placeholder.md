# ACA bootstrap placeholder image

## Context
`infra/main.bicep` was creating the Azure Container Registry and the Azure Container App in the same deployment. On a first-time environment bootstrap, the Container App tried to pull `playgrid:latest` from the new ACR before any CI run had pushed an image, so the infrastructure deployment failed.

## Decision
Keep the infrastructure deployment independent from image availability. The Bicep template now seeds the Container App with a public `node:22-alpine` bootstrap image and a shell command that:
1. starts the real app when `/app/public/server/dist/src/index.js` exists, or
2. serves a tiny HTTP placeholder with `/health` on port `2567` when no app image has been pushed yet.

The real PlayGrid image remains the responsibility of CI/CD. `deploy-dev.yml` already builds in ACR and runs `az containerapp update --image ${{ vars.ACR_NAME }}.azurecr.io/playgrid:${{ github.sha }}` after the push, so the placeholder is only for first deploy bootstrap.

## Rationale
- Prevents first-time ACA provisioning from failing against an empty ACR.
- Keeps probes and ingress aligned with the real runtime contract (`/health`, port `2567`).
- Preserves the existing deploy workflow shape instead of adding extra bootstrap-only pipeline steps.

## Impact
- Infra deploys can succeed before the first app image exists.
- Subsequent CI deploys replace the placeholder with the real application image without extra manual intervention.

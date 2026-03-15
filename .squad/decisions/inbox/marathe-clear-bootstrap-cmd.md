# Decision: Clear Bootstrap Command/Args on Container App Deploy

**Date:** 2026-03-15  
**Author:** Marathe (DevOps/CI-CD)  
**Status:** Implemented

## Context

The Bicep template (`infra/main.bicep`) bootstraps Container Apps with a placeholder Node.js image and an inline HTTP server command override. This allows the initial infrastructure deployment to succeed before CI has pushed the real application image to ACR.

However, `az containerapp update --image` does NOT automatically clear command/args overrides from previous revisions. After deploying the real image, containers continued running the bootstrap placeholder script instead of the application's actual entrypoint.

## Decision

**Deploy workflows MUST explicitly clear command/args overrides when updating the container image.**

### Implementation

Add `--command ""` and `--args ""` to the `az containerapp update` step in all deployment workflows:

```bash
az containerapp update \
  --name ${{ vars.CONTAINER_APP_NAME }} \
  --resource-group ${{ vars.RESOURCE_GROUP }} \
  --image ${{ vars.ACR_NAME }}.azurecr.io/playgrid:${{ github.sha }} \
  --command "" \
  --args "" \
  --set-env-vars ...
```

### Rationale

1. **Bootstrap placeholder is intentional** — Bicep needs a working container to create the initial infrastructure before CI has built/pushed the real image
2. **Azure CLI behavior** — `az containerapp update` inherits command/args from previous revisions unless explicitly cleared
3. **Empty string syntax** — Per Azure CLI docs, `--command ""` and `--args ""` clear existing values and use the image's default CMD/ENTRYPOINT

## Alternatives Considered

1. **Remove bootstrap command from Bicep** — Rejected: Would require pre-building and pushing image before infra deployment, creating circular dependency
2. **Use `az containerapp revision copy`** — Rejected: More complex than simple `--command ""` / `--args ""`
3. **YAML template approach** — Rejected: Overkill for simple command clearing

## Consequences

- ✅ Containers run the correct application entrypoint after deployment
- ✅ Bootstrap strategy remains unchanged (two-phase: infra → CI)
- ✅ Simple, explicit fix without architectural changes
- ⚠️ Team must remember to include `--command ""` / `--args ""` in any new deploy workflows

## Files Affected

- `.github/workflows/deploy-uat.yml`
- `.github/workflows/deploy-prod.yml`

## Related

- Bootstrap config: `infra/main.bicep` lines 56-57, 249-255
- Dockerfile CMD: `Dockerfile` line 34

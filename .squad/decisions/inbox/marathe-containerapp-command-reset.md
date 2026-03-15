# Marathe Decision — Clear ACA Bootstrap Command Overrides via Generic Resource Update

**Status:** Implemented  
**Date:** 2026-03-15  
**Requested by:** dkirby-ms

## Decision
Deploy workflows must not rely on `az containerapp update --command "" --args ""` to restore the image default startup command. After updating the image/env vars, the workflow must explicitly remove the bootstrap override with:

```bash
az resource update \
  --ids "$CONTAINER_APP_ID" \
  --remove properties.template.containers[0].command \
  --remove properties.template.containers[0].args
```

## Rationale
- GitHub Actions UAT run `23118352923` succeeded but the returned revision JSON still contained `command: [""]` and `args: [""]`, which kept the placeholder/bootstrap behavior active instead of reverting to the Dockerfile CMD.
- Azure CLI help says empty strings clear existing values, but real ACA behavior here did not match that contract.
- Removing the properties from the Container App template restores the runtime default from `Dockerfile` (`CMD ["node", "server/dist/src/index.js"]`).

## Impact
- `.github/workflows/deploy-uat.yml` and `.github/workflows/deploy-prod.yml` must perform a second Azure update to remove the override after image deployment.
- Deploy workflows should verify that `properties.template.containers[0].command` and `.args` are `null` before proceeding.
- `infra/main.bicep` keeps the placeholder bootstrap logic for first deploys; CI/CD is responsible for removing it during real app deploys.

## Key Paths
- `.github/workflows/deploy-uat.yml`
- `.github/workflows/deploy-prod.yml`
- `infra/main.bicep`
- `Dockerfile`

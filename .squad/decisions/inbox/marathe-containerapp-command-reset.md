# Marathe Decision — Clear ACA Bootstrap Command Overrides via Generic Resource Update

**Status:** Implemented  
**Date:** 2026-03-15  
**Requested by:** dkirby-ms

## Decision
Deploy workflows must not rely on `az containerapp update --command "" --args ""` to restore the image default startup command. The reliable production fix is to deploy the real image while explicitly setting the same startup command as the Dockerfile:

```bash
az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/playgrid:$GITHUB_SHA" \
  --command "node" --args "server/dist/src/index.js"
```

## Rationale
- GitHub Actions UAT run `23118352923` succeeded but the returned revision JSON still contained `command: [""]` and `args: [""]`, which kept the placeholder/bootstrap behavior active instead of reverting to the Dockerfile CMD.
- Azure CLI help says empty strings clear existing values, but real ACA behavior here did not match that contract.
- A follow-up workflow attempt using `az resource update --remove properties.template.containers[0].command/args` was not dependable enough for deployment verification, while explicitly passing the Dockerfile CMD is simple, deterministic, and matches the container's intended runtime.

## Impact
- `.github/workflows/deploy-uat.yml` and `.github/workflows/deploy-prod.yml` should set `--command "node" --args "server/dist/src/index.js"` during image deploys.
- `infra/main.bicep` keeps the placeholder bootstrap logic for first deploys; CI/CD is responsible for overriding it with the real server command during app deploys.
- Future ACA deploy debugging should treat empty-string clear semantics as untrusted until Azure proves otherwise.

## Key Paths
- `.github/workflows/deploy-uat.yml`
- `.github/workflows/deploy-prod.yml`
- `infra/main.bicep`
- `Dockerfile`

# Marathe: Fix shared CAE dependency + required PostgreSQL password

**Date:** 2026-03-15  
**Status:** Proposed

## Decision
Keep the shared UAT/prod Container Apps Environment architecture in `infra/main.bicep`, but make the `Microsoft.App/containerApps` resource explicitly depend on the conditionally created `Microsoft.App/managedEnvironments` resource whenever `containerAppEnvResourceId` is empty.

Also require the PostgreSQL administrator password at deployment time by reading `POSTGRES_ADMIN_PASSWORD` without an empty default in `infra/main.bicepparam`.

## Rationale
- The existing template computed the CAE resource ID as a string, which did not create an ARM dependency edge.
- On first deploys of the shared CAE path, Azure could attempt the container app before the managed environment existed, producing `ManagedEnvironmentNotFound`.
- Allowing an empty fallback for `postgresAdminPassword` made manual deployments fail late with `MissingRequiredParameter` instead of failing fast at invocation time.

## Impact
- First-time deployments can create `playgrid-shared-cae` and the dependent container app in one run.
- Cross-resource-group reuse still works via `containerAppEnvResourceId`.
- Manual deploys must provide `POSTGRES_ADMIN_PASSWORD`, avoiding accidental empty password submissions.

## Files
- `infra/main.bicep`
- `infra/main.bicepparam`

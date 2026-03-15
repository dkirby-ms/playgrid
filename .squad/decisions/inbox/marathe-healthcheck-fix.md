# Decision: Environment Variables Include Protocol Prefix

**Date:** 2026-03-15  
**Decider:** Marathe (DevOps/CI-CD)  
**Status:** Implemented

## Context

The Azure Container Apps deployment workflows (`deploy-uat.yml`, `deploy-prod.yml`) were failing health checks with a malformed URL containing a double `https://` prefix.

Investigation revealed that the `CONTAINER_APP_FQDN` GitHub environment variable already includes the `https://` protocol (e.g., `https://playgrid-uat.orangedune-0437f62b.centralus.azurecontainerapps.io`), but the workflows were prepending another `https://`.

## Decision

**GitHub environment variables for URLs MUST include the protocol prefix (`https://`).**

Workflows and scripts should use these variables directly without adding or removing protocol prefixes.

## Rationale

1. **Consistency with Infrastructure Outputs:** The Bicep template outputs `containerAppFqdn` as a complete URL including protocol
2. **Reduced Error Surface:** No protocol manipulation required in workflows — use variables as-is
3. **Direct Usability:** Variables can be used directly in Discord notifications, logs, and health checks without transformation
4. **Fail-Safe:** If a variable doesn't include protocol, it's immediately obvious (broken link) rather than silently malformed

## Implementation

### Fixed Files:
- `.github/workflows/deploy-uat.yml`
- `.github/workflows/deploy-prod.yml`

### Pattern:
```yaml
# ✅ CORRECT: Use variable directly
HEALTH_URL="${{ vars.CONTAINER_APP_FQDN }}/health"

# ❌ WRONG: Do not prepend protocol
HEALTH_URL="https://${{ vars.CONTAINER_APP_FQDN }}/health"
```

### Environment Variables:
- `CONTAINER_APP_FQDN` — Full URL with protocol (e.g., `https://playgrid-uat.orangedune-0437f62b.centralus.azurecontainerapps.io`)
- `KEY_VAULT_URI` — Full URI with protocol (e.g., `https://playgriduatkv.vault.azure.net/`)

## Consequences

### Positive:
- Health checks now construct valid URLs
- Deployments no longer fail at verification step
- Consistent URL handling across all workflows
- Discord notifications show clickable URLs correctly

### Negative:
- None identified

## Verification

- ✅ `npm run build` passes
- ✅ No other workflows have double-prefix pattern
- ✅ Both UAT and Prod workflows fixed

## Related Files

- `infra/main.bicep` (line 344: `containerAppFqdn` output)
- `.github/workflows/deploy-uat.yml`
- `.github/workflows/deploy-prod.yml`
- `.squad/agents/marathe/history.md`

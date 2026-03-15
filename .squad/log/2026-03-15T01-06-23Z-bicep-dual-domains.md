# Session: Bicep Dual Custom Domains

**Timestamp:** 2026-03-15T01-06-23Z  
**Agent:** Marathe (DevOps)  
**Status:** Completed  

## What Happened
Bicep infrastructure updated to support environment-specific custom domains for Container Apps. `customDomainUat` and `customDomainProd` parameters replace single `customDomain`. Selection logic in `main.bicep` uses `environmentName` to emit correct domain based on environment.

## Decisions Made
- ✅ Dual domain parameters for UAT/Prod separation
- ✅ Environment-aware selection in Bicep
- ✅ Backward compatibility preserved

## Files
- `infra/main.bicep`
- `infra/main.bicepparam`

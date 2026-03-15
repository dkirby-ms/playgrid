# Session Log: Healthcheck Fix

**Date:** 2026-03-15T19:36:12Z  
**Agent:** Marathe (DevOps/CI-CD)  
**Topic:** Azure Container Apps health check probe failure  

## Summary

Fixed malformed health check URL in ACA deployment workflows caused by duplicate `https://` protocol prefix.

**Root Cause:** `CONTAINER_APP_FQDN` environment variable already includes `https://`, but workflows prepended it again.

**Solution:** Use environment variables directly without protocol manipulation.

## Files Changed

- `.github/workflows/deploy-uat.yml` (commit ad8d0a8)
- `.github/workflows/deploy-prod.yml` (commit d5ccb85)

## Decision

Environment variables for URLs MUST include protocol prefix and be used as-is.

See `.squad/decisions.md` for full decision record.

## Impact

Health check probes will now use valid URLs. Container Apps deployments will no longer fail at verification step.

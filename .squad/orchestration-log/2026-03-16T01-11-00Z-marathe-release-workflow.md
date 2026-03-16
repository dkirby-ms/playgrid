# Marathe: Release Workflow Implementation

**Spawned:** 2026-03-16 (background, sonnet)  
**Duration:** CI/CD phase  
**Output:**
- GitHub Release publishing integrated into deploy-prod.yml
- Conditional release creation on v* tag pushes
- Auto-generated release notes via gh CLI

**Implementation Details:**
- Permissions updated: contents: read → contents: write
- Release step added post-health-check, pre-Discord-notification
- Uses gh release create with --generate-notes and --latest flags
- Skips release creation on manual workflow_dispatch runs

**Rationale:**
- Releases only created for successfully deployed versions
- Atomic operation: deploy → verify → release → notify
- Avoids orphaned releases from failed deployments

**Related Files:**
- .github/workflows/deploy-prod.yml

**Status:** ✅ Completed

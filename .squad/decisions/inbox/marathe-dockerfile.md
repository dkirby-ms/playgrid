# Marathe: Docker runtime workspace layout

**Date:** 2026-03-14
**Status:** Proposed

Use a two-stage Node 22 Alpine Docker build where the runtime stage installs production dependencies only for the `server` and `shared` workspaces, then places the built client bundle under `server/client/dist` via a symlink to `client/dist`.

**Rationale:**
- Keeps the runtime image smaller by excluding client build-time dependencies.
- Matches the current Express static path in `server/src/index.ts`, which resolves `client/dist` relative to the server root.
- Avoids duplicating the built client assets in multiple runtime directories.

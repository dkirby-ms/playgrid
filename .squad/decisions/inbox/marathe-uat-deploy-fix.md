# Marathe: UAT deploy fix

**Date:** 2026-03-15  
**Status:** Proposed

Standardize the shared workspace package on `@eschaton/shared` and treat built-server runtime resolution as a release gate.

## Decision
- Use `@eschaton/shared` as the single internal package name across client, server, docs, and runtime images.
- Ensure runtime entrypoints resolve compiled JavaScript (`dist/src/index.js`) rather than source-only TypeScript paths.
- Keep Node ESM imports in server runtime code fully qualified with `.js` extensions.

## Rationale
The recurring Azure Container Apps "Operation expired" failure was caused by the container crashing during startup before health probes could ever succeed. The built server tried to import `@eschaton/shared`, but the workspace package was still named `@eschaton/playgrid-shared`, and one runtime import from `LobbyRoom.ts` compiled to an extensionless ESM path that Node could not resolve.

## Impact
- UAT/prod container revisions should now boot cleanly instead of crash-looping during provisioning.
- `npm run start -w server` matches the built artifact layout.
- Future workspace/package changes must preserve runtime module resolution, not just TypeScript compile-time aliases.

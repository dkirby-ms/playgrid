# Gately: Local lobby thumbnails from design prototype

**Date:** 2026-03-15
**Status:** Proposed

## Decision
Use locally served thumbnail files in `client/public/game-thumbnails/` for lobby game tiles, sourced from the original design prototype artwork, instead of inline SVG art or runtime-hotlinked remote image URLs.

## Context
The shipped lobby tiles were using hand-authored SVG illustrations in `client/src/ui/LobbyScreen.ts`. The design prototype archive (`docs/designs/project.zip`) contained the intended photographic tile artwork references, but not bundled image binaries.

## Rationale
- Keeps the lobby visually aligned with the approved design direction.
- Avoids runtime dependency on third-party image hosts.
- Fits the existing Vite public asset path cleanly with no new asset-loading framework.
- Works naturally with the existing 4:3 tile layout by pairing local files with `object-fit: cover`.

## Impact
- `LobbyScreen.ts` maps game types to stable local asset paths.
- `client/index.html` remains responsible for thumbnail crop behavior and overlay readability.
- Future tile artwork swaps only need asset replacement and path updates, not new rendering logic.

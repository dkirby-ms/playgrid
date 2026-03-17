# Decision: SVG file-based Risk map rendering

**Author:** Gately  
**Date:** 2026-03-17  
**Status:** Proposed  

## Context

The Risk board was rendering territories as "red and blue blobs" despite having SVG path data. The root cause was hand-coded path strings in `classicRiskMap.ts` — approximated shapes that didn't look like real geography.

## Decision

Redesign map rendering to use an actual SVG file (`risk-map.svg`) as the source of truth for territory geometry, imported at build time via Vite's `?raw` import.

### Architecture: Build-time SVG import (Option C)

```
risk-map.svg → Vite ?raw import → svgMapLoader.ts (DOMParser) → RiskMapDefinition → drawSvgPath() → PixiJS
```

- **SVG file** (`risk-map.svg`): Contains 42 `<path>` elements with territory IDs, geographic shapes, and label position metadata.
- **Loader** (`svgMapLoader.ts`): Parses SVG string, extracts path `d` attributes and data attributes, merges with adjacency data from `shared/territoryData.ts`.
- **Map module** (`classicRiskMap.ts`): Imports SVG raw and calls loader. 18 lines instead of 440.
- **Renderer** (`RiskRenderer.ts`): Zero changes. Consumes `RiskMapDefinition` interface as before.

### Why this approach

1. SVG file is the single source of truth for geography — editable in any SVG editor (Inkscape, Figma, etc.)
2. Build-time import means no async loading, no runtime fetch, no loading states
3. Existing PixiJS rendering pipeline (`drawSvgPath`) works unchanged
4. All interactivity preserved: hover, click, selection, army badges, attack animations

### Impact

- Future map improvements = edit the SVG file, no code changes needed
- Supports potential alternate Risk maps (just create new SVG + call `loadMapFromSvg()`)
- SVG adds ~52KB to client bundle (inlined as string), gzips well

### Files

- Added: `client/src/renderers/risk/risk-map.svg`, `client/src/renderers/risk/svgMapLoader.ts`
- Modified: `client/src/renderers/risk/classicRiskMap.ts`, `client/src/renderers/risk/index.ts`

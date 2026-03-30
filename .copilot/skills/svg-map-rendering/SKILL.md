# Skill: SVG-based Map Rendering in PixiJS

**Owner:** Gately  
**Category:** Client Rendering  
**Updated:** 2026-03-17

## Overview

Pattern for rendering geographic/territory maps in PixiJS using SVG files as the source of truth for geometry.

## When to Use

Use this pattern when:
- Rendering a map with distinct interactive regions (territories, zones, areas)
- Geographic accuracy matters (coastlines, borders)
- You want designers to edit geometry in SVG tools (Inkscape, Figma) without touching code
- Supporting multiple map variants (e.g., different Risk board layouts)

## Architecture

```
SVG file (geometry source of truth)
  → Vite ?raw import (build-time string)
  → svgMapLoader.ts (DOMParser extraction)
  → MapDefinition object (paths + metadata)
  → drawSvgPath() → PixiJS Graphics
```

### SVG File Requirements

Each interactive region is a `<path>` element with:
- `id` — matches game state key
- `d` — SVG path data (M, L, C, Q, Z commands)
- `data-name` — display name
- `data-continent` — grouping/category ID
- `data-label-x`, `data-label-y` — label anchor position

Group paths in `<g>` elements by category with `data-name` attribute.

### Import Pattern (Vite)

```typescript
import mapSvg from "./map.svg?raw";  // string at build time
import { loadMapFromSvg } from "./svgMapLoader";

export const MAP_DEF = loadMapFromSvg(mapSvg, "Classic", 1);
```

Vite's `?raw` suffix imports any file as a string. No extra config needed.

### Loader Pattern

```typescript
function loadMapFromSvg(svgString: string, name: string, version: number): MapDefinition {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const paths = doc.querySelectorAll("path[id]");
  // Extract id, d, data-* attributes from each path
  // Merge with game-state metadata (adjacency, etc.) from shared module
  return { name, version, viewBoxWidth, viewBoxHeight, regions, ... };
}
```

### Path Generation (Catmull-Rom smoothing)

Define territory outlines as arrays of (x,y) points, convert to smooth cubic bezier SVG paths:

```python
# For each point, compute Catmull-Rom control points → cubic bezier
alpha = 0.30  # smoothing tension
cp1 = point + (next - prev) * alpha
cp2 = next - (next_next - point) * alpha
# Output: C cp1x cp1y cp2x cp2y nextX nextY
```

## Key Files (Risk implementation)

- `client/src/renderers/risk/risk-map.svg` — SVG geometry
- `client/src/renderers/risk/svgMapLoader.ts` — SVG → MapDefinition parser
- `client/src/renderers/risk/svgPathParser.ts` — SVG path → PixiJS Graphics
- `client/src/renderers/risk/classicRiskMap.ts` — Module entry point
- `client/src/renderers/risk/RiskMapDefinition.ts` — TypeScript interfaces

## Gotchas

- DOMParser is browser-only; tests running in Node need jsdom or equivalent
- SVG path `d` must not contain fill/stroke (styling done in PixiJS)
- Shared borders between territories must use identical coordinate points
- Vite `?raw` requires TypeScript to have `/// <reference types="vite/client" />` in env.d.ts

### Gately: Use Real Design SVG via Loader Normalization

**Status:** Proposed  
**Date:** 2026-03-17  

Use the Inkscape design asset (`docs/designs/risk.svg`) as the source of truth for Risk map geometry, with `svgMapLoader.ts` as the normalization boundary between design-time SVG conventions and game-state conventions.

**Rationale:**
- The design SVG (500KB) contains geographically accurate paths for all 42 territories — far superior to any procedurally generated geometry
- Design tools (Inkscape) use underscores in IDs; game state uses hyphens. The loader normalizes at parse time rather than requiring designers to match game conventions
- A typo correction map (`yakursk` → `yakutsk`) keeps the design file unchanged while ensuring correct territory matching
- Label positions are computed from path bounding box centroids when explicit attributes are absent, removing a dependency on manual annotation
- ViewBox falls back to width/height attributes, supporting Inkscape's default SVG output format

**Impact:**
- `svgMapLoader.ts` is the single normalization point — future design SVGs with different conventions only need loader updates
- Connection override waypoints now scale with actual viewBox dimensions
- Continent display names derive from shared data or ID formatting when SVG lacks `<g>` annotations

**Files Modified:**
- `client/src/renderers/risk/risk-map.svg` (replaced with `docs/designs/risk.svg`)
- `client/src/renderers/risk/svgMapLoader.ts` (ID normalization, centroid computation, viewBox fallback)

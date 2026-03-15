# Mario: Checkers UX review priorities

**Status:** Proposed  
**Date:** 2026-03-15  
**Author:** Mario (UX Consultant)

## Decision

Prioritize clarity fixes over further visual polish in Checkers. The next UX pass should first eliminate HUD overlap, strengthen move affordances, and introduce responsive HUD compaction before adding more decorative rendering treatment.

## Why

1. The shared HUD and the Leave Game button currently compete for the same top-right space, which breaks the intended “one panel, one mental model” direction.
2. Move feedback relies on a small green dot and cursor change; it works, but it asks players to inspect the board instead of instantly reading it.
3. Fixed top/bottom board reservations make narrow screens feel underused because the board is pushed down even when vertical room is available.
4. The new gradient pieces are attractive, but the `♛` king marker is still typography-dependent and less robust than a shape-led indicator.

## Implementation direction

- Keep the shared HTML HUD for status/player copy, but guarantee a no-overlap layout with the Leave Game button.
- Upgrade move feedback to a two-layer system: persistent selected state + larger destination affordance + hover preview on actionable squares.
- On narrow viewports, compact or relocate HUD chrome so the board can sit closer to the top safe area.
- Prefer a shape-based king marker (double ring or vector crown badge) over the current text glyph.

## Concrete specs for Gately

- **HUD spacing:** 16px outer margin, 12px gap between status panel and secondary controls; never place two actionable surfaces at the same absolute corner.
- **Responsive breakpoint:** at `max-width: 768px`, collapse the status panel to a single-column compact card or top strip and reduce reserved top board space to ~64px.
- **Move target indicator:** destination ring diameter `0.42 * squareSize`, stroke `max(3px, 0.06 * squareSize)`, fill alpha `0.18`; keep a smaller center dot only for captures if needed.
- **Hover affordance:** on actionable squares, add a `2px` inset stroke or `0.08 * squareSize` soft glow in `#8FC6FF` at `0.35` alpha.
- **King marker:** replace `♛` with either a double gold ring (`#F4C542`, 2px stroke) or a compact crown badge sized to `0.3 * squareSize`.

## Files reviewed

- `client/src/renderers/CheckersRenderer.ts`
- `client/src/ui/HUD.ts`
- `client/index.html`

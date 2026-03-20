### Gately: Board Coordinate Label Positioning in Frame Band

**Status:** Implemented
**Date:** 2026-03-20
**Issue:** #165

Place algebraic coordinate labels (A–H, 8–1) inside the board frame band using PIXI.Text objects in a non-interactive container, rather than drawing them on the squares or outside the frame.

**Rationale:**
- The 24px board frame provides a natural gutter for labels without consuming board real estate or competing with pieces
- A dedicated `coordLabelsContainer` between the frame and board layers keeps labels visually prominent but interaction-free (eventMode "none")
- Labels use `this.isFlipped` to reverse text when the board perspective flips for red, maintaining algebraic consistency from the viewer's perspective
- Font size scales with board dimensions (clamped 10–14px) so labels remain readable at all viewport sizes
- Used stone-400 (`0xa8a29e`) as a muted label color matching the Figma design spec

**Impact:**
- Reusable pattern for any game needing board coordinate annotations (e.g., Chess)
- No changes to drag/drop, piece rendering, or hit detection
- Build, lint, tests all pass

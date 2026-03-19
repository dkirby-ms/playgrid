### Gately: Proxy-Based Drag Pattern for Game Renderers

**Status:** Implemented
**Date:** 2026-03-19
**PR:** #160 (Issue #149)

Use a proxy-based drag system (`DragHelper`) rather than registering individual display objects as draggable. The helper receives a pre-drawn `Graphics` proxy from the renderer and manages pointer tracking, while game-specific validation stays in renderer callbacks.

**Rationale:**
- Both Checkers and Dominos renderers batch-draw pieces into shared Graphics objects (piecesLayer / handLayer) — individual piece containers don't exist as addressable display objects
- Proxy approach is non-invasive: no changes to the existing rendering pipeline, piece drawing, or state management
- 6px distance threshold cleanly separates click vs. drag, preserving the existing click-to-move UX
- Pattern extends naturally to future games (Backgammon bearing-off, Risk army placement)

**Impact:**
- Checkers and Dominos both support drag-and-drop with click fallback
- Reusable across any future game renderer
- No regression to existing click interactions

**Files:**
- `client/src/renderers/DragHelper.ts` (new utility)
- `client/src/renderers/DragHelper.test.ts` (new tests)
- `client/src/renderers/CheckersRenderer.ts` (integrated)
- `client/src/renderers/DominosRenderer.ts` (integrated)

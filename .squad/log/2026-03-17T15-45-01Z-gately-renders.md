# Session Log: 2026-03-17T15-45-01Z

**Agents Run:** Gately (Game Dev) — 2 tasks  
**Status:** ✅ Complete  

## Summary

Gately completed two rendering quality improvements:

1. **Backgammon Dice UX** — Replaced sidebar button with stable PixiJS canvas interaction. Dice always visible, greyed at 28% when unrolled, full opacity when rolled. Fixes double-click race condition in DOM rebuilds.

2. **Risk Territory Paths** — All 42 territories now smoothed cubic Bézier curves (Catmull-Rom, tension 0.33). Geographically recognizable outlines across standard viewBox. Future maps can reuse point-list → Bézier pattern.

**Validation:** Build, lint, 294 tests all pass.  
**Branch:** Both committed to `origin/dev`.

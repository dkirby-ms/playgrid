# Decision: Shared game status lives in the HTML HUD overlay

**Date:** 2026-03-15  
**Author:** Gately (Game Dev / Frontend / Rendering)  
**Status:** Implemented

## Context

Checkers was showing turn state in two different places: the shared HUD overlay owned the generic waiting/timer widgets, while the renderer also painted its own in-canvas status copy. That split made the status treatment feel temporary and would force every new game to reinvent the same player/turn/timer panel.

## Decision

Use the shared `client/src/ui/HUD.ts` overlay as the reusable game status panel, and let renderers opt into custom copy through an optional `getHUDStatus()` method on the `GameRenderer` contract.

## Why

1. **One panel, one mental model** — player list, current turn, timer, and status text now live together instead of being split between overlay chrome and canvas text.
2. **Renderer ownership stays clean** — renderers still own board-specific HUD elements, but game-state copy can be handed off to a shared panel without `GameScene` learning game rules.
3. **Future games get a low-friction hook** — Backgammon, Risk, or later games can adopt the same panel by implementing one optional status method instead of duplicating layout work.

## Consequences

- ✅ Checkers status copy moved out of the Pixi canvas and into the shared HUD panel
- ✅ `GameScene` can pass renderer-provided status metadata into the HUD without hardcoding per-game branches
- ✅ Future renderer work has a clear split between shared overlay status and board-local counters/buttons

## Files Affected

- `client/src/ui/HUD.ts`
- `client/src/scenes/GameScene.ts`
- `client/src/renderers/GameRenderer.ts`
- `client/src/renderers/CheckersRenderer.ts`

# Skill: Shared Game Status Panel

**Owner:** Gately  
**Category:** Client Rendering / HUD  
**Updated:** 2026-03-15

## Overview

Reusable pattern for surfacing game status in the shared HTML HUD overlay instead of painting temporary turn/timer text directly into each Pixi renderer.

## When to Use

Use this pattern when a game needs any mix of:
- current turn messaging
- waiting / spectating / game-over status copy
- turn countdown display
- player roster with active-turn highlighting

## Pattern

### 1. Keep the shared panel in `HUD.ts`

The overlay should own the reusable shell:
- status label / headline / detail copy
- turn timer
- player roster
- generic layout and styling

Board-local renderers should only keep canvas HUD elements that are specific to the board itself (piece counts, borne-off counts, phase buttons, territory counters, etc.).

### 2. Expose per-game copy through `getHUDStatus()`

Add an optional renderer hook through the shared contract:

```typescript
interface GameRendererHUDStatus {
  label?: string;
  text: string;
  detail?: string;
  accentColor?: string;
}

interface GameRenderer {
  getHUDStatus?(state: unknown): GameRendererHUDStatus | null;
}
```

`GameScene` can forward that data into the HUD without learning game-specific rules.

### 3. Keep generic HUD data in `GameScene`

`GameScene` should continue extracting and passing:
- `players`
- `currentTurn`
- `turnTimeRemaining`
- `showTimer`
- optional renderer-provided `status`

That preserves one integration point for all games.

## Checkers Reference

Checkers is the first adopter:
- `client/src/renderers/CheckersRenderer.ts` implements `getHUDStatus()`
- `client/src/ui/HUD.ts` renders the shared panel card
- `client/src/scenes/GameScene.ts` forwards renderer status into HUD options

## Adoption Checklist for a New Game

1. Decide which copy belongs in the shared panel versus on-canvas HUD
2. Implement `getHUDStatus()` in the renderer for game-specific text/details
3. Leave `GameScene` unchanged unless the game needs new generic HUD data
4. Verify the board layout still has enough reserved top space for the overlay card
5. Run `npm run build && npm run test`

## Anti-Patterns

- ❌ Duplicating the same turn/timer copy in both the canvas renderer and the shared HUD
- ❌ Adding per-game `if (gameType === ...)` branches inside `HUD.ts`
- ❌ Moving board-specific counters into the shared overlay when they only matter for one game

## References

- `client/src/ui/HUD.ts`
- `client/src/scenes/GameScene.ts`
- `client/src/renderers/GameRenderer.ts`
- `client/src/renderers/CheckersRenderer.ts`

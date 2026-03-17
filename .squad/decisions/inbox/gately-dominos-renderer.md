# Decision: Dominos Renderer Interaction Pattern

**Author:** Gately (Game Dev)
**Date:** 2025-07-24
**Scope:** client/src/renderers/DominosRenderer.ts

## Decision

For the Dominos renderer, tile placement uses a **select-then-route** interaction:

1. Click a tile in hand → if it only fits one end, auto-send the play action immediately.
2. If the tile fits both open ends (and they differ), show A/B end-choice markers on the board for the player to pick.
3. If the board is empty (first play), auto-send to end "a" with no choice needed.

Draw and Pass are available via both the boneyard click area (top-right on canvas) and sidebar buttons.

## Rationale

This keeps the common case (one valid end) fast — single click to play — while still giving the player explicit control when both ends are valid. Matches the mental model of physical dominos where you pick a tile then place it at an end.

## Impact

- Frontend only — no server changes needed.
- Other renderers are not affected.
- If the server adds more complex placement rules (e.g., Mexican Train branching), the end-choice system can be extended with more markers.

# Gately Decision Inbox — Checkers turn indicator

**Date:** 2026-03-16  
**Status:** Proposed

## Decision

Keep urgent turn feedback for Checkers inside the shared sidebar instead of rendering a separate board overlay banner.

## Rationale

- The board should stay visually clear while players are choosing moves.
- The existing `Game Info` panel already owns turn context, so emphasis belongs there.
- A highlighted sidebar row with subtle animation is noticeable without blocking pieces or targets.

## Implementation Notes

- Removed the Pixi banner layer and its view-model helper files.
- Added opt-in highlighted sidebar row/value styles in `client/src/ui/GameSidebar.ts`.
- `client/src/renderers/CheckersRenderer.ts` now renders `Your Turn` with token-driven accent colors and a soft pulse only when the local player is active.

# Gately: Dominos End-Position and Ghost Preview Pattern

**Status:** Proposed
**Date:** 2026-03-16
**PR:** #158

## Decision

End-position markers and placement previews in dominos (and any future tile/card game) must use scale-aware offsets derived from layout constants (`BOARD_TILE_GAP * scale`), never fixed pixel values. Ghost tile previews should render at the exact computed placement position using the same coordinate system as the board layout.

## Rationale

- Fixed-pixel offsets (the previous `± 8px`) diverge from actual tile placement at any scale other than exactly 1.0, and even at scale=1 they're wrong (gap is 4px, not 8px). This causes the "tiles placed in wrong position" perception.
- Storing layout state (scale, spinner center, arm end edges) as instance variables lets ghost preview and marker logic reuse the same coordinate math without re-deriving the entire layout.
- The ghost tile preview (alpha 0.4) gives players immediate visual feedback on where a tile will land and how it will be oriented, replacing the ambiguous directional markers.

## Impact

- Pattern applies to any future renderer that shows placement previews or position indicators on a scaled board.
- Ghost tiles are drawn in a dedicated `ghostLayer` between the board and markers in z-order, keeping render responsibilities separated.

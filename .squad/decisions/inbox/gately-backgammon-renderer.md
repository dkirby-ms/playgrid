# Decision: Backgammon Renderer Implementation Pattern

**Date:** 2026-03-14  
**Author:** Gately (Game Dev)  
**Context:** Issue #45 — Backgammon renderer (client)

## Decision

Established the pattern for rendering complex board games with stacked pieces, multiple zones (bar, borne-off), and dynamic dice state.

## Key Design Choices

### Board Layout
- 24 triangular points in 4 quadrants (6 points each)
- Point numbering matches backgammon convention: top 11-0 right-to-left, bottom 12-23 left-to-right
- Center bar divider separates board halves
- 1.6:1 aspect ratio maintains traditional backgammon proportions
- Responsive layout recalculates all dimensions on resize

### Piece Stacking Display
- Maximum 5 visible pieces per point before showing count label
- Vertical stacking with 1.8× radius spacing
- Count labels appear above 5th piece position
- Bar pieces display up to 3 before showing count
- Consistent stacking direction: top points grow down, bottom points grow up

### Dice State Rendering
- Standard die face patterns (1-6 dots in correct positions)
- Used dice rendered with 0.4 alpha (dimmed) to show availability
- Dice positioned at board center for visibility during play
- Doubles support: both dice show same value, usedDice array tracks 4-move usage

### Interactive Zones
- Each point has transparent clickable polygon matching visual triangle
- Separate bar zones for Black (top) and Red (bottom) for piece selection
- Valid target highlighting with green stroke (3px width)
- Selected point/bar highlighting with yellow stroke
- Bear-off zone indicated by green border when valid

### State Management
- Signed integer points array: positive = Black, negative = Red (matches server schema)
- Separate bar and borne-off counters for each player
- Dice and usedDice arrays synchronized from server state
- Selection state cleared automatically when invalid (piece moved, captured, etc.)

## Rationale

1. **Visual Clarity:** Stacking limit with count labels prevents overcrowding while showing exact counts
2. **Usability:** Large interactive zones and clear highlighting improve touch/click accuracy
3. **Server-Authority:** All move validation defers to server; client only calculates UI hints
4. **Consistent Pattern:** Follows CheckersRenderer structure for maintainability across game types
5. **Responsive Design:** Dynamic layout calculation ensures playability on all screen sizes

## Impact on Future Renderers

- Template for games with multiple board zones (Dominoes could use similar pattern)
- Dice rendering pattern reusable for Yahtzee, Monopoly, etc.
- Stacking display logic applicable to chip-based games (Poker)
- Interactive zone pattern scales to complex boards (Risk territories)

## Related Issues
- Issue #45 (Backgammon renderer)
- PR #70 (implementation)
- PR #66 (Backgammon server plugin, already merged)

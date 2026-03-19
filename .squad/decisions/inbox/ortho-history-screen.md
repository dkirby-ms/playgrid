# Decision: HistoryScreen Overlay Architecture

**Date:** 2026-07-23
**Author:** Ortho (Frontend Dev)
**Status:** Implemented

## Context

P6.1 delivered server-side move history recording. The VictoryScreen had a disabled "View History" button placeholder. Task was to build the HistoryScreen UI and wire it up.

## Decision

### 1. DOM overlay, not a scene
HistoryScreen is a DOM overlay (same as VictoryScreen), not a PixiJS scene. This keeps it consistent with all other UI overlays and avoids canvas lifecycle complexity.

### 2. Round-trip navigation via callbacks
VictoryScreen → HistoryScreen → VictoryScreen is handled by storing the victory data and re-calling `showVictoryScreenWithHistory()` on close. No scene transitions involved — both are DOM overlays that append/remove from `document.body`.

### 3. z-index layering
HistoryScreen uses z-index 10001 (one above VictoryScreen at 10000). This ensures it stacks correctly when both exist momentarily.

### 4. Formatter registry pattern
`historyFormatters.ts` uses a simple `Record<string, MoveFormatter>` registry with a `getFormatter()` lookup. New game formatters are added by inserting into the record. The checkers formatter demonstrates the pattern; other games can be added as needed.

### 5. Player color coding via appearance order
Players are assigned color indices (0–3) based on order of first appearance in the move history, not by session ID. This ensures stable, deterministic colors regardless of Colyseus session IDs.

## Impact

- **Pemulis (Game Logic):** When adding formatters for backgammon/risk/dominos, add entries to the `formatters` record in `client/src/ui/historyFormatters.ts`.
- **Server team:** No changes needed. Move history is read from `GameResult.metadata.moveHistory`.

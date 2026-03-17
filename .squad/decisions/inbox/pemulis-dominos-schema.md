# Pemulis: Dominos Schema & Plugin Design

**Status:** Implemented
**Date:** 2026-03-17
**Issue:** #124

## Decisions

### Board model: linear chain with two open ends
The board is an `ArraySchema<BoardTile>` representing tiles played in order. Two scalar fields (`openEndA`, `openEndB`) track the pip values at each end of the chain. This is simpler than a graph model and correct for standard double-six dominos.

### Boneyard: server-only, outside the schema
The boneyard tiles are stored in a server-side `Map<DominosState, RawTile[]>` — never part of the Colyseus schema. Clients see `boneyardCount` (a number field) but never the actual tiles. This keeps hidden information truly hidden without relying on transport-layer filtering.

### Actions: play / draw / pass
- `play { tileId, end }` — place a tile on the specified chain end
- `draw {}` — draw from boneyard (only when no playable tile; does NOT end turn)
- `pass {}` — pass turn (only when no playable tile AND boneyard empty)

### Scoring: single-round, pip-counting
Winner of a round gets the sum of all opponents' remaining pip totals. Blocked rounds are won by the player with the lowest remaining pip total.

## Impact
- **Gately:** Needs to create `DominosRenderer` in `client/src/renderers/` and register the game type in `RendererRegistry`. Board visualization should read `openEndA`/`openEndB` + the `board` array. Player hand is in `playerStates.get(sessionId).hand`.
- **Steeply:** Needs unit tests for `dominosLogic.ts` (tile generation, matching, scoring) and integration tests for the plugin lifecycle.

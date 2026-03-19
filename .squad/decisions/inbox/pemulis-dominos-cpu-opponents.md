# Pemulis: Dominos CPU Opponents Implementation

**Status:** Implemented
**Date:** 2026-03-19
**Issue:** #163

Dominos now supports CPU opponents using the same architecture established by Checkers and Backgammon.

## Architecture

- New file: `server/src/games/dominos/CpuOpponent.ts`
- Exports: `selectCpuAction(state: DominosState): CpuAction | null`
- Action types: `play` (tile + end), `draw`, `pass`
- Wired into `BaseGameRoom.executeDominosCpuTurn()` following the backgammon multi-action pattern

## Decision: Backgammon-style multi-action CPU loop for Dominos

Dominos CPU follows the Backgammon pattern (not Checkers) because the `draw` action returns `endsTurn: false`. This means a single CPU "turn" may involve multiple actions: draw → draw → draw → play (or pass). The `queueCpuTurnIfNeeded()` loop handles this naturally — each action completes, then re-queues if the turn hasn't ended.

## Heuristics

Simple rule-based scoring (not minimax):
- **Doubles bonus (+200):** Doubles set up the spinner and maintain tempo
- **High pip weight (×10):** Shed heavy tiles early to reduce blocked-round exposure
- **Flexibility (+50 per match):** Prefer plays that keep more of your remaining tiles playable

## Impact

- Client needs no changes — CPU uses existing action pipeline
- 10 new unit tests added (594 total, all passing)
- Lobby already handles CPU player creation generically; only the game-type gate was widened

## Files Changed

- `server/src/games/dominos/CpuOpponent.ts` (new)
- `server/src/games/dominos/__tests__/cpuOpponent.test.ts` (new)
- `server/src/game/BaseGameRoom.ts` (import + dispatch + executor)
- `server/src/rooms/LobbyRoom.ts` (gate widened)

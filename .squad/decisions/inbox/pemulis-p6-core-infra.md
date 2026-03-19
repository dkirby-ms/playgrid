# Decision: Move History Core Infrastructure

**Date:** 2026-03-18  
**Decider:** Pemulis (Systems Dev)  
**Context:** P6.1 — Build server-side move history recording system

## Decision

Implemented in-memory, server-side-only move history recording with delivery via `GameResult.metadata` at game end.

## Architecture

- **Storage:** Plain JS array `moveHistory: MoveEntry[]` in BaseGameRoom (NOT Colyseus schema)
- **Recording:** Captured in `processAction()` after successful action execution
- **Delivery:** Attached to `GameResult.metadata.moveHistory` during `endGame()` broadcast
- **Formatting:** Optional plugin hook `formatMoveHistory()` for game-specific human-readable descriptions

## Rationale

- In-memory storage avoids schema sync overhead (no per-move network traffic)
- Ephemeral history (dies with room) is acceptable — game results persist in DB
- Recording after handler success ensures only valid moves are logged
- CPU moves and spectators supported automatically (broadcast to all at game end)

## Alternatives Considered

- Colyseus `ArraySchema` — Rejected: Real-time sync not needed, adds network/CPU overhead
- External logging service — Rejected: Overkill for MVP, adds latency
- Client-side only — Rejected: Source of truth must be server

## Impact

- All 4 games (Checkers, Backgammon, Risk, Dominos) can use this infrastructure
- Game plugins can opt-in to formatting via `formatMoveHistory()` hook
- No breaking changes — optional feature, backward compatible

## Implementation Files

- `shared/src/MoveEntry.ts` — Interface definition
- `shared/src/gamePlugin.ts` — Added formatMoveHistory optional method
- `server/src/game/BaseGameRoom.ts` — Recording logic + delivery

## Status

✅ Complete — Build clean, lint clean, ready for game-specific implementations (P6.2-P6.5)

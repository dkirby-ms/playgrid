# Gately Decision Inbox — Shared-device head-to-head control model

**Date:** 2026-03-16  
**Status:** Proposed

## Decision

For shared-device Checkers, keep both seats represented as normal room participants, but make the second seat a synthetic server-side participant whose `controllerSessionId` points at the real client holding the device.

## Rationale

- Reuses the existing `currentTurn`, turn manager, renderer, and endgame assumptions that already expect per-seat players.
- Keeps move authorization server-authoritative: the active seat still owns the turn, while the controller mapping lets one device submit actions for that seat.
- Contains the mode-specific branching to room join/action routing instead of duplicating Checkers logic for a separate offline mode.

## Implementation Notes

- Added `controllerSessionId` to `shared/src/BaseGameState.ts` so client and server can agree on who controls a seat.
- `server/src/game/BaseGameRoom.ts` synthesizes `shared-device-opponent` for head-to-head rooms and remaps incoming actions when the controlled seat is active.
- `server/src/rooms/LobbyRoom.ts` only enables the mode for Checkers and blocks extra non-spectator joins to waiting shared-device rooms.
- `client/src/renderers/CheckersRenderer.ts` and `client/src/scenes/GameScene.ts` read the controller mapping to rotate perspective and show pass-the-device prompts.

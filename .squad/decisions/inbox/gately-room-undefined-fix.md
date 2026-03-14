# Gately decision inbox — room status HUD cleanup

## Context
Issue #54 exposed that the global Pixi status text was acting like a centered debug overlay during active gameplay, and Colyseus room identifiers were not reliable through `room.id` alone.

## Decision
Treat the shared connection/status text as a lightweight HUD toast instead of a gameplay overlay:
- anchor it to the top-left corner
- auto-hide informational states after a short delay
- keep error states persistent
- resolve displayed room identifiers with `room.roomId` first, falling back to `room.id`

## Why
This keeps transition/status messaging available without obstructing the board or other in-game rendering. It also matches the current Colyseus client behavior more safely than assuming `room.id` is always populated.

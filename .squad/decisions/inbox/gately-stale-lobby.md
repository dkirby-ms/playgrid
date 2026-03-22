# Decision: Two-Pronged Stale Lobby Cleanup

**Author:** Gately (Game Dev)
**Date:** 2026-03-20
**Status:** Implemented

## Context

Players were seeing "Leave your current game before creating another" when they had already left a game room. The LobbyRoom's `session.currentGameId` was not being cleared when players left in-progress games because `LEAVE_GAME` was only sent from waiting-room UI, not from game-room exit paths.

## Decision

Use a two-pronged cleanup approach:

1. **Client-side:** `Application.notifyLobbyGameLeft()` sends `LEAVE_GAME` to the lobby room whenever the player exits a game room (consented leave, disconnect, or reconnect failure).
2. **Server-side:** `LobbyRoom.clearStaleGameAssignment()` auto-clears `currentGameId` when it references a game that no longer exists or is already in progress. Called at the top of `handleCreateGame()` and `handleJoinGame()`.

## Rationale

- Client notification handles the common case (player-initiated leave)
- Server validation is a safety net for edge cases (crash, network drop, race conditions)
- Both layers are idempotent — double-clearing is harmless

## Convention

All scene classes managing lobby waiting state must implement `cleanup()` and call it from `onExit()`.

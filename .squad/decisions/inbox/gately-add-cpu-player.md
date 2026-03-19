# Decision: ADD_CPU_PLAYER / REMOVE_CPU_PLAYER lobby messages

**Author:** Gately  
**Date:** 2026-03-20  
**Status:** Implemented (server-side only)

## Context

CPU opponents were previously only configurable at game creation time via `cpuOpponent: true` in `CreateGamePayload`. This couples CPU toggling to the create flow, meaning hosts can't add/remove a CPU from the waiting room after creating a game.

## Decision

Added two new lobby message types:
- `ADD_CPU_PLAYER` (`add_cpu_player`) — host adds a CPU to a waiting game
- `REMOVE_CPU_PLAYER` (`remove_cpu_player`) — host removes the CPU from a waiting game

Both require a `{ gameId: string }` payload. Server validates: host identity, game status (`waiting`), CPU support gate (`checkers`, `backgammon`, `dominos`), capacity, and duplicate prevention.

Extracted `isCpuSupported(gameType)` as a shared helper from the existing `shouldEnableCpuOpponent()` to keep the game-type allowlist DRY.

## Impact

- **Ortho (client):** New message constants `ADD_CPU_PLAYER` / `REMOVE_CPU_PLAYER` and payload types (`AddCpuPlayerPayload`, `RemoveCpuPlayerPayload`) are exported from `@eschaton/shared`. Client can send these from the waiting room UI.
- **Steeply (test):** Lobby pregame test mock updated. New handler logic could use dedicated test coverage for the add/remove flows.
- **Pemulis (server):** No changes needed — `BaseGameRoom` already reads `cpuOpponent` from room options at start time; the flag is set correctly before `START_GAME`.

## Files Changed

- `shared/src/lobbyTypes.ts`
- `server/src/rooms/LobbyRoom.ts`
- `server/src/__tests__/lobby-pregame.test.ts`

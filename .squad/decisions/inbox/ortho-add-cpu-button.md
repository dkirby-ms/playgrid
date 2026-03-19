# Decision: CPU opponent added from waiting room, not at creation time

**Author:** Ortho (Frontend Dev)
**Date:** 2026-03-18
**Status:** Implemented (client-side)

## Context

Previously, the host chose PvP vs AI mode at game creation time (via a toggle in setup config panels and a checkbox in the create modal). This front-loaded the decision before the host even saw the waiting room.

## Decision

Move CPU opponent selection into the waiting room player list:

- The host sees an "🤖 Add CPU Player" dashed-border slot when the game supports CPU, the room isn't full, and no CPU is already present.
- A "✕" remove button appears next to the CPU player's name (host only).
- Client sends `ADD_CPU_PLAYER` / `REMOVE_CPU_PLAYER` messages to the lobby room.
- The PvP/AI mode toggle was removed from `CheckersSetupConfig` and `BackgammonSetupConfig`.
- The `cpuOpponent` checkbox was removed from `LobbyScreen`'s create game modal.
- Both `WaitingRoom.ts` (legacy) and `SetupScreen.ts` (new setup flow) support the button.

## Impact

- **Server side:** Gately is adding the `ADD_CPU_PLAYER`/`REMOVE_CPU_PLAYER` handlers in `LobbyRoom.ts` in parallel.
- **Invite section:** Visibility now checks the actual player list (`players.some(p => p.isCPU)`) instead of `gameInfo.cpuOpponent`.
- **CreateGamePayload:** `cpuOpponent` field is no longer sent from the client on creation. The server should treat missing `cpuOpponent` as false.

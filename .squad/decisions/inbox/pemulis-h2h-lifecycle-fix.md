# Pemulis — Head-to-head synthetic lifecycle follow-up

## Context
Hal rejected PR #122 because `BaseGameRoom` left the shared-device synthetic opponent marked connected after the only real controller disconnected, which allowed an incorrect forfeit win and left the room alive longer than intended.

## Decision
Treat controller-owned synthetic participants as dependent lifecycle state:

1. Mirror the controller's connectivity onto any synthetic players it owns.
2. Restore those synthetic players only when the controller actually reconnects.
3. If the controller leaves permanently, do not award a forfeit to the owned synthetic seat; end the room with a no-winner cleanup path instead.

## Why
Head-to-head mode still has only one real device connection. Awarding wins to a synthetic seat owned by that same device breaks match semantics and prevents proper room disposal.

## Implementation note
Current fix lives in `server/src/game/BaseGameRoom.ts` with regression coverage in `server/src/__tests__/BaseGameRoom.test.ts`.

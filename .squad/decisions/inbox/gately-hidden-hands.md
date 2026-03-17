# Decision: Server-side hands for Dominos hidden information

**Author:** Gately (Game Dev)
**Date:** 2026-03-17
**Status:** Implemented on `squad/124-dominos`
**Context:** Hal's review of PR #141 found opponent hand tiles visible to all clients via Colyseus schema sync.

## Problem

`DominosPlayerState.hand` was an `ArraySchema<DominoTile>` — Colyseus syncs all schema data to all clients. Any player could inspect opponent tiles in browser devtools.

## Decision

Follow the existing boneyard pattern: store player hands in a server-only `Map` outside the schema, send each player their own hand via targeted room messages.

### Schema changes
- Removed `hand: ArraySchema<DominoTile>` from `DominosPlayerState`
- Added `handCount: number` (public: opponents can see tile count)

### Server-side storage
- `playerHandsMap = Map<DominosState, Map<string, RawTile[]>>` in DominosPlugin.ts
- Exported `getPlayerHand`, `setPlayerHand`, `getPlayerHands` for test access

### Per-client messaging
- Added `getPlayerMessage?(state, sessionId)` to `StateFilter` interface (shared/gamePlugin.ts)
- BaseGameRoom calls it after successful actions, game start, and reconnection
- Dominos plugin returns `{ type: "hand", tiles: RawTile[] }` for each player

### Client changes
- Renderer listens for `"player-data"` room messages instead of reading schema hand
- Opponent counts from `handCount`, own hand from messages
- Fixed `room.send()` format to match BaseGameRoom's per-action-type registration

## Consequences

- **Security**: Opponent hand tiles are no longer in the schema or network traffic
- **Generic pattern**: Any future game with hidden info can use `getPlayerMessage` on its stateFilter
- **Breaking change**: `DominosPlayerState.hand` removed from schema — any code reading it needs migration
- **Test impact**: Logic functions `isRoundBlocked`, `resolveBlockedRound`, `scoreDomino` now require a `playerHands` map parameter

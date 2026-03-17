# Decision: Hidden State Verification Tests for Dominos

**Author:** Steeply (Tester)
**Date:** 2026-03-17
**Context:** PR #141 reviewer rejection — Dominos stateFilter was a no-op

## Decision

Added 48 plugin-layer tests in `server/src/games/dominos/__tests__/dominosPlugin.test.ts` verifying that Gately's hidden-state fix correctly prevents opponent hand tile leakage.

## Key Verifications

1. **Schema privacy:** `DominosPlayerState.hand` (ArraySchema) is gone. Replaced with `handCount` (number). No tile data on the synced schema.
2. **Server-side hands:** Plugin stores hands in a module-level `Map<DominosState, Map<string, RawTile[]>>`, inaccessible to clients.
3. **getPlayerMessage:** New hook delivers hand tiles as direct messages per player — verified tiles are correct, per-player unique, and updated after play/draw actions.
4. **filterForClient:** Correctly returns full state (safe — no hidden data in schema to leak).
5. **handCount accuracy:** Schema `handCount` stays in sync with server-side hand size after every action (deal, play, draw).
6. **Boneyard privacy:** Only `boneyardCount` (number) is synced, no tile array.

## Pre-existing Issue Noted

`dominosLogic.test.ts` has 11/83 failures — function signatures for `scoreDomino`, `isRoundBlocked`, `resolveBlockedRound`, `removeTileFromHand` changed in Gately's refactor (now take `playerHands` Map / `RawTile[]`). Those tests need updating separately.

## Impact

- PR #141 now has test coverage for the specific security concern Hal flagged
- All 48 new tests passing, lint clean, build green

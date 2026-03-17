# Decision: Dominos Hidden State Filtering Required

**Author:** Hal (Lead)
**Date:** 2026-03-17
**Context:** PR #141 review — Dominos (#124)
**Status:** REQUIRED BEFORE MERGE

## Decision

PR #141 is blocked until opponent hand data is actually hidden from clients. The current `stateFilter.filterForClient` is a no-op, and the `StateFilter` interface is dead infrastructure (never invoked by `BaseGameRoom`).

## What Must Happen

1. **Implement real per-client state filtering.** Two approaches:
   - **(A) Colyseus-native:** Use `@filterChildren` on the `playerStates` MapSchema so each client only receives their own hand tiles. Requires schema decorator changes in `shared/`.
   - **(B) Framework-level:** Wire `BaseGameRoom` to call `filterForClient` before serialization and strip opponent hands. More invasive but gives us a reusable pattern for Poker/Hearts/Spades.

2. **Approach (B) is preferred** — we need this pattern for at least 3 more games on the backlog. Build it once in BaseGameRoom.

3. **Update SKILL.md** — Current document incorrectly claims hands are "visible to the owning player's client." Must reflect actual implementation.

## Constraints

- Opponent clients must see hand **counts** only (already tracked via `hand.length`), never tile contents.
- The boneyard server-only Map pattern is correct and should be preserved.
- Spectators see no hand contents.

## Assignment

- **Pemulis:** Implement state filtering in BaseGameRoom + update DominosPlugin.filterForClient
- **Steeply:** Add plugin-level action tests and a test verifying filtered state excludes opponent hands
- **Gately:** No renderer changes needed (already renders opponents face-down by count)

## Impact

All future hidden-information games (Poker, Hearts, Spades) depend on this infrastructure. Getting it right now avoids retrofitting later.

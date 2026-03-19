# Decision: Checkers Move Formatter — Description Format Convention

**Author:** Pemulis  
**Date:** 2026-03-16  
**Status:** Implemented

## Context

P6.1 built the generic move history infrastructure (MoveEntry, recordMove, delivery via GameResult.metadata). The CheckersPlugin is the first game to implement `formatMoveHistory`, establishing the pattern other games will follow.

## Decision

Adopted a description format convention for Checkers move history:

- **Regular move:** `"{PlayerName} moved from {from} to {to}"`
- **Capture:** `"{PlayerName} captured at {to} (from {from})"`
- **King promotion:** `"{PlayerName} kinged at {to}"`
- **Capture + promotion:** `"{PlayerName} captured at {to} (from {from}), kinged at {to}"`
- **Multi-jump chain:** `"{PlayerName} captured {N} pieces"` — all entries in the chain share the same description with the running count

Coordinate notation: board index → algebraic (A1–H8), column = index % 8 → letter, row = floor(index / 8) + 1.

## Rationale

- Human-readable descriptions serve the game result screen and any future replay/export features.
- Multi-jump chains consolidate into a single summary because individual hop descriptions would be noisy in the UI.
- Move type detection is payload-based (row delta for captures, destination row for promotion) rather than replaying game state, which keeps the formatter stateless with respect to board evolution.
- Unknown players and missing payload fields produce graceful fallbacks (no description) rather than errors.

## Impact

- Other game plugins (Backgammon, Risk, Dominoes) should follow this pattern: implement `formatMoveHistory` with game-appropriate description strings.
- The formatter is pure — it doesn't mutate inputs and can be unit-tested without Colyseus room infrastructure.

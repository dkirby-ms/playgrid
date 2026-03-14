# Pemulis — Colyseus 0.17 baseline

## Context
PlayGrid was still split across the Colyseus 0.16 server package, Schema v3 in shared code, and the legacy `colyseus.js` browser client. The upgrade request was to move all three workspaces to the Colyseus 0.17 line without changing the lobby/game flow semantics.

## Decision
Standardize the repo on Colyseus 0.17 packages: `colyseus` + explicit `@colyseus/core` and `@colyseus/ws-transport` on the server, `@colyseus/schema` v4 in shared, and `@colyseus/sdk` on the client. Room classes should no longer use `Room<State>` generics; instead they should assign `state = new GameState()` directly and use the `onLeave(client, code)` signature.

## Why it matters
This keeps all workspaces on compatible protocol/runtime versions, fixes the missing peer-dependency typing/runtime surface for the server, and aligns future room/client code with the 0.17 API shape so later game-system work does not have to straddle both SDK generations.

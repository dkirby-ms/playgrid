# Pemulis: Shareable Waiting-Room Links

## Status
- Proposed

## Context
Waiting rooms already have a stable lobby-side `gameId`, and `LobbyRoom.handleJoinGame()` already understands that identifier before a real Colyseus game room exists. The feature request is to let hosts share a direct invite link that can reopen the app and send the recipient into that waiting room automatically.

## Decision
Use the existing lobby `gameId` as the shareable join token and encode it in the browser URL as `?join={gameId}`.

- Do **not** add a new HTTP endpoint or a separate join-token service.
- Keep the URL synced while the client is in a waiting room.
- Clear the `join` parameter when transitioning into the live game room.
- On lobby boot/reconnect, if `join` is present, immediately send the existing `JOIN_GAME { gameId }` message to the lobby room.

## Rationale
This reuses the validated server join path and preserves all current edge-case handling for missing/full/started games. It also keeps the implementation small and robust: invite links work before a Colyseus `roomId` exists, and reconnects/refreshes can re-enter the waiting room without inventing a second session model.

## Impact
- Server contract remains unchanged for production code.
- Waiting-room invites become copyable and deep-linkable.
- Host/guest refresh flows can reuse the same link semantics in pregame.

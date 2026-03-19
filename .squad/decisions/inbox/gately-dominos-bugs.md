### Gately: Fix Dominos Hand Desync on Join and Reconnect

**Status:** Implemented  
**Date:** 2026-03-20  

Fixed two Dominos bugs where (1) the board appeared non-functional on game start because the player's hand tiles were missing, and (2) hand tiles were invisible after a page-refresh reconnect.

**Root Cause:**
Both bugs share the same race condition. The server sends `player-data` (hand tiles) via `client.send()` during `onJoin()` — inside `startGame()` (initial join) or the reconnect path. But the Colyseus SDK delivers these messages before the client has registered its `room.onMessage("player-data")` handler. The SDK silently drops unhandled messages — there is no replay or buffering. The player's hand array stays empty, making the game unplayable.

A secondary issue affects all games: the async `SceneManager.transitionTo()` creates a window where Colyseus state patches can silently update `room.state` without triggering `onStateChange` (handler not yet registered).

**Solution:**

1. **BaseGameRoom** — Registered a `"request-player-data"` message handler that re-sends the player's private data on demand (via the existing `sendPlayerMessage` path).
2. **DominosRenderer** — After subscribing to `"player-data"` events, immediately sends `"request-player-data"` to the server so the hand is always received regardless of join timing.
3. **GameScene** — After registering `room.onStateChange`, immediately invokes the handler with `room.state` to flush any patches that arrived during the async scene transition.

**Impact:**
- ✅ Hand tiles appear on first join without requiring a page refresh
- ✅ Hand tiles survive page-refresh reconnect
- ✅ All existing tests pass (583 tests, 0 regressions)
- ✅ Generic fix in BaseGameRoom benefits any future game with private player data
- ✅ GameScene state-flush benefits all game renderers, not just Dominos

**Key Learning:**
Never rely on server-initiated messages sent during `onJoin()` reaching the client's renderer. The Colyseus join handshake completes and delivers messages before the application has finished its scene transition and registered game-specific handlers. Always pair server-push with client-pull for critical state like player hands.

**Files Modified:**
- `server/src/game/BaseGameRoom.ts`
- `client/src/renderers/DominosRenderer.ts`
- `client/src/scenes/GameScene.ts`

**Test Coverage:** No new tests required — the fix is a timing/ordering change. All 583 existing tests pass.

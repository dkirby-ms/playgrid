# Decision: Player Reconnection Support

**Author:** Pemulis (Systems Dev)  
**Date:** 2026-03-14  
**Status:** Implemented  
**PR:** #61  
**Issues:** #35, #59

## Context

Players experienced connection drops after 1-2 minutes of gameplay with no way to rejoin. This blocked playtesting and created poor UX. We needed both connection stability improvements and graceful reconnection handling.

## Decision

Implemented two-part solution:

### 1. Connection Stability (Issue #59)
- Configure WebSocket transport with heartbeat: `pingInterval: 10000` (10s), `pingMaxRetries: 3`
- Prevents server-side idle timeout that was causing premature disconnects
- Keeps connections alive during low-activity periods (planning moves, thinking)

### 2. Reconnection Support (Issue #35)
- Call `allowReconnection(client, timeout)` in `BaseGameRoom.onLeave()` during active games
- Default 30s timeout, configurable via room options
- On reconnect, `onJoin()` detects existing player and restores `isConnected` flag
- Timeout triggers forfeit (1 player remains) or draw (all disconnected)
- CONSENTED disconnects skip reconnection (immediate forfeit)

## Rationale

**30-second timeout:**
- Long enough for page reload, network hiccup recovery
- Short enough to not frustrate waiting opponents
- Can be overridden per-game type if needed

**CONSENTED skip:**
- Preserves intentional forfeit semantics
- Prevents reconnection loop when player explicitly quits
- Maintains existing test expectations

**Heartbeat configuration:**
- 10s interval balances responsiveness with network overhead
- 3 retries = 30s grace period before considering connection dead
- Standard pattern for WebSocket keep-alive

## Alternatives Considered

1. **Client-side reconnection UI**: Deferred to future work; server-side foundation needed first
2. **No timeout differentiation**: Rejected; CONSENTED closes should be immediate forfeits
3. **Longer timeout (60s+)**: Rejected; too long for opponent to wait in 2-player games
4. **Store session tokens for cross-page rejoin**: Out of scope; requires authentication system

## Impact

- ✅ Connection stability: no more 1-2 minute timeouts
- ✅ Reconnection: players can reload page mid-game
- ✅ All existing tests pass
- ✅ Works with Checkers plugin
- ⚠️ Client-side rejoin UI still needed (future work)
- ⚠️ Lobby reconnection still unsupported (different flow)

## Related Decisions

- Aligns with existing `PlayerInfo.isConnected` field design
- Compatible with plugin lifecycle hooks (onPlayerLeave called after timeout)
- Consistent with turn timeout forfeit logic

## Follow-up Work

- Client-side "Reconnecting..." UI (Issue #50)
- Lobby reconnection support
- Per-game timeout configuration (if playtesting shows 30s insufficient for complex games)

# Pemulis Decision: Application Insights Telemetry Integration

**Date:** 2026-03-14  
**Issue:** #40  
**PR:** #75

## Decision

Integrate Azure Application Insights for server-side telemetry and observability.

## Context

The PlayGrid server needed comprehensive telemetry to monitor:
- Game lifecycle events (room creation, game start/end)
- Player behavior (connections, disconnections, reconnections)
- System health (unhandled exceptions)
- Performance metrics

## Implementation

### Architecture
- Created `server/src/telemetry.ts` as centralized telemetry module
- Initialized from `APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable
- Graceful no-op when connection string not configured (local development friendly)

### Custom Events Tracked
1. **room_created** — Game room instantiated (gameType, roomId, gameId)
2. **player_connected** — Player joins room (gameType, roomId, sessionId, isSpectator)
3. **player_reconnected** — Existing player reconnects (gameType, roomId, sessionId)
4. **player_disconnected** — Player leaves room (gameType, roomId, sessionId, phase, code)
5. **game_started** — Game begins play (gameType, roomId, gameId, playerCount)
6. **game_ended** — Game completes (gameType, roomId, gameId, resultType, durationSeconds)

### Exception Tracking
- Unhandled rejections tracked with source: "unhandledRejection"
- Uncaught exceptions tracked with source: "uncaughtException"
- Both include full error details

### Auto-Collection Enabled
- HTTP requests
- Performance metrics (with extended metrics)
- Exceptions
- Dependencies
- Console logs
- Disk retry caching for offline resilience

## Rationale

**Why Application Insights?**
- Native Azure integration (server running on Azure App Service)
- Comprehensive auto-collection reduces instrumentation burden
- Custom events provide business-level insights beyond system metrics
- Query language (KQL) enables powerful analytics

**Why these specific events?**
- Cover full game lifecycle from room creation to game end
- Distinguish player vs spectator joins
- Track reconnection separately to measure connection stability impact
- Include contextual properties (gameType, phase, resultType) for segmented analysis

**Why graceful degradation?**
- Local development doesn't require Azure resources
- Telemetry failures shouldn't crash games
- All tracking wrapped in try/catch, logs errors but continues

## Alternatives Considered

1. **Prometheus + Grafana** — More setup, requires separate infrastructure
2. **Custom logging to database** — Limited query capabilities, scales poorly
3. **Third-party APM (Datadog, New Relic)** — Additional cost, less Azure-native

## Configuration Requirements

### Production
Set environment variable:
```
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=...;LiveEndpoint=..."
```

### Daily Cap
Set via Azure Portal → Application Insights → Configure → Daily Cap  
(SDK config for `maxBytesPerInterval` not supported in current API version)

### Local Development
No configuration required — telemetry silently disabled if connection string missing

## Impact

- **Observability:** Full visibility into game lifecycle and player behavior
- **Debugging:** Exception tracking with stack traces and custom context
- **Analytics:** Query custom events to understand game popularity, session duration, failure modes
- **Performance:** Minimal overhead (<1ms per tracked event), async telemetry pipeline
- **Development:** No impact on local workflow, graceful no-op when not configured

## Testing

- `npm run build` — TypeScript compilation successful
- `npm run lint` — No ESLint issues
- `npm run test` — All 165 tests pass
- Manual validation: telemetry initializes correctly, events fire at expected lifecycle moments

## Related Work

- Server startup (index.ts) now includes telemetry initialization
- BaseGameRoom lifecycle hooks instrumented
- Process-level exception handlers capture uncaught errors

## Future Enhancements

- Add custom metrics for game duration percentiles, player count distribution
- Track action-level events for popular game moves/strategies
- Implement sampling for high-volume events if needed
- Add user-id tracking when authentication is implemented

# Pemulis — CPU Opponent Wiring (Issue #86)

## Proposed decision

Represent the Checkers CPU opponent as a fixed synthetic participant (`cpu-opponent`) across both lobby pregame state and the server game room, and let `BaseGameRoom` schedule its turns through the normal plugin action pipeline.

## Why this matters

- Keeps `CheckersPlugin` unchanged and human/CPU-agnostic.
- Reuses existing player ordering, win detection, reconnection, and renderer state sync.
- Makes single-player waiting rooms understandable to players because the CPU appears as a ready roster slot before start.

## Implementation notes

- `LobbyRoom` accepts `cpuOpponent: true` only for Checkers and seeds a ready `PreGamePlayerInfo` for `cpu-opponent`.
- `BaseGameRoom` injects the synthetic player on first human join, then uses `clock.setTimeout(..., 200)` to trigger `selectCpuMove()` and replay `move` through the existing validate/handle/end-turn flow.
- Current MVP heuristic is deterministic: captures > promotions > advancement toward promotion.

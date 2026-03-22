# Decision: Renderer Action Pending Pattern

**Author:** Gately (Game Dev)
**Date:** 2026-03-22
**Status:** Implemented

## Context

UX directive requires all server-bound actions to have double-click protection and visual feedback. Game renderers are PixiJS canvas-based, so CSS `:disabled` patterns don't apply to most interactions.

## Decision

Each renderer uses a single boolean flag (`actionPending` or `movePending`) for double-click protection:

1. **Set flag BEFORE** `room.send()` call
2. **Early-return** in click/interaction handlers if flag is true
3. **Clear flag in `onStateChange()`** — server state update is the authoritative confirmation
4. **Sidebar DOM buttons** additionally set `disabled = true` and update button text (e.g., "Moving…")
5. **Never use timeouts** to clear the flag — only server state updates

## Rationale

- Single flag per renderer works because all games are turn-based (sequential actions)
- Clearing on state change is reliable — Colyseus always sends a state update after processing a message
- Sidebar buttons get visual feedback (disabled + text change) because they're DOM elements
- Canvas interactions just block via early-return (no visual disabled state needed — the action completes visually via state update)

## Convention

When adding new game actions to any renderer, always guard `room.send()` calls with the renderer's pending flag.

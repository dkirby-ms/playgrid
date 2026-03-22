# Decision: Optimistic Loading State for Server-Bound Buttons

**Author:** Ortho  
**Date:** 2026-03-20  
**Status:** Implemented

## Context

The "Add CPU Player" button in both WaitingRoom and SetupScreen felt flaky — first clicks appeared to do nothing, and subsequent clicks were unreliable. The root cause: `renderPlayerList()` rebuilds the entire DOM on every `GAME_PLAYERS` message. A click during a render cycle can be lost (DOM element destroyed between mousedown and mouseup). Combined with zero visual feedback during the server round-trip, users assumed the click didn't register.

## Decision

Any button that sends a message to the server and waits for a response should implement an **optimistic loading state**:

1. **Guard** — check room/gameId are non-null and no pending request exists before sending
2. **Immediate feedback** — disable button, change text to loading indicator (e.g., "⏳ Adding CPU…")
3. **Pending flag** — a boolean flag that survives DOM rebuilds (since `renderPlayerList()` recreates elements)
4. **Confirmation clear** — clear pending state when the expected server response arrives
5. **Error clear** — clear pending state on LOBBY_ERROR so the button becomes clickable again
6. **Timeout fallback** — auto-reset after 5 seconds if neither confirmation nor error arrives

## Impact

- Pattern applies to any future "click → server → response" UI element
- Already applied to: Add CPU button (WaitingRoom + SetupScreen)
- The Start Game button already followed this pattern (disables + shows "Starting…")

## Files Modified

- `client/src/ui/WaitingRoom.ts` — `requestAddCpu()`, `clearCpuAddPending()`, pending-aware rendering
- `client/src/ui/SetupScreen.ts` — same pattern
- `client/index.html` — CSS for `.waiting-room-add-cpu.pending` with pulse animation

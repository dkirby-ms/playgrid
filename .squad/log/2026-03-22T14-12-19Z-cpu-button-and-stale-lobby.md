# Session Log: CPU Button & Stale Lobby Fixes

**Date:** 2026-03-22  
**Agents:** Ortho (Frontend), Gately (Game Dev)  
**Status:** ✅ Complete

## Work Summary

**Ortho:** Fixed UX flakiness on "Add CPU Player" button by implementing optimistic loading state (pending flag guard, immediate button disable, loading text, 5s timeout reset, pulse CSS animation). Applied to WaitingRoom + SetupScreen. 799 tests pass.

**Gately:** Fixed stale lobby room state — players seeing "Leave your current game" error after leaving. Two-pronged fix: client-side `notifyLobbyGameLeft()` on all game-room exits + server-side `clearStaleGameAssignment()` validation. Added 4 regression tests. 803 tests pass.

## Key Decisions

1. **Optimistic Loading Pattern:** All server-bound buttons must have immediate visual feedback, pending guard flag, and timeout reset. (See ortho-cpu-button-ux.md)
2. **Two-Pronged Lobby Cleanup:** Client notification + server validation for idempotent cleanup. (See gately-stale-lobby.md)
3. **UX Directive:** dkirby-ms issued directive to audit and protect all 12+ unprotected server actions. Priority: SetupScreen Start Game, LobbyScreen Join, Leave/Back buttons. (See copilot-directive-2026-03-22T14-06.md)

## Artifacts

- `.squad/orchestration-log/2026-03-22T14-12-19Z-ortho.md`
- `.squad/orchestration-log/2026-03-22T14-12-19Z-gately.md`
- `.squad/decisions/inbox/ortho-cpu-button-ux.md` (→ merged to decisions.md)
- `.squad/decisions/inbox/gately-stale-lobby.md` (→ merged to decisions.md)
- `.squad/decisions/inbox/copilot-directive-2026-03-22T14-06.md` (→ merged to decisions.md)

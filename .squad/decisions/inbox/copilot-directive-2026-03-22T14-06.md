### 2026-03-22T14:06Z: UX directive — visual feedback on all server-bound actions
**By:** dkirby-ms (via Copilot)
**What:** All buttons and interactive actions that send messages to the server must provide immediate visual feedback (loading/pending state, disabled button, text change) and double-click protection. No fire-and-forget clicks.
**Why:** User request — the "Add CPU Player" flakiness exposed a systemic pattern. Audit found 12 unprotected actions across LobbyScreen (Join), SetupScreen (Start Game, Leave), WaitingRoom (Leave, Remove CPU), and all game renderers (Dominos draw/pass/play, Checkers move, Risk territory/sidebar, Backgammon move/pass). Pattern to follow: guard flag set BEFORE send, button disabled + text updated immediately, cleared on server response or timeout.
**Priority areas:**
1. SetupScreen Start Game + LobbyScreen Join (most visible, no protection)
2. All leave/back buttons (guard flag before send, not after)
3. Game board clicks and sidebar buttons (debounce/guard)
**Reference implementation:** WaitingRoom.requestAddCpu() and SetupScreen.requestAddCpu() (Ortho's fix from 2026-03-22)

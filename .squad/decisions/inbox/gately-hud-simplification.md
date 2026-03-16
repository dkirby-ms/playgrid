### 2026-03-16T02:22Z: Shared game status lives in the sidebar, not the HUD overlay
**By:** Gately
**What:** Remove the redundant shared HUD status card and keep `HUD.ts` focused on overlay chrome (Leave + chat) plus turn-clock timing. Renderer sidebars now own the visible game status, player info, and turn clock via a shared `GameSidebar` clock helper and `GameRenderer.setTurnClock()` hook.
**Why:** User request — the sidebar already surfaces game status and players, so duplicating that data in the HUD wasted screen space and split the same state across two UI surfaces. Centralizing visible status inside sidebar panels keeps the board column cleaner while preserving one shared countdown source.

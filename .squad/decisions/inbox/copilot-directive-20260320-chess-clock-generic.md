### 2026-03-20T13:50: User directive
**By:** dkirby-ms (via Copilot)
**What:** The chess clock / game timer system must be generic and support future games — not checkers-specific. Infrastructure belongs in the base layer (BaseGameState, BaseGameRoom, IGamePlugin). Games opt in via plugin config.
**Why:** User request — captured for team memory

### Ortho: Console Log Panel replaces modal status popups (#146)

**Date:** 2026-07-22
**PR:** #152
**Branch:** `squad/146-console-log-panel`

**Decision:** Status messages now route to a persistent inline ConsoleLog panel instead of only showing as transient PixiJS text or modal overlays. ReconnectOverlay reduced from full-screen modal to compact top-right toast.

**Key points:**
- `ConsoleLog` is a singleton created in `Application.init()` and passed to LobbyScreen via `setConsoleLog()`
- `setStatus()` dual-writes to both PixiJS statusText and ConsoleLog
- VictoryScreen and GameOverOverlay are NOT removed — game-end events log to console AND still trigger VictoryScreen
- ReconnectOverlay still exists but is now a small toast indicator, not a full-screen blocker

**Cross-impact:**
- Any new status messages added anywhere should also route to `consoleLog`
- Components that need console logging should receive the ConsoleLog instance via setter (same pattern as LobbyScreen)
- The `#console-log-container` div is in index.html at the bottom of `#app`

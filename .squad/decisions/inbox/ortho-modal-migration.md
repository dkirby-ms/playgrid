# Decision: Route all transient status messages through ConsoleLog

**Author:** Ortho (Frontend Dev)
**Date:** 2025-07-25

## Context

The project had two parallel notification paths: modal overlays/notification bars (ReconnectOverlay, LobbyScreen.showNotice, SetupScreen.showError, WaitingRoom.showError) and the ConsoleLog panel. This created visual noise with multiple popups competing for attention.

## Decision

All transient status messages (errors, warnings, success confirmations) now route through the ConsoleLog panel exclusively. Modal overlays are reserved for full-screen interactive content only (VictoryScreen, HistoryScreen).

## Implications

- **ConsoleLog is the single notification channel** for transient messages. New features should use `consoleLog.info/success/warn/error()` rather than adding modal popups.
- **ReconnectOverlay is effectively dead code.** Its show* methods are no longer called. The DOM + scheduling infrastructure remains but can be removed in a future cleanup pass.
- **showNotice on LobbyScreen/LobbyScene still exists** for `showConnectionError` (connection loss banner). That's the one remaining caller — a structural notification, not a transient status.
- **SetupScreen and WaitingRoom now accept ConsoleLog** via `setConsoleLog()` — same pattern used by LobbyScreen.

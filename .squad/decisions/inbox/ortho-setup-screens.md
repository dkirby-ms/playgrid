# Decision: Setup Screens Replace Create Game Modal (Phase 4)

**Author:** Ortho (Frontend Dev)
**Date:** 2026-03-18
**Status:** Implemented

## What Changed

Game tile clicks in the lobby now navigate to a full-screen Setup screen instead of opening the Create Game modal. The modal is still in the DOM but is no longer triggered by game tiles.

## Architecture

- **SetupScreen** (`client/src/ui/SetupScreen.ts`) — Shared base with two-column layout (players left, config right). Two modes: "create" (pre-game config) and "waiting" (post-create player list + ready/start).
- **Per-game config panels** (`client/src/ui/setup/`) — `CheckersSetupConfig`, `BackgammonSetupConfig`, `RiskSetupConfig`, `DominosSetupConfig`. Each returns a `SetupConfigPanel` interface with `getPayloadOverrides()` and `setReadOnly()`.
- **Shared control factories** (`configControls.ts`) — `createOptionGroup()`, `createToggleRow()`, `createStepper()` used by all config panels.
- **SetupScene** (`client/src/scenes/SetupScene.ts`) — Scene wrapper registered in SceneManager.
- **LobbyEvent** extended with `{ type: "setup"; gameType: string }`.
- Both "create" and "join" flows now route through SetupScene in Application.ts.

## Why

User directive: "Use Setup pages instead of Create Game Modal." The Figma designs show per-game setup screens with config panels (game mode, time control, rules) rather than a generic modal. This gives players more control and makes the pre-game experience game-specific.

## Backward Compatibility

- `WaitingRoom.ts` and `WaitingRoomScene.ts` are preserved (e2e tests reference them).
- The Create Game modal DOM is still present (accessible via code if needed).
- All existing server messages (`CREATE_GAME`, `GAME_JOINED`, `GAME_PLAYERS`, `GAME_STARTED`, etc.) are used unchanged.

## Team Impact

- **Server team:** No changes needed. SetupScreen uses existing messages.
- **Renderer team:** No changes. Setup screens are pure DOM, no PixiJS.
- **E2E tests:** May need updates to navigate through setup screen instead of the old waiting room. The WaitingRoom overlay still exists for backward compat.

# Ortho: Setup Screens (Phase 4)

**Date:** 2026-03-18T01:30Z  
**Status:** ✅ Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Tests:** ✅ Pass (467)

## Scope

Built per-game setup screens replacing the inline Create Game modal. Game tile clicks in the lobby now navigate to a full-screen Setup screen with game-specific configuration options.

## Deliverables

### Created (8 new files, ~1,876 lines)

- **`client/src/ui/SetupScreen.ts`** (main base class)
  - Two-column glass morphism layout: players list (left), config panel (right)
  - Two modes: `"create"` (pre-game config) and `"waiting"` (post-create player list + ready/start)
  - Binds directly to lobby room for `GAME_JOINED`, `GAME_PLAYERS`, `GAME_STARTED` messages
  - Responsive, accessible

- **`client/src/scenes/SetupScene.ts`** — Scene wrapper
  - Registered in SceneManager for state transitions

- **Per-game config panels** (`client/src/ui/setup/`)
  - `CheckersSetupConfig.ts` — Time control, move validation
  - `BackgammonSetupConfig.ts` — Game mode, stakes
  - `RiskSetupConfig.ts` — Game mode, turn timer
  - `DominosSetupConfig.ts` — Turn order, pass rules
  - Each returns a `SetupConfigPanel` interface with `getPayloadOverrides()` and `setReadOnly()`

- **`client/src/ui/setup/configControls.ts`** — Shared control factories
  - `createOptionGroup()` — radio button groups
  - `createToggleRow()` — labeled toggles
  - `createStepper()` — increment/decrement controls
  - Used by all config panels for consistency

- **`client/src/ui/setup/index.ts`** — Barrel export

### Modified

- **`client/src/Application.ts`** — Both "create" and "join" flows now route through SetupScene
- **`client/src/ui/LobbyScreen.ts`** — Game tiles navigate to setup instead of opening Create Game modal
- **`client/index.html`** — Added `<div id="setup-overlay"></div>`

### LobbyEvent Extension

- Extended `LobbyEvent` union type with `{ type: "setup"; gameType: string }`

## Architecture Decisions

- **No modal:** Full-screen experience for setup phase
- **Two modes:** "create" for host configuration, "waiting" for post-create player list
- **Server unchanged:** Uses existing `CREATE_GAME`, `GAME_JOINED`, `GAME_PLAYERS`, `GAME_STARTED` messages
- **Glass morphism:** Matches sidebar and PlayerInfoBar styling
- **Design-token driven:** All colors, spacing, typography use CSS custom properties

## Backward Compatibility

- **`WaitingRoom.ts` and `WaitingRoomScene.ts` preserved** for e2e test compatibility
- Create Game modal DOM still present (accessible if needed)
- All existing server integration messages unchanged

## Cross-Agent Impact

- **Server:** No changes needed; SetupScreen uses existing lobby room messages
- **Renderer team:** No changes; Setup screens are pure DOM, no PixiJS integration
- **Gately:** SetupScene is a standalone screen; game rendering happens when players transition to the game room
- **E2E tests:** May need updates to navigate through Setup screen instead of old WaitingRoom (WaitingRoom preserved for backward compat)

## Team Pattern

Setup screens establish the pattern for future in-game overlay screens (settings, pause menu, victory screen, spectator controls).

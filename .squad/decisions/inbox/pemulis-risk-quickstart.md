## Pemulis: Risk Quickstart — Random Setup via onCreate Hook

**Status:** Proposed  
**Date:** 2026-03-16  
**PR:** #157  
**Issue:** #156  

Store game-specific room options (like `quickstart`) on the game state schema via the `onCreate` lifecycle hook, since `onGameStart` only receives state (not options).

**Rationale:**
- `BaseGameRoom.onCreate` passes options to `plugin.lifecycle.onCreate(state, options)`, but `onGameStart(state)` does not receive options
- Storing the flag on the Colyseus schema (`RiskState.quickstart`) means it's synced to clients and available for conditional rendering
- This is the first game plugin to use `onCreate`; establishes the pattern for future game-specific options
- Alternative considered: storing options in a module-level variable — rejected because it wouldn't survive schema serialization or be visible to clients

**Impact:**
- Risk Quickstart mode fully implemented end-to-end
- Pattern established for future game option flags (any plugin can use `onCreate` to extract custom options from room metadata)
- `quickstart` field added to `RiskState` schema — clients can read it to adapt UI (e.g., hide setup phase indicators)

**Files Modified:**
- shared/src/games/risk/RiskState.ts
- shared/src/lobbyTypes.ts
- server/src/games/risk/RiskPlugin.ts
- server/src/games/risk/riskLogic.ts
- server/src/rooms/LobbyRoom.ts
- client/src/ui/LobbyScreen.ts
- client/src/ui/setup/RiskSetupConfig.ts
- server/src/__tests__/risk.test.ts

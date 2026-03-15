## Decision: PR #83 Revision Complete — Risk Game Plugin Ready for Merge

**Context:** PR #83 (Risk Game Plugin) was reviewed by Hal (Lead) and rejected with three critical issues:
1. ~48 `it.todo()` placeholder tests that needed real implementations
2. Territory data duplicated between server and client (no single source of truth)
3. Missing documentation of intentional Phase 1 simplifications

**Decision:** All three blockers have been addressed and verified:

### 1. Test Implementation (BLOCKER → RESOLVED)

**Implemented 60 comprehensive test cases covering:**
- Territory & map validation (symmetric adjacency, continent assignments, cross-continent connections)
- Setup phase mechanics (auto-distribution, initial army allocation)
- Reinforce phase (calculation with continent bonuses, card trade-in escalation, army placement validation)
- Attack phase (validation rules, combat resolution, territory capture, card earning)
- Fortify phase (adjacency-only validation, army movement mechanics)
- Win conditions (victory detection, player elimination, territory count tracking)
- Edge cases (multi-player games, no valid moves, forced card trade-in)
- Integration tests (full game lifecycle, phase transitions)

**Verification:** All 60 tests passing (`npm run test -- server/src/__tests__/risk.test.ts`)

### 2. Shared Territory Data (BLOCKER → RESOLVED)

**Refactored:**
- Moved `server/src/games/risk/territoryData.ts` → `shared/src/games/risk/territoryData.ts`
- Updated all server imports to use `@eschaton/shared` package
- Exported types and utility functions from shared package index
- Eliminated duplication risk — client can now import from shared

**Impact:**
- Single source of truth for 42 territories, 6 continents, adjacency graph
- Client renderer can reference same data structure (no sync drift)
- Follows established decision: "Shared Static Data: Game configuration data (maps, adjacency graphs, card decks) MUST be located in `shared/src/games/{game}/`"

### 3. Phase 1 Scope Documentation (BLOCKER → RESOLVED)

**Documented in `server/src/games/risk/RiskPlugin.ts`:**

```
Phase 1 Limitations:
- Cards are counters only: No card types/visuals, tracked as integer per player
- Fortification is adjacency-only: No path-based movement through owned territories
- Attack movement is forced: Armies automatically move to captured territory
- Auto-distributed territories: No draft/selection phase where players claim territories
```

**Rationale:** Distinguishes intentional simplifications from bugs; sets expectations for future phases

### Build & Quality Gates:

✅ `npm run build` — All workspaces compile successfully  
✅ `npm run lint` — No errors (15 warnings, all non-blocking unused vars)  
✅ `npm run test` — 60/60 Risk tests passing  

### Learnings Applied:

1. **Shared static data pattern:** Territory graphs belong in `shared/` (per `.squad/decisions.md`)
2. **Test completeness:** `it.todo()` does not count as test coverage
3. **Scope transparency:** Intentional simplifications MUST be documented to distinguish from defects
4. **State tracking patterns:** Risk uses dual state (`territories` MapSchema + `riskPlayers` MapSchema)
5. **Probabilistic testing:** Combat tests loop to account for random dice rolls rather than mock Math.random()

### Recommendation:

**Approve PR #83 for merge to `dev`.**

All three blockers resolved. Game mechanics verified through comprehensive test coverage. Architecture follows team standards for shared data. Phase 1 scope is transparent and well-documented.

**Author:** Marathe (DevOps/CI-CD)  
**Date:** 2026-03-15  
**Commit:** `816332c`  
**Branch:** `squad/80-add-risk-game-plugin`  
**Status:** Ready for Hal's re-review

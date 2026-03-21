# Session Log: Turn Timer Removal → Chess Clock for All Games (2026-03-21)

**Scope:** Replace turn timer system with chess clock for Checkers, Backgammon, Risk, Dominos  
**Status:** ✅ COMPLETE  
**Test Results:** 768 tests pass

## Agents & Outcomes

| Agent   | Task                                  | Status |
|---------|---------------------------------------|--------|
| Hal     | Scope analysis, per-game decisions   | ✅     |
| Steeply | Test surface audit, test removal    | ✅     |
| Pemulis | Turn timer removal, chess clock cfg | ✅     |
| Ortho   | Client-side timer removal, mocks   | ✅     |

## Key Decisions

1. **Chess clock is now universal timer** — All 4 games use per-player time banks instead of per-turn penalties
2. **Per-game time configs:**
   - Checkers, Backgammon, Risk: 10 min (600,000 ms)
   - Dominos: 8 min (480,000 ms)
3. **Risk behavior change:** Timeout now forfeits instead of auto-pass (documented for release notes)
4. **Server-side only:** Chess clock config moved to plugin layer; client shows data from schema

## Implementation Summary

- Removed ~200 lines (penalty escalation, turn timer tick loops)
- Added ~50 lines (chess clock config for 3 games)
- Modified 6 files: shared types, BaseGameRoom, Risk/Backgammon/Dominos plugins, client setup/mocks
- Deleted 8 turn timer tests (10 total tests removed from test surface)

## Files Modified

| File | Changes |
|------|---------|
| `shared/src/gamePlugin.ts` | Removed TurnTimerPenalty, TurnTimerConfig, onAutoPass |
| `server/src/game/BaseGameRoom.ts` | Removed penalty escalation, simplified timeout handling |
| `server/src/games/risk/RiskPlugin.ts` | Removed turnTimerConfig/onAutoPass, added chessClockConfig |
| `server/src/games/backgammon/BackgammonPlugin.ts` | Added chessClockConfig |
| `server/src/games/dominos/DominosPlugin.ts` | Removed turnTimeLimit, added chessClockConfig |
| `client/src/ui/setup/RiskSetupConfig.ts` | Removed timer stepper |
| `client/src/scenes/GameScene.ts` | Removed turnTimeRemaining pipeline |
| `client/src/sandbox/mockStates.ts` | Updated to chess clock schema |
| `server/src/__tests__/BaseGameRoom.test.ts` | Removed 8 turn timer tests |

## Validation

- ✅ `npm run build` — no type errors
- ✅ `npm run lint` — clean
- ✅ `npm run test` — 768 tests pass, 12 todo

## Outstanding

- `TurnManager.test.ts` has 6 dead code tests (turnTimeLimit references) — cleanup deferred

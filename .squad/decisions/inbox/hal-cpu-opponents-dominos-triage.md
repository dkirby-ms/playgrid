# Hal: CPU Opponents for Dominoes — Triage & Architectural Decision

**Date:** 2026-03-19  
**Issue:** #163 (Feature Request: Dominoes CPU Opponents)  
**Status:** Triaged, Ready for Sprint Planning  

## Summary

CPU opponent support for Dominoes leverages the existing BaseGameRoom framework (proven in Checkers & Backgammon). The main work is implementing Dominoes-specific move selection strategy; framework integration is straightforward.

**Scope:** Medium (one new module + framework wiring)  
**Effort:** ~6 hours (Pemulis 3-4h, Steeply 2-3h)  
**Risk:** Low (framework pattern established, isolated AI module)  

---

## Architectural Approach

### 1. Framework Inheritance
The CPU opponent pattern established in PR #121 (Checkers) and refined in subsequent PRs (Backgammon) is reusable:

- **Synthetic client:** `createSyntheticClient(CPU_OPPONENT_SESSION_ID)` — already exists
- **Turn scheduling:** `pendingCpuTurn` delayed callback — already exists
- **Action dispatching:** CPU actions routed through `processAction()` like human moves — already exists
- **Integration point:** `onTurnStarted()` in BaseGameRoom triggers `executeDoominosCpuTurn()` when it's the CPU's turn

**No new framework patterns needed.** Dominos fits the existing mold.

### 2. Move Selection Strategy

Dominoes CPU strategy differs from Checkers/Backgammon because:
- **Action space is ternary:** play (if possible) → draw → pass, vs. Checkers' binary (move or lose) or Backgammon's complex (roll/move/pass phases)
- **Decision criteria:** Prefer plays > draws > pass (blocking enemy) vs. Checkers' piece advancement or Backgammon's bearing off
- **Information asymmetry:** CPU knows all hands (via server memory); human knows only hand count and board state

**Strategy recommendation:**
```
selectCpuMove(state): CpuAction | null
  1. Check if playable tiles exist
     → If yes, score each and pick best
     → If no, check if boneyard has tiles
       → If yes, draw
       → If no, pass
  
  2. Play scoring (when tiles playable):
     - Prefer plays that reduce hand size (lead to domino/scoring)
     - Prefer plays on longer chains (reduce future draw risk)
     - Break ties: domino pip count (higher = better position)
     - Heuristic: score = (handSize reduction * 10) + (chainLength bonus) + (pip value bonus)

  3. Tie-breaking: When multiple tiles score equally, choose lowest tile ID (deterministic)
```

**Why this strategy is sound:**
- Dominos is about emptying your hand while opponents accumulate points. Reducing hand size = winning condition.
- Playing > drawing > passing avoids boneyard drain (draws exhaust tiles, passes block you).
- Simple heuristic avoids expensive minimax; game tree is already complex (4-player, hidden info).

### 3. Implementation Files

**New Files:**
- `server/src/games/dominos/CpuOpponent.ts` — Strategy module (100-150 LOC), exports `selectCpuMove(state): CpuAction | null`
- `server/src/games/dominos/__tests__/cpuOpponent.test.ts` — Unit tests (80-120 LOC)

**Modified Files:**
- `server/src/game/BaseGameRoom.ts`
  - Add import: `import { selectCpuMove } from "../games/dominos/CpuOpponent.js"`
  - Add method: `private async executeDoominosCpuTurn()` (mirror of `executeCheckersCtpuTurn()`)
  - Update router in `onTurnStarted()`: add branch for `gameType === "dominos"`
  
- `server/src/rooms/LobbyRoom.ts`
  - Update `shouldEnableCpuOpponent()` check: add `|| gameType === "dominos"` to the condition

**No Client/Shared Changes:** Dominoes renderer already renders synthetic players. Turn system treats CPU like any player.

### 4. Test Coverage

**Unit Tests (cpuOpponent.test.ts):**
- ✅ CPU selects valid plays when available
- ✅ CPU scores plays correctly (hand reduction priority)
- ✅ CPU draws when no plays, boneyard non-empty
- ✅ CPU passes when boneyard empty, no plays
- ✅ CPU breaks ties deterministically
- ✅ Edge case: all players passed (blocked round) — CPU still passes correctly

**E2E Tests:**
- Reuse existing E2E Dominos suite (PR #141, `e2e/dominos.spec.ts`)
- Add scenario: player vs. CPU (CPU moves automatically, human can observe)
- Validate: CPU doesn't cause hangs, game completes within timeout

### 5. Scope Boundaries

**In Scope (this PR):**
- Single CPU opponent (2-player Dominos vs CPU)
- Simple heuristic strategy (not game tree search)
- Framework integration (LobbyRoom + BaseGameRoom wiring)

**Out of Scope (future PRs):**
- Multi-CPU games (3–4 CPU players)
- Machine learning / minimax / Monte Carlo tree search
- Difficulty levels (easy/medium/hard)
- CPU for Risk or Poker (different action spaces)

---

## Decision Rationale

### Why not minimax or MCTS?
Dominos state space is large (hidden hands, stochastic draws). Minimax/MCTS would require:
- Full hand state + boneyard (expensive to copy/evaluate)
- Deep lookahead (4+ turns) → exponential branching
- Static evaluator (board value function) — domain-specific, hard to tune

**Result:** Simple heuristic (hand reduction) is faster, sufficient for casual play, easier to test & debug.

### Why not defer all CPU logic to LobbyRoom?
BaseGameRoom owns the turn loop and action dispatch. Putting CPU logic there keeps:
- Turn scheduling centralized (`onTurnStarted()` → `executeGame TypeCpuTurn()`)
- Action dispatch consistent (CPU uses `processAction()` like humans)
- Error handling unified (turn timeout handles CPU failures too)

### Why not use a callback/hook in the plugin?
The plugin system owns actions, not turns. Turn management is a room responsibility. Keeping CPU in BaseGameRoom avoids plugin inflation (each game would need `onCpuTurn()` hook).

---

## Success Criteria

1. ✅ CPU opponent joinable in lobby (checkbox "Play vs CPU")
2. ✅ CPU takes turns automatically (~200ms delay)
3. ✅ CPU never takes invalid actions
4. ✅ CPU avoids draw/pass when plays exist
5. ✅ Game completes (no hangs, CPU doesn't time out)
6. ✅ Tests pass (unit + E2E)
7. ✅ No regressions in 2-player human or existing games

---

## Next Steps

1. **Pemulis:** Implement `CpuOpponent.ts` + `executeDoominosCpuTurn()` + LobbyRoom integration
2. **Steeply:** Implement unit tests + add E2E scenario
3. **Hal:** Review PR for code quality, strategy soundness, test coverage
4. **Merge:** Squash into dev branch (clear commit message referencing #163)
5. **Future:** Gather player feedback on CPU difficulty; iterate on strategy if needed

---

## Related Decisions

- PR #121: CPU opponents for Checkers (framework pattern)
- PR #166: Backgammon CPU extension (multi-phase CPU strategy)
- `decisions.md` → "Pemulis: CPU Opponent Architecture" (synth client, turn scheduling)

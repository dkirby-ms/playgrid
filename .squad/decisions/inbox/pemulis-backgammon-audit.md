# Backgammon Rules Audit — Findings

**Author:** Pemulis (Systems Dev)  
**Date:** 2026-03-21  
**Requested by:** dkirby-ms  
**Scope:** Bar/hitting mechanics, move direction, bear-off logic

---

## 🔴 BUG 1: Bear-off with over-roll selects wrong checker (GAME-BREAKING)

**Location:** `server/src/games/backgammon/backgammonLogic.ts`, `isValidMove()` lines 148–170

**The rule:** When a player rolls a die higher than the distance of any remaining checker, they must bear off the checker **farthest from the edge** (highest-numbered point in player's home board notation). This only applies when the exact point is unoccupied AND no checkers exist on any point farther from the edge.

**The bug:** The loop direction is inverted for both players. The code checks for pieces **closer to the edge** instead of **farther from the edge**.

- **Black (lines 155–157):** Checks `fromPoint + 1` to `23` (closer to edge). Should check `18` to `fromPoint - 1` (farther from edge).
- **Red (lines 166–168):** Checks `0` to `fromPoint - 1` (closer to edge). Should check `fromPoint + 1` to `5` (farther from edge).

**Impact:** In the endgame bear-off phase:
1. Players CAN bear off from the **wrong** point (closest to edge) — invalid moves accepted.
2. Players CANNOT bear off from the **correct** point (farthest from edge) when closer pieces also exist — valid moves rejected.

**Example:** Black has pieces on points 19 and 22 (5-point and 2-point). Rolls a 6 (exact = point 18, empty). Code allows bearing off from 22 (2-point) but blocks from 19 (5-point). Real backgammon requires bearing off from 19 (the farthest piece).

**Test impact:** Existing tests at `server/src/__tests__/backgammon.test.ts` lines 370–376 and 887–904 validate incorrect behavior. The test "allows bearing off with higher die when no higher pieces for Black" sets up pieces on 18, 19, 20 and asserts bearing off from 20 with die=6 is valid — but point 18 (exact match for die=6) has pieces, so this should use exact match instead.

**Severity:** Game-breaking. Affects every game that reaches the bear-off phase with non-trivial positions.

---

## 🟡 BUG 2: No "must use larger die" enforcement (MEDIUM)

**Location:** `server/src/games/backgammon/BackgammonPlugin.ts`, `move` action handler lines 340–358

**The rule:** When a player can only use one of two dice (not both), they must use the **larger** die.

**The bug:** The code lets the player freely choose either die. After using one die, it checks if the other can still be used — if not, the turn ends. But it never enforces that the larger die must be preferred when only one can be used.

**Example:** Dice are 4 and 6. Player can only use one (using either makes the other impossible). Real backgammon requires using the 6. Code allows using the 4.

**Severity:** Medium. Rarely triggers but is a real rules violation that could affect game outcomes.

---

## 🟢 OBSERVATION: No opening roll (LOW / Design Choice)

**Location:** `BackgammonPlugin.ts` `onGameStart`, `turnConfig`

Real backgammon determines who goes first by each player rolling one die; the higher roll wins and both dice are used for the first move. The implementation uses round-robin from player index 0. This is a common simplification in online backgammon.

---

## ✅ Correctly Implemented

### Bar / Hitting Mechanics — ALL CORRECT
- **Schema:** `blackBar` and `redBar` fields exist on `BackgammonState` (`shared/src/games/backgammon/BackgammonState.ts` lines 10–11)
- **Blot landing:** `isValidMove` allows landing on single opponent piece (`destPieces < -1` / `> 1` checks at lines 129–131, 189–191)
- **Capture:** `applyMove` captures blots correctly (lines 244–249: sets point to player color, increments opponent bar)
- **Must enter from bar:** Enforced at `isValidMove` line 117 (`barCount > 0 && from !== "bar"`)
- **Re-entry points:** Black enters points 0–5 (`die - 1`), Red enters points 18–23 (`24 - die`) — correct opponent home boards
- **Blocked entry:** Can't enter on 2+ opponent pieces (lines 130–131)
- **hasValidMoves:** Correctly checks bar entry first and returns false if can't enter (lines 297–305)
- **Bar entry with capture:** Entering from bar can also hit a blot — `applyMove` handles this case

### Move Direction — CORRECT
- Black moves 0→23 (`fromPoint + die`, line 185) ✓
- Red moves 23→0 (`fromPoint - die`, line 185) ✓

### Board Setup — CORRECT (Standard opening position)
- Black: 2@0, 5@11, 3@16, 5@18 (lines 32–35) ✓
- Red: 2@23, 5@12, 3@7, 5@5 (lines 38–41) ✓

### Home Boards — CORRECT
- Black: 18–23 (`canBearOff` line 87) ✓
- Red: 0–5 (`canBearOff` line 92) ✓

### Bearing Off (Exact Match) — CORRECT
- Black: `exactPoint = 24 - die` (line 149) ✓
- Red: `exactPoint = die - 1` (line 160) ✓

### Doubles — CORRECT
- 4 moves tracked via `doublesMovesUsed` counter ✓

### Turn Management — CORRECT
- Roll → move(s) → auto-end-turn when no moves remain ✓
- Pass only allowed when truly no valid moves ✓

### Win Condition — CORRECT
- 15 pieces borne off wins ✓

---

## Recommended Fix Priority

1. **Bear-off loop direction** — Fix immediately. Game-breaking.
2. **Larger die enforcement** — Fix soon. Rules violation that affects fairness.
3. **Opening roll** — Optional enhancement. Many online implementations skip this.

## Not Implemented (By Design)
- Doubling cube
- Gammons / backgammons (double/triple victory scoring)
- Crawford rule (tournament play)

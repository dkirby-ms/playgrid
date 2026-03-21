# Decision: Backgammon Bear-off & Larger-Die Fixes

**Author:** Pemulis (Systems Dev)  
**Date:** 2026-03-21  
**Status:** Implemented

---

## Fix 1: Bear-off over-roll loop direction

**Problem:** `isValidMove()` checked pieces in the wrong direction when validating over-roll bear-offs. The loop searched toward the board edge (closer pieces) instead of away from it (farther pieces). This allowed bearing off wrong checkers in every endgame.

**Fix:** Reversed both loops:
- Black: now checks points 18 through `fromPoint-1` (farther from edge)
- Red: now checks points `fromPoint+1` through 5 (farther from edge)

**Impact:** Game-breaking bug fixed. All bear-off endgames now follow correct backgammon rules.

## Fix 2: Must-use-larger-die rule

**Problem:** When a player could only use one of two different dice (using either blocks the other), backgammon rules require using the larger die. No enforcement existed.

**Fix:** Added `canPlayBothDice()` to `backgammonLogic.ts` that enumerates all possible first-moves with each die and checks if the other die has any follow-up. When both dice are individually playable but no sequence allows both, `validateAction()` rejects moves using the smaller die.

**Design decision:** The check runs in `validateAction` (pre-move validation) rather than post-move, so invalid moves are rejected before state mutation. The `canPlayBothDice` helper lives in the logic layer alongside other pure functions.

**Impact:** Medium severity rules violation fixed. Applies only to non-doubles with two available dice where sequencing is impossible.

## Test changes

- 3 existing tests updated (validated wrong bear-off behavior)
- 2 existing tests updated (used smaller die in must-use-larger scenarios)
- 12 new tests added (6 bear-off, 6 larger-die)
- All 773 tests pass

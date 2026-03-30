# SKILL: CPU Opponent Pattern

**Category:** Game Systems  
**Games using:** Checkers, Backgammon, Dominos

## Pattern

Adding CPU opponents to a new game requires exactly 4 touchpoints:

### 1. Create `server/src/games/{game}/CpuOpponent.ts`

Export a single decision function:
- **Single-action games** (Checkers): `selectCpuMove(state): CpuMove | null`
- **Multi-action games** (Backgammon, Dominos): `selectCpuAction(state): CpuAction | null`

The function reads game state + player hand, scores all legal moves via heuristics, returns the best one. Return `null` when no action is possible (triggers turn timeout).

### 2. Wire into `BaseGameRoom.ts`

```typescript
// a) Import the selector
import { selectCpuAction as selectFooCpuAction } from "../games/foo/CpuOpponent.js";

// b) Add game type to cpuOpponentEnabled gate (onCreate)
this.cpuOpponentEnabled = options.cpuOpponent === true
  && (gameType === "checkers" || gameType === "backgammon" || gameType === "dominos" || gameType === "foo");

// c) Add routing in executeCpuTurn()
if (this.plugin.id === "foo") {
  await this.executeFooCpuTurn();
  return;
}

// d) Add executor method (follow backgammon pattern for multi-action, checkers for single-action)
private async executeFooCpuTurn() { ... }
```

### 3. Widen `LobbyRoom.shouldEnableCpuOpponent()`

Add the game type string to the gate check.

### 4. Add tests in `server/src/games/{game}/__tests__/cpuOpponent.test.ts`

Follow the `vi.mock("@eschaton/shared")` pattern. Test:
- null returns (missing player, empty hand)
- Action selection (play/draw/pass or move)
- Heuristic priorities (captures, doubles, high-pip, etc.)
- Edge cases (perpendicular arms, empty boneyard, etc.)

## Key Details

- CPU session ID: `"cpu-opponent"` (constant in BaseGameRoom)
- CPU turn delay: 200ms via `clock.setTimeout`
- Multi-action turns (where actions don't end the turn): `queueCpuTurnIfNeeded()` re-fires after each non-ending action
- Synthetic client: `createSyntheticClient()` produces a no-op Client for `processAction()`
- No client changes needed — CPU uses the same action pipeline as human players

## Scoring Convention

All CPU opponents use a priority-weighted scoring model:
- Define named constants for each scoring factor (e.g., `CAPTURE_PRIORITY = 1_000`)
- Score each legal move, pick the highest
- Add a deterministic `breaksTie()` function for reproducibility

# Decision: Game plugins must auto-transition at phase boundaries

**Author:** Gately  
**Date:** 2026-03-16  
**Context:** Risk setup phase deadlock (PR #144)

## Decision

When a game plugin's action completes a per-player requirement during a round-robin phase (e.g., `armiesToPlace === 0`), the action itself must check the global completion condition and trigger the phase transition. Do not rely on a separate explicit action (like `endPhase`) to transition — the current player may have no valid moves to invoke it.

## Rationale

The Risk setup phase deadlocked because `placeArmy` ended the player's turn but only `endPhase` checked if all players were done. After the last player placed armies, the turn wrapped to an already-finished player who couldn't act. The game was permanently stuck.

## Applies to

All game plugins with multi-player setup or draft phases. Currently: Risk. Future games should follow this pattern.

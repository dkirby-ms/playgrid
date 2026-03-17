# Decision: Risk Territory Drafting Phase

**Author:** Gately  
**Date:** 2026-03-17  
**Status:** Implemented  

## Context

Risk previously auto-dealt all 42 territories to players at game start (round-robin shuffle). This was documented as a "Phase 1 Limitation."

## Decision

Replaced auto-deal with a proper territory drafting phase (`setup-pick`):

1. Game starts with all territories unclaimed
2. Players take turns picking one unclaimed territory at a time (round-robin via `endsTurn: true`)
3. When all 42 territories are claimed, transitions to `setup-place` for remaining army placement
4. Army allotment is `initialArmies - territoriesOwned` (same formula, now applied after draft instead of auto-deal)

## Impact

- **Server**: New `pickTerritory` action in `RiskPlugin.ts`. `onGameStart` simplified (no shuffle). `validateAction` updated.
- **Client**: `RiskRenderer.ts` sends `pickTerritory` during `setup-pick` (previously sent `placeArmy`). No rendering changes needed — unclaimed territories already show neutral colors.
- **Shared**: No changes needed — `setup-pick` type and state fields already existed.
- **Tests**: 7 new drafting tests added, 4 integration tests updated. 299/299 pass.

## Rationale

Drafting adds strategic depth — players choose territories rather than receiving random assignments. This is how standard Risk rules work.

# Decision: Dev Sandbox Architecture

**Date:** 2026-03-16  
**Agent:** gately  
**Status:** Implemented (PR #132)

## Context

Hal greenlit the dev sandbox MVP for testing game renderers without server connection. Need a way to mount renderers with mock state and tweak state live.

## Decision

Built the sandbox with these architectural choices:

1. **Mock state = plain JS objects** (NOT Colyseus Schema instances)
   - Renderers use optional chaining → plain objects with matching shape work
   - Pass `room: undefined` in GameRendererContext

2. **HTML overlay for state controls** (not PixiJS UI)
   - Cleaner separation: PixiJS for game, HTML for dev tools
   - Easier to build/maintain form controls

3. **Route detection in Application.ts**
   - Check for `/sandbox/{game}` patterns (hash or path)
   - Bypass lobby connection entirely in sandbox mode

4. **Per-game control complexity:**
   - Checkers: Full visual board editor (click cells to cycle pieces)
   - Backgammon/Risk: JSON textarea (MVP — sufficient for dev testing)

## Alternatives Considered

- Schema-based mock state → Rejected: Too complex, defeats purpose of "quick testing"
- PixiJS UI for controls → Rejected: HTML forms are faster to build
- Server-side mock mode → Rejected: Defeats "no server" goal

## Impact

- **Zero production impact** — All new files, minimal routing changes
- **Dev workflow** — Renderer testing without server/lobby flow
- **Future expansion** — Can add more sophisticated controls per game

## Files

- `client/src/scenes/SandboxScene.ts`
- `client/src/sandbox/mockStates.ts`
- `client/src/sandbox/SandboxStatePanel.ts`
- `client/src/Application.ts` (route detection only)

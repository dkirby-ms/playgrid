# PR #132 Review Decision

**Date:** 2026-03-16  
**Reviewer:** Hal (Lead)  
**Branch:** origin/squad/sandbox-dev-tool  
**Author:** Gately  
**Status:** APPROVED ✅

---

## Summary

PR #132 implements the Game Dev Sandbox feature (Issue #130) — a development-only tool for rendering game boards with mock state, independent of server connection. The sandbox provides live state editing via an HTML overlay panel, enabling rapid renderer prototyping and debugging.

**Verdict:** Code is clean, architecture is sound, all validation checks pass. Ready to merge.

---

## Review Checklist

### 1. Architecture Compliance

**Scope Doc:** `.squad/decisions/inbox/hal-sandbox-scope.md`

- ✅ SandboxScene implemented as a full Scene (isolated from existing scenes)
- ✅ Route detection in Application.ts for `/sandbox/{game}` patterns (hash or path)
- ✅ HTML overlay panel (not PixiJS) for state controls — clean separation
- ✅ All sandbox code in separate files:
  - `client/src/scenes/SandboxScene.ts`
  - `client/src/sandbox/mockStates.ts`
  - `client/src/sandbox/SandboxStatePanel.ts`
  - Minimal changes to `Application.ts` (route detection only)
- ✅ No server-side changes
- ✅ No pollution of production scenes

### 2. Type Safety

- ✅ Renderers already use optional chaining (`state?.board`, `state?.territories?.get()`, `state?.players?.entries()`)
  - Verified: CheckersRenderer, BackgammonRenderer, RiskRenderer
- ✅ Mock state interfaces define all fields matching actual game schemas
- ✅ GameRendererContext.room passed as `undefined` — renderers handle gracefully
- ✅ No unsafe casts; proper `as` typing with guards
- ✅ No Colyseus Schema dependency in sandbox code

### 3. State Mutation Model

- ✅ Mock state uses plain JavaScript objects (not Schema instances)
- ✅ Mutations are local to browser only (no network)
- ✅ StatePanel re-renders via `renderer.onStateChange(newState)` after mutation
- ✅ No server validation or game logic execution

### 4. Memory Leaks

- ✅ SandboxStatePanel.destroy() removes DOM element and nulls callback
- ✅ SandboxScene.cleanup() properly nulls references:
  - `statePanel?.destroy()` + `this.statePanel = null`
  - `this.container.removeChild(this.renderer.container)` before null
  - `this.renderer.destroy()` + `this.renderer = null`
  - `this.currentState = null`
- ✅ cleanup() called on `onExit()`
- ✅ Event listeners are removed (click handlers recreated on each render)

### 5. Build Validation

```
npm run build — ✅ PASS (778 modules, 2.05s)
npm run lint  — ✅ PASS (0 new errors, pre-existing warnings only)
npm run test  — ✅ PASS (289 passed, 12 todo)
```

### 6. No Secrets

- ✅ No API keys, tokens, or credentials
- ✅ No hardcoded sensitive data
- ✅ Safe HTML generation (no XSS vectors)

### 7. Renderer Compatibility

**State Shapes (Plain JS Objects):**

- **Checkers:** `{ board: number[], mustCaptureFrom: number, phase, currentTurn, players, turnTimeRemaining }`
- **Backgammon:** `{ points: number[], blackBar, redBar, blackBorneOff, redBorneOff, dice, usedDice, phase, currentTurn, players, turnTimeRemaining }`
- **Risk:** `{ territories: Map<id, {owner, armyCount}>, riskPlayers: Map<...>, turnPhase, gamePhase, phase, currentTurn, players, turnTimeRemaining }`

All renderers already accept `unknown` type and safely access via optional chaining.

**Per-Game Controls:**

- **Checkers:** Full visual board editor (click cells to cycle: empty → black → red → black_king → red_king) + mustCaptureFrom input
- **Backgammon:** JSON textarea for state editing (points, bar, borne-off, dice)
- **Risk:** JSON textarea for state editing (territories, phases)

### 8. Sandbox Isolation

- ✅ `client/src/sandbox/SandboxStatePanel.ts` — new, only imported by SandboxScene
- ✅ `client/src/sandbox/mockStates.ts` — new, only imported by SandboxScene
- ✅ `client/src/scenes/SandboxScene.ts` — new, implements Scene interface
- ✅ `client/src/Application.ts` — minimal route detection logic, no game logic polluted
- ✅ No imports from production code into sandbox
- ✅ No cross-references in existing game scenes

### 9. Code Quality

**Strengths:**
1. Clean separation: PixiJS rendering + HTML dev tool UI
2. SandboxScene properly implements Scene interface
3. Clear error handling for missing gameType or renderer
4. Proper initialization order in `onEnter()`
5. MockCheckersState / MockBackgammonState / MockRiskState interfaces well-defined
6. TypeScript strict mode compliance
7. No console spam or debug code

**Process Quality:**
- Gately's decision doc (`gately-sandbox.md`) clearly documents architectural choices and alternatives
- Scope and MVP compliance demonstrated
- No unnecessary features added; adheres to "throwaway dev tool" philosophy

---

## Risks Assessed

| Risk | Likelihood | Impact | Status |
|------|-----------|--------|--------|
| Renderer breaks on plain JS objects | **Very Low** | Medium | ✅ Mitigated: Optional chaining verified in all 3 renderers |
| Memory leak on repeated sandbox visits | **Low** | Medium | ✅ Mitigated: cleanup() nulls all references, called on onExit() |
| Sandbox pollutes prod build | **Very Low** | High | ✅ Mitigated: All new files, route is opt-in, no production imports |
| Type safety on room:undefined | **Low** | Low | ✅ Mitigated: Renderers already handle null room gracefully |

---

## Success Criteria (from Scope Doc)

- ✅ User can navigate to `/sandbox/checkers` and see rendered board
- ✅ User can drag pieces (input passthrough works) — SandboxScene passes container to renderer
- ✅ User can tweak state via panel, board re-renders — StatePanel onChange callback triggers onStateChange
- ✅ No errors in console — Error handling clean, console.error only on actual failures
- ✅ No regression to existing scenes — Isolated code, no changes to GameScene/LobbyScene/WaitingScene
- ✅ All 3 games have working sandbox — Checkers (full editor), Backgammon (JSON), Risk (JSON)

---

## Approval

**✅ APPROVED FOR MERGE**

Code is clean, architecture is sound, follows scoping decision exactly. All validation checks pass (build, lint, test). Zero risk to production. Ready to merge to `dev`.

**Next Steps:**
1. Merge origin/squad/sandbox-dev-tool → dev
2. Close Issue #130
3. Archive scoping decision to `.squad/decisions-archive.md`

---

## Learning

**Optional Chaining Adoption Pattern:** Playgrid renderers were designed to accept `unknown` state and safely access via optional chaining. This foresight enables the sandbox to pass plain JS objects without any renderer changes. Sign of good forward-thinking architecture.

**HTML Overlay for Dev Tools:** Choosing HTML/CSS forms over PixiJS UI was pragmatic. Dev tools prioritize implementation speed over polish. Can always add fancy UI later if needed.

**Scene Isolation:** Treating sandbox as a full Scene (not a modal overlay) avoided layering complexity and state management baggage. Clean in, clean out.

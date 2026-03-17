# Triage: New Game Requests #107 & #124 (2026-03-16)

**Triaged by:** Hal (Lead)  
**Date:** 2026-03-16T22:40:00Z

## Issue #107 — Game Request: Scrabble

**Status:** Requires Clarification  
**Assigned to:** —  
**Labels:** `enhancement`, `squad`  
**Action Taken:** Added triage comment requesting clarification

### Assessment

The issue is severely under-scoped. Submission contains only the word "Scrabble" in all three template fields.

**Why this blocks work:**
- No variant specified (tournament, simplified, speed play?)
- No clarity on player count (2-4? 2-only?)
- No dictionary strategy (hardcoded list, external API, server-side validation?)
- No rendering constraints specified (board layout, tile animations, etc.)
- Word validation is a critical blocker: Dictionary lookups impact client/server architecture

**Recommendation:** Request clarification on:
1. Game rules/variant scope
2. Player count bounds
3. Dictionary/word validation approach
4. MVP vs. stretch goals
5. Any rendering/UX preferences

**Next assignee:** Once clarified, route to Pemulis (game logic) + Gately (rendering).

---

## Issue #124 — New Game: Dominos

**Status:** Ready for Work  
**Assigned to:** Pemulis (systems), Gately (rendering)  
**Labels:** `enhancement`, `squad`, `squad:pemulis`, `squad:gately`  
**Complexity:** Large (L)  
**Blocked on:** Core infrastructure stability (Checkers and Backgammon must be stable — both merged to dev)

### Assessment

Issue is well-defined and immediately actionable. Follows proven plugin architecture pattern (Checkers, Backgammon, Risk).

**Why this is ready:**
- Clear game rules (double-six domino set, 2–4 players, boneyard draw, scoring)
- Explicit plugin architecture requirements (server: `IGamePlugin`, shared: Colyseus `Schema`, client: `GameRenderer`)
- Multiplayer requirements aligned with existing patterns (reconnection, spectators, room state)
- No external dependencies (no word validation, no external services)

**Estimated Scope:**
- **Server plugin:** ~300–400 lines (game state, player actions, turn logic, scoring)
- **Shared schema:** ~100–150 lines (tiles, boneyard, player hands, board state)
- **Client renderer:** ~400–600 lines (board layout, tile animations, hand display, interactive placement)
- **E2E tests:** ~200–300 lines (pattern reused from Checkers tests)

**Total: ~1000–1500 lines** → Same class as Checkers; Large (L) estimate appropriate.

### Dependency Chain

1. **Infrastructure must be stable:**
   - Checkers and Backgammon plugins merged and tested ✅
   - Reconnection system live (Pemulis, merged PR #61) ✅
   - E2E test pattern established (Steeply, grey-box approach) ✅

2. **Can start immediately after Wave 4 is complete** (no other blockers)

### Execution Plan

**Phase 1 (Pemulis):**
- Draft Dominos server plugin (`server/src/games/dominos/index.ts`)
- Define shared state schema (`shared/src/games/dominos/DominosSchema.ts`)
- Implement game logic (tile draw, play validation, scoring)
- Expose move handler for client interaction

**Phase 2 (Gately):**
- Create client renderer (`client/src/renderers/DominosRenderer.ts`)
- Implement board layout (domino placement, boneyard visualization)
- Tile animations and hand management UI
- Integrate with GameRenderer interface

**Phase 3 (Steeply):**
- Add E2E tests (pattern: `e2e/dominos.test.ts`)
- Grey-box approach: Assert on server game state, not pixel output
- Cover: tile draw, play validation, round transitions, multiplayer moves, reconnection

---

## Triage Summary

| Issue | Complexity | Status | Assigned | Labels |
|-------|-----------|--------|----------|--------|
| #107 (Scrabble) | TBD | Needs Clarification | — | `enhancement`, `squad` |
| #124 (Dominos) | Large (L) | Ready for Work | Pemulis + Gately | `enhancement`, `squad`, `squad:pemulis`, `squad:gately` |

**Next Steps:**
1. **#107:** Wait for author to clarify scope and approach
2. **#124:** Schedule for Pemulis + Gately after Wave 4 PM review/merge complete (likely 2026-03-17 or later)

---

## Decision: Game Request Triage Gate

**Policy:** All new game requests must include:
- Game rules summary (or reference to published rules)
- Player count bounds
- Complexity indicators (turn timer, randomness, hidden information, etc.)
- Any rendering/external service dependencies

**Rationale:** Templates should guide clarity. Scrabble's vague submission cost triage time; next requests should self-screen through template completion.

**Action:** Joelle (DevRel) may want to review issue templates (`docs/ISSUE_TEMPLATES/feature-request.yml`) and add game-request-specific guidance.

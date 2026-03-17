### Gately: UX Redesign — Lobby + Dominos Renderer (Figma Match)

**Status:** Proposed  
**Date:** 2026-03-17  
**Branch:** `squad/ux-redesign-lobby-dominos`

Migrate lobby and Dominos renderer visual styling to match the new Figma export at `docs/designs/playgrid-ux/`. Lobby shifts from zinc/violet palette to dark slate/blue; Dominos gains an emerald green board surface and new sidebar panels.

**Rationale:**
- Design-first workflow: Figma → React export → convert to live implementation
- Dark slate palette (slate-950/900/800) feels more polished than the prior zinc-only background
- Blue accents for game tiles, buttons, and avatars align with the Figma design language
- Emerald board surface for Dominos makes the playing area visually distinct from the dark chrome
- "How to Play" sidebar panel improves onboarding for new players

**Implementation:**
- `client/index.html`: CSS color values migrated from zinc/violet to slate/blue across lobby dashboard, header, game tiles, sidebar panels, active game cards, online players, filter buttons
- `client/src/ui/LobbyScreen.ts`: Added Dominos to `GAME_TYPE_OPTIONS` (2-4 players) and `GAME_TILE_ARTWORK`
- `client/src/renderers/DominosRenderer.ts`: Added emerald board background, "How to Play" sidebar panel, renamed "Game Info" → "Game Status", updated empty board text
- `client/src/renderers/DesignTokens.ts`: Added `EMERALD_800`, `EMERALD_900` tokens

**Impact:**
- Visual-only changes: No game logic, state management, or networking modified
- All existing Colyseus integration (room listing, creation, joining, player sync) preserved
- Dominos now appears in the lobby game type selector

**Files Modified:**
- client/index.html
- client/src/ui/LobbyScreen.ts
- client/src/renderers/DominosRenderer.ts
- client/src/renderers/DesignTokens.ts

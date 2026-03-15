# gately — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Core Context (2026-03-14 Research Phase)

**Client architecture:** Plugin-based renderers per game (GameRenderer interface + RendererRegistry). Scene management system (Lobby, Waiting Room, Game scenes with enter/exit/update/resize lifecycle). Hybrid UI: HTML/CSS for menus, PixiJS for games. Server-authoritative state; client sends input intents only.

**Rendering by game:** Simple (Checkers, Backgammon, Dominoes via Graphics API), Medium (card games with sprite sheets), Complex (Risk with pan/zoom map SVG). Lazy-load assets per game.

**Spectator mode:** Hidden-info games show public board + hand viewer. Public games show full state read-only. Perspective selector for cards.

**Responsive design:** PixiJS viewport scales/centers. Touch as pointer events. Mobile: 44px+ hit areas, overlay controls.

**Connection lifecycle:** Reconnect with 5-attempt exponential backoff. 30s seat reservation on disconnect. Reconnecting overlay with countdown.

**Infrastructure:** Scene.ts contract, SceneManager for transitions, GameRenderer + RendererRegistry, refactored Application.ts bootstrap.

**Phase 1 Games Completed (2026-03-14):**
- Checkers: Full game loop, state sync, click-to-move interaction, endgame overlay, player count locks
- Backgammon: Game plugin, renderer, state filtering, in-game HUD overlay
- Lobby dashboard: Game type tiles, active session card display, responsive grid layout

**Cross-agent alignment:** Pemulis (server plugin system), Hal (architecture lead), Marathe (PostgreSQL setup). Issue templates + CONTRIBUTING guide available (Joelle).

**Build Status:** All Phase 1 work passed tests, lint, and build.

---

## Learnings

### 2026-03-15: Client reconnect session resilience

- Added `client/src/ui/ReconnectOverlay.ts` plus `#reconnect-overlay` styles in `client/index.html` so game disconnects show reconnecting, reconnected, and return-to-lobby states without touching the Pixi render loop.
- `client/src/Application.ts` now owns active-game session persistence through `sessionStorage` key `playgrid.active-session`, storing `room.reconnectionToken`, `room.roomId`, `gameType`, and a timestamp whenever a game room join or reconnect succeeds.
- Startup recovery now happens before any fresh lobby join: `Application.ts` attempts `ConnectionManager.reconnect()` if the saved session is younger than 30 seconds, then falls back to `connectToLobby()` only after clearing stale reconnect state.
- Active game room lifecycle should bind `room.onDrop`, `room.onReconnect`, `room.onLeave`, and the `game-end` message together: keep reconnect state during drops, refresh it after reconnect, clear it on consented leave or natural game end, and return through `connectToLobby()` when a restored session has no live lobby room.
- Key paths for this flow: `client/src/Application.ts`, `client/src/networking/ConnectionManager.ts`, `client/src/ui/ReconnectOverlay.ts`, and `client/index.html`.

---

## 2026-03-15: Session Resilience — Client-Side Reconnection Implementation

**From:** Squad Scribe  
**Event:** Session completed — Client-side reconnect flow landed

**What Changed:**
- sessionStorage persistence under `playgrid.active-session`
- Startup reconnect attempt before fresh lobby boot
- ReconnectOverlay UI for drop/reconnect states
- State cleanup on consented leave, game-end, or failed restore

**Coordination Notes:**
- **Pemulis (Server):** Server-side 30s window + presence cleanup implemented in parallel
- **Steeply (Tester):** Server tests passing; client contracts as .todo() stubs ready for your seam availability

**What Pemulis Provided:**
- onPlayerReconnect hook wired for future turn timer integration
- Presence topic stable for lobby cleanup
- 30s reconnection window operational server-side

**Status:** ✅ Build + lint pass. End-to-end refresh recovery enabled within 30s window.

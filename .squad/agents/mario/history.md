# Mario — History

## Project Context

- **Project:** Playgrid — multiplayer board game platform
- **Owner:** dkirby-ms (saitcho)
- **Stack:** TypeScript, Colyseus (server), PixiJS (rendering), Vite (build)
- **Games:** Checkers, Risk, Backgammon (and more planned)
- **Key files:**
  - `client/src/renderers/` — game renderers (PixiJS Graphics API)
  - `client/src/ui/HUD.ts` — HTML overlay HUD panel for all games
  - `client/src/ui/LobbyScreen.ts` — lobby UI
  - `client/index.html` — main HTML + lobby CSS

## Learnings

### 2026-03-15: Onboarding context
- The HUD is an HTML DOM overlay (`position: absolute`) on top of the PixiJS canvas, not drawn in canvas
- HUD status panel was recently moved from top-left to top-right to avoid obscuring the game board
- Checkers board recently got enhanced styling: wood-textured frame, alternating dark square tones, edge shadows
- Checkers pieces just received 3D gradient treatment using PixiJS v8 `FillGradient` (radial gradients, drop shadows, specular highlights)
- The project uses PixiJS v8 (^8.0.0) with the Graphics API for all rendering — no sprite sheets or external textures yet
- Games share a common `GameRenderer` interface with `init()`, `resize()`, `redraw()`, and `getHUDStatus()` methods

### 2026-03-15: Checkers UX review
- `client/src/renderers/CheckersRenderer.ts` reserves fixed `TOP_HUD_SPACE`/`BOTTOM_HUD_SPACE` bands and centers the board inside the remaining area; on narrow screens the board becomes width-limited but still keeps the full reserved bands, which pushes play too far down the screen.
- `client/src/ui/HUD.ts` currently anchors both the shared status panel and the Leave Game button at `top: 16px; right: 16px`, so the button can overlap the panel unless the layout is reworked.
- Checkers intentionally splits responsibilities: the shared HTML HUD owns turn/status/player copy, while the renderer keeps board-local counters and its board-level game-over overlay.
- The current king marker is a centered `♛` text glyph in `client/src/renderers/CheckersRenderer.ts`; it reads as polished, but remains font-dependent and less legible than a shape-based marker.
- Key UX review paths: `client/src/renderers/CheckersRenderer.ts`, `client/src/ui/HUD.ts`, `client/index.html`, `.squad/decisions.md`.

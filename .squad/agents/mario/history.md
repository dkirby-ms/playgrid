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

### 2026-03-15: Redesign package UX analysis
- Design system is **dark-first with glass-morphism:** all panels use `backdrop-blur-sm` + `oklch()` color variables; consistent dark gradient background (`from-zinc-900 via-zinc-900 to-violet-950`) across all games.
- **Color scheme:** Primary dark `oklch(0.145 0 0)`, accent violet/purple `oklch(0.488 0.243 264.376)`, game-specific colors for player identification (red, blue, green, yellow, orange, purple).
- **Layout is responsive 3-col grid** (`lg:`): board takes `col-span-2`, sidebar `col-span-1`; stacks on mobile. Headers consistent across all games with back button + title + actions.
- **Game pieces use 3D glossy effect:** Radial gradients with white highlights (e.g., `bg-white/25 blur-sm` at top-left) to simulate sphere reflection; drop shadows for depth.
- **Turn indicators:** Animated pulse on status dot + colored badge (green/amber/red) showing "Your Turn" / "Waiting" / "Opponent's Turn."
- **Selection pattern:** Ring effect (`ring-4 ring-violet-400 ring-offset-2`) + scale transform (`scale-95` / `scale-110`) with smooth transition (`duration-200`).
- **Hover feedback:** Scale up (`hover:scale-105`), brighten (`hover:brightness-110`), shadow elevation (`hover:shadow-xl`) — all with animation.
- **Canvas vs. DOM split:** Keep headers, sidebars, text panels, buttons in DOM (accessibility + readability); render boards, pieces, gradients, animations in PixiJS canvas.
- **Animation library needed:** Tweenjs or similar for smooth piece movement, pulse effects, dice rolls, hippo mouth animation, and phase transitions.
- **Resource colors** (Catan, Scrabble, Risk) use dark saturated variants: green-800 (wood), red-900 (brick), yellow-700 (wheat), slate-700 (ore).
- **Glossy piece shine** is achieved via composite gradient: outer glow (blur + opacity), main piece (radial gradient), inner highlight (white/25 blur at top).
- Full analysis doc: `.squad/decisions/inbox/mario-redesign-ux-analysis.md`.

### 2026-03-15: Design system documentation created
- Created comprehensive `docs/design-system.md` with 12 sections covering color palette, glass-morphism patterns, typography, spacing, components, board styling, animations.
- **Color palette:** Extracted all Tailwind classes + hex equivalents (e.g., `bg-zinc-900` = `#0A0A0A`, `text-white` = `#FFFFFF`) for PixiJS rendering.
- **Material colors by type:** Neutrals (zinc), boards (stone/amber), pieces (red/black/white), status (green/amber/zinc), players (6 player colors).
- **Glass-morphism recipe:** `rounded-xl bg-zinc-800/50 backdrop-blur-sm` + optional border/padding for cards and panels.
- **Typography scale:** Base 16px, weights 400/500, 6 type sizes from 12px (tiny badges) to 24px (h1).
- **Spacing system:** 8/12/16/24px padding scale, gap sizes, responsive grid layouts (3-col lobby, 2-col game board, 4-col Risk map).
- **Component patterns:** 6 reusable patterns (game tile, status dot, player bar, phase banner, sidebar panel, active game card) with full code examples.
- **Board styling:** Frame gradients, square colors (light/dark), 3D piece glossy effect (outer glow + radial gradient + highlight), selection rings, hover effects.
- **Animations:** Default `transition-all duration-200`, scale transforms (hover/select), pulse for status, brightness & shadow elevation.
- **PixiJS guide:** Color hex mapping, gradient rendering with FillGradient, shadow/glow, ring/border, text styling.
- **Responsive breakpoints & accessibility:** WCAG AA contrast ratios, focus rings, button sizing for touch targets.

---

## 2026-03-16: Phase 4 Lobby + Sidebar CSS Redesign — Foundation Complete

**From:** Squad Scribe  
**Event:** Design system foundation and sidebar component architecture finalized

**Deliverables:**
- Dark zinc/violet theme implementation across lobby and sidebars
- Glass-morphism panel styling (backdrop blur, semi-transparent backgrounds)
- Responsive grid layout (3-col on desktop, stacked on mobile)
- Status indicator colors (green-500, amber-500, red-900 with alpha blending)
- Sidebar component architecture: `GameSidebar.ts` decoupled from `HUD.ts`

**CSS Patterns Established:**
- Dark gradient background: `from-zinc-900 via-zinc-900 to-violet-950`
- Card backgrounds: `bg-zinc-800/50 backdrop-blur-sm`
- Border hover effects: `border-zinc-700/50` → `border-violet-500/50`
- Text hierarchy: white primary, zinc-400 secondary, violet-400 accent
- Responsive padding: 8/12/16/24px scale with mobile overflow handling

**Cross-Agent Coordination:**
- Design tokens now available in DesignTokens.ts for Gately (Checkers, Backgammon, Risk renderers)
- Joelle updated README with tech stack reflecting this design foundation
- Marathe integrated release workflow with visibility of design work

**Related Files:**
- `client/src/ui/GameSidebar.ts` (new, sidebar component)
- `docs/design-system.md` (reference documentation)
- `client/src/renderers/DesignTokens.ts` (shared color system)

**Status:** Complete. Design foundation ready for game-specific sidebar customization.

---

## 2026-03-17: UX Gap Analysis — Figma vs. Live Implementation

**Session:** Concurrent with Gately (UX redesign) and Copilot (CI fix)

**Work Completed:**
- Comprehensive gap analysis comparing new Figma export to current live implementation
- Created docs/designs/playgrid-ux/GAP-ANALYSIS.md (canonical UX reference)
- Identified 5 major gap areas with priority sequencing

**Key Findings:**
1. Accent color shift: violet → blue across all interactive elements (most pervasive change)
2. Player info bars: New design introduces opponent/player bars above and below game board
3. Lobby overhaul: Game tiles become photo cards (7 types, up from 3), Active Games/Online Players get avatar-based card treatment
4. Dominos board: Emerald felt background replaces dark canvas
5. New games designed: Catan, Scrabble, Hungry Hippos (need implementation)

**Priority Roadmap:**
- **P0:** Lobby (entry point, game tiles, active games, online players, shared header)
- **P1:** Dominos alignment (green board, player bars, selection color, empty state)
- **P2:** Existing game refreshes (Checkers, Backgammon, Risk — player bars, colors, sidebar alignment)
- **P3:** New games (Catan, Scrabble, Hungry Hippos)

**Action Items:**
- Gately: Use GAP-ANALYSIS.md as implementation spec (started P0/P1)
- Team: Review accent color shift (violet → blue) impact on brand
- Team: Decide on Activity Feed presence in lobby (in current design, absent in new)

**User Directives Captured:**
- Universal design pipeline: Figma → React export → PixiJS conversion + shadcn for UI
- Iterative workflow: Design updates happen over time; renderers must incorporate changes
- Figma exports gitignored; reference-only, never committed

**Files Created:**
- docs/designs/playgrid-ux/GAP-ANALYSIS.md

**Impact:**
- Gately's UX redesign PR #143 informed by this analysis
- Design-first workflow now canonical for all future games
- Clear prioritization prevents scope creep


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

---

## Learnings

### 2026-03-17: Comprehensive Figma v1 Design Analysis

**Scope:** Full page-by-page + component-by-component comparison of `docs/designs/playgrid-v1/` (17 pages, 5 components) against live client.

**Key Findings:**
1. **Biggest gap is missing screens, not visual polish:** Design has 12 screens we lack entirely — Setup, History, and Victory for Checkers, Backgammon, and Risk; plus RiskCards.
2. **Player info bars are the highest-impact missing UI element:** Every game design has opponent info above the board and player info (with turn indicator) below. We have neither.
3. **Game header bar pattern:** All game pages share a consistent header with Back to Lobby button, game title, and action buttons (History, Results, Reset, Resign). We only have a Leave button in HUD.
4. **Setup screen flow differs from ours:** Design navigates from game tile → dedicated Setup page (configure rules, see players, ready up). We go tile → Create Modal → WaitingRoom. Different user flow.
5. **Activity Feed absent in new design:** Our current MessageLog panel in the lobby sidebar does not appear in the Figma design. Team decision needed on whether to keep it.
6. **Color palette confirmed:** Design uses `slate-*` (not `zinc-*`) with `blue-*` accents consistently. Confirms violet → blue shift.
7. **Scrabble and Catan designs complete:** Full game + setup page designs exist for both future games. Ready as implementation specs when needed.
8. **Risk has unique UI needs:** Phase banner (Deploy/Attack/Fortify), player legend below map, and a Cards management screen are all designed but not implemented.
9. **Dominos uses emerald felt background:** `from-emerald-800 to-emerald-900` board, plus DOM-based domino tile rendering with CSS pip positioning.

**Deliverable:** `.squad/decisions/inbox/mario-figma-design-analysis.md` — full comparison document with gap matrix, priority recommendations (P0-P3), and implementation roadmap.

**Priority Roadmap:**
- P0: Player info bars (all games)
- P1: Game header bar + Setup screens (Checkers, Backgammon, Risk)
- P2: Victory + History screens, Risk Cards
- P3: Game-specific enhancements (Risk phase banner, Dominos felt, palette alignment)
- Future: Scrabble + Catan implementation


---

## 2026-03-18: Figma Design Analysis Handed Off

**Event:** Mario's comprehensive design analysis complete. Hal reviewed the gaps and evaluated implementation approaches.

**Hal's Decision:** Option B (Extract Design System, Stay Vanilla TS) approved. Key rationale:
- Design export is visual reference, not drop-in code (>60% throwaway content)
- React adoption is separate architectural decision, not side effect of Figma export
- Real value is design system (colors, gradients, spacing, typography) → CSS tokens
- Stability of current working flows (reconnect, game-over) matters more than framework change

**Phases (2-3 weeks total):**
1. Extract design tokens → CSS
2. Lobby visual refresh
3. Game sidebar refresh
4. Setup screens (new vanilla TS)
5. Victory screens

**React revisit triggers:** vanilla DOM >8K lines, complex form needs, chat system, or second design iteration

**User preference:** Keep Activity Feed (design dropped it), use Setup page flow instead of Create Modal

**Impact for Mario:** Gap analysis now drives prioritized implementation plan. P0-P3 roadmap translates to phase sequence.


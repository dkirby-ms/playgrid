# Ortho — History

## Project Context

- **Project:** Playgrid — multiplayer board game platform
- **Stack:** TypeScript monorepo, Colyseus server, PixiJS client, shared types
- **Owner:** Dale Kirby (dkirby-ms)
- **Games:** Checkers, Backgammon, Risk, Dominos
- **My focus:** DOM UI layer — lobby, sidebar, setup screens, victory screens, player info bars

## Core Context

- Client uses PixiJS for game canvas + vanilla TypeScript DOM for overlays
- Design tokens extracted from Figma v1 in `client/src/ui/design-tokens.css` (slate/blue palette)
- Decision: No React adoption — stay vanilla TS for DOM layer
- Decision: Keep Activity Feed in lobby, use Setup pages instead of Create Game Modal
- Lobby reskinned with new design tokens (Phase 1+2 complete)
- P0 gap: Player info bars (opponent above, player below canvas) — missing from all 4 games
- SceneManager handles screen transitions
- `client/src/ui/LobbyScreen.ts` — lobby overlay
- `client/src/ui/GameSidebar.ts` — game sidebar
- `client/src/ui/HUD.ts` — game HUD
- Build: `npm run build` (shared → server → client)
- Lint: `npm run lint`
- Test: `npm test -- --run`

## Learnings

- **GameSidebar visual refresh (Phase 3):** Replaced all hardcoded `rgba()` values in `GameSidebar.ts` with design tokens from `design-tokens.css`. Key mappings: `rgba(255,255,255,0.08)` → `var(--border-light)`, `rgba(255,255,255,0.04)` → `var(--bg-card-dark)`, `rgba(126,207,255,*)` → `var(--accent-*)`, button gradients → `var(--gradient-button-primary/danger)`, note cards → `var(--notice-info-*)`. Added `font-family: var(--font-family)` to sidebar container, increased panel gap to `--space-lg` (1.5rem) to match Figma `space-y-6`, and added tablet breakpoint (768–1024px) for narrower sidebar. Panel headings bumped to `font-weight: 600` matching design. All existing DOM structure and `setPanelMarkup()` API preserved.
- **Pattern:** PlayerInfoBar and GameSidebar now both follow the same glass morphism token pattern: `var(--glass-bg)` background via `.glass-panel`, `var(--shadow-card)` shadows, `var(--border-light)` borders, `var(--bg-card-dark)` for inner cards.
- **Figma reference files:** `docs/designs/playgrid-v1/src/app/pages/{Game}Game.tsx` — sidebar uses `rounded-xl bg-slate-800/50 p-4 backdrop-blur-sm` panels, `space-y-6` gap, `text-lg text-white` headers, `text-sm text-slate-400` labels.
- **Setup Screens (Phase 4):** Built per-game setup screens replacing the inline Create Game modal. Architecture: `SetupScreen.ts` (shared base with glass-morphism two-column layout) + per-game config panels in `client/src/ui/setup/{Game}SetupConfig.ts` + `SetupScene.ts` (scene wrapper). Config panels use shared `configControls.ts` factories (option groups, toggles, steppers). Two modes: "create" (host configures before creating) and "waiting" (post-create player list + ready/start). The SetupScreen binds to the lobby room directly for `GAME_JOINED`, `GAME_PLAYERS`, `GAME_STARTED` messages. Both new game creation (tile click → setup) and joining existing games (Join btn → "waiting" mode) route through SetupScene. The old WaitingRoom.ts and WaitingRoomScene.ts are preserved for backward compatibility with e2e tests. LobbyEvent union type extended with `{ type: "setup"; gameType: string }`.
- **Key file paths for setup screens:** `client/src/ui/SetupScreen.ts`, `client/src/ui/setup/configControls.ts`, `client/src/ui/setup/{Checkers,Backgammon,Risk,Dominos}SetupConfig.ts`, `client/src/scenes/SetupScene.ts`. Overlay div `#setup-overlay` added to `client/index.html`.
- **Style injection pattern:** SetupScreen follows the same `injectStyles()` pattern as PlayerInfoBar — creates a `<style>` element with a unique ID, injects into `document.head`, uses CSS classes with design tokens exclusively.

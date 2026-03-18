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

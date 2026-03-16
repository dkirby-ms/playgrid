# Copilot Instructions — Playgrid

## Project Overview

Playgrid is a multiplayer board game platform. Players join a lobby, create or join game rooms, and play classic games (Checkers, Risk, Backgammon) in real time.

**Stack:** TypeScript monorepo (npm workspaces)
- `client/` — PixiJS rendering, Colyseus SDK, browser UI
- `server/` — Colyseus game server, room management, game plugins
- `shared/` — Shared types, state schemas, constants

## Architecture

- **Game Plugin System:** Each game implements `IGamePlugin` (see `server/src/game/BaseGameRoom.ts`). Game logic lives in plugin files under `server/src/games/{game}/`.
- **State Schemas:** Colyseus `Schema` classes in `shared/src/games/{game}/`. These are the source of truth for game state.
- **Renderers:** Each game has a `{Game}Renderer` in `client/src/renderers/` implementing the `GameRenderer` interface.
- **Lobby:** `LobbyRoom` (server) + `LobbyScreen` (client) handle room listing, creation, and joining.

## Code Style

- TypeScript strict mode (`"strict": true`)
- ESLint with `typescript-eslint` recommended rules
- No `any` — use proper types. Exception: test files allow `@typescript-eslint/no-explicit-any`
- Use `const` by default; `let` only when reassignment is needed
- Prefer early returns over nested conditionals
- Keep functions focused — single responsibility
- Only comment code that needs clarification; don't over-comment

## Validation Commands

Run these from the repo root to validate changes:

```bash
npm run build    # Builds shared → server → client
npm run lint     # ESLint across all workspaces
npm run test     # Vitest unit tests
```

All three must pass before considering work complete.

## Testing

- **Unit tests:** Vitest — files at `server/src/__tests__/` and co-located `*.test.ts`
- **E2E tests:** Playwright — `e2e/` directory, config at `playwright.config.ts` and `playwright.lobby.config.ts`
- When fixing a bug, add a regression test if feasible
- When adding a feature, add tests covering the happy path and key edge cases

## Code Review Checklist

When reviewing PRs, check for:

1. **Type safety** — No unsafe casts, proper null checks, optional chaining where state may be undefined
2. **Colyseus schema access** — Always use `?.` on MapSchema/ArraySchema `.get()` calls (schemas may not be synced yet)
3. **State mutation** — Game state must only be mutated server-side through the plugin system
4. **Memory leaks** — Event listeners must be cleaned up in `destroy()` / `onLeave()`
5. **Build passes** — `npm run build && npm run lint && npm run test` all green
6. **No secrets** — No API keys, tokens, or credentials in code

## Patterns to Follow

- **Optional chaining on Colyseus state:** `this.state.territories?.get(id)` not `this.state.territories.get(id)`
- **Game plugin lifecycle:** `onGameStart` → `onPlayerAction` → `onPlayerLeave` → `onGameEnd`
- **Reconnection support:** Players can reconnect within 30s. Don't delete player state on disconnect.
- **Spectator support:** Spectators join the same room with `isSpectator: true`

## Patterns to Avoid

- Don't import server code from client or vice versa — use `shared/` for common types
- Don't use `setTimeout`/`setInterval` for game timers — use Colyseus `clock`
- Don't modify `.squad/` files — those are managed by the squad coordinator

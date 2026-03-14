# hal — History

## Core Context

**Project:** playgrid — Play classic games with friends (Studio: eschaton-studio, Created: 2026-03-14)

**Architecture (Approved):**
- Plugin-based games (each game implements IGamePlugin interface)
- Integrated spectators (same GameRoom, isSpectator flag)
- Single LobbyRoom for all game types
- PostgreSQL from day one (not SQLite migration)
- 3-phase scaling: Phase 1 (single process), Phase 2 (multi-process 50+ concurrent), Phase 3 (multi-server)
- Colyseus 0.16, PixiJS 8, strict TypeScript
- Game implementation order: Checkers → Backgammon → Dominoes → Poker → Hearts/Spades → Chess → Risk

**Cloud Infrastructure (Approved):**
- Azure Container Apps (Consumption plan, Phase 1: single replica)
- PostgreSQL Flexible Server from day one
- GitHub Actions CI/CD (adapted from primal-grid reference)
- Phase 2: Redis for Colyseus RedisPresence, Static Web Apps for CDN
- Cost: Phase 1 ~$20-30/mo, Phase 2 ~$90-140/mo

**Current Codebase:**
- Server: Working LobbyRoom + skeleton GameRoom (tick-based, no game logic)
- Client: Monolithic index.ts (PixiJS app + HTML lobby/waiting overlays)
- Shared: Player/GameState schemas + lobby message types
- Monorepo with npm workspaces, vitest, TypeScript strict mode
- Lobby test suite: 431 lines (quality baseline)
- No Dockerfile, no CI/CD, no game plugin system yet

**Backlog (Approved - 38 items):**
- P0 (7): Env config, static serving, PostgreSQL connection, DB schema, Dockerfile, CI, lint
- P1 (16): Plugin system (4), Checkers logic (4), Client architecture (5), Renderer (3)
- P2 (15): Deployment pipelines, persistence, reconnection, spectators, second game, docs, monitoring

**Critical Path:** env-config → static-serving → shared-game-types → base-game-state → base-game-room → checkers-plugin → e2e-checkers

**Team Assignments:**
- Pemulis: 10 items (P0 + P1A server infra) — start with env-config
- Gately: 11 items (P1B–D game logic + client + renderers) — start with scene-manager
- Marathe: 5 items (CI/CD + Docker + Bicep) — start with ci-pipeline
- Steeply: 6 items (tests, blocked until code lands)
- Joelle: 2 items (docs, blocked on P1 stability)

---

## Session Logs

### 2026-03-14: Cross-Agent Architecture Alignment
- Pemulis: game-systems-design.md (TypeScript interfaces, per-game analysis, hidden-info architecture)
- Gately: client-architecture.md (scene management, renderer plugin system, asset requirements)
- Hal: Validated alignment across all three agents on plugin architecture, scaling strategy, game order
- User answer: PostgreSQL from day one (not SQLite migration), primal-grid as CI/CD reference

### 2026-03-14: Architecture Documents Updated
- Updated docs/architecture-plan.md with PostgreSQL decision, Azure Container Apps strategy (Section 2.1)
- game-systems-design.md and client-architecture.md validated (no updates needed)

### 2026-03-14T13:08:51Z: Backlog Decomposition
- Decomposed full project into 38 work items across P0/P1/P2
- Created docs/backlog.md with all items, dependencies, role assignments
- Key decisions: P0 infrastructure-only, GameRoom preservation, 3 parallel work streams
- All agents can now pick up work from backlog (no blockers identified)

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.


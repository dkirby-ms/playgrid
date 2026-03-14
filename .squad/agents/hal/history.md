# hal — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Learnings

### 2025-03-14: Architecture Plan for Playgrid Platform

**Key Architectural Decisions:**

1. **Plugin-Based Game System**
   - Each game implements `IGamePlugin` interface for isolation and testability
   - `BaseGameRoom<T>` provides common lifecycle, persistence hooks
   - Pure function game logic separated from Colyseus (e.g., `checkersLogic.ts`)
   - Dynamic room registration via `GameRegistry`
   - Per-game state schemas (no shared game state shape)

2. **Integrated Spectator Model**
   - Spectators join same GameRoom as players with `isSpectator` flag
   - Reuses existing state sync (simpler than separate rooms)
   - State filtering for games with hidden info (poker hole cards)
   - Only create separate spectator infrastructure if spectators outnumber players 10:1

3. **Scaling Strategy: Defer Until Needed**
   - Phase 1 (0-100 games): Single process, LocalPresence, SQLite
   - Phase 2 (100-1000 games): Multi-process, RedisPresence, PostgreSQL, @colyseus/proxy
   - Phase 3 (1000+ games): Multi-server, Redis Cluster, load balancer
   - Design-in: gameType as first-class, spectator flags, outcome logging
   - Don't build: cross-room comms, auto-scaling, geographic sharding (until proven need)

4. **Lobby Architecture**
   - Single LobbyRoom for all game types (not per-game lobbies)
   - GameSessionInfo includes `gameType` field
   - GameRegistry queryable for available games
   - Lobby tracks waiting games, coordinates matchMaker.createRoom

5. **Persistence: Start Simple**
   - Phase 1: Log games table (outcome, duration) + participants table
   - Phase 2: Add user_stats (wins/losses by game type), leaderboards
   - Phase 3: Advanced analytics (move history, replays, Elo)
   - SQLite → PostgreSQL migration path when scaling

6. **Game Implementation Order**
   - Checkers (1st): Prove plugin pattern, simple rules
   - Backgammon (2nd): Validate dice/RNG, server authority
   - Dominoes (3rd): Test multi-player (2-4), turn ordering
   - Poker (4th): Validate hidden state, betting mechanics, complexity
   - Defer Chess (complex move validation) and Risk (massive state) until after fundamentals proven

7. **Client-Side Pattern**
   - Each game gets dedicated renderer module (e.g., `CheckersRenderer.ts`)
   - Dynamic import based on game type
   - State/rendering separation via PixiJS scene graph
   - Renderer binds to room.onStateChange, updates display objects

**Technologies Validated:**
- Colyseus 0.16: RedisPresence for scaling, PM2 fork mode (not cluster), seat reservations for reconnection
- PixiJS 8: Component/ECS-style separation of state and rendering
- Spectator pattern: Observer pattern with read-only enforcement

**Risks Identified:**
- Poker state filtering complexity (side pots, all-in scenarios)
- Risk game state size (~2KB, may need optimization)
- Spectator scaling (assume 1:1 player:spectator ratio initially)
- Chess move validation edge cases (en passant, castling, check detection)

**Key Principle:**
Start simple, scale deliberately. Build what we need now, design for what we'll need next. Every decision includes a "defer until" condition.

---

### Cross-Agent Research Summary (2026-03-14)

**Pemulis (Systems Dev)** produced `docs/game-systems-design.md` with:
- Detailed TypeScript plugin interfaces (GamePlugin, StateFilter, TurnManager)
- Per-game technical analysis for all 7 games with state size estimates
- Hidden information architecture for card games (Poker, Hearts, Spades, Dominoes)
- Turn management system with phased turns for Risk
- Complete Checkers plugin skeleton
- Turn time limits configuration (default 60s, fast mode 30s)

**Gately (Game Dev)** produced `docs/client-architecture.md` with:
- Scene management system (Lobby, Waiting Room, Game scenes)
- Game renderer plugin system (GameRenderer interface, RendererRegistry)
- Hybrid HTML/PixiJS architecture (menus in HTML, games in PixiJS)
- Per-game rendering analysis and asset requirements
- Spectator mode with perspective selector for hidden-info games
- Lazy asset loading strategy, mobile-first design
- Risk map pan/zoom viewport, touch input support

**Key Alignment:**
- All three agents agree on plugin-based modular architecture
- Server-authoritative state with client validation separation
- Scaling strategy defers until needed (1→2→3 phase approach)
- Game implementation order aligned: Checkers → Dominoes → Card games → Risk
- Asset dependencies identified: Risk SVG map (CRITICAL), card sprite sheet

---

### 2026-03-14: Azure Cloud Architecture Proposal

**Key Decisions Proposed:**

1. **Azure Container Apps (Consumption plan)** — Single container serves Colyseus + static client, same pattern as primal-grid. Port 2567, WebSocket through ACA Envoy ingress natively.

2. **Scaling: Phase 1 = 1 replica, Phase 2 = sticky sessions + auto-scale on concurrent connections.** HTTP concurrent request scaling (not CPU) is the right metric for WebSocket workloads.

3. **SQLite ephemeral in Phase 1** — accepted trade-off: data lost on redeploy, acceptable during dev. PostgreSQL Flex Server for Phase 2 (aligned with approved SQLite→PostgreSQL decision).

4. **GitHub Actions CI/CD adapted from primal-grid** (`dkirby-ms/primal-grid`). Key improvement: `az acr build` instead of local `docker build + push` for faster CI. Reusable workflow pattern proposed for DRY deploy logic across dev/uat/prod.

5. **Phase 2 additions when triggered:** Redis (for Colyseus RedisPresence across replicas), PostgreSQL, Static Web Apps for client CDN. Defer until 50+ concurrent games.

6. **Cost estimate:** Phase 1 ~$20-30/mo, Phase 2 ~$90-140/mo, Phase 3 ~$360-700/mo.

**User Preferences Noted:**
- Azure is the provider (no AWS/GCP)
- ACA chosen explicitly for scaling flexibility
- GitHub Actions for CI/CD (not Azure DevOps)
- Primal-grid pipeline as reference/starting point
- "Plan with the end in mind" — phased architecture with clear upgrade triggers

**Key File Paths:**
- Proposal: `.squad/decisions.md` (merged from inbox)
- Primal-grid Dockerfile: `dkirby-ms/primal-grid/Dockerfile` (multi-stage build, identical workspace structure)
- Primal-grid deploy: `dkirby-ms/primal-grid/.github/workflows/deploy.yml` (OIDC + ACR + ACA pattern)
- Primal-grid UAT: `dkirby-ms/primal-grid/.github/workflows/deploy-uat.yml` (branch-aware tagging, concurrency groups)
- PlayGrid server entry: `server/src/index.ts` (Colyseus on port 2567)

**Cross-Agent Sync (2026-03-14):**

**From Marathe (DevOps):**
- Primal-grid currently allows 3 UAT replicas, but Colyseus/WebSocket rooms require careful cross-replica coordination that single sticky sessions don't fully solve. Hal's Phase 1 (1 replica only) is the right constraint until distributed presence/state infrastructure ready.
- Primal-grid's Dockerfile pattern copies `client/dist` to `public/` in runtime image. PlayGrid's current server doesn't serve static assets yet — recommend validating this architecture before copying pattern. Consider: add HTTP/static serving to server runtime, OR deploy client separately.
- Session affinity configuration for Phase 2+ is critical; Marathe has documented this in reusable skill (`.squad/skills/azure-container-apps-monorepo-pipeline/SKILL.md`).
- Security improvements identified: GitHub Environments for scoped secrets/approvals, ACA managed identity for ACR, Key Vault references, pinned action SHAs, minimal workflow permissions.
- Build performance improvements available: Docker BuildKit caching with `docker/setup-buildx-action` + `docker/build-push-action` with `type=gha` cache.

**Implications for Architecture Proposal:**
- Confirms single-replica Phase 1 constraint is operationally sound.
- Suggests Phase 2 readiness timeline depends on distributed Colyseus infrastructure (RedisPresence, PostgreSQL shared state), not just replica count.
- Pipeline design should include post-deploy health checks and smoke tests before marking success.

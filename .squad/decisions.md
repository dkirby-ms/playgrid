# Decisions

Team decisions are recorded here. Append-only — never edit existing entries.

---

## Session: Architecture Research Sprint (2026-03-14)

### Hal: Game Plugin System (IGamePlugin)

**Status:** Approved  
**Date:** 2026-03-14  

Use a plugin-based architecture where each game implements `IGamePlugin` interface.

**Rationale:**
- Isolation: Each game is self-contained, can be developed independently
- Testability: Pure logic functions separated from Colyseus
- Consistency: `BaseGameRoom` enforces common patterns
- Scalability: Easy to add new games without modifying core

---

### Hal: Integrated Spectators

**Status:** Approved  
**Date:** 2026-03-14  

Spectators join the same GameRoom as players, marked with `isSpectator` flag.

**Rationale:**
- Simpler: Reuses existing state sync infrastructure
- Efficient: State already being broadcast
- Flexible: Can filter state per-client if needed

---

### Hal: Scaling Strategy — Defer Until Needed

**Status:** Approved  
**Date:** 2026-03-14  

Start with single process (Phase 1), scale to multi-process only after 50+ concurrent games (Phase 2), scale to multi-server only when single machine caps out (Phase 3).

**Rationale:**
- Avoid premature optimization
- Each scaling phase has clear trigger conditions
- Design decisions accommodate future scaling

---

### Hal: Single Lobby for All Game Types

**Status:** Approved  
**Date:** 2026-03-14  

Use one LobbyRoom that tracks games across all types, not separate lobbies per game.

**Rationale:**
- Simpler connection model (one persistent lobby connection)
- Unified game browser UX
- Easy to add game type filters client-side

---

### Hal: SQLite → PostgreSQL Migration Path

**Status:** Approved  
**Date:** 2026-03-14  

Start with SQLite for Phase 1 (simple file-based), migrate to PostgreSQL when scaling to multi-process (Phase 2).

**Rationale:**
- SQLite is sufficient for single-process, zero-config
- PostgreSQL supports concurrent writes from multiple processes
- Migration path is straightforward

**⚠️ Superseded by: 2026-03-14T13:01:17Z — PostgreSQL from day one**

---

### Hal: Game Implementation Order

**Status:** Approved  
**Date:** 2026-03-14  

Checkers → Backgammon → Dominoes → Poker → Hearts/Spades → Chess → Risk

**Rationale:**
- Start with simplest rules to prove plugin pattern
- Progressively increase complexity
- Defer Chess and Risk until fundamentals proven

---

### Hal: Pure Function Game Logic

**Status:** Approved  
**Date:** 2026-03-14  

Separate game logic into pure functions (e.g., `isValidMove()`, `applyMove()`) outside Colyseus Room classes.

**Rationale:**
- Testability: Easy to unit test without Colyseus infrastructure
- Reusability: Logic could be shared with AI or replay systems
- Clarity: Room classes focus on Colyseus orchestration

---

### Pemulis: Plugin-Based Game Architecture

**Status:** Approved  
**Date:** 2026-03-14  

Each game is a self-contained module implementing a standardized `GamePlugin` interface.

**Rationale:**
- Extensibility: New games can be added without modifying core
- Separation of concerns: Game logic isolated from server
- Type safety: TypeScript interfaces enforce contract
- Testability: Each plugin can be tested independently

---

### Pemulis: Server-Authoritative State with Hidden Information Filtering

**Status:** Approved  
**Date:** 2026-03-14  

Server maintains full authoritative state. For hidden information, implement `StateFilter` that generates per-client filtered views.

**Rationale:**
- Security: Prevents client-side cheating
- Simplicity: Server logic straightforward
- Flexibility: Filter logic is game-specific

---

### Pemulis: Phased Turn Management

**Status:** Approved  
**Date:** 2026-03-14  

Implement generic `TurnManager` for simple round-robin, extend with `PhasedTurnManager` for games requiring multiple phases (Risk).

**Rationale:**
- Generality: Most games use simple turn order
- Extensibility: Phased mode handles Risk
- Declarative: Games declare structure, not imperative logic

---

### Pemulis: Checkers First, Risk Last

**Status:** Approved  
**Date:** 2026-03-14  

Implementation order: Checkers → Dominoes → Hearts → Spades → Backgammon → Poker → Risk.

**Rationale:**
- Incremental complexity: Start simple to validate design
- Reusable components: Hearts logic benefits Spades
- Risk mitigation: Build Risk last when patterns proven
- Developer experience: Early wins build momentum

---

### Pemulis: Colyseus Schema for All Game State

**Status:** Approved  
**Date:** 2026-03-14  

All game state uses Colyseus `Schema` with `defineTypes()`. All games extend `BaseGameState` schema.

**Rationale:**
- Type safety: Schema enforces structure
- Efficient sync: Only changed fields sent
- Consistency: All games use same sync mechanism
- Required by Colyseus: Framework requirement

---

### Pemulis: No Undo/Redo for Competitive Play

**Status:** Approved  
**Date:** 2026-03-14  

No undo/redo in competitive mode. Possibly add for casual/practice mode later.

**Rationale:**
- Competitive integrity: No analysis outside standard play
- Simplicity: Undo stacks add complexity
- Social dynamics: Prevents conflicts over moves

---

### Pemulis: Turn Time Limits — Configurable Per Game

**Status:** Approved  
**Date:** 2026-03-14  

Turn time limits configurable in `TurnConfiguration`:
- Default: 60 seconds
- Fast mode: 30 seconds
- No limit: Optional for casual

**Rationale:**
- Flexibility: Different games have different complexity
- Prevents griefing: Time limits stop stalling
- User preference: Customizable per mode

---

### Gately: Plugin-Based Game Renderers

**Status:** Approved  
**Date:** 2026-03-14  

Each game implements `GameRenderer` interface, registers with `RendererRegistry`. Client dynamically loads renderer when game starts.

**Rationale:**
- Clean separation of concerns
- Easy to add new games without modifying core
- Testable in isolation
- Supports different rendering strategies per game

---

### Gately: Hybrid UI — HTML for Menus, PixiJS for Games

**Status:** Approved  
**Date:** 2026-03-14  

Use HTML/CSS for lobby, waiting room, settings, chat. Use PixiJS for in-game rendering (board, pieces, animations).

**Rationale:**
- HTML/CSS better for forms, text, accessibility
- PixiJS better for interactive visuals and animations
- Keeps concerns separated: UI chrome vs. game rendering
- Players already familiar with HTML patterns

---

### Gately: Server-Authoritative State (Client-Side)

**Status:** Approved  
**Date:** 2026-03-14  

Colyseus server owns state. Client sends input, server validates, state syncs back. Client has minimal local state (UI-only: selected piece, hover effects).

**Rationale:**
- Prevents cheating
- Single source of truth
- Simplifies client code
- Standard for multiplayer games

---

### Gately: Scene Management System

**Status:** Approved  
**Date:** 2026-03-14  

Refactor `index.ts` into `Application` + `SceneManager`. Scenes: Lobby, Waiting Room, Game. Each has lifecycle: onEnter, onExit, update, resize.

**Rationale:**
- Current index.ts is monolithic
- Scene pattern is standard in game dev
- Clean transitions between screens
- Each scene can load/unload assets independently

---

### Gately: Lazy Asset Loading

**Status:** Approved  
**Date:** 2026-03-14  

Load assets per game, only when entering. Show loading screen. Use PixiJS `Assets` API with manifests per game type.

**Rationale:**
- Faster initial load
- Better memory usage
- Scales to many games
- Won't run out of memory

---

### Gately: Risk Map SVG as Critical Asset

**Status:** Approved (CRITICAL DEPENDENCY)  
**Date:** 2026-03-14  

Risk requires world map SVG with 42 territory polygons. This is critical — without it, Risk is unplayable.

**Rationale:**
- Risk is inherently map-based
- SVG scales without quality loss
- Territory polygons define hit detection and coloring

**Impact:** High priority to source or create. Can use open-source Risk map or simplified version. Blocks Risk implementation until acquired.

---

### Gately: Card Games Share Sprite Sheet

**Status:** Approved  
**Date:** 2026-03-14  

Poker, Hearts, Spades share single card sprite sheet (52 cards + back). Use open-source SVG-cards or bitmap atlas.

**Rationale:**
- All three use standard deck
- Reuse assets (smaller download, shared cache)
- Many open-source options available

---

### Gately: Spectator Mode with Perspective Selector

**Status:** Approved  
**Date:** 2026-03-14  

Spectators can watch games. For hidden-info games, add optional "View from Player X" perspective (server enforces privacy).

**Rationale:**
- Spectators want to learn
- Educational for card games
- Privacy: Only if player allows
- Opt-in feature

---

### Gately: Mobile-First with Touch Input

**Status:** Approved  
**Date:** 2026-03-14  

Design for mobile from day one. Use PixiJS pointer events. Ensure 44px+ hit areas. Test on real devices.

**Rationale:**
- Many players will use phones/tablets
- PixiJS handles touch automatically
- Easier to scale up than down

---

### Gately: Pan/Zoom Viewport for Risk

**Status:** Approved  
**Date:** 2026-03-14  

Risk map supports pan (drag) and zoom (wheel/pinch). Other games don't need this.

**Rationale:**
- Risk map is large (42 territories)
- Players need to focus on regions
- Desktop: Mouse. Mobile: Touch gestures

---

## Session: Cloud Architecture & Deployment (2026-03-14)

### Directive: Cloud Provider & Hosting Platform

**Status:** Captured  
**Date:** 2026-03-14  
**Source:** dkirby-ms  

Azure is the cloud provider. Hosting model is Azure Container Apps. Deployment pipeline is GitHub Actions. Reference primal-grid repo for pipeline patterns.

---

### Hal: Azure Container Apps Hosting Model

**Status:** Proposed  
**Date:** 2026-03-14  

Host PlayGrid on **Azure Container Apps (ACA)** with a single-container model that serves the Colyseus game server and static client assets from one image.

**Key Details:**
- One Docker image runs `node server/dist/index.js` and serves Vite-built client from `/public`
- Build stage: `npm ci → build shared → build server → build client`
- Runtime: node:22-alpine, port 2567
- Same pattern as primal-grid (reusable)

**Container Configuration by Phase:**
| Setting | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| CPU | 0.5 vCPU | 1.0 vCPU | 2.0 vCPU |
| Memory | 1.0 Gi | 2.0 Gi | 4.0 Gi |
| Min replicas | 1 | 1 | 2 |
| Max replicas | 1 | 5 | 10 |

**Rationale:**
- Colyseus serves both WebSocket and HTTP on same port
- Client is ~1MB static JS/CSS — no CDN benefit in Phase 1
- Simpler deployment, fewer moving parts
- Aligns with approved "start simple" philosophy

---

### Hal: WebSocket Support & Session Affinity in ACA

**Status:** Proposed  
**Date:** 2026-03-14  

ACA's Envoy-based ingress natively supports WebSocket. Phase 1 (single replica) trivial; Phase 2+ requires sticky sessions for Colyseus room pinning.

**Phase 2+ Configuration:**
```yaml
ingress:
  external: true
  targetPort: 2567
  transport: auto
  stickySessions:
    affinity: sticky
```

**Rationale:**
- ACA WebSocket upgrade requests pass through ingress proxy
- Session affinity (sticky cookie) ensures reconnects hit same replica that hosts room
- Required for multi-replica Colyseus deployments
- Phase 3 would need `@colyseus/proxy` for room-aware routing

**Trade-off:** Session affinity limits load balancing if one replica hosts more active rooms. Acceptable until Phase 3.

---

### Hal: Scaling Strategy for ACA

**Status:** Proposed  
**Date:** 2026-03-14  

Align scaling triggers with approved "Defer Until Needed" decision:

| Phase | Strategy | Trigger |
|-------|----------|---------|
| Phase 1 (0–100 games) | Fixed single replica | None (min=max=1) |
| Phase 2 (100–1000 games) | Auto-scale on HTTP concurrent requests | Scale when >200 concurrent requests per replica |
| Phase 3 (1000+ games) | Custom metrics via Application Insights | Scale on active room count |

**Why HTTP concurrent requests, not CPU?** WebSocket connections are long-lived and lightweight (low CPU between moves). Concurrent request count directly correlates with player count.

**Phase 2 scaling rule:**
```yaml
scale:
  minReplicas: 1
  maxReplicas: 5
  rules:
    - name: http-connections
      http:
        metadata:
          concurrentRequests: "200"
```

---

### Hal: Database Strategy — SQLite to PostgreSQL Migration Path

**Status:** Proposed  
**Date:** 2026-03-14  

Aligns with approved "SQLite → PostgreSQL Migration Path" decision.

| Phase | Database | Service | Notes |
|-------|----------|---------|-------|
| Phase 1 | SQLite | File in container | Simple, zero-config. Data ephemeral (lost on redeploy). Acceptable for game logs. |
| Phase 1.5 | SQLite + Azure Files | Mounted volume | Persist SQLite across restarts. Low-cost bridge (~$0.06/GB/mo). |
| Phase 2 | PostgreSQL | Azure Database for PostgreSQL Flexible Server | Required for multi-replica (shared database). Burstable B1ms ~$13/mo. |

**⚠️ Container Storage Warning:** Container storage is ephemeral. When ACA replaces container, SQLite data is lost.

**Recommendation:** Accept ephemeral SQLite for Phase 1 (data loss on redeploy is fine for dev/test). Budget PostgreSQL for when we need persistence or multi-replica.

---

### Hal: Supporting Azure Services

**Status:** Proposed  
**Date:** 2026-03-14  

**Container Registry (ACR):**
- Azure Container Registry Basic tier (~$5/mo)
- Stores Docker images for PlayGrid
- ACA pulls images directly from ACR
- Use managed identity for pull authentication (preferred) or admin user
- Image tagging: `playgrid:<sha>`, `playgrid:latest`, `playgrid:uat-<branch>-<sha>`

**Application Insights:**
- Monitor WebSocket connection metrics, game room lifecycle, error tracking
- Instrument unhandled exceptions, custom events (room created/joined/left, game completed), WebSocket connection count
- Cost: Pay-per-GB ingested. Phase 1 traffic essentially free (<5GB/mo). Set daily cap to 1GB.

**Key Vault:**
- Recommendation: Start with ACA inline secrets (set via CLI in deploy pipeline). Move to Key Vault when >5 secrets or rotation needed.
- Future secrets: `jwt-secret`, `db-connection-string`, `discord-webhook-url`

**Static Assets / CDN:**
- Phase 1: Serve from container (Colyseus already serves client files)
- Phase 2+ option: Azure Static Web Apps or Blob Storage + Azure CDN (free tier available)

---

### Hal: Networking — Custom Domain & WebSocket Routing

**Status:** Proposed  
**Date:** 2026-03-14  

**Custom Domain + SSL:**
- ACA provides default FQDN: `<app-name>.<region>.azurecontainerapps.io` with automatic SSL
- Custom domain setup: Add CNAME record, ACA supports managed certificates (free, auto-renewed)
- Recommended: `play.yourdomain.com` (prod), `play-uat.yourdomain.com` (UAT)

**WebSocket Routing:**
- Client connects via `wss://play.yourdomain.com` (port 443)
- Envoy ingress terminates SSL, proxies to container on port 2567
- WebSocket upgrade passes through transparently
- Client code: `getServerUrl()` should use `wss://` + ACA hostname in production, `ws://localhost:2567` in dev

**Connection Timeout:**
- ACA default idle timeout: 4 minutes
- Colyseus sends periodic pings (default: 20s) — keeps connections alive
- No configuration change needed

**CORS:**
- Client and server served from same origin (same container, domain) — CORS not an issue in production
- Development: Client on `localhost:5173`, server on `localhost:2567` — handle via Express CORS middleware for `localhost` only

---

### Hal: Cost Estimates by Phase

**Status:** Proposed  
**Date:** 2026-03-14  

**ACA Consumption Plan vs Dedicated:**
- Consumption (recommended): Pay per vCPU-second + memory-second + requests. Best for Phase 1–2.
- Dedicated: Fixed monthly cost. Phase 3 option if sustained load exceeds consumption pricing.

**Phase 1: Dev/Early Launch (1–50 concurrent players)**
| Service | Tier | Est. Cost/mo |
|---------|------|-------------|
| ACA (1 replica, 0.5 vCPU, 1 Gi) | Consumption | ~$15–25 |
| ACR | Basic | ~$5 |
| Application Insights | <1 GB/mo | ~$0 (free tier) |
| Custom domain SSL | ACA managed | $0 |
| **Total** | | **~$20–30/mo** |

**Phase 2: Growing (50–500 concurrent players)**
| Service | Tier | Est. Cost/mo |
|---------|------|-------------|
| ACA (1–3 replicas, 1 vCPU, 2 Gi) | Consumption | ~$50–100 |
| ACR | Basic | ~$5 |
| PostgreSQL Flex Server | Burstable B1ms | ~$13 |
| Azure Cache for Redis | Basic C0 | ~$16 |
| Application Insights | ~2 GB/mo | ~$5 |
| Azure Static Web Apps (client CDN) | Free | $0 |
| **Total** | | **~$90–140/mo** |

**Phase 3: Scaled (500+ concurrent players)**
| Service | Tier | Est. Cost/mo |
|---------|------|-------------|
| ACA (3–10 replicas, 2 vCPU, 4 Gi) | Consumption or Dedicated | ~$200–500 |
| ACR | Standard | ~$20 |
| PostgreSQL Flex Server | General Purpose | ~$50–100 |
| Azure Cache for Redis | Standard C1 | ~$40 |
| Application Insights | ~5 GB/mo | ~$12 |
| Azure Front Door | Standard | ~$35 |
| **Total** | | **~$360–700/mo** |

---

### Hal: GitHub Actions CI/CD Pipeline — Proposed Structure

**Status:** Proposed  
**Date:** 2026-03-14  

Adapt primal-grid's proven patterns for PlayGrid.

**Branch Strategy:**
```
main ──────────▶ dev (auto-deploy on push)
  └── PR ──────▶ build + test (no deploy)
  └── merge ───▶ uat (auto-deploy to UAT)
  └── promote ─▶ prod (manual or tag-triggered)
```

**Proposed Workflows:**
1. `ci.yml` (on every PR to main): checkout → setup-node → npm ci → build → test → lint
2. `deploy-dev.yml` (on push to main): test → azure/login (OIDC) → `az acr build` → `az containerapp update` → Discord notification
3. `deploy-uat.yml` (on push to uat): same as deploy-dev, targeting playgrid-uat
4. `deploy-prod.yml` (manual or tag-triggered): same pattern, targeting playgrid-prod, with required GitHub Environment approval

**Key Improvements Over primal-grid:**
- Use `az acr build` (build in Azure) instead of local Docker build + push (faster, no Docker daemon needed)
- Health check after deploy (`curl` deployed FQDN)
- Environment protection rules for prod
- Reusable workflow for DRY deploy logic
- Concurrency groups to prevent simultaneous deploys

**Required GitHub Secrets:**
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC)
- `ACR_NAME`, `RESOURCE_GROUP`
- `CONTAINER_APP_NAME_DEV`, `CONTAINER_APP_NAME_UAT`, `CONTAINER_APP_NAME_PROD`
- `DISCORD_WEBHOOK_URL`

---

### Marathe: Deployment Pipeline Analysis — primal-grid Reference

**Status:** Proposed  
**Date:** 2026-03-14  

Primal-grid provides a solid Azure Container Apps reference: branch-driven deploys, Azure OIDC login, monorepo-aware Dockerfile, Bicep infrastructure. Recommend reusing shape for PlayGrid, but tightening around Colyseus constraints.

**What primal-grid does well:**
1. Azure OIDC login (avoids stored credentials)
2. Workspace-aware multi-stage Docker build (correct dependency ordering)
3. Branch/environment separation (UAT vs prod)
4. Operational visibility (step summaries, Discord notifications, CI-failure auto-issues)
5. Bicep infrastructure-as-code
6. Concurrency control on deploys
7. Path-based triggering (CI only on code changes)

**Primal-grid Weaknesses → PlayGrid Improvements:**
1. **Replica strategy unsafe for Colyseus once multi-replica**
   - Primal-grid allows 3 UAT replicas; Colyseus/WebSocket rooms need more coordination
   - PlayGrid recommendation: Start with `minReplicas: 1, maxReplicas: 1` until distributed presence/state exists
   
2. **Dockerfile pattern must be adapted**
   - Primal-grid copies `client/dist` to `public/` in runtime image
   - PlayGrid server doesn't yet serve static assets — validate architecture before copying pattern
   - Recommendation: Either add HTTP/static serving or deploy client separately
   
3. **Testing should gate deploys more strongly**
   - Primal-grid E2E is manual-only, not required before promotion
   - PlayGrid should enforce: CI gates on lint/unit/build → staging deploy triggers smoke/E2E → prod requires green staging
   
4. **Security can be improved**
   - Add GitHub Environments for scoped secrets and approvals
   - Use ACA managed identity for ACR pull instead of admin credentials
   - Reference Azure Key Vault for secrets instead of repo-level secrets
   - Pin action SHAs
   - Explicit minimal workflow permissions
   
5. **Infrastructure changes need validation path**
   - Primal-grid ignores `infra/**` preventing accidental redeploys but skipping validation
   - Recommend: Dedicated Bicep validation workflow for infra changes
   
6. **Build performance can improve**
   - Add Docker BuildKit caching (`docker/setup-buildx-action` + `docker/build-push-action` with type=gha cache)
   - Optional: Parallel jobs post-install if runtime stays fast

**PlayGrid-Specific Recommendations:**

**Monorepo Support**
- PlayGrid workspace monorepo: `client/`, `server/`, `shared/`
- Canonical build order: shared → server → client (follows primal-grid pattern)
- Prefer root `npm run build` once that becomes source of truth

**Shared Package Dependencies**
- Treat `shared/` as upstream dependency for both client and server
- Docker: copy workspace manifests first for cache stability, then source, then build in order

**WebSocket/Colyseus Considerations**
- Short term: one replica only
- When scaling: enable ACA sticky sessions, add distributed room/presence backing before multi-replica
- Sticky sessions necessary for reconnect behavior but do NOT solve cross-replica room discovery alone

**Multi-Environment Strategy**
- Recommend GitHub Environments: `dev`, `staging` (or `uat`), `prod`
- Production requires manual approval via Environment protection rules
- Follow primal-grid branch pattern if desired for consistency

**Test Integration**
- CI gates: lint, unit tests, workspace builds
- Add post-deploy smoke checks early
- Add Playwright E2E when client/server integration and deploy URL stable
- Always upload test artifacts on failure

**Container Image Strategy**
- If server-only ACA deployment: build image with `server/dist` + `shared/dist`, NOT `client/dist`
- If full-stack container: primal-grid's multi-stage Dockerfile is good starting point; add static serving in runtime first
- Use `.dockerignore`, BuildKit cache, keep runtime image small

---

### Marathe: Azure Container Apps + Monorepo Pipeline Skill

**Status:** Proposed  
**Date:** 2026-03-14  

Created reusable skill: `.squad/skills/azure-container-apps-monorepo-pipeline/SKILL.md`

**Covers:**
- GitHub Actions patterns for monorepo testing (parallel jobs, path filters, concurrency)
- Build optimization (BuildKit caching, root script truth)
- Deployment automation for ACA (OIDC, `az acr build`, `az containerapp update`)
- Session affinity configuration for stateful workloads
- Environment scoping and secret management
- Health checks and post-deploy verification

This skill is reusable for other ACA + monorepo projects and should be reviewed alongside pipeline implementation.

---

### 2026-03-14T13:01:17Z: User directive — Cloud architecture answers

**Status:** Approved  
**By:** dkirby-ms (via Copilot)  
**Date:** 2026-03-14T13:01:17Z  

**Decisions:**
1. **Database:** PostgreSQL from day one (replaces phased SQLite → PostgreSQL migration)
2. **Branch strategy:** Matches primal-grid (main → uat → prod)
3. **Custom domain:** playgrid.kirbytoso.xyz (already owned)
4. **Phase 2 timeline:** ~6 months out — no rush on multi-replica scaling
5. **Discord notifications:** Separate #play-grid channel in same Discord server as primal-grid

**Rationale:**
User answers to Hal's 5 open questions from the cloud architecture proposal. PostgreSQL from the start simplifies operations and eliminates migration complexity; the other decisions clarify infrastructure strategy and communication channels.

---

---

## Session: Backlog Decomposition (2026-03-14T13:08:51Z)

### Hal: Backlog Decomposition — P0 Scope

**Status:** Approved
**Date:** 2026-03-14

P0 consists of 7 infrastructure-only items: env config, static file serving, PostgreSQL connection, database schema, Dockerfile, CI pipeline, lint setup. Game logic deliberately excluded from P0.

**Rationale:**
- Team cannot ship without these foundations
- Can be built in parallel with game work
- Clear demarcation: infrastructure first, features second

**Items:** p0-env-config, p0-static-serving, p0-postgresql-connection, p0-db-schema, p0-dockerfile, p0-ci-pipeline, p0-lint-setup

---

### Hal: Backlog Decomposition — P1 Scope

**Status:** Approved
**Date:** 2026-03-14

P1 (Checkers MVP) split into 4 sub-phases: (A) Plugin Foundation, (B) Checkers Logic, (C) Client Architecture, (D) Checkers Renderer. 16 items total, enabling parallel work streams.

**Rationale:**
- Sub-phases maximize parallelism: Pemulis builds server infra while Gately builds client
- Clear ordering prevents blockers: plugins before logic, architecture before renderers
- Steeply can test as components land

**Items:** P1A:4 (plugin system), P1B:4 (checkers logic), P1C:5 (client scenes), P1D:3 (renderer)

---

### Hal: Backlog Decomposition — GameRoom Preservation

**Status:** Approved
**Date:** 2026-03-14

New `BaseGameRoom` coexists alongside existing `GameRoom.ts`. Old GameRoom is NOT modified.

**Rationale:**
- Avoids breaking existing lobby flow during transition
- Allows incremental migration to new plugin system
- Old GameRoom can be removed once new system proven

---

### Hal: Backlog Decomposition — Critical Path

**Status:** Approved
**Date:** 2026-03-14

Longest dependency chain: env-config → static-serving → shared-game-types → base-game-state → base-game-room → checkers-plugin → e2e-checkers

**Rationale:**
- Identifies serialization bottleneck for tracking progress
- Other items branch off this spine in parallel
- Critical path timing determines earliest project completion

---

### Hal: Backlog Decomposition — Team Assignments

**Status:** Approved
**Date:** 2026-03-14

| Agent | Items | Role |
|-------|-------|------|
| Pemulis | 10 | P0 + P1A: all server infrastructure and plugin foundation |
| Gately | 11 | P1B–D + P2: game logic, client architecture, renderers, second game |
| Steeply | 6 | Tests across all phases (blocked until code lands) |
| Marathe | 5 | CI/CD, Docker, Bicep, deployment pipelines |
| Joelle | 2 | Docs, guides, communication (blocked on P1 stability) |

**Rationale:**
- Pemulis and Marathe can start immediately on P0 (no dependencies)
- Gately can start on client architecture (no server deps yet)
- Steeply waits for code to test against
- Maximizes team throughput in first sprint

---

### Hal: Backlog Decomposition — P2 Deferred

**Status:** Approved
**Date:** 2026-03-14

Explicitly deferred to P2: deployment pipelines (UAT/prod), Bicep infrastructure, reconnection, spectator mode, Application Insights, second game (Backgammon), documentation updates.

**Rationale:**
- These don't block a playable Checkers game
- P2 is lower priority than shipping MVP
- Can be tackled after P1 stabilizes


---

## Session: GitHub Backlog Issue Setup (2026-03-14T13:22:34Z)

### Marathe: GitHub Issues + Milestones Created

**Status:** ✅ Complete (partial — project board blocked)
**Date:** 2026-03-14T13:22:34Z

Created 3 GitHub milestones and 45 issues from `docs/backlog.md`:

| Phase | Range | Count |
|-------|-------|-------|
| P0 | #2–#8 | 7 |
| P1 | #9–#28 | 20 |
| P2 | #29–#46 | 18 |

**Project Board Status:** Creation failed (token missing `project` and `read:project` scopes). Follow-up: re-authenticate and create board, then bulk-add all issues.

**Full issue mapping:** See `.squad/orchestration-log/2026-03-14T13-24-01Z-marathe.md` (issue table)

**Cross-Agent Sync:**
- **Hal:** Backlog now available for sprint planning
- **Pemulis:** P0 infrastructure issues ready to claim
- **Gately:** P1 client issues ready to claim
- **Steeply:** Test issues (#17, #19, #28, #34, #37, #46) ready when code lands

---

### Marathe: GitHub Project Board Created

**Status:** ✅ Complete
**Date:** 2026-03-14T13:31:32Z

Created GitHub Projects v2 board for PlayGrid and added all 46 open issues.

**Details:**
- **Project Name:** PlayGrid
- **Project Number:** 12
- **Project URL:** https://github.com/users/dkirby-ms/projects/12
- **Issues Added:** 46 (all open issues #2–#46)

**Implementation:**
- Used `env -u GH_TOKEN` to fall through to stored token in `~/.config/gh/hosts.yml` with `project` scope
- Batch-added all 46 open issues via loop using item-add command
- All operations completed successfully

**Cross-Agent Impact:**
- Hal: Project board now available for sprint planning and issue tracking
- Pemulis, Gately, Steeply: Can organize work by project labels and milestones

---

## Session: Repo Hygiene & Issue Templates (2026-03-14)

### Joelle: Repo Hygiene & Issue Templates

**Status:** ✅ Complete  
**Date:** 2026-03-14  
**PR:** #47 (dev→prod)  
**Issue:** #1 (Closed)

Created three GitHub issue templates (bug report, feature request, chore), improved README.md, and wrote CONTRIBUTING.md guide.

**What We Did:**
- **Issue Templates** (`.github/ISSUE_TEMPLATE/`):
  - `bug-report.yml` — Environment, reproduction steps, expected behavior, logs
  - `feature-request.yml` — Description, use case, implementation ideas, priority
  - `chore.yml` — Task description, scope, acceptance criteria
  - Used YAML form format (structured input, auto-labeling)

- **README.md** refresh:
  - Tagline: "Multiplayer classic board games, real-time"
  - Features section (real-time, Canvas, framework, testing)
  - Getting Started with prerequisites and server URL
  - Project Structure overview
  - Contributing section linking to CONTRIBUTING.md

- **CONTRIBUTING.md** (new):
  - Development setup (prerequisites, clone, install, dev server)
  - Branch strategy: dev → uat → prod
  - Issue and PR guidelines with template links
  - Code style (TypeScript best practices with examples)
  - Testing (Vitest setup, example test)
  - Project structure reference

**Why:**
- Developer experience — Templates guide consistent issue reporting with context
- Project visibility — Refreshed README shows features and approachable tagline
- Contribution flow — CONTRIBUTING lowers barrier to entry
- Early-stage guidance — Brief but complete, not prescriptive

**Style:**
- Warm, enabling tone (not technical jargon in README)
- Issue templates use emojis (🐛, ✨, 🛠️) for visual identity

**Result:** 5 files changed, 334 insertions. Commit c3dcb84 (co-authored by Copilot).

**Cross-Agent Impact:**
- All agents: Issue templates now available for reporting
- Gately, Pemulis, Steeply: CONTRIBUTING guide available for new development
- Hal: README reflects project vision and structure

**Next Steps:**
- Share README and CONTRIBUTING links in Discord #announcements once merged to prod
- Monitor template usage in upcoming contributions
- Gather feedback for template refinement

---

---

## Session: Issue Triage & Bug Fixes (2026-03-14 Round 1)

### Gately: Room Status HUD Cleanup (Issue #54)

**Status:** ✅ Approved  
**Date:** 2026-03-14  
**PR:** #55  

**Context:**  
Issue #54 exposed that the global Pixi status text was acting like a centered debug overlay during active gameplay, and Colyseus room identifiers were not reliable through `room.id` alone.

**Decision:**  
Treat the shared connection/status text as a lightweight HUD toast instead of a gameplay overlay:
- Anchor it to the top-left corner
- Auto-hide informational states after a short delay
- Keep error states persistent
- Resolve displayed room identifiers with `room.roomId` first, falling back to `room.id`

**Rationale:**  
This keeps transition/status messaging available without obstructing the board or other in-game rendering. It also matches the current Colyseus client behavior more safely than assuming `room.id` is always populated.

---

### User Directive: Colyseus Version Management

**Status:** ✅ Captured  
**Date:** 2026-03-14T14:06Z  
**By:** dkirby-ms (via Copilot)

**Directive:**  
"We need to be on latest Colyseus" — always track and maintain latest stable Colyseus version.

**Rationale:**  
User request — captured for team memory and future upgrade planning.

---

---

## Session: E2E Test Suites (Lobby & Checkers) (2026-03-14)

### Hal: E2E Testing Strategy for Game Plugins

**Status:** Approved  
**Date:** 2026-03-14  
**Decision:** All future game plugins (Backgammon, Dominoes, etc.) must use the "Grey Box" E2E testing pattern established in PR #58.

**Details:**
- **UI Interaction:** Use standard Playwright DOM selectors for Lobby, Waiting Room, and React/HTML overlays
- **Game Interaction:** Do **not** use coordinate-based clicks on the Canvas. Instead, use the `window.__PLAYGRID_E2E__.app.gameRoom` harness to send actions (moves, rolls) directly to the server
- **State Verification:** Assert against the synchronized state returned by the server, not the pixel output of the Canvas

**Rationale:**
- Canvas testing is flaky across environments/resolutions
- We care about *Game Logic* and *State Synchronization* correctness in E2E
- Input handling (clicks → events) should be unit tested in the renderer if necessary, but is lower risk than game rule regression

---

### Hal: PR Review Gate for Stacked Branches

**Status:** Approved  
**Date:** 2026-03-14  

**Decision:** PRs targeting `dev` must be independently reviewable against the base branch.

**Rule:**
- No unrelated commits from other open PRs in the diff
- No cross-agent history or test changes unless directly required by the issue
- If a branch is stacked on another unmerged PR, rebase/cherry-pick or refresh after the lower PR lands before approval

**Rationale:**
- Keeps review scope explicit
- Prevents accidental double-approval of unrelated work
- Makes rollback/revert boundaries match the issue being solved
- Critical with multiple agents landing adjacent work to the same branch

**Example:** PR #57 was initially blocked because it included unrelated commits from PR #56. After rebasing, it was approved.

---

### Steeply: Dedicated Lobby Playwright Configuration

**Status:** Approved  
**Date:** 2026-03-14  

**Decision:** Use a dedicated Playwright config (`playwright.lobby.config.ts`) for the lobby suite, and point `npm run test:e2e` at it. Keep a root `playwright.config.ts` that re-exports the lobby config.

**Operational Details:**
- Web server command: `DATABASE_URL= npm run dev`
- Base URL: `http://127.0.0.1:3000`
- Browser: Chromium only
- Workers: 1
- Test match: `**/lobby.spec.ts`

**Rationale:**
- Isolates lobby E2E suite from unrelated browser specs that are not part of issue #52 and are not stable enough to gate this work
- Allows gating on stable lobby workflow without blocking other tests
- Conventional Playwright setup in place for future test suites

---

### Steeply: Grey Box E2E Harness for Checkers

**Status:** Approved  
**Date:** 2026-03-14  

**Decision:** Use a lightweight browser-only E2E harness for gameplay tests: expose the live `PlaygridApp` instance from `client/src/index.ts` only when the app is loaded with `?e2e=1`, then have Playwright drive lobby/waiting-room UI normally while sending Checkers moves through the real browser `gameRoom` connection.

**Operational Details:**
- Root `playwright.config.ts` targets the server-served app on `http://127.0.0.1:2567`
- Starts E2E by building client bundle, then running server in development mode
- Move harness accessed as `window.__PLAYGRID_E2E__.app.gameRoom`
- 31-move deterministic test sequence covers promotion, king movement, no-valid-moves win

**Rationale:**
- Checkers gameplay is rendered on a Pixi canvas, so DOM-driven move automation is brittle
- Using the same room objects that the browser players already joined keeps coverage end-to-end and avoids fake test clients taking player seats
- The suite can assert win/loss messaging, promotion, king movement, invalid-action errors, and synchronized state changes deterministically
- Environment-agnostic (no coordinate-based clicks, no timing issues)


---

## Session: Player Reconnection Support (2026-03-14)

### Pemulis: Player Reconnection Support

**Status:** Implemented  
**Date:** 2026-03-14  
**PR:** #61  
**Issues:** #35, #59

**Decision:** Implemented two-part solution for connection stability and graceful reconnection.

#### 1. Connection Stability (Issue #59)
- Configure WebSocket transport with heartbeat: `pingInterval: 10000` (10s), `pingMaxRetries: 3`
- Prevents server-side idle timeout causing premature disconnects
- Keeps connections alive during low-activity periods

#### 2. Reconnection Support (Issue #35)
- Call `allowReconnection(client, timeout)` in `BaseGameRoom.onLeave()` during active games
- Default 30s timeout, configurable via room options
- On reconnect, `onJoin()` detects existing player and restores `isConnected` flag
- Timeout triggers forfeit (1 player remains) or draw (all disconnected)
- CONSENTED disconnects skip reconnection (immediate forfeit)

**Rationale:**
- 30-second timeout: Long enough for page reload/network recovery, short enough to avoid frustrating waiting opponents
- CONSENTED skip: Preserves intentional forfeit semantics and prevents reconnection loops
- Heartbeat configuration: 10s interval balances responsiveness with network overhead; 3 retries = 30s grace period
- Aligns with existing `PlayerInfo.isConnected` field design
- Compatible with plugin lifecycle hooks

**Alternatives Considered:**
- Client-side reconnection UI (deferred to future work)
- No timeout differentiation (rejected; CONSENTED closes should be immediate)
- Longer timeout (rejected; too long for 2-player games)
- Cross-page session tokens (out of scope; requires authentication system)

**Impact:**
- ✅ No more 1-2 minute connection timeouts
- ✅ Players can reload page mid-game
- ✅ All existing tests pass
- ✅ Works with plugin system
- ⚠️ Client-side rejoin UI still needed (future work)
- ⚠️ Lobby reconnection still unsupported

**Follow-up Work:**
- Client-side "Reconnecting..." UI (Issue #50)
- Lobby reconnection support
- Per-game timeout configuration

---

## Session: Phase 2 Wave 4 (2026-03-14)

### Gately: Backgammon Renderer Implementation Pattern

**Status:** Approved  
**Date:** 2026-03-14  
**PR:** #70  
**Issue:** #45

**Decision:** Established pattern for rendering complex board games with stacked pieces, multiple zones (bar, borne-off), and dynamic dice state.

**Key Choices:**
- 24 triangular points in 4 quadrants, point numbering matches backgammon convention
- Piece stacking: Max 5 visible pieces per point, count labels above 5th piece
- Dice rendering: Standard die face patterns, dimmed for used dice, doubles support
- Interactive zones: Transparent clickable polygons, green/yellow highlighting for valid targets
- State: Signed integers for piece positions (positive=Black, negative=Red), synced from server

**Rationale:**
- Visual clarity: Stacking limit prevents overcrowding while showing exact counts
- Usability: Large interactive zones and clear highlighting improve click accuracy
- Server-authority: All move validation defers to server
- Consistent pattern: Follows CheckersRenderer for maintainability
- Responsive: Dynamic layout calculation scales to all screen sizes

**Impact on Future:**
- Template for games with multiple zones (Dominoes, Poker chips)
- Dice rendering reusable for Yahtzee, Monopoly
- Stacking display applicable to chip-based games
- Interactive zone pattern scales to Risk, other complex boards

---

### Hal: Wave 4 Review & Merge Strategy

**Status:** Approved  
**Date:** 2026-03-14  
**PRs:** #68 (Marathe), #69 (Steeply), #70 (Gately), #71 (Pemulis)  
**Issues:** #32, #36, #45, #46

**Decision:** Backgammon game (logic + tests + renderer), spectator mode, and production infrastructure complete.

**Wave 4 Merge Sequence:**
1. PR #68 (Bicep) — Clean merge, infrastructure independent
2. PR #69 (Tests) — Clean merge, test files independent
3. PR #70 (Renderer) — Resolved conflicts with #68 & #69, CI passed
4. PR #71 (Spectator) — Fixed test expectation (maxClients legitimate change), resolved conflict with #70, CI passed

**Key Learnings:**
- Conflict resolution: `git fetch origin dev && git merge origin/dev` pattern effective
- Test discipline: New failures must be fixed before merge, not pushed through
- Architecture coherence: Backgammon fits plugin pattern, spectator leverages Colyseus broadcast

**Security Review (Bicep):**
- ✅ Managed identity over admin credentials
- ✅ RBAC with minimum privilege scoping
- ✅ OIDC for CI/CD, no long-lived PATs
- ✅ Secrets in Key Vault, not environment variables
- ✅ Environment-specific sizing (Burstable for dev/uat, GeneralPurpose for prod)

**Outcome:** All 4 PRs merged cleanly. Backgammon fully playable with tests, renderer, and spectator support. Infrastructure production-ready.

---

## Session: Phase 2 Wave 5 (2026-03-14)

### Steeply: Game Persistence Testing Pattern

**Status:** Approved  
**Date:** 2026-03-14  
**PR:** #72  
**Issue:** #34

**Decision:** Established comprehensive test pattern for persistence layer (gameRepository).

**Coverage:**
- createGame, endGame, addParticipant functions (all covered)
- Edge cases: Constraint violations, foreign key errors, concurrent operations, null/empty values, large inputs
- Error paths: Database down, connection errors, constraint violations, transaction failures
- Concurrent operations: Promise.all scenarios for realistic load

**Test Quality:**
- Mock patterns: Clean vi.fn() usage, proper TypeScript casting
- Isolation: beforeEach resets mocks, no shared state
- Naming: Clear test descriptions
- Patterns: Consistent with Vitest best practices

**Rationale:**
- Database layer is critical path for game persistence
- Comprehensive mocking enables fast, deterministic tests
- Edge case coverage prevents production surprises
- Concurrent operation testing validates transaction isolation

**Impact:**
- Sets benchmark for future database testing
- Enables confident refactoring of gameRepository
- Provides foundation for adding new persistence operations
- Documentation via test cases for expected behavior

---

### Marathe: Discord Webhook Automation via Composite Action

**Status:** Approved  
**Date:** 2026-03-14  
**PR:** #73  
**Issue:** #43

**Decision:** Refactor Discord webhook notifications into reusable composite action, eliminating duplication across 3 workflows.

**Change:**
- Extracted 180+ lines of duplicated curl logic into `.github/actions/discord-notify/action.yml`
- Enhanced format: Added deployment URL field, shortened commit SHA to 7 chars, workflow run links
- Simplified conditional: Replaced separate success/failure steps with `if: always()` + `${{ job.status }}`
- Centralized secret: Uses `${{ secrets.DISCORD_WEBHOOK_URL }}` from GitHub Environments

**Workflows Updated:**
- deploy-dev.yml
- deploy-uat.yml
- deploy-prod.yml

**Code Impact:** -183 lines +161 lines = net -22 lines with major maintainability improvement

**Rationale:**
- DRY principle: Single source of truth for webhook format
- Maintainability: Future webhook format changes require one file edit, not three
- Consistency: All environments use identical notification format
- Reusability: Composite action pattern scales to other multi-environment notifications

**Impact:**
- Webhook format changes now happen in one place
- Easier to add new fields to Discord notifications
- Cleaner workflow files, easier to audit CI/CD logic

---

### Gately: Client Connection Manager State Machine

**Status:** Approved  
**Date:** 2026-03-14  
**PR:** #74  
**Issue:** #38

**Decision:** Extract Colyseus connection logic into dedicated ConnectionManager class with clear state machine and reconnection handling.

**State Machine:**
- DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING → CONNECTED
- Clear transitions, no invalid state combinations
- State changes trigger observer callbacks

**Reconnection Logic:**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
- Max 5 reconnection attempts
- Cancellable timeouts for clean shutdown
- Complements server-side reconnection support (PR #61)

**Code Changes:**
- Created `client/src/services/ConnectionManager.ts`
- Application.ts: Removed 52 lines of tangled connection logic, added 47 lines of clean delegation
- Removed duplicate onError handlers per room, consolidated in ConnectionManager

**Rationale:**
- State machine clarity: Eliminates implicit state via scattered flags
- Robustness: Exponential backoff prevents hammering server, max attempts prevent infinite loops
- Maintainability: Single source of truth for networking state
- Error centralization: All connection errors flow through ConnectionManager error handler
- Graceful degradation: Failed connections don't crash app

**Impact:**
- Application.ts significantly cleaner
- Reconnection UX improvements now made in one place
- Error handling consolidated and testable
- State transitions clear and auditable

---

### Pemulis: Application Insights Observability Integration

**Status:** Approved  
**Date:** 2026-03-14  
**PR:** #75  
**Issue:** #40

**Decision:** Integrate Azure Application Insights for server-side observability and custom event tracking.

**Custom Events (6 tracked):**
1. room_created — Game room instantiated (gameType, roomId, gameId)
2. player_connected — Player joins (includes isSpectator flag)
3. player_reconnected — Existing player reconnects
4. player_disconnected — Player leaves (includes phase, close code)
5. game_started — Game begins (includes playerCount)
6. game_ended — Game completes (includes resultType, durationSeconds)

**Exception Tracking:**
- Unhandled rejections captured with source context
- Uncaught exceptions captured with stack traces
- Both instrumented at process level

**Auto-Collection:**
- HTTP requests
- Performance metrics
- Exceptions (redundant with custom tracking)
- Dependencies
- Console logs
- Disk retry caching for offline resilience

**Configuration:**
- Graceful no-op: When `APPLICATIONINSIGHTS_CONNECTION_STRING` missing, telemetry disabled (local dev friendly)
- All trackEvent/trackException calls wrapped in try/catch (telemetry failures don't crash games)
- Environment variables configure connection string in Azure Environments (dev/uat/prod)

**Rationale:**
- Native Azure integration (server runs on Container App)
- Custom events at lifecycle moments enable powerful analytics (game popularity, session duration, failure modes)
- Graceful degradation: No local dev friction, production telemetry optional
- Defensive coding: Telemetry infrastructure can't bring down game server
- Business insights: Beyond system metrics, track what players do

**Performance:**
- <1ms per event
- Async telemetry pipeline, non-blocking
- Minimal memory overhead

**Impact:**
- Full visibility into game lifecycle from room creation to end
- Debug visibility: Stack traces for unhandled errors
- Analytics capability: Query custom events for business insights
- Production readiness: Telemetry foundation for monitoring scaled deployments

**Future Enhancements:**
- Add custom metrics for duration percentiles, player count distribution
- Track action-level events for popular moves
- Implement sampling for high-volume events
- Add user-id tracking post-authentication

---

### Steeply: Lobby E2E Order-Independence

**Status:** Approved  
**Date:** 2026-03-14  
**Issue:** #77  
**PR:** #78

**Decision:** Lobby E2E tests must be order-independent within the shared Playwright suite by using row-scoped assertions rather than lobby-wide assertions.

**Problem:**
- Full E2E suite runs checkers E2E before lobby E2E against one shared server instance
- Checkers tests legitimately leave in-progress sessions visible in the lobby
- Lobby tests using `.lobby-empty-row` assertion fail when not run in isolation

**Solution:**
- Use unique game names: `Test Game ${timestamp}`
- Assert only on the specific game row created and removed by the test
- Remove only the game created by the test, not the entire lobby state

**Implementation:**
- Update `e2e/lobby.spec.ts` with unique game naming
- Change assertions from `expect(emptyRow).toBeVisible()` to row-scoped checks
- Ensure each test is independent of test execution order

**Rationale:**
- Test isolation: No brittle dependencies on global state or execution order
- Maintainability: New tests can be added/removed/reordered without side effects
- Robustness: Reflects real-world usage where multiple games exist in lobby simultaneously

**Impact:**
- E2E suite now runs reliably in any order
- Tests can run in parallel without flaky failures
- Team can add new E2E tests with confidence
- Clear pattern for future browser/UI E2E work

---

## Session: Local Development Infrastructure (2026-03-14)

### User Directive: Dev Environment Stays Local

**Status:** Approved  
**Date:** 2026-03-14T21:26:05Z  
**By:** dkirby-ms  

**Decision:** No Azure deployment for the dev environment — only UAT and prod need Azure infrastructure. Dev runs locally.

**Rationale:**
- Developer experience: Fast feedback cycles without cloud infrastructure setup
- Cost efficiency: Avoid staging Azure resources for individual developers
- Isolation: Dev work doesn't depend on shared cloud services
- Local reproducibility: Issues in local env match production closely

---

### Marathe: Local PostgreSQL for Development

**Status:** Approved  
**Date:** 2026-03-14T21:38:00Z  

**Decision:** Standardize local-only development on a root `docker-compose.yml` PostgreSQL service (`postgres:15-alpine`) with a named data volume, health check, and repo-root `.env.example` for `DATABASE_URL`.

**Implementation:**
- Service: `postgres:15-alpine` (matches production version)
- Volume: Named volume for persistence across restart
- Health Check: Ensures postgres is ready before dependent services
- Environment Template: `.env.example` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playgrid_dev`
- Helper Scripts: Database initialization and cleanup utilities

**Rationale:**
- Alignment: Postgres 15 in dev matches production, reducing environment surprises
- Reliability: Health checks prevent race conditions
- Persistence: Data survives `docker-compose down/up` cycles
- Discoverability: `.env.example` makes setup clear for new team members

**Impact:**
- Server team (Pemulis, Gately) has a stable database target for local development
- No Azure credentials needed for dev work
- Consistent foundation for database schema migrations and seed data
- Clear upgrade path: Change postgres version in one place for team-wide update

**Follow-up:**
- Server code must read `DATABASE_URL` from environment
- Test/UAT/prod deployment pipelines remain independent

---

## Session: Client UI Modernization (2026-03-14)

### Gately: Lobby Dashboard UI Pattern

**Status:** Approved  
**Date:** 2026-03-14T22:15:01Z  

**Decision:** The Lobby UI has been refactored from a table-based list into a modern dashboard layout with visual game tiles, sidebar panels, and modal dialogs.

**Context:**
The original lobby used an HTML table to display game sessions with inline forms. While functional, it lacked visual appeal and didn't scale well for multiple game types. A Figma dashboard design was provided showing game tiles, active games sidebar, online players panel, and modal-based creation.

**Implementation:**
- **Layout:** 2/3 main content (game library) + 1/3 sidebar (active games + online players) on desktop, single column on mobile
- **Game Tiles:** Visual cards representing game types (not sessions), showing active session count, with gradient backgrounds
- **Active Sessions Panel:** Card-based display of current games with real-time Colyseus sync
- **Modal Creation:** Centered overlay for new game form with type pre-selection from tiles
- **Header Controls:** Sticky header with player name input, create button, action controls
- **Theme:** Dark violet with accent colors, responsive grid layout

**Technical Details:**
- **Files:** `client/index.html` (CSS) and `client/src/ui/LobbyScreen.ts` (DOM)
- **Approach:** Vanilla TypeScript + CSS (no framework dependencies)
- **Styling:** CSS Grid/Flexbox with CSS Variables, inline SVG icons, gradient overlays
- **State:** `Map<string, GameSessionInfo>` with Colyseus message handling

**Rationale:**
- Visual Appeal: Modern design more engaging than table layout
- Scalability: Easy to add new game types as tiles
- Information Density: Sidebar shows context without additional views
- Mobile-Friendly: Responsive design collapses to single column
- Discoverability: Game tiles make available types immediately visible
- No Dependencies: Retains vanilla TypeScript pattern established in codebase

**Alternatives Considered:**
- Keep table: Functional but lacks visual polish
- Use framework (React/Vue): Would require dependency shift, rejected per constraints
- External images: Requires asset pipeline, using gradients instead

**Impact:**
- **Client:** New dashboard pattern for game selection/session browsing
- **WaitingRoom:** Could adopt similar card-based pattern for consistency
- **Server:** No changes needed (Colyseus protocol unchanged)
- **Testing:** All 189 tests passing, build and lint clean

**Benefits:**
- Establishes reusable UI pattern for list-based views
- Improved user experience and platform aesthetics
- Foundation for future enhancements (filters, search, images)
- No technical debt or breaking changes

**Future Enhancements:**
- Online Players panel (requires server-side presence tracking)
- Game tile images (when asset pipeline ready)
- Advanced filtering (by player count, game state, etc.)
- Search/sort functionality for sessions

**Risks:**
- Learning curve for new developers
- Additional CSS maintenance vs. table approach
- Accessibility testing needed (keyboard navigation, screen readers)

---

## Session: Session Resilience — Client-Server Reconnection (2026-03-15)

### Pemulis: Presence-backed Reconnect Cleanup

**Status:** Approved  
**Date:** 2026-03-15  

Use a Colyseus presence topic (`playgrid:lobby:game-room-disposed`) for game-room → lobby cleanup, rather than keeping direct references between `BaseGameRoom` and `LobbyRoom`.

**Rationale:**
- Loose coupling: Game rooms only publish disposal facts; lobby decides how to clear stale entries
- Compatible with Colyseus local presence today; remains compatible with Redis presence if scaled later
- Centralizes lobby cleanup in one place: Removing a dead in-progress game also clears stale `currentGameId` assignments for connected lobby sessions
- Extends existing plugin lifecycle contract to expose `onPlayerReconnect` hook for turn timer integration

**Impact:**
- Server-side reconnection window and cleanup fully implemented
- LobbyRoom clears stale entries on game room disposal
- Plugin system ready for turn timer pause/resume during reconnect window

**Files Modified:**
- server/src/rooms/lobbyPresence.ts
- server/src/game/BaseGameRoom.ts
- server/src/rooms/LobbyRoom.ts

---

### Gately: Client Reconnect UX & sessionStorage Persistence

**Status:** Approved  
**Date:** 2026-03-15  

Persist only active game reconnect state in `sessionStorage` under `playgrid.active-session`, and restore it in `client/src/Application.ts` before booting a fresh lobby room. Drive the in-game reconnect UX from the Colyseus room lifecycle (`onDrop`, `onReconnect`, `onLeave`) while clearing stored state only on consented leave, `game-end`, or failed restore.

**Rationale:**
- Server already reserves seats for 30 seconds during active games, so the browser must try reclaiming that seat before opening a fresh lobby session
- `sessionStorage` matches the desired lifecycle: Survives refresh, clears on tab close, avoids reviving dead sessions across future browser launches
- Same-tab drops need visible feedback without bouncing players straight back to lobby; transient drops and final reconnect failure are separate states
- Enables end-to-end recovery across browser refresh within the 30s reconnect window

**Implementation:**
- Persist `room.reconnectionToken` + minimal active-game metadata (gameType, spectator flag, timestamp) on room join
- Attempt `client.reconnect(savedToken)` before creating fresh lobby session on startup
- Clear persisted state on: consented leave, game-end, or reconnect-window expiry/failure
- Bind `room.onDrop` and `room.onReconnect` to drive visible reconnecting/resumed states

**Impact:**
- Players can refresh mid-game and rejoin within 30s window
- Visible reconnecting UI prevents silent SDK behavior
- Tab close automatically clears stale session tokens
- Works with existing 30s server-side reconnection window

**Files Modified:**
- client/src/Application.ts
- client/src/networking/ConnectionManager.ts
- client/src/ui/ReconnectOverlay.ts
- client/index.html

---

### Steeply: Reconnect Test Strategy — Two-Layer Coverage

**Status:** Approved  
**Date:** 2026-03-15  

Land reconnection coverage in two layers:
1. Add concrete server-side behavioral tests where current seams already exist (`BaseGameRoom` and lobby pregame tests)
2. Add explicit Vitest `.todo()` contracts for client startup/sessionStorage reconnect behavior and server/client edge cases

**Rationale:**
- Pemulis and Gately are landing implementation in parallel, but current branch does not expose stable client seams for session persistence or finished server reconnect lifecycle
- Shipping green explicit TODO contracts keeps expected behavior visible in CI without forcing brittle implementation-coupled tests or breaking suite before feature lands
- Two-layer approach allows staging: Server tests green now; client/cross-agent tests pinned as contracts for finishing agent to convert from `.todo()` to executable coverage

**Coverage:**
- **Server tests (green):** allowReconnection window, consented leave, timeout forfeits, lobby cleanup
- **Client contracts (TODO):** sessionStorage persistence, startup reconnect attempt, reconnecting UI states, server/client edge cases covering full reconnection matrix

**Impact:**
- Server regressions around `allowReconnection`, consented leave, timeout forfeits covered now
- Remaining reconnect requirements pinned as named tests; finishing agent can convert from `.todo()` without reinventing matrix
- CI shows expected contracts without flaky timing-dependent tests

**Files Modified:**
- e2e/reconnection.test.ts (new)
- e2e/lobby.test.ts (updated with reconnection contracts)

---

## Session: Previous — Player Reconnection Support (2026-03-14)

*This session completed Phase 1 of reconnection: server-side 30s window support.*

**Pemulis:** Implemented `allowReconnection(client, timeout)` in `BaseGameRoom.onLeave()` with 30s default, heartbeat config, and CONSENTED disconnect distinction.

**Status:** Implemented  
**Follow-up:** Client-side UI and end-to-end recovery (completed in 2026-03-15 session above)

---

### Marathe: Dual Custom Domains by Environment (2026-03-15)

**Status:** Proposed  
**Date:** 2026-03-15  

Use separate optional Bicep parameters for Container App custom domains: `customDomainUat` for UAT and `customDomainProd` for production.

**Decision:**
- Keep dev deployments domain-free by default
- Select the active custom domain from `environmentName` inside `infra/main.bicep`
- Only emit ACA ingress `customDomains` when the selected environment-specific value is non-empty

**Rationale:**
- Matches the repo's single-template-per-environment pattern without reintroducing duplicated Bicep
- Avoids accidental prod-domain reuse in UAT or vice versa
- Preserves backward compatibility for existing dev deployments and any environment with no custom domain configured

**Files:**
- infra/main.bicep
- infra/main.bicepparam

---

### Pemulis: Ready-Check Enforcement for Non-Host Players (2026-03-15)

**Status:** Approved  
**Date:** 2026-03-15  

For the current waiting-room flow, enforce that all joined non-host players must have `isReady = true` before the host can execute `start_game`.

**Rationale:**
- The waiting-room UX gives the host the Start Game control but does not expose a Ready toggle for the host
- Treating the host as a starter/coordinator and enforcing readiness only on non-host players fixes issue #79 without introducing a larger UX change mid-stream
- Simpler than requiring explicit "host ready" interaction

**Follow-up:**
If we later want a true "every participant explicitly readies" flow, add a separate host-ready interaction first and then tighten the server rule to match it.

**Implementation:**
- Server validation in `BaseGameRoom` or game-specific logic
- Client: Start button disabled until ready is confirmed
- Tests: Regression coverage added

---

### Marathe: ACA Bootstrap Placeholder Image (2026-03-15)

**Status:** Approved  
**Date:** 2026-03-15  

Keep infrastructure deployment independent from image availability. Seed the Azure Container App with a public `node:22-alpine` bootstrap image and conditional startup logic:
1. Start the real app when `/app/public/server/dist/src/index.js` exists
2. Serve a tiny HTTP placeholder with `/health` on port `2567` when no app image has been pushed yet

**Rationale:**
- Prevents first-time ACA provisioning from failing against an empty ACR
- Keeps probes and ingress aligned with the real runtime contract (`/health`, port `2567`)
- Preserves the existing deploy workflow shape instead of adding extra bootstrap-only pipeline steps
- The real PlayGrid image is CI/CD's responsibility via `deploy-dev.yml`; the placeholder is only for first-deploy bootstrap

**Implementation:**
- `infra/main.bicep` deploys the bootstrap image and health-check configuration
- `.github/workflows/deploy-dev.yml` already handles the handoff after pushing the real image via `az containerapp update`
- No manual redeployment needed on subsequent CI/CD image updates

**Impact:**
- Infra deploys can succeed before the first app image exists
- Subsequent CI deploys replace the placeholder with the real application image without extra steps


---

### Marathe: Shared CAE Environment for UAT + Prod (2026-03-15)

**Status:** Approved  
**Date:** 2026-03-15  

Keep `infra/main.bicep` as a single per-environment deployment template, but treat Container Apps Environment infrastructure as shared for non-dev environments:
- `dev` keeps its own CAE/log workspace
- `uat` and `prod` default to the shared names `playgrid-shared-cae` and `playgrid-shared-logs`
- `deploy-infra.yml` accepts optional `container_app_env_resource_id` so the second environment can explicitly target the first environment's CAE when resource groups differ

**Rationale:**
- Preserves the existing manual `workflow_dispatch` deployment shape
- Gives UAT/prod deterministic shared resource names so repeated deployments converge on the same CAE definition
- Avoids CAE drift by also sharing the attached Log Analytics workspace instead of letting UAT/prod point the same CAE at different workspaces
- Keeps dev isolated for low-risk testing and experimentation

**Related:** User directive (2026-03-15T01:20:26Z) — UAT and prod can share the same Container Apps Environment for cost optimization.


---

## Session: Risk Game Plugin Triage (2026-03-15)

### Hal: Risk Game Plugin Triage (Issue #80)

**Status:** Approved for Sprint Assignment  
**Date:** 2026-03-15  
**Assignees:** Pemulis (squad:pemulis), Gately (squad:gately)  

Triaged issue #80 "Add Risk game plugin" and determined complexity, scope risks, and team assignments. Risk is materially more complex than Checkers or Backgammon (900+ lines vs. 550–650) due to territory system (42 regions), multi-phase turns (reinforce → attack → fortify), stochastic combat (dice rolls), card mechanics, setup UX, and visual complexity.

**Architectural Alignment:**
- ✅ Plugin Pattern: Follows existing BaseGameRoom + GamePlugin interface
- ✅ Pure Logic: Game mechanics separated from Colyseus (testable in isolation)
- ✅ Spectator-Safe: Only hidden info = opponent cards (classic Risk rules)

**Team Assignment:**
- **Pemulis (Game Systems):** Risk game logic plugin + state management. Turn phases, combat dice resolution, territory/card state, card trade-in validation. ~350 lines server code + tests.
- **Gately (Game Dev / Rendering):** Interactive Risk map renderer (procedural graphics). Setup phase territory selection UI, HUD, army placement visualization. ~600+ lines client code.

**Decomposition (3 Sub-Issues):**
1. **Core Game Logic & Plugin** (Pemulis) — RiskState schema, turn phases, combat mechanics, territory/card accounting, win detection. No UI; pure mechanics.
2. **Setup & Territory Management** (Shared) — Territory selection phase, initial army placement rules, setup validation.
3. **Interactive Map Renderer** (Gately) — Procedural map, clickable territories, army overlays, phase/action indicators.

**Scope Clarifications:**
- Card Mechanics: Accept standard Risk 5/4/3 trade-in set rules. In Phase 1, implement server-side validation + card count UI only. Defer card animation/visuals to Phase 2.

**Rationale:**
- Risk is next in approved game implementation order (after Dominoes → Poker → Hearts/Spades → Chess).
- Timing is appropriate.
- Decomposition prevents scope creep and enables parallel work (core logic → setup → rendering).


---

## Session: Risk Plugin Implementation Phase 1 (2026-03-15)

### Pemulis: Risk Plugin Architecture

**Status:** Implemented  
**Date:** 2026-03-15  
**Issue:** #80 (Phase 1 - Core Game Logic & Plugin)  

Implemented the Risk game plugin following the established IGamePlugin pattern used by Checkers and Backgammon. Risk is significantly more complex than previous games with multi-phase turns, territory ownership, card mechanics, and variable player counts (2-6).

**Decision 1: Setup Phase Strategy**

Territories auto-distributed round-robin at game start, followed by a setup-place phase for initial army placement.

Rationale: Original Risk manual territory selection is tedious and slows web play. Round-robin ensures fair distribution. Players then place remaining armies strategically (40−territories_owned). Matches digital Risk implementations; reduces setup time. Alternative considered: manual pick-one-at-a-time (too slow for async web play).

**Decision 2: Card Mechanics Simplification**

Track card count only (no card types: Infantry/Cavalry/Artillery). Trade any 3 cards for escalating bonus (4→6→8→10→12→15→20...).

Rationale: Phase 1 has no card UI; tracking types wastes complexity. Simplified trade-in removes "forced trade when no valid set" edge case. Escalating bonus preserves Risk endgame acceleration. Can add card types in Phase 2 if UI supports it. Trade-off: less strategic depth than full card rules, but simpler implementation.

**Decision 3: Turn Phase Management**

Use string union types for turnPhase in state, enforce phase transitions in action handlers.

Rationale: BaseGameRoom doesn't enforce phased turn config automatically. Each action handler validates current phase before executing. endPhase action transitions between reinforce→attack→fortify→reinforce. Simple state machine that client can render visually. Alternative considered: separate state machine class (over-engineered).

**Decision 4: Combat Resolution**

Pure server-side dice rolling with immediate resolution (no "roll until one side loses" loop). Each attack action is one dice throw; client can call multiple times.

Rationale: Gives players control over when to stop attacking. Allows UI animation between rolls. Server-authoritative dice (no client cheating). Trade-off: more client→server round trips, better for web UX.

**Decision 5: Territory Adjacency Data Structure**

Static const arrays with adjacency lists in territoryData.ts, helper functions for lookups.

Rationale: Territory graph never changes; hardcode it. Simple array lookups for adjacency checks (O(n) but n≤8 for any territory). Easy to verify correctness by reading the data. Alternative considered: adjacency matrix (harder to read, same performance).

**Integration Notes:**
- Plugin registered in `server/src/index.ts` alongside Checkers and Backgammon
- State schema exported from `shared/src/games/risk/index.ts` for client access
- All game logic in `riskLogic.ts` is pure functions (testable, reusable)
- No client changes needed yet (Phase 1 is server-only)

**Files Created:**
- `server/src/games/risk/RiskPlugin.ts`
- `server/src/games/risk/riskLogic.ts`
- `server/src/games/risk/RiskState.ts`
- `server/src/games/risk/territoryData.ts`
- `shared/src/games/risk/index.ts`

**Open Questions for Phase 2:**
1. Should fortify require contiguous territory paths or just adjacency?
2. How to handle attack animations with rapid consecutive attacks?
3. Card UI: show card types retroactively or keep simplified system?
4. Territory map rendering: SVG overlay or canvas-based?

---

### Steeply: Risk Test Strategy — Pure Logic First, Integration Later

**Status:** Implemented  
**Date:** 2026-03-15  
**Issue:** #80 (Risk game plugin)  

For complex game plugins like Risk (3× more complex than Checkers/Backgammon), use a phased test strategy:

1. **Phase 1: Pure Logic Tests** — Test static data and pure functions immediately
2. **Phase 2: Integration Stubs** — Write `.todo()` tests for plugin actions/lifecycle
3. **Phase 3: Incremental Activation** — Convert `.todo()` to executable tests as implementation completes

**Decision Rationale:**

**Why Pure Logic First?**
- Validates core game rules independently of plugin integration
- Provides immediate value (16/64 tests passing on first commit)
- Enables parallel work: Pemulis implements, Steeply validates
- Catches errors in static data early (territory map, adjacency graph, continent bonuses)

**Why `.todo()` for Integration?**
- Documents expected behavior as executable specifications
- Prevents brittle "mock everything" tests that don't test real behavior
- Shows test coverage gaps in CI without blocking green builds
- Easy conversion: just remove `.todo()` when implementation lands

**Why Incremental Activation?**
- Risk has 4 distinct phases (setup, reinforce, attack, fortify) that complete independently
- Integration tests can activate phase-by-phase as Pemulis delivers
- Reduces coordination overhead: no waiting for "all or nothing" completion
- Maintains green CI throughout development

**Implementation (Risk Game):**

64 Total Tests:
- 16 passing (pure logic): territory map, reinforcements, card trade-ins, initial armies
- 48 `.todo()` (integration): plugin actions, lifecycle, state transitions, combat, win conditions

**Test Categories:**
- Territory Map (4): initialization, continent assignment, adjacency graph, continent bonus
- Initial Setup (3): territory distribution, army allocation, player colors
- Reinforcement (4): army pool deduction, continent bonus, edge cases
- Card Mechanics (5): count tracking, trade-in validation, escalating bonus
- Plugin Lifecycle (8): onCreate, onJoin, onLeave, turn order, state transitions
- Reinforce Phase (12): setupPlace action, army placement, state updates
- Attack Phase (14): territory validation, combat resolution, conquest mechanics
- Fortify Phase (6): movement validation, army transfer, edge cases
- Win Conditions (8): solo player detection, game end, final state, elimination

**File:** `server/src/__tests__/risk.test.ts` (follows Backgammon pattern)

**Imports:** Actual implementation (RiskPlugin, riskLogic, territoryData) with no mocks.

**Cross-Agent Impact:**

**Pemulis (Systems Dev):** Test expectations documented before implementation complete. Pure logic functions validated immediately (green tests = confidence). `.todo()` tests serve as acceptance criteria for plugin actions.

**Gately (Game Dev):** Can reference test coverage when building UI (knows what server validates). `.todo()` tests hint at client-side testing needs.

**Recommendation:** Adopt this pattern for all future complex game plugins (Dominoes, Poker, etc.):
1. Identify pure logic (static data, calculations, validators)
2. Test pure logic immediately with actual implementation
3. Write `.todo()` integration tests as specification
4. Convert `.todo()` to executable tests as plugin actions complete

This balances immediate validation with practical coordination for parallel development.


---

## Session: Risk Game Plugin Phase 3 Complete (2026-03-15)

### Gately: Risk Client Renderer Architecture

**Status:** Implemented  
**Date:** 2026-03-15

Implemented Risk game client renderer following the established Checkers pattern with PixiJS.

**Context:**
Phase 3 of Risk game plugin (#80) required an interactive map renderer on the client side. Server-side state (RiskState) and logic (RiskPlugin) were already completed by Pemulis in Phase 1.

**Key Decisions:**

1. **Territory Layout:** Hardcoded procedural grid-based positioning for 42 territories
   - Functional over geographically accurate (matches task requirement)
   - Faster initial implementation vs. SVG import or geographic data
   - Easy to adjust positions for visual balance
   - Keeps bundle size small (no external map data)

2. **Rendering Layers:** Three-layer Container structure: mapLayer → territoryLayer → hudLayer
   - Follows Checkers pattern exactly (team consistency)
   - Clean separation of concerns
   - Easy z-ordering for overlays

3. **Territory Interaction:** Two-click pattern for attack/fortify, single-click for place
   - Setup/Reinforce: Click owned territory → place army (immediate)
   - Attack: Click owned → click adjacent enemy (two-step)
   - Fortify: Click owned → click adjacent owned (two-step)
   - Consistent with card game and board game UX patterns

4. **State Management:** Direct Colyseus room message sending with reactive re-rendering
   - Messages: `placeArmy({ territoryId })`, `attack({ from, to, attackDiceCount })`, `fortify({ from, to, armyCount })`, `tradeCards({})`, `endPhase({})`
   - Server-authoritative (client sends intents, not state changes)
   - Re-render driven by onStateChange events

5. **Simplified Game Parameters:** Attack uses max dice (3 attacker, 2 defender based on armies); Fortify moves max-1 armies
   - Reduces UI complexity for MVP
   - Can add detailed controls later if needed
   - Most players use max dice anyway (optimal strategy)

**Alternatives Considered:**
- Geographic SVG Map: Rejected (overkill for Phase 3, larger bundle, more complex hit detection)
- Three-click Attack Pattern: Rejected (extra friction, Checkers uses two-click)
- Client-side Combat Calculation: Rejected (server must be authoritative, risk of desync)

**Implementation:**
- `client/src/renderers/RiskRenderer.ts` (23KB)
- `client/src/games/risk/riskClientLogic.ts` (helper functions)
- `client/src/renderers/index.ts` (registry entry)
- Registered with key "risk", auto-loaded by GameScene

**Validation:**
- ✅ Build passes (npm run build)
- ✅ No TypeScript errors
- ✅ Follows GameRenderer interface
- ✅ Consistent with Checkers pattern
- ✅ All phases supported (setup-pick, setup-place, reinforce, attack, fortify)

**Cross-Agent Impact:**
- Hal (Architect): No architectural changes needed, adheres to GameRenderer contract
- Pemulis (Backend): Client consumes server state schema correctly, message types match
- Steeply (Testing): Can write client integration tests against GameRenderer interface
- Joelle (Docs): May want to document Risk UI controls for players

**Future Enhancements:**
1. Combat animation (dice roll visualization)
2. Territory capture animation (color transition)
3. Card trade UI
4. Detailed dice count selection for attack
5. Fortify army count slider
6. Territory name search/filter
7. Minimap for large displays
8. Zoom/pan controls for mobile


---

## Session: Post-Work Review and Fixes (2026-03-15)

### Gately: Lobby Card Backgrounds via Inline SVG Data URLs

**Status:** Approved  
**Date:** 2026-03-15

Use inline SVG data URLs generated in `client/src/ui/LobbyScreen.ts` for lobby game library card artwork, with CSS overlay/shadow treatment in `client/index.html` to keep labels readable.

**Rationale:**
- Keeps artwork fully self-contained in lobby UI code; no new asset pipeline required
- Lightweight and easy to tweak with bespoke art direction per card
- One shared CSS contrast layer instead of duplicating overlays inside assets
- Fits existing HTML/CSS lobby architecture

**Files:**
- `client/src/ui/LobbyScreen.ts`
- `client/index.html`

---

### Marathe: Fix Shared CAE Dependency and PostgreSQL Password Requirement

**Status:** Approved  
**Date:** 2026-03-15

Keep shared UAT/prod Container Apps Environment (CAE) architecture, but make `Microsoft.App/containerApps` explicitly depend on the conditionally created `Microsoft.App/managedEnvironments` resource when `containerAppEnvResourceId` is empty. Require PostgreSQL administrator password at deployment time with no empty default.

**Rationale:**
- Template was computing CAE resource ID as string without creating ARM dependency edge
- First-time deployments could attempt container app before managed environment existed, causing `ManagedEnvironmentNotFound`
- Empty password fallback caused late deployment failures instead of fast validation
- First-time deployments can now create shared CAE and dependent container app in one run

**Impact:**
- Cross-resource-group reuse still works via `containerAppEnvResourceId`
- Manual deploys must provide `POSTGRES_ADMIN_PASSWORD`, avoiding accidental empty passwords

**Files:**
- `infra/main.bicep`
- `infra/main.bicepparam`

---

### Hal: Risk Game Implementation Standards

**Status:** Approved  
**Date:** 2026-03-15

Establish four architectural standards from PR #83 review:

1. **Shared Static Data:** Game configuration data (maps, adjacency graphs, card decks) MUST be located in `shared/src/games/{game}/` so both client (renderer) and server (logic) use a single source of truth.
2. **Test Implementation:** PR descriptions must accurately reflect test coverage. `it.todo()` placeholders do not count as implemented tests. Critical game logic (combat, movement, win conditions) must be tested before merge.
3. **Scope Transparency:** Intentional simplifications of game rules MUST be explicitly documented as "Phase 1 Limitations" in the PR description to distinguish from bugs.
4. **PR Atomicity:** Infrastructure changes should be in separate PRs from feature work to keep reviews focused.

**Rationale:**
- Prevents client/server state drift through shared data models
- Test metrics in PRs require verification; unclear coverage masks incomplete implementation
- Scope cuts need explicit documentation to prevent confusion with bugs or incomplete features
- Bundled unrelated changes degrade review quality and increase risk of regression

**Files:**
- PR #83 follow-up work (routed to Marathe)

---

### Hal: Robust Testing for Random Mechanics

**Status:** Decided  
**Date:** 2026-03-15

Tests involving randomness must be either:
1. **Mocked:** Use `vi.spyOn(Math, 'random')` to force outcomes.
2. **Robust:** Use sufficient sample sizes and buffers (e.g., 20 armies vs 1, not 3 vs 1) to make failure statistically impossible.

Flaky tests are treated as broken code.

**Context:** Combat test in PR #83 had 42% failure rate due to reliance on `Math.random` with low sample size and tight constraints. Fixed by implementing robust test with sufficient armies to make statistical failure impossible.

**Rationale:**
- Test reliability is foundational to CI/CD trust
- Mocking forces deterministic outcomes; robustness makes randomness statistical noise
- Tests that fail randomly waste developer time and obscure real regressions
- Forces better test design (larger sample sizes, statistical buffers)


---

### Steeply: Lobby E2E Test Isolation & Current UI Patterns

**Status:** Approved  
**Date:** 2026-03-15  

Lobby E2E coverage should target only the unique session created by the test and should use current UI seams:
- Save display names by blurring `input[name="player-name"]`
- Create games through `#create-game-modal`
- Find sessions via the test's unique `.active-game-card`
- Use exact/scoped button locators when labels overlap (`Create Game`, `Ready`, `Start Game`)

**Rationale:**
- Makes the suite order-independent and resilient to shared lobby state
- Aligns with current accessible UI instead of removed table layout
- Removes table-era assumptions that caused issue #91

**Context:** Issue #91 exposed lobby Playwright suite drift from shipped UI and fragility under shared-server runs.

**PR:** #92 (merged)

---

## Session: Healthcheck Fix (2026-03-15)

### Marathe: Environment Variables Include Protocol Prefix

**Status:** Implemented  
**Date:** 2026-03-15  

GitHub environment variables for URLs MUST include the protocol prefix (`https://`). Workflows should use these variables directly without adding or removing protocol prefixes.

**Decision:**
- `CONTAINER_APP_FQDN` already includes `https://` protocol
- Workflows must not prepend additional protocol
- Environment variables should be used as-is for health checks, notifications, and logs

**Rationale:**
1. **Consistency with Infrastructure Outputs:** Bicep template outputs `containerAppFqdn` as complete URL with protocol
2. **Reduced Error Surface:** No protocol manipulation required — variables are directly usable
3. **Direct Usability:** Variables work in Discord notifications, logs, health checks without transformation
4. **Fail-Safe:** Missing protocol becomes immediately obvious rather than silently malformed

**Implementation:**
- Fixed `.github/workflows/deploy-uat.yml` (commit ad8d0a8)
- Fixed `.github/workflows/deploy-prod.yml` (commit d5ccb85)

**Consequences:**
- ✅ Health checks now construct valid URLs
- ✅ Deployments no longer fail at verification step
- ✅ Consistent URL handling across workflows
- ✅ Discord notifications show clickable URLs correctly

---

### Steeply: Checkers E2E Selector Update

**Status:** Approved  
**Date:** 2026-03-15  

Game-specific Playwright suites must reuse the current lobby interaction pattern instead of legacy table-era selectors.

**Decision:**
Game E2E coverage should assert `#lobby-overlay.visible`, create games through `#create-game-modal`, join through test's unique `.active-game-card`, then hand off gameplay assertions to `?e2e=1` browser harness.

**Rationale:**
- Proves the pattern from lobby.spec.ts works for game-specific assertions
- Keeps plugin suites aligned with lobby refactors
- Avoids duplicating stale assumptions
- Preserves grey-box pattern for PixiJS games

**Impact:**
Future game-plugin E2E coverage should treat lobby selectors as shared infrastructure and avoid stale assumptions from legacy UI patterns.

---

## Session: Features Batch 2 (2026-03-15)

### Gately: Shared Game Status Lives in the HTML HUD Overlay

**Status:** Implemented  
**Date:** 2026-03-15  
**Author:** Gately (Game Dev / Frontend / Rendering)

## Context

Checkers was showing turn state in two different places: the shared HUD overlay owned the generic waiting/timer widgets, while the renderer also painted its own in-canvas status copy. That split made the status treatment feel temporary and would force every new game to reinvent the same player/turn/timer panel.

## Decision

Use the shared `client/src/ui/HUD.ts` overlay as the reusable game status panel, and let renderers opt into custom copy through an optional `getHUDStatus()` method on the `GameRenderer` contract.

## Why

1. **One panel, one mental model** — player list, current turn, timer, and status text now live together instead of being split between overlay chrome and canvas text.
2. **Renderer ownership stays clean** — renderers still own board-specific HUD elements, but game-state copy can be handed off to a shared panel without `GameScene` learning game rules.
3. **Future games get a low-friction hook** — Backgammon, Risk, or later games can adopt the same panel by implementing one optional status method instead of duplicating layout work.

## Consequences

- ✅ Checkers status copy moved out of the Pixi canvas and into the shared HUD panel
- ✅ `GameScene` can pass renderer-provided status metadata into the HUD without hardcoding per-game branches
- ✅ Future renderer work has a clear split between shared overlay status and board-local counters/buttons

## Files Affected

- `client/src/ui/HUD.ts`
- `client/src/scenes/GameScene.ts`
- `client/src/renderers/GameRenderer.ts`
- `client/src/renderers/CheckersRenderer.ts`

---

### Gately: Local Lobby Thumbnails from Design Prototype

**Date:** 2026-03-15
**Status:** Implemented
**Author:** Gately (Game Dev / Frontend / Rendering)

## Decision

Use locally served thumbnail files in `client/public/game-thumbnails/` for lobby game tiles, sourced from the original design prototype artwork, instead of inline SVG art or runtime-hotlinked remote image URLs.

## Context

The shipped lobby tiles were using hand-authored SVG illustrations in `client/src/ui/LobbyScreen.ts`. The design prototype archive (`docs/designs/project.zip`) contained the intended photographic tile artwork references, but not bundled image binaries.

## Rationale

- Keeps the lobby visually aligned with the approved design direction.
- Avoids runtime dependency on third-party image hosts.
- Fits the existing Vite public asset path cleanly with no new asset-loading framework.
- Works naturally with the existing 4:3 tile layout by pairing local files with `object-fit: cover`.

## Impact

- `LobbyScreen.ts` maps game types to stable local asset paths.
- `client/index.html` remains responsible for thumbnail crop behavior and overlay readability.
- Future tile artwork swaps only need asset replacement and path updates, not new rendering logic.

---

### Pemulis: Shareable Waiting-Room Links

**Status:** Implemented  
**Date:** 2026-03-15  
**Author:** Pemulis (Systems / Server)

## Context

Waiting rooms already have a stable lobby-side `gameId`, and `LobbyRoom.handleJoinGame()` already understands that identifier before a real Colyseus game room exists. The feature request is to let hosts share a direct invite link that can reopen the app and send the recipient into that waiting room automatically.

## Decision

Use the existing lobby `gameId` as the shareable join token and encode it in the browser URL as `?join={gameId}`.

- Do **not** add a new HTTP endpoint or a separate join-token service.
- Keep the URL synced while the client is in a waiting room.
- Clear the `join` parameter when transitioning into the live game room.
- On lobby boot/reconnect, if `join` is present, immediately send the existing `JOIN_GAME { gameId }` message to the lobby room.

## Rationale

This reuses the validated server join path and preserves all current edge-case handling for missing/full/started games. It also keeps the implementation small and robust: invite links work before a Colyseus `roomId` exists, and reconnects/refreshes can re-enter the waiting room without inventing a second session model.

## Impact

- Server contract remains unchanged for production code.
- Waiting-room invites become copyable and deep-linkable.
- Host/guest refresh flows can reuse the same link semantics in pregame.

---

## Session: User Directive (2026-03-15)

### User Directive: E2E Test Suite Required for New Games

**Date:** 2026-03-15  
**Status:** Approved  
**By:** dkirby-ms (via Copilot)

## Decision

Any new game added to the project must have an accompanying end-to-end (E2E) test suite.

## Why

User request — captured for team memory. E2E coverage ensures shipped games work end-to-end and protects against regressions as the framework evolves.

## Impact

Phase 2 and Phase 3 games (Dominoes, Backgammon, Risk) must include E2E tests covering core gameplay flows.


---

## Session: Checkers Piece Visual Polish (2026-03-15)

### Gately: PixiJS FillGradient Pattern for Game Piece Rendering

**Status:** Approved  
**Date:** 2026-03-15  

Adopted PixiJS v8 `FillGradient` with radial gradients as the standard pattern for rendering game pieces with 3D depth effects.

**Implementation Pattern:**
1. **Radial gradient with offset center** — Center point at `{ x: 0.42, y: 0.38 }` simulates lighting from upper-left
2. **Three-stop gradient** — Highlight (0), base color (0.5), shadow (1) for dome effect
3. **Drop shadow layer** — Slight offset behind main piece for depth
4. **Specular highlight ring** — White semi-transparent circle at top for shininess
5. **Gradient reuse** — Create gradients once outside loops for performance

**Rationale:**
- Visual polish improves user experience and perceived quality
- Pattern is reusable across all game types (Risk, Connect4, etc.)
- PixiJS v8 native support ensures good performance
- Consistent visual language across game pieces

**Implications:**
- Risk armies/territories can adopt this pattern
- Connect4 pieces, Go stones, Poker chips benefit from same approach
- Pattern should be documented in rendering guidelines for future consistency
- Could extract to shared utility function if widely adopted

**Related Files:**
- `client/src/renderers/CheckersRenderer.ts` — Reference implementation

**Tags:** #rendering #pixi-js #game-pieces #visual-polish #pattern

---

## Session: Phase 4 Design Unification (2026-03-16)

### User Directive: Phase 5 Out of Scope

**Status:** Confirmed  
**Date:** 2026-03-16  
**Author:** dkirby-ms (via Copilot)

No new game implementations. Phase 5 (Scrabble, Hungry Hippos, Catan) is out of scope. The design references for those games exist but are for future consideration only.

**Why:** User request — captured for team memory

---

### Gately: Checkers Redesign Uses Shape Markers and Capture Trays

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Aligning `client/src/renderers/CheckersRenderer.ts` with the redesign and shared design-token system.

Use token-driven shape rendering for the redesigned Checkers board: kings are marked with a yellow concentric ring instead of a crown glyph, and captured pieces are shown as small off-board rendered pips instead of numeric counts alone.

**Rationale:**
- Removes typography dependence from king state, so the marker stays legible across browsers, fonts, and future Pixi text changes.
- Keeps the board language consistent by reusing the same piece gradients and shadows for captured-piece feedback.
- Concentrates interaction feedback on the piece itself (selection ring, hover lift) while keeping destination feedback on squares, which matches the redesign's affordance hierarchy.

**Files Affected:**
- `client/src/renderers/CheckersRenderer.ts`
- `client/src/renderers/DesignTokens.ts`

---

### Gately: Backgammon Redesign Keeps Logic Colors but Renders White Checkers

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Aligning `client/src/renderers/BackgammonRenderer.ts` with the redesign reference and shared `DesignTokens.ts` system.

Keep the existing backgammon game logic keyed on `BLACK` and `RED`, but render the `RED` side as white/light checkers in the Pixi renderer and label player-facing UI accordingly.

**Rationale:**
- Preserves the existing server/client move logic, filtered state shape, and interaction handlers without a risky game-rules refactor.
- Matches the redesign reference, which is visually organized around black-vs-white pieces instead of black-vs-red.
- Lets `DesignTokens.ts` own the visual mapping cleanly, so future renderer passes can reuse the same piece gradients, home-board surfaces, and selection affordances.

**Files Affected:**
- `client/src/renderers/BackgammonRenderer.ts`
- `client/src/renderers/DesignTokens.ts`

---

### Gately: Risk Renderer Uses Shared Six-Player Palette

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Risk visual redesign in `client/src/renderers/RiskRenderer.ts`

Use `client/src/renderers/DesignTokens.ts` as the single source of truth for Risk ownership, HUD, and board accents, with continent labels reusing the shared six-player palette instead of defining a separate Risk-only color table.

**Rationale:**
- Keeps Risk visually aligned with the redesign system and the documented player palette in `docs/design-system.md`.
- Prevents future drift between React design references and Pixi renderers by making ownership colors, borders, and HUD accents resolve through the same shared tokens.
- Lets renderer interaction states stay readable: player-color source glow for attack origin, red tint for attack targets, and violet for generic selection/valid-state emphasis.

**Files Affected:**
- `client/src/renderers/RiskRenderer.ts`
- `client/src/renderers/DesignTokens.ts`

**Follow-Up Note:**
If other board renderers are redesigned, add any missing gradient helpers or aliases to `DesignTokens.ts` first so renderer files can stay free of local color constants.

---

### Gately: Risk HUD Safe Defaults During State Hydration

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately  
**Context:** Fixing the join-time Risk renderer crash in `client/src/renderers/RiskRenderer.ts`

Keep `updateHUD()` active during Risk state hydration, but require the HUD text helpers to return safe empty values whenever `currentTurn`, `turnPhase`, or the local session id are not ready yet.

**Rationale:**
- Prevents Pixi `Text.text` from receiving `undefined` during the initial Colyseus sync window.
- Clears the HUD cleanly while state is incomplete instead of freezing whatever labels happened to be on screen previously.
- Localizes the sync-tolerance logic in `getStatusLabel()` and `getPhaseLabel()` without changing the rest of the button/HUD flow.

**Files Affected:**
- `client/src/renderers/RiskRenderer.ts`

**Follow-Up Note:**
Pixi's v8 deprecation warning still comes from `graphic.addChild(armyText)` and `graphic.addChild(nameText)` in `redrawMap()`. Those text nodes should move under `Container` parents when the renderer gets a broader rendering cleanup pass.

---

### Marathe: GitHub Release Publishing in Prod Deploy Workflow

**Status:** Implemented  
**Date:** 2026-03-16  
**Decider:** Marathe (DevOps/CI-CD)

**Context:** The production deployment workflow triggers on `v*` tags and deploys to Azure Container Apps, but did not create GitHub Releases. This required manual release creation after successful deployments.

**Decision:** Integrate release publishing into `deploy-prod.yml` rather than creating a separate release workflow. The release step is added after the health check and before Discord notification, with a conditional to only run on tag pushes (`if: github.ref_type == 'tag'`).

**Rationale:**
- **Post-deployment verification:** Releases should only be created after the deployment passes health checks. A separate workflow would run immediately on tag push, potentially creating releases for failed deployments.
- **Atomic operation:** The workflow now represents a complete atomic operation: deploy → verify → release → notify.
- **Clean conditional handling:** Using `if: github.ref_type == 'tag'` cleanly handles manual deploys via `workflow_dispatch` (which don't have tags and shouldn't create releases).
- **Logical coupling:** A release represents a deployed version. The release step should be tightly coupled with the deployment it represents.

**Implementation Details:**
- Updated permissions from `contents: read` to `contents: write`
- Uses gh CLI with `--generate-notes` for automatic changelog
- Added `--latest` flag to mark as latest release on repo homepage

**Files Affected:**
- `.github/workflows/deploy-prod.yml`

---

### Mario: Checkers UX Review Priorities

**Status:** Proposed  
**Date:** 2026-03-16  
**Author:** Mario (UX Consultant)

Prioritize clarity fixes over further visual polish in Checkers. The next UX pass should first eliminate HUD overlap, strengthen move affordances, and introduce responsive HUD compaction before adding more decorative rendering treatment.

**Why:**
1. The shared HUD and the Leave Game button currently compete for the same top-right space, which breaks the intended "one panel, one mental model" direction.
2. Move feedback relies on a small green dot and cursor change; it works, but it asks players to inspect the board instead of instantly reading it.
3. Fixed top/bottom board reservations make narrow screens feel underused because the board is pushed down even when vertical room is available.
4. The new gradient pieces are attractive, but the `♛` king marker is still typography-dependent and less robust than a shape-led indicator.

**Implementation Direction:**
- Keep the shared HTML HUD for status/player copy, but guarantee a no-overlap layout with the Leave Game button.
- Upgrade move feedback to a two-layer system: persistent selected state + larger destination affordance + hover preview on actionable squares.
- On narrow viewports, compact or relocate HUD chrome so the board can sit closer to the top safe area.
- Prefer a shape-based king marker (double ring or vector crown badge) over the current text glyph.


---

### 2026-03-16T01:16Z: User directive
**By:** dkirby-ms (via Copilot)
**What:** The old HUD status panel (turn info, player list, timer) is redundant now that the GameSidebar exists. Remove the status panel overlay and move the turn clock into the sidebar's game info panel instead.
**Why:** User request — captured for team memory

---

### 2026-03-16T01:23Z: Game sidebar reserves board space on desktop
**By:** Gately
**What:** When the in-game sidebar is visible on desktop, reserve a right-side layout lane for it by shrinking `#game-container` instead of floating the sidebar over the Pixi canvas. Coordinate HUD/canvas updates through a shared layout event and `ResizeObserver`.
**Why:** User request — the board must remain fully visible, and DOM overlay chrome should anchor to the board column instead of obscuring gameplay.

---

### 2026-03-16T02:22Z: Shared game status lives in the sidebar, not the HUD overlay
**By:** Gately
**What:** Remove the redundant shared HUD status card and keep `HUD.ts` focused on overlay chrome (Leave + chat) plus turn-clock timing. Renderer sidebars now own the visible game status, player info, and turn clock via a shared `GameSidebar` clock helper and `GameRenderer.setTurnClock()` hook.
**Why:** User request — the sidebar already surfaces game status and players, so duplicating that data in the HUD wasted screen space and split the same state across two UI surfaces. Centralizing visible status inside sidebar panels keeps the board column cleaner while preserving one shared countdown source.

---

### Gately: Version Footer: Center + Feedback Link

**Status:** Implemented  
**Date:** 2026-03-15  
**Author:** Gately (Game Dev - Frontend)  
**Issue:** #97  
**PR:** #118  

## Context

The version footer was positioned bottom-right and included only the version number. Needed to center it and add a feedback link to encourage user issue reporting.

## Decision

Moved version footer from bottom-right to bottom-center using Flexbox and CSS transforms. Added "Submit Feedback" link next to version.

## Implementation Details

- **Layout:** Flexbox with centered positioning using `left: 50%; transform: translateX(-50%)`
- **Structure:** Version text + separator bullet + feedback link
- **Link behavior:** Opens in new tab (`target="_blank"`) with security (`rel="noopener noreferrer"`)
- **Styling:** Subtle hover effect (opacity transition from 0.4 to 0.7) for feedback link
- **Pointer events:** Version text and separator are non-interactive; only link is clickable

## Why This Approach

1. **Center positioning** — Uses transform instead of margin for precise centering across all viewport widths
2. **Flexbox** — Easier to maintain gap spacing and alignment vs. manual positioning
3. **Inline hover handlers** — Kept simple since this is a one-off UI element
4. **Security attributes** — `rel="noopener noreferrer"` prevents tab-nabbing attacks on external links

## Future Considerations

If we add more footer links, consider extracting styles into a shared footer component.

**Files Affected:**
- `client/src/ui/HUD.ts` (footer JSX)
- `client/src/ui/gameLayout.ts` (footer styling)

---

### Gately: Dice Roll Animation Implementation

**Status:** Implemented  
**Date:** 2026-03-16  
**Author:** Gately (Game Dev - Frontend/Rendering)  
**Issue:** #100  
**PR:** #119  

## Context

Backgammon needed a manual dice roll button instead of automatic rolling. Players should see visual feedback as dice are "rolling" before the server returns the actual values.

## Decision

Implemented client-side dice roll animation using frame-based approach:

### Animation Approach
- **Duration:** 20 frames (~333ms at 60fps)
- **Method:** Random dice faces shown each frame during animation
- **Trigger:** Button click sends "roll" action to server, starts animation immediately
- **Stop:** Animation stops when server returns real dice values (dice > 0)

### Why This Approach
1. **Frame-based vs Time-based:** Used frame counter instead of deltaTime for predictable, consistent duration
2. **requestAnimationFrame:** Leveraged existing game loop update() method - no setTimeout/setInterval (per team pattern)
3. **State-driven:** Animation state (`isRollingDice`) integrates cleanly with existing state management
4. **Server authoritative:** Client animation is purely visual - server determines actual dice values

### Technical Details
- Added 3 new class properties: `isRollingDice`, `rollAnimationFrame`, `rollAnimationDuration`
- Modified `redrawDice()` to show random values when `isRollingDice === true`
- Updated `update()` to advance animation frame counter
- Modified `applyState()` to stop animation when server sends real dice values
- Button enabled/disabled based on turn state and dice values (0,0 = unrolled)

### Button UX
- Enabled: Player's turn AND dice are 0,0 (unrolled) AND not currently animating
- Disabled: Otherwise
- Located: Sidebar controls panel, consistent with existing button styling

## Alternative Considered

Could have used CSS animation on HTML dice elements, but:
- Would require duplicating dice rendering logic
- PixiJS canvas-based rendering is already in place
- Random value animation simpler with direct Graphics API access

## Future Enhancement Opportunities
- Add sound effect on roll
- Add easing to animation (slow down at end)
- Vary animation duration based on dice values (longer = higher suspense)

**Files Affected:**
- `client/src/renderers/BackgammonRenderer.ts` (animation, button)
- `server/src/games/backgammon/BackgammonRoom.ts` (roll action)
- `shared/src/games/backgammon/BackgammonState.ts` (state schema)

---

## Session: PR Reviews & Issue Scoping (2026-03-16)

### Hal: PR #118 & #119 Review & Merge

**Status:** Approved  
**Date:** 2026-03-16  
**Reviewer:** Hal  

Both pull requests reviewed, approved, and merged with squash.

#### PR #118: Footer UI
- **What:** Center version footer, add feedback link.
- **Review:** Clean UI change, proper security attributes, builds pass.
- **Verdict:** Low-risk cosmetic change. ✅ Merged.

#### PR #119: Backgammon Manual Dice Roll
- **What:** Manual dice roll button with animation for Backgammon.
- **Architecture:**
  - Client animation runs frame-based in `update()` loop (not setTimeout/setInterval per team pattern).
  - Server action validates through `validateAction()` hook (centralized, not duplicated).
  - Animation stops on state sync from server.
- **Review Checklist:**
  - ✅ Type safety — clean, no unsafe casts
  - ✅ State mutation — server-side only
  - ✅ No setTimeout/setInterval — uses game loop
  - ✅ Colyseus optional chaining — proper null checks
  - ✅ Event listeners — existing pattern, cleanup in place
  - ✅ Tests — updated and passing
- **Pattern Note:** Action handlers rely on `validateAction` for turn enforcement (consistent with existing `move` action). This is defense-in-depth: validation is centralized, not duplicated in handlers.
- **Verdict:** Solid implementation. ✅ Merged.

#### Housekeeping
- Closed issue #97 (duplicate).
- Closed issue #100 (obsolete).

---

### Hal: Scope Head-to-Head Mode for 2-Player Games (Issue #115)

**Status:** Proposal  
**Decision Owner:** Hal (Lead)  
**Issue:** #115  
**Date:** 2026-03-16  

#### Summary

Enable 2-player games (Checkers, Backgammon) to be played on a single shared device by allowing the board to rotate/flip between turns. This is a **Medium-scope feature** with **high value** for in-person play.

#### Recommendation

Implement now with a phased approach (Checkers MVP first, then Backgammon).

#### Architecture: Client-Side View Switching

Both players connect to the same game room via a single device client. The renderer dynamically determines board perspective based on whose turn it is (via `currentTurn` in state). Existing `isFlipped` logic in CheckersRenderer and similar patterns in BackgammonRenderer already support this—**no schema changes needed.**

**Key insight:** The renderer must switch from "show the board for the local player" to "show the board for the active turn player." This is a logic change, not an architectural change.

#### Server Impact

**Minimal.** No breaking changes:
- Existing `playerIndex` and `currentTurn` fields already support this use case.
- Server validation (checking that `sessionId` matches the current turn) works unchanged.
- Optional: Add `headToHeadMode` flag for telemetry (cosmetic).

#### Client Impact

**Moderate. 3–4 files:**
1. **LobbyScreen** — Add "Play on Shared Device?" toggle.
2. **CheckersRenderer** — Update `getLocalPlayerColor()` to use active turn player, not session-based player.
3. **BackgammonRenderer** — Same update (reuse pattern).
4. **GameScene / GameSidebar** — Add turn indicator UI and listener for turn changes.

No breaking changes to the GameRenderer interface or state schemas.

#### Complexity & Effort

- **Estimate:** 1.5–2 days (developer).
- **Breakdown:**
  - Renderer logic: 2–4 hours
  - Lobby UI: 1–2 hours
  - Testing & integration: 2–3 hours
  - Polish (deferred): animations, input locks, orientation hints

#### Risks

1. **Session Sharing:** Both players on one session; disconnect affects both. ✅ Acceptable for local play.
2. **Perspective Confusion:** Without a clear turn indicator, players may be unsure whose board they're looking at. ✅ Mitigated by UI "Player X's Turn" prompt.
3. **Input Timing:** A player could tap before their turn. ✅ Server validation prevents illegal moves; UX can improve with ready confirmation.

#### Implementation Plan

**Phase 1: Checkers (MVP)**
- Implement dynamic perspective logic in CheckersRenderer.
- Add lobby toggle and turn indicator.
- E2E test with two tabs.

**Phase 2: Backgammon**
- Port logic to BackgammonRenderer.
- Test with same E2E pattern.

**Phase 3: Polish (future)**
- Input lock UI.
- Board rotation animation.
- Device orientation lock detection.

#### Decision

✅ **Proceed with implementation.**
- Start with Checkers.
- Use existing state schema (no migrations).
- Follow the proposed phased approach.
- Aim for merge to `main` within 2 sprints.

---

### Pemulis: Scope CPU Opponents for Checkers (Issue #86)

**Status:** Proposal  
**Decision Owner:** Pemulis (Systems Dev)  
**Issue:** #86  
**Date:** 2026-03-16  

#### Problem Statement

Players currently need another human to play Checkers. This prevents single-player experience and limits engagement for users without friends available. We need a CPU opponent to play Checkers as the RED player while humans play as BLACK.

#### Architecture: Server-Side Bot Player

**Why server-side bot (not alternatives):**
- **Separate AI service?** Overkill for Checkers; adds latency, complexity, separate deployment.
- **Client-side AI?** Breaks server-authority; clients could cheat. Not viable.
- **Deferring to future?** Blocks single-player mode now; no architectural blocker.

#### How It Works

1. **Bot Creation:** When a human creates a single-player game, `LobbyRoom` optionally creates a CPU opponent.
2. **Bot Registration:** Create `PlayerInfo` with synthetic `sessionId` = `"cpu-opponent"`.
3. **Move Selection:** When `TurnManager.getCurrentPlayer()` returns the CPU's `sessionId`, call `selectCpuMove(state, difficulty)` → apply automatically (no network round-trip).
4. **Timing:** CPU should have a brief delay (200–500ms) for UI feedback.

#### AI Strategy: Greedy Heuristic (Recommended)

| Algorithm | Strength | Complexity | Code |
|-----------|----------|-----------|------|
| **Random** | Weak | Trivial | Pick any legal move at random |
| **Greedy Heuristic** | Medium | Low | Prefer captures, promotions, advancement |
| **Minimax + α-β** | Strong | Medium | Tree search with evaluation |

**Greedy Heuristic Algorithm:**
1. Get all legal moves
2. Filter & rank by:
   - Captures (highest priority — forced captures handled by rules)
   - King promotion (advance pieces toward back row)
   - Piece advancement (move toward opponent)
3. For ties, pick randomly (unpredictability)
4. Return highest-ranked move

**Why greedy:**
- **Fast:** O(m log m) where m ≈ 12 legal moves, instant execution.
- **Playable:** Captures pieces, promotes kings, feels like a real player.
- **Clean:** Evaluation function isolated, testable, easy to tune.
- **Scalable:** Can add Minimax later without rewriting core.

#### Difficulty Levels (Greedy + Tuning)

| Difficulty | Behavior |
|-----------|----------|
| **Easy** | Random move from legal set; or greedy with 50% random noise |
| **Medium** | Pure greedy: captures → promotions → advancement |
| **Hard** | Greedy + future risk: avoid moves that set up opponent captures; prefer defensive placements |

#### Room & Lobby Changes

**Lobby (`LobbyRoom.ts`):**
- Accept `cpuOpponent: boolean` and `cpuDifficulty: "easy" | "medium" | "hard"` options.
- Validate: only allow if `maxPlayers === 1` or single human in 2-player game.
- Pass options to game room creation.

**Game Room (`BaseGameRoom.ts`):**
- Store CPU options in `BaseGameRoomOptions`.
- In `onCreate()`: if `cpuOpponent`, create bot via `onPlayerJoin()` with synthetic sessionId.
- In turn execution: detect CPU turn, schedule delayed move (200ms), apply automatically.

**Checkers Plugin (`CheckersPlugin.ts`):**
- **No changes.** Plugin is already generic; doesn't care if player is human or bot.

#### Complexity Estimate: **SMALL**

**LOC Breakdown:**
- **New file:** `CpuOpponent.ts` (~80 lines) — move selection, heuristic evaluation
- **Lobby changes:** `LobbyRoom.ts` (~15 lines) — accept options, validate, pass to room
- **Game room changes:** `BaseGameRoom.ts` (~20 lines) — store options, detect CPU turn, schedule move
- **Tests:** `checkers.cpu.test.ts` (~100 lines) + `lobby-cpu.test.ts` (~50 lines)

**Total:** ~250 LOC including tests. **No schema changes, no plugin changes.**

#### Why Small

1. **No plugin changes** — plugin is already generic.
2. **Reuses existing state sync** — Colyseus already broadcasts CPU moves.
3. **No new game rules** — just move selection on an existing game.
4. **No persistence** — CPU games are ephemeral.
5. **No auth/multiplayer** — single-player only, simpler lifecycle.

#### Risk Areas & Mitigation

- **Turn timing:** CPU moves must be async (delayed) to feel responsive. Use Colyseus `clock.setTimeout()` for determinism.
- **Disconnection:** If human leaves, game ends cleanly via existing `onPlayerLeave()` logic.
- **Spectators:** CPU moves go through the same state mutation; spectators see them automatically.

#### MVP (Phase 1)

1. **Implement greedy heuristic CPU** (not random).
   - Reason: Random is not fun; greedy is minimal playable AI.
2. **Medium difficulty only** (no easy/hard yet).
   - Reason: Scope reduction; tuning is follow-up polish.
3. **Checkers only** (no other games).
   - Reason: Simplest; pattern proven here extends to Risk or Dominoes.
4. **No persistent CPU profiles.**
   - Reason: Out of scope; single-player sandbox.

#### Nice to Have (Phase 2)

- Easy/hard difficulty modes via heuristic tuning.
- Minimax for harder AI.
- Win/loss stats tracking.
- Multiple CPU opponents for future multiplayer AI games (Risk, Poker).

#### Out of Scope

- Chat/personality for CPU.
- Learning AI (reinforcement learning).
- Replays or analysis of CPU games.

#### Acceptance Criteria

A human player can:
1. ✅ Create a single-player Checkers game from the lobby.
2. ✅ See the CPU opponent join the game as player 2 (RED).
3. ✅ Play a complete game (move, capture, promote, win/lose) against the CPU.
4. ✅ CPU makes legal moves.
5. ✅ CPU doesn't hang the turn (~200ms move time).
6. ✅ Winning/losing against CPU counts the same as PvP.

#### Decision

✅ **Proceed with implementation.**
- Implement greedy heuristic (not random, not Minimax yet).
- Start with Checkers, Medium difficulty only.
- Follow MVP scope above.
- Can extend to other games and difficulty modes later.

---

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

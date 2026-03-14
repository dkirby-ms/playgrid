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

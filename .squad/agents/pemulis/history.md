# pemulis — History

## Project Context
- **Project:** playgrid
- **Description:** Play classic games with friends
- **Studio:** eschaton-studio
- **Created:** 2026-03-14T01:09:23Z

## Learnings

### Game Systems Architecture (2026-03-14)

**Core Architecture Decisions:**
- **Plugin-based game system** — Each game is a self-contained module implementing a standardized `GamePlugin` interface
- **BaseGameState schema** — All game states extend a common base with player management, turn tracking, and game status
- **Server-authoritative validation** — All game logic and validation runs server-side; clients send action intents, not state mutations
- **State filtering for hidden information** — Card games and Dominoes require per-client state views filtered by the server

**Key Technical Patterns:**
1. **Lifecycle Hooks** — Games define `onCreate`, `onPlayerJoin`, `onGameStart`, `onGameEnd`, `onTick` for initialization and cleanup
2. **Action Handlers** — Map of action type → handler function returning `ActionResult` (success/failure, endsTurn, endsGame)
3. **Turn Management** — Generic `TurnManager` supports round-robin, random, or custom turn order; `PhasedTurnManager` for multi-phase games (Risk)
4. **Win Conditions** — Games implement `checkGameEnd()` called after every action and `validateAction()` for pre-execution checks

**Hidden Information Strategy:**
- Server holds complete unfiltered state
- `StateFilter` interface allows per-client filtering
- Manual broadcast to each client with their filtered view
- Critical for card games (Poker, Hearts, Spades) and Dominoes

**Implementation Order (by complexity):**
1. **Checkers (2/5)** — Simple rules, no hidden info, good first plugin to validate architecture
2. **Dominoes (2/5)** — First test of hidden information (hands, draw pile)
3. **Hearts (3/5)** — Card game with trick-taking, no betting, multi-round scoring
4. **Spades (3/5)** — Reuses Hearts' trick-taking, adds bidding phase
5. **Backgammon (3/5)** — Dice mechanics, complex movement validation, doubling cube
6. **Poker (4/5)** — Complex betting, hand evaluation, side pots
7. **Risk (5/5)** — Most complex: multi-phase turns, player elimination, largest state space

**State Size Estimates:**
- Checkers: ~200 bytes
- Dominoes: ~300 bytes
- Backgammon: ~500 bytes
- Card games: ~1-2KB
- Risk: ~5KB+

**Critical Insights:**
- **Forced jump chains** (Checkers) require tracking `mustCaptureFrom` state
- **Phased turns** (Risk) need separate turn phase tracking + phase-specific action sets
- **Card game filtering** must handle showdown reveals (make private hands public at end)
- **Backgammon doubling cube** adds strategic depth with minimal state overhead
- **Risk attack/defend** dice resolution needs careful highest-dice comparison logic

**Open Design Questions:**
- Spectator visibility of hidden info (recommendation: only revealed cards)
- Reconnection timeout (recommendation: 60s then forfeit/bot)
- Undo/redo support (recommendation: not for competitive)
- Time controls (recommendation: per-game configurable)

**Performance Considerations:**
- Use ArraySchema for homogeneous collections (faster than MapSchema)
- Cache valid move lists when expensive to compute
- State filtering slows broadcasts vs Colyseus auto-sync (only use when necessary)
- Complex validation (Risk pathfinding) may need memoization

---

### Cross-Agent Research Summary (2026-03-14)

**Hal (Lead)** produced `docs/architecture-plan.md` with:
- Server architecture patterns (LobbyRoom, GameRoom, plugin system)
- 3-phase scaling strategy with trigger conditions (50 games → multi-process, saturate → multi-server)
- Game plugin system design (IGamePlugin interface, BaseGameRoom)
- Single unified lobby for all game types
- SQLite → PostgreSQL migration path
- 8-phase implementation plan (~4-5 weeks for core games + infrastructure)

**Gately (Game Dev)** produced `docs/client-architecture.md` with:
- Scene management system (Lobby, Waiting Room, Game scenes with lifecycle)
- Game renderer plugin system with RendererRegistry
- Hybrid HTML/PixiJS UI (HTML for menus, PixiJS for games)
- Per-game rendering analysis and asset requirements
- Spectator mode with perspective selector
- Lazy asset loading, mobile-first design
- Risk pan/zoom viewport, touch pointer events

**Key Alignment:**
- Plugin architecture agreed across server (Hal), systems (me), client (Gately)
- Server-authoritative state with client input validation separation
- Hidden information filtering for card games (consistent approach)
- Turn management supports both simple and phased turns
- Game order aligned: Checkers → Dominoes → Card games → Complex games
- Asset dependencies identified and risk mitigation planned

### Environment Config Module (2026-03-14)

- Built `server/src/config.ts` as the server-side environment config module for P0 infrastructure.
- Exported a typed `config` object with `port`, `databaseUrl`, and `nodeEnv`, using `process.env` directly and local-safe defaults.
- Updated `server/src/index.ts` to consume `config.port` instead of reading `process.env.PORT` inline.
- Pattern used: centralize env parsing in one typed module, default invalid or missing values to development-safe settings, and import config from runtime entrypoints.

## Cross-Agent Update — Issue #1 Closed, PR #47 Open (2026-03-14)

**From:** Joelle (Community/DevRel)  
**Event:** Repo hygiene complete (issue templates, README refresh, CONTRIBUTING guide)

- **Issue #1:** Now closed. Repo hygiene work merged to dev branch.
- **PR #47:** Created (dev→prod) — "Core design: architecture docs, backlog, repo hygiene"
- **Available to you:** Issue templates (bug-report.yml, feature-request.yml, chore.yml), CONTRIBUTING.md, updated README.md
- **Impact:** All agents can now use structured issue templates and refer to CONTRIBUTING.md for contributor guidance.


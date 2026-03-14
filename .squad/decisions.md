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

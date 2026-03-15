# PlayGrid Architecture Overview

PlayGrid is a real-time multiplayer game platform built on a three-tier architecture: client, server, and shared types.

## System Architecture

```
┌──────────────────────────────┐
│    Client (PixiJS + Vite)    │
│  - Game rendering            │
│  - User input & UI            │
│  - WebSocket to Colyseus     │
└──────────────┬───────────────┘
               │ WebSocket
               │
┌──────────────▼───────────────┐
│  Server (Colyseus + Express) │
│  - Game room orchestration   │
│  - State synchronization     │
│  - Player management         │
│  - Database persistence      │
└──────────────┬───────────────┘
               │ SQL queries
               │
┌──────────────▼───────────────┐
│   Database (PostgreSQL)      │
│  - Player profiles           │
│  - Match history             │
│  - Game configuration        │
└──────────────────────────────┘
```

## Key Concepts

### Real-Time Synchronization

All game state lives on the server. Players connect via WebSocket using Colyseus, which automatically:
- Serializes server state and sends it to clients
- Merges player actions back to the server
- Maintains a single source of truth

### Room Types

Each game has a dedicated **Room** class in `server/src/rooms/`:

- **Chess Room** — Board state, move validation, player turns
- **Checkers Room** — Board state, jump detection, king promotion
- **Cards Room** — Deck, hand state, turn-based actions

Rooms are stateful and handle all game logic.

### Plugin Architecture

Games are pluggable via the `IGamePlugin` interface. To add a new game:

1. Create a room class implementing `IGamePlugin`
2. Define game rules and board/state schema
3. Register in the server's room dispatcher
4. Add client-side rendering component
5. Test with E2E tests

See [`game-systems-design.md`](./game-systems-design.md) for details.

## Data Flow

1. **Player Action** → Client listens to input (mouse, keyboard)
2. **Send Message** → Client sends action to server room
3. **Game Logic** → Server validates move and updates state
4. **Broadcast** → Server syncs new state to all players
5. **Render** → Client receives state and re-renders game board

## Technology Choices

| Component | Technology | Why |
|-----------|-----------|-----|
| **Server** | Colyseus | Real-time room-based games with automatic sync |
| **Client** | PixiJS | High-performance 2D rendering on canvas |
| **Build** | Vite | Fast dev server and bundling |
| **Language** | TypeScript | Type safety across monorepo |
| **Database** | PostgreSQL | Reliable persistence for player data and match history |
| **Testing** | Vitest + Playwright | Fast unit tests + visual E2E tests |

## Development Patterns

### Shared Types

All types live in `shared/src/types/`. Client and server both import from here to ensure compatibility:

```typescript
// shared/src/types/game.ts
export interface IGamePlugin {
  name: string;
  rules: GameRules;
  // ...
}

// server/src/rooms/ChessRoom.ts
import { IGamePlugin } from '@eschaton/shared';

// client/src/game/ChessGame.ts
import { IGamePlugin } from '@eschaton/shared';
```

### Database Schema

PostgreSQL tables handle:
- Player accounts and ratings
- Completed matches and results
- Game configuration and rules

Database is initialized on server startup and migrated as needed.

## Next Steps

- Start with [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup
- Review [`game-systems-design.md`](./game-systems-design.md) to add a new game
- Check [`client-architecture.md`](./client-architecture.md) for rendering details

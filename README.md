# playgrid

> Multiplayer classic board games, real-time. Built for friends.

PlayGrid brings timeless games like chess, checkers, and cards to life with real-time multiplayer gameplay powered by Colyseus and PixiJS. Start a match, challenge a friend, play instantly.

## Features

- ⚡ Real-time multiplayer using WebSockets
- 🎨 Smooth, responsive gameplay with HTML5 Canvas
- 🏗️ Built on the [Eschaton Studio](https://github.com/dkirby-ms/eschaton-studio) game development framework
- 🧪 Fully tested with Vitest

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server | Colyseus (WebSocket game server) |
| Client | PixiJS + Vite (HTML5 Canvas) |
| Shared | Pure TypeScript types and constants |
| Testing | Vitest |

## Getting Started

### Prerequisites
- **Node.js 22+** (with npm)
- **Docker Desktop** or **Docker Engine + Compose plugin** (recommended for local PostgreSQL)
- Git

### Development Setup (< 10 minutes)

1. **Clone and install:**
   ```bash
   git clone https://github.com/dkirby-ms/playgrid.git
   cd playgrid
   npm ci
   ```

2. **Create your local env file:**
   ```bash
   cp .env.example .env
   ```

3. **Start PostgreSQL for local development:**
   ```bash
   docker compose up -d postgres
   # or: npm run db:up
   ```

   This starts a local PostgreSQL 15 instance on `localhost:5432` with database `playgrid` and persists data in the `postgres-data` Docker volume. The server will run its migrations on startup.

4. **Start the dev environment:**
   ```bash
   npm run dev
   ```

   This runs both the client (PixiJS at `http://localhost:5173`) and server (Colyseus at `http://localhost:2567` / `ws://localhost:2567`) concurrently.

5. **Verify it's working:**
   - Open `http://localhost:5173` in your browser
   - Create a lobby and invite a friend (or open another browser tab)
   - Play!

### Local PostgreSQL Reference

- **Connection string:** `postgresql://postgres:postgres@localhost:5432/playgrid`
- **Start DB:** `docker compose up -d postgres`
- **Stop DB:** `docker compose down`
- **Follow logs:** `docker compose logs -f postgres`
- **Reset DB volume (destructive):** `docker compose down -v`

## Project Structure

```
playgrid/
├── client/              # PixiJS game client (Vite)
│   ├── src/
│   │   ├── components/  # Game rendering components
│   │   ├── pages/       # Lobby, game, and settings pages
│   │   └── game/        # Game-specific logic
│   └── dist/            # Built output
├── server/              # Colyseus multiplayer server
│   ├── src/
│   │   ├── rooms/       # Game room types (Chess, Checkers, etc.)
│   │   ├── database/    # PostgreSQL connection and queries
│   │   └── index.ts     # Server entry point
│   └── dist/            # Built output
├── shared/              # Shared TypeScript types
│   └── src/
│       ├── types/       # Game and room interfaces
│       ├── constants/   # Game rules and configuration
│       └── utils/       # Shared utility functions
├── e2e/                 # Playwright end-to-end tests
├── docs/                # Architecture and design guides
├── .squad/              # Team docs and decisions
└── package.json         # Monorepo workspace configuration
```

### Understanding the Plugin Pattern

Games in PlayGrid follow a plugin architecture. Each game implements the **`IGamePlugin`** interface:

```typescript
interface IGamePlugin {
  name: string;              // "Chess", "Checkers", etc.
  rules: GameRules;          // Move validation, board state
  stateShape: Schema;        // Serializable game state
  onMessage(action: string, payload: unknown): void;
}
```

**Adding a new game:**
1. Create a room class in `server/src/rooms/` (e.g., `ConnectFourRoom.ts`)
2. Implement `IGamePlugin` with your game rules and state
3. Register it in the server's room dispatcher
4. Add client-side rendering in `client/src/game/` 
5. Write E2E tests in `e2e/`

See [`docs/game-systems-design.md`](./docs/game-systems-design.md) for the complete plugin pattern spec.

## Development Workflow

### Running Tests

```bash
npm run test              # Unit and integration tests (Vitest)
npm run test:watch       # Watch mode for development
npm run test:e2e         # End-to-end tests (Playwright)
```

### Building for Production

```bash
npm run build            # Build all workspaces
npm run lint             # Lint TypeScript and JavaScript
```

## Deployment

PlayGrid is built for cloud deployment on Node.js with PostgreSQL. The server and client are independent:

- **Client:** Static HTML/JS/CSS bundle, served by any CDN or static host
- **Server:** Node.js Express + Colyseus, with PostgreSQL for persistence

See [`docs/`](./docs) for deployment architecture and environment configuration.

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Setting up your development environment
- Branch strategy and workflow
- Code style and testing practices
- How to submit issues and pull requests

For a deep dive into the architecture, see [`docs/architecture.md`](./docs/architecture.md).

## Squad Team

This project is managed by the Eschaton Studio squad. See [`.squad/team.md`](./.squad/team.md) for the team roster.

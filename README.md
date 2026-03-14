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
- Node.js 18+
- npm or yarn

### Development Setup

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Connect to your local game server and start playing.

## Project Structure

- **`client/`** — Web UI and game rendering (PixiJS, Vite)
- **`server/`** — Game server and match logic (Colyseus, Node.js)
- **`shared/`** — Shared types, constants, and utilities (TypeScript)
- **`docs/`** — Architecture, design decisions, and guides

For detailed architecture and design notes, see [`docs/`](./docs).

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Setting up your development environment
- Branch strategy and workflow
- Code style and testing practices
- How to submit issues and pull requests

## Squad Team

This project is managed by the Eschaton Studio squad. See [`.squad/team.md`](./.squad/team.md) for the team roster.

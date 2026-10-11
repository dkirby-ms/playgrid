# Contributing to PlayGrid

Thanks for your interest in contributing! This guide will help you get started.

## Development Environment

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/dkirby-ms/playgrid.git
cd playgrid
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`.

## Workflow

### Branch Strategy

We use trunk-based development on **`main`**:

1. **Feature/fix branches** branch off from `main`
2. **Open a PR** against `main`; CI (audit, lint, test, build) must pass
3. **Merge to `main`** once approved
4. **Release** runs automatically after CI: semantic-release reads
   [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, ...),
   tags the version, and updates `CHANGELOG.md`
5. **CD** then builds the image, pushes it to GHCR, and deploys to Azure Container Apps

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

## Issues and Pull Requests

### Reporting Issues

- Use the [bug report](https://github.com/dkirby-ms/playgrid/issues/new?template=bug-report.yml) template for bugs
- Use the [feature request](https://github.com/dkirby-ms/playgrid/issues/new?template=feature-request.yml) template for ideas
- Use the [chore](https://github.com/dkirby-ms/playgrid/issues/new?template=chore.yml) template for maintenance tasks

### Pull Requests

1. **Create a focused PR** — one feature or fix per PR
2. **Write a clear description** — explain what and why
3. **Link to the issue** — reference the issue your PR solves (`closes #123`)
4. **Run tests locally** — ensure nothing breaks

```bash
npm run test
npm run build
```

## Code Style

### TypeScript

- Use **strict mode** — all types should be explicit
- Prefer **interfaces** for type definitions
- Keep functions small and focused
- Add comments only where logic isn't obvious

Example:

```typescript
interface Player {
  id: string;
  name: string;
  elo: number;
}

export function calculateRating(winner: Player, loser: Player): number {
  // Your logic here
}
```

### Testing

We use **Vitest**. Tests live next to their code:

```
src/
  game-logic.ts
  game-logic.test.ts
```

Write tests as you code:

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
```

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateRating } from './game-logic';

describe('calculateRating', () => {
  it('should increase winner ELO and decrease loser ELO', () => {
    const winner = { id: '1', name: 'Alice', elo: 1600 };
    const loser = { id: '2', name: 'Bob', elo: 1400 };
    
    const newRating = calculateRating(winner, loser);
    expect(newRating).toBeGreaterThan(winner.elo);
  });
});
```

## Project Structure

```
playgrid/
├── client/          # Web UI (PixiJS, Vite)
├── server/          # Game server (Colyseus)
├── shared/          # Shared types and utils
└── docs/            # Architecture and guides
```

For more details, see the [README](./README.md).

## Questions?

- Check [docs/](./docs) for architecture and design decisions
- Open a [discussion](https://github.com/dkirby-ms/playgrid/discussions) if you have questions

Happy coding! 🎮

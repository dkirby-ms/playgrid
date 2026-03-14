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

We use a simple flow: **dev → uat → prod**

1. **Feature/fix branches** branch off from `dev`
2. **Code review** happens in pull requests
3. **Merge to `dev`** once approved
4. **Promote to `uat`** for testing
5. **Promote to `prod`** for release

If you're working on a new feature:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/my-feature
```

When ready, open a PR against `dev`.

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
├── docs/            # Architecture and guides
└── .squad/          # Team docs and decisions
```

For more details, see the [README](./README.md).

## Questions?

- Check [docs/](./docs) for architecture and design decisions
- Open a [discussion](https://github.com/dkirby-ms/playgrid/discussions) if you have questions
- Reach out to the team in the project Discord

Happy coding! 🎮

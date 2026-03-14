# Work Routing

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture & scope | Hal | Project structure, tech decisions, priorities |
| Rendering & UI | Gately | Canvas rendering, game loop, input handling |
| Game systems | Pemulis | Simulation, AI, world generation, combat |
| CI/CD & DevOps | Marathe | Workflows, deployment, build pipelines |
| Testing | Steeply | Tests, edge cases, performance checks |
| Community & Discord | Joelle | Discord, README, release notes |
| Session logging | Scribe | Automatic |

## PR Review Gates

| PR Type | Target Branch | Reviewer | Policy |
|---------|---------------|----------|--------|
| Feature/fix → `dev` | `dev` | Hal | Merge after approval |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage | Hal |
| `squad:hal` | Architecture, scope | Hal |
| `squad:gately` | Rendering, UI | Gately |
| `squad:pemulis` | Game systems | Pemulis |
| `squad:steeply` | Testing | Steeply |
| `squad:marathe` | CI/CD, infra | Marathe |
| `squad:joelle` | Community, docs | Joelle |

## Rules

1. Eager by default — spawn all useful agents in parallel.
2. Scribe always runs after substantial work.
3. Quick facts → coordinator answers directly.
4. "Team, ..." → fan-out all relevant agents.

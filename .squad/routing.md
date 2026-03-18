# Work Routing

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture & scope | Hal | Project structure, tech decisions, priorities |
| Canvas rendering | Gately | PixiJS rendering, game loop, input handling |
| DOM UI & overlays | Ortho | Lobby, sidebar, setup screens, player info bars, CSS |
| UX & Design | Mario | Layout, color, usability, interaction design |
| Game systems | Pemulis | Simulation, AI, world generation, combat |
| CI/CD & DevOps | Marathe | Workflows, deployment, build pipelines |
| Testing | Steeply | Tests, edge cases, performance checks |
| Community & Discord | Joelle | Discord, README, release notes |
| Session logging | Scribe | Automatic |
| Autonomous issues | @copilot | Single-file fixes, tests, docs, small features |

## @copilot Capability Profile

| Capability | Fit | Notes |
|------------|-----|-------|
| Single-file bug fixes | 🟢 | Ideal — scoped, testable |
| Add/update tests | 🟢 | Vitest unit tests, Playwright e2e |
| Documentation updates | 🟢 | README, JSDoc, inline comments |
| Small features (1-2 files) | 🟡 | Works if requirements are clear in the issue |
| Multi-file refactors | 🟡 | Can work but needs detailed issue description |
| Architecture changes | 🔴 | Needs squad agent with full context |
| PixiJS rendering work | 🔴 | Needs visual judgment — route to Gately |
| Colyseus game logic | 🟡 | Simple state changes OK; complex interactions need Pemulis |
| CI/CD & infra | 🔴 | Route to Marathe |

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
| `squad:mario` | UX design, layout, usability | Mario |
| `squad:copilot` | Single-file fixes, tests, docs | @copilot |

## Rules

1. Eager by default — spawn all useful agents in parallel.
2. Scribe always runs after substantial work.
3. Quick facts → coordinator answers directly.
4. "Team, ..." → fan-out all relevant agents.

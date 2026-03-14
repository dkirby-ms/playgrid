# Marathe: Root ESLint flat config for workspace monorepo

- **Date:** 2026-03-14
- **Scope:** Issue #8
- **Decision:** Standardize linting at the repo root with a flat `eslint.config.js` using `typescript-eslint`, then run `npm run lint` in CI immediately after the workspace build step.
- **Implementation details:**
  - Install ESLint tooling as root devDependencies: `eslint`, `@eslint/js`, `typescript-eslint`, and `globals`.
  - Use one root lint script (`eslint .`) so the workspace root remains the source of truth.
  - Apply browser globals to `client/src/**` and Node globals to `server/**` and `shared/**`.
  - Ignore generated `dist/**`, `node_modules/**`, and `coverage/**` so built output is never linted.
  - Keep rules correctness-focused: recommended TypeScript rules, `no-console` allowed, unused args tolerated when prefixed with `_`, and `no-explicit-any` relaxed for server tests.

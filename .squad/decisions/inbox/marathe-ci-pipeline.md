# Marathe: CI pipeline for `dev`

- **Date:** 2026-03-14
- **Scope:** Issue #7
- **Decision:** Add a single GitHub Actions CI workflow at `.github/workflows/ci.yml` that runs on pushes to `dev` and pull requests targeting `dev`.
- **Implementation details:**
  - Ignore docs-only changes via `paths-ignore` for `docs/**`, `.squad/**`, and Markdown files.
  - Use one `build-test` job on `ubuntu-latest` with Node.js 22.
  - Run `npm ci`, `npm run build`, and `npm run test` from the repo root so workspace scripts remain the source of truth.
  - Apply concurrency keyed by PR number or ref to cancel stale in-flight builds.
  - Restrict workflow permissions to `contents: read`.
  - Pin `actions/checkout` and `actions/setup-node` to commit SHAs.
  - Commit the root `package-lock.json`, regenerated with npm's legacy peer-deps resolver, so plain `npm ci` is valid for the monorepo.

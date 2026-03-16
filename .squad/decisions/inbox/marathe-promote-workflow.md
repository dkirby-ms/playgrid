# Marathe Decision Inbox — promote workflow

**Date:** 2026-03-16  
**Status:** Proposed

## Decision

Add a dedicated manual GitHub Actions workflow at `.github/workflows/promote.yml` to handle dev→prod promotions with a controlled version bump.

## Rationale

- Production promotion should be explicit and operator-driven instead of tied to every branch merge.
- The repo is an npm workspace monorepo, so release version bumps must keep the root package, workspace packages, and lockfile aligned.
- Opening the `dev` → `prod` PR from the workflow keeps the release handoff transparent while still producing a release tag for downstream prod deployment automation.

## Implementation Notes

- Triggered by `workflow_dispatch` with `bump_type` choice input (`minor` or `major`).
- Checks out `dev`, configures `github-actions[bot]`, bumps versions in `package.json`, `client/package.json`, `server/package.json`, and `shared/package.json`, and refreshes `package-lock.json` with `npm install --package-lock-only --ignore-scripts --legacy-peer-deps`.
- Commits the bump to `dev`, creates `v*` tag, opens the `dev` → `prod` PR with `gh pr create`, then pushes the tag.
- Uses SHA-pinned `actions/checkout` and `actions/setup-node`, plus `contents: write` and `pull-requests: write` permissions.

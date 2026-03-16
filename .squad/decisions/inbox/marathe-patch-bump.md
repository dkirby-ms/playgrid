# Marathe Decision Inbox — automatic dev patch bump

**Date:** 2026-03-16  
**Status:** Proposed

## Decision

Keep the automatic patch-version increment inside `.github/workflows/ci.yml` as a dedicated `version-bump` job that runs only after successful pushes to `dev`.

## Rationale

- The existing CI workflow already gates `dev` pushes with build, lint, and test, so adding the patch bump as a dependent job keeps the release signal coupled to the validated commit.
- PlayGrid is an npm workspace monorepo, so the bump must update the root package, all workspace package manifests, and `package-lock.json` together.
- Using a `[skip ci]` commit message on the bot-generated version commit prevents an infinite CI loop without needing a second workflow.

## Implementation Notes

- `build-test` continues to run for both `push` and `pull_request` events targeting `dev`.
- `version-bump` uses `if: github.event_name == 'push'`, job-level `contents: write`, SHA-pinned `actions/checkout` and `actions/setup-node`, and the same `github-actions[bot]` git identity pattern as `promote.yml`.
- The bump command sequence is `npm version patch --no-git-tag-version`, `npm pkg set version=...` for `client`, `server`, and `shared`, then `npm install --package-lock-only --ignore-scripts --legacy-peer-deps` before committing and pushing back to `dev`.

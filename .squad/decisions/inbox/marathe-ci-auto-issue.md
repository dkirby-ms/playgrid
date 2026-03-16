### Marathe: CI failure auto-issue on dev

**Status:** Approved  
**Date:** 2026-03-16  
**Requested by:** dkirby-ms

**Decision:** Add a `create-failure-issue` job to `.github/workflows/ci.yml` that runs only when `build-test` fails on `push` events to `dev`, and creates a deduplicated GitHub issue labeled `squad` and `bug` via `gh issue create`.

**Implementation details:**
- Job-level guard uses `if: failure() && github.event_name == 'push' && github.ref == 'refs/heads/dev'`
- Job depends on `build-test` and has `issues: write` permission
- The issue title includes the short commit SHA and `CI build failure`
- The issue body includes the workflow run link, commit message, commit author, and branch
- Duplicate issues are prevented by checking existing titles first with `gh issue list`

**Rationale:**
- CI failures on `dev` should become immediately actionable backlog items for Ralph and squad triage
- Using `gh` keeps the workflow simple and avoids introducing another third-party action surface
- Deduplication prevents repeated failing pushes for the same commit from spamming the issue tracker

**Related operational fix:**
- `server/package.json` now declares `@colyseus/schema` explicitly so CI installs do not rely on root hoisting for `server/src/game/GameRegistry.ts`

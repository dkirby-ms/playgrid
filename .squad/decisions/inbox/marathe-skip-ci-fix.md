# Decision: Remove `[skip ci]` from CI Version-Bump Commits

**Date:** 2026-03-17  
**Author:** Marathe (DevOps / CI-CD)  
**Status:** Implemented  
**Context:** Critical bug fix — squash merges were silently skipping UAT/prod deployments

---

## Problem

When PR #153 (dev → uat) was squash-merged, the merge commit body included text from all squashed commits, including version-bump commits containing `[skip ci]` in their messages:

```
* chore: bump patch version to v0.1.23 [skip ci]
...
* chore: bump patch version to v0.1.24 [skip ci]
```

GitHub Actions scans the **entire** commit message body (not just the title) for the `[skip ci]` directive. This caused the Deploy UAT workflow to silently skip, breaking production deploys.

---

## Decision

**Remove `[skip ci]` from the CI version-bump workflow commit message.**

The directive is redundant and dangerous:
- The workflow uses `token: ${{ github.token }}` (default GITHUB_TOKEN)
- Pushes made with GITHUB_TOKEN **do not trigger other workflows** by GitHub's built-in behavior
- `[skip ci]` was unnecessary and caused squash-merge pollution

---

## Implementation

**File:** `.github/workflows/ci.yml` (line 150)

**Before:**
```yaml
git commit -m "chore: bump patch version to v${{ steps.version.outputs.new_version }} [skip ci]"
```

**After:**
```yaml
git commit -m "chore: bump patch version to v${{ steps.version.outputs.new_version }}"
```

---

## Rationale

1. **GITHUB_TOKEN behavior:** GitHub's built-in token prevents workflow recursion without `[skip ci]`
2. **Squash-merge safety:** Removing the directive prevents merge commit body pollution
3. **Deploy reliability:** UAT/prod deploys will no longer be silently skipped

---

## Alternative Considered: Workflow-Level Condition Check

If the workflow used a PAT (Personal Access Token) instead of GITHUB_TOKEN, we could have added a condition to the CI workflow:

```yaml
if: !startsWith(github.event.head_commit.message, 'chore: bump patch version')
```

However, since GITHUB_TOKEN is used, this approach is unnecessary.

---

## Impact

- ✅ Squash merges to `uat`/`prod` will no longer skip deployment workflows
- ✅ Version-bump commits will still not trigger CI loops (GITHUB_TOKEN behavior)
- ✅ Critical deploy reliability issue resolved

---

## Key Learning

**Never use `[skip ci]` in commit messages when workflows involve squash-merging.**

The directive pollutes merge commit bodies and causes unintended workflow skips. Always prefer:
1. GitHub's built-in GITHUB_TOKEN behavior (no recursion by design)
2. Workflow-level conditional checks (e.g., `if:` conditions on job/step triggers)
3. Path-based workflow filters (e.g., `paths-ignore`)

---

## Verification

- ✅ YAML syntax validated with Python yaml module
- ✅ Git diff confirmed single-line change
- ✅ No additional workflow modifications needed

---

## Cross-Team Guidance

**For all agents creating CI workflows:**
- Avoid `[skip ci]`, `[ci skip]`, or similar directives in commit messages
- Use GITHUB_TOKEN for automation commits (prevents recursion)
- If using a PAT, add explicit workflow conditions instead
- Test squash-merge scenarios for critical workflows (deploy, release)

# Hal — PR Review Decisions (PRs #157–160)

**Date:** 2026-03-16
**Author:** Hal (Lead)

## Decision 1: BaseGameRoom lifecycle contract — plugins must not read currentTurn during onGameStart

**Context:** PR #157 exposed that `state.currentTurn` is empty during `onGameStart`. BaseGameRoom sets it after the call.

**Decision:** Any turn-dependent initialization must happen in `onTurnStarted`, not `onGameStart`. Document this in the plugin lifecycle contract.

**Impact:** All game plugins. Risk quickstart must move first-player reinforcement to `onTurnStarted`.

---

## Decision 2: Add tsc --noEmit to CI for client code

**Context:** PR #160 has an undeclared property (`ghostLayer`) that passes CI because Vite/esbuild doesn't type-check. This means TypeScript errors in client code are invisible in CI.

**Decision:** Add `tsc --noEmit -p client/tsconfig.json` as a CI step alongside `npm run build`. File as a separate issue.

**Impact:** CI pipeline. Will catch type errors that bundler-only builds miss.

---

## Decision 3: innerHTML XSS vector in HistoryScreen needs remediation

**Context:** PRs #157 and #158 both add `desc.innerHTML = formatter.formatMove(move)` where move descriptions contain unsanitized player displayNames.

**Decision:** File a follow-up issue. Fix by either HTML-escaping player names server-side in formatMoveEntries, or switching to textContent client-side.

**Impact:** Security. Low-severity in game context but should be fixed before any public deployment.

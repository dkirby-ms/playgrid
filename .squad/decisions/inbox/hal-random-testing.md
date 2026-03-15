# Decision: Robust Testing for Random Mechanics

**Status:** Decided
**Date:** 2024-05-22
**Owner:** Hal

## Context
During the Risk plugin review, a combat test failed due to bad luck (42% failure rate). The test relied on `Math.random` with low sample size and tight constraints.

## Decision
Tests involving randomness must be either:
1. **Mocked:** Use `vi.spyOn(Math, 'random')` to force outcomes.
2. **Robust:** Use sufficient sample sizes and buffers (e.g., 20 armies vs 1, not 3 vs 1) to make failure statistically impossible.

Flaky tests are treated as broken code.

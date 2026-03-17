# Session Log: E2E Notice Flakiness Fix

**Date:** 2026-03-17T14:02:00Z  
**Agent:** Steeply (Tester)  
**Topic:** E2E Test Flakiness — Notice Overlay Blocking  

## Summary

Fixed intermittent E2E test failures where the lobby notice overlay was blocking interaction with the "Create Game" button. Added dismissal waits to all 7 E2E test files before button interactions.

## Work Completed

- Patched all E2E tests to wait for notice dismissal
- All tests validated (build, lint, E2E pass)
- Changes committed to main

## Outcome

E2E tests now resilient to notice overlay timing. No further flakiness expected on notice interaction paths.

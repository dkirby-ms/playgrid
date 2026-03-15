# Pemulis decision inbox — ready-check enforcement

## Context
Issue #79 reported that hosts could start waiting games before all joined players were ready.

## Decision
For the current lobby flow, enforce readiness on every joined **non-host** waiting player before `start_game` is allowed.

## Rationale
The current waiting-room UX gives the host the Start Game control but does not expose a Ready toggle for the host. Treating the host as a starter/coordinator and enforcing readiness on all other joined players fixes the bug without introducing a larger UX change mid-stream.

## Follow-up
If we later want a true "every participant explicitly readies" flow, we should add a separate host-ready interaction first and then tighten the server rule to match it.

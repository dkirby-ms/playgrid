# Decision: No Scrollbars in Sidebar Status Panes

**Author:** Ortho (Frontend Dev)
**Date:** 2025-07-18
**Status:** Applied

## Context

User reported scrollbars appearing in the game info tab/panel in the sidebar. The general rule is: **no scrollbars in status panes**.

## Decision

- `.sidebar-panel-content` uses `overflow: hidden` — never `overflow-y: auto`
- `.game-sidebar-panel` has no `max-height` — panels size to their content naturally
- The outer `.game-sidebar` container keeps `overflow-y: auto` so the sidebar itself scrolls if panels collectively exceed viewport height
- All webkit scrollbar pseudo-element styling removed from `.sidebar-panel-content`

## Rationale

Status panes (game info, players, stats) should display all their content without internal scrolling. They are compact by design and should never need their own scrollbar. If the sidebar as a whole gets too tall, the outer container handles it.

## Files Changed

- `client/src/ui/GameSidebar.ts` — CSS in `injectStyles()`

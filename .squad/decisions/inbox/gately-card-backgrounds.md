# Gately: Lobby card backgrounds via inline SVG data URLs

**Date:** 2026-03-15
**Status:** Proposed

## Decision

Use inline SVG data URLs generated in `client/src/ui/LobbyScreen.ts` for lobby game library card artwork, with CSS overlay/shadow treatment in `client/index.html` to keep labels readable.

## Context

The original Figma mockups expected image-backed game cards, but the implementation fell back to gradients because the client has no dedicated asset pipeline or hosted image directory. The lobby now needs distinct artwork for Checkers, Backgammon, and Risk without introducing static asset management just for three promotional card backgrounds.

## Rationale

- Keeps the artwork fully self-contained in the lobby UI code; no new build or deploy pipeline required
- Lets each game card have bespoke art direction while staying lightweight and easy to tweak
- Preserves readability with one shared CSS contrast layer instead of duplicating overlays inside every asset
- Fits the existing HTML/CSS lobby architecture, where `LobbyScreen.ts` builds the DOM and `client/index.html` owns the styling

## Files

- `client/src/ui/LobbyScreen.ts`
- `client/index.html`

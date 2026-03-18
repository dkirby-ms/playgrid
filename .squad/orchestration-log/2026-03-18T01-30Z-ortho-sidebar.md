# Ortho: GameSidebar Visual Refresh (Phase 3)

**Date:** 2026-03-18T01:30Z  
**Status:** ✅ Complete  
**Build:** ✅ Pass | **Lint:** ✅ Pass | **Tests:** ✅ Pass (467)

## Scope

Restyled `client/src/ui/GameSidebar.ts` to use design tokens from `design-tokens.css`, eliminating all hardcoded `rgba()` color values. This is Phase 3 of the Figma v1 design implementation.

## Deliverables

### Modified
- `client/src/ui/GameSidebar.ts` — Visual refresh with token-based styling

### Key Changes

- **Tokens over hardcodes:** All colors, borders, backgrounds, shadows, radii, and spacing now reference CSS custom properties from `design-tokens.css`
- **Glass morphism consistency:** Sidebar panels now match the `PlayerInfoBar` glass pattern:
  - Background: `var(--glass-bg)`
  - Shadow: `var(--shadow-card)`
  - Borders: `var(--border-light)`
  - Inner cards: `var(--bg-card-dark)`
- **Buttons:** Primary uses `var(--gradient-button-primary)`, Danger uses `var(--gradient-button-danger)`, Secondary uses `var(--bg-card-dark)` + `var(--border-default)`
- **Note cards:** Now use `var(--notice-info-bg)`, `var(--notice-info-border)`, `var(--notice-info-text)` instead of hardcoded blue-tinted rgba
- **Typography:** Added `font-family: var(--font-family)` to sidebar root, panel headings use `font-weight: 600`
- **Spacing:** Panel gap increased to `var(--space-lg)` (1.5rem) matching Figma `space-y-6`
- **Responsive:** Added tablet breakpoint (768–1024px) with narrower sidebar and tighter padding

## Backward Compatibility

- DOM structure, class names, event system, and `setPanelMarkup()` API all preserved
- No new dependencies or frameworks introduced
- All existing functionality intact — purely visual changes
- No impact on game logic or server integration

## Cross-Agent Impact

- **Gately:** No changes needed; sidebar works alongside PixiJS rendering
- **Server:** No changes needed; sidebar binds to existing Colyseus messages

## Pattern Established

GameSidebar and PlayerInfoBar now both follow the same glass morphism token pattern, providing visual consistency across all game overlays.

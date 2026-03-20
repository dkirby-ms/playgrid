# Chess Clock Design Spec — Checkers Game

**Source:** Figma Design Export at `docs/designs/playgrid-v1/src/app/pages/CheckersGame.tsx` (lines 16–311)
**Target:** Vanilla TypeScript implementation for `client/src/ui/`
**Reference:** Current implementations at `client/src/ui/GameSidebar.ts` and `client/src/ui/PlayerInfoBar.ts`
**Design Tokens:** `client/src/ui/design-tokens.css`

---

## 1. Game Clock Sidebar Panel

The chess clock UI lives in the **right sidebar** (`.game-sidebar`) in a dedicated panel titled "Game Clock".

### 1.1 Layout Structure

```
.game-sidebar-panel (id: "game-clock")
  ├─ .sidebar-panel-header
  │  ├─ h3 "Game Clock" + icon
  │  └─ gap: --space-sm
  │
  └─ .sidebar-panel-content
     └─ .sidebar-clock-container
        ├─ .sidebar-clock-item (Black player)
        │  ├─ .sidebar-clock-player-name
        │  └─ .sidebar-clock-time
        │  └─ .sidebar-clock-indicator (active only)
        │
        └─ .sidebar-clock-item (Red player)
           ├─ .sidebar-clock-player-name
           ├─ .sidebar-clock-time
           └─ .sidebar-clock-indicator (active only)
```

**Key:**
- Panel width: `min(var(--game-sidebar-width, 304px), calc(100vw - 32px))`
- Panel padding: `var(--space-md)` (1rem)
- Content gap: `var(--space-sm)` (0.75rem)
- Panel background: `var(--glass-bg)` with `backdrop-blur-sm` (already applied by `.glass-panel` class)

### 1.2 Visual States: Active vs. Inactive Clock

**Inactive Clock (Opponent's clock / Not active turn):**
- Background: `var(--bg-card-dark)` = `rgba(2, 6, 23, 0.7)`
- Border: `1px solid var(--border-light)` = `rgba(51, 65, 85, 0.4)`
- Text color (time): `var(--text-primary)` = `#f8fafc`
- Opacity: Full
- Animation: None

**Active Clock (Current player's clock):**
- Background: Gradient `linear-gradient(135deg, var(--pg-slate-700) 0%, var(--pg-slate-800) 100%)` = `linear-gradient(135deg, #334155, #1e293b)`
- Border: `2px solid var(--pg-blue-400)` = `2px solid #60a5fa` (ring-like effect)
- Text color (time): `var(--text-primary)` = `#f8fafc`
- Pulsing indicator dot: Present + animated
- Box shadow: Elevated glow (shadow-card or stronger)
- Transition: `all 200ms ease`

### 1.3 Color Scheme (Tailwind → CSS Vars Mapping)

| Figma Class | Hex Value | CSS Custom Property | Usage |
|---|---|---|---|
| `from-slate-700` | `#334155` | `--pg-slate-700` | Active clock bg start |
| `to-slate-800` | `#1e293b` | `--pg-slate-800` | Active clock bg end |
| `ring-2 ring-blue-400` | `2px solid #60a5fa` | `--pg-blue-400` | Active clock border |
| `text-white` | `#f8fafc` | `--text-primary` | Clock time display |
| `text-slate-400` | `#94a3b8` | `--pg-slate-400` | Player name label |
| `text-red-400` | `#f87171` | `--pg-red-400` | Critical time warning |
| `bg-slate-900/50` | `rgba(15, 23, 42, 0.5)` | `--bg-card-dark` | Inactive clock bg |
| `bg-green-500 animate-pulse` | `#22c55e` | `--pg-green-500` | Active indicator dot |
| `bg-zinc-800/50` | `rgba(39, 39, 42, 0.5)` | Alternative dark bg (use `--bg-card-dark` instead) |

**Critical Notice:** The Figma design uses `ring-2 ring-blue-400` to indicate the active clock. Map this to `border: 2px solid var(--pg-blue-400)` since rings are not CSS custom properties.

### 1.4 Typography

| Element | Font Size | Font Weight | Line Height | Letter Spacing | Font Family |
|---|---|---|---|---|---|
| Panel Header (h3) | `var(--font-lg)` (18px) | 600 | 1.3 | Normal | `var(--font-family)` |
| Player Name Label | `var(--font-xs)` (12px) | 400 | 1.2 | Normal | `var(--font-family)` |
| Clock Time (MM:SS) | 32px (custom, see below) | 700 | 1 | `font-mono` (tabular-nums) | Monospace |
| Player Name (below time) | `var(--font-sm)` (14px) | 400 | 1.4 | Normal | `var(--font-family)` |

**Clock Time Typography Details:**
- Size: `32px` or `2rem` (larger than standard scale to emphasize)
- Weight: `700` (bold, for emphasis)
- Font: `font-mono` with `font-variant-numeric: tabular-nums` for fixed-width time display
- Color (normal): `var(--text-primary)` = `#f8fafc`
- Color (critical): `var(--pg-red-400)` = `#f87171` (when `< 60 seconds`)

### 1.5 Spacing & Sizing

| Property | Value | Purpose |
|---|---|---|
| Clock item height | 64px min | Sufficient touch target + visual balance |
| Clock item padding | `var(--space-md) var(--space-lg)` = `1rem 1.5rem` | Comfortable internal spacing |
| Gap between player name & time | `4px` or `0.25rem` | Tight grouping for readability |
| Gap between clock items | `var(--space-sm)` = `0.75rem` | Visual separation |
| Border radius | `var(--radius-lg)` = `0.75rem` | Consistent with design system |

### 1.6 Warning State (< 60 seconds)

**Trigger:** When `timerSeconds < 60` for the active player's clock.

**Visual Changes:**
- Clock time text color: Change from `var(--text-primary)` to `var(--pg-red-400)` (bright red `#f87171`)
- Optional: Add subtle background tint to the clock item (e.g., `rgba(248, 113, 113, 0.1)`)
- Border/ring remains blue but may pulse faster (see animation below)

**Recommended Implementation:**
```css
.sidebar-clock-time--critical {
  color: var(--pg-red-400);
}

.sidebar-clock-item--critical {
  background: rgba(248, 113, 113, 0.08);
  border-color: var(--pg-red-400);
}
```

### 1.7 Active Indicator (Pulsing Dot)

**Element:** Small circular dot (8×8px or 6×6px) positioned in the **right side** of the active clock item.

**Styling:**
- Shape: Circle (`border-radius: 50%` or `var(--radius-pill)`)
- Size: `8px × 8px` (or `2px × 2px` if very minimal)
- Color: `var(--pg-green-500)` = `#22c55e`
- Animation: CSS `animate-pulse` (2s ease-in-out infinite)
- Position: Flex-aligned to the right, vertically centered

**CSS Animation:**
```css
@keyframes sidebar-clock-pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.2);
  }
}

.sidebar-clock-indicator {
  animation: sidebar-clock-pulse 2000ms ease-in-out infinite;
}
```

---

## 2. Player Info Bar Clock Display

The player info bars appear **above** the board (opponent) and **below** the board (player).

### 2.1 Opponent Bar (Above Board) — Line 150–164 of Figma Export

**Layout Structure:**
```
.player-info-bar.player-info-bar--opponent
  ├─ .player-info-bar__identity
  │  ├─ .player-info-bar__avatar (initials)
  │  └─ .player-info-bar__copy
  │     ├─ .player-info-bar__name ("Sarah Chen")
  │     └─ .player-info-bar__label ("Black Pieces")
  │
  └─ .player-info-bar__meta
     ├─ Clock icon (lucide-react Clock)
     └─ .player-info-bar__timer ("5:23")
```

**Key Dimensions:**
- Full width (100% of parent)
- Padding: `var(--space-md) var(--space-lg)` = `1rem 1.5rem`
- Border radius: `var(--radius-lg)` = `0.75rem`
- Gap (identity to meta): `var(--space-lg)` = `1.5rem`
- Avatar size: `44px × 44px`

**Opponent Bar Colors:**
- Background: `var(--bg-glass)` = `rgba(30, 41, 59, 0.5)` with backdrop blur
- Border: `1px solid var(--glass-border)` = `rgba(51, 65, 85, 0.4)`
- Avatar background: Gradient `linear-gradient(135deg, var(--pg-slate-700), var(--pg-slate-600))` = gradient `#334155 → #475569`
- Text (name): `var(--text-primary)` = `#f8fafc`
- Text (label): `var(--text-secondary)` = `#cbd5e1`
- Timer text: `var(--text-primary)` = `#f8fafc`

**Responsive:** On mobile (<720px), stacks to flex-direction: column.

### 2.2 Player Bar (Below Board) — Line 233–253 of Figma Export

**Layout Structure:**
```
.player-info-bar.player-info-bar--player
  ├─ .player-info-bar__identity
  │  ├─ .player-info-bar__avatar (initials)
  │  └─ .player-info-bar__copy
  │     ├─ .player-info-bar__name ("Player123 (You)")
  │     └─ .player-info-bar__label ("Red Pieces")
  │
  └─ .player-info-bar__meta
     ├─ .player-info-bar__status ("Your Turn" / "Waiting...")
     └─ .player-info-bar__timer (optional, clock time)
```

**Key Differences from Opponent Bar:**
- Avatar background: Gradient `linear-gradient(135deg, var(--pg-blue-500), var(--pg-blue-600))` = gradient `#3b82f6 → #2563eb` (blue instead of slate)
- Status badge: Dynamic tone ("active", "waiting", "neutral")
- May include clock timer on right side (optional in design)

**Player Bar Colors:**
- Background: Gradient `linear-gradient(130deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.6))` = custom dark gradient
- Border: `1px solid var(--accent-border)` = `rgba(59, 130, 246, 0.5)` (blue-tinted)
- Avatar background: `linear-gradient(135deg, var(--pg-blue-500), var(--pg-blue-600))` = `#3b82f6 → #2563eb`
- Text (name): `var(--text-primary)` = `#f8fafc`
- Text (label): `var(--text-secondary)` = `#cbd5e1`
- Status badge (active): `background: var(--status-playing-bg)`, `color: var(--status-playing-text)` = `rgba(34, 197, 94, 0.2)` / `#4ade80`
- Status badge (waiting): `background: var(--status-waiting-bg)`, `color: var(--status-waiting-text)` = `rgba(245, 158, 11, 0.2)` / `#fbbf24`

### 2.3 Clock Time Display Position

**In Player Info Bar:**
The clock time appears in the **`.player-info-bar__meta`** section on the **right side** of the bar, aligned vertically center.

**Format:** MM:SS (e.g., "5:23" or "0:45")
**Font:** Monospace, `font-variant-numeric: tabular-nums`
**Size:** `var(--font-sm)` or `var(--font-base)` (14px–16px)
**Padding:** `4px 12px` (pill-style badge)
**Border:** `1px solid rgba(126, 207, 255, 0.28)` (subtle blue border)
**Background:** `rgba(15, 23, 42, 0.7)` (dark overlay)

---

## 3. Color Mapping (Tailwind → CSS Custom Properties)

| Tailwind Class | Hex/RGBA | CSS Custom Property | Current Usage | Notes |
|---|---|---|---|---|
| `from-slate-700 to-slate-800` | `#334155 → #1e293b` | `--pg-slate-700`, `--pg-slate-800` | Active clock gradient | Use both for 135deg gradient |
| `ring-2 ring-blue-400` | `2px solid #60a5fa` | `--pg-blue-400` | Active clock border | Implement as `border: 2px` |
| `text-red-400` | `#f87171` | `--pg-red-400` | Critical time warning | Already defined in design tokens |
| `bg-green-500 animate-pulse` | `#22c55e` + animation | `--pg-green-500` | Active indicator dot | Use `@keyframes sidebar-clock-pulse` |
| `bg-zinc-800/50` | `rgba(39, 39, 42, 0.5)` | Use `--bg-card-dark` instead | Inactive clock bg | Existing token preferred |
| `bg-slate-900/50` | `rgba(15, 23, 42, 0.5)` | `--bg-card-dark` | Inactive clock bg | Reuse existing |
| `text-slate-400` | `#94a3b8` | `--pg-slate-400` | Player name label | Secondary text color |
| `rounded-lg` | 0.75rem | `--radius-lg` | All clock items | Consistent rounding |
| `text-white` | `#f8fafc` | `--text-primary` | Clock time, labels | Primary text throughout |
| `text-slate-300` | `#cbd5e1` | `--text-secondary` | Secondary labels | For "Black Pieces", etc. |

**No New Tokens Required:** All Figma design colors map directly to existing CSS custom properties in `design-tokens.css`.

---

## 4. Interaction States

### 4.1 Opponent's Turn (Inactive Clock)

**Visual State:**
- Background: Dark, no highlight
- Border: Standard `--border-light`
- Time text: Normal white (`--text-primary`)
- Indicator dot: Not displayed
- Opacity: Full (1)
- Box shadow: Subtle card shadow (not elevated)

**User Understanding:** "This is my opponent's clock. I'm waiting."

### 4.2 Your Turn (Active Clock)

**Visual State:**
- Background: Gradient from slate-700 to slate-800
- Border: Glowing blue (`2px solid --pg-blue-400`)
- Time text: White (`--text-primary`), possibly larger/bolder
- Indicator dot: Visible + pulsing green
- Box shadow: Elevated shadow to draw attention
- Glow effect: Possible subtle blue glow around border

**User Understanding:** "My clock is running. This is my turn."

**Animation:**
```css
.sidebar-clock-item--active {
  box-shadow: 
    inset 0 0 0 2px var(--pg-blue-400),
    0 0 16px rgba(96, 165, 250, 0.3);
  animation: sidebar-clock-highlight 2000ms ease-in-out infinite;
}

@keyframes sidebar-clock-highlight {
  0%, 100% {
    box-shadow: 
      inset 0 0 0 2px var(--pg-blue-400),
      0 0 16px rgba(96, 165, 250, 0.3);
  }
  50% {
    box-shadow: 
      inset 0 0 0 2px var(--pg-blue-400),
      0 0 24px rgba(96, 165, 250, 0.5);
  }
}
```

### 4.3 Critical Time (< 60 seconds, Any Player)

**Trigger:** `timerSeconds < 60`

**Visual State:**
- Time text: Red (`--pg-red-400` = `#f87171`)
- Background tint: Subtle red overlay (optional, e.g., `rgba(248, 113, 113, 0.08)`)
- If active: Border/ring becomes red (`--pg-red-400`) instead of blue
- Indicator dot: May pulse faster (2s → 1s animation) or intensify

**User Understanding:** "Time is running out!"

**Recommended CSS:**
```css
.sidebar-clock-time--critical {
  color: var(--pg-red-400);
  font-weight: 800;
}

.sidebar-clock-item--active.sidebar-clock-item--critical {
  background: rgba(248, 113, 113, 0.08);
  border-color: var(--pg-red-400);
}

.sidebar-clock-item--active.sidebar-clock-item--critical .sidebar-clock-indicator {
  animation: sidebar-clock-pulse-fast 1000ms ease-in-out infinite;
}

@keyframes sidebar-clock-pulse-fast {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.4);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 12px 3px rgba(248, 113, 113, 0.3);
  }
}
```

### 4.4 Time Expires (0:00 / Game Over)

**Status:** Not shown in Figma design. Recommend:
- Time display: `0:00` (frozen)
- Time text: Red + struck-through or dimmed
- Clock item: Disabled appearance (opacity 0.6, no pulse)
- Game board: Should show "Game Over" overlay (separate from clock)
- Status badge (player bar): Changes to "Lost" or "Game Over"

**Note:** This is an edge case outside the Figma spec. Coordinate with game logic implementation.

---

## 5. Animation Specifications

### 5.1 Active Clock Pulse Animation

**Name:** `sidebar-clock-pulse`
**Duration:** `2000ms` (2 seconds)
**Timing Function:** `ease-in-out`
**Iteration:** Infinite

**Keyframes:**
```css
@keyframes sidebar-clock-pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.2);
  }
}
```

**Target Elements:** `.sidebar-clock-indicator` (the small green dot)

### 5.2 Active Clock Highlight Animation

**Name:** `sidebar-clock-highlight`
**Duration:** `2000ms`
**Timing Function:** `ease-in-out`
**Iteration:** Infinite

**Effect:** Subtle glow pulse on the active clock border/box-shadow.

**Keyframes:**
```css
@keyframes sidebar-clock-highlight {
  0%, 100% {
    box-shadow: 
      inset 0 0 0 2px var(--pg-blue-400),
      0 0 16px rgba(96, 165, 250, 0.3);
  }
  50% {
    box-shadow: 
      inset 0 0 0 2px var(--pg-blue-400),
      0 0 24px rgba(96, 165, 250, 0.5);
  }
}
```

### 5.3 State Transitions

**Property:** All interactive state changes (active ↔ inactive, normal ↔ critical)
**Transition:** `all 200ms ease`
**Properties Affected:** border, background, color, box-shadow

---

## 6. Implementation Checklist

### Phase 1: Core Sidebar Clock Component

- [ ] Create `.sidebar-clock-container` in `GameSidebar.ts` styles
- [ ] Add `.sidebar-clock-item` styling (inactive state)
- [ ] Add `.sidebar-clock-item--active` styling (active state)
- [ ] Add `.sidebar-clock-time` and `.sidebar-clock-time--critical` styling
- [ ] Add `.sidebar-clock-indicator` and pulsing animation
- [ ] Add `.sidebar-clock-player-name` and `.sidebar-clock-player-label` styling
- [ ] Map all Tailwind colors to existing CSS custom properties

### Phase 2: Player Info Bar Clock Integration

- [ ] Ensure `.player-info-bar__timer` displays clock time correctly
- [ ] Add clock icon (lucide-react `Clock`) to player bars (already in Figma)
- [ ] Test timer display on opponent bar (above board)
- [ ] Test timer display on player bar (below board)
- [ ] Verify responsive behavior on mobile (<720px)

### Phase 3: Interaction & Animation

- [ ] Implement active clock highlighting (blue glow)
- [ ] Implement pulsing dot animation (green, 2s cycle)
- [ ] Implement critical time warning (< 60s, red color)
- [ ] Implement rapid pulse for critical state (optional)
- [ ] Test prefers-reduced-motion accessibility

### Phase 4: Testing & Refinement

- [ ] Verify all color tokens map correctly
- [ ] Test with real game state (turn switching)
- [ ] Verify animations on all browsers (Chrome, Safari, Firefox)
- [ ] A11y testing: Ensure pulsing doesn't cause seizures (test with seizure-sensitive users if applicable)
- [ ] Responsive testing on mobile, tablet, desktop

---

## 7. Related Design System References

- **Design Tokens:** `client/src/ui/design-tokens.css` (all colors, spacing, typography)
- **GameSidebar Component:** `client/src/ui/GameSidebar.ts` (panel structure, layout)
- **PlayerInfoBar Component:** `client/src/ui/PlayerInfoBar.ts` (player bar styling, timer display)
- **Figma Source:** `docs/designs/playgrid-v1/src/app/pages/CheckersGame.tsx` (visual reference)
- **Design System Docs:** `docs/design-system.md` (comprehensive style guide)

---

## 8. Notes for Frontend Developer (Ortho)

**Key Implementation Points:**

1. **No new CSS custom properties needed** — all colors exist in `design-tokens.css`.

2. **Clock time formatter** — Use `formatTurnClock(seconds)` from `GameSidebar.ts` (already exists).

3. **Active clock indicator** — The small pulsing dot should only appear when the clock is active. Use conditional rendering based on `currentPlayer === playerColor`.

4. **Border vs. Ring** — Figma uses `ring-2 ring-blue-400`, but in our design system, use `border: 2px solid var(--pg-blue-400)` for consistency.

5. **Glass-morphism already applied** — The `.game-sidebar-panel` inherits `.glass-panel` class, so don't re-apply blur/background.

6. **Accessibility:** Ensure pulsing animations respect `prefers-reduced-motion` media query. Already handled in `GameSidebar.ts` at line 359–362.

7. **Mobile responsive:** Clock panel hides on mobile (<768px). Player bars stack vertically. Already implemented in `PlayerInfoBar.ts` at lines 183–193.

8. **Monospace font for time** — Use `font-family: 'Courier New', monospace` or similar; apply `font-variant-numeric: tabular-nums` for fixed-width digits.

---

**Spec Version:** 1.0  
**Date Extracted:** 2026-03-18  
**Designer:** Mario (UX Consultant)  
**Status:** Ready for Implementation

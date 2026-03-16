# Design System — Playgrid

This document defines the shared visual language extracted from the React/Tailwind redesign package. It serves as the reference for both **PixiJS renderers** (game canvas) and **HTML/CSS components** (UI overlays, sidebars).

**Key Philosophy:** Dark-first, glass-morphism aesthetic with smooth transitions and glossy 3D effects for game pieces.

---

## 1. Color Palette

### Base Neutrals (Dark Mode)

All colors are expressed as both **Tailwind class** and **hex value** for PixiJS rendering.

| Color | Tailwind | Hex | Use Case |
|-------|----------|-----|----------|
| Background | `bg-zinc-900` | `#0A0A0A` | Main page/canvas background |
| Dark Overlay | `bg-zinc-800` | `#18181B` | Header, sidebar backgrounds |
| Glass Panel | `bg-zinc-800/50` | `rgba(24, 24, 27, 0.5)` | Cards, panels (with `backdrop-blur-sm`) |
| Card Surface | `bg-zinc-900/50` | `rgba(9, 9, 11, 0.5)` | Nested containers |
| Text Primary | `text-white` | `#FFFFFF` | All headings, main text |
| Text Secondary | `text-zinc-400` | `#A1A1A1` | Labels, descriptions, disabled |
| Text Muted | `text-zinc-500` | `#71717A` | Placeholders, hints |
| Border Default | `border-zinc-800` | `#18181B` | Dividers, edges |
| Border Light | `border-zinc-700/50` | `rgba(63, 63, 70, 0.5)` | Subtle separators |

### Gradient Backgrounds

| Purpose | Tailwind | Hex (start → stop) |
|---------|----------|-------------------|
| Page BG | `bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950` | `#0A0A0A → #3F1659` |
| Phase Banner | `bg-gradient-to-r from-violet-900/50 to-purple-900/50` | `rgba(76, 29, 149, 0.5) → rgba(88, 28, 146, 0.5)` |
| Board Frame | `bg-gradient-to-br from-stone-800 via-stone-700 to-stone-800` | `#292423 → #3F3836` |
| Button (Primary) | `bg-gradient-to-br from-violet-600 to-purple-600` | `#7C3AED → #9333EA` |
| Button (Danger) | `bg-gradient-to-br from-red-600 to-red-700` | `#DC2626 → #B91C1C` |

### Accent & Status Colors

| Status | Tailwind | Hex | Use Case |
|--------|----------|-----|----------|
| Active/Online | `bg-green-500` | `#22C55E` | Player status indicator |
| Waiting/In-game | `bg-amber-500` | `#F59E0B` | Game state indicator |
| Away/Offline | `bg-zinc-500` | `#71717A` | Inactive player |
| Destructive | `bg-red-900/50` | `rgba(127, 29, 29, 0.5)` | Resign button |
| Highlight | `ring-violet-400` | `#A78BFA` | Selection rings, focus |

### Player Colors (Risk, Catan, multi-player games)

| Player | BG Tailwind | BG Hex | Border Tailwind | Border Hex | Text Tailwind | Text Hex |
|--------|-------------|--------|-----------------|------------|---------------|----------|
| Red | `bg-red-600` | `#DC2626` | `border-red-700` | `#B91C1C` | `text-red-400` | `#F87171` |
| Blue | `bg-blue-600` | `#2563EB` | `border-blue-700` | `#1D4ED8` | `text-blue-400` | `#60A5FA` |
| Green | `bg-green-600` | `#16A34A` | `border-green-700` | `#15803D` | `text-green-400` | `#4ADE80` |
| Yellow | `bg-yellow-600` | `#CA8A04` | `border-yellow-700` | `#A16207` | `text-yellow-400` | `#FACC15` |
| Purple | `bg-purple-600` | `#9333EA` | `border-purple-700` | `#7E22CE` | `text-purple-400` | `#D8B4FE` |
| Orange | `bg-orange-600` | `#EA580C` | `border-orange-700` | `#C2410C` | `text-orange-400` | `#FB923C` |

### Game Piece Gradients (Checkers, Chess)

| Piece | Main Gradient | Border | Highlight |
|-------|---------------|--------|-----------|
| Red | `from-red-400 via-red-500 to-red-700` | `border-red-900` | `bg-white/25` |
| Black | `from-zinc-600 via-zinc-800 to-zinc-900` | `border-zinc-950` | `bg-white/25` |
| White | `from-slate-100 to-slate-300` | `border-slate-400` | Built-in |
| King Crown | `text-yellow-300` | `ring-yellow-400/80` | `shadow-yellow-400/30` |

### Board Square Gradients (Checkers)

| Variant | Gradient | Shadow |
|---------|----------|--------|
| Light Square | `from-stone-300 via-stone-400 to-stone-500` | `shadow-inner` |
| Dark Square | `from-stone-700 via-stone-800 to-stone-900` | `shadow-lg` |
| Board Frame | `from-stone-800 via-stone-700 to-stone-800` | `shadow-2xl ring-1 ring-stone-600/50` |

### Dice & UI Elements

| Element | Tailwind | Hex | Notes |
|---------|----------|-----|-------|
| Dice | `bg-white` | `#FFFFFF` | Text: `text-zinc-900` |
| Territory BG | Player color (above) | — | Multiple variants per player |
| Status Indicator | `rounded-full` + player color | — | Size: `size-3` (12px) animated pulse |

---

## 2. Glass-Morphism Pattern

The signature card/panel pattern combines frosted glass effect with subtle backdrop blur.

### CSS Properties

```css
/* Reusable glass card class */
.glass-card {
  @apply rounded-xl bg-zinc-800/50 backdrop-blur-sm;
}

.glass-card-lg {
  @apply rounded-2xl bg-zinc-800/50 backdrop-blur-sm;
}

.glass-panel {
  @apply rounded-xl bg-zinc-800/50 p-4 backdrop-blur-sm;
}

.glass-panel-lg {
  @apply rounded-2xl bg-zinc-800/50 p-6 backdrop-blur-sm;
}
```

### Examples from Redesign

- **Header:** `border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm`
- **Sidebar Panel:** `rounded-xl bg-zinc-800/50 p-4 backdrop-blur-sm`
- **Active Game Card:** `rounded-lg bg-zinc-900/50 p-3 border border-zinc-700/50`
- **Phase Banner:** `rounded-xl bg-gradient-to-r from-violet-900/50 to-purple-900/50 p-4 backdrop-blur-sm border border-violet-700/50`

### Border Radius Scale

- Buttons, small elements: `rounded-lg` (8px)
- Cards, panels: `rounded-xl` (12px)
- Board frame: `rounded-2xl` (16px)
- Inner board grid: `rounded-xl` (12px)

---

## 3. Typography

### Font System

- **Base font size:** `16px` (`--font-size: 16px`)
- **Font weights:**
  - Normal: `400` (`--font-weight-normal`)
  - Medium: `500` (`--font-weight-medium`)
- **Line height:** Consistent `1.5` across all typographic elements

### Type Scale

| Element | Tailwind Class | Font Size | Weight | Use Case |
|---------|----------------|-----------|--------|----------|
| H1 | `text-2xl` | 24px | 500 | Page title, game name |
| H2 | `text-xl` | 20px | 500 | Section heading, panel title |
| H3 | `text-lg` | 18px | 500 | Sub-heading |
| H4 / Label | `text-base` | 16px | 500 | Control labels, info |
| Body | `text-base` | 16px | 400 | Default text |
| Small | `text-sm` | 14px | 400 | Secondary text, descriptions |
| Tiny | `text-xs` | 12px | 400 | Badges, hints, territory names |

### Text Color Combinations

| Context | Tailwind Combo | Hex Values |
|---------|----------------|-----------|
| Primary heading | `text-white` | `#FFFFFF` |
| Secondary text | `text-zinc-400` | `#A1A1A1` |
| Status/badge | `text-zinc-400` + `text-amber-400` | `#A1A1A1` + `#FBBF24` |
| Turn indicator | `text-green-400` or `text-zinc-400` | `#4ADE80` or `#A1A1A1` |
| Territory name | `text-white` font-semibold text-xs | `#FFFFFF` |
| Army count | `text-white` font-bold text-sm | `#FFFFFF` |

---

## 4. Spacing & Layout

### Spacing Scale

| Scale | Tailwind | Pixels | Use Case |
|-------|----------|--------|----------|
| `px-2` / `py-1` | 0.5rem | 8px | Tight spacing, badges |
| `px-3` / `py-2` | 0.75rem | 12px | Panel padding, button padding |
| `px-4` / `py-4` | 1rem | 16px | Panel padding, section spacing |
| `px-6` / `py-6` | 1.5rem | 24px | Large panel padding, header |
| `px-8` | 2rem | 32px | Page container padding |
| `gap-1` | 0.25rem | 4px | Tight element spacing |
| `gap-2` | 0.5rem | 8px | Default element spacing |
| `gap-3` | 0.75rem | 12px | Content spacing |
| `gap-6` | 1.5rem | 24px | Section spacing |

### Grid Layouts

#### Lobby (3-column responsive)

```tailwind
<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <!-- Game Library: 2 cols on large screens -->
  <div class="lg:col-span-2">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Game tiles */}
    </div>
  </div>
  <!-- Sidebar: 1 col on large screens -->
  <div class="space-y-6">
    {/* Active games & online players */}
  </div>
</div>
```

#### Game Page (2-column for board + sidebar)

```tailwind
<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <!-- Game Board: 2 cols on large screens -->
  <div class="lg:col-span-2">
    {/* Board and info */}
  </div>
  <!-- Sidebar: 1 col on large screens -->
  <div class="space-y-6">
    {/* Game info, controls, legend */}
  </div>
</div>
```

#### Risk Board (4-column with larger map)

```tailwind
<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
  <!-- Game Board: 3 cols on large screens -->
  <div class="lg:col-span-3">
    {/* Map and legend */}
  </div>
  <!-- Sidebar: 1 col on large screens -->
  <div class="space-y-6">
    {/* Territory info, actions, rules */}
  </div>
</div>
```

### Container Max-Width

- **Page container:** `max-w-7xl` (80rem / 1280px)
- **Board container:** `max-w-2xl` (42rem / 672px) for Checkers, Backgammon
- **Map container:** `max-w-4xl` (56rem / 896px) for Risk

### Padding & Margins

- **Page padding:** `px-6` (24px horizontal)
- **Vertical spacing:** `py-4` (header), `py-8` (page content)
- **Panel padding:** `p-4` (standard) or `p-6` (large)
- **Sidebar spacing:** `space-y-6` (24px between panels)
- **Nested spacing:** `space-y-2` (8px) to `space-y-3` (12px) within panels

---

## 5. Component Patterns

### 5.1 Game Tile Card

Pattern: Image + overlay gradient + info bar

```tsx
<button className="group relative overflow-hidden rounded-xl bg-zinc-800 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-violet-500/20">
  <div className="aspect-[4/3] overflow-hidden">
    <img className="size-full object-cover transition-transform duration-300 group-hover:scale-110" />
  </div>
  {/* Dark overlay from bottom */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
  {/* Info bar */}
  <div className="absolute bottom-0 left-0 right-0 p-4">
    <h3 className="text-xl mb-2 text-white">Game Name</h3>
    <div className="flex items-center justify-between text-sm text-zinc-300">
      <span className="flex items-center gap-1">
        <Users className="size-4" />2-6 players
      </span>
      <span className="text-violet-400">8 active</span>
    </div>
  </div>
</button>
```

### 5.2 Status Indicator (Online/In-Game/Away)

Pattern: Colored dot badge with pulse animation

```tsx
<div className="relative">
  <div className="size-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
    Avatar
  </div>
  {/* Status dot */}
  <Circle
    className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-zinc-800 
      ${statusColors[status]}`}
    fill="currentColor"
  />
</div>

/* Status colors: */
statusColors = {
  online: "bg-green-500",      // #22C55E
  "in-game": "bg-amber-500",   // #F59E0B
  away: "bg-zinc-500",         // #71717A
};
```

### 5.3 Player Info Bar

Pattern: Avatar + name/status + turn indicator

```tsx
<div className="flex items-center justify-between rounded-xl bg-zinc-800/50 p-4 backdrop-blur-sm">
  <div className="flex items-center gap-3">
    <div className="size-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
      P
    </div>
    <div>
      <p className="text-white">Player123 (You)</p>
      <p className="text-xs text-zinc-400">Red Pieces</p>
    </div>
  </div>
  {/* Turn indicator */}
  <div className={`rounded-full px-3 py-1 text-sm 
    ${currentPlayer === "red" 
      ? "bg-green-500/20 text-green-400" 
      : "bg-zinc-700 text-zinc-400"
    }`}>
    {currentPlayer === "red" ? "Your Turn" : "Waiting..."}
  </div>
</div>
```

### 5.4 Phase Banner (Risk-Style)

Pattern: Gradient background + animated indicator + phase text + action button

```tsx
<div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-900/50 to-purple-900/50 p-4 backdrop-blur-sm border border-violet-700/50">
  <div className="flex items-center gap-3">
    {/* Pulse indicator */}
    <div className={`size-3 rounded-full ${playerColors[currentPlayer].bg} animate-pulse`} />
    <div>
      <p className="text-white capitalize">
        <span className="font-bold">{currentPlayer}</span>'s Turn - {gamePhase.toUpperCase()} Phase
      </p>
      {gamePhase === "deploy" && (
        <p className="text-sm text-zinc-400">Armies to deploy: {armiesToDeploy}</p>
      )}
    </div>
  </div>
  <button className="rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 px-4 py-2 text-white transition-all hover:scale-105 hover:shadow-lg">
    {gamePhase === "fortify" ? "End Turn" : "Next Phase"}
  </button>
</div>
```

### 5.5 Sidebar Panel (Glass Card + Heading + Content)

Pattern: Reusable container for game info, controls, history

```tsx
<div className="rounded-xl bg-zinc-800/50 p-4 backdrop-blur-sm">
  <h2 className="mb-4 text-lg text-white">Panel Title</h2>
  {/* Content varies: text, list, buttons, etc. */}
  <div className="space-y-3 text-sm">
    {/* Children */}
  </div>
</div>
```

### 5.6 Active Games List Card

Pattern: Nested glass card with game info + join button

```tsx
<div className="rounded-lg bg-zinc-900/50 p-3 border border-zinc-700/50 hover:border-violet-500/50 transition-colors">
  <div className="flex items-start justify-between mb-2">
    <div className="flex-1">
      <h3 className="text-white mb-1">Game Name</h3>
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          2/6
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          12m
        </span>
      </div>
    </div>
    <span className={`rounded-full px-2 py-0.5 text-xs 
      ${game.status === "waiting" 
        ? "bg-amber-500/20 text-amber-400" 
        : "bg-green-500/20 text-green-400"
      }`}>
      {game.status === "waiting" ? "Waiting" : "Playing"}
    </span>
  </div>
  {/* Player avatars + Join button */}
</div>
```

---

## 6. Game Board Styling

### 6.1 Board Frame (Checkers)

```tsx
<div className="aspect-square rounded-2xl bg-gradient-to-br from-stone-800 via-stone-700 to-stone-800 p-6 shadow-2xl ring-1 ring-stone-600/50">
  {/* Inner grid with board squares */}
</div>
```

**Properties:**
- **Aspect ratio:** Square (1:1)
- **Gradient:** `from-stone-800 via-stone-700 to-stone-800`
- **Border radius:** `rounded-2xl` (16px)
- **Padding:** `p-6` (24px interior space)
- **Shadow:** `shadow-2xl` + `ring-1 ring-stone-600/50`

### 6.2 Board Grid Layout (Checkers 8×8)

```tsx
<div className="grid size-full grid-cols-8 gap-1 rounded-xl overflow-hidden shadow-inner p-2 bg-gradient-to-br from-stone-950/30 to-transparent">
  {/* 64 squares */}
</div>
```

**Properties:**
- **Grid:** `grid-cols-8` (8 columns), `gap-1` (4px between squares)
- **Inner shadow:** `shadow-inner`
- **Padding:** `p-2` (8px)
- **Background:** `from-stone-950/30 to-transparent`

### 6.3 Square Styling (Light vs Dark)

#### Light Square
```tailwind
bg-gradient-to-br from-stone-300 via-stone-400 to-stone-500 shadow-inner
```
- **Hex:** `#D2B48C → #A0826D`
- **Used for:** Playable squares (checkers)

#### Dark Square
```tailwind
bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900 shadow-lg
```
- **Hex:** `#8B8680 → #44403C`
- **Used for:** Non-playable squares (checkers)

### 6.4 Piece Styling (3D Glossy Effect)

Pattern: Outer glow + main radial gradient + inner highlight

```tsx
<div className="size-[80%] rounded-full shadow-2xl transition-all duration-200 relative">
  {/* Outer glow/shadow */}
  <div className={`absolute inset-0 rounded-full blur-sm opacity-60 
    ${square.piece.startsWith("red") ? "bg-red-500" : "bg-zinc-800"}`} />
  
  {/* Main piece */}
  <div className={`relative size-full rounded-full shadow-lg border-2 
    ${square.piece.startsWith("red")
      ? "bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-red-900"
      : "bg-gradient-to-br from-zinc-600 via-zinc-800 to-zinc-900 border-zinc-950"
    }`}>
    
    {/* Inner highlight (glossy shine) */}
    <div className="absolute top-[15%] left-[20%] right-[35%] h-[25%] rounded-full bg-white/25 blur-sm" />
    
    {/* King marker (crown) */}
    {square.piece.endsWith("king") && (
      <div className="flex size-full items-center justify-center text-yellow-300 text-2xl font-bold drop-shadow-lg">
        ♔
      </div>
    )}
  </div>
</div>
```

**Composition:**
1. **Outer blur:** `blur-sm opacity-60` — drop shadow effect
2. **Main body:** Radial gradient with contrasting light-to-dark
3. **Highlight:** `bg-white/25 blur-sm` at top-left (simulates sphere reflection)
4. **King ring:** `ring-2 ring-yellow-400/80 shadow-yellow-400/30`

### 6.5 Selection States

#### Ring Effect + Scale
```tailwind
ring-4 ring-violet-400 ring-offset-2 ring-offset-stone-900 scale-95
```
- **Ring:** 4px violet highlight
- **Offset:** 2px gap from piece, dark background behind
- **Scale:** Slightly shrink to show selection
- **Transition:** `transition-all duration-200`

### 6.6 Hover Effects

```tailwind
hover:brightness-110 hover:scale-105 hover:shadow-xl
```
- **Brightness:** Lighten piece by 10%
- **Scale:** Enlarge by 5%
- **Shadow:** Elevate with expanded shadow
- **Transition:** `transition-all duration-200`

### 6.7 Backgammon Board Styling

```tsx
<div className="rounded-2xl bg-gradient-to-br from-amber-900 via-amber-950 to-stone-900 p-6 shadow-2xl ring-1 ring-amber-800/50">
  {/* Top half: points 12-23 */}
  <div className="grid grid-cols-13 gap-1 mb-1">
    {/* Points 12-17 on left, Bar in center, Points 18-23 on right */}
  </div>
  
  {/* Middle: Dice area */}
  <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-4 rounded-lg border-y-2 border-amber-800/30">
    {/* Roll button + dice display */}
  </div>
  
  {/* Bottom half: points 0-11 */}
  <div className="grid grid-cols-13 gap-1 mt-1">
    {/* Points 11-6 on left, Bar in center, Points 5-0 on right */}
  </div>
</div>
```

**Color scheme:** `from-amber-900 via-amber-950 to-stone-900` (wood tones)

### 6.8 Risk Territory Styling

```tsx
<button className={`relative transition-all duration-200 
  ${isSelected ? "z-20 scale-110" : "z-10"}`}
  style={{ left: `${territory.x}%`, top: `${territory.y}%` }}>
  <div className={`relative flex flex-col items-center justify-center rounded-lg 
    ${colors.bg} border-2 ${colors.border} shadow-lg hover:shadow-xl hover:scale-105 
    transition-all ${isSelected ? `ring-4 ${colors.ring}` : ""} p-2 min-w-[80px]`}>
    
    {/* Territory name */}
    <div className="text-xs text-white font-semibold text-center leading-tight mb-1 px-1">
      {territory.name}
    </div>
    
    {/* Army count with shield icon */}
    <div className="flex items-center justify-center gap-1 bg-black/30 rounded px-2 py-0.5">
      <Shield className="size-3 text-white" />
      <span className="text-white text-sm font-bold">{territory.armies}</span>
    </div>
  </div>
</button>
```

**Properties:**
- **Player color:** Dynamic `bg-{color}-600`, `border-{color}-700`, `text-{color}-400`
- **Ring on select:** `ring-4` in player's accent color
- **Scale on hover:** `hover:scale-105`
- **Position:** Absolute `left: x%`, `top: y%`, `translate(-50%, -50%)`

### 6.9 Dice Display

```tsx
<div className="w-12 h-12 rounded-lg bg-white shadow-lg flex items-center justify-center text-2xl font-bold text-zinc-900">
  {die}
</div>
```

- **Background:** `bg-white` (#FFFFFF)
- **Shadow:** `shadow-lg`
- **Text:** `text-zinc-900` (#0A0A0A) for contrast
- **Size:** 12×12 (48px, fit for pip display)

---

## 7. Animation & Transitions

### 7.1 Default Transitions

```tailwind
transition-all duration-200
```

- **Property:** All (transforms, opacity, colors, shadows)
- **Duration:** 200ms
- **Timing:** Linear (default)
- **Use:** Piece moves, UI state changes, hover effects

### 7.2 Scale Transforms

| Transform | Tailwind | Use Case |
|-----------|----------|----------|
| Hover scale up | `hover:scale-105` | Interactive elements, pieces on hover |
| Selected scale | `scale-110` | Selected piece or territory |
| Selection shrink | `scale-95` | Alternative selection feedback |
| Button hover | `hover:scale-105` | Primary action buttons |

### 7.3 Pulse Animation

```tailwind
animate-pulse
```

- **Use:** Status indicator dots, turn notifications
- **Color:** Player color (e.g., `size-3 rounded-full bg-red-600 animate-pulse`)
- **Frequency:** Default ease-in-out pulsing

### 7.4 Brightness & Shadow Elevation

```tailwind
hover:brightness-110
hover:shadow-xl
```

- **Brightness:** Increase by 10%
- **Shadow:** Elevate to extra-large shadow
- **Used:** Piece selection, territory hover

### 7.5 Smooth Color Transitions

```tailwind
transition-colors
```

- **Use:** Status badges (amber/green), turn indicators
- **Duration:** `duration-200`
- **Properties:** Background, text, border colors

### 7.6 Transform Origin

```css
/* Pieces scale from center */
transform-gpu
/* Buttons scale from center (default) */
```

### 7.7 Custom Animations

For advanced effects not in Tailwind (requires JS library like `tweenjs` or `gsap`):

- **Piece movement:** Smooth easing (0.3-0.5s)
- **Dice roll:** Rapid spin + decelerate (0.6-0.8s)
- **Phase transitions:** Fade + slide (0.3s)
- **Hippo mouth:** Continuous bounce (1-2s repeat)

**Recommended:** Use `tweenjs` (lightweight) or `gsap` (full-featured)

---

## 8. Implementation Guide for PixiJS

When translating Tailwind classes to PixiJS canvas rendering:

### Color Conversion

```javascript
// Tailwind → Hex
const tailwindToHex = {
  'bg-zinc-900': 0x0A0A0A,
  'bg-zinc-800': 0x18181B,
  'text-white': 0xFFFFFF,
  'text-zinc-400': 0xA1A1A1,
  'bg-red-600': 0xDC2626,
  // ... (see Color Palette section)
};

// Transparency (Tailwind /50, /20, etc.)
const alphaMap = {
  '/50': 0.5,
  '/20': 0.2,
  '/30': 0.3,
};
```

### Gradient Rendering

```javascript
// Tailwind: bg-gradient-to-br from-stone-800 via-stone-700 to-stone-800
const gradient = new FillGradient(startX, startY, endX, endY);
gradient.addColorStop(0, 0x292423);    // stone-800
gradient.addColorStop(0.5, 0x3F3836); // stone-700
gradient.addColorStop(1, 0x292423);   // stone-800
graphics.fill = gradient;
```

### Shadow & Glow

```javascript
// Outer glow (blur effect)
const glow = new Graphics();
glow.circle(x, y, radius + 4);
glow.fill({ color: 0xFF0000, alpha: 0.3 });
glow.blur = 8;

// Drop shadow
const shadow = new Graphics();
shadow.circle(x, y + 3, radius);
shadow.fill({ color: 0x000000, alpha: 0.4 });
shadow.blur = 4;
```

### Ring & Border Rendering

```javascript
// Ring effect: ring-4 ring-violet-400 ring-offset-2
const ring = new Graphics();
ring.circle(x, y, radius);
ring.stroke({ color: 0xA78BFA, width: 4, alignment: 0.5 });
ring.position.set(x, y - 4); // ring-offset-2
```

### Text Rendering

```javascript
// Text styling
const text = new Text({
  text: 'Your Turn',
  style: {
    fontSize: 16,      // text-base
    fontWeight: 500,   // font-semibold
    fill: 0x4ADE80,    // text-green-400
    lineHeight: 1.5,
  },
});
```

---

## 9. Responsive Breakpoints

| Breakpoint | Tailwind | Width |
|------------|----------|-------|
| Mobile | (none) | < 640px |
| Small | `sm:` | ≥ 640px |
| Medium | `md:` | ≥ 768px |
| Large | `lg:` | ≥ 1024px |
| Extra Large | `xl:` | ≥ 1280px |
| 2XL | `2xl:` | ≥ 1536px |

### Common Layout Breakpoints

- **Lobby grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Game layout:** `grid-cols-1 lg:grid-cols-3` (board + sidebar)
- **Risk layout:** `grid-cols-1 lg:grid-cols-4` (map + sidebar)
- **Board width limit:** `max-w-2xl` on medium+, full width on mobile

---

## 10. Accessibility & Contrast

### Text Contrast (WCAG AA)

| Text Color | Background | Ratio | Pass AA |
|------------|------------|-------|---------|
| `text-white` (#FFF) | `bg-zinc-900` (#0A0A0A) | 19.5:1 | ✅ |
| `text-zinc-400` (#A1A1A1) | `bg-zinc-900` (#0A0A0A) | 7.0:1 | ✅ |
| `text-green-400` (#4ADE80) | `bg-green-500/20` | ~4.5:1 | ✅ |
| `text-amber-400` (#FBBF24) | `bg-amber-500/20` | ~5.0:1 | ✅ |

### Interactive Elements

- **Focus ring:** Use native `:focus-visible` or `focus:ring-2 focus:ring-violet-400`
- **Button sizes:** Min `px-3 py-1` for touch targets (≥24px height)
- **Status indicators:** Always pair color with text label (not color-only)

---

## 11. File References

### Source Documents
- **Theme variables:** `docs/designs/redesign/src/styles/theme.css`
- **Lobby layout:** `docs/designs/redesign/src/app/pages/Lobby.tsx`
- **Game layouts:** 
  - `docs/designs/redesign/src/app/pages/CheckersGame.tsx`
  - `docs/designs/redesign/src/app/pages/RiskGame.tsx`
  - `docs/designs/redesign/src/app/pages/BackgammonGame.tsx`
- **Components:**
  - `docs/designs/redesign/src/app/components/GameTile.tsx`
  - `docs/designs/redesign/src/app/components/ActiveGamesList.tsx`
  - `docs/designs/redesign/src/app/components/OnlinePlayersList.tsx`

### Implementation Targets
- **PixiJS renderers:** `client/src/renderers/`
- **HTML HUD:** `client/src/ui/HUD.ts`, `client/index.html`
- **Tailwind config:** (if applicable to redesign package)

---

## 12. Quick Reference Checklists

### For New Game Renderers

- [ ] Use `from-zinc-900 via-zinc-900 to-violet-950` gradient background
- [ ] Board/frame background: `from-{material}-800 via-{material}-700 to-{material}-800`
- [ ] Pieces: Radial gradient + outer glow + inner highlight
- [ ] Selection: `ring-4 ring-violet-400` + `scale-110`
- [ ] Hover: `scale-105` + `brightness-110`
- [ ] Transitions: `duration-200` on all interactive elements

### For HTML Components

- [ ] Panels: `rounded-xl bg-zinc-800/50 backdrop-blur-sm p-4`
- [ ] Headers: `border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm`
- [ ] Status dots: `rounded-full` + player color + `animate-pulse`
- [ ] Text hierarchy: white (primary), `zinc-400` (secondary), `zinc-500` (muted)
- [ ] Spacing: `gap-6` between sections, `space-y-3` within panels

### For PixiJS Color Mapping

- [ ] Neutral palette: Zinc (800, 900) → `#18181B`, `#0A0A0A`
- [ ] Player colors: Full saturation at `*-600` level
- [ ] Glass effect: Use alpha 0.5 + blur filter
- [ ] Glow: Blur 8px + opacity 0.3-0.6
- [ ] Highlight: White `0xFFFFFF` at alpha 0.25

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-15 | Initial design system extraction from React/Tailwind redesign |


### 2026-03-16T01:23Z: Game sidebar reserves board space on desktop
**By:** Gately
**What:** When the in-game sidebar is visible on desktop, reserve a right-side layout lane for it by shrinking `#game-container` instead of floating the sidebar over the Pixi canvas. Coordinate HUD/canvas updates through a shared layout event and `ResizeObserver`.
**Why:** User request — the board must remain fully visible, and DOM overlay chrome should anchor to the board column instead of obscuring gameplay.

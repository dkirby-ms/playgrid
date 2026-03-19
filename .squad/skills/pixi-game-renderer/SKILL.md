# Skill: PixiJS Game Renderer Pattern

**Owner:** Gately  
**Category:** Client Rendering  
**Updated:** 2025-01-XX

## Overview

Reusable pattern for creating game renderers using PixiJS in the playgrid client architecture.

## When to Use

Use this pattern when implementing a new game type that needs:
- Visual board/game state rendering
- Interactive click/touch handling
- Responsive layout across screen sizes
- Integration with Colyseus room state

## Architecture

### Interface Contract

```typescript
interface GameRenderer {
  readonly gameType: string;
  readonly container: Container;
  init(state: unknown, context?: GameRendererContext): void;
  onStateChange(state: unknown): void;
  update(deltaTime: number): void;
  resize(width: number, height: number): void;
  handleInput(event: RendererInputEvent): void;
  destroy(): void;
}
```

### Layer Structure

Always use separate Container layers for clean z-ordering:

```typescript
private readonly boardLayer = new Container();
private readonly piecesLayer = new Container();  // or territoryLayer, cardLayer, etc.
private readonly hudLayer = new Container();
private readonly overlayLayer = new Container();  // for modals, game-over screens

this.container.addChild(
  this.boardLayer,
  this.piecesLayer,
  this.hudLayer,
  this.overlayLayer
);
```

### State Management

1. **Server-authoritative:** Client sends action intents, server validates and updates state
2. **Message sending:** Use `room.send(messageType, payload)`
3. **Reactive rendering:** Re-render in `onStateChange` handler
4. **Local selection state:** Track UI selections locally, sync with server state

```typescript
private handleClick(id: string): void {
  if (!this.isLocalPlayersTurn()) return;
  
  if (this.selectedId && this.validTargets.has(id)) {
    // Send action to server
    this.room?.send("move", { from: this.selectedId, to: id });
    this.clearSelection();
  } else if (this.isSelectable(id)) {
    this.setSelection(id);
  }
}
```

### Responsive Layout

Always implement adaptive scaling in `resize()`:

```typescript
resize(width: number, height: number): void {
  this.width = width;
  this.height = height;
  
  const availableWidth = width - (VIEW_PADDING * 2);
  const availableHeight = height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
  
  const scaleX = availableWidth / GAME_WIDTH;
  const scaleY = availableHeight / GAME_HEIGHT;
  this.scale = Math.min(scaleX, scaleY, 1);
  
  this.offsetX = (width - (GAME_WIDTH * this.scale)) / 2;
  this.offsetY = TOP_HUD_SPACE + ((availableHeight - (GAME_HEIGHT * this.scale)) / 2);
  
  this.layout();
  this.redraw();
}
```

### Interactive Graphics

Pattern for clickable game elements:

```typescript
const piece = new Graphics();
piece.eventMode = "static";
piece.cursor = "pointer";
piece.on("pointertap", () => this.handlePieceClick(id));

// Update cursor based on actionable state
piece.cursor = this.isActionable(id) ? "pointer" : "default";
```

### Selection Highlighting

Standard approach for showing selected/valid states:

```typescript
// Selected state
if (isSelected) {
  graphic.stroke({
    color: SELECTED_COLOR,
    width: strokeWidth,
  });
}

// Valid target state
if (isValidTarget) {
  graphic.circle(centerX, centerY, radius * 0.15)
    .fill({ color: VALID_TARGET_COLOR, alpha: 0.8 });
}
```

### HUD Components

Pattern for status text and buttons:

```typescript
private readonly statusText = new Text({
  text: "",
  style: {
    fontFamily: "sans-serif",
    fontSize: 24,
    fontWeight: "700",
    fill: TEXT_COLOR,
    align: "center",
  },
});
this.statusText.anchor.set(0.5);  // Center anchor

// Button pattern
private readonly button = new Container();
private readonly buttonBg = new Graphics();
private readonly buttonText = new Text({ text: "Action", style: {...} });

this.button.addChild(this.buttonBg, this.buttonText);
this.button.eventMode = "static";
this.button.on("pointertap", () => this.handleAction());
this.button.on("pointerenter", () => { this.isHovered = true; this.updateButton(); });
this.button.on("pointerleave", () => { this.isHovered = false; this.updateButton(); });
```

## Registration

Add to renderer registry in `client/src/renderers/index.ts`:

```typescript
import { MyGameRenderer } from "./MyGameRenderer";
rendererRegistry.register("mygame", () => new MyGameRenderer());
export { MyGameRenderer } from "./MyGameRenderer";
```

## Examples

- **Simple board:** `CheckersRenderer.ts` — 8×8 grid, piece graphics, move validation
- **Complex map:** `RiskRenderer.ts` — 42 territories, multi-phase interaction, HUD buttons
- **Card game:** `BackgammonRenderer.ts` — dice, points, pieces

## Common Patterns

### Turn Indicator
```typescript
private getStatusLabel(): { text: string; color: number } {
  if (this.phase === "waiting") {
    return { text: "Waiting for players", color: WAITING_COLOR };
  }
  
  if (this.isLocalPlayersTurn()) {
    return { text: "Your turn", color: READY_COLOR };
  }
  
  return { text: "Opponent's turn", color: WAITING_COLOR };
}
```

### Local Player Detection
```typescript
private isLocalPlayersTurn(): boolean {
  const localSessionId = this.room?.sessionId;
  if (!localSessionId || localSessionId !== this.currentTurn) {
    return false;
  }
  
  const localPlayer = this.players.get(localSessionId);
  return Boolean(localPlayer && !localPlayer.isSpectator);
}
```

### Selection Sync
```typescript
private syncSelectionWithState(): void {
  if (!this.selectedId) {
    this.validTargets.clear();
    return;
  }
  
  if (!this.isStillSelectable(this.selectedId)) {
    this.clearSelection();
    return;
  }
  
  this.updateValidTargets();
}
```

## Anti-Patterns

❌ **Don't** store game logic in renderer (e.g., move validation, score calculation)
✅ **Do** use helper functions in `games/{game}/clientLogic.ts`

❌ **Don't** mutate state directly
✅ **Do** send messages to server and let `onStateChange` trigger updates

❌ **Don't** use hardcoded pixel positions
✅ **Do** calculate positions based on scale and available space

❌ **Don't** subscribe to room events without cleanup
✅ **Do** unsubscribe in `destroy()` method

## Testing Considerations

- Mock `Room` context with sessionId
- Test with different player indices (player 1, player 2, spectator)
- Test resize behavior (mobile, tablet, desktop)
- Test selection/deselection flows
- Verify cursor states for actionable elements

## Performance Tips

1. **Reuse Graphics objects** instead of creating new ones per frame
2. **Batch text updates** — only update when state changes, not every frame
3. **Use Container visibility** instead of removing/adding children
4. **Clear and redraw Graphics** instead of destroying and recreating
5. **Anchor text once** in constructor, not every render

## References

- **GameRenderer interface:** `client/src/renderers/GameRenderer.ts`
- **RendererRegistry:** `client/src/renderers/RendererRegistry.ts`
- **GameScene integration:** `client/src/scenes/GameScene.ts`
- **Colyseus Room:** https://docs.colyseus.io/client/room/
- **PixiJS Containers:** https://pixijs.download/release/docs/scene.Container.html

## State Schema Orientation Fields

**Critical pattern:** When rendering game elements with directional/orientation metadata in the state schema, **always use the state field** rather than assuming a fixed orientation.

### Example: Dominos Tile Orientation

The `BoardTile` schema includes an `exposedEnd` field indicating which pip value faces outward toward the chain:

```typescript
class BoardTile extends Schema {
  highPips: number;
  lowPips: number;
  exposedEnd: number;  // Which pip faces the chain's left/top
  // ...
}
```

**Correct rendering logic** (respects `exposedEnd`):

```typescript
// Horizontal tile
const leftPips = tile.exposedEnd === tile.highPips ? tile.highPips : tile.lowPips;
const rightPips = tile.exposedEnd === tile.highPips ? tile.lowPips : tile.highPips;
drawPips(leftPips, leftHalf);
drawPips(rightPips, rightHalf);

// Vertical tile
const topPips = tile.exposedEnd === tile.highPips ? tile.highPips : tile.lowPips;
const bottomPips = tile.exposedEnd === tile.highPips ? tile.lowPips : tile.highPips;
drawPips(topPips, topHalf);
drawPips(bottomPips, bottomHalf);
```

**Bug:** The original renderer ignored `exposedEnd` and always drew `highPips` on the left/top, causing tiles to render with flipped orientation.

### General Rule

If the server-side placement logic computes orientation/direction metadata (e.g., `exposedEnd`, `rotation`, `facing`, `direction`), the renderer **must** use that field to determine visual layout. Server-authoritative state is the source of truth.

### Testing

Add server-side tests to verify orientation fields are correctly set during state mutations (e.g., `placeTileOnBoard` tests for `exposedEnd`). This catches server logic bugs before they reach the renderer.


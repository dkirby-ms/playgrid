import { Container, Graphics, type FederatedPointerEvent } from "pixi.js";

// Minimum drag distance (px) before a pointerdown is promoted from click to drag
const DRAG_THRESHOLD = 6;

export interface DragCallbacks {
  /** Called each frame while dragging. Use to highlight valid drop targets. */
  onDragMove?: (id: string, x: number, y: number) => void;
  /** Called when the piece is released. Return true if the drop was accepted. */
  onDrop?: (id: string, x: number, y: number) => boolean;
  /** Called when a drag is cancelled (drop rejected or threshold not met). */
  onDragCancel?: (id: string) => void;
}

interface ActiveDrag {
  id: string;
  proxy: Graphics;
  shadow: Graphics;
  startX: number;
  startY: number;
  promoted: boolean;
}

/**
 * Proxy-based drag helper for PixiJS game renderers.
 *
 * The renderer decides when to initiate a drag and provides a visual proxy
 * graphic. DragHelper manages moving that proxy, rendering a drop shadow,
 * and firing callbacks on move/drop/cancel.
 *
 * Distinguishes click vs. drag via a distance threshold so existing
 * click-to-move interactions continue to work as fallback.
 *
 * Usage (in a renderer):
 *   // In constructor:
 *   this.drag = new DragHelper(this.container, this.dragLayer, callbacks);
 *
 *   // On pointerdown:
 *   const proxy = this.drawPieceProxy(index);
 *   this.drag.beginDrag("piece-5", proxy, pointerX, pointerY);
 *
 *   // In destroy():
 *   this.drag.destroy();
 */
export class DragHelper {
  private readonly stage: Container;
  private readonly layer: Container;
  private readonly callbacks: Required<DragCallbacks>;
  private active: ActiveDrag | null = null;

  private readonly boundMove: (e: FederatedPointerEvent) => void;
  private readonly boundUp: (e: FederatedPointerEvent) => void;

  constructor(stage: Container, dragLayer: Container, callbacks: DragCallbacks) {
    this.stage = stage;
    this.layer = dragLayer;
    this.callbacks = {
      onDragMove: callbacks.onDragMove ?? (() => {}),
      onDrop: callbacks.onDrop ?? (() => true),
      onDragCancel: callbacks.onDragCancel ?? (() => {}),
    };

    this.boundMove = this.handlePointerMove.bind(this);
    this.boundUp = this.handlePointerUp.bind(this);

    this.stage.on("pointermove", this.boundMove);
    this.stage.on("pointerup", this.boundUp);
    this.stage.on("pointerupoutside", this.boundUp);
  }

  /** Whether a drag has been promoted (moved past threshold). */
  get isDragging(): boolean {
    return this.active?.promoted === true;
  }

  /** The id of the piece currently being tracked, or null. */
  get draggingId(): string | null {
    return this.active?.id ?? null;
  }

  /**
   * Begin tracking a potential drag. The proxy is hidden until the pointer
   * moves past the drag threshold, at which point it becomes visible.
   */
  beginDrag(id: string, proxy: Graphics, startX: number, startY: number): void {
    this.cancel();

    proxy.eventMode = "none";
    proxy.visible = false;

    const shadow = new Graphics();
    shadow.eventMode = "none";
    shadow.visible = false;

    this.layer.addChild(shadow);
    this.layer.addChild(proxy);

    this.active = { id, proxy, shadow, startX, startY, promoted: false };
  }

  /** Cancel any in-progress or pending drag. */
  cancel(): void {
    if (!this.active) return;
    const { id, proxy, shadow, promoted } = this.active;
    proxy.destroy();
    shadow.destroy();
    this.active = null;
    if (promoted) {
      this.callbacks.onDragCancel(id);
    }
  }

  /** Returns true if a drag was pending but never promoted (i.e. it was a click). */
  wasPendingClick(): boolean {
    return this.active !== null && !this.active.promoted;
  }

  /** Full cleanup — call in the renderer's destroy(). */
  destroy(): void {
    this.cancel();
    this.stage.off("pointermove", this.boundMove);
    this.stage.off("pointerup", this.boundUp);
    this.stage.off("pointerupoutside", this.boundUp);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private handlePointerMove(e: FederatedPointerEvent): void {
    if (!this.active) return;

    const pos = this.stage.toLocal(e.global);

    if (!this.active.promoted) {
      const dx = pos.x - this.active.startX;
      const dy = pos.y - this.active.startY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

      // Promote to a real drag
      this.active.promoted = true;
      this.active.proxy.visible = true;
      this.active.shadow.visible = true;
    }

    this.active.proxy.position.set(pos.x, pos.y);
    this.updateShadow(pos.x, pos.y);
    this.callbacks.onDragMove(this.active.id, pos.x, pos.y);
  }

  private handlePointerUp(e: FederatedPointerEvent): void {
    if (!this.active) return;

    if (!this.active.promoted) {
      // Never exceeded threshold — treat as click (caller handles via wasPendingClick check)
      const { proxy, shadow } = this.active;
      proxy.destroy();
      shadow.destroy();
      this.active = null;
      return;
    }

    const pos = this.stage.toLocal(e.global);
    const { id, proxy, shadow } = this.active;
    const accepted = this.callbacks.onDrop(id, pos.x, pos.y);

    proxy.destroy();
    shadow.destroy();
    this.active = null;

    if (!accepted) {
      this.callbacks.onDragCancel(id);
    }
  }

  private updateShadow(x: number, y: number): void {
    if (!this.active) return;
    const { shadow, proxy } = this.active;
    shadow.clear();
    const bounds = proxy.getLocalBounds();
    const offset = 4;
    shadow
      .roundRect(
        x + bounds.x + offset,
        y + bounds.y + offset,
        bounds.width, bounds.height, 6,
      )
      .fill({ color: 0x000000, alpha: 0.22 });
  }
}

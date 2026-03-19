import { describe, expect, it, vi } from "vitest";
import { Container, Graphics, EventEmitter } from "pixi.js";
import { DragHelper } from "./DragHelper";

// Minimal mock helpers — DragHelper only needs Container event methods and toLocal
function createMockStage(): Container {
  const emitter = new EventEmitter();
  const stage = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.off(event, handler);
    }),
    toLocal: vi.fn((global: { x: number; y: number }) => ({ x: global.x, y: global.y })),
    addChild: vi.fn(),
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
  };
  return stage as unknown as Container;
}

function createMockDragLayer(): Container {
  return {
    addChild: vi.fn(),
    eventMode: "none",
  } as unknown as Container;
}

function createProxy(): Graphics {
  return {
    eventMode: "none",
    visible: false,
    position: { set: vi.fn() },
    destroy: vi.fn(),
    getLocalBounds: vi.fn(() => ({ x: -20, y: -20, width: 40, height: 40 })),
  } as unknown as Graphics;
}

describe("DragHelper", () => {
  it("begins in non-dragging state", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const helper = new DragHelper(stage, layer, {});

    expect(helper.isDragging).toBe(false);
    expect(helper.draggingId).toBeNull();

    helper.destroy();
  });

  it("tracks a pending drag without promoting below threshold", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDrop = vi.fn(() => true);
    const helper = new DragHelper(stage, layer, { onDrop });

    const proxy = createProxy();
    helper.beginDrag("piece-1", proxy, 100, 100);

    expect(helper.draggingId).toBe("piece-1");
    expect(helper.isDragging).toBe(false); // not promoted yet

    // Small move below threshold (< 6px)
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointermove", {
      global: { x: 102, y: 102 },
    });
    expect(helper.isDragging).toBe(false);

    // Release — should be treated as click, not drop
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointerup", {
      global: { x: 102, y: 102 },
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(helper.isDragging).toBe(false);
    expect(helper.draggingId).toBeNull();

    helper.destroy();
  });

  it("promotes to drag after exceeding threshold and calls onDrop", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDragMove = vi.fn();
    const onDrop = vi.fn(() => true);
    const helper = new DragHelper(stage, layer, { onDragMove, onDrop });

    const proxy = createProxy();
    helper.beginDrag("piece-2", proxy, 100, 100);

    // Move past threshold (> 6px)
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointermove", {
      global: { x: 120, y: 120 },
    });
    expect(helper.isDragging).toBe(true);
    expect(onDragMove).toHaveBeenCalledWith("piece-2", 120, 120);

    // Drop
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointerup", {
      global: { x: 150, y: 150 },
    });
    expect(onDrop).toHaveBeenCalledWith("piece-2", 150, 150);
    expect(helper.isDragging).toBe(false);

    helper.destroy();
  });

  it("calls onDragCancel when drop is rejected", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDrop = vi.fn(() => false);
    const onDragCancel = vi.fn();
    const helper = new DragHelper(stage, layer, { onDrop, onDragCancel });

    const proxy = createProxy();
    helper.beginDrag("piece-3", proxy, 50, 50);

    // Move past threshold
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointermove", {
      global: { x: 80, y: 80 },
    });

    // Drop rejected
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointerup", {
      global: { x: 80, y: 80 },
    });
    expect(onDrop).toHaveBeenCalled();
    expect(onDragCancel).toHaveBeenCalledWith("piece-3");

    helper.destroy();
  });

  it("cancel() cleans up active drag", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDragCancel = vi.fn();
    const helper = new DragHelper(stage, layer, { onDragCancel });

    const proxy = createProxy();
    helper.beginDrag("piece-4", proxy, 0, 0);

    // Move past threshold to promote
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointermove", {
      global: { x: 50, y: 50 },
    });
    expect(helper.isDragging).toBe(true);

    helper.cancel();
    expect(helper.isDragging).toBe(false);
    expect(helper.draggingId).toBeNull();
    expect(onDragCancel).toHaveBeenCalledWith("piece-4");

    helper.destroy();
  });

  it("cancel() on a pending (non-promoted) drag still calls onDragCancel", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDragCancel = vi.fn();
    const helper = new DragHelper(stage, layer, { onDragCancel });

    const proxy = createProxy();
    helper.beginDrag("piece-5", proxy, 100, 100);
    expect(helper.draggingId).toBe("piece-5");
    expect(helper.isDragging).toBe(false); // not promoted

    helper.cancel();
    expect(helper.draggingId).toBeNull();
    expect(onDragCancel).toHaveBeenCalledWith("piece-5");
    expect(proxy.destroy).toHaveBeenCalled();

    helper.destroy();
  });

  it("drag survives if not explicitly cancelled (simulates state change preserving drag)", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDragMove = vi.fn();
    const onDrop = vi.fn(() => true);
    const helper = new DragHelper(stage, layer, { onDragMove, onDrop });

    const proxy = createProxy();
    helper.beginDrag("piece-6", proxy, 100, 100);

    // Move past threshold — drag promoted
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointermove", {
      global: { x: 120, y: 120 },
    });
    expect(helper.isDragging).toBe(true);

    // Simulate continued movement (as if state change did NOT cancel)
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointermove", {
      global: { x: 130, y: 130 },
    });
    expect(helper.isDragging).toBe(true);
    expect(onDragMove).toHaveBeenCalledTimes(2);

    // Drop still works
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointerup", {
      global: { x: 130, y: 130 },
    });
    expect(onDrop).toHaveBeenCalledWith("piece-6", 130, 130);

    helper.destroy();
  });

  it("pointerup on non-promoted drag does not call onDragCancel", () => {
    const stage = createMockStage();
    const layer = createMockDragLayer();
    const onDragCancel = vi.fn();
    const helper = new DragHelper(stage, layer, { onDragCancel });

    const proxy = createProxy();
    helper.beginDrag("piece-7", proxy, 100, 100);

    // Release without exceeding threshold (click)
    (stage as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit("pointerup", {
      global: { x: 101, y: 101 },
    });
    expect(onDragCancel).not.toHaveBeenCalled();
    expect(helper.draggingId).toBeNull();

    helper.destroy();
  });
});

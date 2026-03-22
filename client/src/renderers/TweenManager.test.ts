import { describe, it, expect, vi } from "vitest";
import { TweenManager } from "./TweenManager";

function makeTarget(x = 0, y = 0) {
  return {
    position: { x, y, set(nx: number, ny: number) { this.x = nx; this.y = ny; } },
    alpha: 1,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("TweenManager", () => {
  it("moves target from A to B over duration", () => {
    const tm = new TweenManager();
    const target = makeTarget();

    tm.animate(target, { fromX: 0, fromY: 0, toX: 100, toY: 200, duration: 100 });
    expect(tm.activeCount).toBe(1);

    // Half-way (ease-out cubic at 0.5 ≈ 0.875)
    tm.tick(50);
    expect(target.position.x).toBeGreaterThan(50);
    expect(target.position.y).toBeGreaterThan(100);

    // Complete
    tm.tick(50);
    expect(target.position.x).toBe(100);
    expect(target.position.y).toBe(200);
    expect(tm.activeCount).toBe(0);
  });

  it("calls onComplete when animation finishes", () => {
    const tm = new TweenManager();
    const target = makeTarget();
    const onComplete = vi.fn();

    tm.animate(target, { fromX: 0, fromY: 0, toX: 10, toY: 10, duration: 50, onComplete });
    tm.tick(50);

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("cancels previous tween when re-animating same target", () => {
    const tm = new TweenManager();
    const target = makeTarget();

    tm.animate(target, { fromX: 0, fromY: 0, toX: 100, toY: 100, duration: 200 });
    tm.animate(target, { fromX: 50, fromY: 50, toX: 200, toY: 200, duration: 100 });

    expect(tm.activeCount).toBe(1);
    expect(target.position.x).toBe(50);
  });

  it("cancelAll clears every tween", () => {
    const tm = new TweenManager();
    const t1 = makeTarget();
    const t2 = makeTarget();

    tm.animate(t1, { fromX: 0, fromY: 0, toX: 100, toY: 100, duration: 100 });
    tm.animate(t2, { fromX: 0, fromY: 0, toX: 100, toY: 100, duration: 100 });
    expect(tm.activeCount).toBe(2);

    tm.cancelAll();
    expect(tm.activeCount).toBe(0);
  });

  it("animates alpha when specified", () => {
    const tm = new TweenManager();
    const target = makeTarget();

    tm.animate(target, { fromX: 0, fromY: 0, toX: 0, toY: 0, fromAlpha: 0, toAlpha: 1, duration: 100 });
    expect(target.alpha).toBe(0);

    tm.tick(100);
    expect(target.alpha).toBe(1);
  });

  it("tick returns false when no tweens are active", () => {
    const tm = new TweenManager();
    expect(tm.tick(16)).toBe(false);
  });

  it("tick returns true when tweens are running", () => {
    const tm = new TweenManager();
    const target = makeTarget();
    tm.animate(target, { fromX: 0, fromY: 0, toX: 10, toY: 10, duration: 100 });

    expect(tm.tick(16)).toBe(true);
  });

  it("handles overshoot (deltaMs exceeds duration)", () => {
    const tm = new TweenManager();
    const target = makeTarget();

    tm.animate(target, { fromX: 0, fromY: 0, toX: 100, toY: 200, duration: 50 });
    tm.tick(200);

    expect(target.position.x).toBe(100);
    expect(target.position.y).toBe(200);
    expect(tm.activeCount).toBe(0);
  });
});

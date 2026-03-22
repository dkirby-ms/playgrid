import type { Container } from "pixi.js";

/** Ease-out cubic: fast start, smooth deceleration */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type TweenTarget = Container;

type ActiveTween = {
  target: TweenTarget;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromAlpha: number;
  toAlpha: number;
  elapsed: number;
  duration: number;
  onComplete?: () => void;
};

const DEFAULT_DURATION_MS = 250;

/**
 * Lightweight, interruptible tween manager for PixiJS DisplayObjects.
 * Driven by the renderer's existing `update(deltaTime)` loop — no extra
 * ticker subscriptions required.
 *
 * Usage:
 *   tweens.animate(sprite, { fromX, fromY, toX, toY, duration });
 *   // in update():
 *   tweens.tick(deltaTime);
 */
export class TweenManager {
  private readonly tweens: ActiveTween[] = [];

  /** Number of active animations (useful for tests / debug) */
  get activeCount(): number {
    return this.tweens.length;
  }

  /**
   * Animate a DisplayObject from one position to another.
   * If the target already has an active tween, the old one is cancelled.
   */
  animate(
    target: TweenTarget,
    options: {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      fromAlpha?: number;
      toAlpha?: number;
      duration?: number;
      onComplete?: () => void;
    },
  ): void {
    this.cancel(target);

    const tween: ActiveTween = {
      target,
      fromX: options.fromX,
      fromY: options.fromY,
      toX: options.toX,
      toY: options.toY,
      fromAlpha: options.fromAlpha ?? 1,
      toAlpha: options.toAlpha ?? 1,
      elapsed: 0,
      duration: options.duration ?? DEFAULT_DURATION_MS,
      onComplete: options.onComplete,
    };

    target.position.set(tween.fromX, tween.fromY);
    target.alpha = tween.fromAlpha;
    this.tweens.push(tween);
  }

  /** Cancel any running tween on the given target. */
  cancel(target: TweenTarget): void {
    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      if (this.tweens[i].target === target) {
        this.tweens.splice(i, 1);
      }
    }
  }

  /** Cancel all active tweens, firing onComplete so animated objects are cleaned up. */
  cancelAll(): void {
    for (const tw of this.tweens) {
      tw.onComplete?.();
    }
    this.tweens.length = 0;
  }

  /**
   * Advance all tweens by `deltaMs` milliseconds.
   * Call this from the renderer's `update(deltaTime)` method.
   * Returns true if any tween was active (caller may want to skip redraws).
   */
  tick(deltaMs: number): boolean {
    if (this.tweens.length === 0) {
      return false;
    }

    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      const tw = this.tweens[i];
      tw.elapsed += deltaMs;
      const progress = tw.duration <= 0 ? 1 : Math.min(tw.elapsed / tw.duration, 1);
      const eased = easeOutCubic(progress);

      tw.target.position.set(
        tw.fromX + (tw.toX - tw.fromX) * eased,
        tw.fromY + (tw.toY - tw.fromY) * eased,
      );
      tw.target.alpha = tw.fromAlpha + (tw.toAlpha - tw.fromAlpha) * eased;

      if (progress >= 1) {
        tw.target.position.set(tw.toX, tw.toY);
        tw.target.alpha = tw.toAlpha;
        tw.onComplete?.();
        this.tweens.splice(i, 1);
      }
    }

    return true;
  }
}

import type { Container } from "pixi.js";

export interface RendererInputEvent {
  type: string;
  x?: number;
  y?: number;
  data?: unknown;
}

export interface GameRenderer {
  readonly gameType: string;
  readonly container: Container;
  init(state: unknown): void;
  onStateChange(state: unknown): void;
  update(deltaTime: number): void;
  resize(width: number, height: number): void;
  handleInput(event: RendererInputEvent): void;
  destroy(): void;
}

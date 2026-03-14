import type { Container } from "pixi.js";

export interface Scene {
  name: string;
  container: Container;
  onEnter(data?: unknown): Promise<void> | void;
  onExit(): Promise<void> | void;
  update(deltaTime: number): void;
  resize(width: number, height: number): void;
}

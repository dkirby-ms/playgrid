import type { Room } from "@colyseus/sdk";
import type { Container } from "pixi.js";

export interface RendererInputEvent {
  type: string;
  x?: number;
  y?: number;
  data?: unknown;
}

export interface GameRendererContext {
  room?: Room;
  requestLeave?: () => void;
}

export interface GameRendererHUDStatus {
  label?: string;
  text: string;
  detail?: string;
  accentColor?: string;
}

export interface GameRenderer {
  readonly gameType: string;
  readonly container: Container;
  init(state: unknown, context?: GameRendererContext): void;
  onStateChange(state: unknown): void;
  update(deltaTime: number): void;
  resize(width: number, height: number): void;
  handleInput(event: RendererInputEvent): void;
  getHUDStatus?(state: unknown): GameRendererHUDStatus | null;
  destroy(): void;
}

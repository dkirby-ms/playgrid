import { Container } from "pixi.js";
import { RendererRegistry, type GameRenderer } from "../renderers";
import type { Scene } from "./Scene";
import { SandboxStatePanel } from "../sandbox/SandboxStatePanel";
import {
  createMockCheckersState,
  createMockBackgammonState,
  createMockRiskState,
} from "../sandbox/mockStates";

export interface SandboxSceneEnterData {
  gameType: string;
}

export class SandboxScene implements Scene {
  readonly name = "sandbox";
  readonly container = new Container();

  private renderer: GameRenderer | null = null;
  private statePanel: SandboxStatePanel | null = null;
  private width = 0;
  private height = 0;
  private currentState: unknown = null;

  constructor(private readonly rendererRegistry: RendererRegistry) {}

  onEnter(data?: unknown): void {
    this.cleanup();

    const enterData = data as SandboxSceneEnterData | undefined;
    if (!enterData || !enterData.gameType) {
      console.error("SandboxScene requires gameType in enter data.");
      return;
    }

    const { gameType } = enterData;

    if (!this.rendererRegistry.has(gameType)) {
      console.error(`No renderer available for ${gameType}.`);
      return;
    }

    this.currentState = this.createMockState(gameType);
    this.renderer = this.rendererRegistry.create(gameType);
    this.renderer.init(this.currentState, {
      room: undefined,
      requestLeave: () => {
        console.log("Leave requested from sandbox renderer.");
      },
    });
    this.container.addChild(this.renderer.container);

    this.statePanel = new SandboxStatePanel(gameType, this.currentState);
    this.statePanel.onStateChange((newState) => {
      this.currentState = newState;
      this.renderer?.onStateChange(newState);
    });
    this.statePanel.mount(document.body);

    if (this.width > 0 && this.height > 0) {
      this.renderer.resize(this.width, this.height);
    }
  }

  onExit(): void {
    this.cleanup();
  }

  update(deltaTime: number): void {
    this.renderer?.update(deltaTime);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer?.resize(width, height);
  }

  private cleanup(): void {
    this.statePanel?.destroy();
    this.statePanel = null;

    if (!this.renderer) {
      return;
    }

    if (this.renderer.container.parent === this.container) {
      this.container.removeChild(this.renderer.container);
    }

    this.renderer.destroy();
    this.renderer = null;
    this.currentState = null;
  }

  private createMockState(gameType: string): unknown {
    switch (gameType) {
      case "checkers":
        return createMockCheckersState();
      case "backgammon":
        return createMockBackgammonState();
      case "risk":
        return createMockRiskState();
      default:
        return {};
    }
  }
}

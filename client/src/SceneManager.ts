import type { Container } from "pixi.js";
import type { Scene } from "./scenes/Scene";

export class SceneManager {
  private readonly scenes = new Map<string, Scene>();
  private activeScene: Scene | null = null;

  constructor(private readonly stage: Container) {}

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  async transitionTo(name: string, data?: unknown): Promise<void> {
    const nextScene = this.scenes.get(name);
    if (!nextScene) {
      throw new Error(`Scene "${name}" is not registered.`);
    }

    if (this.activeScene) {
      await this.activeScene.onExit();
      this.stage.removeChild(this.activeScene.container);
    }

    this.activeScene = nextScene;
    this.stage.addChild(nextScene.container);
    await nextScene.onEnter(data);
  }

  update(deltaTime: number): void {
    this.activeScene?.update(deltaTime);
  }

  resize(width: number, height: number): void {
    this.activeScene?.resize(width, height);
  }
}

export type { Scene } from "./scenes/Scene";

import type { GameRenderer } from "./GameRenderer";

export type GameRendererFactory = () => GameRenderer;

export class RendererRegistry {
  private readonly factories = new Map<string, GameRendererFactory>();

  register(gameType: string, factory: GameRendererFactory): void {
    this.factories.set(gameType, factory);
  }

  create(gameType: string): GameRenderer {
    const factory = this.factories.get(gameType);
    if (!factory) {
      throw new Error(`No renderer registered for game type "${gameType}".`);
    }

    return factory();
  }

  has(gameType: string): boolean {
    return this.factories.has(gameType);
  }
}

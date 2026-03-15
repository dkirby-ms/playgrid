import type { Schema } from "@colyseus/schema";
import type { GamePlugin } from "@eschaton/shared";

export class GameRegistry {
  static readonly instance = new GameRegistry();

  private readonly plugins = new Map<string, GamePlugin>();

  private constructor() {}

  register<TState extends Schema>(plugin: GamePlugin<TState>) {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Game plugin "${plugin.id}" is already registered.`);
    }

    this.plugins.set(plugin.id, plugin as unknown as GamePlugin);
  }

  get(gameType: string): GamePlugin {
    const plugin = this.plugins.get(gameType);
    if (!plugin) {
      throw new Error(`Game plugin "${gameType}" is not registered.`);
    }

    return plugin;
  }

  getAll(): GamePlugin[] {
    return Array.from(this.plugins.values());
  }

  has(gameType: string): boolean {
    return this.plugins.has(gameType);
  }
}

export const gameRegistry = GameRegistry.instance;

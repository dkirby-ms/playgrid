import { describe, expect, it, vi, beforeEach } from "vitest";

import { parseDisabledGames } from "../config.js";

describe("parseDisabledGames", () => {
  it("returns empty set when env value is undefined", () => {
    const result = parseDisabledGames(undefined);
    expect(result.size).toBe(0);
  });

  it("returns empty set when env value is empty string", () => {
    const result = parseDisabledGames("");
    expect(result.size).toBe(0);
  });

  it("parses a single game id", () => {
    const result = parseDisabledGames("risk");
    expect(result).toEqual(new Set(["risk"]));
  });

  it("parses multiple comma-separated game ids", () => {
    const result = parseDisabledGames("risk,dominos");
    expect(result).toEqual(new Set(["risk", "dominos"]));
  });

  it("trims whitespace around entries", () => {
    const result = parseDisabledGames("  risk , dominos  , backgammon ");
    expect(result).toEqual(new Set(["risk", "dominos", "backgammon"]));
  });

  it("drops empty entries from leading/trailing commas", () => {
    const result = parseDisabledGames(",risk,,dominos,");
    expect(result).toEqual(new Set(["risk", "dominos"]));
  });

  it("drops whitespace-only entries", () => {
    const result = parseDisabledGames("risk, , ,dominos");
    expect(result).toEqual(new Set(["risk", "dominos"]));
  });

  it("handles purely whitespace input", () => {
    const result = parseDisabledGames("   ");
    expect(result.size).toBe(0);
  });

  it("handles commas-only input", () => {
    const result = parseDisabledGames(",,,");
    expect(result.size).toBe(0);
  });

  it("deduplicates repeated game ids", () => {
    const result = parseDisabledGames("risk,risk,risk");
    expect(result).toEqual(new Set(["risk"]));
    expect(result.size).toBe(1);
  });

  it("preserves case of game ids", () => {
    const result = parseDisabledGames("Risk,DOMINOS");
    expect(result.has("Risk")).toBe(true);
    expect(result.has("DOMINOS")).toBe(true);
    expect(result.has("risk")).toBe(false);
  });
});

describe("GameRegistry filtering with DISABLED_GAMES", () => {
  let GameRegistry: typeof import("../game/GameRegistry.js")["GameRegistry"];

  beforeEach(async () => {
    const mod = await import("../game/GameRegistry.js");
    GameRegistry = mod.GameRegistry;
  });

  function makeStubPlugin(id: string) {
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      metadata: {
        playerCount: [2, 4] as [number, number],
        estimatedDuration: 30,
        complexity: 2,
        description: `A ${id} game`,
        hasHiddenInformation: false,
      },
      createState: () => ({}) as never,
      lifecycle: { onGameStart: () => {} },
      turnConfig: { mode: "sequential" as const, turnOrder: { type: "round-robin" as const }, allowPass: false },
      actions: {},
      conditions: {
        checkGameEnd: () => null,
        validateAction: () => true,
      },
    };
  }

  const ALL_IDS = ["checkers", "backgammon", "risk", "dominos"];

  function buildRegistry(disabledSet: Set<string>) {
    // Private constructor — bypass via Object.create for isolated test instances
    const registry = Object.create(GameRegistry.prototype) as InstanceType<typeof GameRegistry>;
    (registry as any).plugins = new Map();
    for (const id of ALL_IDS) {
      if (!disabledSet.has(id)) {
        registry.register(makeStubPlugin(id));
      }
    }
    return registry;
  }

  it("registers all games when disabled set is empty", () => {
    const registry = buildRegistry(new Set());
    expect(registry.getAll()).toHaveLength(4);
    for (const id of ALL_IDS) {
      expect(registry.has(id)).toBe(true);
    }
  });

  it("excludes a single disabled game", () => {
    const registry = buildRegistry(new Set(["risk"]));

    expect(registry.has("risk")).toBe(false);
    expect(registry.has("checkers")).toBe(true);
    expect(registry.has("backgammon")).toBe(true);
    expect(registry.has("dominos")).toBe(true);
    expect(registry.getAll()).toHaveLength(3);
    expect(registry.getAll().map(p => p.id)).not.toContain("risk");
  });

  it("excludes multiple disabled games", () => {
    const registry = buildRegistry(new Set(["risk", "dominos"]));

    expect(registry.has("risk")).toBe(false);
    expect(registry.has("dominos")).toBe(false);
    expect(registry.has("checkers")).toBe(true);
    expect(registry.has("backgammon")).toBe(true);
    expect(registry.getAll()).toHaveLength(2);
  });

  it("get() throws for a disabled game", () => {
    const registry = buildRegistry(new Set(["risk"]));

    expect(() => registry.get("risk")).toThrow(/not registered/);
  });

  it("get() succeeds for an enabled game", () => {
    const registry = buildRegistry(new Set(["risk"]));

    const plugin = registry.get("checkers");
    expect(plugin.id).toBe("checkers");
  });

  it("getAll() returns only non-disabled games", () => {
    const registry = buildRegistry(new Set(["backgammon", "dominos"]));

    const ids = registry.getAll().map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(["checkers", "risk"]));
    expect(ids).not.toContain("backgammon");
    expect(ids).not.toContain("dominos");
  });

  it("handles all games disabled", () => {
    const registry = buildRegistry(new Set(ALL_IDS));

    expect(registry.getAll()).toHaveLength(0);
    for (const id of ALL_IDS) {
      expect(registry.has(id)).toBe(false);
    }
  });

  it("handles gracefully when disabled set contains unknown game ids", () => {
    const registry = buildRegistry(new Set(["nonexistent", "risk"]));

    expect(registry.has("risk")).toBe(false);
    expect(registry.has("checkers")).toBe(true);
    expect(registry.getAll()).toHaveLength(3);
  });

  it("end-to-end: parseDisabledGames feeds the filtering loop", () => {
    const disabled = parseDisabledGames("risk, dominos");
    const registry = buildRegistry(disabled);

    expect(registry.has("risk")).toBe(false);
    expect(registry.has("dominos")).toBe(false);
    expect(registry.has("checkers")).toBe(true);
    expect(registry.has("backgammon")).toBe(true);
  });

  it("end-to-end: whitespace-laden env value still filters correctly", () => {
    const disabled = parseDisabledGames("  risk , , backgammon  ");
    const registry = buildRegistry(disabled);

    expect(registry.has("risk")).toBe(false);
    expect(registry.has("backgammon")).toBe(false);
    expect(registry.has("checkers")).toBe(true);
    expect(registry.has("dominos")).toBe(true);
  });
});

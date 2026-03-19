import { describe, it, expect } from "vitest";
import type { MoveEntry } from "@eschaton/shared";
import { getFormatter } from "../historyFormatters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMoveEntry(
  overrides: Partial<MoveEntry> & { actionType: string; payload: Record<string, unknown> },
): MoveEntry {
  return {
    turnNumber: 1,
    playerId: "player-1",
    playerName: "Alice",
    timestamp: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

describe("getFormatter — registry", () => {
  it("returns the checkers formatter for 'checkers'", () => {
    const fmt = getFormatter("checkers");
    const defaultFmt = getFormatter("__no_such_game__");
    expect(fmt).not.toBe(defaultFmt);
  });

  it("returns the backgammon formatter for 'backgammon'", () => {
    const fmt = getFormatter("backgammon");
    const defaultFmt = getFormatter("__no_such_game__");
    expect(fmt).not.toBe(defaultFmt);
  });

  it("returns the dominos formatter for 'dominos'", () => {
    const fmt = getFormatter("dominos");
    const defaultFmt = getFormatter("__no_such_game__");
    expect(fmt).not.toBe(defaultFmt);
  });

  it("returns the risk formatter for 'risk'", () => {
    const fmt = getFormatter("risk");
    const defaultFmt = getFormatter("__no_such_game__");
    expect(fmt).not.toBe(defaultFmt);
  });

  it("returns the default formatter for an unknown game type", () => {
    const fmt = getFormatter("unknown");
    const entry = makeMoveEntry({ actionType: "foo", payload: {} });
    expect(fmt.getMoveIcon(entry)).toBe("🔹");
  });

  it("returns a formatter with formatMove and getMoveIcon for every registered game", () => {
    for (const gameType of ["checkers", "backgammon", "dominos", "risk"]) {
      const fmt = getFormatter(gameType);
      expect(typeof fmt.formatMove).toBe("function");
      expect(typeof fmt.getMoveIcon).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// Default formatter
// ---------------------------------------------------------------------------

describe("defaultFormatter", () => {
  const fmt = getFormatter("__fallback__");

  it("uses entry.description when available", () => {
    const entry = makeMoveEntry({
      actionType: "attack",
      payload: {},
      description: "Attacked Kamchatka from Alaska",
    });
    expect(fmt.formatMove(entry)).toBe("Attacked Kamchatka from Alaska");
  });

  it('falls back to "Move: {actionType}" when no description', () => {
    const entry = makeMoveEntry({ actionType: "reinforce", payload: {} });
    expect(fmt.formatMove(entry)).toBe("Move: reinforce");
  });

  it('icon is always "🔹"', () => {
    const entry = makeMoveEntry({ actionType: "anything", payload: {} });
    expect(fmt.getMoveIcon(entry)).toBe("🔹");
  });
});

// ---------------------------------------------------------------------------
// Checkers formatter
// ---------------------------------------------------------------------------

describe("checkersFormatter", () => {
  const fmt = getFormatter("checkers");

  describe("formatMove", () => {
    it("formats a regular move with board notation", () => {
      // index 0 → A1, index 9 → B2
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 0, to: 9 },
      });
      expect(fmt.formatMove(entry)).toBe("➡️ A1 → B2");
    });

    it("formats a capture move with (capture) text", () => {
      const entry = makeMoveEntry({
        actionType: "capture",
        payload: { from: 0, to: 18, captured: 9 },
      });
      expect(fmt.formatMove(entry)).toBe("⚔️ A1 → C3 (capture)");
    });

    it("detects capture via payload.captured even when actionType is 'move'", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 9, to: 27, captured: 18 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("(capture)");
      expect(result).toContain("⚔️");
    });

    it("formats a king move with crown emoji", () => {
      const entry = makeMoveEntry({
        actionType: "king",
        payload: { from: 48, to: 57 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("👑");
      expect(result).toContain("Kinged");
    });

    it("detects kinged via payload.kinged flag", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 48, to: 57, kinged: true },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("👑");
      expect(result).toContain("Kinged");
    });

    it("handles non-numeric from/to gracefully", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: "bar", to: "home" },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("bar");
      expect(result).toContain("home");
    });

    it("handles missing from/to with fallback '?'", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toContain("?");
    });

    it("falls back for unrecognized actionType with description", () => {
      const entry = makeMoveEntry({
        actionType: "special",
        payload: {},
        description: "Something custom",
      });
      expect(fmt.formatMove(entry)).toBe("Something custom");
    });

    it("falls back to generic text when unrecognized actionType has no description", () => {
      const entry = makeMoveEntry({ actionType: "special", payload: {} });
      expect(fmt.formatMove(entry)).toBe("Move special");
    });

    it("handles board edge indices (0 and 63)", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 0, to: 63 },
      });
      expect(fmt.formatMove(entry)).toBe("➡️ A1 → H8");
    });

    it("handles out-of-range index gracefully", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: -1, to: 100 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("-1");
      expect(result).toContain("100");
    });
  });

  describe("getMoveIcon", () => {
    it('returns "👑" for a king move', () => {
      const entry = makeMoveEntry({ actionType: "king", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("👑");
    });

    it('returns "👑" when payload.kinged is true', () => {
      const entry = makeMoveEntry({ actionType: "move", payload: { kinged: true } });
      expect(fmt.getMoveIcon(entry)).toBe("👑");
    });

    it('returns "⚔️" for a capture', () => {
      const entry = makeMoveEntry({ actionType: "capture", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("⚔️");
    });

    it('returns "⚔️" when payload.captured is present', () => {
      const entry = makeMoveEntry({ actionType: "move", payload: { captured: 5 } });
      expect(fmt.getMoveIcon(entry)).toBe("⚔️");
    });

    it('returns "➡️" for a regular move', () => {
      const entry = makeMoveEntry({ actionType: "move", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("➡️");
    });
  });
});

// ---------------------------------------------------------------------------
// Backgammon formatter
// ---------------------------------------------------------------------------

describe("backgammonFormatter", () => {
  const fmt = getFormatter("backgammon");

  describe("formatMove", () => {
    it("formats a dice roll with description", () => {
      const entry = makeMoveEntry({
        actionType: "roll",
        payload: { dice: [3, 5] },
        description: "🎲 Rolled 3 and 5",
      });
      expect(fmt.formatMove(entry)).toBe("🎲 Rolled 3 and 5");
    });

    it("formats a dice roll without description", () => {
      const entry = makeMoveEntry({
        actionType: "roll",
        payload: { dice: [4, 2] },
      });
      expect(fmt.formatMove(entry)).toBe("🎲 Rolled dice");
    });

    it("formats a regular point-to-point move", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 5, to: 2, die: 3 },
      });
      expect(fmt.formatMove(entry)).toBe("🔘 Point 6 → Point 3 (🎲 3)");
    });

    it("formats a point-to-point move without die value", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 11, to: 6 },
      });
      expect(fmt.formatMove(entry)).toBe("🔘 Point 12 → Point 7");
    });

    it("formats a move from the bar", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: "bar", to: 22, die: 3 },
      });
      expect(fmt.formatMove(entry)).toBe("↩️ Bar → Point 23 (🎲 3)");
    });

    it("formats a bear-off move", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 2, to: "off", die: 3 },
      });
      expect(fmt.formatMove(entry)).toBe("🏁 Point 3 → Off (🎲 3)");
    });

    it("formats a pass action", () => {
      const entry = makeMoveEntry({
        actionType: "pass",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("⏭️ No valid moves — passed");
    });

    it("falls back for unrecognized actionType with description", () => {
      const entry = makeMoveEntry({
        actionType: "double",
        payload: {},
        description: "Offered doubling cube",
      });
      expect(fmt.formatMove(entry)).toBe("Offered doubling cube");
    });

    it("falls back for unrecognized actionType without description", () => {
      const entry = makeMoveEntry({
        actionType: "double",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("Move double");
    });

    it("handles missing from/to gracefully", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toContain("?");
    });
  });

  describe("getMoveIcon", () => {
    it('returns "🎲" for a roll', () => {
      const entry = makeMoveEntry({ actionType: "roll", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🎲");
    });

    it('returns "⏭️" for a pass', () => {
      const entry = makeMoveEntry({ actionType: "pass", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("⏭️");
    });

    it('returns "🏁" for a bear-off move', () => {
      const entry = makeMoveEntry({ actionType: "move", payload: { to: "off" } });
      expect(fmt.getMoveIcon(entry)).toBe("🏁");
    });

    it('returns "↩️" for a bar entry move', () => {
      const entry = makeMoveEntry({ actionType: "move", payload: { from: "bar", to: 3 } });
      expect(fmt.getMoveIcon(entry)).toBe("↩️");
    });

    it('returns "🔘" for a regular move', () => {
      const entry = makeMoveEntry({ actionType: "move", payload: { from: 5, to: 2 } });
      expect(fmt.getMoveIcon(entry)).toBe("🔘");
    });
  });
});

// ---------------------------------------------------------------------------
// Dominos formatter
// ---------------------------------------------------------------------------

describe("dominosFormatter", () => {
  const fmt = getFormatter("dominos");

  describe("formatMove", () => {
    it("formats a play with pips array", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: { pips: [3, 5] },
      });
      expect(fmt.formatMove(entry)).toBe("🁢 [3|5] played");
    });

    it("formats a play with a/b fields", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: { a: 6, b: 6 },
      });
      expect(fmt.formatMove(entry)).toBe("🁢 [6|6] played");
    });

    it("formats a play with tileA/tileB fields", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: { tileA: 0, tileB: 4 },
      });
      expect(fmt.formatMove(entry)).toBe("🁢 [0|4] played");
    });

    it("prefers pips array over a/b fields", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: { pips: [1, 2], a: 3, b: 4 },
      });
      expect(fmt.formatMove(entry)).toBe("🁢 [1|2] played");
    });

    it("falls back when no pip info is available but description exists", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: {},
        description: "Played a tile",
      });
      expect(fmt.formatMove(entry)).toBe("Played a tile");
    });

    it("falls back to default text when no pips and no description", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("🁢 Played tile");
    });

    it("formats a draw action", () => {
      const entry = makeMoveEntry({
        actionType: "draw",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("📥 Drew from boneyard");
    });

    it("formats a pass action", () => {
      const entry = makeMoveEntry({
        actionType: "pass",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("⏭️ Pass");
    });

    it("falls back for unrecognized actionType with description", () => {
      const entry = makeMoveEntry({
        actionType: "challenge",
        payload: {},
        description: "Challenged the count",
      });
      expect(fmt.formatMove(entry)).toBe("Challenged the count");
    });

    it("falls back for unrecognized actionType without description", () => {
      const entry = makeMoveEntry({
        actionType: "challenge",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("Move challenge");
    });
  });

  describe("getMoveIcon", () => {
    it('returns "🁢" for a play', () => {
      const entry = makeMoveEntry({ actionType: "play", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🁢");
    });

    it('returns "📥" for a draw', () => {
      const entry = makeMoveEntry({ actionType: "draw", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("📥");
    });

    it('returns "⏭️" for a pass', () => {
      const entry = makeMoveEntry({ actionType: "pass", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("⏭️");
    });

    it('returns "🔹" for an unknown action', () => {
      const entry = makeMoveEntry({ actionType: "unknown", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🔹");
    });
  });
});

// ---------------------------------------------------------------------------
// Risk formatter
// ---------------------------------------------------------------------------

describe("riskFormatter", () => {
  const fmt = getFormatter("risk");

  describe("formatMove", () => {
    it("formats pickTerritory with resolved territory name", () => {
      const entry = makeMoveEntry({
        actionType: "pickTerritory",
        payload: { territoryId: "alaska" },
      });
      expect(fmt.formatMove(entry)).toBe("📍 Claimed Alaska");
    });

    it("formats pickTerritory with unknown territory ID (falls back to raw ID)", () => {
      const entry = makeMoveEntry({
        actionType: "pickTerritory",
        payload: { territoryId: "atlantis" },
      });
      expect(fmt.formatMove(entry)).toBe("📍 Claimed atlantis");
    });

    it("formats placeArmy with count", () => {
      const entry = makeMoveEntry({
        actionType: "placeArmy",
        payload: { territoryId: "brazil", count: 3 },
      });
      expect(fmt.formatMove(entry)).toBe("🛡️ Reinforced Brazil (+3)");
    });

    it("formats placeArmy defaults count to 1 when missing", () => {
      const entry = makeMoveEntry({
        actionType: "placeArmy",
        payload: { territoryId: "brazil" },
      });
      expect(fmt.formatMove(entry)).toBe("🛡️ Reinforced Brazil (+1)");
    });

    it("formats attack with territories and dice count", () => {
      const entry = makeMoveEntry({
        actionType: "attack",
        payload: { from: "alaska", to: "kamchatka", attackerDice: 3 },
      });
      expect(fmt.formatMove(entry)).toBe("⚔️ Attacked Kamchatka from Alaska (×3 dice)");
    });

    it("formats attack with missing dice count", () => {
      const entry = makeMoveEntry({
        actionType: "attack",
        payload: { from: "alaska", to: "kamchatka" },
      });
      expect(fmt.formatMove(entry)).toBe("⚔️ Attacked Kamchatka from Alaska (×? dice)");
    });

    it("formats captureMove with army count", () => {
      const entry = makeMoveEntry({
        actionType: "captureMove",
        payload: { count: 4 },
      });
      expect(fmt.formatMove(entry)).toBe("🚩 Moved 4 armies into captured territory");
    });

    it("formats captureMove with missing count", () => {
      const entry = makeMoveEntry({
        actionType: "captureMove",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("🚩 Moved ? armies into captured territory");
    });

    it("formats fortify with source, destination, and count", () => {
      const entry = makeMoveEntry({
        actionType: "fortify",
        payload: { from: "brazil", to: "argentina", count: 5 },
      });
      expect(fmt.formatMove(entry)).toBe("🏰 Fortified 5 armies: Brazil → Argentina");
    });

    it("formats fortify with missing count", () => {
      const entry = makeMoveEntry({
        actionType: "fortify",
        payload: { from: "brazil", to: "argentina" },
      });
      expect(fmt.formatMove(entry)).toBe("🏰 Fortified ? armies: Brazil → Argentina");
    });

    it("formats tradeCards with card count", () => {
      const entry = makeMoveEntry({
        actionType: "tradeCards",
        payload: { cardCount: 5 },
      });
      expect(fmt.formatMove(entry)).toBe("🃏 Traded 5 cards for reinforcements");
    });

    it("formats tradeCards defaults count to 3 when missing", () => {
      const entry = makeMoveEntry({
        actionType: "tradeCards",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("🃏 Traded 3 cards for reinforcements");
    });

    it("formats endPhase", () => {
      const entry = makeMoveEntry({
        actionType: "endPhase",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("⏭️ Ended phase");
    });

    it("falls back for unrecognized actionType with description", () => {
      const entry = makeMoveEntry({
        actionType: "negotiate",
        payload: {},
        description: "Proposed alliance",
      });
      expect(fmt.formatMove(entry)).toBe("Proposed alliance");
    });

    it("falls back for unrecognized actionType without description", () => {
      const entry = makeMoveEntry({
        actionType: "negotiate",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("Move negotiate");
    });

    it("handles missing territoryId in pickTerritory", () => {
      const entry = makeMoveEntry({
        actionType: "pickTerritory",
        payload: {},
      });
      expect(fmt.formatMove(entry)).toBe("📍 Claimed ?");
    });

    it("handles non-string territory IDs in attack", () => {
      const entry = makeMoveEntry({
        actionType: "attack",
        payload: { from: 42, to: null, attackerDice: 2 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("⚔️");
      expect(result).toContain("42");
      expect(result).toContain("?");
    });
  });

  describe("getMoveIcon", () => {
    it('returns "📍" for pickTerritory', () => {
      const entry = makeMoveEntry({ actionType: "pickTerritory", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("📍");
    });

    it('returns "🛡️" for placeArmy', () => {
      const entry = makeMoveEntry({ actionType: "placeArmy", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🛡️");
    });

    it('returns "⚔️" for attack', () => {
      const entry = makeMoveEntry({ actionType: "attack", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("⚔️");
    });

    it('returns "🚩" for captureMove', () => {
      const entry = makeMoveEntry({ actionType: "captureMove", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🚩");
    });

    it('returns "🏰" for fortify', () => {
      const entry = makeMoveEntry({ actionType: "fortify", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🏰");
    });

    it('returns "🃏" for tradeCards', () => {
      const entry = makeMoveEntry({ actionType: "tradeCards", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🃏");
    });

    it('returns "⏭️" for endPhase', () => {
      const entry = makeMoveEntry({ actionType: "endPhase", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("⏭️");
    });

    it('returns "🔹" for unknown action', () => {
      const entry = makeMoveEntry({ actionType: "unknown", payload: {} });
      expect(fmt.getMoveIcon(entry)).toBe("🔹");
    });
  });
});

// ---------------------------------------------------------------------------
// MoveEntry structure — verifies formatters handle partial/missing fields
// ---------------------------------------------------------------------------

describe("MoveEntry structure handling", () => {
  it("all formatters accept minimal required fields", () => {
    for (const gameType of ["checkers", "backgammon", "dominos", "risk", "__unknown__"]) {
      const fmt = getFormatter(gameType);
      const entry = makeMoveEntry({ actionType: "move", payload: {} });
      expect(typeof fmt.formatMove(entry)).toBe("string");
      expect(typeof fmt.getMoveIcon(entry)).toBe("string");
    }
  });

  it("formatters handle empty payload without throwing", () => {
    const actionTypes: Record<string, string[]> = {
      checkers: ["move", "capture", "king"],
      backgammon: ["roll", "move", "pass"],
      dominos: ["play", "draw", "pass"],
      risk: ["pickTerritory", "placeArmy", "attack", "captureMove", "fortify", "tradeCards", "endPhase"],
    };
    for (const gameType of Object.keys(actionTypes)) {
      const fmt = getFormatter(gameType);
      for (const actionType of actionTypes[gameType]) {
        const entry = makeMoveEntry({ actionType, payload: {} });
        expect(() => fmt.formatMove(entry)).not.toThrow();
        expect(() => fmt.getMoveIcon(entry)).not.toThrow();
      }
    }
  });

  it("all formatters return non-empty strings", () => {
    for (const gameType of ["checkers", "backgammon", "dominos", "risk", "__unknown__"]) {
      const fmt = getFormatter(gameType);
      const entry = makeMoveEntry({ actionType: "move", payload: {} });
      expect(fmt.formatMove(entry).length).toBeGreaterThan(0);
      expect(fmt.getMoveIcon(entry).length).toBeGreaterThan(0);
    }
  });
});

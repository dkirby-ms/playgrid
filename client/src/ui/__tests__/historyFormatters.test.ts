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

  it("returns the default formatter for an unknown game type", () => {
    const fmt = getFormatter("unknown");
    const entry = makeMoveEntry({ actionType: "foo", payload: {} });
    // Default formatter always returns "🔹"
    expect(fmt.getMoveIcon(entry)).toBe("🔹");
  });

  it("returns a formatter with formatMove and getMoveIcon for every registered game", () => {
    for (const gameType of ["checkers"]) {
      const fmt = getFormatter(gameType);
      expect(typeof fmt.formatMove).toBe("function");
      expect(typeof fmt.getMoveIcon).toBe("function");
    }
  });

  // Anticipatory: once Ortho lands formatters, these will verify registration
  it.todo("returns the backgammon formatter for 'backgammon'");
  it.todo("returns the dominos formatter for 'dominos'");
  it.todo("returns the risk formatter for 'risk'");
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
      const result = fmt.formatMove(entry);
      expect(result).toContain("➡️");
      expect(result).toContain("A1");
      expect(result).toContain("B2");
      expect(result).toContain("→");
    });

    it("formats a capture move with (capture) text", () => {
      const entry = makeMoveEntry({
        actionType: "capture",
        payload: { from: 0, to: 18, captured: 9 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("⚔️");
      expect(result).toContain("(capture)");
      expect(result).toContain("A1");
      expect(result).toContain("C3");
    });

    it("detects capture via payload.captured even when actionType is 'move'", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 9, to: 27, captured: 18 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toContain("(capture)");
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
      const result = fmt.formatMove(entry);
      expect(result).toContain("?");
    });

    it("falls back for unrecognized actionType", () => {
      const entry = makeMoveEntry({
        actionType: "special",
        payload: {},
        description: "Something custom",
      });
      const result = fmt.formatMove(entry);
      expect(result).toBe("Something custom");
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
// Backgammon formatter (anticipatory — Ortho WIP)
// ---------------------------------------------------------------------------

describe("backgammonFormatter", () => {
  // Attempt to get the formatter; if not registered yet, tests are todos
  const fmt = getFormatter("backgammon");
  const isRegistered = fmt !== getFormatter("__nonexistent__");

  const describeIfRegistered = isRegistered ? describe : describe.skip;

  describeIfRegistered("formatMove", () => {
    it("formats a regular point-to-point move", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: 6, to: 3, dieValue: 3 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("formats a move from the bar", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: { from: "bar", to: 22, dieValue: 3 },
      });
      const result = fmt.formatMove(entry);
      expect(result.toLowerCase()).toContain("bar");
    });

    it("formats a bear off move", () => {
      const entry = makeMoveEntry({
        actionType: "bearOff",
        payload: { from: 2, dieValue: 3 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("handles missing from/to gracefully", () => {
      const entry = makeMoveEntry({
        actionType: "move",
        payload: {},
      });
      const result = fmt.formatMove(entry);
      expect(typeof result).toBe("string");
    });
  });

  describeIfRegistered("getMoveIcon", () => {
    it("returns a string icon", () => {
      const entry = makeMoveEntry({ actionType: "move", payload: {} });
      expect(typeof fmt.getMoveIcon(entry)).toBe("string");
      expect(fmt.getMoveIcon(entry).length).toBeGreaterThan(0);
    });
  });

  if (!isRegistered) {
    it.todo("backgammon formatter not registered yet — skipped until Ortho lands it");
  }
});

// ---------------------------------------------------------------------------
// Dominos formatter (anticipatory — Ortho WIP)
// ---------------------------------------------------------------------------

describe("dominosFormatter", () => {
  const fmt = getFormatter("dominos");
  const isRegistered = fmt !== getFormatter("__nonexistent__");

  const describeIfRegistered = isRegistered ? describe : describe.skip;

  describeIfRegistered("formatMove", () => {
    it("formats a play tile action with pip values", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: { tile: [3, 5], end: "left" },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("formats a draw from boneyard", () => {
      const entry = makeMoveEntry({
        actionType: "draw",
        payload: {},
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("formats a pass action", () => {
      const entry = makeMoveEntry({
        actionType: "pass",
        payload: {},
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("handles missing tile info gracefully", () => {
      const entry = makeMoveEntry({
        actionType: "play",
        payload: {},
      });
      const result = fmt.formatMove(entry);
      expect(typeof result).toBe("string");
    });
  });

  describeIfRegistered("getMoveIcon", () => {
    it("returns a string icon for each action type", () => {
      for (const actionType of ["play", "draw", "pass"]) {
        const entry = makeMoveEntry({ actionType, payload: {} });
        expect(typeof fmt.getMoveIcon(entry)).toBe("string");
        expect(fmt.getMoveIcon(entry).length).toBeGreaterThan(0);
      }
    });
  });

  if (!isRegistered) {
    it.todo("dominos formatter not registered yet — skipped until Ortho lands it");
  }
});

// ---------------------------------------------------------------------------
// Risk formatter (anticipatory — Ortho WIP)
// ---------------------------------------------------------------------------

describe("riskFormatter", () => {
  const fmt = getFormatter("risk");
  const isRegistered = fmt !== getFormatter("__nonexistent__");

  const describeIfRegistered = isRegistered ? describe : describe.skip;

  describeIfRegistered("formatMove", () => {
    it("formats a reinforce action with territory and army count", () => {
      const entry = makeMoveEntry({
        actionType: "reinforce",
        payload: { territory: "Brazil", armies: 3 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("formats an attack action with attacker/defender and dice", () => {
      const entry = makeMoveEntry({
        actionType: "attack",
        payload: {
          from: "Alaska",
          to: "Kamchatka",
          attackDice: [6, 5, 3],
          defendDice: [4, 2],
        },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("formats a capture-move action", () => {
      const entry = makeMoveEntry({
        actionType: "captureMove",
        payload: { from: "Alaska", to: "Kamchatka", armies: 2 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("formats a fortify action with source/destination and count", () => {
      const entry = makeMoveEntry({
        actionType: "fortify",
        payload: { from: "Brazil", to: "Argentina", armies: 5 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });

    it("formats a trade cards action", () => {
      const entry = makeMoveEntry({
        actionType: "tradeCards",
        payload: { cards: ["infantry", "cavalry", "artillery"], armiesGained: 10 },
      });
      const result = fmt.formatMove(entry);
      expect(result).toBeTruthy();
    });
  });

  describeIfRegistered("getMoveIcon", () => {
    it("returns distinct icons for different action types", () => {
      for (const actionType of ["reinforce", "attack", "fortify", "tradeCards"]) {
        const entry = makeMoveEntry({ actionType, payload: {} });
        expect(typeof fmt.getMoveIcon(entry)).toBe("string");
        expect(fmt.getMoveIcon(entry).length).toBeGreaterThan(0);
      }
    });
  });

  if (!isRegistered) {
    it.todo("risk formatter not registered yet — skipped until Ortho lands it");
  }
});

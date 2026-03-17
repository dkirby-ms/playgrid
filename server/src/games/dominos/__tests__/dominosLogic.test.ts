import { describe, expect, it } from "vitest";

import {
  BoardTile,
  DominoTile,
  DominosPlayerState,
  DominosState,
  PlayerInfo,
} from "@eschaton/shared";

import {
  canPlayTile,
  determineStartingPlayer,
  generateTileSet,
  getActivePlayers,
  getNextPlayer,
  getValidEnds,
  handPipTotal,
  hasPlayableTile,
  isDouble,
  isRoundBlocked,
  pipTotal,
  placeTileOnBoard,
  removeTileFromHand,
  resolveBlockedRound,
  resolvePlay,
  scoreDomino,
  shuffle,
  tileMatchesEnd,
  tilesPerPlayer,
  toRawTile,
  toSchemaTile,
  type RawTile,
} from "../dominosLogic.js";

// ── Helpers ──────────────────────────────────────────────────────────

function tile(id: number, high: number, low: number): RawTile {
  return { id, highPips: high, lowPips: low };
}

function createState(): DominosState {
  return new DominosState();
}

function addPlayer(
  state: DominosState,
  sessionId: string,
  playerIndex: number,
  tiles: RawTile[] = [],
): void {
  const player = new PlayerInfo();
  player.sessionId = sessionId;
  player.displayName = `Player ${playerIndex + 1}`;
  player.playerIndex = playerIndex;
  player.isSpectator = false;
  player.isConnected = true;
  player.controllerSessionId = "";
  state.players.set(sessionId, player);

  const ps = new DominosPlayerState();
  for (const raw of tiles) {
    ps.hand.push(toSchemaTile(raw));
  }
  state.playerStates.set(sessionId, ps);
}

// ── Tests ────────────────────────────────────────────────────────────

describe("dominosLogic", () => {
  // ── 1. Tile set generation ──────────────────────────────────────────

  describe("generateTileSet", () => {
    it("produces exactly 28 tiles", () => {
      const tiles = generateTileSet();
      expect(tiles).toHaveLength(28);
    });

    it("contains all unique pip combinations from [0,0] to [6,6]", () => {
      const tiles = generateTileSet();
      const pairs = tiles.map((t) => `${t.lowPips}-${t.highPips}`);
      const uniquePairs = new Set(pairs);
      expect(uniquePairs.size).toBe(28);
    });

    it("assigns sequential ids starting from 0", () => {
      const tiles = generateTileSet();
      tiles.forEach((t, i) => {
        expect(t.id).toBe(i);
      });
    });

    it("ensures lowPips ≤ highPips on every tile", () => {
      const tiles = generateTileSet();
      for (const t of tiles) {
        expect(t.lowPips).toBeLessThanOrEqual(t.highPips);
      }
    });

    it("contains exactly 7 doubles (0-0 through 6-6)", () => {
      const tiles = generateTileSet();
      const doubles = tiles.filter((t) => t.highPips === t.lowPips);
      expect(doubles).toHaveLength(7);
    });

    it("includes pip values covering the full 0–6 range", () => {
      const tiles = generateTileSet();
      const allPips = new Set(tiles.flatMap((t) => [t.highPips, t.lowPips]));
      expect(allPips).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
    });
  });

  // ── 2. Dealing ──────────────────────────────────────────────────────

  describe("tilesPerPlayer", () => {
    it("returns 7 for 2 players", () => {
      expect(tilesPerPlayer(2)).toBe(7);
    });

    it("returns 5 for 3 players", () => {
      expect(tilesPerPlayer(3)).toBe(5);
    });

    it("returns 5 for 4 players", () => {
      expect(tilesPerPlayer(4)).toBe(5);
    });
  });

  describe("dealing math", () => {
    it("leaves 14 tiles in boneyard for 2 players (28 − 2×7)", () => {
      const total = 28;
      const dealt = 2 * tilesPerPlayer(2);
      expect(total - dealt).toBe(14);
    });

    it("leaves 13 tiles in boneyard for 3 players (28 − 3×5)", () => {
      const total = 28;
      const dealt = 3 * tilesPerPlayer(3);
      expect(total - dealt).toBe(13);
    });

    it("leaves 8 tiles in boneyard for 4 players (28 − 4×5)", () => {
      const total = 28;
      const dealt = 4 * tilesPerPlayer(4);
      expect(total - dealt).toBe(8);
    });
  });

  // ── Shuffle ─────────────────────────────────────────────────────────

  describe("shuffle", () => {
    it("returns the same array reference (in-place)", () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffle(arr);
      expect(result).toBe(arr);
    });

    it("preserves all elements", () => {
      const arr = [1, 2, 3, 4, 5];
      shuffle(arr);
      expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  // ── Tile utilities ──────────────────────────────────────────────────

  describe("isDouble", () => {
    it("returns true for doubles", () => {
      expect(isDouble(tile(0, 3, 3))).toBe(true);
      expect(isDouble(tile(0, 0, 0))).toBe(true);
      expect(isDouble(tile(0, 6, 6))).toBe(true);
    });

    it("returns false for non-doubles", () => {
      expect(isDouble(tile(0, 3, 2))).toBe(false);
      expect(isDouble(tile(0, 6, 0))).toBe(false);
    });
  });

  describe("pipTotal", () => {
    it("sums both pip values", () => {
      expect(pipTotal(tile(0, 6, 4))).toBe(10);
      expect(pipTotal(tile(0, 0, 0))).toBe(0);
      expect(pipTotal(tile(0, 6, 6))).toBe(12);
    });
  });

  // ── 3. Valid play detection ─────────────────────────────────────────

  describe("tileMatchesEnd", () => {
    it("matches when highPips equals end value", () => {
      expect(tileMatchesEnd(tile(0, 5, 2), 5)).toBe(true);
    });

    it("matches when lowPips equals end value", () => {
      expect(tileMatchesEnd(tile(0, 5, 2), 2)).toBe(true);
    });

    it("does not match when neither pip equals end value", () => {
      expect(tileMatchesEnd(tile(0, 5, 2), 3)).toBe(false);
    });
  });

  describe("canPlayTile", () => {
    it("allows any tile on an empty board (openEndA === -1)", () => {
      expect(canPlayTile(tile(0, 3, 1), -1, -1)).toBe(true);
    });

    it("allows a tile matching end A", () => {
      expect(canPlayTile(tile(0, 3, 1), 3, 5)).toBe(true);
    });

    it("allows a tile matching end B", () => {
      expect(canPlayTile(tile(0, 5, 2), 3, 5)).toBe(true);
    });

    it("allows a tile matching both ends", () => {
      expect(canPlayTile(tile(0, 3, 5), 3, 5)).toBe(true);
    });

    it("rejects a tile matching neither end", () => {
      expect(canPlayTile(tile(0, 1, 2), 3, 5)).toBe(false);
    });

    it("handles same-value open ends (spinner scenario)", () => {
      // Both ends are 4; tile [4,2] should match
      expect(canPlayTile(tile(0, 4, 2), 4, 4)).toBe(true);
      // Tile [1,2] should not match
      expect(canPlayTile(tile(0, 2, 1), 4, 4)).toBe(false);
    });
  });

  describe("hasPlayableTile", () => {
    it("returns true if any tile in the hand can be played", () => {
      const hand = [tile(0, 1, 0), tile(1, 3, 2)];
      expect(hasPlayableTile(hand, 3, 5)).toBe(true);
    });

    it("returns false if no tile in the hand matches", () => {
      const hand = [tile(0, 1, 0), tile(1, 2, 0)];
      expect(hasPlayableTile(hand, 3, 5)).toBe(false);
    });

    it("returns true for any hand when board is empty", () => {
      const hand = [tile(0, 6, 6)];
      expect(hasPlayableTile(hand, -1, -1)).toBe(true);
    });

    it("returns false for an empty hand", () => {
      expect(hasPlayableTile([], 3, 5)).toBe(false);
    });
  });

  // ── 4. Tile placement / play resolution ─────────────────────────────

  describe("resolvePlay", () => {
    it("returns the other pip when highPips matches", () => {
      const result = resolvePlay(tile(0, 5, 2), 5);
      expect(result.newEndValue).toBe(2);
    });

    it("returns the other pip when lowPips matches", () => {
      const result = resolvePlay(tile(0, 5, 2), 2);
      expect(result.newEndValue).toBe(5);
    });

    it("returns the same pip for a double", () => {
      const result = resolvePlay(tile(0, 4, 4), 4);
      expect(result.newEndValue).toBe(4);
    });
  });

  describe("getValidEnds", () => {
    it("returns ['a'] for an empty board", () => {
      expect(getValidEnds(tile(0, 5, 3), -1, -1)).toEqual(["a"]);
    });

    it("returns ['a'] when tile matches only end A", () => {
      expect(getValidEnds(tile(0, 3, 1), 3, 6)).toEqual(["a"]);
    });

    it("returns ['b'] when tile matches only end B", () => {
      expect(getValidEnds(tile(0, 6, 2), 3, 6)).toEqual(["b"]);
    });

    it("returns ['a', 'b'] when tile matches both distinct ends", () => {
      expect(getValidEnds(tile(0, 3, 6), 3, 6)).toEqual(["a", "b"]);
    });

    it("returns ['a'] when both ends are the same value (avoids duplicates)", () => {
      expect(getValidEnds(tile(0, 4, 2), 4, 4)).toEqual(["a"]);
    });
  });

  describe("placeTileOnBoard", () => {
    it("places the first tile, setting both open ends", () => {
      const state = createState();
      const raw = tile(0, 5, 3);

      const success = placeTileOnBoard(state, raw, "a");

      expect(success).toBe(true);
      expect(state.openEndA).toBe(3); // lowPips
      expect(state.openEndB).toBe(5); // highPips
      expect(state.board.length).toBe(1);
      expect(state.lastPlayedTileId).toBe(0);
    });

    it("updates end A when placing on end A", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a"); // ends: 3, 5

      const success = placeTileOnBoard(state, tile(1, 3, 1), "a");

      expect(success).toBe(true);
      expect(state.openEndA).toBe(1); // 3 matched, 1 is new exposed end
      expect(state.openEndB).toBe(5); // unchanged
    });

    it("updates end B when placing on end B", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a"); // ends: 3, 5

      const success = placeTileOnBoard(state, tile(1, 5, 2), "b");

      expect(success).toBe(true);
      expect(state.openEndA).toBe(3); // unchanged
      expect(state.openEndB).toBe(2); // 5 matched, 2 is new exposed end
    });

    it("rejects a tile that does not match the chosen end", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a"); // ends: 3, 5

      const success = placeTileOnBoard(state, tile(1, 6, 4), "a");

      expect(success).toBe(false);
      expect(state.openEndA).toBe(3); // unchanged
    });

    it("handles a double tile correctly (same end value after placement)", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a"); // ends: 3, 5

      const success = placeTileOnBoard(state, tile(1, 3, 3), "a");

      expect(success).toBe(true);
      expect(state.openEndA).toBe(3); // double-3 keeps end at 3
    });

    it("increments board length with each placement", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a");
      placeTileOnBoard(state, tile(1, 3, 1), "a");
      placeTileOnBoard(state, tile(2, 5, 2), "b");

      expect(state.board.length).toBe(3);
    });
  });

  // ── 5. Drawing from boneyard ────────────────────────────────────────
  // Note: Drawing is handled in the plugin layer (DominosPlugin.actions.draw).
  // Logic tests cover the helpers used by the plugin.

  // ── 6. Pass logic ──────────────────────────────────────────────────
  // Pass validation uses hasPlayableTile + boneyard checks (tested above
  // and in isRoundBlocked below).

  // ── 7. Turn advancement ─────────────────────────────────────────────

  describe("getActivePlayers", () => {
    it("returns non-spectator players sorted by playerIndex", () => {
      const state = createState();
      addPlayer(state, "p2", 1);
      addPlayer(state, "p1", 0);
      addPlayer(state, "p3", 2);

      expect(getActivePlayers(state)).toEqual(["p1", "p2", "p3"]);
    });

    it("excludes spectators", () => {
      const state = createState();
      addPlayer(state, "p1", 0);
      addPlayer(state, "p2", 1);

      const spectator = new PlayerInfo();
      spectator.sessionId = "spec";
      spectator.displayName = "Spectator";
      spectator.playerIndex = 99;
      spectator.isSpectator = true;
      spectator.isConnected = true;
      spectator.controllerSessionId = "";
      state.players.set("spec", spectator);

      expect(getActivePlayers(state)).toEqual(["p1", "p2"]);
    });
  });

  describe("getNextPlayer", () => {
    it("returns the next player in turn order", () => {
      const state = createState();
      addPlayer(state, "p1", 0);
      addPlayer(state, "p2", 1);
      addPlayer(state, "p3", 2);

      expect(getNextPlayer(state, "p1")).toBe("p2");
      expect(getNextPlayer(state, "p2")).toBe("p3");
    });

    it("wraps around from last player to first", () => {
      const state = createState();
      addPlayer(state, "p1", 0);
      addPlayer(state, "p2", 1);
      addPlayer(state, "p3", 2);

      expect(getNextPlayer(state, "p3")).toBe("p1");
    });

    it("works with 2 players (alternating)", () => {
      const state = createState();
      addPlayer(state, "alice", 0);
      addPlayer(state, "bob", 1);

      expect(getNextPlayer(state, "alice")).toBe("bob");
      expect(getNextPlayer(state, "bob")).toBe("alice");
    });
  });

  // ── 8. Win condition — player empties hand ──────────────────────────

  describe("scoreDomino", () => {
    it("awards winner the sum of all opponents' remaining pips", () => {
      const state = createState();
      // Winner has empty hand
      addPlayer(state, "winner", 0, []);
      // Opponent 1: [5,3] = 8 pips
      addPlayer(state, "opp1", 1, [tile(0, 5, 3)]);
      // Opponent 2: [6,1] + [2,2] = 7 + 4 = 11 pips
      addPlayer(state, "opp2", 2, [tile(1, 6, 1), tile(2, 2, 2)]);

      const scores = scoreDomino(state, "winner");

      expect(scores["winner"]).toBe(19); // 8 + 11
      expect(scores["opp1"]).toBe(0);
      expect(scores["opp2"]).toBe(0);
    });

    it("gives 0 to the winner when opponents have no pips (all blanks)", () => {
      const state = createState();
      addPlayer(state, "winner", 0, []);
      addPlayer(state, "opp", 1, [tile(0, 0, 0)]);

      const scores = scoreDomino(state, "winner");
      expect(scores["winner"]).toBe(0);
      expect(scores["opp"]).toBe(0);
    });
  });

  // ── 9. Blocked game ─────────────────────────────────────────────────

  describe("isRoundBlocked", () => {
    it("returns false when boneyard is not empty", () => {
      const state = createState();
      state.openEndA = 3;
      state.openEndB = 5;
      addPlayer(state, "p1", 0, [tile(0, 1, 0)]); // can't play

      expect(isRoundBlocked(state, [tile(99, 6, 6)])).toBe(false);
    });

    it("returns false when a player has a playable tile", () => {
      const state = createState();
      state.openEndA = 3;
      state.openEndB = 5;
      addPlayer(state, "p1", 0, [tile(0, 3, 1)]); // can play on end A
      addPlayer(state, "p2", 1, [tile(1, 6, 6)]); // can't play

      expect(isRoundBlocked(state, [])).toBe(false);
    });

    it("returns true when no player can play and boneyard is empty", () => {
      const state = createState();
      state.openEndA = 3;
      state.openEndB = 5;
      addPlayer(state, "p1", 0, [tile(0, 1, 0)]);
      addPlayer(state, "p2", 1, [tile(1, 6, 6)]);

      expect(isRoundBlocked(state, [])).toBe(true);
    });
  });

  describe("resolveBlockedRound", () => {
    it("declares the player with the lowest pip total as winner", () => {
      const state = createState();
      // p1: [2,1] = 3 pips (lowest)
      addPlayer(state, "p1", 0, [tile(0, 2, 1)]);
      // p2: [6,5] = 11 pips
      addPlayer(state, "p2", 1, [tile(1, 6, 5)]);
      // p3: [4,3] = 7 pips
      addPlayer(state, "p3", 2, [tile(2, 4, 3)]);

      const result = resolveBlockedRound(state);

      expect(result.winnerId).toBe("p1");
    });

    it("awards winner the sum of opponents' pip totals", () => {
      const state = createState();
      addPlayer(state, "p1", 0, [tile(0, 2, 1)]); // 3 pips
      addPlayer(state, "p2", 1, [tile(1, 6, 5)]); // 11 pips

      const result = resolveBlockedRound(state);

      expect(result.winnerId).toBe("p1");
      expect(result.scores["p1"]).toBe(11); // opponent's pips
      expect(result.scores["p2"]).toBe(0);
    });

    it("handles multiple opponents in scoring", () => {
      const state = createState();
      addPlayer(state, "p1", 0, [tile(0, 1, 0)]); // 1 pip
      addPlayer(state, "p2", 1, [tile(1, 5, 3)]); // 8 pips
      addPlayer(state, "p3", 2, [tile(2, 6, 4)]); // 10 pips

      const result = resolveBlockedRound(state);

      expect(result.winnerId).toBe("p1");
      expect(result.scores["p1"]).toBe(18); // 8 + 10
    });
  });

  // ── 10. Scoring ─────────────────────────────────────────────────────

  describe("handPipTotal", () => {
    it("sums all pips across tiles in a hand", () => {
      const hand = [tile(0, 6, 4), tile(1, 3, 2), tile(2, 0, 0)];
      expect(handPipTotal(hand)).toBe(15); // 10 + 5 + 0
    });

    it("returns 0 for an empty hand", () => {
      expect(handPipTotal([])).toBe(0);
    });

    it("handles a single tile correctly", () => {
      expect(handPipTotal([tile(0, 6, 6)])).toBe(12);
    });
  });

  // ── 11. Starting player ─────────────────────────────────────────────

  describe("determineStartingPlayer", () => {
    it("picks the player with the highest double", () => {
      const hands = new Map<string, RawTile[]>();
      hands.set("p1", [tile(0, 3, 3), tile(1, 5, 2)]);
      hands.set("p2", [tile(2, 6, 6), tile(3, 4, 1)]);
      hands.set("p3", [tile(4, 5, 5), tile(5, 2, 0)]);

      expect(determineStartingPlayer(hands)).toBe("p2"); // has [6,6]
    });

    it("ignores non-double tiles even if they have higher pips", () => {
      const hands = new Map<string, RawTile[]>();
      hands.set("p1", [tile(0, 6, 5)]); // 11 pips but not a double
      hands.set("p2", [tile(1, 2, 2)]); // double-2

      expect(determineStartingPlayer(hands)).toBe("p2");
    });

    it("falls back to highest pip-total when no one has a double", () => {
      const hands = new Map<string, RawTile[]>();
      hands.set("p1", [tile(0, 5, 2)]); // 7 pips
      hands.set("p2", [tile(1, 6, 4)]); // 10 pips (highest)
      hands.set("p3", [tile(2, 3, 1)]); // 4 pips

      expect(determineStartingPlayer(hands)).toBe("p2");
    });

    it("works with a single player", () => {
      const hands = new Map<string, RawTile[]>();
      hands.set("solo", [tile(0, 4, 4)]);

      expect(determineStartingPlayer(hands)).toBe("solo");
    });

    it("compares across all hands to find the absolute highest double", () => {
      const hands = new Map<string, RawTile[]>();
      hands.set("p1", [tile(0, 4, 4), tile(1, 1, 1)]); // highest double is 4
      hands.set("p2", [tile(2, 5, 5)]); // highest double is 5

      expect(determineStartingPlayer(hands)).toBe("p2");
    });
  });

  // ── 12. Edge cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("single tile remaining in hand still calculates correct pip total", () => {
      const hand = [tile(0, 6, 5)];
      expect(handPipTotal(hand)).toBe(11);
    });

    it("hand of all doubles scores correctly", () => {
      const hand = [
        tile(0, 0, 0),
        tile(1, 1, 1),
        tile(2, 2, 2),
        tile(3, 3, 3),
        tile(4, 4, 4),
        tile(5, 5, 5),
        tile(6, 6, 6),
      ];
      // 0+2+4+6+8+10+12 = 42
      expect(handPipTotal(hand)).toBe(42);
    });

    it("4-player game deals correctly and leaves expected boneyard", () => {
      const tiles = generateTileSet();
      const perPlayer = tilesPerPlayer(4);
      const totalDealt = 4 * perPlayer;
      expect(perPlayer).toBe(5);
      expect(tiles.length - totalDealt).toBe(8);
    });

    it("double played on matching end keeps end value the same", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a"); // ends: 3, 5

      placeTileOnBoard(state, tile(1, 5, 5), "b"); // double-5 on end B (5)

      expect(state.openEndB).toBe(5); // end stays at 5
      expect(state.openEndA).toBe(3); // unchanged
    });

    it("blank (0-pip) tile matches a 0-value end", () => {
      expect(tileMatchesEnd(tile(0, 0, 0), 0)).toBe(true);
      expect(canPlayTile(tile(0, 0, 0), 0, 5)).toBe(true);
    });

    it("blank tile does not match non-zero ends", () => {
      expect(canPlayTile(tile(0, 0, 0), 3, 5)).toBe(false);
    });

    it("tile [6,0] is versatile — matches either 6 or 0", () => {
      expect(tileMatchesEnd(tile(0, 6, 0), 6)).toBe(true);
      expect(tileMatchesEnd(tile(0, 6, 0), 0)).toBe(true);
      expect(tileMatchesEnd(tile(0, 6, 0), 3)).toBe(false);
    });

    it("resolvePlay with first-tile edge (tile with 0 pips)", () => {
      const result = resolvePlay(tile(0, 3, 0), 3);
      expect(result.newEndValue).toBe(0);
    });
  });

  // ── Schema conversion helpers ───────────────────────────────────────

  describe("toRawTile / toSchemaTile", () => {
    it("round-trips a tile through schema and back", () => {
      const raw = tile(7, 5, 3);
      const schema = toSchemaTile(raw);
      const back = toRawTile(schema);

      expect(back).toEqual(raw);
    });

    it("converts a schema DominoTile to RawTile correctly", () => {
      const dt = new DominoTile();
      dt.id = 12;
      dt.highPips = 4;
      dt.lowPips = 2;

      const raw = toRawTile(dt);
      expect(raw).toEqual({ id: 12, highPips: 4, lowPips: 2 });
    });

    it("converts a RawTile to a DominoTile schema object", () => {
      const schema = toSchemaTile(tile(5, 6, 1));
      expect(schema).toBeInstanceOf(DominoTile);
      expect(schema.id).toBe(5);
      expect(schema.highPips).toBe(6);
      expect(schema.lowPips).toBe(1);
    });
  });

  describe("removeTileFromHand", () => {
    it("removes a tile by id and returns it", () => {
      const ps = new DominosPlayerState();
      ps.hand.push(toSchemaTile(tile(0, 3, 1)));
      ps.hand.push(toSchemaTile(tile(1, 5, 2)));
      ps.hand.push(toSchemaTile(tile(2, 6, 4)));

      const removed = removeTileFromHand(ps, 1);

      expect(removed).not.toBeNull();
      expect(removed!.id).toBe(1);
      expect(ps.hand.length).toBe(2);
    });

    it("returns null when tile id is not in hand", () => {
      const ps = new DominosPlayerState();
      ps.hand.push(toSchemaTile(tile(0, 3, 1)));

      expect(removeTileFromHand(ps, 99)).toBeNull();
      expect(ps.hand.length).toBe(1);
    });

    it("handles removing the last tile from a hand", () => {
      const ps = new DominosPlayerState();
      ps.hand.push(toSchemaTile(tile(5, 4, 2)));

      const removed = removeTileFromHand(ps, 5);

      expect(removed).not.toBeNull();
      expect(ps.hand.length).toBe(0);
    });
  });

  // ── Integration-style: multi-step board play ────────────────────────

  describe("multi-step board play", () => {
    it("builds a chain of three tiles with correct open ends", () => {
      const state = createState();

      // First tile: [5,3] → ends become 3, 5
      placeTileOnBoard(state, tile(0, 5, 3), "a");
      expect(state.openEndA).toBe(3);
      expect(state.openEndB).toBe(5);

      // Play [3,1] on end A (matches 3) → end A becomes 1
      placeTileOnBoard(state, tile(1, 3, 1), "a");
      expect(state.openEndA).toBe(1);
      expect(state.openEndB).toBe(5);

      // Play [6,5] on end B (matches 5) → end B becomes 6
      placeTileOnBoard(state, tile(2, 6, 5), "b");
      expect(state.openEndA).toBe(1);
      expect(state.openEndB).toBe(6);

      expect(state.board.length).toBe(3);
    });

    it("rejects plays after the board state changes make them invalid", () => {
      const state = createState();
      placeTileOnBoard(state, tile(0, 5, 3), "a"); // ends: 3, 5

      // [3,1] matches end A (3) → play on A
      placeTileOnBoard(state, tile(1, 3, 1), "a"); // ends: 1, 5

      // Now [3,2] no longer matches end A (1) — should fail
      const success = placeTileOnBoard(state, tile(2, 3, 2), "a");
      expect(success).toBe(false);
    });

    it("tracks lastPlayedTileId through successive plays", () => {
      const state = createState();
      placeTileOnBoard(state, tile(10, 5, 3), "a");
      expect(state.lastPlayedTileId).toBe(10);

      placeTileOnBoard(state, tile(20, 3, 1), "a");
      expect(state.lastPlayedTileId).toBe(20);
    });
  });

  // ── Blocked round with equal pip totals ─────────────────────────────

  describe("resolveBlockedRound — tie-breaking", () => {
    it("picks a winner even when pip totals are equal (first-found wins)", () => {
      const state = createState();
      addPlayer(state, "p1", 0, [tile(0, 3, 2)]); // 5 pips
      addPlayer(state, "p2", 1, [tile(1, 4, 1)]); // 5 pips

      const result = resolveBlockedRound(state);

      // Both have 5 pips — implementation picks the first one iterated
      expect(["p1", "p2"]).toContain(result.winnerId);
      expect(result.scores[result.winnerId]).toBe(5);
    });
  });
});

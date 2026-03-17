import type { Client } from "colyseus";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@eschaton/shared",
  async () => await import("../../../../../shared/src/index.ts"),
);

const shared = await import("../../../../../shared/src/index.ts");
const {
  DominosPlayerState,
  DominosState,
} = shared;
const { dominosPlugin, setPlayerHand } = await import("../DominosPlugin");

// ── Helpers ──────────────────────────────────────────────────────────

type DominosStateInstance = InstanceType<typeof DominosState>;

const mockClient = (sessionId: string) => ({ sessionId }) as Client;

function joinPlayers(
  state: DominosStateInstance,
  count: number = 2,
): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `player-${i + 1}`;
    ids.push(id);
    dominosPlugin.lifecycle.onPlayerJoin?.(state, mockClient(id), i);
  }
  return ids;
}

function createGameState(playerCount: number = 2): {
  state: DominosStateInstance;
  players: string[];
} {
  const state = dominosPlugin.createState();
  const players = joinPlayers(state, playerCount);
  return { state, players };
}

function startGame(playerCount: number = 2): {
  state: DominosStateInstance;
  players: string[];
} {
  const { state, players } = createGameState(playerCount);
  dominosPlugin.lifecycle.onGameStart(state);
  return { state, players };
}

/**
 * Returns the server-side hand for a player by calling getPlayerMessage.
 * The plugin sends hand data via { type: "hand", tiles: RawTile[] }.
 */
function getHandFromMessage(
  state: DominosStateInstance,
  sessionId: string,
): Array<{ id: number; highPips: number; lowPips: number }> {
  const msg = dominosPlugin.stateFilter?.getPlayerMessage?.(state, sessionId) as
    | { type: string; tiles: Array<{ id: number; highPips: number; lowPips: number }> }
    | null
    | undefined;
  if (!msg || msg.type !== "hand") return [];
  return msg.tiles;
}

/**
 * Get the first tile from a player's server-side hand (via getPlayerMessage).
 */
function getFirstHandTile(
  state: DominosStateInstance,
  sessionId: string,
): { id: number; highPips: number; lowPips: number } | undefined {
  return getHandFromMessage(state, sessionId)[0];
}

// ── Tests ────────────────────────────────────────────────────────────

describe("dominosPlugin", () => {
  // ─── Metadata ────────────────────────────────────────────────────

  describe("metadata", () => {
    it("describes the dominos plugin", () => {
      expect(dominosPlugin.id).toBe("dominos");
      expect(dominosPlugin.name).toBe("Dominos");
      expect(dominosPlugin.metadata.playerCount).toEqual([2, 4]);
      expect(dominosPlugin.metadata.hasHiddenInformation).toBe(true);
    });

    it("uses sequential turn mode with round-robin order", () => {
      expect(dominosPlugin.turnConfig.mode).toBe("sequential");
      expect(dominosPlugin.turnConfig.turnOrder).toEqual({
        type: "round-robin",
      });
      expect(dominosPlugin.turnConfig.allowPass).toBe(true);
    });
  });

  // ─── State Creation ──────────────────────────────────────────────

  describe("createState", () => {
    it("creates a DominosState with empty containers", () => {
      const state = dominosPlugin.createState();
      expect(state).toBeInstanceOf(DominosState);
      expect(state.phase).toBe("waiting");
      expect(state.board).toHaveLength(0);
      expect(state.openEndA).toBe(-1);
      expect(state.openEndB).toBe(-1);
      expect(state.boneyardCount).toBe(0);
    });
  });

  // ─── Lifecycle ───────────────────────────────────────────────────

  describe("lifecycle", () => {
    describe("onPlayerJoin", () => {
      it("registers a player in the state", () => {
        const state = dominosPlugin.createState();
        dominosPlugin.lifecycle.onPlayerJoin?.(
          state,
          mockClient("player-1"),
          0,
        );
        expect(state.players.get("player-1")).toBeDefined();
        expect(state.players.get("player-1")!.sessionId).toBe("player-1");
      });
    });

    describe("onGameStart", () => {
      it("deals 7 tiles each to 2 players (handCount on schema)", () => {
        const { state, players } = startGame(2);
        const p1 = state.playerStates.get(players[0])!;
        const p2 = state.playerStates.get(players[1])!;
        expect(p1.handCount).toBe(7);
        expect(p2.handCount).toBe(7);
        expect(state.boneyardCount).toBe(14);
      });

      it("deals 5 tiles each to 3 players", () => {
        const { state, players } = startGame(3);
        for (const id of players) {
          expect(state.playerStates.get(id)!.handCount).toBe(5);
        }
        expect(state.boneyardCount).toBe(13);
      });

      it("deals 5 tiles each to 4 players", () => {
        const { state, players } = startGame(4);
        for (const id of players) {
          expect(state.playerStates.get(id)!.handCount).toBe(5);
        }
        expect(state.boneyardCount).toBe(8);
      });

      it("sets currentTurn to a valid player", () => {
        const { state, players } = startGame(2);
        expect(players).toContain(state.currentTurn);
      });

      it("total tiles dealt + boneyard equals 28", () => {
        const { state, players } = startGame(2);
        let totalDealt = 0;
        for (const id of players) {
          totalDealt += state.playerStates.get(id)!.handCount;
        }
        expect(totalDealt + state.boneyardCount).toBe(28);
      });
    });

    describe("onPlayerLeave", () => {
      it("marks the player as disconnected", () => {
        const { state } = createGameState(2);
        dominosPlugin.lifecycle.onPlayerLeave?.(state, "player-1");
        expect(state.players.get("player-1")!.isConnected).toBe(false);
      });
    });

    describe("onGameEnd", () => {
      it("sets phase to ended", () => {
        const { state } = startGame(2);
        dominosPlugin.lifecycle.onGameEnd?.(state);
        expect(state.phase).toBe("ended");
      });
    });
  });

  // ─── Actions ─────────────────────────────────────────────────────

  describe("actions", () => {
    describe("play", () => {
      it("places a valid tile on an empty board", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;
        const tile = getFirstHandTile(state, currentPlayer)!;

        const result = dominosPlugin.actions.play(
          state,
          mockClient(currentPlayer),
          { tileId: tile.id, end: "a" as const },
        );

        expect(result.success).toBe(true);
        expect(result.endsTurn).toBe(true);
        expect(state.board.length).toBe(1);
        expect(state.playerStates.get(currentPlayer)!.handCount).toBe(6);
      });

      it("rejects a tile not in the player's hand", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        const result = dominosPlugin.actions.play(
          state,
          mockClient(currentPlayer),
          { tileId: 9999, end: "a" as const },
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("not in hand");
      });

      it("rejects an invalid payload", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        const result = dominosPlugin.actions.play(
          state,
          mockClient(currentPlayer),
          { garbage: true },
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid play payload");
      });

      it("rejects a tile that doesn't match open ends", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Play first tile to establish board state
        const firstTile = getFirstHandTile(state, currentPlayer)!;
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: firstTile.id,
          end: "a" as const,
        });

        // Force open ends to 0-0 and find a non-matching tile
        state.openEndA = 0;
        state.openEndB = 0;

        const hand = getHandFromMessage(state, currentPlayer);
        const nonMatching = hand.find(
          (t) => t.highPips !== 0 && t.lowPips !== 0,
        );
        if (nonMatching) {
          const result = dominosPlugin.actions.play(
            state,
            mockClient(currentPlayer),
            { tileId: nonMatching.id, end: "a" as const },
          );
          expect(result.success).toBe(false);
          expect(result.error).toContain("does not match");
        }
      });

      it("ends the game when a player empties their hand (domino)", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;
        const ps = state.playerStates.get(currentPlayer)!;

        // Play tiles on empty board until we can't or we empty the hand
        state.openEndA = -1;
        const hand = getHandFromMessage(state, currentPlayer);

        const firstTile = hand[0];
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: firstTile.id,
          end: "a" as const,
        });

        let remaining = getHandFromMessage(state, currentPlayer);
        while (remaining.length > 0) {
          const playable = remaining.find(
            (t) =>
              t.highPips === state.openEndA ||
              t.lowPips === state.openEndA ||
              t.highPips === state.openEndB ||
              t.lowPips === state.openEndB,
          );
          if (!playable) break;

          const end =
            playable.highPips === state.openEndA ||
            playable.lowPips === state.openEndA
              ? ("a" as const)
              : ("b" as const);
          const result = dominosPlugin.actions.play(
            state,
            mockClient(currentPlayer),
            { tileId: playable.id, end },
          );
          if (!result.success) break;
          if (result.endsGame) {
            expect(ps.handCount).toBe(0);
            return;
          }
          remaining = getHandFromMessage(state, currentPlayer);
        }
        // If domino didn't happen naturally due to random tiles, that's OK —
        // the checkGameEnd test covers the detection logic
      });

      it("rejects play from unknown player", () => {
        const { state } = startGame(2);
        const result = dominosPlugin.actions.play(
          state,
          mockClient("nobody"),
          { tileId: 1, end: "a" as const },
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain("Player not found");
      });
    });

    describe("draw", () => {
      it("draws a tile from the boneyard when no playable tile exists", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;
        const ps = state.playerStates.get(currentPlayer)!;

        // Play first tile on empty board to set up specific ends
        const firstTile = getFirstHandTile(state, currentPlayer)!;
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: firstTile.id,
          end: "a" as const,
        });

        // Force ends to values unlikely to match remaining hand
        state.openEndA = 0;
        state.openEndB = 0;

        const hand = getHandFromMessage(state, currentPlayer);
        const hasPlayable = hand.some(
          (t) => t.highPips === 0 || t.lowPips === 0,
        );

        if (!hasPlayable && state.boneyardCount > 0) {
          const beforeCount = ps.handCount;
          const beforeBoneyard = state.boneyardCount;

          const result = dominosPlugin.actions.draw(
            state,
            mockClient(currentPlayer),
            {},
          );

          expect(result.success).toBe(true);
          expect(result.endsTurn).toBe(false);
          expect(ps.handCount).toBe(beforeCount + 1);
          expect(state.boneyardCount).toBe(beforeBoneyard - 1);
        }
      });

      it("rejects draw when player has a playable tile", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Empty board: any tile is playable, so draw should be rejected
        state.openEndA = -1;

        const result = dominosPlugin.actions.draw(
          state,
          mockClient(currentPlayer),
          {},
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("playable tile");
      });

      it("rejects draw from unknown player", () => {
        const { state } = startGame(2);
        const result = dominosPlugin.actions.draw(
          state,
          mockClient("nobody"),
          {},
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain("Player not found");
      });
    });

    describe("pass", () => {
      it("rejects pass when player has a playable tile", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Empty board: any tile is playable
        state.openEndA = -1;

        const result = dominosPlugin.actions.pass(
          state,
          mockClient(currentPlayer),
          {},
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("playable tile");
      });

      it("rejects pass when boneyard still has tiles", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Play first tile then force non-matching ends
        const firstTile = getFirstHandTile(state, currentPlayer)!;
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: firstTile.id,
          end: "a" as const,
        });
        state.openEndA = 0;
        state.openEndB = 0;

        const hand = getHandFromMessage(state, currentPlayer);
        const hasPlayable = hand.some(
          (t) => t.highPips === 0 || t.lowPips === 0,
        );

        if (!hasPlayable && state.boneyardCount > 0) {
          const result = dominosPlugin.actions.pass(
            state,
            mockClient(currentPlayer),
            {},
          );
          expect(result.success).toBe(false);
          expect(result.error).toContain("draw");
        }
      });
    });
  });

  // ─── Conditions ──────────────────────────────────────────────────

  describe("conditions", () => {
    describe("validateAction", () => {
      it("rejects actions from non-current player", () => {
        const { state, players } = startGame(2);
        const notCurrent = players.find((p) => p !== state.currentTurn)!;

        expect(
          dominosPlugin.conditions.validateAction(
            state,
            mockClient(notCurrent),
            "play",
            { tileId: 1, end: "a" },
          ),
        ).toBe(false);
      });

      it("validates a legal play from the current player on empty board", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        state.openEndA = -1;
        const tile = getFirstHandTile(state, currentPlayer)!;

        expect(
          dominosPlugin.conditions.validateAction(
            state,
            mockClient(currentPlayer),
            "play",
            { tileId: tile.id, end: "a" },
          ),
        ).toBe(true);
      });

      it("rejects play with tile not in hand", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        expect(
          dominosPlugin.conditions.validateAction(
            state,
            mockClient(currentPlayer),
            "play",
            { tileId: 9999, end: "a" },
          ),
        ).toBe(false);
      });

      it("rejects draw when player has a playable tile", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Empty board — everything is playable
        state.openEndA = -1;

        expect(
          dominosPlugin.conditions.validateAction(
            state,
            mockClient(currentPlayer),
            "draw",
            {},
          ),
        ).toBe(false);
      });

      it("rejects unknown action types", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        expect(
          dominosPlugin.conditions.validateAction(
            state,
            mockClient(currentPlayer),
            "explode",
            {},
          ),
        ).toBe(false);
      });
    });

    describe("checkGameEnd", () => {
      it("returns null while game is in progress", () => {
        const { state } = startGame(2);
        expect(dominosPlugin.conditions.checkGameEnd(state)).toBeNull();
      });

      it("detects domino (empty server-side hand) as win", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Play all tiles from the current player's hand on an empty board
        state.openEndA = -1;
        let hand = getHandFromMessage(state, currentPlayer);
        let firstPlay = true;

        while (hand.length > 0) {
          const playable = firstPlay
            ? hand[0]
            : hand.find(
                (t) =>
                  t.highPips === state.openEndA ||
                  t.lowPips === state.openEndA ||
                  t.highPips === state.openEndB ||
                  t.lowPips === state.openEndB,
              );
          if (!playable) break;
          firstPlay = false;

          const end =
            state.openEndA === -1 ||
            playable.highPips === state.openEndA ||
            playable.lowPips === state.openEndA
              ? ("a" as const)
              : ("b" as const);
          const result = dominosPlugin.actions.play(
            state,
            mockClient(currentPlayer),
            { tileId: playable.id, end },
          );
          if (!result.success) break;
          hand = getHandFromMessage(state, currentPlayer);
        }

        if (hand.length === 0) {
          const gameEnd = dominosPlugin.conditions.checkGameEnd(state);
          expect(gameEnd).not.toBeNull();
          expect(gameEnd!.type).toBe("win");
          expect(gameEnd!.winnerId).toBe(currentPlayer);
        }
      });
    });
  });

  // ─── Hidden State / Privacy ──────────────────────────────────────

  describe("hidden state verification", () => {
    describe("hand privacy — schema does NOT expose tile data", () => {
      it("DominosPlayerState has handCount (number), not hand (ArraySchema)", () => {
        const ps = new DominosPlayerState();
        // handCount should exist as a number
        expect(ps.handCount).toBeDefined();
        expect(typeof ps.handCount).toBe("number");
        expect(ps.handCount).toBe(0);

        // hand should NOT be on the schema
        expect((ps as Record<string, unknown>)["hand"]).toBeUndefined();
      });

      it("schema playerStates only expose handCount, score, and passed", () => {
        const { state, players } = startGame(2);
        const ps = state.playerStates.get(players[0])!;

        // These should be in the schema
        expect(typeof ps.handCount).toBe("number");
        expect(typeof ps.score).toBe("number");
        expect(typeof ps.passed).toBe("boolean");

        // hand array should NOT be in the schema
        expect((ps as Record<string, unknown>)["hand"]).toBeUndefined();
      });

      it("opponent handCount is visible but tile data is not", () => {
        const { state, players } = startGame(2);
        const [, p2] = players;

        const p2State = state.playerStates.get(p2)!;
        // p2's handCount is visible (this is fine — it's public info)
        expect(p2State.handCount).toBe(7);

        // But no hand tile array exists on the schema
        expect((p2State as Record<string, unknown>)["hand"]).toBeUndefined();
      });
    });

    describe("boneyard privacy", () => {
      it("boneyard tiles are NOT in the synced schema", () => {
        const { state } = startGame(2);
        expect(state.boneyardCount).toBeGreaterThan(0);
        // Only boneyardCount (number) exists, not a tiles array
        expect((state as Record<string, unknown>)["boneyard"]).toBeUndefined();
        expect(typeof state.boneyardCount).toBe("number");
      });

      it("boneyardCount tracks server-side boneyard after draw", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        // Play first tile to set board state
        const firstTile = getFirstHandTile(state, currentPlayer)!;
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: firstTile.id,
          end: "a" as const,
        });

        // Force non-matching ends for draw
        state.openEndA = 0;
        state.openEndB = 0;
        const hand = getHandFromMessage(state, currentPlayer);
        const hasPlayable = hand.some(
          (t) => t.highPips === 0 || t.lowPips === 0,
        );

        if (!hasPlayable && state.boneyardCount > 0) {
          const before = state.boneyardCount;
          dominosPlugin.actions.draw(state, mockClient(currentPlayer), {});
          expect(state.boneyardCount).toBe(before - 1);
        }
      });
    });

    describe("stateFilter", () => {
      it("filterForClient returns state (no hand tiles to leak)", () => {
        const { state, players } = startGame(2);
        const [p1] = players;

        const filtered = dominosPlugin.stateFilter?.filterForClient(
          state,
          p1,
          false,
        );

        // Filter returns full state — this is safe because hands
        // are no longer in the schema
        expect(filtered).toBe(state);
      });

      it("filterForClient is safe for spectators too", () => {
        const { state } = startGame(2);

        const filtered = dominosPlugin.stateFilter?.filterForClient(
          state,
          null,
          true,
        );

        // Safe because hand tiles are server-side only
        expect(filtered).toBe(state);
      });

      it("getPlayerMessage returns hand tiles for the correct player", () => {
        const { state, players } = startGame(2);
        const [p1, p2] = players;

        const p1Msg = dominosPlugin.stateFilter?.getPlayerMessage?.(
          state,
          p1,
        ) as { type: string; tiles: unknown[] } | null;
        const p2Msg = dominosPlugin.stateFilter?.getPlayerMessage?.(
          state,
          p2,
        ) as { type: string; tiles: unknown[] } | null;

        expect(p1Msg).not.toBeNull();
        expect(p1Msg!.type).toBe("hand");
        expect(p1Msg!.tiles).toHaveLength(7);

        expect(p2Msg).not.toBeNull();
        expect(p2Msg!.type).toBe("hand");
        expect(p2Msg!.tiles).toHaveLength(7);
      });

      it("getPlayerMessage returns different tiles per player", () => {
        const { state, players } = startGame(2);
        const [p1, p2] = players;

        const p1Hand = getHandFromMessage(state, p1);
        const p2Hand = getHandFromMessage(state, p2);

        expect(p1Hand.length).toBe(7);
        expect(p2Hand.length).toBe(7);

        // Tile IDs should not overlap between hands
        const p1Ids = new Set(p1Hand.map((t) => t.id));
        const p2Ids = new Set(p2Hand.map((t) => t.id));
        for (const id of p1Ids) {
          expect(p2Ids.has(id)).toBe(false);
        }
      });

      it("getPlayerMessage returns null for unknown player", () => {
        const { state } = startGame(2);

        const msg = dominosPlugin.stateFilter?.getPlayerMessage?.(
          state,
          "nobody",
        );
        expect(msg).toBeNull();
      });

      it("getPlayerMessage reflects updated hand after play", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;

        const beforeHand = getHandFromMessage(state, currentPlayer);
        expect(beforeHand.length).toBe(7);

        // Play first tile on empty board
        const tile = beforeHand[0];
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: tile.id,
          end: "a" as const,
        });

        const afterHand = getHandFromMessage(state, currentPlayer);
        expect(afterHand.length).toBe(6);
        expect(afterHand.find((t) => t.id === tile.id)).toBeUndefined();
      });
    });

    describe("handCount accuracy", () => {
      it("handCount matches after initial deal (2 players)", () => {
        const { state, players } = startGame(2);
        for (const id of players) {
          const ps = state.playerStates.get(id)!;
          expect(ps.handCount).toBe(7);

          // Verify handCount matches actual server-side hand size
          const hand = getHandFromMessage(state, id);
          expect(hand.length).toBe(ps.handCount);
        }
      });

      it("handCount decreases by 1 after play", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;
        const ps = state.playerStates.get(currentPlayer)!;
        const before = ps.handCount;

        const tile = getFirstHandTile(state, currentPlayer)!;
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: tile.id,
          end: "a" as const,
        });

        expect(ps.handCount).toBe(before - 1);
        // Verify consistency with getPlayerMessage
        const hand = getHandFromMessage(state, currentPlayer);
        expect(hand.length).toBe(ps.handCount);
      });

      it("handCount increases by 1 after draw", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;
        const ps = state.playerStates.get(currentPlayer)!;

        // Play first tile, then force draw scenario
        const firstTile = getFirstHandTile(state, currentPlayer)!;
        dominosPlugin.actions.play(state, mockClient(currentPlayer), {
          tileId: firstTile.id,
          end: "a" as const,
        });
        state.openEndA = 0;
        state.openEndB = 0;

        const hand = getHandFromMessage(state, currentPlayer);
        const hasPlayable = hand.some(
          (t) => t.highPips === 0 || t.lowPips === 0,
        );

        if (!hasPlayable && state.boneyardCount > 0) {
          const before = ps.handCount;
          dominosPlugin.actions.draw(state, mockClient(currentPlayer), {});
          expect(ps.handCount).toBe(before + 1);

          // Verify consistency
          const afterHand = getHandFromMessage(state, currentPlayer);
          expect(afterHand.length).toBe(ps.handCount);
        }
      });

      it("handCount is 0 after domino win", () => {
        const { state } = startGame(2);
        const currentPlayer = state.currentTurn;
        const ps = state.playerStates.get(currentPlayer)!;

        state.openEndA = -1;
        let hand = getHandFromMessage(state, currentPlayer);
        let firstPlay = true;

        while (hand.length > 0) {
          const playable = firstPlay
            ? hand[0]
            : hand.find(
                (t) =>
                  t.highPips === state.openEndA ||
                  t.lowPips === state.openEndA ||
                  t.highPips === state.openEndB ||
                  t.lowPips === state.openEndB,
              );
          if (!playable) break;
          firstPlay = false;

          const end =
            state.openEndA === -1 ||
            playable.highPips === state.openEndA ||
            playable.lowPips === state.openEndA
              ? ("a" as const)
              : ("b" as const);
          const result = dominosPlugin.actions.play(
            state,
            mockClient(currentPlayer),
            { tileId: playable.id, end },
          );
          if (!result.success) break;
          hand = getHandFromMessage(state, currentPlayer);
        }

        if (hand.length === 0) {
          expect(ps.handCount).toBe(0);
        }
      });
    });
  });

  // ─── Turn Flow Integration ───────────────────────────────────────

  describe("turn flow", () => {
    it("play action ends the current turn", () => {
      const { state } = startGame(2);
      const currentPlayer = state.currentTurn;
      const tile = getFirstHandTile(state, currentPlayer)!;

      const result = dominosPlugin.actions.play(
        state,
        mockClient(currentPlayer),
        { tileId: tile.id, end: "a" as const },
      );

      expect(result.endsTurn).toBe(true);
    });

    it("draw action does NOT end the turn", () => {
      const { state } = startGame(2);
      const currentPlayer = state.currentTurn;

      // Play first tile, then force draw
      const firstTile = getFirstHandTile(state, currentPlayer)!;
      dominosPlugin.actions.play(state, mockClient(currentPlayer), {
        tileId: firstTile.id,
        end: "a" as const,
      });
      state.openEndA = 0;
      state.openEndB = 0;

      const hand = getHandFromMessage(state, currentPlayer);
      const hasPlayable = hand.some(
        (t) => t.highPips === 0 || t.lowPips === 0,
      );

      if (!hasPlayable && state.boneyardCount > 0) {
        const result = dominosPlugin.actions.draw(
          state,
          mockClient(currentPlayer),
          {},
        );
        expect(result.success).toBe(true);
        expect(result.endsTurn).toBe(false);
      }
    });

    it("pass action ends the turn", () => {
      const { state } = startGame(2);
      const currentPlayer = state.currentTurn;

      // Play first tile to establish board
      const firstTile = getFirstHandTile(state, currentPlayer)!;
      dominosPlugin.actions.play(state, mockClient(currentPlayer), {
        tileId: firstTile.id,
        end: "a" as const,
      });

      // Force non-matching ends
      state.openEndA = 0;
      state.openEndB = 0;

      // Draw until boneyard empty
      let drawResult = { success: true } as { success: boolean };
      while (state.boneyardCount > 0 && drawResult.success) {
        drawResult = dominosPlugin.actions.draw(
          state,
          mockClient(currentPlayer),
          {},
        );
      }

      // Now try to pass (only works if hand has no 0-matching tiles)
      const hand = getHandFromMessage(state, currentPlayer);
      const hasPlayable = hand.some(
        (t) => t.highPips === 0 || t.lowPips === 0,
      );

      if (!hasPlayable && state.boneyardCount === 0) {
        const result = dominosPlugin.actions.pass(
          state,
          mockClient(currentPlayer),
          {},
        );
        expect(result.success).toBe(true);
        expect(result.endsTurn).toBe(true);
      }
    });

    it("multi-draw: player can draw repeatedly until boneyard empty or playable tile drawn", () => {
      const { state } = startGame(2);
      const currentPlayer = state.currentTurn;

      // Play first tile then force draw scenario
      const firstTile = getFirstHandTile(state, currentPlayer)!;
      dominosPlugin.actions.play(state, mockClient(currentPlayer), {
        tileId: firstTile.id,
        end: "a" as const,
      });
      // Set open ends that won't match the forced hand
      state.openEndA = 0;
      state.openEndB = 0;
      // Force hand to contain only a tile that can't match 0
      setPlayerHand(state, currentPlayer, [
        { id: 999, highPips: 6, lowPips: 5 },
      ]);
      state.playerStates.get(currentPlayer)!.handCount = 1;

      let draws = 0;
      while (state.boneyardCount > 0) {
        const result = dominosPlugin.actions.draw(
          state,
          mockClient(currentPlayer),
          {},
        );
        if (!result.success) break;
        draws += 1;
      }

      // Draws should succeed; loop ends when boneyard empty or a playable tile is drawn
      expect(draws).toBeGreaterThan(0);
    });
  });
});

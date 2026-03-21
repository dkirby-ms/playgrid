import {
  DominosPlayerState,
  DominosState,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
  type MoveEntry,
} from "@eschaton/shared";
import {
  canPlayTile,
  determineStartingPlayer,
  generateTileSet,
  getActivePlayers,
  getValidEnds,
  hasPlayableTile,
  isRoundBlocked,
  placeTileOnBoard,
  removeTileFromHand,
  resolveBlockedRound,
  scoreDomino,
  shuffle,
  tilesPerPlayer,
  type PlayEnd,
  type RawTile,
} from "./dominosLogic.js";

// ── Payload types ────────────────────────────────────────────────────

type PlayPayload = {
  tileId: number;
  end: PlayEnd;
};

function isPlayPayload(payload: unknown): payload is PlayPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.tileId === "number" &&
    (candidate.end === "a" || candidate.end === "b" || candidate.end === "c" || candidate.end === "d")
  );
}

// ── Server-side boneyard (not synced to clients) ─────────────────────

const boneyards = new Map<DominosState, RawTile[]>();

function getBoneyard(state: DominosState): RawTile[] {
  return boneyards.get(state) ?? [];
}

function setBoneyard(state: DominosState, tiles: RawTile[]): void {
  boneyards.set(state, tiles);
  state.boneyardCount = tiles.length;
}

function clearBoneyard(state: DominosState): void {
  boneyards.delete(state);
}

// ── Server-side player hands (not synced to clients) ─────────────────

const playerHandsMap = new Map<DominosState, Map<string, RawTile[]>>();

/** Get or create the hands map for a game state. */
export function getPlayerHands(state: DominosState): Map<string, RawTile[]> {
  let hands = playerHandsMap.get(state);
  if (!hands) {
    hands = new Map();
    playerHandsMap.set(state, hands);
  }
  return hands;
}

/** Get a single player's server-side hand. */
export function getPlayerHand(state: DominosState, sessionId: string): RawTile[] {
  return getPlayerHands(state).get(sessionId) ?? [];
}

/** Set a player's server-side hand and sync handCount on the schema. */
export function setPlayerHand(state: DominosState, sessionId: string, tiles: RawTile[]): void {
  getPlayerHands(state).set(sessionId, tiles);
  const ps = state.playerStates.get(sessionId);
  if (ps) ps.handCount = tiles.length;
}

function clearPlayerHands(state: DominosState): void {
  playerHandsMap.delete(state);
}

// ── Helpers ──────────────────────────────────────────────────────────

function resetPassFlags(state: DominosState): void {
  for (const ps of state.playerStates.values()) {
    ps.passed = false;
  }
}

function formatMoveEntries(
  state: DominosState,
  moves: MoveEntry[],
): MoveEntry[] {
  const formatted: MoveEntry[] = [];
  const playerStats: Record<string, { tilesPlayed: number; tilesDrawn: number; passCount: number }> = {};

  // Initialize stats for all players
  for (const [sessionId, ps] of state.playerStates.entries()) {
    if (!ps) continue;
    playerStats[sessionId] = { tilesPlayed: 0, tilesDrawn: 0, passCount: 0 };
  }

  for (const move of moves) {
    const stats = playerStats[move.playerId];
    
    if (move.actionType === "play") {
      const end = move.payload.end as string | undefined;
      const tile = move.payload.tile as number[] | undefined;
      
      // Get pip values from payload.tile array [a, b]
      let tileDisplay = "";
      if (Array.isArray(tile) && tile.length === 2) {
        tileDisplay = `[${tile[0]}|${tile[1]}]`;
      }
      
      // Uppercase the end letter for display
      const endDisplay = end ? end.toUpperCase() : end;
      
      if (endDisplay && tileDisplay) {
        formatted.push({
          ...move,
          description: `${move.playerName} played ${tileDisplay} on ${endDisplay} end`,
        });
      } else if (endDisplay) {
        formatted.push({
          ...move,
          description: `${move.playerName} played tile on ${endDisplay} end`,
        });
      } else {
        formatted.push({
          ...move,
          description: `${move.playerName} played a tile`,
        });
      }
      if (stats) stats.tilesPlayed++;
    } else if (move.actionType === "draw") {
      formatted.push({
        ...move,
        description: `${move.playerName} drew from boneyard`,
      });
      if (stats) stats.tilesDrawn++;
    } else if (move.actionType === "pass") {
      formatted.push({
        ...move,
        description: `${move.playerName} passed`,
      });
      if (stats) stats.passCount++;
    } else {
      formatted.push({ ...move });
    }
  }

  // Store stats in state metadata for use in buildScoreResult
  (state as DominosState & { _formattedStats?: typeof playerStats })._formattedStats = playerStats;

  return formatted;
}

function buildScoreResult(
  state: DominosState,
  winnerId: string,
  scores: Record<string, number>,
): GameResult {
  // Accumulate into persistent player scores
  for (const [sessionId, points] of Object.entries(scores)) {
    const ps = state.playerStates.get(sessionId);
    if (ps) ps.score += points;
  }

  // Retrieve stats from formatMoveHistory if available
  const formattedStats = (state as DominosState & { _formattedStats?: Record<string, { tilesPlayed: number; tilesDrawn: number; passCount: number }> })._formattedStats;

  const playerStats: Record<string, unknown> = {};
  for (const [sessionId, ps] of state.playerStates.entries()) {
    const hand = getPlayerHand(state, sessionId);
    playerStats[sessionId] = {
      tilesRemaining: hand.length,
      score: ps.score,
      ...(formattedStats?.[sessionId] || {}),
    };
  }

  return {
    type: "win",
    winnerId,
    scores: Object.fromEntries(
      Array.from(state.playerStates.entries()).map(([sid, ps]) => [
        sid,
        ps.score,
      ]),
    ),
    metadata: {
      tilesPlayed: state.board.length,
      ...playerStats,
    },
  };
}

// ── Plugin ───────────────────────────────────────────────────────────

export const dominosPlugin: GamePlugin<DominosState> = {
  id: "dominos",
  name: "Dominos",

  metadata: {
    playerCount: [2, 4],
    estimatedDuration: 15,
    complexity: 2,
    description:
      "Classic double-six dominoes. Match tiles, empty your hand, and score your opponents' remaining pips.",
    hasHiddenInformation: true,
  },

  createState() {
    return new DominosState();
  },

  turnConfig: {
    mode: "sequential",
    turnOrder: { type: "round-robin" },
    allowPass: true,
  },
  chessClockConfig: {
    enabled: true,
    initialTimeBankMs: 480_000,
  },

  lifecycle: {
    onGameStart(state) {
      const allTiles = shuffle(generateTileSet());
      const activePlayers = getActivePlayers(state);
      const dealCount = tilesPerPlayer(activePlayers.length);

      // Deal tiles to each player (server-side only)
      const hands = getPlayerHands(state);
      let cursor = 0;
      for (const sessionId of activePlayers) {
        const ps = new DominosPlayerState();
        const hand: RawTile[] = [];
        for (let i = 0; i < dealCount; i += 1) {
          hand.push(allTiles[cursor]);
          cursor += 1;
        }
        ps.handCount = hand.length;
        state.playerStates.set(sessionId, ps);
        hands.set(sessionId, hand);
      }

      // Remaining tiles become the boneyard
      setBoneyard(state, allTiles.slice(cursor));

      // Determine who starts
      const startingPlayer = determineStartingPlayer(hands);
      state.currentTurn = startingPlayer;
    },

    onPlayerJoin(state, client, playerIndex) {
      const existingPlayer = state.players.get(client.sessionId);
      const player = new PlayerInfo();
      player.sessionId = client.sessionId;
      player.displayName =
        existingPlayer?.displayName ?? `Player ${playerIndex + 1}`;
      player.playerIndex = playerIndex;
      player.isSpectator = existingPlayer?.isSpectator ?? false;
      player.isConnected = existingPlayer?.isConnected ?? true;
      player.controllerSessionId =
        existingPlayer?.controllerSessionId ?? "";
      state.players.set(client.sessionId, player);
    },

    onPlayerLeave(state, sessionId) {
      const player = state.players.get(sessionId);
      if (player) {
        player.isConnected = false;
      }
    },

    onGameEnd(state) {
      state.phase = "ended";
      clearBoneyard(state);
      clearPlayerHands(state);
    },
  },

  actions: {
    play(state, client, payload): ActionResult {
      if (!isPlayPayload(payload)) {
        return { success: false, error: "Invalid play payload." };
      }

      const playerState = state.playerStates.get(client.sessionId);
      if (!playerState) {
        return { success: false, error: "Player not found." };
      }

      // Find tile in server-side hand
      const hand = getPlayerHand(state, client.sessionId);
      const raw = hand.find((t) => t.id === payload.tileId);
      if (!raw) {
        return { success: false, error: "Tile not in hand." };
      }

      // Validate the tile can go on the chosen end
      if (!canPlayTile(raw, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) {
        return { success: false, error: "Tile does not match any open end." };
      }

      const validEnds = getValidEnds(raw, state.openEndA, state.openEndB, state.openEndC, state.openEndD);
      if (!validEnds.includes(payload.end)) {
        return { success: false, error: "Tile cannot be played on that end." };
      }

      // Apply
      if (!placeTileOnBoard(state, raw, payload.end)) {
        return { success: false, error: "Failed to place tile." };
      }

      removeTileFromHand(hand, payload.tileId);
      setPlayerHand(state, client.sessionId, hand);
      resetPassFlags(state);

      // Check if player emptied their hand → domino!
      if (hand.length === 0) {
        const allHands = getPlayerHands(state);
        const scores = scoreDomino(state, client.sessionId, allHands);
        buildScoreResult(state, client.sessionId, scores);
        return { success: true, endsTurn: true, endsGame: true };
      }

      return { success: true, endsTurn: true };
    },

    draw(state, client, _payload: unknown): ActionResult {
      const playerState = state.playerStates.get(client.sessionId);
      if (!playerState) {
        return { success: false, error: "Player not found." };
      }

      const hand = getPlayerHand(state, client.sessionId);
      if (hasPlayableTile(hand, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) {
        return {
          success: false,
          error: "You have a playable tile. You must play it.",
        };
      }

      const boneyard = getBoneyard(state);
      if (boneyard.length === 0) {
        return {
          success: false,
          error: "Boneyard is empty. You must pass.",
        };
      }

      // Draw one tile
      const drawn = boneyard.pop()!;
      setBoneyard(state, boneyard);
      hand.push(drawn);
      setPlayerHand(state, client.sessionId, hand);

      // If the drawn tile is playable, the player still has their turn
      // If not, they keep drawing (client sends another draw) or pass
      // Either way, the turn does NOT end on a draw
      return { success: true, endsTurn: false };
    },

    pass(state, client, _payload: unknown): ActionResult {
      const playerState = state.playerStates.get(client.sessionId);
      if (!playerState) {
        return { success: false, error: "Player not found." };
      }

      const hand = getPlayerHand(state, client.sessionId);
      if (hasPlayableTile(hand, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) {
        return {
          success: false,
          error: "You have a playable tile. You must play it.",
        };
      }

      const boneyard = getBoneyard(state);
      if (boneyard.length > 0) {
        return {
          success: false,
          error: "Boneyard still has tiles. You must draw.",
        };
      }

      playerState.passed = true;

      // Check if round is now blocked
      const allHands = getPlayerHands(state);
      if (isRoundBlocked(state, boneyard, allHands)) {
        const { winnerId, scores } = resolveBlockedRound(state, allHands);
        buildScoreResult(state, winnerId, scores);
        return { success: true, endsTurn: true, endsGame: true };
      }

      return { success: true, endsTurn: true };
    },
  },

  conditions: {
    checkGameEnd(state): GameResult | null {
      const allHands = getPlayerHands(state);

      // Check domino (empty hand)
      for (const sessionId of state.playerStates.keys()) {
        const hand = allHands.get(sessionId) ?? [];
        if (hand.length === 0) {
          const scores = scoreDomino(state, sessionId, allHands);
          const playerStats: Record<string, unknown> = {};
          for (const [sid, ps] of state.playerStates.entries()) {
            playerStats[sid] = {
              tilesRemaining: (allHands.get(sid) ?? []).length,
              score: ps.score,
            };
          }
          return {
            type: "win",
            winnerId: sessionId,
            scores,
            metadata: {
              tilesPlayed: state.board.length,
              ...playerStats,
            },
          };
        }
      }

      // Check blocked round
      const boneyard = getBoneyard(state);
      if (isRoundBlocked(state, boneyard, allHands)) {
        const { winnerId, scores } = resolveBlockedRound(state, allHands);
        const playerStats: Record<string, unknown> = {};
        for (const [sid, ps] of state.playerStates.entries()) {
          playerStats[sid] = {
            tilesRemaining: (allHands.get(sid) ?? []).length,
            score: ps.score,
          };
        }
        return {
          type: "win",
          winnerId,
          scores,
          metadata: {
            tilesPlayed: state.board.length,
            ...playerStats,
          },
        };
      }

      return null;
    },

    validateAction(state, client, actionType, payload): boolean {
      if (state.currentTurn !== client.sessionId) return false;

      const playerState = state.playerStates.get(client.sessionId);
      if (!playerState) return false;

      const hand = getPlayerHand(state, client.sessionId);

      if (actionType === "play") {
        if (!isPlayPayload(payload)) return false;
        const tile = hand.find((t) => t.id === payload.tileId);
        if (!tile) return false;
        if (!canPlayTile(tile, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) return false;
        const validEnds = getValidEnds(
          tile,
          state.openEndA,
          state.openEndB,
          state.openEndC,
          state.openEndD,
        );
        return validEnds.includes(payload.end);
      }

      if (actionType === "draw") {
        if (hasPlayableTile(hand, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) return false;
        const boneyard = getBoneyard(state);
        return boneyard.length > 0;
      }

      if (actionType === "pass") {
        if (hasPlayableTile(hand, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) return false;
        const boneyard = getBoneyard(state);
        return boneyard.length === 0;
      }

      return false;
    },
  },

  formatMoveHistory(state, moves) {
    return formatMoveEntries(state, moves);
  },

  stateFilter: {
    filterForClient(
      state: DominosState,
      _sessionId: string | null,
      _isSpectator: boolean,
    ): Partial<DominosState> {
      // Hands are no longer in the schema — nothing to filter.
      // Board, scores, openEnds, handCounts are all public.
      return state;
    },

    getPlayerMessage(state: DominosState, sessionId: string): unknown {
      if (!state.playerStates.has(sessionId)) return null;
      const hand = getPlayerHand(state, sessionId);
      return { type: "hand", tiles: hand };
    },
  },
};

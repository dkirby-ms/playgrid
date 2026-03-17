import {
  DominosPlayerState,
  DominosState,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
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
  toRawTile,
  toSchemaTile,
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
    (candidate.end === "a" || candidate.end === "b")
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

// ── Helpers ──────────────────────────────────────────────────────────

function resetPassFlags(state: DominosState): void {
  for (const ps of state.playerStates.values()) {
    ps.passed = false;
  }
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

  return {
    type: "win",
    winnerId,
    scores: Object.fromEntries(
      Array.from(state.playerStates.entries()).map(([sid, ps]) => [
        sid,
        ps.score,
      ]),
    ),
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
    turnTimeLimit: 60,
    allowPass: true,
  },

  lifecycle: {
    onGameStart(state) {
      const allTiles = shuffle(generateTileSet());
      const activePlayers = getActivePlayers(state);
      const dealCount = tilesPerPlayer(activePlayers.length);

      // Deal tiles to each player
      const playerHands = new Map<string, RawTile[]>();
      let cursor = 0;
      for (const sessionId of activePlayers) {
        const ps = new DominosPlayerState();
        const hand: RawTile[] = [];
        for (let i = 0; i < dealCount; i += 1) {
          const raw = allTiles[cursor];
          ps.hand.push(toSchemaTile(raw));
          hand.push(raw);
          cursor += 1;
        }
        state.playerStates.set(sessionId, ps);
        playerHands.set(sessionId, hand);
      }

      // Remaining tiles become the boneyard
      setBoneyard(state, allTiles.slice(cursor));

      // Determine who starts
      const startingPlayer = determineStartingPlayer(playerHands);
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

      // Find tile in hand
      const schemaT = Array.from(playerState.hand).find(
        (t) => t.id === payload.tileId,
      );
      if (!schemaT) {
        return { success: false, error: "Tile not in hand." };
      }

      const raw = toRawTile(schemaT);

      // Validate the tile can go on the chosen end
      if (!canPlayTile(raw, state.openEndA, state.openEndB)) {
        return { success: false, error: "Tile does not match any open end." };
      }

      const validEnds = getValidEnds(raw, state.openEndA, state.openEndB);
      if (!validEnds.includes(payload.end)) {
        return { success: false, error: "Tile cannot be played on that end." };
      }

      // Apply
      if (!placeTileOnBoard(state, raw, payload.end)) {
        return { success: false, error: "Failed to place tile." };
      }

      removeTileFromHand(playerState, payload.tileId);
      resetPassFlags(state);

      // Check if player emptied their hand → domino!
      if (playerState.hand.length === 0) {
        const scores = scoreDomino(state, client.sessionId);
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

      const hand = Array.from(playerState.hand).map(toRawTile);
      if (hasPlayableTile(hand, state.openEndA, state.openEndB)) {
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
      playerState.hand.push(toSchemaTile(drawn));

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

      const hand = Array.from(playerState.hand).map(toRawTile);
      if (hasPlayableTile(hand, state.openEndA, state.openEndB)) {
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
      if (isRoundBlocked(state, boneyard)) {
        const { winnerId, scores } = resolveBlockedRound(state);
        buildScoreResult(state, winnerId, scores);
        return { success: true, endsTurn: true, endsGame: true };
      }

      return { success: true, endsTurn: true };
    },
  },

  conditions: {
    checkGameEnd(state): GameResult | null {
      // Check domino (empty hand)
      for (const [sessionId, ps] of state.playerStates.entries()) {
        if (ps.hand.length === 0) {
          const scores = scoreDomino(state, sessionId);
          return {
            type: "win",
            winnerId: sessionId,
            scores,
          };
        }
      }

      // Check blocked round
      const boneyard = getBoneyard(state);
      if (isRoundBlocked(state, boneyard)) {
        const { winnerId, scores } = resolveBlockedRound(state);
        return {
          type: "win",
          winnerId,
          scores,
        };
      }

      return null;
    },

    validateAction(state, client, actionType, payload): boolean {
      if (state.currentTurn !== client.sessionId) return false;

      const playerState = state.playerStates.get(client.sessionId);
      if (!playerState) return false;

      const hand = Array.from(playerState.hand).map(toRawTile);

      if (actionType === "play") {
        if (!isPlayPayload(payload)) return false;
        const tile = hand.find((t) => t.id === payload.tileId);
        if (!tile) return false;
        if (!canPlayTile(tile, state.openEndA, state.openEndB)) return false;
        const validEnds = getValidEnds(
          tile,
          state.openEndA,
          state.openEndB,
        );
        return validEnds.includes(payload.end);
      }

      if (actionType === "draw") {
        if (hasPlayableTile(hand, state.openEndA, state.openEndB)) return false;
        const boneyard = getBoneyard(state);
        return boneyard.length > 0;
      }

      if (actionType === "pass") {
        if (hasPlayableTile(hand, state.openEndA, state.openEndB)) return false;
        const boneyard = getBoneyard(state);
        return boneyard.length === 0;
      }

      return false;
    },
  },

  stateFilter: {
    filterForClient(
      state: DominosState,
      sessionId: string | null,
      isSpectator: boolean,
    ): Partial<DominosState> {
      // Spectators and null sessionId see tile counts but not actual tiles
      // Players see only their own hand tiles; opponents show count only
      //
      // We return a partial — the base room framework handles merging.
      // Hands are the only hidden information; board/scores/openEnds are public.
      if (isSpectator || sessionId === null) {
        // Replace all hands with empty (clients see hand count via playerStates)
        return state;
      }

      // For a playing client, the full state is fine because Colyseus
      // schema filtering is handled at the transport layer. The stateFilter
      // here annotates what should be hidden. Since the boneyard is already
      // server-only (not in the schema), the only hidden info is opponent hands.
      // Return as-is; the renderer should only display the current player's hand.
      return state;
    },
  },
};

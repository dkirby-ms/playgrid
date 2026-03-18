import {
  BoardTile,
  DominoTile,
  DominosState,
} from "@eschaton/shared";

// ── Tile generation ──────────────────────────────────────────────────

export interface RawTile {
  id: number;
  highPips: number;
  lowPips: number;
}

/**
 * Generate the standard double-six domino set (28 tiles).
 * Each tile has lowPips ≤ highPips.
 */
export function generateTileSet(): RawTile[] {
  const tiles: RawTile[] = [];
  let id = 0;
  for (let high = 0; high <= 6; high += 1) {
    for (let low = 0; low <= high; low += 1) {
      tiles.push({ id, highPips: high, lowPips: low });
      id += 1;
    }
  }
  return tiles;
}

/**
 * Shuffle an array in place using Fisher-Yates.
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Determine how many tiles each player is dealt based on player count.
 */
export function tilesPerPlayer(playerCount: number): number {
  return playerCount <= 2 ? 7 : 5;
}

// ── Tile matching ────────────────────────────────────────────────────

export function isDouble(tile: RawTile): boolean {
  return tile.highPips === tile.lowPips;
}

export function pipTotal(tile: RawTile): number {
  return tile.highPips + tile.lowPips;
}

/**
 * Check whether a tile can be placed on a given open-end value.
 */
export function tileMatchesEnd(tile: RawTile, endValue: number): boolean {
  return tile.highPips === endValue || tile.lowPips === endValue;
}

/**
 * Check whether a tile can be played anywhere on the current board.
 * C/D ends are optional and default to -1 (inactive).
 */
export function canPlayTile(
  tile: RawTile,
  openEndA: number,
  openEndB: number,
  openEndC: number = -1,
  openEndD: number = -1,
): boolean {
  if (openEndA === -1) return true; // empty board, anything goes
  if (tileMatchesEnd(tile, openEndA)) return true;
  if (openEndA !== openEndB && tileMatchesEnd(tile, openEndB)) return true;
  if (openEndC >= 0 && tileMatchesEnd(tile, openEndC)) return true;
  if (openEndD >= 0 && tileMatchesEnd(tile, openEndD)) return true;
  return false;
}

/**
 * Check whether a player has any playable tile.
 */
export function hasPlayableTile(
  hand: RawTile[],
  openEndA: number,
  openEndB: number,
  openEndC: number = -1,
  openEndD: number = -1,
): boolean {
  return hand.some((tile) => canPlayTile(tile, openEndA, openEndB, openEndC, openEndD));
}

// ── Play resolution ──────────────────────────────────────────────────

export type PlayEnd = "a" | "b" | "c" | "d";

export interface PlayResult {
  /** The new exposed end value after this tile is placed */
  newEndValue: number;
}

/**
 * Determine the new exposed end value after placing a tile on the specified end.
 * The matching pip connects to the chain; the other pip becomes the new open end.
 */
export function resolvePlay(tile: RawTile, endValue: number): PlayResult {
  if (tile.highPips === endValue) {
    return { newEndValue: tile.lowPips };
  }
  return { newEndValue: tile.highPips };
}

// ── Starting player ──────────────────────────────────────────────────

/**
 * Determine which player starts. The player holding the highest double
 * goes first. If nobody holds a double, pick the player with the highest
 * pip-total tile. Returns the sessionId.
 */
export function determineStartingPlayer(
  playerHands: Map<string, RawTile[]>,
): string {
  let bestDouble = -1;
  let doubleHolder = "";

  for (const [sessionId, hand] of playerHands) {
    for (const tile of hand) {
      if (isDouble(tile) && tile.highPips > bestDouble) {
        bestDouble = tile.highPips;
        doubleHolder = sessionId;
      }
    }
  }

  if (doubleHolder !== "") return doubleHolder;

  let highestPip = -1;
  let highPipHolder = "";
  for (const [sessionId, hand] of playerHands) {
    for (const tile of hand) {
      if (pipTotal(tile) > highestPip) {
        highestPip = pipTotal(tile);
        highPipHolder = sessionId;
      }
    }
  }

  return highPipHolder;
}

// ── Scoring ──────────────────────────────────────────────────────────

/**
 * Sum pip counts across a hand.
 */
export function handPipTotal(hand: RawTile[]): number {
  return hand.reduce((sum, tile) => sum + pipTotal(tile), 0);
}

// ── State mutation helpers ───────────────────────────────────────────

export function toRawTile(tile: DominoTile): RawTile {
  return { id: tile.id, highPips: tile.highPips, lowPips: tile.lowPips };
}

export function toSchemaTile(raw: RawTile): DominoTile {
  const tile = new DominoTile();
  tile.id = raw.id;
  tile.highPips = raw.highPips;
  tile.lowPips = raw.lowPips;
  return tile;
}

function toBoardTile(raw: RawTile, exposedEnd: number, arm: string = "", tileIsDouble?: boolean): BoardTile {
  const bt = new BoardTile();
  bt.id = raw.id;
  bt.highPips = raw.highPips;
  bt.lowPips = raw.lowPips;
  bt.exposedEnd = exposedEnd;
  bt.arm = arm;
  bt.isDouble = tileIsDouble ?? (raw.highPips === raw.lowPips);
  return bt;
}

/**
 * Place a tile on the board, updating open ends and spinner tracking.
 * Returns true on success.
 */
export function placeTileOnBoard(
  state: DominosState,
  raw: RawTile,
  end: PlayEnd,
): boolean {
  const tileIsDouble = raw.highPips === raw.lowPips;

  // ── First tile on an empty board ──
  if (state.openEndA === -1) {
    if (tileIsDouble) {
      // First tile is a double → immediate spinner
      state.openEndA = raw.highPips;
      state.openEndB = raw.highPips;
      state.spinnerTileId = raw.id;
      // C/D activate once both A and B arms have ≥1 tile
      state.board.push(toBoardTile(raw, -1, "spinner"));
    } else {
      // First tile is not a double → pre-spinner linear
      state.openEndA = raw.lowPips;
      state.openEndB = raw.highPips;
      state.board.push(toBoardTile(raw, -1, ""));
    }
    state.lastPlayedTileId = raw.id;
    state.lastPlayedEnd = "";
    return true;
  }

  // ── Playing on end C or D (perpendicular spinner arms) ──
  if (end === "c" || end === "d") {
    const endValue = end === "c" ? state.openEndC : state.openEndD;
    if (endValue < 0 || !tileMatchesEnd(raw, endValue)) return false;

    const result = resolvePlay(raw, endValue);
    if (end === "c") {
      state.openEndC = result.newEndValue;
    } else {
      state.openEndD = result.newEndValue;
    }

    state.board.push(toBoardTile(raw, result.newEndValue, end));
    state.lastPlayedTileId = raw.id;
    state.lastPlayedEnd = end;
    return true;
  }

  // ── Playing on end A or B ──
  const endValue = end === "a" ? state.openEndA : state.openEndB;
  if (!tileMatchesEnd(raw, endValue)) return false;

  const result = resolvePlay(raw, endValue);

  if (end === "a") {
    state.openEndA = result.newEndValue;
  } else {
    state.openEndB = result.newEndValue;
  }

  // Determine if this double becomes the spinner
  const becomesSpinner = tileIsDouble && state.spinnerTileId === -1;

  if (state.spinnerTileId === -1 && !becomesSpinner) {
    // Pre-spinner linear play
    state.board.push(toBoardTile(raw, result.newEndValue, ""));
  } else if (becomesSpinner) {
    // This double becomes the spinner mid-chain
    const spinnerBt = toBoardTile(raw, result.newEndValue, "spinner");
    state.board.push(spinnerBt);
    state.spinnerTileId = raw.id;

    // Retroactively assign arms to existing tiles
    const spinnerIdx = state.board.length - 1;
    let armACount = 0;
    let armBCount = 0;
    for (let i = 0; i < state.board.length; i++) {
      if (i < spinnerIdx) {
        state.board[i].arm = "a";
        armACount++;
      } else if (i > spinnerIdx) {
        state.board[i].arm = "b";
        armBCount++;
      }
    }
    state.armACount = armACount;
    state.armBCount = armBCount;

    // Activate C/D if both arms already have tiles
    if (armACount >= 1 && armBCount >= 1 && state.openEndC === -1) {
      state.openEndC = raw.highPips;
      state.openEndD = raw.highPips;
    }
  } else {
    // Post-spinner play on arm A or B
    state.board.push(toBoardTile(raw, result.newEndValue, end));
    if (end === "a") {
      state.armACount++;
    } else {
      state.armBCount++;
    }

    // Activate C/D once both arms have ≥1 tile
    if (state.armACount >= 1 && state.armBCount >= 1 && state.openEndC === -1) {
      // Find the spinner's pip value
      const spinnerBt = findBoardTileById(state, state.spinnerTileId);
      if (spinnerBt) {
        state.openEndC = spinnerBt.highPips;
        state.openEndD = spinnerBt.highPips;
      }
    }
  }

  state.lastPlayedTileId = raw.id;
  state.lastPlayedEnd = end;
  return true;
}

/** Find a BoardTile in state.board by tile id. */
function findBoardTileById(state: DominosState, tileId: number): BoardTile | undefined {
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i].id === tileId) return state.board[i];
  }
  return undefined;
}

/**
 * Remove a tile from a server-side hand by tile id.
 * Mutates the array in place and returns the removed tile, or null.
 */
export function removeTileFromHand(
  hand: RawTile[],
  tileId: number,
): RawTile | null {
  const index = hand.findIndex((t) => t.id === tileId);
  if (index === -1) return null;
  return hand.splice(index, 1)[0];
}

/**
 * Determine the valid end(s) a tile can be played on.
 */
export function getValidEnds(
  tile: RawTile,
  openEndA: number,
  openEndB: number,
  openEndC: number = -1,
  openEndD: number = -1,
): PlayEnd[] {
  if (openEndA === -1) return ["a"]; // empty board

  const ends: PlayEnd[] = [];
  if (tileMatchesEnd(tile, openEndA)) ends.push("a");
  if (tileMatchesEnd(tile, openEndB) && (openEndA !== openEndB || !ends.includes("a"))) {
    ends.push("b");
  }
  // When A and B have the same value, both are valid distinct play targets
  if (openEndA === openEndB && tileMatchesEnd(tile, openEndA) && !ends.includes("b")) {
    ends.push("b");
  }
  if (openEndC >= 0 && tileMatchesEnd(tile, openEndC)) ends.push("c");
  if (openEndD >= 0 && tileMatchesEnd(tile, openEndD)) ends.push("d");
  return ends;
}

/**
 * Check whether the round is blocked (no player can move and boneyard is empty).
 */
export function isRoundBlocked(
  state: DominosState,
  boneyard: RawTile[],
  playerHands: Map<string, RawTile[]>,
): boolean {
  if (boneyard.length > 0) return false;

  for (const sessionId of state.playerStates.keys()) {
    const hand = playerHands.get(sessionId) ?? [];
    if (hasPlayableTile(hand, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) return false;
  }

  return true;
}

/**
 * Determine the winner when a round ends by block.
 * The player with the lowest remaining pip total wins.
 * Returns [winnerId, scores].
 */
export function resolveBlockedRound(
  state: DominosState,
  playerHands: Map<string, RawTile[]>,
): { winnerId: string; scores: Record<string, number> } {
  let lowestTotal = Infinity;
  let winnerId = "";
  const totals: Record<string, number> = {};

  for (const sessionId of state.playerStates.keys()) {
    const hand = playerHands.get(sessionId) ?? [];
    const total = handPipTotal(hand);
    totals[sessionId] = total;
    if (total < lowestTotal) {
      lowestTotal = total;
      winnerId = sessionId;
    }
  }

  // Winner scores the sum of all opponents' pip totals
  let winnerScore = 0;
  for (const [sessionId, total] of Object.entries(totals)) {
    if (sessionId !== winnerId) {
      winnerScore += total;
    }
  }

  const scores: Record<string, number> = {};
  for (const sessionId of Object.keys(totals)) {
    scores[sessionId] = sessionId === winnerId ? winnerScore : 0;
  }

  return { winnerId, scores };
}

/**
 * Score when a player empties their hand ("domino").
 * They get the sum of all opponents' remaining pip totals.
 */
export function scoreDomino(
  state: DominosState,
  winnerId: string,
  playerHands: Map<string, RawTile[]>,
): Record<string, number> {
  let winnerScore = 0;
  const scores: Record<string, number> = {};

  for (const sessionId of state.playerStates.keys()) {
    if (sessionId !== winnerId) {
      const hand = playerHands.get(sessionId) ?? [];
      const total = handPipTotal(hand);
      winnerScore += total;
      scores[sessionId] = 0;
    }
  }

  scores[winnerId] = winnerScore;
  return scores;
}

/**
 * Get all non-spectator session IDs sorted by playerIndex.
 */
export function getActivePlayers(state: DominosState): string[] {
  return Array.from(state.players.values())
    .filter((p) => !p.isSpectator)
    .sort((a, b) => a.playerIndex - b.playerIndex)
    .map((p) => p.sessionId);
}

/**
 * Find the next player in turn order after the given sessionId.
 */
export function getNextPlayer(
  state: DominosState,
  currentSessionId: string,
): string {
  const activePlayers = getActivePlayers(state);
  const currentIndex = activePlayers.indexOf(currentSessionId);
  return activePlayers[(currentIndex + 1) % activePlayers.length];
}

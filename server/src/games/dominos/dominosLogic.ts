import {
  BoardTile,
  DominoTile,
  DominosPlayerState,
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
 */
export function canPlayTile(
  tile: RawTile,
  openEndA: number,
  openEndB: number,
): boolean {
  if (openEndA === -1) return true; // empty board, anything goes
  if (tileMatchesEnd(tile, openEndA)) return true;
  if (openEndA !== openEndB && tileMatchesEnd(tile, openEndB)) return true;
  return false;
}

/**
 * Check whether a player has any playable tile.
 */
export function hasPlayableTile(
  hand: RawTile[],
  openEndA: number,
  openEndB: number,
): boolean {
  return hand.some((tile) => canPlayTile(tile, openEndA, openEndB));
}

// ── Play resolution ──────────────────────────────────────────────────

export type PlayEnd = "a" | "b";

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

function toBoardTile(raw: RawTile, exposedEnd: number): BoardTile {
  const bt = new BoardTile();
  bt.id = raw.id;
  bt.highPips = raw.highPips;
  bt.lowPips = raw.lowPips;
  bt.exposedEnd = exposedEnd;
  return bt;
}

/**
 * Place a tile on the board, updating open ends.
 * Returns true on success.
 */
export function placeTileOnBoard(
  state: DominosState,
  raw: RawTile,
  end: PlayEnd,
): boolean {
  // First tile on an empty board
  if (state.openEndA === -1) {
    state.openEndA = raw.lowPips;
    state.openEndB = raw.highPips;
    state.board.push(toBoardTile(raw, -1));
    state.lastPlayedTileId = raw.id;
    state.lastPlayedEnd = "";
    return true;
  }

  const endValue = end === "a" ? state.openEndA : state.openEndB;
  if (!tileMatchesEnd(raw, endValue)) return false;

  const result = resolvePlay(raw, endValue);

  if (end === "a") {
    state.openEndA = result.newEndValue;
  } else {
    state.openEndB = result.newEndValue;
  }

  state.board.push(toBoardTile(raw, result.newEndValue));
  state.lastPlayedTileId = raw.id;
  state.lastPlayedEnd = end;
  return true;
}

/**
 * Remove a tile from a player's hand by tile id.
 */
export function removeTileFromHand(
  playerState: DominosPlayerState,
  tileId: number,
): DominoTile | null {
  const index = Array.from(playerState.hand).findIndex((t) => t.id === tileId);
  if (index === -1) return null;
  const removed = playerState.hand[index];
  playerState.hand.splice(index, 1);
  return removed;
}

/**
 * Determine the valid end(s) a tile can be played on.
 */
export function getValidEnds(
  tile: RawTile,
  openEndA: number,
  openEndB: number,
): PlayEnd[] {
  if (openEndA === -1) return ["a"]; // empty board

  const ends: PlayEnd[] = [];
  if (tileMatchesEnd(tile, openEndA)) ends.push("a");
  if (openEndA !== openEndB && tileMatchesEnd(tile, openEndB)) ends.push("b");
  // If both ends have the same value, only return "a" to avoid duplicates
  if (openEndA === openEndB && tileMatchesEnd(tile, openEndA)) ends.push("a");
  return ends;
}

/**
 * Check whether the round is blocked (no player can move and boneyard is empty).
 */
export function isRoundBlocked(
  state: DominosState,
  boneyard: RawTile[],
): boolean {
  if (boneyard.length > 0) return false;

  for (const ps of state.playerStates.values()) {
    const hand = Array.from(ps.hand).map(toRawTile);
    if (hasPlayableTile(hand, state.openEndA, state.openEndB)) return false;
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
): { winnerId: string; scores: Record<string, number> } {
  let lowestTotal = Infinity;
  let winnerId = "";
  const totals: Record<string, number> = {};

  for (const [sessionId, ps] of state.playerStates.entries()) {
    const total = handPipTotal(Array.from(ps.hand).map(toRawTile));
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
): Record<string, number> {
  let winnerScore = 0;
  const scores: Record<string, number> = {};

  for (const [sessionId, ps] of state.playerStates.entries()) {
    if (sessionId !== winnerId) {
      const total = handPipTotal(Array.from(ps.hand).map(toRawTile));
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

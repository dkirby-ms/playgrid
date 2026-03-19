import { type DominosState } from "@eschaton/shared";
import {
  canPlayTile,
  getValidEnds,
  hasPlayableTile,
  isDouble,
  pipTotal,
  tileMatchesEnd,
  type PlayEnd,
  type RawTile,
} from "./dominosLogic.js";
import { getPlayerHand } from "./DominosPlugin.js";

// ── Scoring weights ──────────────────────────────────────────────────

const DOUBLE_BONUS = 200;
const HIGH_PIP_WEIGHT = 10;
const FLEXIBILITY_WEIGHT = 50;

// ── Types ────────────────────────────────────────────────────────────

export type CpuAction =
  | { actionType: "play"; payload: { tileId: number; end: PlayEnd } }
  | { actionType: "draw" }
  | { actionType: "pass" };

interface ScoredPlay {
  tile: RawTile;
  end: PlayEnd;
  score: number;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Select the next CPU action for a Dominos turn.
 *
 * Decision tree:
 *  1. If the CPU has a playable tile → pick the best one (play).
 *  2. If no playable tile and boneyard has tiles → draw.
 *  3. If no playable tile and boneyard is empty → pass.
 */
export function selectCpuAction(state: DominosState): CpuAction | null {
  const currentPlayer = state.players.get(state.currentTurn);
  if (!currentPlayer) return null;

  const hand = getPlayerHand(state, currentPlayer.sessionId);
  if (hand.length === 0) return null;

  if (hasPlayableTile(hand, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) {
    const best = pickBestPlay(hand, state);
    if (best) {
      return { actionType: "play", payload: { tileId: best.tile.id, end: best.end } };
    }
  }

  if (state.boneyardCount > 0) {
    return { actionType: "draw" };
  }

  return { actionType: "pass" };
}

// ── Move selection ───────────────────────────────────────────────────

function pickBestPlay(hand: RawTile[], state: DominosState): ScoredPlay | null {
  const candidates: ScoredPlay[] = [];

  for (const tile of hand) {
    if (!canPlayTile(tile, state.openEndA, state.openEndB, state.openEndC, state.openEndD)) {
      continue;
    }

    const validEnds = getValidEnds(tile, state.openEndA, state.openEndB, state.openEndC, state.openEndD);
    for (const end of validEnds) {
      candidates.push({
        tile,
        end,
        score: scorePlay(tile, end, hand, state),
      });
    }
  }

  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.score > best.score || (candidate.score === best.score && breaksTie(candidate, best))) {
      best = candidate;
    }
  }

  return best;
}

// ── Scoring heuristics ───────────────────────────────────────────────

function scorePlay(
  tile: RawTile,
  end: PlayEnd,
  hand: RawTile[],
  state: DominosState,
): number {
  let score = 0;

  // 1. Prefer doubles — they maintain tempo and set up the spinner
  if (isDouble(tile)) {
    score += DOUBLE_BONUS;
  }

  // 2. Prefer higher-pip tiles — shed heavy tiles early to reduce blocked-round risk
  score += pipTotal(tile) * HIGH_PIP_WEIGHT;

  // 3. Prefer plays that keep our options open
  //    Count how many remaining hand tiles match the new open end after this play
  score += flexibilityScore(tile, end, hand, state) * FLEXIBILITY_WEIGHT;

  return score;
}

/**
 * Estimate how many remaining hand tiles could match the new open end
 * created by placing `tile` on `end`.
 */
function flexibilityScore(
  tile: RawTile,
  end: PlayEnd,
  hand: RawTile[],
  state: DominosState,
): number {
  const newEndValue = getNewOpenEndValue(tile, end, state);
  if (newEndValue < 0) return 0;

  let matches = 0;
  for (const other of hand) {
    if (other.id === tile.id) continue;
    if (tileMatchesEnd(other, newEndValue)) matches++;
  }

  return matches;
}

/**
 * Determine what the open-end pip value will be after placing `tile` on `end`.
 */
function getNewOpenEndValue(
  tile: RawTile,
  end: PlayEnd,
  state: DominosState,
): number {
  // First tile on an empty board
  if (state.openEndA === -1) {
    return isDouble(tile) ? tile.highPips : tile.highPips;
  }

  const endValue = getEndValue(end, state);
  if (endValue < 0) return -1;

  // The matching pip connects; the other pip becomes the new open end
  if (tile.highPips === endValue) return tile.lowPips;
  return tile.highPips;
}

function getEndValue(end: PlayEnd, state: DominosState): number {
  switch (end) {
    case "a": return state.openEndA;
    case "b": return state.openEndB;
    case "c": return state.openEndC;
    case "d": return state.openEndD;
  }
}

// ── Tie-breaking ─────────────────────────────────────────────────────

function breaksTie(candidate: ScoredPlay, incumbent: ScoredPlay): boolean {
  // Prefer higher pip total for determinism
  const candidatePips = pipTotal(candidate.tile);
  const incumbentPips = pipTotal(incumbent.tile);
  if (candidatePips !== incumbentPips) return candidatePips > incumbentPips;

  // Then prefer lower tile id
  return candidate.tile.id < incumbent.tile.id;
}

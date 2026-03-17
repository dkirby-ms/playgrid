import { type BackgammonState, BLACK, RED } from "@eschaton/shared";
import {
  canBearOff,
  getAvailableDice,
  getPlayerColor,
  isValidMove,
  type Move,
} from "./backgammonLogic.js";

const BOARD_SIZE = 24;

const BEAR_OFF_BONUS = 1_000;
const HIT_BONUS = 500;
const BAR_ENTRY_BONUS = 400;
const MAKE_POINT_BONUS = 300;
const PRIME_BONUS = 150;
const LEAVE_BLOT_PENALTY = -200;
const BREAK_POINT_PENALTY = -100;

type BackgammonColor = typeof BLACK | typeof RED;

function isBackgammonColor(value: number | null): value is BackgammonColor {
  return value === BLACK || value === RED;
}

export type CpuAction =
  | { actionType: "roll" }
  | { actionType: "move"; payload: { from: number | "bar"; to: number | "off"; die: number } }
  | { actionType: "pass" };

export function selectCpuAction(state: BackgammonState): CpuAction | null {
  const currentPlayer = state.players.get(state.currentTurn);
  if (!currentPlayer) {
    return null;
  }

  const rawColor = getPlayerColor(currentPlayer.playerIndex);
  if (!isBackgammonColor(rawColor)) {
    return null;
  }
  const playerColor = rawColor;

  const [die1, die2] = state.dice;
  if (die1 === 0 && die2 === 0) {
    return { actionType: "roll" };
  }

  const availableDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice), state.doublesMovesUsed);
  if (availableDice.length === 0) {
    return null;
  }

  const moves = getAllValidMoves(state, playerColor, availableDice);
  if (moves.length === 0) {
    return { actionType: "pass" };
  }

  let bestMove = moves[0];
  let bestScore = scoreMove(state, bestMove, playerColor);

  for (const move of moves.slice(1)) {
    const score = scoreMove(state, move, playerColor);
    if (score > bestScore || (score === bestScore && breaksTie(move, bestMove, playerColor))) {
      bestMove = move;
      bestScore = score;
    }
  }

  return {
    actionType: "move",
    payload: { from: bestMove.from, to: bestMove.to, die: bestMove.die },
  };
}

function getAllValidMoves(
  state: BackgammonState,
  playerColor: BackgammonColor,
  availableDice: number[],
): Move[] {
  const points = Array.from(state.points);
  const barCount = playerColor === BLACK ? state.blackBar : state.redBar;
  const uniqueDice = [...new Set(availableDice)];
  const moves: Move[] = [];

  if (barCount > 0) {
    for (const die of uniqueDice) {
      const entryPoint = playerColor === BLACK ? die - 1 : BOARD_SIZE - die;
      if (
        isValidMove(
          points,
          state.blackBar,
          state.redBar,
          state.blackBorneOff,
          state.redBorneOff,
          "bar",
          entryPoint,
          die,
          playerColor,
        )
      ) {
        moves.push({ from: "bar", to: entryPoint, die });
      }
    }
    return moves;
  }

  const bearingOff = canBearOff(points, barCount, playerColor);

  for (let fromPoint = 0; fromPoint < BOARD_SIZE; fromPoint++) {
    const pieces = points[fromPoint];
    if (playerColor === BLACK && pieces <= 0) continue;
    if (playerColor === RED && pieces >= 0) continue;

    for (const die of uniqueDice) {
      // Regular move
      const toPoint = playerColor === BLACK ? fromPoint + die : fromPoint - die;
      if (toPoint >= 0 && toPoint < BOARD_SIZE) {
        if (
          isValidMove(
            points,
            state.blackBar,
            state.redBar,
            state.blackBorneOff,
            state.redBorneOff,
            fromPoint,
            toPoint,
            die,
            playerColor,
          )
        ) {
          moves.push({ from: fromPoint, to: toPoint, die });
        }
      }

      // Bear off move
      if (bearingOff) {
        if (
          isValidMove(
            points,
            state.blackBar,
            state.redBar,
            state.blackBorneOff,
            state.redBorneOff,
            fromPoint,
            "off",
            die,
            playerColor,
          )
        ) {
          moves.push({ from: fromPoint, to: "off", die });
        }
      }
    }
  }

  return moves;
}

function scoreMove(
  state: BackgammonState,
  move: Move,
  playerColor: BackgammonColor,
): number {
  const points = Array.from(state.points);
  const blackBar = state.blackBar;
  const redBar = state.redBar;

  let score = 0;

  // Bearing off is highest priority
  if (move.to === "off") {
    score += BEAR_OFF_BONUS;
    return score;
  }

  // Entering from bar is important
  if (move.from === "bar") {
    score += BAR_ENTRY_BONUS;
  }

  const toPoint = move.to as number;
  const destPieces = points[toPoint];

  // Hitting an opponent's blot
  if (playerColor === BLACK && destPieces === -1) {
    score += HIT_BONUS;
  } else if (playerColor === RED && destPieces === 1) {
    score += HIT_BONUS;
  }

  // Making a point (landing where we already have 1 piece → 2 = a "made point")
  const ownPiecesAtDest = playerColor === BLACK ? destPieces : -destPieces;
  if (ownPiecesAtDest === 1) {
    score += MAKE_POINT_BONUS;

    // Bonus for extending a prime (consecutive made points)
    score += primeBonus(points, toPoint, playerColor);
  }

  // Penalize leaving a blot at the source
  if (move.from !== "bar") {
    const fromPoint = move.from as number;
    const sourcePieces = points[fromPoint];
    const ownSourceCount = playerColor === BLACK ? sourcePieces : -sourcePieces;
    if (ownSourceCount === 2) {
      // Moving away from a stack of 2 leaves a blot
      score += BREAK_POINT_PENALTY;
    }
  }

  // Penalize landing alone on an exposed point (no existing friendly pieces)
  if (ownPiecesAtDest === 0 && move.from !== "bar") {
    const isExposed = isPointExposed(points, toPoint, playerColor, blackBar, redBar);
    if (isExposed) {
      score += LEAVE_BLOT_PENALTY;
    }
  }

  // Advancement score — prefer moving toward home board
  score += advancementScore(move, playerColor);

  return score;
}

function advancementScore(move: Move, playerColor: BackgammonColor): number {
  if (move.from === "bar" || move.to === "off") {
    return 0;
  }

  const toPoint = move.to as number;

  // Black moves 0→23 (home is 18-23), Red moves 23→0 (home is 0-5)
  if (playerColor === BLACK) {
    return Math.floor(toPoint / 6);
  }
  return Math.floor((BOARD_SIZE - 1 - toPoint) / 6);
}

function primeBonus(
  points: number[],
  toPoint: number,
  playerColor: BackgammonColor,
): number {
  let consecutiveCount = 0;
  const direction = playerColor === BLACK ? -1 : 1;

  let checkPoint = toPoint + direction;
  while (checkPoint >= 0 && checkPoint < BOARD_SIZE) {
    const pieces = points[checkPoint];
    const ownPieces = playerColor === BLACK ? pieces : -pieces;
    if (ownPieces < 2) break;
    consecutiveCount++;
    checkPoint += direction;
  }

  return consecutiveCount * PRIME_BONUS;
}

function isPointExposed(
  points: number[],
  point: number,
  playerColor: BackgammonColor,
  blackBar: number,
  redBar: number,
): boolean {
  const opponentColor = playerColor === BLACK ? RED : BLACK;
  const opponentBar = opponentColor === BLACK ? blackBar : redBar;

  // Check if any opponent piece can reach this point within 6 (one die roll)
  for (let die = 1; die <= 6; die++) {
    const opponentFrom = opponentColor === BLACK ? point - die : point + die;

    if (opponentBar > 0) {
      const entryPoint = opponentColor === BLACK ? die - 1 : BOARD_SIZE - die;
      if (entryPoint === point) {
        return true;
      }
    }

    if (opponentFrom >= 0 && opponentFrom < BOARD_SIZE) {
      const pieces = points[opponentFrom];
      if (opponentColor === BLACK && pieces > 0) {
        return true;
      }
      if (opponentColor === RED && pieces < 0) {
        return true;
      }
    }
  }

  return false;
}

function breaksTie(
  candidate: Move,
  incumbent: Move,
  playerColor: BackgammonColor,
): boolean {
  // Prefer bearing off
  if (candidate.to === "off" && incumbent.to !== "off") return true;
  if (candidate.to !== "off" && incumbent.to === "off") return false;

  // Prefer bar entry
  if (candidate.from === "bar" && incumbent.from !== "bar") return true;
  if (candidate.from !== "bar" && incumbent.from === "bar") return false;

  // For regular moves, prefer the piece closest to home
  if (typeof candidate.from === "number" && typeof incumbent.from === "number") {
    if (playerColor === BLACK) {
      return candidate.from > incumbent.from;
    }
    return candidate.from < incumbent.from;
  }

  return false;
}

import {
  BLACK,
  BLACK_KING,
  RED,
  RED_KING,
  type CheckersState,
} from "@eschaton/shared";
import { applyMove, getAllMovesForPlayer, type Move } from "./checkersLogic.js";

const BOARD_WIDTH = 8;
const CAPTURE_PRIORITY = 1_000;
const PROMOTION_PRIORITY = 100;

type CheckersColor = typeof BLACK | typeof RED;

type CpuMove = {
  from: number;
  to: number;
};

export function selectCpuMove(state: CheckersState): CpuMove | null {
  const currentPlayer = state.players.get(state.currentTurn);
  const playerColor = getPlayerColor(currentPlayer?.playerIndex ?? -1);
  if (playerColor === null) {
    return null;
  }

  const board = Array.from(state.board);
  const legalMoves = getAllMovesForPlayer(board, playerColor, state.mustCaptureFrom);
  if (legalMoves.length === 0) {
    return null;
  }

  let bestMove = legalMoves[0];
  let bestScore = scoreMove(board, bestMove, playerColor);

  for (const move of legalMoves.slice(1)) {
    const score = scoreMove(board, move, playerColor);
    if (score > bestScore || (score === bestScore && breaksTie(move, bestMove))) {
      bestMove = move;
      bestScore = score;
    }
  }

  return {
    from: bestMove.from,
    to: bestMove.to,
  };
}

function getPlayerColor(playerIndex: number): CheckersColor | null {
  if (playerIndex === 0) {
    return BLACK;
  }

  if (playerIndex === 1) {
    return RED;
  }

  return null;
}

function scoreMove(board: number[], move: Move, playerColor: CheckersColor): number {
  const piece = board[move.from];
  const moveResult = applyMove(board, move.from, move.to);

  let score = advancementScore(move.from, move.to, piece, playerColor);

  if (moveResult.captured !== null) {
    score += CAPTURE_PRIORITY;
  }

  if (moveResult.isKingPromotion) {
    score += PROMOTION_PRIORITY;
  }

  return score;
}

function advancementScore(
  _from: number,
  to: number,
  piece: number,
  playerColor: CheckersColor,
): number {
  if (playerColor === RED && piece !== RED) {
    return piece === RED_KING ? 0 : Number.NEGATIVE_INFINITY;
  }

  if (playerColor === BLACK && piece !== BLACK) {
    return piece === BLACK_KING ? 0 : Number.NEGATIVE_INFINITY;
  }

  const toRow = Math.floor(to / BOARD_WIDTH);

  if (piece === RED) {
    return BOARD_WIDTH - 1 - toRow;
  }

  if (piece === BLACK) {
    return toRow;
  }

  return 0;
}

function breaksTie(candidate: Move, incumbent: Move): boolean {
  if (candidate.from !== incumbent.from) {
    return candidate.from < incumbent.from;
  }

  return candidate.to < incumbent.to;
}

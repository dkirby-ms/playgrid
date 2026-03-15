import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED,
  RED_KING,
} from "@eschaton/playgrid-shared";

const BOARD_WIDTH = 8;
export const NO_FORCED_CAPTURE = -1;

const BLACK_DIRECTIONS = [
  [1, -1],
  [1, 1],
] as const;

const RED_DIRECTIONS = [
  [-1, -1],
  [-1, 1],
] as const;

const KING_DIRECTIONS = [
  ...BLACK_DIRECTIONS,
  ...RED_DIRECTIONS,
] as const;

export type CheckersColor = typeof BLACK | typeof RED;

export interface CheckersMove {
  from: number;
  to: number;
  captures?: number;
}

export function getPlayerColorFromPlayerIndex(playerIndex: number): CheckersColor | null {
  if (playerIndex === 0) {
    return BLACK;
  }

  if (playerIndex === 1) {
    return RED;
  }

  return null;
}

export function getPieceColor(piece: number): CheckersColor | null {
  if (piece === BLACK || piece === BLACK_KING) {
    return BLACK;
  }

  if (piece === RED || piece === RED_KING) {
    return RED;
  }

  return null;
}

export function getValidMoves(board: number[], cellIndex: number, mustCaptureFrom: number): CheckersMove[] {
  const piece = board[cellIndex];
  const playerColor = getPieceColor(piece);
  if (playerColor === null) {
    return [];
  }

  if (mustCaptureFrom !== NO_FORCED_CAPTURE) {
    if (cellIndex !== mustCaptureFrom) {
      return [];
    }

    return getCaptureMoves(board, cellIndex);
  }

  const captureMoves = getAllCaptureMovesForPlayer(board, playerColor);
  if (captureMoves.length > 0) {
    return getCaptureMoves(board, cellIndex);
  }

  return getSimpleMoves(board, cellIndex);
}

function getAllCaptureMovesForPlayer(board: number[], playerColor: CheckersColor): CheckersMove[] {
  const moves: CheckersMove[] = [];

  for (let index = 0; index < board.length; index += 1) {
    if (getPieceColor(board[index]) !== playerColor) {
      continue;
    }

    moves.push(...getCaptureMoves(board, index));
  }

  return moves;
}

function getCaptureMoves(board: number[], cellIndex: number): CheckersMove[] {
  const piece = board[cellIndex];
  const playerColor = getPieceColor(piece);
  if (playerColor === null) {
    return [];
  }

  const { row, col } = toPosition(cellIndex);
  const moves: CheckersMove[] = [];

  for (const [rowStep, colStep] of getDirections(piece)) {
    const jumpedRow = row + rowStep;
    const jumpedCol = col + colStep;
    const landingRow = row + (rowStep * 2);
    const landingCol = col + (colStep * 2);

    if (!isInBounds(jumpedRow, jumpedCol) || !isInBounds(landingRow, landingCol)) {
      continue;
    }

    const jumpedIndex = toIndex(jumpedRow, jumpedCol);
    const landingIndex = toIndex(landingRow, landingCol);
    if (!isOwnedByOpponent(board[jumpedIndex], playerColor) || board[landingIndex] !== EMPTY) {
      continue;
    }

    moves.push({
      from: cellIndex,
      to: landingIndex,
      captures: jumpedIndex,
    });
  }

  return moves;
}

function getSimpleMoves(board: number[], cellIndex: number): CheckersMove[] {
  const piece = board[cellIndex];
  if (getPieceColor(piece) === null) {
    return [];
  }

  const { row, col } = toPosition(cellIndex);
  const moves: CheckersMove[] = [];

  for (const [rowStep, colStep] of getDirections(piece)) {
    const nextRow = row + rowStep;
    const nextCol = col + colStep;
    if (!isInBounds(nextRow, nextCol)) {
      continue;
    }

    const nextIndex = toIndex(nextRow, nextCol);
    if (board[nextIndex] !== EMPTY) {
      continue;
    }

    moves.push({ from: cellIndex, to: nextIndex });
  }

  return moves;
}

function getDirections(piece: number) {
  if (piece === BLACK) {
    return BLACK_DIRECTIONS;
  }

  if (piece === RED) {
    return RED_DIRECTIONS;
  }

  if (piece === BLACK_KING || piece === RED_KING) {
    return KING_DIRECTIONS;
  }

  return [];
}

function isOwnedByOpponent(piece: number, playerColor: CheckersColor): boolean {
  const pieceColor = getPieceColor(piece);
  return pieceColor !== null && pieceColor !== playerColor;
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_WIDTH && col >= 0 && col < BOARD_WIDTH;
}

function toIndex(row: number, col: number): number {
  return (row * BOARD_WIDTH) + col;
}

function toPosition(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / BOARD_WIDTH),
    col: index % BOARD_WIDTH,
  };
}

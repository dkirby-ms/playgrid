import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED,
  RED_KING,
} from "@eschaton/playgrid-shared";

const BOARD_WIDTH = 8;
const NO_FORCED_CAPTURE = -1;

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

export interface Move {
  from: number;
  to: number;
  captures?: number;
}

export interface MoveResult {
  board: number[];
  captured: number | null;
  isKingPromotion: boolean;
  continuesChain: boolean;
}

export function initializeBoard(): number[] {
  const board = Array.from({ length: BOARD_WIDTH * BOARD_WIDTH }, () => EMPTY);

  for (let row = 0; row < BOARD_WIDTH; row += 1) {
    for (let col = 0; col < BOARD_WIDTH; col += 1) {
      if (!isDarkSquare(row, col)) {
        continue;
      }

      const index = toIndex(row, col);
      if (row <= 2) {
        board[index] = BLACK;
      } else if (row >= 5) {
        board[index] = RED;
      }
    }
  }

  return board;
}

export function getValidMoves(board: number[], cellIndex: number, mustCaptureFrom: number): Move[] {
  const piece = board[cellIndex];
  const playerColor = getPlayerColor(piece);
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

export function isValidMove(
  board: number[],
  from: number,
  to: number,
  currentPlayerColor: number,
  mustCaptureFrom: number,
): boolean {
  const playerColor = getPlayerColor(currentPlayerColor);
  if (playerColor === null || !isOwnedByPlayer(board[from], playerColor)) {
    return false;
  }

  return getValidMoves(board, from, mustCaptureFrom).some((move) => move.to === to);
}

export function applyMove(board: number[], from: number, to: number): MoveResult {
  const nextBoard = [...board];
  const piece = nextBoard[from];

  if (piece === EMPTY) {
    throw new Error("Cannot move an empty square.");
  }

  nextBoard[from] = EMPTY;

  let captured: number | null = null;
  const fromPosition = toPosition(from);
  const toPositionValue = toPosition(to);
  const rowDelta = toPositionValue.row - fromPosition.row;
  const colDelta = toPositionValue.col - fromPosition.col;

  if (Math.abs(rowDelta) === 2 && Math.abs(colDelta) === 2) {
    captured = toIndex(fromPosition.row + rowDelta / 2, fromPosition.col + colDelta / 2);
    nextBoard[captured] = EMPTY;
  }

  const promotedPiece = getPromotedPiece(piece, toPositionValue.row);
  const isKingPromotion = promotedPiece !== piece;
  nextBoard[to] = promotedPiece;

  const continuesChain = captured !== null && getCaptureMoves(nextBoard, to).length > 0;

  return {
    board: nextBoard,
    captured,
    isKingPromotion,
    continuesChain,
  };
}

export function checkWinCondition(board: number[], currentPlayerColor: number): number | null {
  const playerColor = getPlayerColor(currentPlayerColor);
  if (playerColor === null) {
    return null;
  }

  const opponentColor = playerColor === BLACK ? RED : BLACK;
  const opponentHasPieces = board.some((piece) => isOwnedByPlayer(piece, opponentColor));
  if (!opponentHasPieces) {
    return playerColor;
  }

  if (getAllMovesForPlayer(board, opponentColor, NO_FORCED_CAPTURE).length === 0) {
    return playerColor;
  }

  return null;
}

export function getAllMovesForPlayer(
  board: number[],
  playerColor: number,
  mustCaptureFrom: number,
): Move[] {
  const normalizedColor = getPlayerColor(playerColor);
  if (normalizedColor === null) {
    return [];
  }

  if (mustCaptureFrom !== NO_FORCED_CAPTURE) {
    if (!isOwnedByPlayer(board[mustCaptureFrom], normalizedColor)) {
      return [];
    }

    return getCaptureMoves(board, mustCaptureFrom);
  }

  const captureMoves = getAllCaptureMovesForPlayer(board, normalizedColor);
  if (captureMoves.length > 0) {
    return captureMoves;
  }

  const moves: Move[] = [];
  for (let index = 0; index < board.length; index += 1) {
    if (!isOwnedByPlayer(board[index], normalizedColor)) {
      continue;
    }

    moves.push(...getSimpleMoves(board, index));
  }

  return moves;
}

function getAllCaptureMovesForPlayer(board: number[], playerColor: number): Move[] {
  const moves: Move[] = [];

  for (let index = 0; index < board.length; index += 1) {
    if (!isOwnedByPlayer(board[index], playerColor)) {
      continue;
    }

    moves.push(...getCaptureMoves(board, index));
  }

  return moves;
}

function getCaptureMoves(board: number[], cellIndex: number): Move[] {
  const piece = board[cellIndex];
  const playerColor = getPlayerColor(piece);
  if (playerColor === null) {
    return [];
  }

  const { row, col } = toPosition(cellIndex);
  const moves: Move[] = [];

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

function getSimpleMoves(board: number[], cellIndex: number): Move[] {
  const piece = board[cellIndex];
  if (getPlayerColor(piece) === null) {
    return [];
  }

  const { row, col } = toPosition(cellIndex);
  const moves: Move[] = [];

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

function getPlayerColor(piece: number): number | null {
  if (piece === BLACK || piece === BLACK_KING) {
    return BLACK;
  }

  if (piece === RED || piece === RED_KING) {
    return RED;
  }

  return null;
}

function isOwnedByPlayer(piece: number, playerColor: number): boolean {
  return getPlayerColor(piece) === playerColor;
}

function isOwnedByOpponent(piece: number, playerColor: number): boolean {
  const pieceColor = getPlayerColor(piece);
  return pieceColor !== null && pieceColor !== playerColor;
}

function getPromotedPiece(piece: number, row: number): number {
  if (piece === BLACK && row === BOARD_WIDTH - 1) {
    return BLACK_KING;
  }

  if (piece === RED && row === 0) {
    return RED_KING;
  }

  return piece;
}

function isDarkSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
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

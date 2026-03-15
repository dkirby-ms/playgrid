import { BLACK, RED } from "@eschaton/playgrid-shared";

const BOARD_SIZE = 24;
const PIECES_PER_PLAYER = 15;

export interface Move {
  from: number | "bar";
  to: number | "off";
  die: number;
}

export interface MoveResult {
  points: number[];
  blackBar: number;
  redBar: number;
  blackBorneOff: number;
  redBorneOff: number;
  captured: boolean;
}

/**
 * Initialize backgammon board with standard starting position.
 * Points are numbered 0-23, where:
 * - Black moves from 0→23 (home board: 18-23)
 * - Red moves from 23→0 (home board: 0-5)
 * - Positive numbers = Black pieces, Negative = Red pieces
 */
export function initializeBoard(): number[] {
  const points = Array.from({ length: BOARD_SIZE }, () => 0);
  
  // Black's starting position (positive values)
  points[0] = 2;   // 2 checkers on point 1
  points[11] = 5;  // 5 checkers on point 12
  points[16] = 3;  // 3 checkers on point 17
  points[18] = 5;  // 5 checkers on point 19
  
  // Red's starting position (negative values)
  points[23] = -2;  // 2 checkers on point 24
  points[12] = -5;  // 5 checkers on point 13
  points[7] = -3;   // 3 checkers on point 8
  points[5] = -5;   // 5 checkers on point 6
  
  return points;
}

/**
 * Roll two dice. Server-authoritative RNG.
 */
export function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return [die1, die2];
}

/**
 * Get available moves for the dice that haven't been used yet.
 * Handles doubles (4 moves) and regular rolls (2 moves).
 */
export function getAvailableDice(dice: number[], usedDice: boolean[]): number[] {
  const [die1, die2] = dice;
  const [used1, used2] = usedDice;
  
  if (die1 === die2) {
    // Doubles: 4 moves of the same value
    const usedCount = (used1 ? 1 : 0) + (used2 ? 1 : 0);
    const remainingCount = 4 - (usedCount * 2);
    return Array.from({ length: remainingCount }, () => die1);
  }
  
  const available: number[] = [];
  if (!used1) available.push(die1);
  if (!used2) available.push(die2);
  return available;
}

/**
 * Check if a player can bear off (all pieces in home board or borne off).
 */
export function canBearOff(
  points: number[],
  barCount: number,
  playerColor: number,
): boolean {
  if (barCount > 0) return false;
  
  if (playerColor === BLACK) {
    // Black's home board is points 18-23
    for (let i = 0; i < 18; i++) {
      if (points[i] > 0) return false;
    }
  } else {
    // Red's home board is points 0-5
    for (let i = 6; i < BOARD_SIZE; i++) {
      if (points[i] < 0) return false;
    }
  }
  
  return true;
}

/**
 * Validate if a move is legal.
 */
export function isValidMove(
  points: number[],
  blackBar: number,
  redBar: number,
  blackBorneOff: number,
  redBorneOff: number,
  from: number | "bar",
  to: number | "off",
  die: number,
  playerColor: number,
): boolean {
  const barCount = playerColor === BLACK ? blackBar : redBar;
  
  // Must enter from bar first
  if (barCount > 0 && from !== "bar") {
    return false;
  }
  
  // Entering from bar
  if (from === "bar") {
    if (barCount === 0) return false;
    
    const entryPoint = playerColor === BLACK ? die - 1 : BOARD_SIZE - die;
    if (to !== entryPoint) return false;
    
    const destPieces = points[entryPoint];
    // Can't enter on opponent's blocked point (2+ pieces)
    if (playerColor === BLACK && destPieces < -1) return false;
    if (playerColor === RED && destPieces > 1) return false;
    
    return true;
  }
  
  // Bearing off
  if (to === "off") {
    if (!canBearOff(points, barCount, playerColor)) return false;
    
    const fromPoint = from as number;
    if (fromPoint < 0 || fromPoint >= BOARD_SIZE) return false;
    
    const pieces = points[fromPoint];
    if (playerColor === BLACK && pieces <= 0) return false;
    if (playerColor === RED && pieces >= 0) return false;
    
    // Check if exact die roll or highest piece
    if (playerColor === BLACK) {
      const exactPoint = BOARD_SIZE - die;
      if (fromPoint === exactPoint) return true;
      
      // Can bear off from lower point if no pieces on higher points
      if (fromPoint < exactPoint) return false;
      
      for (let i = fromPoint + 1; i < BOARD_SIZE; i++) {
        if (points[i] > 0) return false;
      }
      return true;
    } else {
      const exactPoint = die - 1;
      if (fromPoint === exactPoint) return true;
      
      // Can bear off from higher point if no pieces on lower points
      if (fromPoint > exactPoint) return false;
      
      for (let i = 0; i < fromPoint; i++) {
        if (points[i] < 0) return false;
      }
      return true;
    }
  }
  
  // Normal move
  const fromPoint = from as number;
  const toPoint = to as number;
  
  if (fromPoint < 0 || fromPoint >= BOARD_SIZE) return false;
  if (toPoint < 0 || toPoint >= BOARD_SIZE) return false;
  
  const sourcePieces = points[fromPoint];
  if (playerColor === BLACK && sourcePieces <= 0) return false;
  if (playerColor === RED && sourcePieces >= 0) return false;
  
  // Check direction and distance
  const expectedTo = playerColor === BLACK ? fromPoint + die : fromPoint - die;
  if (toPoint !== expectedTo) return false;
  
  const destPieces = points[toPoint];
  // Can't move to opponent's blocked point (2+ pieces)
  if (playerColor === BLACK && destPieces < -1) return false;
  if (playerColor === RED && destPieces > 1) return false;
  
  return true;
}

/**
 * Apply a move and return the new state.
 */
export function applyMove(
  points: number[],
  blackBar: number,
  redBar: number,
  blackBorneOff: number,
  redBorneOff: number,
  from: number | "bar",
  to: number | "off",
  playerColor: number,
): MoveResult {
  const nextPoints = [...points];
  let nextBlackBar = blackBar;
  let nextRedBar = redBar;
  let nextBlackBorneOff = blackBorneOff;
  let nextRedBorneOff = redBorneOff;
  let captured = false;
  
  // Remove piece from source
  if (from === "bar") {
    if (playerColor === BLACK) {
      nextBlackBar--;
    } else {
      nextRedBar--;
    }
  } else {
    const fromPoint = from as number;
    if (playerColor === BLACK) {
      nextPoints[fromPoint]--;
    } else {
      nextPoints[fromPoint]++;
    }
  }
  
  // Add piece to destination
  if (to === "off") {
    if (playerColor === BLACK) {
      nextBlackBorneOff++;
    } else {
      nextRedBorneOff++;
    }
  } else {
    const toPoint = to as number;
    const destPieces = nextPoints[toPoint];
    
    // Capture opponent's blot (single piece)
    if (playerColor === BLACK && destPieces === -1) {
      nextPoints[toPoint] = 1;
      nextRedBar++;
      captured = true;
    } else if (playerColor === RED && destPieces === 1) {
      nextPoints[toPoint] = -1;
      nextBlackBar++;
      captured = true;
    } else {
      // Normal move
      nextPoints[toPoint] += playerColor === BLACK ? 1 : -1;
    }
  }
  
  return {
    points: nextPoints,
    blackBar: nextBlackBar,
    redBar: nextRedBar,
    blackBorneOff: nextBlackBorneOff,
    redBorneOff: nextRedBorneOff,
    captured,
  };
}

/**
 * Check if a player has won (all 15 pieces borne off).
 */
export function checkWinCondition(
  blackBorneOff: number,
  redBorneOff: number,
): number | null {
  if (blackBorneOff === PIECES_PER_PLAYER) return BLACK;
  if (redBorneOff === PIECES_PER_PLAYER) return RED;
  return null;
}

/**
 * Check if the current player has any valid moves with the remaining dice.
 */
export function hasValidMoves(
  points: number[],
  blackBar: number,
  redBar: number,
  blackBorneOff: number,
  redBorneOff: number,
  availableDice: number[],
  playerColor: number,
): boolean {
  if (availableDice.length === 0) return false;
  
  const barCount = playerColor === BLACK ? blackBar : redBar;
  
  // Check bar entry moves
  if (barCount > 0) {
    for (const die of availableDice) {
      const entryPoint = playerColor === BLACK ? die - 1 : BOARD_SIZE - die;
      if (isValidMove(points, blackBar, redBar, blackBorneOff, redBorneOff, "bar", entryPoint, die, playerColor)) {
        return true;
      }
    }
    return false;
  }
  
  // Check bearing off moves
  if (canBearOff(points, barCount, playerColor)) {
    for (let point = 0; point < BOARD_SIZE; point++) {
      const pieces = points[point];
      if (playerColor === BLACK && pieces > 0) {
        for (const die of availableDice) {
          if (isValidMove(points, blackBar, redBar, blackBorneOff, redBorneOff, point, "off", die, playerColor)) {
            return true;
          }
        }
      } else if (playerColor === RED && pieces < 0) {
        for (const die of availableDice) {
          if (isValidMove(points, blackBar, redBar, blackBorneOff, redBorneOff, point, "off", die, playerColor)) {
            return true;
          }
        }
      }
    }
  }
  
  // Check regular moves
  for (let fromPoint = 0; fromPoint < BOARD_SIZE; fromPoint++) {
    const pieces = points[fromPoint];
    if (playerColor === BLACK && pieces <= 0) continue;
    if (playerColor === RED && pieces >= 0) continue;
    
    for (const die of availableDice) {
      const toPoint = playerColor === BLACK ? fromPoint + die : fromPoint - die;
      if (toPoint >= 0 && toPoint < BOARD_SIZE) {
        if (isValidMove(points, blackBar, redBar, blackBorneOff, redBorneOff, fromPoint, toPoint, die, playerColor)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

export function getPlayerColor(playerIndex: number): number | null {
  if (playerIndex === 0) return BLACK;
  if (playerIndex === 1) return RED;
  return null;
}

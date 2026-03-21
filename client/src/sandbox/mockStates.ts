import {
  EMPTY,
  BLACK,
  RED,
} from "@eschaton/shared";

export interface MockCheckersState {
  board: number[];
  mustCaptureFrom: number;
  phase: string;
  currentTurn: string;
  players: Map<string, { displayName: string; playerIndex: number; isSpectator: boolean }>;
  player1TimeRemainingMs: number;
  player2TimeRemainingMs: number;
}

export interface MockBackgammonState {
  points: number[];
  blackBar: number;
  redBar: number;
  blackBorneOff: number;
  redBorneOff: number;
  dice: number[];
  usedDice: boolean[];
  phase: string;
  currentTurn: string;
  players: Map<string, { displayName: string; playerIndex: number; isSpectator: boolean }>;
  player1TimeRemainingMs: number;
  player2TimeRemainingMs: number;
}

export interface MockRiskState {
  territories: Map<string, { owner: string; armyCount: number }>;
  riskPlayers: Map<string, { sessionId: string; cardsHeld: number; territoriesOwned: number; armiesToPlace: number }>;
  turnPhase: string;
  gamePhase: string;
  setupTerritoryIndex: number;
  cardTradeInCount: number;
  earnedCardThisTurn: boolean;
  phase: string;
  currentTurn: string;
  players: Map<string, { displayName: string; playerIndex: number; isSpectator: boolean }>;
  player1TimeRemainingMs: number;
  player2TimeRemainingMs: number;
}

export function createMockCheckersState(): MockCheckersState {
  const board = Array.from({ length: 64 }, () => EMPTY);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row * 8 + col] = BLACK;
      }
    }
  }

  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row * 8 + col] = RED;
      }
    }
  }

  const players = new Map([
    ["player1", { displayName: "Player 1", playerIndex: 0, isSpectator: false }],
    ["player2", { displayName: "Player 2", playerIndex: 1, isSpectator: false }],
  ]);

  return {
    board,
    mustCaptureFrom: -1,
    phase: "playing",
    currentTurn: "player1",
    players,
    player1TimeRemainingMs: 600000,
    player2TimeRemainingMs: 600000,
  };
}

export function createMockBackgammonState(): MockBackgammonState {
  const points = Array.from({ length: 24 }, () => 0);
  
  points[0] = 2;
  points[5] = -5;
  points[7] = -3;
  points[11] = 5;
  points[12] = -5;
  points[16] = 3;
  points[18] = 5;
  points[23] = -2;

  const players = new Map([
    ["player1", { displayName: "Player 1", playerIndex: 0, isSpectator: false }],
    ["player2", { displayName: "Player 2", playerIndex: 1, isSpectator: false }],
  ]);

  return {
    points,
    blackBar: 0,
    redBar: 0,
    blackBorneOff: 0,
    redBorneOff: 0,
    dice: [0, 0],
    usedDice: [false, false],
    phase: "playing",
    currentTurn: "player1",
    players,
    player1TimeRemainingMs: 600000,
    player2TimeRemainingMs: 600000,
  };
}

export function createMockRiskState(): MockRiskState {
  const territories = new Map([
    ["alaska", { owner: "player1", armyCount: 3 }],
    ["northwest-territory", { owner: "player1", armyCount: 2 }],
    ["greenland", { owner: "player2", armyCount: 1 }],
    ["alberta", { owner: "player1", armyCount: 5 }],
    ["ontario", { owner: "player2", armyCount: 2 }],
    ["quebec", { owner: "player2", armyCount: 3 }],
    ["western-united-states", { owner: "player1", armyCount: 4 }],
    ["eastern-united-states", { owner: "player2", armyCount: 2 }],
    ["central-america", { owner: "player1", armyCount: 1 }],
  ]);

  const riskPlayers = new Map([
    ["player1", { sessionId: "player1", cardsHeld: 0, territoriesOwned: 5, armiesToPlace: 0 }],
    ["player2", { sessionId: "player2", cardsHeld: 0, territoriesOwned: 4, armiesToPlace: 0 }],
  ]);

  const players = new Map([
    ["player1", { displayName: "Player 1", playerIndex: 0, isSpectator: false }],
    ["player2", { displayName: "Player 2", playerIndex: 1, isSpectator: false }],
  ]);

  return {
    territories,
    riskPlayers,
    turnPhase: "reinforce",
    gamePhase: "playing",
    setupTerritoryIndex: 0,
    cardTradeInCount: 0,
    earnedCardThisTurn: false,
    phase: "playing",
    currentTurn: "player1",
    players,
    player1TimeRemainingMs: 600000,
    player2TimeRemainingMs: 600000,
  };
}

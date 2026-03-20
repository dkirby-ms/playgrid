import {
  BLACK,
  BLACK_KING,
  CheckersState,
  EMPTY,
  PlayerInfo,
  RED,
  RED_KING,
  type ActionResult,
  type GamePlugin,
  type GameResult,
  type MoveEntry,
} from "@eschaton/shared";
import {
  applyMove,
  checkWinCondition,
  initializeBoard,
  isValidMove,
} from "./checkersLogic.js";

const NO_FORCED_CAPTURE = -1;

type MovePayload = {
  from: number;
  to: number;
};

type CheckersColor = typeof BLACK | typeof RED;

function isCheckersColor(value: number | null): value is CheckersColor {
  return value === BLACK || value === RED;
}

function isMovePayload(payload: unknown): payload is MovePayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return Number.isInteger(candidate.from) && Number.isInteger(candidate.to);
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

function replaceBoard(state: CheckersState, nextBoard: number[]) {
  for (const [index, piece] of nextBoard.entries()) {
    state.board[index] = piece;
  }
}

function getCurrentPlayerColor(state: CheckersState): CheckersColor | null {
  const currentPlayer = state.players.get(state.currentTurn);
  if (!currentPlayer) {
    return null;
  }

  return getPlayerColor(currentPlayer.playerIndex);
}

const BOARD_WIDTH = 8;
const COLUMN_LETTERS = "ABCDEFGH";

function indexToNotation(index: number): string {
  const col = index % BOARD_WIDTH;
  const row = Math.floor(index / BOARD_WIDTH) + 1;
  return `${COLUMN_LETTERS[col]}${row}`;
}

function isCapture(from: number, to: number): boolean {
  const rowDelta = Math.abs(
    Math.floor(to / BOARD_WIDTH) - Math.floor(from / BOARD_WIDTH),
  );
  return rowDelta === 2;
}

function isKingPromotion(playerIndex: number, to: number): boolean {
  const row = Math.floor(to / BOARD_WIDTH);
  // Player 0 = BLACK moves toward row 7, Player 1 = RED moves toward row 0
  if (playerIndex === 0) return row === BOARD_WIDTH - 1;
  if (playerIndex === 1) return row === 0;
  return false;
}

function getPlayerIndexBySessionId(
  state: CheckersState,
  sessionId: string,
): number | null {
  const player = state.players.get(sessionId);
  if (!player) return null;
  return player.playerIndex;
}

function formatMoveEntries(
  state: CheckersState,
  moves: MoveEntry[],
): MoveEntry[] {
  const formatted: MoveEntry[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const from = move.payload.from as number | undefined;
    const to = move.payload.to as number | undefined;

    if (typeof from !== "number" || typeof to !== "number") {
      formatted.push({ ...move });
      continue;
    }

    const playerIndex = getPlayerIndexBySessionId(state, move.playerId);
    const name = move.playerName;
    const fromNotation = indexToNotation(from);
    const toNotation = indexToNotation(to);

    // Detect multi-jump: consecutive captures by same player where prev.to === current.from
    const prevFormatted = formatted[formatted.length - 1];
    const isMultiJump =
      prevFormatted &&
      prevFormatted.playerId === move.playerId &&
      isCapture(from, to) &&
      isCapture(
        prevFormatted.payload.from as number,
        prevFormatted.payload.to as number,
      ) &&
      (prevFormatted.payload.to as number) === from;

    if (isMultiJump && prevFormatted) {
      // Count total captures in this chain
      let chainStart = formatted.length - 1;
      while (chainStart > 0) {
        const prev = formatted[chainStart - 1];
        if (
          prev.playerId !== move.playerId ||
          !isCapture(prev.payload.from as number, prev.payload.to as number) ||
          (prev.payload.to as number) !==
            (formatted[chainStart].payload.from as number)
        ) {
          break;
        }
        chainStart--;
      }
      const captureCount = formatted.length - chainStart + 1;
      const description = `${name} captured ${captureCount} pieces`;

      // Update all entries in the chain with the running count
      for (let j = chainStart; j < formatted.length; j++) {
        formatted[j] = { ...formatted[j], description };
      }
      formatted.push({ ...move, description });
    } else if (
      playerIndex !== null &&
      isCapture(from, to) &&
      isKingPromotion(playerIndex, to)
    ) {
      formatted.push({
        ...move,
        description: `${name} captured at ${toNotation} (from ${fromNotation}), kinged at ${toNotation}`,
      });
    } else if (playerIndex !== null && isKingPromotion(playerIndex, to)) {
      formatted.push({
        ...move,
        description: `${name} kinged at ${toNotation}`,
      });
    } else if (isCapture(from, to)) {
      formatted.push({
        ...move,
        description: `${name} captured at ${toNotation} (from ${fromNotation})`,
      });
    } else {
      formatted.push({
        ...move,
        description: `${name} moved from ${fromNotation} to ${toNotation}`,
      });
    }
  }

  return formatted;
}

function countPlayerPieces(state: CheckersState, color: CheckersColor) {
  let pieces = 0;
  let kings = 0;
  const kingValue = color === BLACK ? BLACK_KING : RED_KING;
  for (let i = 0; i < state.board.length; i++) {
    const cell = state.board[i];
    if (cell === EMPTY) continue;
    if (cell === color) pieces++;
    else if (cell === kingValue) kings++;
  }
  return { pieces: pieces + kings, kings };
}

function buildGameResult(state: CheckersState, winnerColor: CheckersColor): GameResult | null {
  const players = Array.from(state.players.values()).filter((player) => !player.isSpectator);
  const winner = players.find((player) => getPlayerColor(player.playerIndex) === winnerColor);
  if (!winner) {
    return null;
  }

  const loser = players.find((player) => player.sessionId !== winner.sessionId);
  const winnerStats = countPlayerPieces(state, winnerColor);
  const loserColor = winnerColor === BLACK ? RED : BLACK;
  const loserStats = countPlayerPieces(state, loserColor);

  const metadata: Record<string, unknown> = {
    winnerColor,
    [winner.sessionId]: { pieces: winnerStats.pieces, kings: winnerStats.kings },
  };
  if (loser) {
    metadata[loser.sessionId] = { pieces: loserStats.pieces, kings: loserStats.kings };
  }

  return {
    type: "win",
    winnerId: winner.sessionId,
    scores: Object.fromEntries(
      players.map((player) => [player.sessionId, player.sessionId === winner.sessionId ? 1 : 0]),
    ),
    metadata,
  };
}

function validateMove(state: CheckersState, sessionId: string, payload: unknown) {
  if (!isMovePayload(payload)) {
    return false;
  }

  const player = state.players.get(sessionId);
  if (!player || player.isSpectator) {
    return false;
  }

  const playerColor = getPlayerColor(player.playerIndex);
  if (playerColor === null) {
    return false;
  }

  return isValidMove(
    Array.from(state.board),
    payload.from,
    payload.to,
    playerColor,
    state.mustCaptureFrom,
  );
}

export const checkersPlugin: GamePlugin<CheckersState> = {
  id: "checkers",
  name: "Checkers",
  metadata: {
    playerCount: [2, 2],
    estimatedDuration: 20,
    complexity: 2,
    description: "Classic 8x8 checkers with forced captures and king promotion.",
    hasHiddenInformation: false,
  },
  createState() {
    return new CheckersState();
  },
  turnConfig: {
    mode: "sequential",
    turnOrder: { type: "round-robin" },
    allowPass: false,
  },
  chessClockConfig: {
    enabled: true,
    initialTimeBankMs: 600000, // 10 minutes
  },
  lifecycle: {
    onGameStart(state) {
      replaceBoard(state, initializeBoard());
      state.mustCaptureFrom = NO_FORCED_CAPTURE;

      const players = Array.from(state.players.values())
        .filter((player) => !player.isSpectator)
        .sort((left, right) => left.playerIndex - right.playerIndex);

      if (players[0]) {
        players[0].playerIndex = 0;
      }

      if (players[1]) {
        players[1].playerIndex = 1;
      }
    },
    onPlayerJoin(state, client, playerIndex) {
      const existingPlayer = state.players.get(client.sessionId);
      const player = new PlayerInfo();
      player.sessionId = client.sessionId;
      player.displayName = existingPlayer?.displayName ?? `Player ${playerIndex + 1}`;
      player.playerIndex = playerIndex;
      player.isSpectator = existingPlayer?.isSpectator ?? false;
      player.isConnected = existingPlayer?.isConnected ?? true;
      player.controllerSessionId = existingPlayer?.controllerSessionId ?? "";
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
    },
  },
  actions: {
    move(state, client, payload): ActionResult {
      if (!isMovePayload(payload)) {
        return { success: false, error: "Invalid move payload." };
      }

      const player = state.players.get(client.sessionId);
      if (!player) {
        return { success: false, error: "Player not found." };
      }

      const playerColor = getPlayerColor(player.playerIndex);
      if (playerColor === null) {
        return { success: false, error: "Player color is invalid." };
      }

      const board = Array.from(state.board);
      if (!isValidMove(board, payload.from, payload.to, playerColor, state.mustCaptureFrom)) {
        return { success: false, error: "Invalid move." };
      }

      const moveResult = applyMove(board, payload.from, payload.to);
      replaceBoard(state, moveResult.board);
      state.mustCaptureFrom = moveResult.continuesChain ? payload.to : NO_FORCED_CAPTURE;

      const winnerColor = checkWinCondition(moveResult.board, playerColor);
      return {
        success: true,
        endsTurn: !moveResult.continuesChain,
        endsGame: winnerColor !== null,
      };
    },
  },
  conditions: {
    checkGameEnd(state) {
      const currentPlayerColor = getCurrentPlayerColor(state);
      if (currentPlayerColor === null) {
        return null;
      }

      const winnerColor = checkWinCondition(Array.from(state.board), currentPlayerColor);
      if (!isCheckersColor(winnerColor)) {
        return null;
      }

      return buildGameResult(state, winnerColor);
    },
    validateAction(state, client, actionType, payload) {
      if (actionType !== "move") {
        return false;
      }

      if (state.currentTurn !== client.sessionId) {
        return false;
      }

      return validateMove(state, client.sessionId, payload);
    },
  },
  formatMoveHistory(state, moves) {
    return formatMoveEntries(state, moves);
  },
};

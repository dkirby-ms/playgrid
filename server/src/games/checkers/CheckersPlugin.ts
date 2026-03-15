import {
  BLACK,
  CheckersState,
  PlayerInfo,
  RED,
  type ActionResult,
  type GamePlugin,
  type GameResult,
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

function buildGameResult(state: CheckersState, winnerColor: CheckersColor): GameResult | null {
  const players = Array.from(state.players.values()).filter((player) => !player.isSpectator);
  const winner = players.find((player) => getPlayerColor(player.playerIndex) === winnerColor);
  if (!winner) {
    return null;
  }

  return {
    type: "win",
    winnerId: winner.sessionId,
    scores: Object.fromEntries(
      players.map((player) => [player.sessionId, player.sessionId === winner.sessionId ? 1 : 0]),
    ),
    metadata: {
      winnerColor,
    },
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
};

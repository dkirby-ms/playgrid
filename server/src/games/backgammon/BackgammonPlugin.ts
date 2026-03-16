import {
  BackgammonState,
  BLACK,
  RED,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
} from "@eschaton/shared";
import {
  applyMove,
  checkWinCondition,
  getAvailableDice,
  getPlayerColor,
  hasValidMoves,
  initializeBoard,
  isValidMove,
  rollDice,
} from "./backgammonLogic.js";

type MovePayload = {
  from: number | "bar";
  to: number | "off";
  die: number;
};

type BackgammonColor = typeof BLACK | typeof RED;

function isBackgammonColor(value: number | null): value is BackgammonColor {
  return value === BLACK || value === RED;
}

function isMovePayload(payload: unknown): payload is MovePayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const { from, to, die } = candidate;

  const validFrom = typeof from === "number" || from === "bar";
  const validTo = typeof to === "number" || to === "off";
  const validDie = Number.isInteger(die);

  return validFrom && validTo && validDie;
}

function replacePoints(state: BackgammonState, nextPoints: number[]) {
  for (const [index, count] of nextPoints.entries()) {
    state.points[index] = count;
  }
}

function buildGameResult(state: BackgammonState, winnerColor: BackgammonColor): GameResult | null {
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

function validateMoveAction(state: BackgammonState, sessionId: string, payload: unknown) {
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

  const points = Array.from(state.points);
  return isValidMove(
    points,
    state.blackBar,
    state.redBar,
    state.blackBorneOff,
    state.redBorneOff,
    payload.from,
    payload.to,
    payload.die,
    playerColor,
  );
}

export const backgammonPlugin: GamePlugin<BackgammonState> = {
  id: "backgammon",
  name: "Backgammon",
  metadata: {
    playerCount: [2, 2],
    estimatedDuration: 30,
    complexity: 3,
    description: "Classic backgammon with dice rolling, captures, and bearing off.",
    hasHiddenInformation: false,
  },
  createState() {
    return new BackgammonState();
  },
  turnConfig: {
    mode: "sequential",
    turnOrder: { type: "round-robin" },
    allowPass: false,
  },
  lifecycle: {
    onGameStart(state) {
      replacePoints(state, initializeBoard());
      state.blackBar = 0;
      state.redBar = 0;
      state.blackBorneOff = 0;
      state.redBorneOff = 0;

      const players = Array.from(state.players.values())
        .filter((player) => !player.isSpectator)
        .sort((left, right) => left.playerIndex - right.playerIndex);

      if (players[0]) {
        players[0].playerIndex = 0;
      }

      if (players[1]) {
        players[1].playerIndex = 1;
      }

      // Dice start at 0,0 - first player must roll
      state.dice[0] = 0;
      state.dice[1] = 0;
      state.usedDice[0] = false;
      state.usedDice[1] = false;
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
    roll(state, client): ActionResult {
      const player = state.players.get(client.sessionId);
      if (!player) {
        return { success: false, error: "Player not found." };
      }

      // Check if dice are already rolled
      const [die1, die2] = state.dice;
      if (die1 > 0 || die2 > 0) {
        return { success: false, error: "Dice already rolled." };
      }

      // Roll the dice
      const [nextDie1, nextDie2] = rollDice();
      state.dice[0] = nextDie1;
      state.dice[1] = nextDie2;
      state.usedDice[0] = false;
      state.usedDice[1] = false;

      return {
        success: true,
        endsTurn: false,
        endsGame: false,
      };
    },
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

      const points = Array.from(state.points);
      if (
        !isValidMove(
          points,
          state.blackBar,
          state.redBar,
          state.blackBorneOff,
          state.redBorneOff,
          payload.from,
          payload.to,
          payload.die,
          playerColor,
        )
      ) {
        return { success: false, error: "Invalid move." };
      }

      // Mark die as used
      const availableDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice));
      const dieIndex = availableDice.indexOf(payload.die);
      if (dieIndex === -1) {
        return { success: false, error: "Die not available." };
      }

      const [die1, die2] = state.dice;
      if (die1 === die2) {
        // Doubles: mark one of the indices as used
        if (!state.usedDice[0]) {
          state.usedDice[0] = true;
        } else {
          state.usedDice[1] = true;
        }
      } else {
        // Regular: mark specific die as used
        if (payload.die === die1) {
          state.usedDice[0] = true;
        } else if (payload.die === die2) {
          state.usedDice[1] = true;
        }
      }

      // Apply the move
      const moveResult = applyMove(
        points,
        state.blackBar,
        state.redBar,
        state.blackBorneOff,
        state.redBorneOff,
        payload.from,
        payload.to,
        playerColor,
      );

      replacePoints(state, moveResult.points);
      state.blackBar = moveResult.blackBar;
      state.redBar = moveResult.redBar;
      state.blackBorneOff = moveResult.blackBorneOff;
      state.redBorneOff = moveResult.redBorneOff;

      // Check if turn ends
      const remainingDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice));
      const hasMoreMoves = hasValidMoves(
        moveResult.points,
        moveResult.blackBar,
        moveResult.redBar,
        moveResult.blackBorneOff,
        moveResult.redBorneOff,
        remainingDice,
        playerColor,
      );

      const endsTurn = remainingDice.length === 0 || !hasMoreMoves;

      if (endsTurn) {
        // Reset dice to 0,0 - next player must roll
        state.dice[0] = 0;
        state.dice[1] = 0;
        state.usedDice[0] = false;
        state.usedDice[1] = false;
      }

      const winnerColor = checkWinCondition(moveResult.blackBorneOff, moveResult.redBorneOff);

      return {
        success: true,
        endsTurn,
        endsGame: winnerColor !== null,
      };
    },
  },
  conditions: {
    checkGameEnd(state) {
      const winnerColor = checkWinCondition(state.blackBorneOff, state.redBorneOff);
      if (!isBackgammonColor(winnerColor)) {
        return null;
      }

      return buildGameResult(state, winnerColor);
    },
    validateAction(state, client, actionType, payload) {
      if (state.currentTurn !== client.sessionId) {
        return false;
      }

      if (actionType === "roll") {
        // Allow roll if dice are not yet rolled (both are 0)
        const [die1, die2] = state.dice;
        return die1 === 0 && die2 === 0;
      }

      if (actionType === "move") {
        return validateMoveAction(state, client.sessionId, payload);
      }

      return false;
    },
  },
};

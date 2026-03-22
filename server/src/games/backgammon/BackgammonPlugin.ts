import {
  BackgammonState,
  BLACK,
  RED,
  PlayerInfo,
  type ActionResult,
  type GamePlugin,
  type GameResult,
  type MoveEntry,
} from "@eschaton/shared";
import {
  applyMove,
  canPlayBothDice,
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

function formatMoveEntries(
  state: BackgammonState,
  moves: MoveEntry[],
): MoveEntry[] {
  const formatted: MoveEntry[] = [];
  const playerStats: Record<string, { doublesRolled: number; totalHits: number; bearOffs: number }> = {};

  // Initialize stats for all players
  for (const player of state.players.values()) {
    if (!player.isSpectator) {
      playerStats[player.sessionId] = { doublesRolled: 0, totalHits: 0, bearOffs: 0 };
    }
  }

  for (const move of moves) {
    const stats = playerStats[move.playerId];
    
    if (move.actionType === "roll") {
      const die1 = move.payload?.die1 as number | undefined;
      const die2 = move.payload?.die2 as number | undefined;
      
      if (typeof die1 === "number" && typeof die2 === "number") {
        if (die1 === die2) {
          formatted.push({
            ...move,
            description: `${move.playerName} rolled doubles: ${die1}`,
          });
          if (stats) stats.doublesRolled++;
        } else {
          formatted.push({
            ...move,
            description: `${move.playerName} rolled ${die1} and ${die2}`,
          });
        }
      } else {
        formatted.push({ ...move });
      }
    } else if (move.actionType === "move") {
      const from = move.payload?.from;
      const to = move.payload?.to;
      const hit = move.payload?.hit as boolean | undefined;
      
      if (from === "bar" && typeof to === "number") {
        const hitSuffix = hit ? " (hit)" : "";
        formatted.push({
          ...move,
          description: `${move.playerName} entered from bar to point ${to}${hitSuffix}`,
        });
        if (hit && stats) stats.totalHits++;
      } else if (typeof from === "number" && to === "off") {
        formatted.push({
          ...move,
          description: `${move.playerName} bore off from point ${from}`,
        });
        if (stats) stats.bearOffs++;
      } else if (typeof from === "number" && typeof to === "number") {
        const hitSuffix = hit ? " (hit)" : "";
        formatted.push({
          ...move,
          description: `${move.playerName} moved from point ${from} to point ${to}${hitSuffix}`,
        });
        if (hit && stats) stats.totalHits++;
      } else {
        formatted.push({ ...move });
      }
    } else if (move.actionType === "pass") {
      formatted.push({
        ...move,
        description: `${move.playerName} had no valid moves — passed`,
      });
    } else {
      formatted.push({ ...move });
    }
  }

  // Store stats in state metadata for use in buildGameResult
  (state as BackgammonState & { _formattedStats?: typeof playerStats })._formattedStats = playerStats;

  return formatted;
}

function buildGameResult(state: BackgammonState, winnerColor: BackgammonColor): GameResult | null {
  const players = Array.from(state.players.values()).filter((player) => !player.isSpectator);
  const winner = players.find((player) => getPlayerColor(player.playerIndex) === winnerColor);
  if (!winner) {
    return null;
  }

  const loser = players.find((player) => player.sessionId !== winner.sessionId);
  const loserColor = winnerColor === BLACK ? RED : BLACK;

  const winnerBorneOff = winnerColor === BLACK ? state.blackBorneOff : state.redBorneOff;
  const winnerBar = winnerColor === BLACK ? state.blackBar : state.redBar;
  const loserBorneOff = loserColor === BLACK ? state.blackBorneOff : state.redBorneOff;
  const loserBar = loserColor === BLACK ? state.blackBar : state.redBar;

  // Retrieve stats from formatMoveHistory if available
  const formattedStats = (state as BackgammonState & { _formattedStats?: Record<string, { doublesRolled: number; totalHits: number; bearOffs: number }> })._formattedStats;

  const metadata: Record<string, unknown> = {
    winnerColor,
    [winner.sessionId]: { 
      borneOff: winnerBorneOff, 
      remaining: 15 - winnerBorneOff, 
      bar: winnerBar,
      ...(formattedStats?.[winner.sessionId] || {}),
    },
  };
  if (loser) {
    metadata[loser.sessionId] = { 
      borneOff: loserBorneOff, 
      remaining: 15 - loserBorneOff, 
      bar: loserBar,
      ...(formattedStats?.[loser.sessionId] || {}),
    };
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
  chessClockConfig: {
    enabled: true,
    initialTimeBankMs: 600_000,
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
      state.doublesMovesUsed = 0;
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
      state.doublesMovesUsed = 0;

      // Check if any valid moves exist; auto-pass if stuck
      const playerColor = getPlayerColor(player.playerIndex);
      if (playerColor === null) {
        return { success: false, error: "Invalid player index." };
      }

      const availableDice = getAvailableDice(state.dice, state.usedDice, state.doublesMovesUsed);
      const hasAnyValidMoves = hasValidMoves(
        state.points,
        state.blackBar,
        state.redBar,
        state.blackBorneOff,
        state.redBorneOff,
        availableDice,
        playerColor,
      );

      if (!hasAnyValidMoves) {
        // Auto-pass: reset dice and end turn
        state.dice[0] = 0;
        state.dice[1] = 0;
        state.usedDice[0] = false;
        state.usedDice[1] = false;
        state.doublesMovesUsed = 0;

        return {
          success: true,
          endsTurn: true,
          endsGame: false,
        };
      }

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
      const availableDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice), state.doublesMovesUsed);
      const dieIndex = availableDice.indexOf(payload.die);
      if (dieIndex === -1) {
        return { success: false, error: "Die not available." };
      }

      const [die1, die2] = state.dice;
      if (die1 === die2) {
        // Doubles: increment the counter instead of toggling usedDice
        state.doublesMovesUsed++;
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
      const remainingDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice), state.doublesMovesUsed);
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
        state.dice[0] = 0;
        state.dice[1] = 0;
        state.usedDice[0] = false;
        state.usedDice[1] = false;
        state.doublesMovesUsed = 0;
      }

      const winnerColor = checkWinCondition(moveResult.blackBorneOff, moveResult.redBorneOff);

      return {
        success: true,
        endsTurn,
        endsGame: winnerColor !== null,
      };
    },
    pass(state, client): ActionResult {
      const player = state.players.get(client.sessionId);
      if (!player) {
        return { success: false, error: "Player not found." };
      }

      // Reset dice — next player must roll
      state.dice[0] = 0;
      state.dice[1] = 0;
      state.usedDice[0] = false;
      state.usedDice[1] = false;
      state.doublesMovesUsed = 0;

      return {
        success: true,
        endsTurn: true,
        endsGame: false,
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
        if (!validateMoveAction(state, client.sessionId, payload)) {
          return false;
        }

        // Must-use-larger-die rule: when both dice are available, different,
        // and only one can be used (playing either blocks the other), force the larger.
        const movePayload = payload as MovePayload;
        const [die1, die2] = state.dice;
        const availableDice = getAvailableDice(
          Array.from(state.dice),
          Array.from(state.usedDice),
          state.doublesMovesUsed,
        );

        if (die1 !== die2 && availableDice.length === 2) {
          const player = state.players.get(client.sessionId);
          if (!player) return false;
          const playerColor = getPlayerColor(player.playerIndex);
          if (playerColor === null) return false;

          const points = Array.from(state.points);
          const bothPlayable = canPlayBothDice(
            points,
            state.blackBar,
            state.redBar,
            state.blackBorneOff,
            state.redBorneOff,
            die1,
            die2,
            playerColor,
          );

          if (!bothPlayable) {
            const die1HasMoves = hasValidMoves(
              points, state.blackBar, state.redBar,
              state.blackBorneOff, state.redBorneOff, [die1], playerColor,
            );
            const die2HasMoves = hasValidMoves(
              points, state.blackBar, state.redBar,
              state.blackBorneOff, state.redBorneOff, [die2], playerColor,
            );

            if (die1HasMoves && die2HasMoves) {
              const largerDie = Math.max(die1, die2);
              if (movePayload.die !== largerDie) {
                return false;
              }
            }
          }
        }

        return true;
      }

      if (actionType === "pass") {
        const [die1, die2] = state.dice;
        if (die1 === 0 && die2 === 0) {
          return false;
        }

        const player = state.players.get(client.sessionId);
        if (!player || player.isSpectator) {
          return false;
        }

        const playerColor = getPlayerColor(player.playerIndex);
        if (playerColor === null) {
          return false;
        }

        const availableDice = getAvailableDice(Array.from(state.dice), Array.from(state.usedDice), state.doublesMovesUsed);
        return !hasValidMoves(
          Array.from(state.points),
          state.blackBar,
          state.redBar,
          state.blackBorneOff,
          state.redBorneOff,
          availableDice,
          playerColor,
        );
      }

      return false;
    },
  },
  formatMoveHistory(state, moves) {
    return formatMoveEntries(state, moves);
  },
};

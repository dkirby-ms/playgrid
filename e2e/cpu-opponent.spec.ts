import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const CPU_SESSION_ID = "cpu-opponent";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 4)}`;
}

type PlayerClient = {
  context: BrowserContext;
  page: Page;
};

// ── Checkers remote types ──────────────────────────────────────────────

type RemotePlayer = {
  playerIndex?: unknown;
  isConnected?: unknown;
  isSpectator?: unknown;
  controllerSessionId?: unknown;
};

type RemotePlayers = {
  entries: () => Iterable<[string, RemotePlayer]>;
};

type RemoteCheckersState = {
  phase?: unknown;
  currentTurn?: unknown;
  turnNumber?: unknown;
  mustCaptureFrom?: unknown;
  board?: Iterable<unknown>;
  players?: RemotePlayers;
};

type RemoteBackgammonState = {
  phase?: unknown;
  currentTurn?: unknown;
  turnNumber?: unknown;
  points?: Iterable<unknown>;
  dice?: Iterable<unknown>;
  usedDice?: Iterable<unknown>;
  blackBar?: unknown;
  redBar?: unknown;
  blackBorneOff?: unknown;
  redBorneOff?: unknown;
  players?: RemotePlayers;
};

type RemoteRoom = {
  id?: unknown;
  roomId?: unknown;
  sessionId?: unknown;
  state?: RemoteCheckersState & RemoteBackgammonState;
  send: (type: string, payload: unknown) => void;
  onMessage: (type: string, callback: (payload: unknown) => void) => void;
};

type RemoteText = {
  text?: unknown;
};

type RemoteRenderer = {
  statusText?: RemoteText;
  playerColorText?: RemoteText;
  overlayTitleText?: RemoteText;
  overlaySubtitleText?: RemoteText;
  getGameOverTitle?: () => string;
  getGameOverSubtitle?: () => string;
};

type RemoteGameScene = {
  renderer?: RemoteRenderer;
};

type RemoteLobbyRoom = {
  sessionId?: unknown;
};

type RemoteApp = {
  lobbyRoom?: RemoteLobbyRoom | null;
  gameRoom?: RemoteRoom | null;
  gameScene?: RemoteGameScene;
};

type E2EWindow = Window & {
  __PLAYGRID_E2E__?: {
    app: RemoteApp;
  };
};

// ── Snapshot types ─────────────────────────────────────────────────────

type PlayerSnapshot = {
  sessionId: string;
  playerIndex: number;
  isConnected: boolean;
  isSpectator: boolean;
  controllerSessionId: string;
};

type CheckersSnapshot = {
  sessionId: string | null;
  roomId: string | null;
  phase: string | null;
  currentTurn: string | null;
  turnNumber: number | null;
  mustCaptureFrom: number | null;
  board: number[];
  statusText: string | null;
  playerColorText: string | null;
  players: PlayerSnapshot[];
};

type BackgammonSnapshot = {
  sessionId: string | null;
  roomId: string | null;
  phase: string | null;
  currentTurn: string | null;
  turnNumber: number | null;
  points: number[];
  dice: number[];
  usedDice: boolean[];
  blackBar: number;
  redBar: number;
  blackBorneOff: number;
  redBorneOff: number;
  statusText: string | null;
  playerColorText: string | null;
  players: PlayerSnapshot[];
};

// ── DOM helpers ────────────────────────────────────────────────────────

function lobbyOverlay(page: Page): Locator {
  return page.locator("#lobby-overlay.visible");
}

// ── Lobby helpers ──────────────────────────────────────────────────────

async function savePlayerName(page: Page, displayName: string): Promise<void> {
  const playerNameInput = page.locator('input[name="player-name"]');
  await playerNameInput.fill(displayName);
  await playerNameInput.blur();
  const trimmed = displayName.trim();
  await expect(playerNameInput).toHaveValue(trimmed);
  await expect(page.locator("#lobby-overlay.visible")).toBeVisible();
  await expect(page.locator(".online-player-name", { hasText: trimmed })).toBeVisible();
}

async function openLobbyPlayer(browser: Browser, displayName: string): Promise<PlayerClient> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/?e2e=1");
  await expect(lobbyOverlay(page)).toBeVisible();
  await expect(lobbyOverlay(page)).toContainText("Board Game Lounge");
  await expect.poll(async () => (await getCheckersSnapshot(page)).sessionId).not.toBeNull();
  await savePlayerName(page, displayName);
  return { context, page };
}

async function createCpuGame(page: Page, gameName: string, gameType: "checkers" | "backgammon"): Promise<void> {
  await page.locator(".create-game-trigger").click();

  const modal = page.locator("#create-game-modal.visible");
  await expect(modal).toBeVisible();
  await modal.locator('input[name="game-name"]').fill(gameName);
  await modal.locator('select[name="game-type"]').selectOption(gameType);

  await modal.getByRole("button", { name: "Create Game", exact: true }).click();
}

async function startCpuGame(browser: Browser, gameName: string, gameType: "checkers" | "backgammon"): Promise<PlayerClient> {
  const player = await openLobbyPlayer(browser, uniqueName(`cpu-${gameType}`));

  await createCpuGame(player.page, gameName, gameType);
  const setup = player.page.locator("#setup-overlay.visible");
  await expect(setup).toBeVisible();

  // Add CPU player from the setup screen
  await setup.locator(".setup-add-cpu-btn").click();
  // Wait for CPU player to appear in the player list
  await expect(setup.locator(".setup-player-card")).toHaveCount(2, { timeout: 10000 });

  // Host clicks Start Game
  await player.page.getByRole("button", { name: "Start Game" }).click();
  await expect(player.page.getByRole("button", { name: "Back to Lobby" })).toBeVisible();

  return player;
}

// ── Checkers snapshot ──────────────────────────────────────────────────

async function getCheckersSnapshot(page: Page): Promise<CheckersSnapshot> {
  return page.evaluate(() => {
    const w = window as E2EWindow;
    const app = w.__PLAYGRID_E2E__?.app;
    if (!app) throw new Error("E2E harness is not available.");

    const room = app.gameRoom ?? null;
    const state = room?.state;
    const renderer = app.gameScene?.renderer;
    const players = state?.players && typeof state.players.entries === "function"
      ? Array.from(state.players.entries(), ([sessionId, player]) => ({
        sessionId,
        playerIndex: typeof player.playerIndex === "number" ? player.playerIndex : -1,
        isConnected: Boolean(player.isConnected),
        isSpectator: Boolean(player.isSpectator),
        controllerSessionId: typeof player.controllerSessionId === "string"
          ? player.controllerSessionId
          : "",
      }))
      : [];

    return {
      sessionId: typeof room?.sessionId === "string"
        ? room.sessionId
        : typeof app.lobbyRoom?.sessionId === "string"
          ? app.lobbyRoom.sessionId
          : null,
      roomId: typeof room?.id === "string"
        ? room.id
        : typeof room?.roomId === "string"
          ? room.roomId
          : null,
      phase: typeof state?.phase === "string" ? state.phase : null,
      currentTurn: typeof state?.currentTurn === "string" ? state.currentTurn : null,
      turnNumber: typeof state?.turnNumber === "number" ? state.turnNumber : null,
      mustCaptureFrom: typeof state?.mustCaptureFrom === "number" ? state.mustCaptureFrom : null,
      board: state?.board ? Array.from(state.board, Number) : [],
      statusText: (() => {
        if (typeof renderer?.statusText?.text === "string") {
          return renderer.statusText.text;
        }
        if (typeof renderer?.getHUDStatus === "function") {
          const hudStatus = renderer.getHUDStatus(state);
          if (hudStatus && typeof hudStatus.text === "string") {
            return hudStatus.text;
          }
        }
        return null;
      })(),
      playerColorText: (() => {
        if (typeof renderer?.playerColorText?.text === "string") {
          return renderer.playerColorText.text;
        }
        if (typeof renderer?.getHUDStatus === "function") {
          const hud = renderer.getHUDStatus(state);
          if (hud?.detail && (hud.detail.includes('You are playing as') || hud.detail.includes('You are spectating'))) {
            return hud.detail;
          }
        }
        const sidebarNotes = document.querySelectorAll('.sidebar-note');
        for (const note of sidebarNotes) {
          const text = note.textContent ?? '';
          if (text.includes('You are playing as') || text.includes('You are spectating')) {
            return text;
          }
        }
        return null;
      })(),
      players,
    } satisfies CheckersSnapshot;
  });
}

// ── Backgammon snapshot ────────────────────────────────────────────────

async function getBackgammonSnapshot(page: Page): Promise<BackgammonSnapshot> {
  return page.evaluate(() => {
    const w = window as E2EWindow;
    const app = w.__PLAYGRID_E2E__?.app;
    if (!app) throw new Error("E2E harness is not available.");

    const room = app.gameRoom ?? null;
    const state = room?.state;
    const renderer = app.gameScene?.renderer;
    const players = state?.players && typeof state.players.entries === "function"
      ? Array.from(state.players.entries(), ([sessionId, player]) => ({
        sessionId,
        playerIndex: typeof player.playerIndex === "number" ? player.playerIndex : -1,
        isConnected: Boolean(player.isConnected),
        isSpectator: Boolean(player.isSpectator),
        controllerSessionId: typeof player.controllerSessionId === "string"
          ? player.controllerSessionId
          : "",
      }))
      : [];

    return {
      sessionId: typeof room?.sessionId === "string"
        ? room.sessionId
        : typeof app.lobbyRoom?.sessionId === "string"
          ? app.lobbyRoom.sessionId
          : null,
      roomId: typeof room?.id === "string"
        ? room.id
        : typeof room?.roomId === "string"
          ? room.roomId
          : null,
      phase: typeof state?.phase === "string" ? state.phase : null,
      currentTurn: typeof state?.currentTurn === "string" ? state.currentTurn : null,
      turnNumber: typeof state?.turnNumber === "number" ? state.turnNumber : null,
      points: state?.points ? Array.from(state.points, Number) : [],
      dice: state?.dice ? Array.from(state.dice, Number) : [],
      usedDice: state?.usedDice ? Array.from(state.usedDice, Boolean) : [],
      blackBar: typeof state?.blackBar === "number" ? state.blackBar : 0,
      redBar: typeof state?.redBar === "number" ? state.redBar : 0,
      blackBorneOff: typeof state?.blackBorneOff === "number" ? state.blackBorneOff : 0,
      redBorneOff: typeof state?.redBorneOff === "number" ? state.redBorneOff : 0,
      statusText: typeof renderer?.statusText?.text === "string" ? renderer.statusText.text : null,
      playerColorText: (() => {
        if (typeof renderer?.playerColorText?.text === "string") {
          return renderer.playerColorText.text;
        }
        if (typeof renderer?.getHUDStatus === "function") {
          const hud = renderer.getHUDStatus(state);
          if (hud?.detail && (hud.detail.includes('You are playing as') || hud.detail.includes('You are spectating'))) {
            return hud.detail;
          }
        }
        const sidebarNotes = document.querySelectorAll('.sidebar-note');
        for (const note of sidebarNotes) {
          const text = note.textContent ?? '';
          if (text.includes('You are playing as') || text.includes('You are spectating')) {
            return text;
          }
        }
        return null;
      })(),
      players,
    } satisfies BackgammonSnapshot;
  });
}

// ── Action helpers ─────────────────────────────────────────────────────

async function sendCheckersMove(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(({ moveFrom, moveTo }) => {
    const w = window as E2EWindow;
    const room = w.__PLAYGRID_E2E__?.app?.gameRoom;
    if (!room) throw new Error("Missing active game room.");
    room.send("move", { from: moveFrom, to: moveTo });
  }, { moveFrom: from, moveTo: to });
}

async function sendBackgammonAction(page: Page, actionType: string, payload?: unknown): Promise<void> {
  await page.evaluate(({ action, data }) => {
    const w = window as E2EWindow;
    const room = w.__PLAYGRID_E2E__?.app?.gameRoom;
    if (!room) throw new Error("Missing active game room.");
    room.send(action, data);
  }, { action: actionType, data: payload });
}

/**
 * Completes the human player's backgammon turn by scanning the board for valid
 * moves. Handles normal rolls and doubles (up to 4 moves). Respects usedDice
 * state to only attempt moves with available dice.
 */
async function completeHumanBackgammonTurn(
  page: Page,
  humanSessionId: string,
  isHumanBlack: boolean,
): Promise<void> {
  for (let step = 0; step < 4; step++) {
    const snap = await getBackgammonSnapshot(page);
    if (snap.currentTurn !== humanSessionId || snap.dice[0] === 0) return;

    // Determine available dice
    const isDoubles = snap.dice[0] === snap.dice[1];
    const availableDice: number[] = [];
    if (isDoubles) {
      // For doubles, usedDice stays [false,false] — server tracks via doublesMovesUsed.
      // Just provide the die value; server will reject when all 4 are used.
      availableDice.push(snap.dice[0]);
    } else {
      if (snap.dice[0] > 0 && !snap.usedDice[0]) availableDice.push(snap.dice[0]);
      if (snap.dice[1] > 0 && !snap.usedDice[1]) availableDice.push(snap.dice[1]);
    }

    if (availableDice.length === 0) {
      await sendBackgammonAction(page, "pass");
      await page.waitForTimeout(200);
      return;
    }

    let moved = false;
    for (const die of availableDice) {
      if (moved) break;
      for (let pt = 0; pt < 24; pt++) {
        const pieces = snap.points[pt];
        const hasPiece = isHumanBlack ? pieces > 0 : pieces < 0;
        if (!hasPiece) continue;

        const target = isHumanBlack ? pt + die : pt - die;
        if (target < 0 || target >= 24) continue;

        const destPieces = snap.points[target];
        const blocked = isHumanBlack ? destPieces <= -2 : destPieces >= 2;
        if (blocked) continue;

        const prevPoints = snap.points.join(",");
        await sendBackgammonAction(page, "move", { from: pt, to: target, die });
        // Wait for state to reflect the move or turn to change
        await expect.poll(async () => {
          const s = await getBackgammonSnapshot(page);
          return s.points.join(",") !== prevPoints || s.currentTurn !== humanSessionId;
        }, { timeout: 3_000 }).toBe(true);
        moved = true;
        break;
      }
    }

    if (!moved) {
      await sendBackgammonAction(page, "pass");
      await page.waitForTimeout(200);
      return;
    }
  }

  // If still our turn after 4 moves, pass
  const final = await getBackgammonSnapshot(page);
  if (final.currentTurn === humanSessionId && final.dice[0] > 0) {
    await sendBackgammonAction(page, "pass");
    await page.waitForTimeout(200);
  }
}

// ── Checkers CPU tests ─────────────────────────────────────────────────

test.describe("CPU Opponent — Checkers", () => {
  test("creates a Checkers game against CPU from lobby", async ({ browser }) => {
    const gameName = `CPU-Checkers-create-${Date.now()}`;
    const player = await startCpuGame(browser, gameName, "checkers");

    try {
      await expect.poll(async () => (await getCheckersSnapshot(player.page)).phase).toBe("playing");

      const snapshot = await getCheckersSnapshot(player.page);
      expect(snapshot.players).toHaveLength(2);

      const humanPlayer = snapshot.players.find((p) => p.sessionId !== CPU_SESSION_ID);
      const cpuPlayer = snapshot.players.find((p) => p.sessionId === CPU_SESSION_ID);

      expect(humanPlayer).toBeDefined();
      expect(cpuPlayer).toBeDefined();
      expect(humanPlayer!.isConnected).toBe(true);
      expect(cpuPlayer!.isConnected).toBe(true);
      expect(cpuPlayer!.isSpectator).toBe(false);

      // CPU is controller-owned by the human
      expect(cpuPlayer!.controllerSessionId).toBe(humanPlayer!.sessionId);

      expect(snapshot.board).toHaveLength(64);
      expect(snapshot.playerColorText).toMatch(/You are playing as/);
    } finally {
      await player.context.close();
    }
  });

  test("CPU responds with moves after player acts", async ({ browser }) => {
    const gameName = `CPU-Checkers-moves-${Date.now()}`;
    const player = await startCpuGame(browser, gameName, "checkers");

    try {
      await expect.poll(async () => (await getCheckersSnapshot(player.page)).phase).toBe("playing");

      const initial = await getCheckersSnapshot(player.page);
      const humanSessionId = initial.sessionId;
      const isHumanBlack = initial.playerColorText === "You are playing as ⚫ Black";

      if (initial.currentTurn === CPU_SESSION_ID) {
        // CPU goes first — wait for it to make a move
        await expect.poll(async () => {
          const s = await getCheckersSnapshot(player.page);
          return s.currentTurn;
        }, { timeout: 10_000 }).toBe(humanSessionId);

        const afterCpu = await getCheckersSnapshot(player.page);
        expect(afterCpu.board).not.toEqual(initial.board);
      }

      // Now it's the human's turn — make a move
      const beforeMove = await getCheckersSnapshot(player.page);
      expect(beforeMove.currentTurn).toBe(humanSessionId);

      if (isHumanBlack) {
        // Black: standard opening move from row 2
        await sendCheckersMove(player.page, 17, 24);
      } else {
        // Red: standard opening move from row 5
        await sendCheckersMove(player.page, 42, 35);
      }

      // Wait for CPU to respond (turn comes back to human or CPU captures again)
      const boardBeforeStr = beforeMove.board.join(",");
      await expect.poll(async () => {
        const s = await getCheckersSnapshot(player.page);
        return s.board.join(",") !== boardBeforeStr && s.currentTurn === humanSessionId;
      }, { timeout: 10_000 }).toBe(true);

      const afterCpuResponse = await getCheckersSnapshot(player.page);
      expect(afterCpuResponse.turnNumber).toBeGreaterThan(beforeMove.turnNumber ?? 0);
      expect(afterCpuResponse.currentTurn).toBe(humanSessionId);
    } finally {
      await player.context.close();
    }
  });

  test("plays multiple turns to verify game progression against CPU", async ({ browser }) => {
    const gameName = `CPU-Checkers-progression-${Date.now()}`;
    const player = await startCpuGame(browser, gameName, "checkers");

    try {
      await expect.poll(async () => (await getCheckersSnapshot(player.page)).phase).toBe("playing");

      const initial = await getCheckersSnapshot(player.page);
      const humanSessionId = initial.sessionId;
      const isHumanBlack = initial.playerColorText === "You are playing as ⚫ Black";

      // Wait for human's turn if CPU starts
      if (initial.currentTurn === CPU_SESSION_ID) {
        await expect.poll(async () => {
          const s = await getCheckersSnapshot(player.page);
          return s.currentTurn;
        }, { timeout: 10_000 }).toBe(humanSessionId);
      }

      // Play several turns by finding valid moves dynamically
      let turnsPlayed = 0;
      const targetTurns = 6;

      while (turnsPlayed < targetTurns) {
        const snapshot = await getCheckersSnapshot(player.page);
        if (snapshot.phase !== "playing" || snapshot.currentTurn !== humanSessionId) break;

        // Find a valid move for the human player
        const validMove = await player.page.evaluate(({ isBlack }) => {
          const w = window as unknown as E2EWindow;
          const state = w.__PLAYGRID_E2E__?.app?.gameRoom?.state;
          if (!state?.board) return null;

          const board = Array.from(state.board, Number);
          const myPieces = isBlack ? [1, 3] : [2, 4];
          const forwardDeltas = isBlack ? [7, 9] : [-7, -9];
          const captureDeltas = isBlack ? [14, 18] : [-14, -18];
          const kingDeltas = [7, 9, -7, -9];
          const kingCaptures = [14, 18, -14, -18];

          // Prefer captures
          for (const from of board.keys()) {
            if (!myPieces.includes(board[from])) continue;
            const isKing = board[from] === 3 || board[from] === 4;
            const deltas = isKing ? kingCaptures : captureDeltas;
            const midDeltas = isKing ? kingDeltas : forwardDeltas;

            for (let i = 0; i < deltas.length; i++) {
              const to = from + deltas[i];
              const mid = from + midDeltas[i];
              if (to < 0 || to >= 64) continue;
              if (mid < 0 || mid >= 64) continue;
              const fromRow = Math.floor(from / 8);
              const toRow = Math.floor(to / 8);
              if (Math.abs(toRow - fromRow) !== 2) continue;
              if (board[to] !== 0) continue;
              const opponentPieces = isBlack ? [2, 4] : [1, 3];
              if (!opponentPieces.includes(board[mid])) continue;
              return { from, to };
            }
          }

          // Regular moves
          for (const from of board.keys()) {
            if (!myPieces.includes(board[from])) continue;
            const isKing = board[from] === 3 || board[from] === 4;
            const deltas = isKing ? kingDeltas : forwardDeltas;
            for (const delta of deltas) {
              const to = from + delta;
              if (to < 0 || to >= 64) continue;
              const fromRow = Math.floor(from / 8);
              const toRow = Math.floor(to / 8);
              if (Math.abs(toRow - fromRow) !== 1) continue;
              if (board[to] !== 0) continue;
              return { from, to };
            }
          }

          return null;
        }, { isBlack: isHumanBlack });

        if (!validMove) break;

        const boardBefore = snapshot.board.join(",");
        await sendCheckersMove(player.page, validMove.from, validMove.to);

        // Wait for CPU to respond and return control to human (or game to end)
        await expect.poll(async () => {
          const s = await getCheckersSnapshot(player.page);
          return s.phase !== "playing"
            || (s.board.join(",") !== boardBefore && s.currentTurn === humanSessionId);
        }, { timeout: 10_000 }).toBe(true);

        turnsPlayed++;
      }

      const finalSnapshot = await getCheckersSnapshot(player.page);
      expect(finalSnapshot.turnNumber).toBeGreaterThan(initial.turnNumber ?? 0);

      // Game is either still playing with advanced turns, or ended
      expect(["playing", "finished"]).toContain(finalSnapshot.phase);
    } finally {
      await player.context.close();
    }
  });
});

// ── Backgammon CPU tests ───────────────────────────────────────────────

test.describe("CPU Opponent — Backgammon", () => {
  test("creates a Backgammon game against CPU from lobby", async ({ browser }) => {
    const gameName = `CPU-BG-create-${Date.now()}`;
    const player = await startCpuGame(browser, gameName, "backgammon");

    try {
      await expect.poll(async () => (await getBackgammonSnapshot(player.page)).phase).toBe("playing");

      const snapshot = await getBackgammonSnapshot(player.page);
      expect(snapshot.players).toHaveLength(2);

      const humanPlayer = snapshot.players.find((p) => p.sessionId !== CPU_SESSION_ID);
      const cpuPlayer = snapshot.players.find((p) => p.sessionId === CPU_SESSION_ID);

      expect(humanPlayer).toBeDefined();
      expect(cpuPlayer).toBeDefined();
      expect(humanPlayer!.isConnected).toBe(true);
      expect(cpuPlayer!.isConnected).toBe(true);
      expect(cpuPlayer!.isSpectator).toBe(false);
      expect(cpuPlayer!.controllerSessionId).toBe(humanPlayer!.sessionId);

      // Standard backgammon starting position
      expect(snapshot.points[0]).toBe(2);
      expect(snapshot.points[11]).toBe(5);
      expect(snapshot.points[16]).toBe(3);
      expect(snapshot.points[18]).toBe(5);
      expect(snapshot.points[23]).toBe(-2);
      expect(snapshot.points[12]).toBe(-5);
      expect(snapshot.points[7]).toBe(-3);
      expect(snapshot.points[5]).toBe(-5);

      expect(snapshot.playerColorText).toMatch(/You are playing as/);
    } finally {
      await player.context.close();
    }
  });

  test("CPU rolls and moves after player's turn", async ({ browser }) => {
    const gameName = `CPU-BG-moves-${Date.now()}`;
    const player = await startCpuGame(browser, gameName, "backgammon");

    try {
      await expect.poll(async () => (await getBackgammonSnapshot(player.page)).phase).toBe("playing");

      const initial = await getBackgammonSnapshot(player.page);
      const humanSessionId = initial.sessionId;
      const isHumanBlack = initial.playerColorText === "You are playing as ⚫ Black";

      // If CPU has first turn, wait for it to complete
      if (initial.currentTurn === CPU_SESSION_ID) {
        await expect.poll(async () => {
          const s = await getBackgammonSnapshot(player.page);
          return s.currentTurn;
        }, { timeout: 10_000 }).toBe(humanSessionId);
      }

      // Human's turn: roll dice
      await sendBackgammonAction(player.page, "roll");
      await expect.poll(async () => {
        const s = await getBackgammonSnapshot(player.page);
        return s.dice[0] > 0 && s.dice[1] > 0;
      }).toBe(true);

      // Complete human turn by scanning the board for valid moves
      await completeHumanBackgammonTurn(player.page, humanSessionId, isHumanBlack);

      // CPU takes its turn automatically — wait for control to return
      await expect.poll(async () => {
        const s = await getBackgammonSnapshot(player.page);
        return s.currentTurn === humanSessionId && s.turnNumber !== null && s.turnNumber > (initial.turnNumber ?? 0);
      }, { timeout: 10_000 }).toBe(true);

      const afterCpu = await getBackgammonSnapshot(player.page);
      expect(afterCpu.turnNumber).toBeGreaterThan(initial.turnNumber ?? 0);
      expect(afterCpu.currentTurn).toBe(humanSessionId);
    } finally {
      await player.context.close();
    }
  });

  test("CPU completes its turn even when facing limited moves", async ({ browser }) => {
    const gameName = `CPU-BG-pass-${Date.now()}`;
    const player = await startCpuGame(browser, gameName, "backgammon");

    try {
      await expect.poll(async () => (await getBackgammonSnapshot(player.page)).phase).toBe("playing");

      const initial = await getBackgammonSnapshot(player.page);
      const humanSessionId = initial.sessionId;
      const isHumanBlack = initial.playerColorText === "You are playing as ⚫ Black";

      // Play several turns to verify CPU handles all situations (moves and passes)
      let turnsPlayed = 0;
      const targetTurns = 4;

      while (turnsPlayed < targetTurns) {
        const snapshot = await getBackgammonSnapshot(player.page);
        if (snapshot.phase !== "playing") break;

        // If it's CPU's turn, wait for it to finish
        if (snapshot.currentTurn === CPU_SESSION_ID) {
          await expect.poll(async () => {
            const s = await getBackgammonSnapshot(player.page);
            return s.currentTurn === humanSessionId;
          }, { timeout: 10_000 }).toBe(true);
          turnsPlayed++;
          continue;
        }

        // Human's turn: roll, attempt moves, then pass
        await sendBackgammonAction(player.page, "roll");
        await expect.poll(async () => {
          const s = await getBackgammonSnapshot(player.page);
          return s.dice[0] > 0 && s.dice[1] > 0;
        }).toBe(true);

        const rolled = await getBackgammonSnapshot(player.page);

        // Try to make moves with each die
        for (const die of [rolled.dice[0], rolled.dice[1]]) {
          const current = await getBackgammonSnapshot(player.page);
          if (current.currentTurn !== humanSessionId || current.dice[0] === 0) break;

          let moved = false;
          // Find valid source points
          const sources = isHumanBlack
            ? Array.from({ length: 24 }, (_, i) => i).filter((i) => current.points[i] > 0)
            : Array.from({ length: 24 }, (_, i) => i).filter((i) => current.points[i] < 0);

          for (const from of sources) {
            const to = isHumanBlack ? from + die : from - die;
            if (to < 0 || to >= 24) continue;
            if (isHumanBlack && current.points[to] < -1) continue;
            if (!isHumanBlack && current.points[to] > 1) continue;

            const pointsBefore = current.points.join(",");
            await sendBackgammonAction(player.page, "move", { from, to, die });

            // Wait briefly for state change
            try {
              await expect.poll(async () => {
                const s = await getBackgammonSnapshot(player.page);
                return s.points.join(",") !== pointsBefore || s.dice[0] === 0;
              }, { timeout: 3_000 }).toBe(true);
              moved = true;
              break;
            } catch {
              // Move was invalid, try next source
              continue;
            }
          }

          if (!moved) break;
        }

        // End turn via pass if still our turn
        const afterMoves = await getBackgammonSnapshot(player.page);
        if (afterMoves.currentTurn === humanSessionId) {
          await sendBackgammonAction(player.page, "pass");
        }

        // Wait for CPU turn to complete
        await expect.poll(async () => {
          const s = await getBackgammonSnapshot(player.page);
          return s.currentTurn === humanSessionId;
        }, { timeout: 10_000 }).toBe(true);

        turnsPlayed++;
      }

      const finalSnapshot = await getBackgammonSnapshot(player.page);
      expect(finalSnapshot.turnNumber).toBeGreaterThan(initial.turnNumber ?? 0);
      expect(finalSnapshot.phase).toBe("playing");
    } finally {
      await player.context.close();
    }
  });
});

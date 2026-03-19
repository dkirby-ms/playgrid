import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const EMPTY = 0;
const BLACK = 1;
const RED = 2;
const BLACK_KING = 3;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 4)}`;
}

const FULL_GAME_SEQUENCE = [
  { from: 17, to: 24 },
  { from: 44, to: 35 },
  { from: 19, to: 28 },
  { from: 40, to: 33 },
  { from: 12, to: 19 },
  { from: 53, to: 44 },
  { from: 23, to: 30 },
  { from: 60, to: 53 },
  { from: 10, to: 17 },
  { from: 46, to: 37 },
  { from: 28, to: 46 },
  { from: 46, to: 60 },
  { from: 62, to: 53 },
  { from: 60, to: 46 },
  { from: 55, to: 37 },
  { from: 37, to: 23 },
  { from: 19, to: 28 },
  { from: 35, to: 26 },
  { from: 17, to: 35 },
  { from: 35, to: 53 },
  { from: 42, to: 35 },
  { from: 28, to: 42 },
  { from: 42, to: 60 },
  { from: 58, to: 51 },
  { from: 60, to: 42 },
  { from: 49, to: 35 },
  { from: 24, to: 42 },
  { from: 35, to: 28 },
  { from: 21, to: 35 },
  { from: 56, to: 49 },
  { from: 42, to: 56 },
] as const;

type PlayerSnapshot = {
  sessionId: string;
  playerIndex: number;
  isConnected: boolean;
  isSpectator: boolean;
};

type GameSnapshot = {
  sessionId: string | null;
  roomId: string | null;
  phase: string | null;
  currentTurn: string | null;
  turnNumber: number | null;
  mustCaptureFrom: number | null;
  board: number[];
  statusText: string | null;
  playerColorText: string | null;
  overlayTitle: string | null;
  overlaySubtitle: string | null;
  players: PlayerSnapshot[];
};

type OutcomeSnapshot = {
  result: {
    type: string;
    winnerId?: string;
    metadata?: {
      winnerColor?: number;
    };
  };
  overlayTitle: string | null;
  overlaySubtitle: string | null;
};

type RoomErrorPayload = {
  message: string;
};

type PlayerClient = {
  context: BrowserContext;
  page: Page;
};

type StartedMatch = {
  host: PlayerClient;
  guest: PlayerClient;
  black: PlayerClient;
  red: PlayerClient;
  hostSessionId: string;
  guestSessionId: string;
  blackSessionId: string;
  redSessionId: string;
};

type RemotePlayer = {
  playerIndex?: unknown;
  isConnected?: unknown;
  isSpectator?: unknown;
};

type RemotePlayers = {
  entries: () => Iterable<[string, RemotePlayer]>;
};

type RemoteState = {
  phase?: unknown;
  currentTurn?: unknown;
  turnNumber?: unknown;
  mustCaptureFrom?: unknown;
  board?: Iterable<unknown>;
  players?: RemotePlayers;
};

type RemoteRoom = {
  id?: unknown;
  roomId?: unknown;
  sessionId?: unknown;
  state?: RemoteState;
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

function lobbyOverlay(page: Page): Locator {
  return page.locator("#lobby-overlay.visible");
}

function setupOverlay(page: Page): Locator {
  return page.locator("#setup-overlay.visible");
}

function activeGameCard(page: Page, gameName: string): Locator {
  return page.locator(".active-game-card").filter({ hasText: gameName });
}

async function savePlayerName(page: Page, displayName: string): Promise<void> {
  const playerNameInput = page.locator('input[name="player-name"]');
  await playerNameInput.fill(displayName);
  await playerNameInput.blur();
  await expect(page.locator(".lobby-notice.visible")).toHaveText("Player name saved.");
  await expect(page.locator(".lobby-notice.visible")).not.toBeVisible();
  await expect(playerNameInput).toHaveValue(displayName.trim());
}

async function createGame(page: Page, gameName: string): Promise<void> {
  await page.getByRole("button", { name: "Create Game", exact: true }).click();

  const createGameModal = page.locator("#create-game-modal.visible");
  await expect(createGameModal).toBeVisible();
  await createGameModal.locator('input[name="game-name"]').fill(gameName);
  await createGameModal.locator('select[name="game-type"]').selectOption("checkers");
  await createGameModal.getByRole("button", { name: "Create Game", exact: true }).click();
}

async function openLobbyPlayer(browser: Browser, displayName: string): Promise<PlayerClient> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/?e2e=1");
  await expect(lobbyOverlay(page)).toBeVisible();
  await expect(lobbyOverlay(page)).toContainText("Board Game Lounge");
  await expect.poll(async () => (await getSnapshot(page)).sessionId).not.toBeNull();
  await savePlayerName(page, displayName);
  return { context, page };
}

async function startMatch(browser: Browser, gameName: string): Promise<StartedMatch> {
  const host = await openLobbyPlayer(browser, uniqueName("checkers-host"));
  const guest = await openLobbyPlayer(browser, uniqueName("checkers-guest"));

  await createGame(host.page, gameName);

  await expect(setupOverlay(host.page)).toBeVisible();

  const guestCard = activeGameCard(guest.page, gameName);
  await expect(guestCard).toContainText(gameName);
  await guestCard.getByRole("button", { name: "Join" }).click();

  await expect(setupOverlay(guest.page)).toBeVisible();
  await expect(guest.page.getByRole("button", { name: /^✓ Ready$/ })).toBeVisible();
  await expect(host.page.locator(".setup-player-card")).toHaveCount(2);
  await expect(guest.page.locator(".setup-player-card")).toHaveCount(2);

  await guest.page.getByRole("button", { name: /^✓ Ready$/ }).click();
  await expect(guest.page.getByRole("button", { name: "Not Ready", exact: true })).toBeVisible();
  await expect(setupOverlay(host.page).locator(".setup-ready-badge.ready")).toContainText("Ready");

  await host.page.getByRole("button", { name: "Start Game" }).click();

  await expect(host.page.getByRole("button", { name: "Back to Lobby" })).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Back to Lobby" })).toBeVisible();
  await expect.poll(async () => (await getSnapshot(host.page)).phase).toBe("playing");
  await expect.poll(async () => (await getSnapshot(guest.page)).phase).toBe("playing");

  const [hostSessionId, guestSessionId] = await Promise.all([
    getSnapshot(host.page).then((snapshot) => snapshot.sessionId),
    getSnapshot(guest.page).then((snapshot) => snapshot.sessionId),
  ]);

  if (!hostSessionId || !guestSessionId) {
    throw new Error("Missing game session identifiers after starting the match.");
  }

  const [hostSnapshot, guestSnapshot] = await Promise.all([
    getSnapshot(host.page),
    getSnapshot(guest.page),
  ]);
  const hostIsBlack = hostSnapshot.playerColorText === "You are playing as ⚫ Black";
  const guestIsBlack = guestSnapshot.playerColorText === "You are playing as ⚫ Black";

  if (hostIsBlack === guestIsBlack) {
    throw new Error("Expected exactly one black player and one red player.");
  }

  return {
    host,
    guest,
    black: hostIsBlack ? host : guest,
    red: hostIsBlack ? guest : host,
    hostSessionId,
    guestSessionId,
    blackSessionId: hostIsBlack ? hostSessionId : guestSessionId,
    redSessionId: hostIsBlack ? guestSessionId : hostSessionId,
  };
}

async function closeMatch(match: StartedMatch): Promise<void> {
  await Promise.all([
    match.host.context.close(),
    match.guest.context.close(),
  ]);
}

async function getSnapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    const remoteWindow = window as E2EWindow;
    const remoteApp = remoteWindow.__PLAYGRID_E2E__?.app;
    if (!remoteApp) {
      throw new Error("E2E harness is not available.");
    }

    const room = remoteApp.gameRoom ?? null;
    const state = room?.state;
    const renderer = remoteApp.gameScene?.renderer;
    const players = state?.players && typeof state.players.entries === "function"
      ? Array.from(state.players.entries(), ([sessionId, player]) => ({
        sessionId,
        playerIndex: typeof player.playerIndex === "number" ? player.playerIndex : -1,
        isConnected: Boolean(player.isConnected),
        isSpectator: Boolean(player.isSpectator),
      }))
      : [];

    return {
      sessionId: typeof room?.sessionId === "string"
        ? room.sessionId
        : typeof remoteApp.lobbyRoom?.sessionId === "string"
          ? remoteApp.lobbyRoom.sessionId
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
      overlayTitle: typeof renderer?.overlayTitleText?.text === "string"
        ? renderer.overlayTitleText.text
        : null,
      overlaySubtitle: typeof renderer?.overlaySubtitleText?.text === "string"
        ? renderer.overlaySubtitleText.text
        : null,
      players,
    } satisfies GameSnapshot;
  });
}

async function waitForRoomError(page: Page): Promise<RoomErrorPayload> {
  return page.evaluate(() => new Promise<RoomErrorPayload>((resolve) => {
    const remoteWindow = window as E2EWindow;
    const remoteApp = remoteWindow.__PLAYGRID_E2E__?.app;
    if (!remoteApp) {
      throw new Error("E2E harness is not available.");
    }

    const room = remoteApp.gameRoom;
    if (!room) {
      throw new Error("Missing active game room.");
    }

    room.onMessage("error", (payload) => {
      resolve(payload as RoomErrorPayload);
    });
  }));
}

async function waitForOutcome(page: Page): Promise<OutcomeSnapshot> {
  return page.evaluate(() => new Promise<OutcomeSnapshot>((resolve) => {
    const remoteWindow = window as E2EWindow;
    const remoteApp = remoteWindow.__PLAYGRID_E2E__?.app;
    if (!remoteApp) {
      throw new Error("E2E harness is not available.");
    }

    const room = remoteApp.gameRoom;
    if (!room) {
      throw new Error("Missing active game room.");
    }

    room.onMessage("game-end", (payload) => {
      const latestApp = (window as E2EWindow).__PLAYGRID_E2E__?.app;
      const renderer = latestApp?.gameScene?.renderer;
      const overlayTitle = typeof renderer?.getGameOverTitle === "function"
        ? renderer.getGameOverTitle()
        : typeof renderer?.overlayTitleText?.text === "string"
          ? renderer.overlayTitleText.text
          : null;
      const overlaySubtitle = typeof renderer?.getGameOverSubtitle === "function"
        ? renderer.getGameOverSubtitle()
        : typeof renderer?.overlaySubtitleText?.text === "string"
          ? renderer.overlaySubtitleText.text
          : null;
      resolve({
        result: payload as OutcomeSnapshot["result"],
        overlayTitle,
        overlaySubtitle,
      });
    });
  }));
}

async function sendMove(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(({ moveFrom, moveTo }) => {
    const remoteWindow = window as E2EWindow;
    const remoteApp = remoteWindow.__PLAYGRID_E2E__?.app;
    if (!remoteApp) {
      throw new Error("E2E harness is not available.");
    }

    const room = remoteApp.gameRoom;
    if (!room) {
      throw new Error("Missing active game room.");
    }

    room.send("move", { from: moveFrom, to: moveTo });
  }, { moveFrom: from, moveTo: to });
}

async function playMove(match: StartedMatch, from: number, to: number): Promise<GameSnapshot> {
  const before = await getSnapshot(match.host.page);
  const beforeBoard = before.board.join(",");
  const actor = before.currentTurn === match.hostSessionId ? match.host.page : match.guest.page;

  await sendMove(actor, from, to);
  await expect.poll(async () => (await getSnapshot(match.host.page)).board.join(",")).not.toBe(beforeBoard);

  const hostSnapshot = await getSnapshot(match.host.page);
  await expect.poll(async () => (await getSnapshot(match.guest.page)).board.join(",")).toBe(hostSnapshot.board.join(","));

  return hostSnapshot;
}

test.describe("Checkers E2E gameplay", () => {
  test("rejects illegal moves and lets both players make opening moves", async ({ browser }) => {
    const match = await startMatch(browser, `Issue53-opening-${Date.now()}`);

    try {
      const [blackSnapshot, redSnapshot] = await Promise.all([
        getSnapshot(match.black.page),
        getSnapshot(match.red.page),
      ]);

      expect(blackSnapshot.playerColorText).toBe("You are playing as ⚫ Black");
      expect(redSnapshot.playerColorText).toBe("You are playing as 🔴 Red");
      expect(blackSnapshot.statusText).toBe("Your turn");
      expect(redSnapshot.statusText).toBe("Opponent's turn");
      expect(blackSnapshot.currentTurn).toBe(match.blackSessionId);
      expect(blackSnapshot.players).toHaveLength(2);
      expect(redSnapshot.players).toHaveLength(2);

      const invalidMoveError = waitForRoomError(match.black.page);
      await sendMove(match.black.page, 17, 18);
      await expect(invalidMoveError).resolves.toEqual({ message: "Invalid action." });

      const afterInvalid = await getSnapshot(match.black.page);
      expect(afterInvalid.board).toEqual(blackSnapshot.board);
      expect(afterInvalid.currentTurn).toBe(match.blackSessionId);

      const afterBlackMove = await playMove(match, 17, 24);
      expect(afterBlackMove.board[17]).toBe(EMPTY);
      expect(afterBlackMove.board[24]).toBe(BLACK);
      expect(afterBlackMove.currentTurn).toBe(match.redSessionId);

      const afterRedMove = await playMove(match, 44, 35);
      expect(afterRedMove.board[44]).toBe(EMPTY);
      expect(afterRedMove.board[35]).toBe(RED);
      expect(afterRedMove.currentTurn).toBe(match.blackSessionId);

      const redAfterResponse = await getSnapshot(match.red.page);
      expect(redAfterResponse.board).toEqual(afterRedMove.board);
      expect(redAfterResponse.statusText).toBe("Opponent's turn");
    } finally {
      await closeMatch(match);
    }
  });

  test("plays a full deterministic game with promotion, king movement, and win/loss messaging", async ({ browser }) => {
    const match = await startMatch(browser, `Issue53-full-game-${Date.now()}`);

    try {
      for (const [moveIndex, move] of FULL_GAME_SEQUENCE.entries()) {
        const isFinalMove = moveIndex === FULL_GAME_SEQUENCE.length - 1;

        if (isFinalMove) {
          const blackOutcomePromise = waitForOutcome(match.black.page);
          const redOutcomePromise = waitForOutcome(match.red.page);
          const actor = (await getSnapshot(match.host.page)).currentTurn === match.hostSessionId
            ? match.host.page
            : match.guest.page;

          await sendMove(actor, move.from, move.to);

          const [blackOutcome, redOutcome] = await Promise.all([
            blackOutcomePromise,
            redOutcomePromise,
          ]);

          expect(blackOutcome.result.type).toBe("win");
          expect(blackOutcome.result.winnerId).toBe(match.blackSessionId);
          expect(blackOutcome.result.metadata?.winnerColor).toBe(BLACK);
          expect(blackOutcome.overlayTitle).toBe("You win! 🎉");
          expect(blackOutcome.overlaySubtitle).toBe("Black wins the match.");
          expect(redOutcome.overlayTitle).toBe("You lose");
          expect(redOutcome.overlaySubtitle).toBe("Black wins the match.");

          await expect(lobbyOverlay(match.host.page)).toContainText("Board Game Lounge");
          await expect(lobbyOverlay(match.guest.page)).toContainText("Board Game Lounge");
          break;
        }

        const snapshot = await playMove(match, move.from, move.to);

        if (moveIndex === 11) {
          expect(snapshot.board[60]).toBe(BLACK_KING);
          expect(snapshot.mustCaptureFrom).toBe(-1);
        }

        if (moveIndex === 13) {
          expect(snapshot.board[60]).toBe(EMPTY);
          expect(snapshot.board[46]).toBe(BLACK_KING);
        }
      }
    } finally {
      await closeMatch(match);
    }
  });

  test("wins when the opponent still has a piece but no valid moves remain", async ({ browser }) => {
    const match = await startMatch(browser, `Issue53-no-moves-${Date.now()}`);

    try {
      for (const move of FULL_GAME_SEQUENCE.slice(0, -1)) {
        await playMove(match, move.from, move.to);
      }

      const beforeFinalMove = await getSnapshot(match.black.page);
      expect(beforeFinalMove.board.filter((piece) => piece === RED)).toHaveLength(2);
      expect(beforeFinalMove.board.filter((piece) => piece === BLACK || piece === BLACK_KING).length)
        .toBeGreaterThan(1);
      expect(beforeFinalMove.phase).toBe("playing");

      const blackOutcomePromise = waitForOutcome(match.black.page);
      const redOutcomePromise = waitForOutcome(match.red.page);
      const actor = beforeFinalMove.currentTurn === match.blackSessionId
        ? match.black.page
        : match.red.page;
      await sendMove(actor, 42, 56);

      const [blackOutcome, redOutcome] = await Promise.all([
        blackOutcomePromise,
        redOutcomePromise,
      ]);

      expect(blackOutcome.result.winnerId).toBe(match.blackSessionId);
      expect(blackOutcome.result.metadata?.winnerColor).toBe(BLACK);
      expect(blackOutcome.overlayTitle).toBe("You win! 🎉");
      expect(redOutcome.overlayTitle).toBe("You lose");
    } finally {
      await closeMatch(match);
    }
  });
});

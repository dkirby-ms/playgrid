import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const EMPTY = 0;
const BLACK = 1;
const RED = 2;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 4)}`;
}

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
  board: number[];
  statusText: string | null;
  playerColorText: string | null;
  players: PlayerSnapshot[];
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
  joinGame?: (roomId: string, gameType?: string, spectator?: boolean) => Promise<void>;
};

type E2EWindow = Window & {
  __PLAYGRID_E2E__?: {
    app: RemoteApp;
  };
};

function lobbyOverlay(page: Page) {
  return page.locator("#lobby-overlay.visible");
}

function waitingRoomOverlay(page: Page) {
  return page.locator("#waiting-room-overlay.visible");
}

function activeGameCard(page: Page, gameName: string) {
  return page.locator(".active-game-card").filter({ hasText: gameName });
}

async function savePlayerName(page: Page, displayName: string): Promise<void> {
  const playerNameInput = page.locator('input[name="player-name"]');
  await playerNameInput.fill(displayName);
  await playerNameInput.blur();
  await expect(page.locator(".lobby-notice.visible")).toHaveText("Player name saved.");
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
  const host = await openLobbyPlayer(browser, uniqueName("spec-host"));
  const guest = await openLobbyPlayer(browser, uniqueName("spec-guest"));

  await createGame(host.page, gameName);
  await expect(waitingRoomOverlay(host.page)).toBeVisible();

  const guestCard = activeGameCard(guest.page, gameName);
  await expect(guestCard).toContainText(gameName);
  await guestCard.getByRole("button", { name: "Join" }).click();

  await expect(waitingRoomOverlay(guest.page)).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
  await expect(host.page.locator(".waiting-room-player")).toHaveCount(2);

  await guest.page.getByRole("button", { name: "Ready", exact: true }).click();
  await expect(guest.page.getByRole("button", { name: "Not Ready", exact: true })).toBeVisible();
  await expect(waitingRoomOverlay(host.page)).toContainText("✅ Ready");

  await host.page.getByRole("button", { name: "Start Game", exact: true }).click();

  await expect(host.page.getByRole("button", { name: "Leave Game" })).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Leave Game" })).toBeVisible();
  await expect.poll(async () => (await getSnapshot(host.page)).phase).toBe("playing");
  await expect.poll(async () => (await getSnapshot(guest.page)).phase).toBe("playing");

  const [hostSessionId, guestSessionId] = await Promise.all([
    getSnapshot(host.page).then((s) => s.sessionId),
    getSnapshot(guest.page).then((s) => s.sessionId),
  ]);

  if (!hostSessionId || !guestSessionId) {
    throw new Error("Missing game session identifiers after starting the match.");
  }

  const [hostSnap, guestSnap] = await Promise.all([
    getSnapshot(host.page),
    getSnapshot(guest.page),
  ]);
  const hostIsBlack = hostSnap.playerColorText === "You are playing as ⚫ Black";
  const guestIsBlack = guestSnap.playerColorText === "You are playing as ⚫ Black";

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
      board: state?.board ? Array.from(state.board, Number) : [],
      statusText: typeof renderer?.statusText?.text === "string" ? renderer.statusText.text : null,
      playerColorText: (() => {
        if (typeof renderer?.playerColorText?.text === "string") {
          return renderer.playerColorText.text;
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
    } satisfies GameSnapshot;
  });
}

async function joinAsSpectator(browser: Browser, roomId: string): Promise<PlayerClient> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/?e2e=1");
  await expect(lobbyOverlay(page)).toBeVisible();
  await expect.poll(async () => (await getSnapshot(page)).sessionId).not.toBeNull();

  await page.evaluate(async (targetRoomId) => {
    const remoteWindow = window as E2EWindow;
    const remoteApp = remoteWindow.__PLAYGRID_E2E__?.app;
    if (!remoteApp || typeof remoteApp.joinGame !== "function") {
      throw new Error("E2E harness joinGame is not available.");
    }
    await remoteApp.joinGame(targetRoomId, "checkers", true);
  }, roomId);

  await expect.poll(async () => (await getSnapshot(page)).phase).toBe("playing");

  return { context, page };
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

test.describe("Spectator mode E2E", () => {
  test("spectator joins an in-progress game and sees the board state", async ({ browser }) => {
    const gameName = uniqueName("spectator-join");
    const match = await startMatch(browser, gameName);

    try {
      const hostSnap = await getSnapshot(match.host.page);
      const roomId = hostSnap.roomId;
      if (!roomId) throw new Error("Missing roomId from host snapshot.");

      const spectator = await joinAsSpectator(browser, roomId);

      try {
        const specSnap = await getSnapshot(spectator.page);

        // Spectator sees the same board as the players
        expect(specSnap.board).toEqual(hostSnap.board);
        expect(specSnap.phase).toBe("playing");

        // Spectator is marked as spectator in the players list
        const specPlayer = specSnap.players.find((p) => p.sessionId === specSnap.sessionId);
        expect(specPlayer).toBeDefined();
        expect(specPlayer!.isSpectator).toBe(true);

        // Spectator sees spectating UI text
        expect(specSnap.playerColorText).toBe("You are spectating");
        expect(specSnap.statusText).toBe("Spectating");

        // Players see 3 entries in the players map (2 players + 1 spectator)
        const hostSnapAfter = await getSnapshot(match.host.page);
        expect(hostSnapAfter.players).toHaveLength(3);

        const spectatorInHostView = hostSnapAfter.players.find((p) => p.sessionId === specSnap.sessionId);
        expect(spectatorInHostView).toBeDefined();
        expect(spectatorInHostView!.isSpectator).toBe(true);
      } finally {
        await spectator.context.close();
      }
    } finally {
      await Promise.all([match.host.context.close(), match.guest.context.close()]);
    }
  });

  test("spectator cannot make moves — server rejects actions", async ({ browser }) => {
    const gameName = uniqueName("spectator-no-moves");
    const match = await startMatch(browser, gameName);

    try {
      const hostSnap = await getSnapshot(match.host.page);
      const roomId = hostSnap.roomId;
      if (!roomId) throw new Error("Missing roomId from host snapshot.");

      const spectator = await joinAsSpectator(browser, roomId);

      try {
        // Set up error listener before sending the move
        const errorPromise = waitForRoomError(spectator.page);
        await sendMove(spectator.page, 17, 24);

        const error = await errorPromise;
        expect(error.message).toBe("Spectators cannot perform actions.");

        // Board is unchanged after rejected spectator move
        const snapAfter = await getSnapshot(spectator.page);
        expect(snapAfter.board).toEqual(hostSnap.board);
        expect(snapAfter.currentTurn).toBe(hostSnap.currentTurn);
      } finally {
        await spectator.context.close();
      }
    } finally {
      await Promise.all([match.host.context.close(), match.guest.context.close()]);
    }
  });

  test("spectator count is tracked correctly with multiple spectators", async ({ browser }) => {
    const gameName = uniqueName("spectator-count");
    const match = await startMatch(browser, gameName);

    try {
      const hostSnap = await getSnapshot(match.host.page);
      const roomId = hostSnap.roomId;
      if (!roomId) throw new Error("Missing roomId from host snapshot.");

      expect(hostSnap.players).toHaveLength(2);
      expect(hostSnap.players.every((p) => !p.isSpectator)).toBe(true);

      const spec1 = await joinAsSpectator(browser, roomId);
      const spec2 = await joinAsSpectator(browser, roomId);

      try {
        // Both spectators see the game
        await expect.poll(async () => (await getSnapshot(match.host.page)).players.length).toBe(4);

        const hostSnapAfter = await getSnapshot(match.host.page);
        const spectators = hostSnapAfter.players.filter((p) => p.isSpectator);
        const activePlayers = hostSnapAfter.players.filter((p) => !p.isSpectator);

        expect(spectators).toHaveLength(2);
        expect(activePlayers).toHaveLength(2);
      } finally {
        await Promise.all([spec1.context.close(), spec2.context.close()]);
      }
    } finally {
      await Promise.all([match.host.context.close(), match.guest.context.close()]);
    }
  });

  test("spectator leaving does not affect the game", async ({ browser }) => {
    const gameName = uniqueName("spectator-leave");
    const match = await startMatch(browser, gameName);

    try {
      const hostSnap = await getSnapshot(match.host.page);
      const roomId = hostSnap.roomId;
      if (!roomId) throw new Error("Missing roomId from host snapshot.");

      const spectator = await joinAsSpectator(browser, roomId);
      await expect.poll(async () => (await getSnapshot(match.host.page)).players.length).toBe(3);

      // Close spectator — game should continue unaffected
      await spectator.context.close();

      await expect.poll(async () => (await getSnapshot(match.host.page)).players.length).toBe(2);

      const hostSnapAfter = await getSnapshot(match.host.page);
      expect(hostSnapAfter.phase).toBe("playing");
      expect(hostSnapAfter.board).toEqual(hostSnap.board);
      expect(hostSnapAfter.players.every((p) => !p.isSpectator)).toBe(true);

      // Verify the game is still playable — make a move
      const afterMove = await playMove(match, 17, 24);
      expect(afterMove.board[17]).toBe(EMPTY);
      expect(afterMove.board[24]).toBe(BLACK);
    } finally {
      await Promise.all([match.host.context.close(), match.guest.context.close()]);
    }
  });

  test("spectator joins mid-game and sees the correct state after moves", async ({ browser }) => {
    const gameName = uniqueName("spectator-late-join");
    const match = await startMatch(browser, gameName);

    try {
      // Play several moves before spectator joins
      await playMove(match, 17, 24);
      await playMove(match, 44, 35);
      await playMove(match, 19, 28);

      const hostSnapMidGame = await getSnapshot(match.host.page);
      expect(hostSnapMidGame.board[17]).toBe(EMPTY);
      expect(hostSnapMidGame.board[24]).toBe(BLACK);
      expect(hostSnapMidGame.board[44]).toBe(EMPTY);
      expect(hostSnapMidGame.board[35]).toBe(RED);
      expect(hostSnapMidGame.board[19]).toBe(EMPTY);
      expect(hostSnapMidGame.board[28]).toBe(BLACK);

      const roomId = hostSnapMidGame.roomId;
      if (!roomId) throw new Error("Missing roomId from host snapshot.");

      // Spectator joins after 3 moves
      const spectator = await joinAsSpectator(browser, roomId);

      try {
        const specSnap = await getSnapshot(spectator.page);

        // Spectator sees the mid-game board, not the initial board
        expect(specSnap.board).toEqual(hostSnapMidGame.board);
        expect(specSnap.phase).toBe("playing");
        expect(specSnap.turnNumber).toBe(hostSnapMidGame.turnNumber);

        const specPlayer = specSnap.players.find((p) => p.sessionId === specSnap.sessionId);
        expect(specPlayer).toBeDefined();
        expect(specPlayer!.isSpectator).toBe(true);

        // Game continues normally after spectator joins — play another move
        const afterMove = await playMove(match, 40, 33);

        // Spectator sees the updated board
        await expect.poll(async () =>
          (await getSnapshot(spectator.page)).board.join(","),
        ).toBe(afterMove.board.join(","));
      } finally {
        await spectator.context.close();
      }
    } finally {
      await Promise.all([match.host.context.close(), match.guest.context.close()]);
    }
  });

  test("spectator sees live state updates when players make moves", async ({ browser }) => {
    const gameName = uniqueName("spectator-live-sync");
    const match = await startMatch(browser, gameName);

    try {
      const hostSnap = await getSnapshot(match.host.page);
      const roomId = hostSnap.roomId;
      if (!roomId) throw new Error("Missing roomId from host snapshot.");

      const spectator = await joinAsSpectator(browser, roomId);

      try {
        // Verify initial board sync
        const specSnapBefore = await getSnapshot(spectator.page);
        expect(specSnapBefore.board).toEqual(hostSnap.board);

        // Play a move and verify spectator sees it in real time
        const afterBlackMove = await playMove(match, 17, 24);
        await expect.poll(async () =>
          (await getSnapshot(spectator.page)).board.join(","),
        ).toBe(afterBlackMove.board.join(","));

        // Second move
        const afterRedMove = await playMove(match, 44, 35);
        await expect.poll(async () =>
          (await getSnapshot(spectator.page)).board.join(","),
        ).toBe(afterRedMove.board.join(","));

        const specSnapAfter = await getSnapshot(spectator.page);
        expect(specSnapAfter.board[17]).toBe(EMPTY);
        expect(specSnapAfter.board[24]).toBe(BLACK);
        expect(specSnapAfter.board[44]).toBe(EMPTY);
        expect(specSnapAfter.board[35]).toBe(RED);
      } finally {
        await spectator.context.close();
      }
    } finally {
      await Promise.all([match.host.context.close(), match.guest.context.close()]);
    }
  });
});

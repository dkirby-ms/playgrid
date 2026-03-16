import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 4)}`;
}

type PlayerClient = {
  context: BrowserContext;
  page: Page;
};

type StartedMatch = {
  host: PlayerClient;
  guest: PlayerClient;
  hostSessionId: string;
  guestSessionId: string;
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
  reconnectionToken?: unknown;
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
    metadata?: Record<string, unknown>;
  };
  overlayTitle: string | null;
  overlaySubtitle: string | null;
};

type ActiveSessionRecord = {
  reconnectionToken: string;
  roomId: string;
  gameType: string;
  timestamp: number;
};

// ─── Locator Helpers ───────────────────────────────────────────────────────────

function lobbyOverlay(page: Page): Locator {
  return page.locator("#lobby-overlay.visible");
}

function waitingRoomOverlay(page: Page): Locator {
  return page.locator("#waiting-room-overlay.visible");
}

function activeGameCard(page: Page, gameName: string): Locator {
  return page.locator(".active-game-card").filter({ hasText: gameName });
}

function reconnectOverlay(page: Page): Locator {
  return page.locator("#reconnect-overlay.visible");
}

// ─── Page Helpers ──────────────────────────────────────────────────────────────

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
  const host = await openLobbyPlayer(browser, uniqueName("recon-host"));
  const guest = await openLobbyPlayer(browser, uniqueName("recon-guest"));

  await createGame(host.page, gameName);
  await expect(waitingRoomOverlay(host.page)).toBeVisible();

  const guestCard = activeGameCard(guest.page, gameName);
  await expect(guestCard).toContainText(gameName);
  await guestCard.getByRole("button", { name: "Join" }).click();

  await expect(waitingRoomOverlay(guest.page)).toBeVisible();
  await expect(guest.page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
  await expect(host.page.locator(".waiting-room-player")).toHaveCount(2);
  await expect(guest.page.locator(".waiting-room-player")).toHaveCount(2);

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

  return { host, guest, hostSessionId, guestSessionId };
}

async function closeMatch(match: StartedMatch): Promise<void> {
  await Promise.all([
    match.host.context.close().catch(() => undefined),
    match.guest.context.close().catch(() => undefined),
  ]);
}

// ─── Snapshot Helpers ──────────────────────────────────────────────────────────

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
      statusText: typeof renderer?.statusText?.text === "string" ? renderer.statusText.text : null,
      playerColorText: typeof renderer?.playerColorText?.text === "string"
        ? renderer.playerColorText.text
        : null,
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

async function getActiveSession(page: Page): Promise<ActiveSessionRecord | null> {
  return page.evaluate(() => {
    try {
      const raw = window.sessionStorage.getItem("playgrid.active-session");
      if (!raw) return null;
      return JSON.parse(raw) as ActiveSessionRecord;
    } catch {
      return null;
    }
  });
}

async function setActiveSession(page: Page, record: ActiveSessionRecord): Promise<void> {
  await page.evaluate((r) => {
    window.sessionStorage.setItem("playgrid.active-session", JSON.stringify(r));
  }, record);
}

async function sendMove(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(({ moveFrom, moveTo }) => {
    const remoteWindow = window as E2EWindow;
    const room = remoteWindow.__PLAYGRID_E2E__?.app?.gameRoom;
    if (!room) throw new Error("Missing active game room.");
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

async function waitForOutcome(page: Page): Promise<OutcomeSnapshot> {
  return page.evaluate(() => new Promise<OutcomeSnapshot>((resolve) => {
    const remoteWindow = window as E2EWindow;
    const room = remoteWindow.__PLAYGRID_E2E__?.app?.gameRoom;
    if (!room) throw new Error("Missing active game room.");

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

function playerIsConnected(snapshot: GameSnapshot, sessionId: string): boolean {
  const player = snapshot.players.find((p) => p.sessionId === sessionId);
  return player?.isConnected ?? false;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Reconnection E2E", () => {
  test("player reconnects via page reload and resumes the game", async ({ browser }) => {
    const gameName = uniqueName("recon-basic");
    const match = await startMatch(browser, gameName);

    try {
      // Make a move so the game has progressed.
      await playMove(match, 17, 24);
      const boardBeforeDisconnect = (await getSnapshot(match.host.page)).board;

      // Grab session record that the app persisted for reconnection.
      const activeSession = await getActiveSession(match.guest.page);
      expect(activeSession).not.toBeNull();
      expect(activeSession!.reconnectionToken).toBeTruthy();

      // Simulate disconnect: navigate guest away.
      await match.guest.page.goto("about:blank");

      // Remaining player sees opponent as disconnected.
      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(false);

      // Reconnect: navigate back (sessionStorage persists within the same tab).
      await match.guest.page.goto("/?e2e=1");

      // Wait for the E2E harness to appear and reconnection to complete.
      await expect.poll(async () => {
        try {
          const snap = await getSnapshot(match.guest.page);
          return snap.phase;
        } catch {
          return null;
        }
      }, { timeout: 15_000 }).toBe("playing");

      // Remaining player sees opponent as reconnected.
      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(true);

      // Board state is preserved after reconnection.
      const boardAfterReconnect = (await getSnapshot(match.guest.page)).board;
      expect(boardAfterReconnect).toEqual(boardBeforeDisconnect);

      // Game can continue: make another move.
      const snapshot = await getSnapshot(match.host.page);
      const currentTurnPage = snapshot.currentTurn === match.hostSessionId
        ? match.host.page
        : match.guest.page;
      await sendMove(currentTurnPage, snapshot.currentTurn === match.hostSessionId ? 44 : 19, snapshot.currentTurn === match.hostSessionId ? 35 : 28);
      await expect.poll(async () => (await getSnapshot(match.host.page)).board.join(",")).not.toBe(boardBeforeDisconnect.join(","));
    } finally {
      await closeMatch(match);
    }
  });

  test("reconnection timeout results in forfeit for the remaining player", async ({ browser }) => {
    const gameName = uniqueName("recon-timeout");
    const match = await startMatch(browser, gameName);

    try {
      // Make a move to advance the game.
      await playMove(match, 17, 24);

      // Set up outcome listener on remaining player BEFORE the disconnect.
      const hostOutcomePromise = waitForOutcome(match.host.page);

      // Disconnect the guest permanently by closing the context.
      await match.guest.context.close();

      // The server waits 30s (default reconnection window) then ends with forfeit.
      const outcome = await hostOutcomePromise;
      expect(outcome.result.type).toBe("forfeit");
      expect(outcome.result.winnerId).toBe(match.hostSessionId);
      expect(outcome.result.metadata?.reconnectionTimeout).toBe(true);
    } finally {
      // Guest context already closed; only close host.
      await match.host.context.close().catch(() => undefined);
    }
  });

  test("board state is fully preserved across disconnect and reconnect", async ({ browser }) => {
    const gameName = uniqueName("recon-state");
    const match = await startMatch(browser, gameName);

    try {
      // Play several moves to build up meaningful game state.
      await playMove(match, 17, 24);
      await playMove(match, 44, 35);
      await playMove(match, 19, 28);

      // Capture full board state from both players before disconnect.
      const hostBoardBefore = (await getSnapshot(match.host.page)).board;
      const guestBoardBefore = (await getSnapshot(match.guest.page)).board;
      expect(hostBoardBefore).toEqual(guestBoardBefore);

      const snapshotBeforeDisconnect = await getSnapshot(match.host.page);
      const turnBefore = snapshotBeforeDisconnect.currentTurn;
      const turnNumberBefore = snapshotBeforeDisconnect.turnNumber;

      // Disconnect guest via navigation.
      await match.guest.page.goto("about:blank");

      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(false);

      // Reconnect guest.
      await match.guest.page.goto("/?e2e=1");

      await expect.poll(async () => {
        try {
          const snap = await getSnapshot(match.guest.page);
          return snap.phase;
        } catch {
          return null;
        }
      }, { timeout: 15_000 }).toBe("playing");

      // Verify full state preservation.
      const guestAfterReconnect = await getSnapshot(match.guest.page);
      expect(guestAfterReconnect.board).toEqual(hostBoardBefore);
      expect(guestAfterReconnect.currentTurn).toBe(turnBefore);
      expect(guestAfterReconnect.turnNumber).toBe(turnNumberBefore);
      expect(guestAfterReconnect.players).toHaveLength(2);

      const hostAfterReconnect = await getSnapshot(match.host.page);
      expect(hostAfterReconnect.board).toEqual(hostBoardBefore);
    } finally {
      await closeMatch(match);
    }
  });

  test("player reconnects during opponent's turn", async ({ browser }) => {
    const gameName = uniqueName("recon-opp-turn");
    const match = await startMatch(browser, gameName);

    try {
      // Determine who moves first and play one move.
      const initialSnapshot = await getSnapshot(match.host.page);
      const firstPlayer = initialSnapshot.currentTurn === match.hostSessionId ? "host" : "guest";
      const disconnectingPlayer = firstPlayer === "host" ? "guest" : "host";
      const disconnectingSessionId = disconnectingPlayer === "host"
        ? match.hostSessionId
        : match.guestSessionId;

      // After the first move, it's the other player's turn.
      await playMove(match, 17, 24);

      // Verify it's the opponent's turn for the player who will disconnect.
      const afterMove = await getSnapshot(match.host.page);
      expect(afterMove.currentTurn).not.toBe(disconnectingSessionId);

      // Disconnect the player who is waiting for their turn.
      const disconnectingClient = match[disconnectingPlayer];
      await disconnectingClient.page.goto("about:blank");

      const remainingPlayer = disconnectingPlayer === "host" ? "guest" : "host";
      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match[remainingPlayer].page), disconnectingSessionId),
      ).toBe(false);

      // Reconnect.
      await disconnectingClient.page.goto("/?e2e=1");

      await expect.poll(async () => {
        try {
          const snap = await getSnapshot(disconnectingClient.page);
          return snap.phase;
        } catch {
          return null;
        }
      }, { timeout: 15_000 }).toBe("playing");

      // The current turn should still be the same (the reconnecting player was waiting).
      const afterReconnect = await getSnapshot(disconnectingClient.page);
      expect(afterReconnect.currentTurn).toBe(afterMove.currentTurn);

      // The reconnected player is visible as connected again.
      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match[remainingPlayer].page), disconnectingSessionId),
      ).toBe(true);

      // Game continues: the active player makes a move.
      const activePlayerPage = afterReconnect.currentTurn === match.hostSessionId
        ? match.host.page
        : match.guest.page;
      await sendMove(activePlayerPage, 44, 35);
      await expect.poll(async () => {
        const snap = await getSnapshot(match.host.page);
        return snap.board[44];
      }).toBe(0);
    } finally {
      await closeMatch(match);
    }
  });

  test("player reconnects multiple times in the same game", async ({ browser }) => {
    const gameName = uniqueName("recon-multi");
    const match = await startMatch(browser, gameName);

    try {
      // First move.
      await playMove(match, 17, 24);

      // --- First disconnect/reconnect cycle ---
      await match.guest.page.goto("about:blank");

      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(false);

      await match.guest.page.goto("/?e2e=1");

      await expect.poll(async () => {
        try {
          return (await getSnapshot(match.guest.page)).phase;
        } catch {
          return null;
        }
      }, { timeout: 15_000 }).toBe("playing");

      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(true);

      // Continue the game.
      await playMove(match, 44, 35);

      // --- Second disconnect/reconnect cycle ---
      await match.guest.page.goto("about:blank");

      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(false);

      await match.guest.page.goto("/?e2e=1");

      await expect.poll(async () => {
        try {
          return (await getSnapshot(match.guest.page)).phase;
        } catch {
          return null;
        }
      }, { timeout: 15_000 }).toBe("playing");

      await expect.poll(
        async () => playerIsConnected(await getSnapshot(match.host.page), match.guestSessionId),
      ).toBe(true);

      // Verify the board still reflects all moves played.
      const finalSnapshot = await getSnapshot(match.guest.page);
      expect(finalSnapshot.board[17]).toBe(0); // empty after first move
      expect(finalSnapshot.board[24]).toBe(1); // black piece from first move
      expect(finalSnapshot.board[44]).toBe(0); // empty after second move
      expect(finalSnapshot.board[35]).toBe(2); // red piece from second move
      expect(finalSnapshot.players).toHaveLength(2);
    } finally {
      await closeMatch(match);
    }
  });
});

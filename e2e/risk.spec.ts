import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 4)}`;
}

// ---------------------------------------------------------------------------
// Remote types (mirrors what the Colyseus client exposes via the E2E harness)
// ---------------------------------------------------------------------------

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

type RemoteTerritory = {
  owner?: unknown;
  armyCount?: unknown;
};

type RemoteTerritories = {
  entries: () => Iterable<[string, RemoteTerritory]>;
  get: (key: string) => RemoteTerritory | undefined;
};

type RemoteRiskPlayer = {
  sessionId?: unknown;
  cardsHeld?: unknown;
  territoriesOwned?: unknown;
  armiesToPlace?: unknown;
};

type RemoteRiskPlayers = {
  entries: () => Iterable<[string, RemoteRiskPlayer]>;
  get: (key: string) => RemoteRiskPlayer | undefined;
};

type RemoteState = {
  phase?: unknown;
  currentTurn?: unknown;
  turnNumber?: unknown;
  gamePhase?: unknown;
  turnPhase?: unknown;
  earnedCardThisTurn?: unknown;
  players?: RemotePlayers;
  territories?: RemoteTerritories;
  riskPlayers?: RemoteRiskPlayers;
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
  phaseText?: RemoteText;
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

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

type TerritorySnapshot = {
  owner: string;
  armyCount: number;
};

type RiskPlayerSnapshot = {
  sessionId: string;
  cardsHeld: number;
  territoriesOwned: number;
  armiesToPlace: number;
};

type PlayerSnapshot = {
  sessionId: string;
  playerIndex: number;
  isConnected: boolean;
  isSpectator: boolean;
};

type RiskSnapshot = {
  sessionId: string | null;
  roomId: string | null;
  phase: string | null;
  currentTurn: string | null;
  turnNumber: number | null;
  gamePhase: string | null;
  turnPhase: string | null;
  territories: Record<string, TerritorySnapshot>;
  riskPlayers: Record<string, RiskPlayerSnapshot>;
  statusText: string | null;
  phaseText: string | null;
  players: PlayerSnapshot[];
};

type RoomErrorPayload = {
  message: string;
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

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function lobbyOverlay(page: Page): Locator {
  return page.locator("#lobby-overlay.visible");
}

function waitingRoomOverlay(page: Page): Locator {
  return page.locator("#waiting-room-overlay.visible");
}

function activeGameCard(page: Page, gameName: string): Locator {
  return page.locator(".active-game-card").filter({ hasText: gameName });
}

async function savePlayerName(page: Page, displayName: string): Promise<void> {
  const playerNameInput = page.locator('input[name="player-name"]');
  await playerNameInput.fill(displayName);
  await playerNameInput.blur();
  await expect(page.locator(".lobby-notice.visible")).toHaveText("Player name saved.");
  await expect(playerNameInput).toHaveValue(displayName.trim());
}

async function createRiskGame(page: Page, gameName: string): Promise<void> {
  await page.getByRole("button", { name: "Create Game", exact: true }).click();

  const createGameModal = page.locator("#create-game-modal.visible");
  await expect(createGameModal).toBeVisible();
  await createGameModal.locator('input[name="game-name"]').fill(gameName);
  await createGameModal.locator('select[name="game-type"]').selectOption("risk");
  await createGameModal.getByRole("button", { name: "Create Game", exact: true }).click();
}

// ---------------------------------------------------------------------------
// E2E harness helpers
// ---------------------------------------------------------------------------

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
  const host = await openLobbyPlayer(browser, uniqueName("risk-host"));
  const guest = await openLobbyPlayer(browser, uniqueName("risk-guest"));

  await createRiskGame(host.page, gameName);

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
    match.host.context.close(),
    match.guest.context.close(),
  ]);
}

async function getSnapshot(page: Page): Promise<RiskSnapshot> {
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

    const territories: Record<string, { owner: string; armyCount: number }> = {};
    if (state?.territories && typeof state.territories.entries === "function") {
      for (const [id, territory] of state.territories.entries()) {
        territories[id] = {
          owner: typeof territory.owner === "string" ? territory.owner : "",
          armyCount: typeof territory.armyCount === "number" ? territory.armyCount : 0,
        };
      }
    }

    const riskPlayers: Record<string, { sessionId: string; cardsHeld: number; territoriesOwned: number; armiesToPlace: number }> = {};
    if (state?.riskPlayers && typeof state.riskPlayers.entries === "function") {
      for (const [id, rp] of state.riskPlayers.entries()) {
        riskPlayers[id] = {
          sessionId: typeof rp.sessionId === "string" ? rp.sessionId : "",
          cardsHeld: typeof rp.cardsHeld === "number" ? rp.cardsHeld : 0,
          territoriesOwned: typeof rp.territoriesOwned === "number" ? rp.territoriesOwned : 0,
          armiesToPlace: typeof rp.armiesToPlace === "number" ? rp.armiesToPlace : 0,
        };
      }
    }

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
      gamePhase: typeof state?.gamePhase === "string" ? state.gamePhase : null,
      turnPhase: typeof state?.turnPhase === "string" ? state.turnPhase : null,
      territories,
      riskPlayers,
      statusText: typeof renderer?.statusText?.text === "string" ? renderer.statusText.text : null,
      phaseText: typeof renderer?.phaseText?.text === "string" ? renderer.phaseText.text : null,
      players,
    } satisfies RiskSnapshot;
  });
}

async function sendAction(page: Page, actionType: string, payload?: unknown): Promise<void> {
  await page.evaluate(({ action, data }) => {
    const remoteWindow = window as E2EWindow;
    const remoteApp = remoteWindow.__PLAYGRID_E2E__?.app;
    if (!remoteApp) {
      throw new Error("E2E harness is not available.");
    }

    const room = remoteApp.gameRoom;
    if (!room) {
      throw new Error("Missing active game room.");
    }

    room.send(action, data);
  }, { action: actionType, data: payload });
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

/**
 * Polls getSnapshot until territory state differs from the baseline.
 * Replaces flaky timeout-based detection for attack/fortify success.
 */
async function waitForTerritoryChange(
  page: Page,
  baselineTerritories: Record<string, { owner: string; armyCount: number }>,
): Promise<void> {
  const baseline = JSON.stringify(baselineTerritories);
  await expect.poll(async () => {
    const s = await getSnapshot(page);
    return JSON.stringify(s.territories);
  }, { timeout: 5000 }).not.toBe(baseline);
}

// ---------------------------------------------------------------------------
// Game flow helpers
// ---------------------------------------------------------------------------

function getPageForSession(match: StartedMatch, sessionId: string): Page {
  return sessionId === match.hostSessionId ? match.host.page : match.guest.page;
}

function getOwnedTerritoryIds(snapshot: RiskSnapshot, sessionId: string): string[] {
  return Object.entries(snapshot.territories)
    .filter(([, t]) => t.owner === sessionId)
    .map(([id]) => id);
}

/**
 * Place all remaining setup armies for the current player on their first owned territory.
 * Waits for the state to reflect 0 armiesToPlace.
 */
async function placeAllSetupArmies(match: StartedMatch): Promise<void> {
  const snapshot = await getSnapshot(match.host.page);
  const currentSessionId = snapshot.currentTurn;
  if (!currentSessionId) throw new Error("No current turn player.");

  const page = getPageForSession(match, currentSessionId);
  const playerSnapshot = await getSnapshot(page);
  const riskPlayer = playerSnapshot.riskPlayers[currentSessionId];
  if (!riskPlayer || riskPlayer.armiesToPlace === 0) return;

  const ownedTerritories = getOwnedTerritoryIds(playerSnapshot, currentSessionId);
  if (ownedTerritories.length === 0) throw new Error("Player owns no territories.");

  // Place all armies on the first owned territory in bulk
  await sendAction(page, "placeArmy", {
    territoryId: ownedTerritories[0],
    count: riskPlayer.armiesToPlace,
  });

  // Wait for armiesToPlace to reach 0
  await expect.poll(async () => {
    const s = await getSnapshot(page);
    return s.riskPlayers[currentSessionId]?.armiesToPlace ?? -1;
  }).toBe(0);
}

/**
 * Complete the setup phase: both players place all armies, then endPhase to transition.
 * After this, the game should be in gamePhase="playing", turnPhase="reinforce".
 */
async function completeSetupPhase(match: StartedMatch): Promise<void> {
  // Player 1 places all setup armies (auto ends turn)
  await placeAllSetupArmies(match);

  // Player 2 places all setup armies (auto ends turn)
  await placeAllSetupArmies(match);

  // Now the active player calls endPhase to transition from setup to playing
  const snapshot = await getSnapshot(match.host.page);
  const currentSessionId = snapshot.currentTurn;
  if (!currentSessionId) throw new Error("No current turn after setup.");
  const page = getPageForSession(match, currentSessionId);
  await sendAction(page, "endPhase", {});

  // Wait for gamePhase to be "playing" and turnPhase to be "reinforce"
  await expect.poll(async () => {
    const s = await getSnapshot(match.host.page);
    return s.gamePhase;
  }).toBe("playing");
  await expect.poll(async () => {
    const s = await getSnapshot(match.host.page);
    return s.turnPhase;
  }).toBe("reinforce");
}

/**
 * Place all reinforcement armies for the current player on their first owned territory.
 * This advances turnPhase from "reinforce" to "attack".
 */
async function placeAllReinforcements(match: StartedMatch): Promise<void> {
  const snapshot = await getSnapshot(match.host.page);
  const currentSessionId = snapshot.currentTurn;
  if (!currentSessionId) throw new Error("No current turn player.");

  const page = getPageForSession(match, currentSessionId);
  const playerSnapshot = await getSnapshot(page);
  const riskPlayer = playerSnapshot.riskPlayers[currentSessionId];
  if (!riskPlayer || riskPlayer.armiesToPlace === 0) return;

  const ownedTerritories = getOwnedTerritoryIds(playerSnapshot, currentSessionId);
  await sendAction(page, "placeArmy", {
    territoryId: ownedTerritories[0],
    count: riskPlayer.armiesToPlace,
  });

  // Wait for transition to attack phase
  await expect.poll(async () => {
    const s = await getSnapshot(page);
    return s.turnPhase;
  }).toBe("attack");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Risk E2E — Game creation and joining", () => {
  test("creates a Risk game from lobby and a second player joins", async ({ browser }) => {
    const gameName = `Risk-join-${Date.now()}`;
    const match = await startMatch(browser, gameName);

    try {
      const [hostSnapshot, guestSnapshot] = await Promise.all([
        getSnapshot(match.host.page),
        getSnapshot(match.guest.page),
      ]);

      // Both players see "playing" base phase
      expect(hostSnapshot.phase).toBe("playing");
      expect(guestSnapshot.phase).toBe("playing");

      // Risk starts in setup phase with setup-place (auto-distributed territories)
      expect(hostSnapshot.gamePhase).toBe("setup");
      expect(hostSnapshot.turnPhase).toBe("setup-place");

      // Both players see 2 players
      expect(hostSnapshot.players).toHaveLength(2);
      expect(guestSnapshot.players).toHaveLength(2);

      // All 42 territories are distributed between 2 players
      const territoryIds = Object.keys(hostSnapshot.territories);
      expect(territoryIds).toHaveLength(42);

      const hostOwned = getOwnedTerritoryIds(hostSnapshot, match.hostSessionId);
      const guestOwned = getOwnedTerritoryIds(hostSnapshot, match.guestSessionId);
      expect(hostOwned.length + guestOwned.length).toBe(42);
      expect(hostOwned.length).toBeGreaterThanOrEqual(20);
      expect(guestOwned.length).toBeGreaterThanOrEqual(20);

      // Each territory starts with 1 army
      for (const [, territory] of Object.entries(hostSnapshot.territories)) {
        expect(territory.armyCount).toBe(1);
      }

      // Both players have armies to place (40 initial - territories owned)
      const hostRiskPlayer = hostSnapshot.riskPlayers[match.hostSessionId];
      const guestRiskPlayer = hostSnapshot.riskPlayers[match.guestSessionId];
      expect(hostRiskPlayer).toBeDefined();
      expect(guestRiskPlayer).toBeDefined();
      expect(hostRiskPlayer.armiesToPlace).toBe(40 - hostOwned.length);
      expect(guestRiskPlayer.armiesToPlace).toBe(40 - guestOwned.length);

      // Both clients see the same territory state
      const guestTerritoryIds = Object.keys(guestSnapshot.territories);
      expect(guestTerritoryIds).toHaveLength(42);
      for (const id of territoryIds) {
        expect(guestSnapshot.territories[id]?.owner).toBe(hostSnapshot.territories[id]?.owner);
        expect(guestSnapshot.territories[id]?.armyCount).toBe(hostSnapshot.territories[id]?.armyCount);
      }

      // HUD displays current turn status
      const currentTurnPage = getPageForSession(match, hostSnapshot.currentTurn!);
      const currentSnapshot = await getSnapshot(currentTurnPage);
      expect(currentSnapshot.statusText).toBe("Your turn");
      expect(currentSnapshot.phaseText).toBe("Setup • Place Armies");
    } finally {
      await closeMatch(match);
    }
  });
});

test.describe("Risk E2E — Setup phase", () => {
  test("players place initial armies and transition to playing phase", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-setup-${Date.now()}`);

    try {
      const beforeSetup = await getSnapshot(match.host.page);
      expect(beforeSetup.gamePhase).toBe("setup");
      expect(beforeSetup.turnPhase).toBe("setup-place");

      // Complete the entire setup phase
      await completeSetupPhase(match);

      const afterSetup = await getSnapshot(match.host.page);
      expect(afterSetup.gamePhase).toBe("playing");
      expect(afterSetup.turnPhase).toBe("reinforce");

      // Both players should have 0 armies to place (setup exhausted)
      // The current player now has reinforcements calculated for the playing phase
      const currentId = afterSetup.currentTurn!;
      const currentPlayer = afterSetup.riskPlayers[currentId];
      expect(currentPlayer.armiesToPlace).toBeGreaterThanOrEqual(3);

      // Territories should have more armies than the initial 1
      const currentOwned = getOwnedTerritoryIds(afterSetup, currentId);
      const totalArmies = currentOwned.reduce(
        (sum, id) => sum + afterSetup.territories[id].armyCount, 0,
      );
      expect(totalArmies).toBeGreaterThan(currentOwned.length);

      // Both players see the same game state
      const guestAfter = await getSnapshot(match.guest.page);
      expect(guestAfter.gamePhase).toBe("playing");
      expect(guestAfter.turnPhase).toBe("reinforce");
    } finally {
      await closeMatch(match);
    }
  });

  test("rejects placing armies on a territory owned by the opponent", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-place-err-${Date.now()}`);

    try {
      const snapshot = await getSnapshot(match.host.page);
      const currentId = snapshot.currentTurn!;
      const opponentId = currentId === match.hostSessionId ? match.guestSessionId : match.hostSessionId;
      const page = getPageForSession(match, currentId);

      // Find a territory owned by the opponent
      const opponentTerritories = getOwnedTerritoryIds(snapshot, opponentId);
      expect(opponentTerritories.length).toBeGreaterThan(0);

      const errorPromise = waitForRoomError(page);
      await sendAction(page, "placeArmy", { territoryId: opponentTerritories[0] });
      await expect(errorPromise).resolves.toEqual({ message: "Invalid action." });

      // State should be unchanged
      const after = await getSnapshot(page);
      expect(after.turnPhase).toBe("setup-place");
      expect(after.currentTurn).toBe(currentId);
    } finally {
      await closeMatch(match);
    }
  });
});

test.describe("Risk E2E — Troop deployment (reinforce phase)", () => {
  test("places reinforcement armies on owned territory and advances to attack phase", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-reinforce-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const snapshot = await getSnapshot(match.host.page);
      expect(snapshot.turnPhase).toBe("reinforce");
      const currentId = snapshot.currentTurn!;
      const page = getPageForSession(match, currentId);

      const riskPlayer = snapshot.riskPlayers[currentId];
      expect(riskPlayer.armiesToPlace).toBeGreaterThanOrEqual(3);

      const ownedTerritories = getOwnedTerritoryIds(snapshot, currentId);
      const targetTerritory = ownedTerritories[0];
      const armiesBefore = snapshot.territories[targetTerritory].armyCount;

      // Place all reinforcement armies
      await sendAction(page, "placeArmy", {
        territoryId: targetTerritory,
        count: riskPlayer.armiesToPlace,
      });

      // Should transition to attack phase
      await expect.poll(async () => {
        const s = await getSnapshot(page);
        return s.turnPhase;
      }).toBe("attack");

      const after = await getSnapshot(page);
      expect(after.territories[targetTerritory].armyCount).toBe(
        armiesBefore + riskPlayer.armiesToPlace,
      );
      expect(after.riskPlayers[currentId].armiesToPlace).toBe(0);
      expect(after.phaseText).toBe("Attack Phase");
    } finally {
      await closeMatch(match);
    }
  });
});

test.describe("Risk E2E — Attack phase", () => {
  test("attacks an adjacent enemy territory and resolves combat", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-attack-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const reinforceSnapshot = await getSnapshot(match.host.page);
      const currentId = reinforceSnapshot.currentTurn!;
      const page = getPageForSession(match, currentId);
      // Place reinforcements to get to attack phase
      await placeAllReinforcements(match);

      const attackSnapshot = await getSnapshot(page);
      expect(attackSnapshot.turnPhase).toBe("attack");

      // Find an owned territory with enough armies to attack (need > 1)
      const ownedTerritories = getOwnedTerritoryIds(attackSnapshot, currentId);
      const allEnemyIds = Object.entries(attackSnapshot.territories)
        .filter(([, t]) => t.owner !== currentId && t.owner !== "")
        .map(([id]) => id);

      // Try attacks from owned territories to enemies — the server accepts adjacent ones
      let attackSucceeded = false;

      for (const ownedId of ownedTerritories) {
        if (attackSnapshot.territories[ownedId].armyCount <= 1) continue;
        for (const enemyId of allEnemyIds) {
          const errorPromise = waitForRoomError(page);
          const attackerDice = Math.min(3, attackSnapshot.territories[ownedId].armyCount - 1);
          const beforeAttack = await getSnapshot(page);
          await sendAction(page, "attack", {
            from: ownedId,
            to: enemyId,
            attackerDice,
          });

          const result = await Promise.race([
            errorPromise.then(() => "error" as const),
            waitForTerritoryChange(page, beforeAttack.territories).then(() => "ok" as const),
          ]);

          if (result === "ok") {
            attackSucceeded = true;
            break;
          }
        }
        if (attackSucceeded) break;
      }

      expect(attackSucceeded).toBe(true);

      // Verify the state changed: armies should have decreased on attacker and/or defender
      const afterAttack = await getSnapshot(page);
      // The game should still be in attack phase (not ended unless all territories conquered)
      expect(afterAttack.turnPhase).toBe("attack");

      // Both players see the same state
      const otherPage = currentId === match.hostSessionId ? match.guest.page : match.host.page;
      await expect.poll(async () => {
        const s = await getSnapshot(otherPage);
        return JSON.stringify(s.territories);
      }).toBe(JSON.stringify(afterAttack.territories));
    } finally {
      await closeMatch(match);
    }
  });

  test("rejects attack when it's not attack phase", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-atk-phase-err-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const snapshot = await getSnapshot(match.host.page);
      expect(snapshot.turnPhase).toBe("reinforce");
      const currentId = snapshot.currentTurn!;
      const page = getPageForSession(match, currentId);

      // Try to attack during reinforce phase — should be rejected
      const errorPromise = waitForRoomError(page);
      await sendAction(page, "attack", {
        from: "alaska",
        to: "kamchatka",
        attackerDice: 1,
      });
      await expect(errorPromise).resolves.toEqual({ message: "Invalid action." });
    } finally {
      await closeMatch(match);
    }
  });
});

test.describe("Risk E2E — Turn phases and transitions", () => {
  test("transitions through reinforce → attack → fortify → end turn correctly", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-phases-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const snapshot = await getSnapshot(match.host.page);
      const currentId = snapshot.currentTurn!;
      const page = getPageForSession(match, currentId);

      // Phase 1: Reinforce
      expect(snapshot.turnPhase).toBe("reinforce");
      expect(snapshot.phaseText).toBe("Reinforce Phase");

      // Place all reinforcements → transitions to attack
      await placeAllReinforcements(match);

      const attackSnapshot = await getSnapshot(page);
      expect(attackSnapshot.turnPhase).toBe("attack");
      expect(attackSnapshot.phaseText).toBe("Attack Phase");

      // Phase 2: Skip attack → end phase → transitions to fortify
      await sendAction(page, "endPhase", {});
      await expect.poll(async () => {
        const s = await getSnapshot(page);
        return s.turnPhase;
      }).toBe("fortify");

      const fortifySnapshot = await getSnapshot(page);
      expect(fortifySnapshot.phaseText).toBe("Fortify Phase");

      // Phase 3: Skip fortify → end phase → ends turn → next player's reinforce
      await sendAction(page, "endPhase", {});

      // Turn should advance to the other player
      await expect.poll(async () => {
        const s = await getSnapshot(match.host.page);
        return s.currentTurn;
      }).not.toBe(currentId);

      const nextTurnSnapshot = await getSnapshot(match.host.page);
      expect(nextTurnSnapshot.turnPhase).toBe("reinforce");

      // New player should have reinforcements to place
      const nextId = nextTurnSnapshot.currentTurn!;
      const nextPlayer = nextTurnSnapshot.riskPlayers[nextId];
      expect(nextPlayer.armiesToPlace).toBeGreaterThanOrEqual(3);

      // Other player's page should show the right status
      const otherPage = getPageForSession(match, nextId);
      const otherSnapshot = await getSnapshot(otherPage);
      expect(otherSnapshot.statusText).toBe("Your turn");
    } finally {
      await closeMatch(match);
    }
  });

  test("second player can take their full turn after first player ends", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-turn2-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const snapshot = await getSnapshot(match.host.page);
      const firstPlayerId = snapshot.currentTurn!;
      const firstPage = getPageForSession(match, firstPlayerId);

      // First player: reinforce → skip attack → skip fortify → end turn
      await placeAllReinforcements(match);
      await sendAction(firstPage, "endPhase", {}); // skip attack → fortify
      await expect.poll(async () => (await getSnapshot(firstPage)).turnPhase).toBe("fortify");
      await sendAction(firstPage, "endPhase", {}); // skip fortify → end turn

      // Second player's turn
      const secondPlayerId = firstPlayerId === match.hostSessionId
        ? match.guestSessionId
        : match.hostSessionId;

      await expect.poll(async () => {
        const s = await getSnapshot(match.host.page);
        return s.currentTurn;
      }).toBe(secondPlayerId);

      const secondPage = getPageForSession(match, secondPlayerId);
      const secondSnapshot = await getSnapshot(secondPage);
      expect(secondSnapshot.turnPhase).toBe("reinforce");
      expect(secondSnapshot.statusText).toBe("Your turn");
      expect(secondSnapshot.riskPlayers[secondPlayerId].armiesToPlace).toBeGreaterThanOrEqual(3);

      // Second player places reinforcements
      const ownedTerritories = getOwnedTerritoryIds(secondSnapshot, secondPlayerId);
      await sendAction(secondPage, "placeArmy", {
        territoryId: ownedTerritories[0],
        count: secondSnapshot.riskPlayers[secondPlayerId].armiesToPlace,
      });

      await expect.poll(async () => {
        const s = await getSnapshot(secondPage);
        return s.turnPhase;
      }).toBe("attack");

      // Second player skips attack and fortify
      await sendAction(secondPage, "endPhase", {});
      await expect.poll(async () => (await getSnapshot(secondPage)).turnPhase).toBe("fortify");
      await sendAction(secondPage, "endPhase", {});

      // Should be back to first player
      await expect.poll(async () => {
        const s = await getSnapshot(match.host.page);
        return s.currentTurn;
      }).toBe(firstPlayerId);
    } finally {
      await closeMatch(match);
    }
  });
});

test.describe("Risk E2E — Fortification", () => {
  test("moves troops between connected owned territories during fortify phase", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-fortify-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const snapshot = await getSnapshot(match.host.page);
      const currentId = snapshot.currentTurn!;
      const page = getPageForSession(match, currentId);

      // Reinforce → Attack → Fortify
      await placeAllReinforcements(match);
      await sendAction(page, "endPhase", {}); // skip attack → fortify
      await expect.poll(async () => (await getSnapshot(page)).turnPhase).toBe("fortify");

      // Find two adjacent owned territories where the source has > 1 army
      const fortifySnapshot = await getSnapshot(page);
      const ownedTerritories = getOwnedTerritoryIds(fortifySnapshot, currentId);
      const heavyTerritories = ownedTerritories
        .filter((id) => fortifySnapshot.territories[id].armyCount > 1)
        .sort((a, b) => fortifySnapshot.territories[b].armyCount - fortifySnapshot.territories[a].armyCount);

      // Try to fortify from the heaviest territory to any adjacent owned territory
      let fortifySucceeded = false;
      let fromId = "";
      let toId = "";
      let movedCount = 0;

      for (const heavyId of heavyTerritories) {
        for (const otherId of ownedTerritories) {
          if (otherId === heavyId) continue;
          const errorPromise = waitForRoomError(page);
          const count = 1;
          const beforeFortify = await getSnapshot(page);
          await sendAction(page, "fortify", { from: heavyId, to: otherId, count });

          const result = await Promise.race([
            errorPromise.then(() => "error" as const),
            waitForTerritoryChange(page, beforeFortify.territories).then(() => "ok" as const),
          ]);

          if (result === "ok") {
            fortifySucceeded = true;
            fromId = heavyId;
            toId = otherId;
            movedCount = count;
            break;
          }
        }
        if (fortifySucceeded) break;
      }

      expect(fortifySucceeded).toBe(true);

      // Verify armies moved correctly
      const afterFortify = await getSnapshot(page);
      expect(afterFortify.territories[fromId].armyCount).toBe(
        fortifySnapshot.territories[fromId].armyCount - movedCount,
      );
      expect(afterFortify.territories[toId].armyCount).toBe(
        fortifySnapshot.territories[toId].armyCount + movedCount,
      );

      // Fortify ends the turn — should advance to next player
      await expect.poll(async () => {
        const s = await getSnapshot(match.host.page);
        return s.currentTurn;
      }).not.toBe(currentId);
    } finally {
      await closeMatch(match);
    }
  });

  test("rejects fortification to a non-adjacent or non-owned territory", async ({ browser }) => {
    const match = await startMatch(browser, `Risk-fortify-err-${Date.now()}`);

    try {
      await completeSetupPhase(match);

      const snapshot = await getSnapshot(match.host.page);
      const currentId = snapshot.currentTurn!;
      const opponentId = currentId === match.hostSessionId ? match.guestSessionId : match.hostSessionId;
      const page = getPageForSession(match, currentId);

      // Reinforce → Attack → Fortify
      await placeAllReinforcements(match);
      await sendAction(page, "endPhase", {});
      await expect.poll(async () => (await getSnapshot(page)).turnPhase).toBe("fortify");

      const fortifySnapshot = await getSnapshot(page);
      const ownedTerritories = getOwnedTerritoryIds(fortifySnapshot, currentId);
      const enemyTerritories = getOwnedTerritoryIds(fortifySnapshot, opponentId);

      // Try to fortify to an enemy territory
      const errorPromise = waitForRoomError(page);
      await sendAction(page, "fortify", {
        from: ownedTerritories[0],
        to: enemyTerritories[0],
        count: 1,
      });
      await expect(errorPromise).resolves.toEqual({ message: "Invalid action." });
    } finally {
      await closeMatch(match);
    }
  });
});

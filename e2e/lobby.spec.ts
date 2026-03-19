import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

type LobbySession = {
  context: BrowserContext;
  page: Page;
};

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function lobbyOverlay(page: Page): Locator {
  return page.locator("#lobby-overlay.visible");
}

function setupOverlay(page: Page): Locator {
  return page.locator("#setup-overlay.visible");
}

function activeGameCard(page: Page, gameName: string): Locator {
  return page.locator(".active-game-card").filter({ hasText: gameName });
}

async function openLobby(browser: Browser, displayName?: string): Promise<LobbySession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(lobbyOverlay(page)).toBeVisible();

  if (displayName) {
    await savePlayerName(page, displayName);
  }

  return { context, page };
}

async function savePlayerName(page: Page, displayName: string): Promise<void> {
  const playerNameInput = page.locator('input[name="player-name"]');
  await playerNameInput.fill(displayName);
  await playerNameInput.blur();
  // Verify the name was actually saved: input reflects trimmed value and lobby reconnects
  const trimmed = displayName.trim();
  await expect(playerNameInput).toHaveValue(trimmed);
  await expect(lobbyOverlay(page)).toBeVisible();
  // Wait for lobby reconnection to complete (player appears in online list)
  await expect(page.locator(".online-player-name", { hasText: trimmed })).toBeVisible();
}

async function createGame(page: Page, gameName: string): Promise<void> {
  await page.locator(".create-game-trigger").click();

  const createGameModal = page.locator("#create-game-modal.visible");
  await expect(createGameModal).toBeVisible();
  await createGameModal.locator('input[name="game-name"]').fill(gameName);
  await createGameModal.locator('select[name="game-type"]').selectOption("checkers");
  await createGameModal.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(setupOverlay(page)).toBeVisible();
}

test.describe("lobby e2e", () => {
  test("validates player names and carries the saved name into the waiting room", async ({ browser }) => {
    const { context, page } = await openLobby(browser);

    try {
      const playerNameInput = page.locator('input[name="player-name"]');
      await playerNameInput.fill("   ");
      await playerNameInput.blur();
      await expect(page.locator(".console-log-preview")).toContainText("Player name is required.");

      await savePlayerName(page, "  Steeply Host  ");

      const gameName = uniqueName("validation");
      await createGame(page, gameName);

      const hostPlayer = setupOverlay(page).locator(".setup-player-card");
      await expect(setupOverlay(page).locator(".setup-player-name")).toHaveText(["Steeply Host"]);
      await expect(hostPlayer).toContainText("You");
      await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
    } finally {
      await context.close().catch(() => undefined);
    }
  });

  test("updates other lobby clients when games are created and removed", async ({ browser }) => {
    const host = await openLobby(browser, "Host Remove");
    const spectator = await openLobby(browser, "Spectator");

    try {
      const gameName = uniqueName("removal");
      await expect(activeGameCard(spectator.page, gameName)).toHaveCount(0);

      await createGame(host.page, gameName);

      const spectatorCard = activeGameCard(spectator.page, gameName);
      await expect(spectatorCard).toContainText(gameName);
      await expect(spectatorCard).toContainText("1/2");
      await expect(spectatorCard).toContainText("Waiting");
      await expect(spectatorCard.getByRole("button", { name: "Join" })).toBeVisible();

      await host.page.getByRole("button", { name: "Back to Lobby" }).click();
      await expect(lobbyOverlay(host.page)).toBeVisible();
      await expect(activeGameCard(spectator.page, gameName)).toHaveCount(0);
    } finally {
      await Promise.all([host.context.close(), spectator.context.close()].map((result) => result.catch(() => undefined)));
    }
  });

  test("lets a second player join from the lobby and shows both players across clients", async ({ browser }) => {
    const host = await openLobby(browser, "Host Player");
    const guest = await openLobby(browser, "Guest Player");
    const spectator = await openLobby(browser, "Lobby Watcher");

    try {
      const gameName = uniqueName("multiplayer");
      await createGame(host.page, gameName);

      const guestCard = activeGameCard(guest.page, gameName);
      await expect(guestCard).toContainText(gameName);
      await expect(guestCard).toContainText("1/2");
      await expect(guestCard).toContainText("Waiting");
      await guestCard.getByRole("button", { name: "Join" }).click();

      await expect(setupOverlay(guest.page)).toBeVisible();
      await expect(setupOverlay(host.page).locator(".setup-player-list")).toContainText("Host Player");
      await expect(setupOverlay(host.page).locator(".setup-player-list")).toContainText("Guest Player");
      await expect(setupOverlay(guest.page).locator(".setup-player-list")).toContainText("Host Player");
      await expect(setupOverlay(guest.page).locator(".setup-player-list")).toContainText("Guest Player");

      await expect(host.page.getByRole("button", { name: "Waiting for players" })).toBeVisible();
      await expect(host.page.getByRole("button", { name: "Waiting for players" })).toBeDisabled();
      await expect(host.page.getByRole("button", { name: /^✓ Ready$/ })).toBeHidden();
      await expect(guest.page.getByRole("button", { name: /^✓ Ready$/ })).toBeVisible();
      await expect(guest.page.getByRole("button", { name: "Start Game" })).toBeHidden();

      const spectatorCard = activeGameCard(spectator.page, gameName);
      await expect(spectatorCard).toContainText(gameName);
      await expect(spectatorCard).toContainText("2/2");
      await expect(spectatorCard).toContainText("Waiting");
      await expect(spectatorCard.getByRole("button", { name: "Join" })).toHaveCount(0);
    } finally {
      await Promise.all([
        host.context.close(),
        guest.context.close(),
        spectator.context.close(),
      ].map((result) => result.catch(() => undefined)));
    }
  });
});

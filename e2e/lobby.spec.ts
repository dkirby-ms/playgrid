import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

type LobbySession = {
  context: BrowserContext;
  page: Page;
};

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function lobbyOverlay(page: Page) {
  return page.locator("#lobby-overlay.visible");
}

function waitingRoomOverlay(page: Page) {
  return page.locator("#waiting-room-overlay.visible");
}

function gameRow(page: Page, gameName: string) {
  return page.locator(".lobby-table tbody tr").filter({ hasText: gameName });
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
  await page.locator('input[name="player-name"]').fill(displayName);
  await page.getByRole("button", { name: "Save Name" }).click();
  await expect(page.locator(".lobby-notice.visible")).toHaveText("Player name saved.");
  await expect(lobbyOverlay(page)).toBeVisible();
}

async function createGame(page: Page, gameName: string): Promise<void> {
  await page.locator('input[name="game-name"]').fill(gameName);
  await page.getByRole("button", { name: "Create Game" }).click();
  await expect(waitingRoomOverlay(page)).toBeVisible();
}

test.describe("lobby e2e", () => {
  test("validates player names and carries the saved name into the waiting room", async ({ browser }) => {
    const { context, page } = await openLobby(browser);

    try {
      await page.locator('input[name="player-name"]').fill("   ");
      await page.getByRole("button", { name: "Save Name" }).click();
      await expect(page.locator(".lobby-notice.visible")).toHaveText("Player name is required.");

      await savePlayerName(page, "  Steeply Host  ");

      const gameName = uniqueName("validation");
      await createGame(page, gameName);

      const hostPlayer = waitingRoomOverlay(page).locator(".waiting-room-player");
      await expect(waitingRoomOverlay(page).locator(".waiting-room-player-name")).toHaveText("Steeply Host");
      await expect(hostPlayer).toContainText("Host");
      await expect(hostPlayer).toContainText("You");
    } finally {
      await context.close();
    }
  });

  test("updates other lobby clients when games are created and removed", async ({ browser }) => {
    const host = await openLobby(browser, "Host Remove");
    const spectator = await openLobby(browser, "Spectator");

    try {
      await expect(spectator.page.locator(".lobby-empty-row")).toContainText("No sessions available yet");

      const gameName = uniqueName("removal");
      await createGame(host.page, gameName);

      const spectatorRow = gameRow(spectator.page, gameName);
      await expect(spectatorRow).toContainText(gameName);
      await expect(spectatorRow).toContainText("Host Remove");
      await expect(spectatorRow).toContainText("1/2");
      await expect(spectatorRow).toContainText("Waiting");

      await host.page.getByRole("button", { name: "Leave" }).click();
      await expect(lobbyOverlay(host.page)).toBeVisible();
      await expect(spectatorRow).toHaveCount(0);
      await expect(spectator.page.locator(".lobby-empty-row")).toContainText("No sessions available yet");
    } finally {
      await Promise.all([host.context.close(), spectator.context.close()]);
    }
  });

  test("lets a second player join from the lobby and shows both players across clients", async ({ browser }) => {
    const host = await openLobby(browser, "Host Player");
    const guest = await openLobby(browser, "Guest Player");
    const spectator = await openLobby(browser, "Lobby Watcher");

    try {
      const gameName = uniqueName("multiplayer");
      await createGame(host.page, gameName);

      const guestRow = gameRow(guest.page, gameName);
      await expect(guestRow).toContainText(gameName);
      await expect(guestRow).toContainText("Host Player");
      await expect(guestRow).toContainText("1/2");
      await expect(guestRow).toContainText("Waiting");
      await guestRow.getByRole("button", { name: "Join" }).click();

      await expect(waitingRoomOverlay(guest.page)).toBeVisible();
      await expect(waitingRoomOverlay(host.page).locator(".waiting-room-player-list")).toContainText("Host Player");
      await expect(waitingRoomOverlay(host.page).locator(".waiting-room-player-list")).toContainText("Guest Player");
      await expect(waitingRoomOverlay(guest.page).locator(".waiting-room-player-list")).toContainText("Host Player");
      await expect(waitingRoomOverlay(guest.page).locator(".waiting-room-player-list")).toContainText("Guest Player");

      await expect(host.page.getByRole("button", { name: "Start Game" })).toBeVisible();
      await expect(host.page.getByRole("button", { name: "Ready" })).toHaveCount(0);
      await expect(guest.page.getByRole("button", { name: "Ready" })).toBeVisible();
      await expect(guest.page.getByRole("button", { name: "Start Game" })).toHaveCount(0);

      const spectatorRow = gameRow(spectator.page, gameName);
      await expect(spectatorRow).toContainText(gameName);
      await expect(spectatorRow).toContainText("Host Player");
      await expect(spectatorRow).toContainText("2/2");
      await expect(spectatorRow).toContainText("Waiting");
      await expect(spectatorRow).toContainText("Full");
    } finally {
      await Promise.all([host.context.close(), guest.context.close(), spectator.context.close()]);
    }
  });
});

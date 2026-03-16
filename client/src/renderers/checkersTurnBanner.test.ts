import { describe, expect, it } from "vitest";
import { getCheckersTurnBannerViewModel } from "./checkersTurnBanner";

describe("getCheckersTurnBannerViewModel", () => {
  it("shows a ready banner for the active local player", () => {
    const banner = getCheckersTurnBannerViewModel({
      phase: "playing",
      currentTurn: "local-player",
      localSessionId: "local-player",
      localPlayer: { isSpectator: false },
      mustCaptureFrom: 18,
      formatSquare: (index) => `sq-${index}`,
    });

    expect(banner).toMatchObject({
      visible: true,
      tone: "ready",
      text: "Your Turn!",
    });
    expect(banner.subtitle).toContain("sq-18");
  });

  it("shows muted waiting copy when the opponent is acting", () => {
    const banner = getCheckersTurnBannerViewModel({
      phase: "playing",
      currentTurn: "opponent",
      localSessionId: "local-player",
      localPlayer: { isSpectator: false },
      mustCaptureFrom: -1,
      formatSquare: (index) => `sq-${index}`,
    });

    expect(banner).toMatchObject({
      visible: true,
      tone: "muted",
      text: "Waiting for opponent...",
    });
  });

  it("shows spectator copy for spectators", () => {
    const banner = getCheckersTurnBannerViewModel({
      phase: "playing",
      currentTurn: "player-1",
      localSessionId: "spectator",
      localPlayer: { isSpectator: true },
      mustCaptureFrom: -1,
      formatSquare: (index) => `sq-${index}`,
    });

    expect(banner).toMatchObject({
      visible: true,
      tone: "muted",
      text: "Spectating",
    });
  });

  it("hides the banner after the match ends", () => {
    const banner = getCheckersTurnBannerViewModel({
      phase: "ended",
      currentTurn: "local-player",
      localSessionId: "local-player",
      localPlayer: { isSpectator: false },
      mustCaptureFrom: -1,
      formatSquare: (index) => `sq-${index}`,
    });

    expect(banner.visible).toBe(false);
  });
});

import {
  AMBER_500,
  BG_PRIMARY,
  BORDER_LIGHT,
  TEXT_SECONDARY,
  TEXT_SUBTLE,
  WHITE,
  YELLOW_400,
} from "./DesignTokens";

export type CheckersTurnBannerTone = "ready" | "muted";

export type CheckersTurnBannerViewModel = {
  visible: boolean;
  tone: CheckersTurnBannerTone;
  text: string;
  subtitle: string;
  backgroundColor: number;
  backgroundAlpha: number;
  borderColor: number;
  accentColor: number;
  textColor: number;
  subtitleColor: number;
};

export type CheckersTurnBannerInput = {
  phase: string;
  currentTurn: string;
  localSessionId: string | null;
  localPlayer: { isSpectator: boolean } | null;
  mustCaptureFrom: number;
  formatSquare: (index: number) => string;
};

function createMutedBanner(text: string, subtitle: string): CheckersTurnBannerViewModel {
  return {
    visible: true,
    tone: "muted",
    text,
    subtitle,
    backgroundColor: BG_PRIMARY,
    backgroundAlpha: 0.88,
    borderColor: BORDER_LIGHT,
    accentColor: TEXT_SECONDARY,
    textColor: WHITE,
    subtitleColor: TEXT_SUBTLE,
  };
}

export function getCheckersTurnBannerViewModel(
  input: CheckersTurnBannerInput,
): CheckersTurnBannerViewModel {
  if (input.phase === "ended") {
    return {
      ...createMutedBanner("", ""),
      visible: false,
    };
  }

  if (input.phase === "waiting" || input.currentTurn.length === 0) {
    return createMutedBanner(
      "Waiting for players...",
      "The match starts when both seats are filled.",
    );
  }

  const localPlayer = input.localPlayer;
  if (!localPlayer) {
    return createMutedBanner(
      "Syncing board...",
      "Waiting for your seat assignment.",
    );
  }

  if (localPlayer.isSpectator) {
    return createMutedBanner("Spectating", "Watch the live board.");
  }

  if (input.localSessionId === input.currentTurn) {
    const subtitle = input.mustCaptureFrom >= 0
      ? `Continue the capture from ${input.formatSquare(input.mustCaptureFrom)}.`
      : "Make a move on the board.";

    return {
      visible: true,
      tone: "ready",
      text: "Your Turn!",
      subtitle,
      backgroundColor: AMBER_500,
      backgroundAlpha: 0.96,
      borderColor: YELLOW_400,
      accentColor: BG_PRIMARY,
      textColor: BG_PRIMARY,
      subtitleColor: BG_PRIMARY,
    };
  }

  return createMutedBanner(
    "Waiting for opponent...",
    "Hang tight - they are making a move.",
  );
}

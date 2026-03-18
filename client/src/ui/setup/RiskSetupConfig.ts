import type { CreateGamePayload } from "../LobbyScreen";
import {
  type SetupConfigPanel,
  createPanel,
  createOptionGroup,
  createStepper,
} from "./configControls";

type GameMode = "classic" | "quick" | "domination";

export function createRiskSetupConfig(): SetupConfigPanel {
  const container = document.createElement("div");
  container.className = "setup-config-panels";

  // Game Mode
  const modePanel = createPanel("Game Mode", "⚙");
  const modeGroup = createOptionGroup<GameMode>(
    [
      { value: "classic", label: "Classic", description: "Conquer all territories" },
      { value: "quick", label: "Quick Game", description: "First to 20 territories" },
      { value: "domination", label: "Domination", description: "Control all continents" },
    ],
    "classic",
  );
  modePanel.append(modeGroup.element);
  container.append(modePanel);

  // Advanced Settings
  const advPanel = createPanel("Advanced Settings");
  const maxPlayers = createStepper(
    "Max Players",
    2, 6, 1, 4,
    (v) => `${v} players`,
  );
  const turnTimer = createStepper(
    "Turn Timer",
    30, 300, 30, 120,
    (v) => `${v}s`,
  );
  const startingArmies = createStepper(
    "Starting Armies",
    20, 50, 5, 35,
    (v) => String(v),
  );
  advPanel.append(maxPlayers.element, turnTimer.element, startingArmies.element);
  container.append(advPanel);

  return {
    element: container,
    getPayloadOverrides(): Partial<CreateGamePayload> {
      return {
        maxPlayers: maxPlayers.getValue(),
      };
    },
    setReadOnly(readOnly: boolean) {
      modeGroup.setReadOnly(readOnly);
      maxPlayers.setReadOnly(readOnly);
      turnTimer.setReadOnly(readOnly);
      startingArmies.setReadOnly(readOnly);
    },
    destroy() {
      container.remove();
    },
  };
}

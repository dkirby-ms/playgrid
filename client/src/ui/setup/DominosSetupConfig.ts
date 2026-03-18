import type { CreateGamePayload } from "../LobbyScreen";
import {
  type SetupConfigPanel,
  createPanel,
  createOptionGroup,
  createStepper,
} from "./configControls";

type GameMode = "standard" | "draw" | "block";

export function createDominosSetupConfig(): SetupConfigPanel {
  const container = document.createElement("div");
  container.className = "setup-config-panels";

  // Game Mode
  const modePanel = createPanel("Game Mode", "⚙");
  const modeGroup = createOptionGroup<GameMode>(
    [
      { value: "standard", label: "Standard", description: "Classic dominos rules" },
      { value: "draw", label: "Draw Game", description: "Draw from boneyard" },
      { value: "block", label: "Block Game", description: "No drawing allowed" },
    ],
    "standard",
  );
  modePanel.append(modeGroup.element);
  container.append(modePanel);

  // Settings
  const settingsPanel = createPanel("Settings");
  const maxPlayers = createStepper(
    "Max Players",
    2, 4, 1, 2,
    (v) => `${v} players`,
  );
  const pointTarget = createStepper(
    "Point Target",
    50, 200, 25, 100,
    (v) => `${v} pts`,
  );
  settingsPanel.append(maxPlayers.element, pointTarget.element);
  container.append(settingsPanel);

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
      pointTarget.setReadOnly(readOnly);
    },
    destroy() {
      container.remove();
    },
  };
}

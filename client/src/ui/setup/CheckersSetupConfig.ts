import type { CreateGamePayload } from "../LobbyScreen";
import {
  type SetupConfigPanel,
  createPanel,
  createOptionGroup,
  createToggleRow,
} from "./configControls";

type GameMode = "pvp" | "ai";
type TimeControl = "no-limit" | "blitz" | "rapid" | "classical";

export function createCheckersSetupConfig(): SetupConfigPanel {
  const container = document.createElement("div");
  container.className = "setup-config-panels";

  // Game Mode
  const modePanel = createPanel("Game Mode", "⚙");
  const modeGroup = createOptionGroup<GameMode>(
    [
      { value: "pvp", label: "Player vs Player", description: "Play against a friend" },
      { value: "ai", label: "Player vs AI", description: "Challenge the computer" },
    ],
    "pvp",
  );
  modePanel.append(modeGroup.element);
  container.append(modePanel);

  // Head-to-Head toggle (only visible for PvP)
  const h2hToggle = createToggleRow(
    "Shared Device",
    "Both players on the same screen",
    false,
  );

  const h2hPanel = createPanel("Play Mode", "🖥");
  h2hPanel.append(h2hToggle.element);
  container.append(h2hPanel);

  // Time Control
  const timePanel = createPanel("Time Control", "⏱");
  const timeGroup = createOptionGroup<TimeControl>(
    [
      { value: "no-limit", label: "No Limit", description: "Unlimited time", trailing: "∞" },
      { value: "blitz", label: "Blitz", description: "Fast-paced", trailing: "3:00" },
      { value: "rapid", label: "Rapid", description: "Quick game", trailing: "10:00" },
      { value: "classical", label: "Classical", description: "Standard time", trailing: "30:00" },
    ],
    "no-limit",
  );
  timePanel.append(timeGroup.element);
  container.append(timePanel);

  // Game Rules
  const rulesPanel = createPanel("Game Rules");
  const forcedCapture = createToggleRow("Forced Capture", "Must capture if possible", true);
  const flyingKings = createToggleRow("Flying Kings", "Kings can move any distance", false);
  rulesPanel.append(forcedCapture.element, flyingKings.element);
  container.append(rulesPanel);

  return {
    element: container,
    getPayloadOverrides(): Partial<CreateGamePayload> {
      return {
        cpuOpponent: modeGroup.getValue() === "ai",
        headToHeadMode: modeGroup.getValue() === "pvp" && h2hToggle.getValue(),
        maxPlayers: 2,
      };
    },
    setReadOnly(readOnly: boolean) {
      modeGroup.setReadOnly(readOnly);
      h2hToggle.setReadOnly(readOnly);
      timeGroup.setReadOnly(readOnly);
      forcedCapture.setReadOnly(readOnly);
      flyingKings.setReadOnly(readOnly);
    },
    destroy() {
      container.remove();
    },
  };
}

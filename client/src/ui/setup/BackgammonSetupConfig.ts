import type { CreateGamePayload } from "../LobbyScreen";
import {
  type SetupConfigPanel,
  createPanel,
  createOptionGroup,
  createToggleRow,
} from "./configControls";

type MatchLength = "short" | "medium" | "long" | "unlimited";

export function createBackgammonSetupConfig(): SetupConfigPanel {
  const container = document.createElement("div");
  container.className = "setup-config-panels";

  // Match Length
  const matchPanel = createPanel("Match Length", "🏆");
  const matchGroup = createOptionGroup<MatchLength>(
    [
      { value: "short", label: "Short Match", description: "Quick game", trailing: "3 pts" },
      { value: "medium", label: "Medium Match", description: "Standard length", trailing: "5 pts" },
      { value: "long", label: "Long Match", description: "Extended play", trailing: "7 pts" },
      { value: "unlimited", label: "Unlimited", description: "Play until won", trailing: "∞" },
    ],
    "medium",
  );
  matchPanel.append(matchGroup.element);
  container.append(matchPanel);

  // Game Rules
  const rulesPanel = createPanel("Game Rules");
  const doublingCube = createToggleRow("Doubling Cube", "Enable stake doubling", true);
  const crawfordRule = createToggleRow("Crawford Rule", "No doubling when 1 point away", true);
  rulesPanel.append(doublingCube.element, crawfordRule.element);
  container.append(rulesPanel);

  return {
    element: container,
    getPayloadOverrides(): Partial<CreateGamePayload> {
      return {
        maxPlayers: 2,
      };
    },
    setReadOnly(readOnly: boolean) {
      matchGroup.setReadOnly(readOnly);
      doublingCube.setReadOnly(readOnly);
      crawfordRule.setReadOnly(readOnly);
    },
    destroy() {
      container.remove();
    },
  };
}

import type { CreateGamePayload } from "../LobbyScreen";
import type { SetupConfigPanel } from "./configControls";

export function createBackgammonSetupConfig(): SetupConfigPanel {
  const container = document.createElement("div");
  container.className = "setup-config-panels";

  return {
    element: container,
    getPayloadOverrides(): Partial<CreateGamePayload> {
      return {
        maxPlayers: 2,
      };
    },
    setReadOnly() {},
    destroy() {
      container.remove();
    },
  };
}

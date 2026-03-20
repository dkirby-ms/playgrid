import type { GameTypeInfo } from "@eschaton/shared";

/**
 * Module-level cache for server-provided game type display info.
 * Shared between LobbyScreen and SetupScreen to avoid circular imports.
 */

const DEFAULT_GAME_LABELS: Record<string, string> = {
  checkers: "Checkers",
  backgammon: "Backgammon",
  risk: "Risk",
  dominos: "Dominos",
};

const DEFAULT_GAME_PLAYER_LABELS: Record<string, string> = {
  checkers: "2 Players",
  backgammon: "2 Players",
  risk: "2–6 Players",
  dominos: "2–4 Players",
};

let serverGameLabels: Record<string, string> = {};
let serverPlayerLabels: Record<string, string> = {};

/**
 * Update the cached game type display info from server-provided data.
 * Call this when the lobby receives the AVAILABLE_GAME_TYPES message.
 */
export function updateAvailableGameTypes(types: GameTypeInfo[]): void {
  serverGameLabels = {};
  serverPlayerLabels = {};
  for (const t of types) {
    serverGameLabels[t.id] = t.name;
    const [min, max] = t.playerCount;
    serverPlayerLabels[t.id] = min === max ? `${min} Players` : `${min}–${max} Players`;
  }
}

export function getGameLabel(gameType: string): string {
  return serverGameLabels[gameType] ?? DEFAULT_GAME_LABELS[gameType] ?? gameType;
}

export function getPlayerCountLabel(gameType: string): string {
  return serverPlayerLabels[gameType] ?? DEFAULT_GAME_PLAYER_LABELS[gameType] ?? "";
}

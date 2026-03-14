export const CREATE_GAME = "create_game" as const;
export const JOIN_GAME = "join_game" as const;
export const LEAVE_GAME = "leave_game" as const;
export const START_GAME = "start_game" as const;
export const SET_READY = "set_ready" as const;

export const GAME_LIST = "game_list" as const;
export const GAME_JOINED = "game_joined" as const;
export const GAME_UPDATED = "game_updated" as const;
export const GAME_REMOVED = "game_removed" as const;
export const GAME_STARTED = "game_started" as const;
export const GAME_PLAYERS = "game_players" as const;
export const LOBBY_ERROR = "lobby_error" as const;

export type GameStatus = "waiting" | "in_progress";

export interface GameSessionInfo {
  id: string;
  name: string;
  gameType: string;
  hostId: string;
  hostName: string;
  status: GameStatus;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

export interface CreateGamePayload {
  name: string;
  gameType: string;
  maxPlayers?: number;
}

export interface JoinGamePayload {
  gameId: string;
}

export interface GameJoinedPayload {
  gameId: string;
  roomId?: string;
}

export interface SetReadyPayload {
  ready: boolean;
}

export interface PreGamePlayerInfo {
  userId: string;
  displayName: string;
  isReady: boolean;
}

export interface GamePlayersPayload {
  gameId: string;
  players: PreGamePlayerInfo[];
}

export interface GameStartedPayload {
  gameId: string;
  roomId: string;
}

export interface LobbyErrorPayload {
  message: string;
}

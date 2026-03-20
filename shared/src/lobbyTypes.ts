export const CREATE_GAME = "create_game" as const;
export const JOIN_GAME = "join_game" as const;
export const LEAVE_GAME = "leave_game" as const;
export const START_GAME = "start_game" as const;
export const SET_READY = "set_ready" as const;
export const ADD_CPU_PLAYER = "add_cpu_player" as const;
export const REMOVE_CPU_PLAYER = "remove_cpu_player" as const;

export const GAME_LIST = "game_list" as const;
export const GAME_JOINED = "game_joined" as const;
export const GAME_UPDATED = "game_updated" as const;
export const GAME_REMOVED = "game_removed" as const;
export const GAME_STARTED = "game_started" as const;
export const GAME_PLAYERS = "game_players" as const;
export const LOBBY_ERROR = "lobby_error" as const;
export const ONLINE_PLAYERS = "online_players" as const;
export const LOBBY_LOG_EVENT = "lobby_log_event" as const;
export const AVAILABLE_GAME_TYPES = "available_game_types" as const;

export interface GameTypeInfo {
  id: string;
  name: string;
  playerCount: [number, number];
  description: string;
  complexity: number;
  estimatedDuration: number;
}

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
  canSpectate?: boolean;
  cpuOpponent?: boolean;
  headToHeadMode?: boolean;
}

export interface CreateGamePayload {
  name: string;
  gameType: string;
  maxPlayers?: number;
  cpuOpponent?: boolean;
  headToHeadMode?: boolean;
  quickstart?: boolean;
}

export interface JoinGamePayload {
  gameId: string;
  spectator?: boolean;
}

export interface GameJoinedPayload {
  gameId: string;
  roomId?: string;
}

export interface SetReadyPayload {
  ready: boolean;
}

export interface AddCpuPlayerPayload {
  gameId: string;
}

export interface RemoveCpuPlayerPayload {
  gameId: string;
}

export interface PreGamePlayerInfo {
  userId: string;
  displayName: string;
  isReady: boolean;
  isCPU?: boolean;
}

export interface GamePlayersPayload {
  gameId: string;
  players: PreGamePlayerInfo[];
}

export interface GameStartedPayload {
  gameId: string;
  roomId: string;
  gameType: string;
  headToHeadMode?: boolean;
}

export interface LobbyErrorPayload {
  message: string;
}

export interface OnlinePlayerInfo {
  userId: string;
  displayName: string;
  status: "in_lobby" | "in_game";
}

export interface OnlinePlayersPayload {
  players: OnlinePlayerInfo[];
}

export type LobbyLogEventType =
  | "player_joined"
  | "player_left"
  | "game_created"
  | "game_started"
  | "game_finished"
  | "player_joined_game";

export interface LobbyLogEntry {
  timestamp: number;
  type: LobbyLogEventType;
  message: string;
  playerName?: string;
  gameName?: string;
  gameType?: string;
  winner?: string;
}

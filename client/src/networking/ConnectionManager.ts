import { Client, type Room } from "@colyseus/sdk";

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
}

export type ConnectionStateChangeEvent = {
  state: ConnectionState;
  previousState: ConnectionState;
};

export type ConnectionErrorEvent = {
  message: string;
  error?: Error;
  context?: string;
};

type ColyseusRoom = Room<Record<string, unknown>>;
type ConnectionEventCallback = (event: ConnectionStateChangeEvent | ConnectionErrorEvent) => void;

const LOBBY_ROOM_NAME = "lobby";
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

function getServerUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const port = isLocal ? (import.meta.env.VITE_SERVER_PORT ?? "2567") : window.location.port;

  return port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
}

export class ConnectionManager {
  private client: Client;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private listeners: Set<ConnectionEventCallback> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimeoutId: number | null = null;
  private lastServerUrl = "";

  constructor() {
    this.client = new Client(getServerUrl());
    this.lastServerUrl = getServerUrl();
  }

  getState(): ConnectionState {
    return this.state;
  }

  getClient(): Client {
    return this.client;
  }

  on(callback: ConnectionEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async joinLobby(options?: { displayName?: string }): Promise<ColyseusRoom> {
    this.setState(ConnectionState.CONNECTING);
    this.cancelReconnect();

    try {
      const joinOptions = options?.displayName ? { displayName: options.displayName } : undefined;
      const room = (await this.client.joinOrCreate(LOBBY_ROOM_NAME, joinOptions)) as ColyseusRoom;
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.setupRoomErrorHandling(room, "lobby");
      return room;
    } catch (error) {
      this.setState(ConnectionState.DISCONNECTED);
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      this.emitError(errorMessage, error as Error | undefined, "joinLobby");
      throw error;
    }
  }

  async joinGame(roomId: string, options?: { spectator?: boolean }): Promise<ColyseusRoom> {
    this.setState(ConnectionState.CONNECTING);

    try {
      const joinOptions = options?.spectator ? { spectator: true } : {};
      const room = (await this.client.joinById(roomId, joinOptions)) as ColyseusRoom;
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.setupRoomErrorHandling(room, "game");
      return room;
    } catch (error) {
      this.setState(ConnectionState.DISCONNECTED);
      const errorMessage = error instanceof Error ? error.message : "Failed to join game";
      this.emitError(errorMessage, error as Error | undefined, "joinGame");
      throw error;
    }
  }

  async reconnect(reconnectionToken: string): Promise<ColyseusRoom> {
    this.setState(ConnectionState.CONNECTING);
    this.cancelReconnect();

    try {
      const room = (await this.client.reconnect(reconnectionToken)) as ColyseusRoom;
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.setupRoomErrorHandling(room, "game");
      return room;
    } catch (error) {
      this.setState(ConnectionState.DISCONNECTED);
      const errorMessage = error instanceof Error ? error.message : "Failed to reconnect to game";
      this.emitError(errorMessage, error as Error | undefined, "reconnectGame");
      throw error;
    }
  }

  async leaveGame(room: ColyseusRoom | null): Promise<void> {
    if (!room) {
      return;
    }

    this.cancelReconnect();

    try {
      await room.leave();
      this.setState(ConnectionState.DISCONNECTED);
    } catch (error) {
      console.error("[ConnectionManager] Error leaving room:", error);
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  attemptReconnect(reconnectFn: () => Promise<void>): void {
    if (this.reconnectTimeoutId !== null) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(
        `[ConnectionManager] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      this.setState(ConnectionState.DISCONNECTED);
      this.emitError(
        `Connection lost after ${MAX_RECONNECT_ATTEMPTS} attempts`,
        undefined,
        "reconnect"
      );
      return;
    }

    this.setState(ConnectionState.RECONNECTING);
    const delay = this.calculateBackoffDelay();
    this.reconnectAttempts++;

    console.log(
      `[ConnectionManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimeoutId = window.setTimeout(() => {
      this.reconnectTimeoutId = null;
      void reconnectFn();
    }, delay);
  }

  cancelReconnect(): void {
    if (this.reconnectTimeoutId !== null) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.reconnectAttempts = 0;
  }

  destroy(): void {
    this.cancelReconnect();
    this.listeners.clear();
    this.setState(ConnectionState.DISCONNECTED);
  }

  private setState(newState: ConnectionState): void {
    if (this.state === newState) {
      return;
    }

    const previousState = this.state;
    this.state = newState;

    console.log(`[ConnectionManager] State: ${previousState} → ${newState}`);

    const event: ConnectionStateChangeEvent = {
      state: newState,
      previousState,
    };

    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[ConnectionManager] Error in state change listener:", error);
      }
    });
  }

  private emitError(message: string, error?: Error, context?: string): void {
    console.error(`[ConnectionManager] Error in ${context ?? "unknown"}: ${message}`, error);

    const event: ConnectionErrorEvent = {
      message,
      error,
      context,
    };

    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error("[ConnectionManager] Error in error listener:", err);
      }
    });
  }

  private setupRoomErrorHandling(room: ColyseusRoom, context: string): void {
    room.onError((code, message) => {
      this.emitError(`Room error ${code}: ${message}`, undefined, context);
    });
  }

  private calculateBackoffDelay(): number {
    const exponentialDelay =
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    return Math.min(exponentialDelay, MAX_RECONNECT_DELAY_MS);
  }

  updateServerUrl(): void {
    const newUrl = getServerUrl();
    if (newUrl !== this.lastServerUrl) {
      this.lastServerUrl = newUrl;
      this.client = new Client(newUrl);
      console.log(`[ConnectionManager] Server URL updated to ${newUrl}`);
    }
  }
}

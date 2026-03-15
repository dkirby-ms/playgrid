import { Room, Client } from "colyseus";
import { GameState, Player, TICK_RATE } from "@eschaton/shared";

interface GameRoomOptions {
  gameId?: string;
  maxPlayers?: number;
}

export class GameRoom extends Room {
  state = new GameState();
  private gameId?: string;

  override onCreate(options: GameRoomOptions = {}) {
    this.gameId = typeof options.gameId === "string" ? options.gameId : undefined;

    if (typeof options.maxPlayers === "number" && Number.isFinite(options.maxPlayers)) {
      this.maxClients = Math.max(1, Math.floor(options.maxPlayers));
    }

    this.setSimulationInterval(() => this.tick(), 1000 / TICK_RATE);
    console.log(`[GameRoom] Room created${this.gameId ? ` for game ${this.gameId}` : ""}`);
  }

  override onJoin(client: Client) {
    const player = new Player();
    player.sessionId = client.sessionId;
    this.state.players.set(client.sessionId, player);
    console.log(`[GameRoom] ${client.sessionId} joined`);
  }

  override onLeave(client: Client, _code: number) {
    this.state.players.delete(client.sessionId);
    console.log(`[GameRoom] ${client.sessionId} left`);
  }

  override onDispose() {
    console.log(
      `[GameRoom] Room disposed${this.gameId ? ` for game ${this.gameId}` : ""} (lobby notification placeholder)`
    );
  }

  private tick() {
    this.state.tick++;
  }
}

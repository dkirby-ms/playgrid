import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { config } from "./config.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { LobbyRoom } from "./rooms/LobbyRoom.js";

const server = new Server({
  transport: new WebSocketTransport({}),
});

server.define("game", GameRoom);
server.define("lobby", LobbyRoom);

server.listen(config.port).then(() => {
  console.log(`[playgrid] Server listening on ws://localhost:${config.port}`);
});

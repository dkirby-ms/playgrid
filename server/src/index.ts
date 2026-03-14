import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";
import { LobbyRoom } from "./rooms/LobbyRoom.js";

const port = Number(process.env.PORT) || 2567;

const server = new Server({
  transport: new WebSocketTransport({}),
});

server.define("game", GameRoom);
server.define("lobby", LobbyRoom);

server.listen(port).then(() => {
  console.log(`[playgrid] Server listening on ws://localhost:${port}`);
});

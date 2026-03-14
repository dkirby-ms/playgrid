import { createServer, type RequestListener } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { config } from "./config.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { LobbyRoom } from "./rooms/LobbyRoom.js";

type ExpressResponse = {
  json: (body: { status: string }) => void;
};

type ExpressApp = RequestListener & {
  get: (path: string, handler: (_req: unknown, res: ExpressResponse) => void) => void;
  use: (middleware: unknown) => void;
};

type ExpressModule = {
  (): ExpressApp;
  static: (root: string) => unknown;
};

const require = createRequire(import.meta.url);
const express = require("express") as ExpressModule;

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDistDir = resolve(currentDir, "..", "..", "client", "dist");
const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(clientDistDir));

const server = new Server({
  transport: new WebSocketTransport({
    server: createServer(app),
  }),
});

server.define("game", GameRoom);
server.define("lobby", LobbyRoom);

server.listen(config.port).then(() => {
  console.log(`[playgrid] Server listening on http://localhost:${config.port} and ws://localhost:${config.port}`);
});

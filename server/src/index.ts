import { createServer, type RequestListener } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { BaseGameRoom } from "./game/BaseGameRoom.js";
import { gameRegistry } from "./game/GameRegistry.js";
import { checkersPlugin } from "./games/checkers/index.js";
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
    pingInterval: 10000,
    pingMaxRetries: 3,
  }),
});

gameRegistry.register(checkersPlugin);

server.define("game", BaseGameRoom);
server.define("lobby", LobbyRoom);

const startServer = async () => {
  try {
    await connectDb();
    await server.listen(config.port);
    console.log(`[playgrid] Server listening on http://localhost:${config.port} and ws://localhost:${config.port}`);
  } catch (error) {
    console.error("[playgrid] Server startup failed.", error);
    process.exit(1);
  }
};

void startServer();

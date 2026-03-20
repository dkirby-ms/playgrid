import { createServer, type RequestListener } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { Schema } from "@colyseus/schema";
import type { GamePlugin } from "@eschaton/shared";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { BaseGameRoom } from "./game/BaseGameRoom.js";
import { initializeTelemetry, trackException } from "./telemetry.js";
import { gameRegistry } from "./game/GameRegistry.js";
import { checkersPlugin } from "./games/checkers/index.js";
import { backgammonPlugin } from "./games/backgammon/index.js";
import { riskPlugin } from "./games/risk/index.js";
import { dominosPlugin } from "./games/dominos/index.js";
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

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const clientDistDir = resolve(currentDir, "..", "..", "client", "dist");
const isBuiltServer = currentFilePath.includes(`${sep}dist${sep}`);
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

const allPlugins: readonly GamePlugin<Schema>[] = [
  checkersPlugin as unknown as GamePlugin<Schema>,
  backgammonPlugin as unknown as GamePlugin<Schema>,
  riskPlugin as unknown as GamePlugin<Schema>,
  dominosPlugin as unknown as GamePlugin<Schema>,
];

for (const plugin of allPlugins) {
  if (!config.disabledGames.has(plugin.id)) {
    gameRegistry.register(plugin);
  }
}

if (config.disabledGames.size > 0) {
  console.log(`[playgrid] Disabled games: ${[...config.disabledGames].join(", ")}`);
}

server.define("game", BaseGameRoom);
server.define("lobby", LobbyRoom);

const startServer = async () => {
  try {
    initializeTelemetry();
    // Listen first so health probes can respond during DB init
    await server.listen(config.port);

    const serverHttpUrl = `http://localhost:${config.port}`;
    const serverWsUrl = `ws://localhost:${config.port}`;
    const clientUrl = isBuiltServer ? serverHttpUrl : "http://localhost:3000";

    console.log(
      `[playgrid] Startup ready.\n  Client: ${clientUrl}\n  Server: ${serverHttpUrl}\n  WebSocket: ${serverWsUrl}`
    );

    await connectDb();
    console.log("[playgrid] Database connected.");
  } catch (error) {
    console.error("[playgrid] Server startup failed.", error);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[playgrid] Unhandled rejection:", reason);
  if (reason instanceof Error) {
    trackException(reason, { source: "unhandledRejection" });
  }
});

process.on("uncaughtException", (error: Error) => {
  console.error("[playgrid] Uncaught exception:", error);
  trackException(error, { source: "uncaughtException" });
  process.exit(1);
});

void startServer();

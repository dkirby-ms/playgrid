# Pemulis — Static client serving via shared HTTP server

## Context
Issue #3 requires the Colyseus server to expose a health check and serve the built Vite client on the same port as WebSocket traffic after the Colyseus 0.17 migration.

## Decision
Use an Express app in `server/src/index.ts` for HTTP middleware (`GET /health` and `express.static(client/dist)`), then share that app with Colyseus by creating the underlying HTTP server with `createServer(app)` and passing it to `new WebSocketTransport({ server })`.

## Why it matters
This keeps HTTP and WebSocket traffic on one port without changing the existing development workflow. It also matches the currently installed `@colyseus/ws-transport` 0.17.9 implementation, which exposes same-server integration through the HTTP `server` option rather than a typed constructor `app` field in this repo snapshot.

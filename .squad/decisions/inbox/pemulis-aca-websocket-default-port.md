# Pemulis — ACA WebSocket default port

**Date:** 2026-03-15  
**Status:** Proposed

## Context
Azure Container Apps exposes the app over HTTPS/WSS on the public host and standard port 443, then proxies to the container's internal port 2567. The client connection helper had been hard-coding `:2567` into all WebSocket URLs, which breaks production connections even though health checks pass.

## Decision
For `client/src/networking/ConnectionManager.ts#getServerUrl()`, only apply `VITE_SERVER_PORT` on localhost/127.0.0.1. For any deployed host, use `window.location.port` and omit the port entirely when it is empty so browsers connect to the default HTTPS/WSS port.

## Why
This keeps local development flexible while matching ACA ingress behavior in UAT and prod. It also generalizes to any reverse-proxy deployment where the external WebSocket port differs from the container port.

# Pemulis — Lobby refresh identity reclaim

**Date:** 2026-03-15
**Status:** Proposed

## Context
`LobbyRoom` reserves disconnected sessions for 30 seconds with `allowReconnection()`, but the client does not use Colyseus lobby reconnection tokens on browser refresh. A refresh therefore created a brand-new lobby `sessionId` while the old one was still reserved, so the online players panel showed duplicate copies of the same player and waiting-room ownership could remain attached to the stale session.

## Decision
Treat lobby identity as a stable per-tab concept instead of a raw Colyseus session. The client stores `playgrid.lobby-player-id` in `sessionStorage` and sends it with `joinLobby()`, while `LobbyRoom` keeps a `sessionIdByPlayerId` index that lets a fresh connection reclaim the prior session, transfer waiting-room membership/host ownership to the new `sessionId`, and rebroadcast lobby presence immediately.

## Why
This fixes refresh duplication at the root cause without disabling the existing lobby reconnection grace window. Using `sessionStorage` keeps refreshes in the same browser tab stable while still allowing a second tab to appear as a separate player, which is a safer default than sharing identity through `localStorage`.

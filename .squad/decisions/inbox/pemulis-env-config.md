# Pemulis — Environment config defaults

## Context
Issue #2 adds the first server config module for Phase 0 infrastructure.

## Decision
Centralize environment parsing in `server/src/config.ts` and keep it dependency-free. The module reads `process.env` directly, exports a typed `config` object, defaults `PORT` to `2567`, defaults `DATABASE_URL` to `postgresql://postgres:postgres@localhost:5432/playgrid`, and treats `NODE_ENV` as `"production"` only when explicitly set, otherwise `"development"`.

## Why it matters
This gives the server a single source of truth for runtime configuration and keeps local development zero-config while remaining compatible with Docker/ACA env injection.

# Pemulis — PostgreSQL startup policy

## Context
Issue #4 adds the first PostgreSQL connection module for Phase 0 infrastructure.

## Decision
Create a dedicated `server/src/db.ts` module around `pg` with a shared pool (`max: 10`) and require `connectDb()` to run before `server.listen()`. In development, if `DATABASE_URL` is missing or PostgreSQL is unreachable, log the problem and continue startup; outside development, require an explicitly configured `DATABASE_URL` and fail startup when the connection check does not pass.

## Why it matters
This keeps local `npm run dev` zero-friction while still making database availability a hard startup requirement in stricter environments, so deployment failures surface immediately instead of after traffic reaches the server.

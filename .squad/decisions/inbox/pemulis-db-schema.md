# Pemulis — Database schema bootstrap approach

## Context
Issue #5 adds the first application tables (`games` and `game_participants`) on top of the Phase 0 PostgreSQL connection bootstrap.

## Decision
Run schema setup from a dedicated `server/src/db/migrate.ts` helper invoked by `connectDb()` after the connection health check succeeds. Keep the runtime migration SQL in TypeScript so the built server does not depend on copying SQL assets into `dist`, and keep `server/src/db/schema.sql` in the repo as a readable schema reference for the team.

## Why it matters
This keeps startup self-contained in every environment while still giving the team a plain SQL artifact to review when discussing schema changes. It also makes repeated startups safe because the migration path is based on idempotent table creation rather than one-shot bootstrap scripts.

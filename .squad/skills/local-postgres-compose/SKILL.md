# Skill: Local PostgreSQL via Docker Compose

## Purpose
Use this pattern when a local-only dev environment needs PostgreSQL available on demand without changing the app runtime Dockerfile.

## Applies when
- The app reads `DATABASE_URL`
- The repo uses local development instead of a shared cloud dev environment
- Developers need persistent database state across restarts
- The project wants one-command startup from the repo root

## Core pattern
1. Add a root `docker-compose.yml` with a `postgres` service.
2. Match the major PostgreSQL version used in hosted environments when possible.
3. Expose `5432`, seed simple dev credentials, and create the default app database.
4. Mount `/var/lib/postgresql/data` to a named Docker volume for persistence.
5. Add a `pg_isready` health check so dependent workflows can wait for readiness.
6. Provide a tracked `.env.example` with the matching `DATABASE_URL`.
7. Load the repo-root `.env` automatically from the server dev script so `npm run dev` works after `cp .env.example .env`.
8. Document start/stop/log/reset commands in the README.

## PlayGrid-specific note
PlayGrid uses PostgreSQL 15 in `infra/main.bicep`, so local compose should stay on PostgreSQL 15 for parity. The root helper commands are `npm run db:up`, `npm run db:down`, and `npm run db:logs`.

## Reference files
- `docker-compose.yml`
- `.env.example`
- `package.json`
- `server/package.json`
- `README.md`
- `infra/main.bicep`

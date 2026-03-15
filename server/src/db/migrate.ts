type MigrationQueryable = {
  query: (sql: string) => Promise<unknown>;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  game_type VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  outcome JSONB NULL,
  duration_seconds INTEGER NULL
);

CREATE TABLE IF NOT EXISTS game_participants (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL
);
`;

export const runMigrations = async (database: MigrationQueryable): Promise<void> => {
  await database.query(SCHEMA_SQL);
  console.log("[playgrid] Database schema ready.");
};

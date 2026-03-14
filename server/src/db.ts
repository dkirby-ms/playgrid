import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";

const CONNECTION_TEST_QUERY = "SELECT 1";

let pool: Pool | null = null;

const createPool = () =>
  new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

export const getPool = (): Pool => {
  if (pool === null) {
    pool = createPool();
  }

  return pool;
};

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> => getPool().query<T>(text, params);

export const connectDb = async (): Promise<boolean> => {
  if (!config.isDatabaseUrlConfigured) {
    if (config.nodeEnv === "development") {
      console.warn("[playgrid] DATABASE_URL not set; skipping PostgreSQL connection in development.");
      return false;
    }

    throw new Error("DATABASE_URL must be set before starting the server outside development.");
  }

  const dbPool = getPool();

  try {
    const client = await dbPool.connect();

    try {
      await client.query(CONNECTION_TEST_QUERY);
      await runMigrations(client);
    } finally {
      client.release();
    }

    console.log("[playgrid] PostgreSQL connection verified.");
    return true;
  } catch (error) {
    console.error("[playgrid] Failed to connect to PostgreSQL.", error);

    await dbPool.end().catch((poolError: unknown) => {
      console.error("[playgrid] Failed to close PostgreSQL pool after startup error.", poolError);
    });

    pool = null;

    if (config.nodeEnv === "development") {
      console.warn("[playgrid] Continuing startup without PostgreSQL because NODE_ENV=development.");
      return false;
    }

    throw error;
  }
};

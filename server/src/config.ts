export type NodeEnv = "development" | "production";

const DEFAULT_PORT = 2567;
const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/playgrid";

const portFromEnv = Number.parseInt(process.env.PORT ?? "", 10);
const databaseUrlFromEnv = process.env.DATABASE_URL?.trim();

/** Parse a comma-separated denylist into a Set, trimming whitespace and dropping empty entries. */
export function parseDisabledGames(envValue: string | undefined): Set<string> {
  return new Set(
    (envValue ?? "").split(",").map(s => s.trim()).filter(Boolean)
  );
}

const disabledGamesFromEnv = parseDisabledGames(process.env.DISABLED_GAMES);

export const config = {
  port: Number.isInteger(portFromEnv) && portFromEnv > 0 ? portFromEnv : DEFAULT_PORT,
  databaseUrl: databaseUrlFromEnv || DEFAULT_DATABASE_URL,
  isDatabaseUrlConfigured: Boolean(databaseUrlFromEnv),
  nodeEnv: process.env.NODE_ENV === "production" ? "production" : "development",
  disabledGames: disabledGamesFromEnv,
} satisfies {
  port: number;
  databaseUrl: string;
  isDatabaseUrlConfigured: boolean;
  nodeEnv: NodeEnv;
  disabledGames: Set<string>;
};

export type Config = typeof config;

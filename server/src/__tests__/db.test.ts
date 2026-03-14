import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockConnect,
  mockEnd,
  mockRunMigrations,
  mockClientQuery,
  mockRelease,
  mockConfig,
  MockPool,
} = vi.hoisted(() => {
  const mockConnect = vi.fn();
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockRunMigrations = vi.fn().mockResolvedValue(undefined);
  const mockClientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
  const mockRelease = vi.fn();
  const mockConfig = {
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/playgrid",
    isDatabaseUrlConfigured: true,
    nodeEnv: "development" as const,
  };
  const MockPool = vi.fn(function MockPool() {
    return {
      connect: mockConnect,
      end: mockEnd,
      query: vi.fn(),
    };
  });

  return {
    mockConnect,
    mockEnd,
    mockRunMigrations,
    mockClientQuery,
    mockRelease,
    mockConfig,
    MockPool,
  };
});

vi.mock("pg", () => ({
  Pool: MockPool,
}));

vi.mock("../config.js", () => ({
  config: mockConfig,
}));

vi.mock("../db/migrate.js", () => ({
  runMigrations: mockRunMigrations,
}));

const loadDbModule = async () => {
  vi.resetModules();

  return import("../db")
    .catch(() => import("../db.ts"))
    .catch(() => import("../db.js"));
};

describe("connectDb", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockConnect.mockReset();
    mockEnd.mockClear();
    mockRunMigrations.mockClear();
    mockClientQuery.mockReset();
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockRelease.mockClear();
    MockPool.mockClear();
    mockConfig.databaseUrl = "postgresql://postgres:postgres@localhost:5432/playgrid";
    mockConfig.isDatabaseUrlConfigured = true;
    mockConfig.nodeEnv = "development";

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("skips PostgreSQL startup in development when DATABASE_URL is not configured", async () => {
    mockConfig.isDatabaseUrlConfigured = false;
    const { connectDb } = await loadDbModule();

    await expect(connectDb()).resolves.toBe(false);
    expect(MockPool).not.toHaveBeenCalled();
    expect(mockRunMigrations).not.toHaveBeenCalled();
  });

  it("verifies the connection and runs migrations before succeeding", async () => {
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });

    const { connectDb } = await loadDbModule();

    await expect(connectDb()).resolves.toBe(true);
    expect(mockClientQuery).toHaveBeenCalledWith("SELECT 1");
    expect(mockRunMigrations).toHaveBeenCalledWith({
      query: mockClientQuery,
      release: mockRelease,
    });
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("continues without PostgreSQL in development when the connection fails", async () => {
    mockConnect.mockRejectedValue(new Error("boom"));
    const { connectDb } = await loadDbModule();

    await expect(connectDb()).resolves.toBe(false);
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(mockRunMigrations).not.toHaveBeenCalled();
  });
});

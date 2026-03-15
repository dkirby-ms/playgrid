import { describe, expect, it } from "vitest";
import {
  buildJoinGameHref,
  clearJoinGameHref,
  getJoinGameIdFromHref,
} from "./joinLinks";

describe("joinLinks", () => {
  it("extracts a join game id from the URL", () => {
    expect(getJoinGameIdFromHref("https://playgrid.test/?join=room-123")).toBe("room-123");
  });

  it("preserves unrelated query params when building a join URL", () => {
    expect(buildJoinGameHref("https://playgrid.test/?e2e=1", "room-123")).toBe(
      "https://playgrid.test/?e2e=1&join=room-123",
    );
  });

  it("removes the join parameter when clearing the URL", () => {
    expect(clearJoinGameHref("https://playgrid.test/?e2e=1&join=room-123")).toBe(
      "https://playgrid.test/?e2e=1",
    );
  });
});

import type { MoveEntry } from "@eschaton/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveFormatter {
  /** Returns an HTML string describing the move */
  formatMove(entry: MoveEntry): string;
  /** Returns an emoji/icon for the move type */
  getMoveIcon(entry: MoveEntry): string;
}

// ---------------------------------------------------------------------------
// Coordinate helpers (checkers)
// ---------------------------------------------------------------------------

const COL_LETTERS = "ABCDEFGH";

/** Convert a 0-based board index (0-63) to chess-like notation (A1-H8). */
function indexToNotation(index: number): string {
  if (typeof index !== "number" || index < 0 || index > 63) return String(index);
  const row = Math.floor(index / 8) + 1;
  const col = index % 8;
  return `${COL_LETTERS[col]}${row}`;
}

// ---------------------------------------------------------------------------
// Checkers formatter
// ---------------------------------------------------------------------------

const checkersFormatter: MoveFormatter = {
  formatMove(entry: MoveEntry): string {
    const p = entry.payload;
    const from = typeof p.from === "number" ? indexToNotation(p.from) : String(p.from ?? "?");
    const to = typeof p.to === "number" ? indexToNotation(p.to) : String(p.to ?? "?");

    if (entry.actionType === "king" || p.kinged === true) {
      return `👑 Kinged at ${to}`;
    }

    if (entry.actionType === "capture" || p.captured != null) {
      return `⚔️ ${from} → ${to} (capture)`;
    }

    if (entry.actionType === "move") {
      return `➡️ ${from} → ${to}`;
    }

    return entry.description ?? `Move ${entry.actionType}`;
  },

  getMoveIcon(entry: MoveEntry): string {
    if (entry.actionType === "king" || entry.payload.kinged === true) return "👑";
    if (entry.actionType === "capture" || entry.payload.captured != null) return "⚔️";
    return "➡️";
  },
};

// ---------------------------------------------------------------------------
// Default (fallback) formatter
// ---------------------------------------------------------------------------

const defaultFormatter: MoveFormatter = {
  formatMove(entry: MoveEntry): string {
    return entry.description ?? `Move: ${entry.actionType}`;
  },

  getMoveIcon(_entry: MoveEntry): string {
    return "🔹";
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const formatters: Record<string, MoveFormatter> = {
  checkers: checkersFormatter,
};

/** Get the MoveFormatter for a given game type, falling back to a generic one. */
export function getFormatter(gameType: string): MoveFormatter {
  return formatters[gameType] ?? defaultFormatter;
}

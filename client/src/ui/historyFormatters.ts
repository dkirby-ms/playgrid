import type { MoveEntry } from "@eschaton/shared";
import { getTerritoryById } from "@eschaton/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveDetailItem {
  label: string;
  value: string;
}

export interface MoveFormatter {
  /** Returns an HTML string describing the move */
  formatMove(entry: MoveEntry): string;
  /** Returns an emoji/icon for the move type */
  getMoveIcon(entry: MoveEntry): string;
  /** Returns structured detail items for the expanded move view */
  formatMoveDetails(entry: MoveEntry): MoveDetailItem[];
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

  formatMoveDetails(entry: MoveEntry): MoveDetailItem[] {
    const p = entry.payload;
    const items: MoveDetailItem[] = [];
    items.push({ label: "Action", value: entry.actionType === "capture" ? "Capture" : entry.actionType === "king" ? "Kinged" : "Move" });
    if (typeof p.from === "number") items.push({ label: "From", value: indexToNotation(p.from) });
    if (typeof p.to === "number") items.push({ label: "To", value: indexToNotation(p.to) });
    if (p.captured != null) {
      const captured = typeof p.captured === "number" ? indexToNotation(p.captured) : String(p.captured);
      items.push({ label: "Captured", value: captured });
    }
    if (p.kinged === true) items.push({ label: "Kinged", value: "Yes" });
    return items;
  },
};

// ---------------------------------------------------------------------------
// Backgammon helpers
// ---------------------------------------------------------------------------

/** Format a backgammon point index for human display. */
function formatBackgammonPoint(value: unknown): string {
  if (value === "bar") return "Bar";
  if (value === "off") return "Off";
  if (typeof value === "number") return `Point ${value + 1}`;
  return String(value ?? "?");
}

// ---------------------------------------------------------------------------
// Backgammon formatter
// ---------------------------------------------------------------------------

const backgammonFormatter: MoveFormatter = {
  formatMove(entry: MoveEntry): string {
    const p = entry.payload;

    if (entry.actionType === "roll") {
      return entry.description ?? "🎲 Rolled dice";
    }

    if (entry.actionType === "move") {
      const from = formatBackgammonPoint(p.from);
      const to = formatBackgammonPoint(p.to);
      const die = typeof p.die === "number" ? ` (🎲 ${p.die})` : "";
      if (p.to === "off") return `🏁 ${from} → Off${die}`;
      if (p.from === "bar") return `↩️ Bar → ${to}${die}`;
      return `🔘 ${from} → ${to}${die}`;
    }

    if (entry.actionType === "pass") {
      return "⏭️ No valid moves — passed";
    }

    return entry.description ?? `Move ${entry.actionType}`;
  },

  getMoveIcon(entry: MoveEntry): string {
    if (entry.actionType === "roll") return "🎲";
    if (entry.actionType === "pass") return "⏭️";
    if (entry.payload.to === "off") return "🏁";
    if (entry.payload.from === "bar") return "↩️";
    return "🔘";
  },

  formatMoveDetails(entry: MoveEntry): MoveDetailItem[] {
    const p = entry.payload;
    const items: MoveDetailItem[] = [];
    if (entry.actionType === "roll") {
      if (typeof p.die1 === "number" && typeof p.die2 === "number") {
        items.push({ label: "Dice", value: `🎲 ${p.die1}  🎲 ${p.die2}` });
      }
      if (p.doubles === true) items.push({ label: "Doubles", value: "Yes" });
    } else if (entry.actionType === "move") {
      items.push({ label: "From", value: formatBackgammonPoint(p.from) });
      items.push({ label: "To", value: formatBackgammonPoint(p.to) });
      if (typeof p.die === "number") items.push({ label: "Die Used", value: `🎲 ${p.die}` });
      items.push({ label: "Hit", value: p.hit === true ? "Yes ⚔️" : "No" });
    } else if (entry.actionType === "pass") {
      items.push({ label: "Reason", value: "No valid moves available" });
    }
    return items;
  },
};

// ---------------------------------------------------------------------------
// Dominos helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract domino pip values from the payload.
 * Server-side formatMoveHistory may enrich with `pips`, `a`/`b`, or
 * `tileA`/`tileB` fields.  Returns a display string like "[3|5]" or null.
 */
function formatDominoPips(p: Record<string, unknown>): string | null {
  if (Array.isArray(p.pips) && p.pips.length === 2) {
    return `[${p.pips[0]}|${p.pips[1]}]`;
  }
  if (typeof p.a === "number" && typeof p.b === "number") {
    return `[${p.a}|${p.b}]`;
  }
  if (typeof p.tileA === "number" && typeof p.tileB === "number") {
    return `[${p.tileA}|${p.tileB}]`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dominos formatter
// ---------------------------------------------------------------------------

const dominosFormatter: MoveFormatter = {
  formatMove(entry: MoveEntry): string {
    const p = entry.payload;

    if (entry.actionType === "play") {
      const pips = formatDominoPips(p);
      return pips ? `🁢 ${pips} played` : (entry.description ?? "🁢 Played tile");
    }

    if (entry.actionType === "draw") {
      return "📥 Drew from boneyard";
    }

    if (entry.actionType === "pass") {
      return "⏭️ Pass";
    }

    return entry.description ?? `Move ${entry.actionType}`;
  },

  getMoveIcon(entry: MoveEntry): string {
    if (entry.actionType === "play") return "🁢";
    if (entry.actionType === "draw") return "📥";
    if (entry.actionType === "pass") return "⏭️";
    return "🔹";
  },

  formatMoveDetails(entry: MoveEntry): MoveDetailItem[] {
    const p = entry.payload;
    const items: MoveDetailItem[] = [];
    if (entry.actionType === "play") {
      const pips = formatDominoPips(p);
      if (pips) items.push({ label: "Tile", value: pips });
      if (typeof p.end === "string") items.push({ label: "Placed On", value: p.end === "left" ? "Left end" : "Right end" });
      if (typeof p.score === "number") items.push({ label: "Score", value: String(p.score) });
    } else if (entry.actionType === "draw") {
      const pips = formatDominoPips(p);
      if (pips) items.push({ label: "Drew", value: pips });
      else items.push({ label: "Action", value: "Drew from boneyard" });
    } else if (entry.actionType === "pass") {
      items.push({ label: "Action", value: "Passed turn" });
    }
    return items;
  },
};

// ---------------------------------------------------------------------------
// Risk helpers
// ---------------------------------------------------------------------------

/** Resolve a territory ID to its display name, falling back to the raw ID. */
function territoryName(id: unknown): string {
  if (typeof id !== "string") return String(id ?? "?");
  return getTerritoryById(id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// Risk formatter
// ---------------------------------------------------------------------------

const riskFormatter: MoveFormatter = {
  formatMove(entry: MoveEntry): string {
    const p = entry.payload;

    if (entry.actionType === "pickTerritory") {
      return `📍 Claimed ${territoryName(p.territoryId)}`;
    }

    if (entry.actionType === "placeArmy") {
      const count = typeof p.count === "number" ? p.count : 1;
      return `🛡️ Reinforced ${territoryName(p.territoryId)} (+${count})`;
    }

    if (entry.actionType === "attack") {
      const from = territoryName(p.from);
      const to = territoryName(p.to);
      const dice = typeof p.attackerDice === "number" ? p.attackerDice : "?";
      return `⚔️ Attacked ${to} from ${from} (×${dice} dice)`;
    }

    if (entry.actionType === "captureMove") {
      const count = typeof p.count === "number" ? p.count : "?";
      return `🚩 Moved ${count} armies into captured territory`;
    }

    if (entry.actionType === "fortify") {
      const from = territoryName(p.from);
      const to = territoryName(p.to);
      const count = typeof p.count === "number" ? p.count : "?";
      return `🏰 Fortified ${count} armies: ${from} → ${to}`;
    }

    if (entry.actionType === "tradeCards") {
      const count = typeof p.cardCount === "number" ? p.cardCount : 3;
      return `🃏 Traded ${count} cards for reinforcements`;
    }

    if (entry.actionType === "endPhase") {
      return "⏭️ Ended phase";
    }

    return entry.description ?? `Move ${entry.actionType}`;
  },

  getMoveIcon(entry: MoveEntry): string {
    if (entry.actionType === "pickTerritory") return "📍";
    if (entry.actionType === "placeArmy") return "🛡️";
    if (entry.actionType === "attack") return "⚔️";
    if (entry.actionType === "captureMove") return "🚩";
    if (entry.actionType === "fortify") return "🏰";
    if (entry.actionType === "tradeCards") return "🃏";
    if (entry.actionType === "endPhase") return "⏭️";
    return "🔹";
  },

  formatMoveDetails(entry: MoveEntry): MoveDetailItem[] {
    const p = entry.payload;
    const items: MoveDetailItem[] = [];
    if (entry.actionType === "pickTerritory") {
      items.push({ label: "Territory", value: territoryName(p.territoryId) });
    } else if (entry.actionType === "placeArmy") {
      items.push({ label: "Territory", value: territoryName(p.territoryId) });
      const count = typeof p.count === "number" ? p.count : 1;
      items.push({ label: "Armies", value: `+${count}` });
    } else if (entry.actionType === "attack") {
      items.push({ label: "From", value: territoryName(p.from) });
      items.push({ label: "To", value: territoryName(p.to) });
      if (typeof p.attackerDice === "number") items.push({ label: "Attacker Dice", value: String(p.attackerDice) });
      if (typeof p.defenderDice === "number") items.push({ label: "Defender Dice", value: String(p.defenderDice) });
      if (Array.isArray(p.attackRolls)) items.push({ label: "Attack Rolls", value: p.attackRolls.map((d: unknown) => `🎲 ${d}`).join("  ") });
      if (Array.isArray(p.defendRolls)) items.push({ label: "Defend Rolls", value: p.defendRolls.map((d: unknown) => `🎲 ${d}`).join("  ") });
      if (typeof p.attackerLosses === "number") items.push({ label: "Attacker Lost", value: `${p.attackerLosses} army` });
      if (typeof p.defenderLosses === "number") items.push({ label: "Defender Lost", value: `${p.defenderLosses} army` });
      if (p.conquered === true) items.push({ label: "Result", value: "Territory conquered! 🚩" });
    } else if (entry.actionType === "captureMove") {
      const count = typeof p.count === "number" ? p.count : "?";
      items.push({ label: "Armies Moved", value: String(count) });
    } else if (entry.actionType === "fortify") {
      items.push({ label: "From", value: territoryName(p.from) });
      items.push({ label: "To", value: territoryName(p.to) });
      if (typeof p.count === "number") items.push({ label: "Armies", value: String(p.count) });
    } else if (entry.actionType === "tradeCards") {
      const count = typeof p.cardCount === "number" ? p.cardCount : 3;
      items.push({ label: "Cards Traded", value: String(count) });
      if (typeof p.armiesReceived === "number") items.push({ label: "Armies Received", value: String(p.armiesReceived) });
    } else if (entry.actionType === "endPhase") {
      if (typeof p.phase === "string") items.push({ label: "Phase Ended", value: p.phase });
    }
    return items;
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

  formatMoveDetails(entry: MoveEntry): MoveDetailItem[] {
    const items: MoveDetailItem[] = [];
    items.push({ label: "Action", value: entry.actionType });
    const payload = entry.payload;
    if (payload && typeof payload === "object") {
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) {
          items.push({ label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim(), value: String(value) });
        }
      }
    }
    return items;
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const formatters: Record<string, MoveFormatter> = {
  checkers: checkersFormatter,
  backgammon: backgammonFormatter,
  dominos: dominosFormatter,
  risk: riskFormatter,
};

/** Get the MoveFormatter for a given game type, falling back to a generic one. */
export function getFormatter(gameType: string): MoveFormatter {
  return formatters[gameType] ?? defaultFormatter;
}

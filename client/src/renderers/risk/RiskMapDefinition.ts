/**
 * Map definition format for Risk-style territory maps.
 * Separates map geometry from rendering logic to support multiple maps.
 */

export interface TerritoryDef {
  /** Territory ID matching the game state key */
  id: string;
  /** Display name */
  name: string;
  /** Continent ID */
  continent: string;
  /** SVG path `d` attribute for the territory shape */
  path: string;
  /** Label anchor position (relative to map viewBox) */
  labelX: number;
  labelY: number;
  /** Adjacent territory IDs (for connection rendering) */
  adjacentTo: string[];
}

export interface ContinentDef {
  id: string;
  name: string;
  labelX: number;
  labelY: number;
}

export interface ConnectionOverride {
  /** Two territory IDs connected by a non-standard line */
  from: string;
  to: string;
  /** Optional waypoints for wrap-around connections */
  waypoints?: Array<{ x: number; y: number }>;
}

export interface RiskMapDefinition {
  /** Human-readable map name */
  name: string;
  /** Version for cache-busting */
  version: number;
  /** SVG viewBox dimensions (territories are authored in this space) */
  viewBoxWidth: number;
  viewBoxHeight: number;
  /** Accumulated translate offset from SVG group transforms on territory paths.
   *  Raw path `d` coordinates must be shifted by this amount to align with the viewBox. */
  contentOffsetX: number;
  contentOffsetY: number;
  /** All territories */
  territories: TerritoryDef[];
  /** Continent label positions */
  continents: ContinentDef[];
  /** Connections that need custom waypoints (e.g. Alaska–Kamchatka wrapping) */
  connectionOverrides: ConnectionOverride[];
}

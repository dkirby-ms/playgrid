import type { RiskMapDefinition } from "./RiskMapDefinition";
import { loadMapFromSvg } from "./svgMapLoader";
import riskMapSvg from "./risk-map.svg?raw";

/**
 * Classic Risk world map — 42 territories across 6 continents.
 *
 * Territory geometry is sourced from risk-map.svg, which contains
 * geographically accurate SVG path data for each territory.
 * The SVG is imported as a raw string at build time (Vite ?raw),
 * parsed once at module load, and fed into the existing PixiJS
 * rendering pipeline via drawSvgPath().
 */
export const CLASSIC_RISK_MAP: RiskMapDefinition = loadMapFromSvg(
  riskMapSvg,
  "Classic",
  3,
);

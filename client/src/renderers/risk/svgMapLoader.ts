import type { RiskMapDefinition, TerritoryDef, ContinentDef } from "./RiskMapDefinition";
import { TERRITORIES } from "@eschaton/shared";

/** Known typos in the design SVG that map to canonical territory IDs. */
const SVG_ID_FIXES: Record<string, string> = {
  yakursk: "yakutsk",
};

/**
 * Normalize an SVG element ID to a canonical territory ID:
 *   1. Replace underscores with hyphens (Inkscape convention → game convention)
 *   2. Apply known typo corrections
 */
function normalizeSvgId(raw: string): string {
  const hyphenated = raw.replace(/_/g, "-");
  return SVG_ID_FIXES[hyphenated] ?? hyphenated;
}

/**
 * Compute the centroid of an SVG path's bounding box by extracting
 * all numeric coordinate pairs from the `d` attribute.
 */
function computePathCentroid(d: string): { x: number; y: number } {
  const numRe = /([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const cmdRe = /[MmLlHhVvCcSsQqTtAaZz]/g;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let curX = 0;
  let curY = 0;

  const tokens: string[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[0]);
  }

  // Suppress unused variable warnings for regex helpers
  void numRe;
  void cmdRe;

  const updateBounds = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  let i = 0;
  let cmd = "";
  const num = (): number => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(token)) {
      cmd = token;
      i++;
    }

    switch (cmd) {
      case "M":
        curX = num(); curY = num();
        updateBounds(curX, curY);
        cmd = "L"; // implicit lineto after first moveto
        break;
      case "m":
        curX += num(); curY += num();
        updateBounds(curX, curY);
        cmd = "l";
        break;
      case "L":
        curX = num(); curY = num();
        updateBounds(curX, curY);
        break;
      case "l":
        curX += num(); curY += num();
        updateBounds(curX, curY);
        break;
      case "H":
        curX = num();
        updateBounds(curX, curY);
        break;
      case "h":
        curX += num();
        updateBounds(curX, curY);
        break;
      case "V":
        curY = num();
        updateBounds(curX, curY);
        break;
      case "v":
        curY += num();
        updateBounds(curX, curY);
        break;
      case "C": {
        // 3 pairs: control1, control2, endpoint
        for (let p = 0; p < 3; p++) {
          const x = num(); const y = num();
          updateBounds(x, y);
          if (p === 2) { curX = x; curY = y; }
        }
        break;
      }
      case "c": {
        for (let p = 0; p < 3; p++) {
          const dx = num(); const dy = num();
          const x = curX + dx; const y = curY + dy;
          updateBounds(x, y);
          if (p === 2) { curX = x; curY = y; }
        }
        break;
      }
      case "S": {
        for (let p = 0; p < 2; p++) {
          const x = num(); const y = num();
          updateBounds(x, y);
          if (p === 1) { curX = x; curY = y; }
        }
        break;
      }
      case "s": {
        for (let p = 0; p < 2; p++) {
          const dx = num(); const dy = num();
          const x = curX + dx; const y = curY + dy;
          updateBounds(x, y);
          if (p === 1) { curX = x; curY = y; }
        }
        break;
      }
      case "Q": {
        for (let p = 0; p < 2; p++) {
          const x = num(); const y = num();
          updateBounds(x, y);
          if (p === 1) { curX = x; curY = y; }
        }
        break;
      }
      case "q": {
        for (let p = 0; p < 2; p++) {
          const dx = num(); const dy = num();
          const x = curX + dx; const y = curY + dy;
          updateBounds(x, y);
          if (p === 1) { curX = x; curY = y; }
        }
        break;
      }
      case "T": {
        curX = num(); curY = num();
        updateBounds(curX, curY);
        break;
      }
      case "t": {
        curX += num(); curY += num();
        updateBounds(curX, curY);
        break;
      }
      case "A": {
        // rx ry rotation large-arc sweep x y
        num(); num(); num(); num(); num();
        curX = num(); curY = num();
        updateBounds(curX, curY);
        break;
      }
      case "a": {
        num(); num(); num(); num(); num();
        curX += num(); curY += num();
        updateBounds(curX, curY);
        break;
      }
      case "Z":
      case "z":
        break;
      default:
        // Skip unknown tokens
        if (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
          i++;
        }
        break;
    }
  }

  if (!isFinite(minX)) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2),
  };
}

/**
 * Walk up from an element through parent `<g>` groups, accumulating
 * any `translate(tx, ty)` transforms. Returns the total offset that
 * the SVG renderer would apply to the element's coordinates.
 */
function getAccumulatedTranslate(el: Element): { tx: number; ty: number } {
  let tx = 0;
  let ty = 0;
  let current = el.parentElement;
  while (current && current.tagName.toLowerCase() !== "svg") {
    const transform = current.getAttribute("transform");
    if (transform) {
      const m = /translate\(\s*([^,\s)]+)[,\s]+([^)]*)\)/.exec(transform);
      if (m) {
        tx += parseFloat(m[1]);
        ty += parseFloat(m[2] || "0");
      }
    }
    current = current.parentElement;
  }
  return { tx, ty };
}

/**
 * Parses a Risk board SVG string and builds a RiskMapDefinition.
 *
 * Territory <path> elements are matched by ID. The loader normalizes
 * SVG IDs (underscores → hyphens, typo fixes) and falls back to
 * computing label centroids from path bounding boxes when
 * data-label-x / data-label-y attributes are absent.
 *
 * Inkscape SVGs often wrap content in `<g>` elements with a
 * `translate()` transform.  The loader detects this and stores the
 * offset so the renderer can shift raw path coordinates to align
 * with the viewBox.
 */
export function loadMapFromSvg(
  svgString: string,
  mapName: string,
  version: number,
): RiskMapDefinition {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.querySelector("svg");

  if (!svgEl) {
    throw new Error("SVG map: no <svg> root element found");
  }

  // Parse viewBox; fall back to width/height attributes
  const viewBoxAttr = svgEl.getAttribute("viewBox");
  let viewBoxWidth: number;
  let viewBoxHeight: number;

  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    viewBoxWidth = parts[2] ?? 1000;
    viewBoxHeight = parts[3] ?? 600;
  } else {
    viewBoxWidth = parseFloat(svgEl.getAttribute("width") ?? "1000");
    viewBoxHeight = parseFloat(svgEl.getAttribute("height") ?? "600");
  }

  // Build territory lookup from shared data
  const sharedTerritoryMap = new Map(
    TERRITORIES.map((t) => [t.id, t]),
  );

  // Extract territory paths
  const pathEls = doc.querySelectorAll("path[id]");
  const territories: TerritoryDef[] = [];
  const continentSet = new Set<string>();
  let contentOffsetX = 0;
  let contentOffsetY = 0;
  let offsetComputed = false;

  for (const pathEl of pathEls) {
    const rawId = pathEl.getAttribute("id");
    if (!rawId) continue;

    const id = normalizeSvgId(rawId);
    const sharedTerritory = sharedTerritoryMap.get(id);
    if (!sharedTerritory) continue; // Skip non-territory paths

    const pathData = pathEl.getAttribute("d");
    if (!pathData) continue;

    // Compute the accumulated translate from parent <g> elements.
    // All territory paths typically share the same group transform.
    const { tx, ty } = getAccumulatedTranslate(pathEl);
    if (!offsetComputed) {
      contentOffsetX = tx;
      contentOffsetY = ty;
      offsetComputed = true;
    }

    const name = pathEl.getAttribute("data-name") ?? sharedTerritory.name;
    const continent = pathEl.getAttribute("data-continent") ?? sharedTerritory.continent;

    // Use explicit label coords if present, otherwise compute from path centroid.
    // Centroid coords are in raw path space, so shift by the group translate
    // to align with the viewBox coordinate system.
    const rawLabelX = pathEl.getAttribute("data-label-x");
    const rawLabelY = pathEl.getAttribute("data-label-y");
    let labelX: number;
    let labelY: number;

    if (rawLabelX !== null && rawLabelY !== null) {
      labelX = parseFloat(rawLabelX);
      labelY = parseFloat(rawLabelY);
    } else {
      const centroid = computePathCentroid(pathData);
      labelX = centroid.x + tx;
      labelY = centroid.y + ty;
    }

    continentSet.add(continent);

    territories.push({
      id,
      name,
      continent,
      path: pathData,
      labelX,
      labelY,
      adjacentTo: sharedTerritory.adjacentTo,
    });
  }

  if (territories.length !== 42) {
    console.warn(
      `SVG map "${mapName}": expected 42 territories, found ${territories.length}`,
    );
  }

  // Build continent definitions from <g> elements or shared data
  const continents: ContinentDef[] = [];
  for (const continentId of continentSet) {
    const gEl = doc.querySelector(`g[id="continent-${continentId}"]`);
    const displayName = gEl?.getAttribute("data-name") ?? formatContinentName(continentId);

    // Compute continent label position as centroid of its territories
    const continentTerritories = territories.filter(
      (t) => t.continent === continentId,
    );
    const avgX =
      continentTerritories.reduce((sum, t) => sum + t.labelX, 0) /
      (continentTerritories.length || 1);
    const avgY = Math.min(
      ...continentTerritories.map((t) => t.labelY),
    ) - 16;

    continents.push({
      id: continentId,
      name: displayName,
      labelX: Math.round(avgX),
      labelY: Math.round(avgY),
    });
  }

  return {
    name: mapName,
    version,
    viewBoxWidth,
    viewBoxHeight,
    contentOffsetX,
    contentOffsetY,
    territories,
    continents,
    connectionOverrides: [
      // Alaska–Kamchatka wraps around the map edges
      {
        from: "alaska",
        to: "kamchatka",
        waypoints: [
          { x: 15, y: 70 },
          { x: 5, y: 55 },
          { x: 5, y: 40 },
          { x: 15, y: 30 },
          { x: viewBoxWidth - 15, y: 30 },
          { x: viewBoxWidth - 5, y: 40 },
          { x: viewBoxWidth - 5, y: 55 },
          { x: viewBoxWidth - 15, y: 70 },
        ],
      },
      // Brazil–North Africa crosses the Atlantic
      {
        from: "brazil",
        to: "north-africa",
        waypoints: [
          { x: viewBoxWidth * 0.33, y: viewBoxHeight * 0.57 },
          { x: viewBoxWidth * 0.36, y: viewBoxHeight * 0.48 },
        ],
      },
    ],
  };
}

/** Convert a hyphenated continent ID to a display name. */
function formatContinentName(id: string): string {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

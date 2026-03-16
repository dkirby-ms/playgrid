import { FillGradient } from "pixi.js";

// Design tokens for PixiJS renderers
// Extracted from docs/design-system.md

export type PlayerColorSet = {
  bg: number;
  border: number;
  text: number;
};

export const PLAYER_COLOR_ORDER = ["red", "blue", "green", "yellow", "purple", "orange"] as const;
export type PlayerColorName = (typeof PLAYER_COLOR_ORDER)[number];
export type PieceGradientVariant = "red" | "black" | "white";

type GradientStop = {
  offset: number;
  color: number | string;
};

export function withAlpha(color: number, alpha: number): string {
  const red = (color >> 16) & 0xFF;
  const green = (color >> 8) & 0xFF;
  const blue = color & 0xFF;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// === Base Neutrals ===
export const WHITE = 0xFFFFFF;
export const BLACK = 0x000000;
export const TRANSPARENT = 0x000000;

export const BG_PRIMARY = 0x0A0A0A;
export const BG_DARK = 0x18181B;
export const BG_CARD = 0x27272A;
export const BG_GLASS = 0x18181B;
export const BG_GLASS_ALPHA = 0.5;
export const BG_CARD_SURFACE = 0x09090B;
export const BG_CARD_SURFACE_ALPHA = 0.5;

export const TEXT_PRIMARY = WHITE;
export const TEXT_SECONDARY = 0xA1A1A1;
export const TEXT_MUTED = 0x71717A;
export const TEXT_SUBTLE = 0xD4D4D8;
export const TEXT_TINT_AMBER = 0xFBBF24;
export const TEXT_TINT_GREEN = 0x4ADE80;

export const BORDER_DEFAULT = 0x18181B;
export const BORDER_LIGHT = 0x3F3F46;
export const BORDER_LIGHT_ALPHA = 0.5;

// === Shared Accent Scale ===
export const VIOLET_400 = 0xA78BFA;
export const VIOLET_500 = 0x8B5CF6;
export const VIOLET_600 = 0x7C3AED;
export const VIOLET_700 = 0x6D28D9;
export const VIOLET_700_ALPHA = 0.5;
export const VIOLET_900 = 0x4C1D95;
export const VIOLET_900_ALPHA = 0.5;
export const VIOLET_950 = 0x3F1659;

export const PURPLE_600 = 0x9333EA;
export const PURPLE_700 = 0x7E22CE;
export const PURPLE_900 = 0x581C92;
export const PURPLE_900_ALPHA = 0.5;

export const RED_400 = 0xF87171;
export const RED_500 = 0xEF4444;
export const RED_600 = 0xDC2626;
export const RED_700 = 0xB91C1C;
export const RED_900 = 0x7F1D1D;
export const RED_900_ALPHA = 0.5;

export const BLUE_400 = 0x60A5FA;
export const BLUE_600 = 0x2563EB;
export const BLUE_700 = 0x1D4ED8;

export const GREEN_400 = 0x4ADE80;
export const GREEN_500 = 0x22C55E;
export const GREEN_500_ALPHA_20 = 0.2;
export const GREEN_600 = 0x16A34A;
export const GREEN_700 = 0x15803D;

export const AMBER_400 = 0xFBBF24;
export const AMBER_500 = 0xF59E0B;
export const AMBER_500_ALPHA_20 = 0.2;
export const AMBER_800 = 0x92400E;
export const AMBER_800_ALPHA_30 = 0.3;
export const AMBER_800_ALPHA_50 = 0.5;
export const AMBER_900 = 0x78350F;
export const AMBER_950 = 0x451A03;

export const YELLOW_300 = 0xFDE047;
export const YELLOW_400 = 0xFACC15;
export const YELLOW_400_ALPHA_30 = 0.3;
export const YELLOW_400_ALPHA_80 = 0.8;
export const YELLOW_600 = 0xCA8A04;
export const YELLOW_700 = 0xA16207;

export const ORANGE_400 = 0xFB923C;
export const ORANGE_600 = 0xEA580C;
export const ORANGE_700 = 0xC2410C;

export const ZINC_300 = 0xD4D4D8;
export const ZINC_400 = 0xA1A1A1;
export const ZINC_500 = 0x71717A;
export const ZINC_600 = 0x52525B;
export const ZINC_700 = 0x3F3F46;
export const ZINC_800 = 0x18181B;
export const ZINC_900 = 0x0A0A0A;
export const ZINC_950 = 0x09090B;

export const SLATE_100 = 0xF1F5F9;
export const SLATE_300 = 0xCBD5E1;
export const SLATE_400 = 0x94A3B8;
export const SLATE_700 = 0x334155;
export const SLATE_900 = 0x0F172A;

// === Gradient Backgrounds ===
export const PAGE_BG_FROM = BG_PRIMARY;
export const PAGE_BG_VIA = BG_PRIMARY;
export const PAGE_BG_TO = VIOLET_950;

export const PHASE_BANNER_FROM = VIOLET_900;
export const PHASE_BANNER_TO = PURPLE_900;
export const PHASE_BANNER_ALPHA = 0.5;

export const BOARD_FRAME_GRADIENT_FROM = 0x292423;
export const BOARD_FRAME_GRADIENT_VIA = 0x3F3836;
export const BOARD_FRAME_GRADIENT_TO = 0x292423;

export const BUTTON_PRIMARY_FROM = VIOLET_600;
export const BUTTON_PRIMARY_TO = PURPLE_600;
export const BUTTON_DANGER_FROM = RED_600;
export const BUTTON_DANGER_TO = RED_700;

// === Accent & Status ===
export const STATUS_ONLINE = GREEN_500;
export const STATUS_INGAME = AMBER_500;
export const STATUS_AWAY = ZINC_500;
export const STATUS_DESTRUCTIVE = RED_900;
export const STATUS_DESTRUCTIVE_ALPHA = 0.5;
export const ACCENT_VIOLET = VIOLET_400;
export const ACCENT_PURPLE = PURPLE_600;
export const ACCENT_VIOLET_SHADOW = VIOLET_500;
export const ACCENT_VIOLET_SHADOW_ALPHA = 0.2;

// === Player Colors ===
export const PLAYER_RED_BG = RED_600;
export const PLAYER_RED_BORDER = RED_700;
export const PLAYER_RED_TEXT = RED_400;

export const PLAYER_BLUE_BG = BLUE_600;
export const PLAYER_BLUE_BORDER = BLUE_700;
export const PLAYER_BLUE_TEXT = BLUE_400;

export const PLAYER_GREEN_BG = GREEN_600;
export const PLAYER_GREEN_BORDER = GREEN_700;
export const PLAYER_GREEN_TEXT = GREEN_400;

export const PLAYER_YELLOW_BG = YELLOW_600;
export const PLAYER_YELLOW_BORDER = YELLOW_700;
export const PLAYER_YELLOW_TEXT = YELLOW_400;

export const PLAYER_PURPLE_BG = PURPLE_600;
export const PLAYER_PURPLE_BORDER = PURPLE_700;
export const PLAYER_PURPLE_TEXT = 0xD8B4FE;

export const PLAYER_ORANGE_BG = ORANGE_600;
export const PLAYER_ORANGE_BORDER = ORANGE_700;
export const PLAYER_ORANGE_TEXT = ORANGE_400;

export const PLAYER_COLORS_BY_NAME: Record<PlayerColorName, PlayerColorSet> = {
  red: { bg: PLAYER_RED_BG, border: PLAYER_RED_BORDER, text: PLAYER_RED_TEXT },
  blue: { bg: PLAYER_BLUE_BG, border: PLAYER_BLUE_BORDER, text: PLAYER_BLUE_TEXT },
  green: { bg: PLAYER_GREEN_BG, border: PLAYER_GREEN_BORDER, text: PLAYER_GREEN_TEXT },
  yellow: { bg: PLAYER_YELLOW_BG, border: PLAYER_YELLOW_BORDER, text: PLAYER_YELLOW_TEXT },
  purple: { bg: PLAYER_PURPLE_BG, border: PLAYER_PURPLE_BORDER, text: PLAYER_PURPLE_TEXT },
  orange: { bg: PLAYER_ORANGE_BG, border: PLAYER_ORANGE_BORDER, text: PLAYER_ORANGE_TEXT },
};

export const PLAYER_COLORS = {
  0: PLAYER_COLORS_BY_NAME.red,
  1: PLAYER_COLORS_BY_NAME.blue,
  2: PLAYER_COLORS_BY_NAME.green,
  3: PLAYER_COLORS_BY_NAME.yellow,
  4: PLAYER_COLORS_BY_NAME.purple,
  5: PLAYER_COLORS_BY_NAME.orange,
  red: PLAYER_COLORS_BY_NAME.red,
  blue: PLAYER_COLORS_BY_NAME.blue,
  green: PLAYER_COLORS_BY_NAME.green,
  yellow: PLAYER_COLORS_BY_NAME.yellow,
  purple: PLAYER_COLORS_BY_NAME.purple,
  orange: PLAYER_COLORS_BY_NAME.orange,
} as const;

// === Board & Piece Colors ===
export const CHECKERS_LIGHT_SQUARE_FROM = 0xD2B48C;
export const CHECKERS_LIGHT_SQUARE_VIA = 0xB99B7D;
export const CHECKERS_LIGHT_SQUARE_TO = 0xA0826D;
export const BOARD_LIGHT_SQUARE = {
  from: CHECKERS_LIGHT_SQUARE_FROM,
  via: CHECKERS_LIGHT_SQUARE_VIA,
  to: CHECKERS_LIGHT_SQUARE_TO,
} as const;

export const CHECKERS_DARK_SQUARE_FROM = 0x8B8680;
export const CHECKERS_DARK_SQUARE_VIA = 0x655950;
export const CHECKERS_DARK_SQUARE_TO = 0x44403C;
export const BOARD_DARK_SQUARE = {
  from: CHECKERS_DARK_SQUARE_FROM,
  via: CHECKERS_DARK_SQUARE_VIA,
  to: CHECKERS_DARK_SQUARE_TO,
} as const;

export const CHECKERS_GRID_SHADOW = ZINC_950;
export const CHECKERS_GRID_SHADOW_ALPHA = 0.3;
export const CHECKERS_SELECTION_RING = ACCENT_VIOLET;
export const CHECKERS_SELECTION_OFFSET = CHECKERS_DARK_SQUARE_TO;

export const PIECE_RED_GLOW = RED_500;
export const PIECE_RED_FROM = RED_400;
export const PIECE_RED_VIA = RED_600;
export const PIECE_RED_TO = RED_700;
export const PIECE_RED_BORDER = RED_900;

export const PIECE_BLACK_GLOW = ZINC_800;
export const PIECE_BLACK_FROM = ZINC_600;
export const PIECE_BLACK_VIA = ZINC_800;
export const PIECE_BLACK_TO = ZINC_900;
export const PIECE_BLACK_BORDER = ZINC_950;

export const PIECE_WHITE_FROM = WHITE;
export const PIECE_WHITE_VIA = SLATE_100;
export const PIECE_WHITE_TO = SLATE_300;
export const PIECE_WHITE_BORDER = SLATE_400;

export const PIECE_HIGHLIGHT = WHITE;
export const PIECE_HIGHLIGHT_ALPHA = 0.25;
export const PIECE_HIGHLIGHT_ALPHA_EDGE = 0;

export const KING_CROWN_TEXT = YELLOW_300;
export const KING_CROWN_RING = YELLOW_400;
export const KING_CROWN_RING_ALPHA = 0.8;
export const KING_CROWN_SHADOW = YELLOW_400;
export const KING_CROWN_SHADOW_ALPHA = 0.3;
export const KING_MARKER = KING_CROWN_RING;

export const DICE_FACE = WHITE;
export const DICE_TEXT = BG_PRIMARY;

export const BACKGAMMON_BOARD_FROM = AMBER_900;
export const BACKGAMMON_BOARD_VIA = AMBER_950;
export const BACKGAMMON_BOARD_TO = CHECKERS_DARK_SQUARE_TO;
export const BACKGAMMON_POINT_DARK_FROM = AMBER_800;
export const BACKGAMMON_POINT_DARK_VIA = AMBER_900;
export const BACKGAMMON_POINT_DARK_TO = AMBER_950;
export const BACKGAMMON_POINT_LIGHT_FROM = SLATE_700;
export const BACKGAMMON_POINT_LIGHT_VIA = ZINC_700;
export const BACKGAMMON_POINT_LIGHT_TO = SLATE_900;
export const BACKGAMMON_CENTER_STRIP_FROM = CHECKERS_DARK_SQUARE_TO;
export const BACKGAMMON_CENTER_STRIP_VIA = AMBER_950;
export const BACKGAMMON_CENTER_STRIP_TO = CHECKERS_DARK_SQUARE_TO;
export const BACKGAMMON_HOME_FROM = BOARD_FRAME_GRADIENT_VIA;
export const BACKGAMMON_HOME_VIA = AMBER_950;
export const BACKGAMMON_HOME_TO = CHECKERS_DARK_SQUARE_TO;
export const BACKGAMMON_DICE_TRAY_FROM = BOARD_FRAME_GRADIENT_FROM;
export const BACKGAMMON_DICE_TRAY_VIA = BACKGAMMON_CENTER_STRIP_VIA;
export const BACKGAMMON_DICE_TRAY_TO = BOARD_FRAME_GRADIENT_TO;
export const BACKGAMMON_TARGET_MARKER_ALPHA = 0.82;
export const BACKGAMMON_USED_DIE_ALPHA = 0.35;
export const BACKGAMMON_OVERLAY_ALPHA = 0.66;

export const RISK_BOARD_FROM = BG_DARK;
export const RISK_BOARD_VIA = BG_CARD;
export const RISK_BOARD_TO = BG_PRIMARY;
export const RISK_MAP_FROM = BG_CARD;
export const RISK_MAP_VIA = BG_DARK;
export const RISK_MAP_TO = BG_PRIMARY;
export const RISK_OCEAN_BLUE = BLUE_700;
export const RISK_OCEAN_GREEN = GREEN_700;

function createLinearGradient(stops: GradientStop[], start = { x: 0, y: 0 }, end = { x: 1, y: 1 }): FillGradient {
  return new FillGradient({
    type: "linear",
    start,
    end,
    colorStops: stops,
    textureSpace: "local",
  });
}

function createRadialGradient(
  stops: GradientStop[],
  center = { x: 0.42, y: 0.38 },
  outerCenter = { x: 0.5, y: 0.5 },
  outerRadius = 0.5,
): FillGradient {
  return new FillGradient({
    type: "radial",
    center,
    innerRadius: 0,
    outerCenter,
    outerRadius,
    colorStops: stops,
    textureSpace: "local",
  });
}

// === Gradient Helpers ===
export function createPageBackgroundGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: PAGE_BG_FROM },
    { offset: 0.6, color: PAGE_BG_VIA },
    { offset: 1, color: PAGE_BG_TO },
  ]);
}

export function createPhaseBannerGradient(): FillGradient {
  return createLinearGradient(
    [
      { offset: 0, color: withAlpha(PHASE_BANNER_FROM, PHASE_BANNER_ALPHA) },
      { offset: 1, color: withAlpha(PHASE_BANNER_TO, PHASE_BANNER_ALPHA) },
    ],
    { x: 0, y: 0.5 },
    { x: 1, y: 0.5 },
  );
}

export function createBoardFrameGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BOARD_FRAME_GRADIENT_FROM },
    { offset: 0.5, color: BOARD_FRAME_GRADIENT_VIA },
    { offset: 1, color: BOARD_FRAME_GRADIENT_TO },
  ]);
}

export function createPrimaryButtonGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BUTTON_PRIMARY_FROM },
    { offset: 1, color: BUTTON_PRIMARY_TO },
  ]);
}

export function createDangerButtonGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BUTTON_DANGER_FROM },
    { offset: 1, color: BUTTON_DANGER_TO },
  ]);
}

export function createCheckersLightSquareGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: CHECKERS_LIGHT_SQUARE_FROM },
    { offset: 0.5, color: CHECKERS_LIGHT_SQUARE_VIA },
    { offset: 1, color: CHECKERS_LIGHT_SQUARE_TO },
  ]);
}

export function createCheckersDarkSquareGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: CHECKERS_DARK_SQUARE_FROM },
    { offset: 0.5, color: CHECKERS_DARK_SQUARE_VIA },
    { offset: 1, color: CHECKERS_DARK_SQUARE_TO },
  ]);
}

export function createBackgammonBoardGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BACKGAMMON_BOARD_FROM },
    { offset: 0.5, color: BACKGAMMON_BOARD_VIA },
    { offset: 1, color: BACKGAMMON_BOARD_TO },
  ]);
}

export function createBackgammonPointGradient(isDark: boolean): FillGradient {
  return createLinearGradient(
    isDark
      ? [
        { offset: 0, color: BACKGAMMON_POINT_DARK_FROM },
        { offset: 0.45, color: BACKGAMMON_POINT_DARK_VIA },
        { offset: 1, color: BACKGAMMON_POINT_DARK_TO },
      ]
      : [
        { offset: 0, color: BACKGAMMON_POINT_LIGHT_FROM },
        { offset: 0.45, color: BACKGAMMON_POINT_LIGHT_VIA },
        { offset: 1, color: BACKGAMMON_POINT_LIGHT_TO },
      ],
    { x: 0.5, y: 0 },
    { x: 0.5, y: 1 },
  );
}

export function createBackgammonCenterStripGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BACKGAMMON_CENTER_STRIP_FROM },
    { offset: 0.5, color: BACKGAMMON_CENTER_STRIP_VIA },
    { offset: 1, color: BACKGAMMON_CENTER_STRIP_TO },
  ]);
}

export function createBackgammonHomeGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BACKGAMMON_HOME_FROM },
    { offset: 0.5, color: BACKGAMMON_HOME_VIA },
    { offset: 1, color: BACKGAMMON_HOME_TO },
  ]);
}

export function createBackgammonDiceTrayGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: BACKGAMMON_DICE_TRAY_FROM },
    { offset: 0.5, color: BACKGAMMON_DICE_TRAY_VIA },
    { offset: 1, color: BACKGAMMON_DICE_TRAY_TO },
  ]);
}

export function createRiskBoardGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: RISK_BOARD_FROM },
    { offset: 0.45, color: RISK_BOARD_VIA },
    { offset: 1, color: RISK_BOARD_TO },
  ]);
}

export function createRiskMapGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: RISK_MAP_FROM },
    { offset: 0.55, color: RISK_MAP_VIA },
    { offset: 1, color: RISK_MAP_TO },
  ]);
}

export function createRiskOceanGradient(): FillGradient {
  return createLinearGradient([
    { offset: 0, color: withAlpha(RISK_OCEAN_BLUE, 0.18) },
    { offset: 0.55, color: withAlpha(BG_PRIMARY, 0) },
    { offset: 1, color: withAlpha(RISK_OCEAN_GREEN, 0.14) },
  ]);
}

export function createPieceBodyGradient(variant: PieceGradientVariant): FillGradient {
  if (variant === "red") {
    return createRadialGradient([
      { offset: 0, color: PIECE_RED_FROM },
      { offset: 0.55, color: PIECE_RED_VIA },
      { offset: 1, color: PIECE_RED_TO },
    ]);
  }

  if (variant === "white") {
    return createRadialGradient(
      [
        { offset: 0, color: PIECE_WHITE_FROM },
        { offset: 0.52, color: PIECE_WHITE_VIA },
        { offset: 1, color: PIECE_WHITE_TO },
      ],
      { x: 0.38, y: 0.3 },
      { x: 0.5, y: 0.5 },
      0.55,
    );
  }

  return createRadialGradient([
    { offset: 0, color: PIECE_BLACK_FROM },
    { offset: 0.55, color: PIECE_BLACK_VIA },
    { offset: 1, color: PIECE_BLACK_TO },
  ]);
}

export function createPieceHighlightGradient(): FillGradient {
  return new FillGradient({
    type: "radial",
    center: { x: 0.28, y: 0.22 },
    innerRadius: 0,
    outerCenter: { x: 0.34, y: 0.28 },
    outerRadius: 0.34,
    scale: 0.55,
    rotation: -Math.PI / 6,
    colorStops: [
      { offset: 0, color: withAlpha(WHITE, PIECE_HIGHLIGHT_ALPHA) },
      { offset: 1, color: withAlpha(WHITE, PIECE_HIGHLIGHT_ALPHA_EDGE) },
    ],
    textureSpace: "local",
  });
}

// Notes for future renderer refactors:

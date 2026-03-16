import type { Room } from "@colyseus/sdk";
import {
  BLACK,
  RED,
  type BackgammonState,
  type GameResult,
} from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import { GameSidebar, escapeHtml } from "../ui/GameSidebar";
import type { GameRenderer, GameRendererContext, RendererInputEvent } from "./GameRenderer";

const BOARD_POINT_COUNT = 24;
const POINTS_PER_ROW = 12;
const POINTS_PER_QUADRANT = 6;
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;
const VIEW_PADDING = 24;
const TOP_HUD_SPACE = 104;
const BOTTOM_HUD_SPACE = 60;
const BOARD_WIDTH_UNITS = 14.9;
const BOARD_HEIGHT_UNITS = 9.2;
const BOARD_INSET_UNITS = 0.28;
const BAR_WIDTH_UNITS = 0.9;
const CENTER_GAP_UNITS = 1.1;
const OFF_GAP_UNITS = 0.45;
const OFF_AREA_WIDTH_UNITS = 1.75;
const BOARD_BACKGROUND_COLOR = 0xcda56a;
const BOARD_BORDER_COLOR = 0x6f4621;
const POINT_DARK_COLOR = 0x8b4513;
const POINT_LIGHT_COLOR = 0xdeb887;
const BAR_COLOR = 0x6f3f16;
const OFF_AREA_COLOR = 0xb98958;
const BLACK_PIECE_COLOR = 0x252525;
const RED_PIECE_COLOR = 0xc64040;
const PIECE_OUTLINE_COLOR = 0x111111;
const SELECTED_SOURCE_COLOR = 0xf7e36a;
const VALID_TARGET_COLOR = 0x53d769;
const VALID_TARGET_ALPHA = 0.82;
const HUD_TEXT_COLOR = 0xffffff;
const SUBTLE_TEXT_COLOR = 0xd7d9df;
const TURN_READY_COLOR = 0x53d769;
const TURN_WAITING_COLOR = 0xc0c4cf;
const OVERLAY_BACKDROP_COLOR = 0x000000;
const OVERLAY_BACKDROP_ALPHA = 0.66;
const DIE_FACE_COLOR = 0xf8f5ef;
const DIE_PIP_COLOR = 0x1f1f1f;
const USED_DIE_ALPHA = 0.35;
const GAME_ENDED_MESSAGE = "game-end";
const MAX_VISIBLE_STACK = 5;
const MAX_SIDEBAR_HISTORY_ITEMS = 8;
const EMPTY_POINT = 0;

type BackgammonColor = typeof BLACK | typeof RED;
type BackgammonSource = number | "bar";
type BackgammonTarget = number | "off";

type BackgammonMove = {
  from: BackgammonSource;
  to: BackgammonTarget;
  die: number;
  isExactBearOff: boolean;
};

type PlayerSnapshot = {
  displayName: string;
  playerIndex: number;
  isSpectator: boolean;
};

type PointGeometry = {
  isTopRow: boolean;
  x: number;
  width: number;
  baseY: number;
  tipY: number;
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BackgammonSnapshot = {
  points: number[];
  blackBar: number;
  redBar: number;
  blackBorneOff: number;
  redBorneOff: number;
  currentTurn: string;
  players: Map<string, PlayerSnapshot>;
};

function getPlayerColorFromPlayerIndex(playerIndex: number): BackgammonColor | null {
  if (playerIndex === 0) {
    return BLACK;
  }

  if (playerIndex === 1) {
    return RED;
  }

  return null;
}

function getAvailableDice(dice: number[], usedDice: boolean[]): number[] {
  const [die1 = 0, die2 = 0] = dice;
  const [used1 = false, used2 = false] = usedDice;

  if (die1 <= 0 || die2 <= 0) {
    return [];
  }

  if (die1 === die2) {
    const usedCount = (used1 ? 1 : 0) + (used2 ? 1 : 0);
    const remainingCount = Math.max(0, 4 - (usedCount * 2));
    return Array.from({ length: remainingCount }, () => die1);
  }

  const available: number[] = [];
  if (!used1) {
    available.push(die1);
  }
  if (!used2) {
    available.push(die2);
  }
  return available;
}

function canBearOff(points: number[], barCount: number, playerColor: BackgammonColor): boolean {
  if (barCount > 0) {
    return false;
  }

  if (playerColor === BLACK) {
    for (let index = 0; index < 18; index += 1) {
      if (points[index] > 0) {
        return false;
      }
    }
  } else {
    for (let index = 6; index < BOARD_POINT_COUNT; index += 1) {
      if (points[index] < 0) {
        return false;
      }
    }
  }

  return true;
}

function isValidMove(
  points: number[],
  blackBar: number,
  redBar: number,
  _blackBorneOff: number,
  _redBorneOff: number,
  from: BackgammonSource,
  to: BackgammonTarget,
  die: number,
  playerColor: BackgammonColor,
): boolean {
  const barCount = playerColor === BLACK ? blackBar : redBar;

  if (barCount > 0 && from !== "bar") {
    return false;
  }

  if (from === "bar") {
    if (barCount === 0) {
      return false;
    }

    const entryPoint = playerColor === BLACK ? die - 1 : BOARD_POINT_COUNT - die;
    if (to !== entryPoint) {
      return false;
    }

    const destinationPieces = points[entryPoint];
    if (playerColor === BLACK && destinationPieces < -1) {
      return false;
    }
    if (playerColor === RED && destinationPieces > 1) {
      return false;
    }

    return true;
  }

  if (to === "off") {
    if (!canBearOff(points, barCount, playerColor)) {
      return false;
    }

    const fromPoint = from as number;
    if (fromPoint < 0 || fromPoint >= BOARD_POINT_COUNT) {
      return false;
    }

    const pieces = points[fromPoint];
    if (playerColor === BLACK && pieces <= 0) {
      return false;
    }
    if (playerColor === RED && pieces >= 0) {
      return false;
    }

    if (playerColor === BLACK) {
      const exactPoint = BOARD_POINT_COUNT - die;
      if (fromPoint === exactPoint) {
        return true;
      }
      if (fromPoint < exactPoint) {
        return false;
      }

      for (let index = fromPoint + 1; index < BOARD_POINT_COUNT; index += 1) {
        if (points[index] > 0) {
          return false;
        }
      }

      return true;
    }

    const exactPoint = die - 1;
    if (fromPoint === exactPoint) {
      return true;
    }
    if (fromPoint > exactPoint) {
      return false;
    }

    for (let index = 0; index < fromPoint; index += 1) {
      if (points[index] < 0) {
        return false;
      }
    }

    return true;
  }

  const fromPoint = from as number;
  const toPoint = to as number;

  if (fromPoint < 0 || fromPoint >= BOARD_POINT_COUNT) {
    return false;
  }
  if (toPoint < 0 || toPoint >= BOARD_POINT_COUNT) {
    return false;
  }

  const sourcePieces = points[fromPoint];
  if (playerColor === BLACK && sourcePieces <= 0) {
    return false;
  }
  if (playerColor === RED && sourcePieces >= 0) {
    return false;
  }

  const expectedTo = playerColor === BLACK ? fromPoint + die : fromPoint - die;
  if (toPoint !== expectedTo) {
    return false;
  }

  const destinationPieces = points[toPoint];
  if (playerColor === BLACK && destinationPieces < -1) {
    return false;
  }
  if (playerColor === RED && destinationPieces > 1) {
    return false;
  }

  return true;
}

export class BackgammonRenderer implements GameRenderer {
  readonly gameType = "backgammon";
  readonly container = new Container();

  private readonly boardLayer = new Container();
  private readonly piecesLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly boardBackground = new Graphics();
  private readonly barTopArea = new Graphics();
  private readonly barBottomArea = new Graphics();
  private readonly offTopArea = new Graphics();
  private readonly offBottomArea = new Graphics();
  private readonly diceLayer = new Graphics();
  private readonly pointGraphics: Graphics[] = [];
  private readonly statusText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 28,
      fontWeight: "700",
      fill: TURN_WAITING_COLOR,
      align: "center",
    },
  });
  private readonly playerColorText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 18,
      fontWeight: "600",
      fill: SUBTLE_TEXT_COLOR,
      align: "center",
    },
  });
  private readonly blackOffText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "700",
      fill: BLACK_PIECE_COLOR,
      align: "center",
    },
  });
  private readonly redOffText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "700",
      fill: RED_PIECE_COLOR,
      align: "center",
    },
  });
  private readonly overlayBackground = new Graphics();
  private readonly overlayTitleText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 40,
      fontWeight: "800",
      fill: HUD_TEXT_COLOR,
      align: "center",
      wordWrap: true,
      wordWrapWidth: DEFAULT_WIDTH * 0.7,
    },
  });
  private readonly overlaySubtitleText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "500",
      fill: SUBTLE_TEXT_COLOR,
      align: "center",
      wordWrap: true,
      wordWrapWidth: DEFAULT_WIDTH * 0.7,
    },
  });

  private room: Room | null = null;
  private requestLeave: (() => void) | null = null;
  private sidebar: GameSidebar | null = null;
  private unsubscribeGameEnded: (() => void) | null = null;
  private points: number[] = Array.from({ length: BOARD_POINT_COUNT }, () => EMPTY_POINT);
  private blackBar = 0;
  private redBar = 0;
  private blackBorneOff = 0;
  private redBorneOff = 0;
  private dice = [0, 0];
  private usedDice = [false, false];
  private phase = "waiting";
  private currentTurn = "";
  private players = new Map<string, PlayerSnapshot>();
  private gameResult: GameResult | null = null;
  private selectedSource: BackgammonSource | null = null;
  private validMoves: BackgammonMove[] = [];
  private validTargetKeys = new Set<string>();
  private moveHistory: string[] = [];
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private pointWidth = DEFAULT_WIDTH / BOARD_WIDTH_UNITS;
  private boardWidth = DEFAULT_WIDTH - (VIEW_PADDING * 2);
  private boardHeight = DEFAULT_HEIGHT - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
  private boardOffsetX = VIEW_PADDING;
  private boardOffsetY = TOP_HUD_SPACE;
  private boardInset = 0;
  private barWidth = 0;
  private offGap = 0;
  private offAreaWidth = 0;
  private playX = 0;
  private playY = 0;
  private playHeight = 0;
  private playWidth = 0;
  private centerGap = 0;
  private topTipY = 0;
  private bottomTipY = 0;
  private offAreaX = 0;
  private diceCenterX = 0;

  constructor() {
    this.piecesLayer.eventMode = "none";
    this.diceLayer.eventMode = "none";
    this.overlayLayer.eventMode = "none";
    this.overlayLayer.visible = false;
    this.statusText.anchor.set(0.5);
    this.playerColorText.anchor.set(0.5);
    this.blackOffText.anchor.set(0.5);
    this.redOffText.anchor.set(0.5);
    this.overlayTitleText.anchor.set(0.5);
    this.overlaySubtitleText.anchor.set(0.5);

    this.overlayLayer.addChild(this.overlayBackground, this.overlayTitleText, this.overlaySubtitleText);
    this.boardLayer.addChild(this.boardBackground);

    for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
      const pointGraphic = new Graphics();
      pointGraphic.eventMode = "static";
      pointGraphic.on("pointertap", () => {
        this.handlePointClick(index);
      });
      this.pointGraphics.push(pointGraphic);
      this.boardLayer.addChild(pointGraphic);
    }

    this.barTopArea.eventMode = "static";
    this.barTopArea.on("pointertap", () => {
      this.handleBarClick(BLACK);
    });
    this.barBottomArea.eventMode = "static";
    this.barBottomArea.on("pointertap", () => {
      this.handleBarClick(RED);
    });
    this.offTopArea.eventMode = "static";
    this.offTopArea.on("pointertap", () => {
      this.handleOffClick(BLACK);
    });
    this.offBottomArea.eventMode = "static";
    this.offBottomArea.on("pointertap", () => {
      this.handleOffClick(RED);
    });

    this.boardLayer.addChild(
      this.barTopArea,
      this.barBottomArea,
      this.offTopArea,
      this.offBottomArea,
      this.diceLayer,
    );

    this.container.addChild(
      this.statusText,
      this.playerColorText,
      this.boardLayer,
      this.piecesLayer,
      this.blackOffText,
      this.redOffText,
      this.overlayLayer,
    );
  }

  init(state: unknown, context?: GameRendererContext): void {
    this.unsubscribeFromRoomEvents();
    this.room = context?.room ?? null;
    this.requestLeave = context?.requestLeave ?? null;
    this.gameResult = null;
    this.selectedSource = null;
    this.validMoves = [];
    this.validTargetKeys.clear();
    this.moveHistory = [];
    this.sidebar?.destroy();
    this.sidebar = new GameSidebar();
    this.sidebar.addPanel("game-info", "Game Info");
    this.sidebar.addPanel("move-history", "Move History");
    this.sidebar.addPanel("controls", "Controls");
    this.sidebar.show();
    this.subscribeToRoomEvents();
    this.applyState(state);
    this.layout();
    this.redrawBoard();
    this.redrawPieces();
    this.updateHud();
    this.updateGameOverOverlay();
    this.updateSidebar();
  }

  onStateChange(state: unknown): void {
    this.applyState(state);
    this.syncSelectionWithState();
    this.redrawBoard();
    this.redrawPieces();
    this.updateHud();
    this.updateGameOverOverlay();
    this.updateSidebar();
  }

  update(_deltaTime: number): void {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layout();
    this.redrawBoard();
    this.redrawPieces();
    this.updateHud();
    this.updateGameOverOverlay();
  }

  handleInput(_event: RendererInputEvent): void {}

  destroy(): void {
    this.unsubscribeFromRoomEvents();
    this.room = null;
    this.requestLeave = null;
    this.players.clear();
    this.validMoves = [];
    this.validTargetKeys.clear();
    this.moveHistory = [];
    this.sidebar?.destroy();
    this.sidebar = null;
    this.clearPieces();
    this.pointGraphics.length = 0;
    this.container.destroy({ children: true });
  }

  private layout(): void {
    const availableWidth = Math.max(POINTS_PER_ROW, this.width - (VIEW_PADDING * 2));
    const availableHeight = Math.max(POINTS_PER_ROW, this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE);

    this.pointWidth = Math.min(availableWidth / BOARD_WIDTH_UNITS, availableHeight / BOARD_HEIGHT_UNITS);
    this.boardHeight = this.pointWidth * BOARD_HEIGHT_UNITS;
    this.boardInset = this.pointWidth * BOARD_INSET_UNITS;
    this.barWidth = this.pointWidth * BAR_WIDTH_UNITS;
    this.offGap = this.pointWidth * OFF_GAP_UNITS;
    this.offAreaWidth = this.pointWidth * OFF_AREA_WIDTH_UNITS;
    this.playWidth = (this.pointWidth * POINTS_PER_ROW) + this.barWidth;
    this.boardWidth = this.playWidth + this.offGap + this.offAreaWidth + (this.boardInset * 2);
    this.boardOffsetX = (this.width - this.boardWidth) / 2;
    this.boardOffsetY = TOP_HUD_SPACE + ((availableHeight - this.boardHeight) / 2);
    this.playX = this.boardOffsetX + this.boardInset;
    this.playY = this.boardOffsetY + this.boardInset;
    this.playHeight = this.boardHeight - (this.boardInset * 2);
    this.centerGap = this.pointWidth * CENTER_GAP_UNITS;
    this.topTipY = this.playY + ((this.playHeight - this.centerGap) / 2);
    this.bottomTipY = this.playY + ((this.playHeight + this.centerGap) / 2);
    this.offAreaX = this.playX + this.playWidth + this.offGap;
    this.diceCenterX = this.playX + (this.playWidth / 2);

    const statusCenterY = Math.max(34, this.boardOffsetY * 0.36);
    this.statusText.position.set(this.width / 2, statusCenterY);
    this.playerColorText.position.set(this.width / 2, statusCenterY + 30);
    this.blackOffText.position.set(
      this.offAreaX + (this.offAreaWidth / 2),
      this.playY + ((this.topTipY - this.playY) / 2),
    );
    this.redOffText.position.set(
      this.offAreaX + (this.offAreaWidth / 2),
      this.bottomTipY + (((this.playY + this.playHeight) - this.bottomTipY) / 2),
    );
    this.overlayTitleText.style.wordWrapWidth = this.boardWidth * 0.75;
    this.overlaySubtitleText.style.wordWrapWidth = this.boardWidth * 0.75;
  }

  private redrawBoard(): void {
    this.boardBackground.clear();
    this.boardBackground.roundRect(
      this.boardOffsetX,
      this.boardOffsetY,
      this.boardWidth,
      this.boardHeight,
      Math.max(12, this.pointWidth * 0.24),
    ).fill(BOARD_BACKGROUND_COLOR).stroke({ color: BOARD_BORDER_COLOR, width: Math.max(2, this.pointWidth * 0.06) });

    this.boardBackground.rect(
      this.playX + (POINTS_PER_QUADRANT * this.pointWidth),
      this.playY,
      this.barWidth,
      this.playHeight,
    ).fill(BAR_COLOR);

    for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
      this.redrawPoint(index);
    }

    this.redrawBarArea(this.barTopArea, BLACK);
    this.redrawBarArea(this.barBottomArea, RED);
    this.redrawOffArea(this.offTopArea, BLACK);
    this.redrawOffArea(this.offBottomArea, RED);
    this.redrawDice();
  }

  private redrawPoint(index: number): void {
    const point = this.pointGraphics[index];
    const geometry = this.getPointGeometry(index);
    const color = this.getPointColor(index);
    const isSelected = this.selectedSource === index;
    const isValidTarget = this.validTargetKeys.has(this.toTargetKey(index));
    const centerX = geometry.x + (geometry.width / 2);
    const markerY = geometry.isTopRow
      ? geometry.tipY - (geometry.height * 0.28)
      : geometry.tipY + (geometry.height * 0.28);

    point.clear();
    point.moveTo(geometry.x, geometry.baseY)
      .lineTo(geometry.x + geometry.width, geometry.baseY)
      .lineTo(centerX, geometry.tipY)
      .closePath()
      .fill(color);

    if (isSelected) {
      point.stroke({ color: SELECTED_SOURCE_COLOR, width: Math.max(3, this.pointWidth * 0.08) });
    }

    if (isValidTarget) {
      point.circle(centerX, markerY, this.pointWidth * 0.15)
        .fill({ color: VALID_TARGET_COLOR, alpha: VALID_TARGET_ALPHA });
    }

    point.cursor = this.isPointActionable(index) ? "pointer" : "default";
  }

  private redrawBarArea(graphics: Graphics, zoneColor: BackgammonColor): void {
    const rect = this.getBarZoneRect(zoneColor);
    const localColor = this.getLocalPlayerColor();
    const isSelected = this.selectedSource === "bar" && localColor === zoneColor;
    const isActionable = this.isBarActionable(zoneColor);

    graphics.clear();
    graphics.roundRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      Math.max(8, this.pointWidth * 0.12),
    ).fill({ color: isSelected ? SELECTED_SOURCE_COLOR : BAR_COLOR, alpha: isSelected ? 0.2 : 0.001 });

    if (isSelected) {
      graphics.stroke({ color: SELECTED_SOURCE_COLOR, width: Math.max(3, this.pointWidth * 0.08) });
    }

    graphics.cursor = isActionable ? "pointer" : "default";
  }

  private redrawOffArea(graphics: Graphics, zoneColor: BackgammonColor): void {
    const rect = this.getOffAreaRect(zoneColor);
    const localColor = this.getLocalPlayerColor();
    const isValidTarget = localColor === zoneColor && this.validTargetKeys.has(this.toTargetKey("off"));

    graphics.clear();
    graphics.roundRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      Math.max(10, this.pointWidth * 0.15),
    ).fill({ color: OFF_AREA_COLOR, alpha: 0.55 }).stroke({
      color: isValidTarget ? VALID_TARGET_COLOR : BOARD_BORDER_COLOR,
      width: isValidTarget ? Math.max(3, this.pointWidth * 0.08) : Math.max(1, this.pointWidth * 0.04),
    });

    if (isValidTarget) {
      graphics.circle(
        rect.x + (rect.width / 2),
        rect.y + (rect.height / 2),
        this.pointWidth * 0.18,
      ).fill({ color: VALID_TARGET_COLOR, alpha: VALID_TARGET_ALPHA });
    }

    graphics.cursor = this.isOffActionable(zoneColor) ? "pointer" : "default";
  }

  private redrawDice(): void {
    this.diceLayer.clear();

    const [die1, die2] = this.dice;
    if (die1 <= 0 || die2 <= 0) {
      return;
    }

    const dieSize = Math.max(32, this.pointWidth * 0.92);
    const dieGap = dieSize * 0.24;
    const totalWidth = (dieSize * 2) + dieGap;
    const startX = this.diceCenterX - (totalWidth / 2);
    const y = this.playY + (this.playHeight / 2) - (dieSize / 2);

    this.drawDie(startX, y, dieSize, die1, this.usedDice[0] ? USED_DIE_ALPHA : 1);
    this.drawDie(startX + dieSize + dieGap, y, dieSize, die2, this.usedDice[1] ? USED_DIE_ALPHA : 1);
  }

  private drawDie(x: number, y: number, size: number, value: number, alpha: number): void {
    const cornerRadius = Math.max(6, size * 0.16);
    const pipRadius = Math.max(2.5, size * 0.085);
    const left = x + (size * 0.26);
    const centerX = x + (size / 2);
    const right = x + (size * 0.74);
    const top = y + (size * 0.26);
    const middleY = y + (size / 2);
    const bottom = y + (size * 0.74);

    this.diceLayer.roundRect(x, y, size, size, cornerRadius)
      .fill({ color: DIE_FACE_COLOR, alpha })
      .stroke({ color: PIECE_OUTLINE_COLOR, width: Math.max(2, size * 0.06) });

    const pipPatterns: Record<number, Array<[number, number]>> = {
      1: [[centerX, middleY]],
      2: [[left, top], [right, bottom]],
      3: [[left, top], [centerX, middleY], [right, bottom]],
      4: [[left, top], [right, top], [left, bottom], [right, bottom]],
      5: [[left, top], [right, top], [centerX, middleY], [left, bottom], [right, bottom]],
      6: [[left, top], [right, top], [left, middleY], [right, middleY], [left, bottom], [right, bottom]],
    };

    for (const [pipX, pipY] of pipPatterns[value] ?? []) {
      this.diceLayer.circle(pipX, pipY, pipRadius).fill({ color: DIE_PIP_COLOR, alpha });
    }
  }

  private redrawPieces(): void {
    this.clearPieces();

    const pieceGraphics = new Graphics();
    const discRadius = Math.max(10, this.pointWidth * 0.38);
    const outlineWidth = Math.max(1, this.pointWidth * 0.05);
    const stackSpacing = discRadius * 0.62;
    const edgePadding = Math.max(8, this.pointWidth * 0.14);

    for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
      const count = this.points[index];
      if (count === 0) {
        continue;
      }

      const geometry = this.getPointGeometry(index);
      const centerX = geometry.x + (geometry.width / 2);
      const isTopRow = geometry.isTopRow;
      const originY = isTopRow
        ? this.playY + discRadius + edgePadding
        : this.playY + this.playHeight - discRadius - edgePadding;
      const direction = isTopRow ? 1 : -1;

      this.drawStack(
        pieceGraphics,
        Math.abs(count),
        count > 0 ? BLACK_PIECE_COLOR : RED_PIECE_COLOR,
        centerX,
        originY,
        direction,
        discRadius,
        outlineWidth,
        stackSpacing,
      );
    }

    const barCenterX = this.playX + (POINTS_PER_QUADRANT * this.pointWidth) + (this.barWidth / 2);
    this.drawStack(
      pieceGraphics,
      this.blackBar,
      BLACK_PIECE_COLOR,
      barCenterX,
      this.playY + discRadius + edgePadding,
      1,
      discRadius,
      outlineWidth,
      stackSpacing,
    );
    this.drawStack(
      pieceGraphics,
      this.redBar,
      RED_PIECE_COLOR,
      barCenterX,
      this.playY + this.playHeight - discRadius - edgePadding,
      -1,
      discRadius,
      outlineWidth,
      stackSpacing,
    );

    this.piecesLayer.addChildAt(pieceGraphics, 0);
  }

  private drawStack(
    graphics: Graphics,
    count: number,
    color: number,
    centerX: number,
    startY: number,
    direction: number,
    radius: number,
    outlineWidth: number,
    spacing: number,
  ): void {
    if (count <= 0) {
      return;
    }

    const visibleCount = Math.min(count, MAX_VISIBLE_STACK);
    let lastY = startY;

    for (let index = 0; index < visibleCount; index += 1) {
      const y = startY + (spacing * index * direction);
      lastY = y;
      graphics.circle(centerX, y, radius)
        .fill(color)
        .stroke({ color: PIECE_OUTLINE_COLOR, width: outlineWidth });
    }

    if (count > MAX_VISIBLE_STACK) {
      const countText = new Text({
        text: String(count),
        style: {
          fontFamily: "sans-serif",
          fontSize: Math.max(14, radius * 1.2),
          fontWeight: "800",
          fill: HUD_TEXT_COLOR,
          align: "center",
        },
      });
      countText.anchor.set(0.5);
      countText.position.set(centerX, lastY);
      this.piecesLayer.addChild(countText);
    }
  }

  private updateHud(): void {
    const { text: statusLabel, color: statusColor } = this.getStatusLabel();

    this.statusText.text = statusLabel;
    this.statusText.style.fill = statusColor;
    this.statusText.style.fontSize = Math.max(22, this.pointWidth * 0.48);
    this.playerColorText.text = this.getPlayerColorLabel();
    this.playerColorText.visible = this.playerColorText.text.length > 0;
    this.playerColorText.style.fontSize = Math.max(16, this.pointWidth * 0.3);
    this.blackOffText.text = `⚫ Off\n${this.blackBorneOff}`;
    this.blackOffText.style.fontSize = Math.max(16, this.pointWidth * 0.3);
    this.blackOffText.style.fill = BLACK_PIECE_COLOR;
    this.redOffText.text = `🔴 Off\n${this.redBorneOff}`;
    this.redOffText.style.fontSize = Math.max(16, this.pointWidth * 0.3);
    this.redOffText.style.fill = RED_PIECE_COLOR;
  }

  private updateGameOverOverlay(): void {
    const isVisible = this.phase === "ended";
    this.overlayLayer.visible = isVisible;

    if (!isVisible) {
      this.overlayTitleText.text = "";
      this.overlaySubtitleText.text = "";
      return;
    }

    this.overlayBackground.clear();
    this.overlayBackground.roundRect(
      this.boardOffsetX,
      this.boardOffsetY,
      this.boardWidth,
      this.boardHeight,
      Math.max(12, this.pointWidth * 0.24),
    ).fill({ color: OVERLAY_BACKDROP_COLOR, alpha: OVERLAY_BACKDROP_ALPHA });

    this.overlayTitleText.text = this.getGameOverTitle();
    this.overlayTitleText.style.fontSize = Math.max(28, this.pointWidth * 0.7);
    this.overlayTitleText.position.set(
      this.boardOffsetX + (this.boardWidth / 2),
      this.boardOffsetY + (this.boardHeight / 2) - (this.pointWidth * 0.3),
    );

    this.overlaySubtitleText.text = this.getGameOverSubtitle();
    this.overlaySubtitleText.visible = this.overlaySubtitleText.text.length > 0;
    this.overlaySubtitleText.style.fontSize = Math.max(18, this.pointWidth * 0.34);
    this.overlaySubtitleText.position.set(
      this.boardOffsetX + (this.boardWidth / 2),
      this.boardOffsetY + (this.boardHeight / 2) + (this.pointWidth * 0.4),
    );
  }

  private clearPieces(): void {
    for (const child of this.piecesLayer.removeChildren()) {
      child.destroy();
    }
  }

  private handlePointClick(index: number): void {
    if (!this.isLocalPlayersTurn()) {
      if (this.selectedSource !== null) {
        this.clearSelection();
      }
      return;
    }

    if (this.selectedSource !== null && this.validTargetKeys.has(this.toTargetKey(index))) {
      this.sendMove(index);
      return;
    }

    if (this.selectedSource === index) {
      this.clearSelection();
      return;
    }

    if (this.isSelectablePoint(index)) {
      this.setSelection(index);
      return;
    }

    this.clearSelection();
  }

  private handleBarClick(zoneColor: BackgammonColor): void {
    if (!this.isLocalPlayersTurn()) {
      if (this.selectedSource !== null) {
        this.clearSelection();
      }
      return;
    }

    if (this.getLocalPlayerColor() !== zoneColor) {
      this.clearSelection();
      return;
    }

    if (this.selectedSource === "bar") {
      this.clearSelection();
      return;
    }

    if (this.isSelectableBar()) {
      this.setSelection("bar");
      return;
    }

    this.clearSelection();
  }

  private handleOffClick(zoneColor: BackgammonColor): void {
    if (!this.isLocalPlayersTurn()) {
      if (this.selectedSource !== null) {
        this.clearSelection();
      }
      return;
    }

    if (this.getLocalPlayerColor() !== zoneColor) {
      this.clearSelection();
      return;
    }

    if (this.selectedSource !== null && this.validTargetKeys.has(this.toTargetKey("off"))) {
      this.sendMove("off");
      return;
    }

    this.clearSelection();
  }

  private sendMove(target: BackgammonTarget): void {
    const move = this.getPreferredMoveForTarget(target);
    if (!move) {
      return;
    }

    this.room?.send("move", {
      from: move.from,
      to: move.to,
      die: move.die,
    });
    this.clearSelection();
  }

  private getPreferredMoveForTarget(target: BackgammonTarget): BackgammonMove | null {
    const matchingMoves = this.validMoves.filter((move) => move.to === target);
    if (matchingMoves.length === 0) {
      return null;
    }

    const sortedMoves = [...matchingMoves].sort((left, right) => {
      if (left.isExactBearOff !== right.isExactBearOff) {
        return Number(right.isExactBearOff) - Number(left.isExactBearOff);
      }

      return left.die - right.die;
    });

    return sortedMoves[0] ?? null;
  }

  private subscribeToRoomEvents(): void {
    if (!this.room) {
      return;
    }

    this.unsubscribeGameEnded = this.room.onMessage<GameResult>(GAME_ENDED_MESSAGE, (result) => {
      this.gameResult = result;
      this.updateHud();
      this.updateGameOverOverlay();
      this.updateSidebar();
    });
  }

  private unsubscribeFromRoomEvents(): void {
    this.unsubscribeGameEnded?.();
    this.unsubscribeGameEnded = null;
  }

  private applyState(state: unknown): void {
    const previousSnapshot: BackgammonSnapshot = {
      points: [...this.points],
      blackBar: this.blackBar,
      redBar: this.redBar,
      blackBorneOff: this.blackBorneOff,
      redBorneOff: this.redBorneOff,
      currentTurn: this.currentTurn,
      players: new Map(this.players),
    };
    const nextState = state as Partial<BackgammonState> | null;
    this.points = this.parsePoints(nextState);
    this.blackBar = this.toCount(nextState?.blackBar);
    this.redBar = this.toCount(nextState?.redBar);
    this.blackBorneOff = this.toCount(nextState?.blackBorneOff);
    this.redBorneOff = this.toCount(nextState?.redBorneOff);
    this.dice = this.parseDice(nextState);
    this.usedDice = this.parseUsedDice(nextState);
    this.phase = typeof nextState?.phase === "string" ? nextState.phase : "waiting";
    this.currentTurn = typeof nextState?.currentTurn === "string" ? nextState.currentTurn : "";
    this.players = this.parsePlayers(nextState);

    if (this.phase !== "ended") {
      this.gameResult = null;
    }

    this.recordMove(previousSnapshot);
  }

  private syncSelectionWithState(): void {
    if (this.selectedSource === null) {
      this.validMoves = [];
      this.validTargetKeys.clear();
      return;
    }

    if (this.selectedSource === "bar") {
      if (!this.isSelectableBar()) {
        this.clearSelection(false);
        return;
      }
    } else if (!this.isSelectablePoint(this.selectedSource)) {
      this.clearSelection(false);
      return;
    }

    this.updateValidTargets(this.selectedSource);
  }

  private setSelection(source: BackgammonSource): void {
    this.selectedSource = source;
    this.updateValidTargets(source);
    this.redrawBoard();
  }

  private clearSelection(redraw = true): void {
    this.selectedSource = null;
    this.validMoves = [];
    this.validTargetKeys.clear();

    if (redraw) {
      this.redrawBoard();
    }
  }

  private updateValidTargets(source: BackgammonSource): void {
    this.validMoves = this.getMovesForSource(source);
    this.validTargetKeys = new Set(this.validMoves.map((move) => this.toTargetKey(move.to)));
  }

  private isPointActionable(index: number): boolean {
    if (!this.isLocalPlayersTurn()) {
      return false;
    }

    if (this.validTargetKeys.has(this.toTargetKey(index))) {
      return true;
    }

    return this.isSelectablePoint(index);
  }

  private isSelectablePoint(index: number): boolean {
    const localPlayerColor = this.getLocalPlayerColor();
    if (localPlayerColor === null || this.getPointOwner(this.points[index]) !== localPlayerColor) {
      return false;
    }

    return this.getMovesForSource(index).length > 0;
  }

  private isSelectableBar(): boolean {
    const localPlayerColor = this.getLocalPlayerColor();
    if (localPlayerColor === null || this.getBarCount(localPlayerColor) === 0) {
      return false;
    }

    return this.getMovesForSource("bar").length > 0;
  }

  private isBarActionable(zoneColor: BackgammonColor): boolean {
    if (!this.isLocalPlayersTurn() || this.getLocalPlayerColor() !== zoneColor) {
      return false;
    }

    return this.selectedSource === "bar" || this.isSelectableBar();
  }

  private isOffActionable(zoneColor: BackgammonColor): boolean {
    if (!this.isLocalPlayersTurn() || this.getLocalPlayerColor() !== zoneColor) {
      return false;
    }

    return this.validTargetKeys.has(this.toTargetKey("off"));
  }

  private isLocalPlayersTurn(): boolean {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId || localSessionId !== this.currentTurn) {
      return false;
    }

    const localPlayer = this.players.get(localSessionId);
    return Boolean(localPlayer && !localPlayer.isSpectator);
  }

  private getLocalPlayer(): PlayerSnapshot | null {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId) {
      return null;
    }

    return this.players.get(localSessionId) ?? null;
  }

  private getLocalPlayerColor(): BackgammonColor | null {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer || localPlayer.isSpectator) {
      return null;
    }

    return getPlayerColorFromPlayerIndex(localPlayer.playerIndex);
  }

  private getMovesForSource(source: BackgammonSource): BackgammonMove[] {
    const playerColor = this.getLocalPlayerColor();
    if (playerColor === null) {
      return [];
    }

    const availableDice = getAvailableDice(this.dice, this.usedDice);
    if (availableDice.length === 0) {
      return [];
    }

    const moves: BackgammonMove[] = [];
    const seenMoves = new Set<string>();

    for (const die of availableDice) {
      if (source === "bar") {
        const entryPoint = playerColor === BLACK ? die - 1 : BOARD_POINT_COUNT - die;
        if (isValidMove(
          this.points,
          this.blackBar,
          this.redBar,
          this.blackBorneOff,
          this.redBorneOff,
          "bar",
          entryPoint,
          die,
          playerColor,
        )) {
          const move = { from: "bar", to: entryPoint, die, isExactBearOff: false } satisfies BackgammonMove;
          const moveKey = this.toMoveKey(move);
          if (!seenMoves.has(moveKey)) {
            seenMoves.add(moveKey);
            moves.push(move);
          }
        }
        continue;
      }

      const toPoint = playerColor === BLACK ? source + die : source - die;
      if (
        toPoint >= 0
        && toPoint < BOARD_POINT_COUNT
        && isValidMove(
          this.points,
          this.blackBar,
          this.redBar,
          this.blackBorneOff,
          this.redBorneOff,
          source,
          toPoint,
          die,
          playerColor,
        )
      ) {
        const move = { from: source, to: toPoint, die, isExactBearOff: false } satisfies BackgammonMove;
        const moveKey = this.toMoveKey(move);
        if (!seenMoves.has(moveKey)) {
          seenMoves.add(moveKey);
          moves.push(move);
        }
      }

      if (isValidMove(
        this.points,
        this.blackBar,
        this.redBar,
        this.blackBorneOff,
        this.redBorneOff,
        source,
        "off",
        die,
        playerColor,
      )) {
        const move = {
          from: source,
          to: "off",
          die,
          isExactBearOff: this.isExactBearOff(source, die, playerColor),
        } satisfies BackgammonMove;
        const moveKey = this.toMoveKey(move);
        if (!seenMoves.has(moveKey)) {
          seenMoves.add(moveKey);
          moves.push(move);
        }
      }
    }

    return moves;
  }

  private isExactBearOff(fromPoint: number, die: number, playerColor: BackgammonColor): boolean {
    if (playerColor === BLACK) {
      return fromPoint === BOARD_POINT_COUNT - die;
    }

    return fromPoint === die - 1;
  }

  private getStatusLabel(): { text: string; color: number } {
    if (this.phase === "waiting") {
      return { text: "Waiting for players", color: TURN_WAITING_COLOR };
    }

    if (this.phase === "ended") {
      return { text: "Game over", color: TURN_WAITING_COLOR };
    }

    const localPlayer = this.getLocalPlayer();
    if (!localPlayer || localPlayer.isSpectator) {
      return { text: "Spectating", color: TURN_WAITING_COLOR };
    }

    if (this.isLocalPlayersTurn()) {
      return { text: "Your turn", color: TURN_READY_COLOR };
    }

    return { text: "Opponent's turn", color: TURN_WAITING_COLOR };
  }

  private getPlayerColorLabel(): string {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      return "";
    }

    if (localPlayer.isSpectator) {
      return "You are spectating";
    }

    const localPlayerColor = getPlayerColorFromPlayerIndex(localPlayer.playerIndex);
    if (localPlayerColor === BLACK) {
      return "You are playing as ⚫ Black";
    }

    if (localPlayerColor === RED) {
      return "You are playing as 🔴 Red";
    }

    return "";
  }

  private getGameOverTitle(): string {
    if (this.gameResult?.type === "draw") {
      return "Draw";
    }

    const localSessionId = this.room?.sessionId;
    if (localSessionId && this.gameResult?.winnerId === localSessionId) {
      return "You win! 🎉";
    }

    if (this.gameResult?.winnerId) {
      return "You lose";
    }

    return "Game over";
  }

  private getGameOverSubtitle(): string {
    const winnerColor = this.gameResult?.metadata?.winnerColor;
    if (winnerColor === BLACK) {
      return "Black bears off all checkers.";
    }

    if (winnerColor === RED) {
      return "Red bears off all checkers.";
    }

    if (this.gameResult?.type === "draw") {
      return "No winner this round.";
    }

    if (this.gameResult?.type === "timeout") {
      return "The game ended on time.";
    }

    if (this.gameResult?.type === "forfeit") {
      return "The game ended by forfeit.";
    }

    return "";
  }

  private getPointGeometry(index: number): PointGeometry {
    const isTopRow = index < POINTS_PER_ROW;
    const column = isTopRow ? index : index - POINTS_PER_ROW;
    const x = this.playX + (column * this.pointWidth) + (column >= POINTS_PER_QUADRANT ? this.barWidth : 0);
    const baseY = isTopRow ? this.playY : this.playY + this.playHeight;
    const tipY = isTopRow ? this.topTipY : this.bottomTipY;

    return {
      isTopRow,
      x,
      width: this.pointWidth,
      baseY,
      tipY,
      height: Math.abs(baseY - tipY),
    };
  }

  private getPointColor(index: number): number {
    const column = index < POINTS_PER_ROW ? index : index - POINTS_PER_ROW;
    return column % 2 === 0 ? POINT_DARK_COLOR : POINT_LIGHT_COLOR;
  }

  private getPointOwner(count: number): BackgammonColor | null {
    if (count > 0) {
      return BLACK;
    }

    if (count < 0) {
      return RED;
    }

    return null;
  }

  private getBarCount(color: BackgammonColor): number {
    return color === BLACK ? this.blackBar : this.redBar;
  }

  private getBarZoneRect(zoneColor: BackgammonColor): Rect {
    const x = this.playX + (POINTS_PER_QUADRANT * this.pointWidth);
    const y = zoneColor === BLACK ? this.playY : this.playY + (this.playHeight / 2);
    return {
      x,
      y,
      width: this.barWidth,
      height: this.playHeight / 2,
    };
  }

  private getOffAreaRect(zoneColor: BackgammonColor): Rect {
    if (zoneColor === BLACK) {
      return {
        x: this.offAreaX,
        y: this.playY,
        width: this.offAreaWidth,
        height: this.topTipY - this.playY,
      };
    }

    return {
      x: this.offAreaX,
      y: this.bottomTipY,
      width: this.offAreaWidth,
      height: (this.playY + this.playHeight) - this.bottomTipY,
    };
  }

  private toMoveKey(move: BackgammonMove): string {
    return `${move.from}:${move.to}:${move.die}`;
  }

  private toTargetKey(target: BackgammonTarget): string {
    return typeof target === "number" ? `point:${target}` : "off";
  }

  private updateSidebar(): void {
    if (!this.sidebar) {
      return;
    }

    const notes: string[] = [];
    const playerColorLabel = this.getPlayerColorLabel();
    if (playerColorLabel.length > 0) {
      notes.push(`<div class="sidebar-note">${escapeHtml(playerColorLabel)}</div>`);
    }
    const statusText = this.phase === "ended"
      ? this.getGameOverSubtitle() || this.getStatusLabel().text
      : this.getStatusLabel().text;
    if (statusText.length > 0) {
      notes.push(`<div class="sidebar-note">${escapeHtml(statusText)}</div>`);
    }

    const { black, red } = this.getPipCounts();
    this.sidebar.updatePanel(
      "game-info",
      `<div class="sidebar-stat-list">
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Current turn</span><span class="sidebar-stat-value">${escapeHtml(this.getCurrentTurnLabel())}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Dice</span><span class="sidebar-stat-value">${escapeHtml(this.getDiceLabel())}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Black pip count</span><span class="sidebar-stat-value">${black}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Red pip count</span><span class="sidebar-stat-value">${red}</span></div>
      </div>${notes.join("")}`,
    );

    const historyMarkup = this.moveHistory.length > 0
      ? `<div class="sidebar-history-list">${this.moveHistory.map((move, index) => `
          <div class="sidebar-history-item">
            <span class="sidebar-history-index">${index + 1}</span>
            <span class="sidebar-history-text">${escapeHtml(move)}</span>
          </div>
        `).join("")}</div>`
      : '<div class="sidebar-empty">Moves will appear here after the opening roll.</div>';
    this.sidebar.updatePanel("move-history", historyMarkup);

    this.sidebar.updatePanel(
      "controls",
      `<div class="sidebar-button-group">
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="roll-dice" disabled>Roll Dice</button>
        <button type="button" class="sidebar-button sidebar-button--danger" data-action="resign"${this.requestLeave ? "" : " disabled"}>Resign</button>
      </div>
      <div class="sidebar-note">Dice are rolled automatically at the start of each turn. Use resign to concede the match.</div>`,
    );

    const controlsPanel = this.sidebar.getPanelContent("controls");
    const resignButton = controlsPanel?.querySelector('[data-action="resign"]');
    if (resignButton instanceof HTMLButtonElement) {
      resignButton.onclick = () => {
        this.requestLeave?.();
      };
    }
  }

  private getCurrentTurnLabel(): string {
    if (!this.currentTurn) {
      return "Waiting";
    }

    if (this.room?.sessionId === this.currentTurn) {
      return "You";
    }

    const currentPlayer = this.players.get(this.currentTurn);
    if (currentPlayer?.displayName) {
      return currentPlayer.displayName;
    }

    const currentPlayerColor = currentPlayer
      ? getPlayerColorFromPlayerIndex(currentPlayer.playerIndex)
      : null;
    if (currentPlayerColor === BLACK) {
      return "Black";
    }
    if (currentPlayerColor === RED) {
      return "Red";
    }

    return "Player";
  }

  private getDiceLabel(): string {
    const [die1, die2] = this.dice;
    if (die1 <= 0 || die2 <= 0) {
      return "Awaiting roll";
    }

    const values = [
      this.usedDice[0] ? `${die1} used` : String(die1),
      this.usedDice[1] ? `${die2} used` : String(die2),
    ];
    return values.join(" • ");
  }

  private getPipCounts(): { black: number; red: number } {
    let black = this.blackBar * 25;
    let red = this.redBar * 25;

    for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
      const count = this.points[index];
      if (count > 0) {
        black += count * (BOARD_POINT_COUNT - index);
      } else if (count < 0) {
        red += Math.abs(count) * (index + 1);
      }
    }

    return { black, red };
  }

  private recordMove(previous: BackgammonSnapshot): void {
    const hasPreviousState = previous.currentTurn.length > 0
      && (
        previous.points.some((count) => count !== 0)
        || previous.blackBar > 0
        || previous.redBar > 0
        || previous.blackBorneOff > 0
        || previous.redBorneOff > 0
      );
    if (!hasPreviousState) {
      return;
    }

    const mover = previous.players.get(previous.currentTurn);
    if (!mover || mover.isSpectator) {
      return;
    }

    const moverColor = getPlayerColorFromPlayerIndex(mover.playerIndex);
    if (moverColor === null) {
      return;
    }

    const from = this.getMoveSource(previous, moverColor);
    const to = this.getMoveTarget(previous, moverColor);
    if (!from || !to) {
      return;
    }

    const hit = moverColor === BLACK
      ? this.redBar > previous.redBar
      : this.blackBar > previous.blackBar;
    const moverLabel = moverColor === BLACK ? "Black" : "Red";
    this.pushMoveHistory(`${moverLabel}: ${from} → ${to}${hit ? " (hit)" : ""}`);
  }

  private getMoveSource(previous: BackgammonSnapshot, moverColor: BackgammonColor): string | null {
    if (moverColor === BLACK) {
      if (this.blackBar < previous.blackBar) {
        return "Bar";
      }
      for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
        if (previous.points[index] > 0 && this.points[index] < previous.points[index]) {
          return `P${index + 1}`;
        }
      }
      return null;
    }

    if (this.redBar < previous.redBar) {
      return "Bar";
    }
    for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
      if (previous.points[index] < 0 && this.points[index] > previous.points[index]) {
        return `P${index + 1}`;
      }
    }
    return null;
  }

  private getMoveTarget(previous: BackgammonSnapshot, moverColor: BackgammonColor): string | null {
    if (moverColor === BLACK) {
      if (this.blackBorneOff > previous.blackBorneOff) {
        return "Off";
      }
      for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
        if (this.points[index] > 0 && this.points[index] > previous.points[index]) {
          return `P${index + 1}`;
        }
      }
      return null;
    }

    if (this.redBorneOff > previous.redBorneOff) {
      return "Off";
    }
    for (let index = 0; index < BOARD_POINT_COUNT; index += 1) {
      if (this.points[index] < 0 && this.points[index] < previous.points[index]) {
        return `P${index + 1}`;
      }
    }
    return null;
  }

  private pushMoveHistory(move: string): void {
    this.moveHistory.unshift(move);
    if (this.moveHistory.length > MAX_SIDEBAR_HISTORY_ITEMS) {
      this.moveHistory.length = MAX_SIDEBAR_HISTORY_ITEMS;
    }
  }

  private parsePoints(state: Partial<BackgammonState> | null): number[] {
    const normalizedPoints = state?.points ? Array.from(state.points, (count) => Number(count)) : [];

    if (normalizedPoints.length >= BOARD_POINT_COUNT) {
      return normalizedPoints.slice(0, BOARD_POINT_COUNT);
    }

    return [
      ...normalizedPoints,
      ...Array.from({ length: BOARD_POINT_COUNT - normalizedPoints.length }, () => EMPTY_POINT),
    ];
  }

  private parseDice(state: Partial<BackgammonState> | null): [number, number] {
    const normalizedDice = state?.dice ? Array.from(state.dice, (die) => Number(die)) : [];
    return [
      Number.isFinite(normalizedDice[0]) ? normalizedDice[0] : 0,
      Number.isFinite(normalizedDice[1]) ? normalizedDice[1] : 0,
    ];
  }

  private parseUsedDice(state: Partial<BackgammonState> | null): [boolean, boolean] {
    const normalizedUsedDice = state?.usedDice ? Array.from(state.usedDice, (used) => Boolean(used)) : [];
    return [Boolean(normalizedUsedDice[0]), Boolean(normalizedUsedDice[1])];
  }

  private parsePlayers(state: Partial<BackgammonState> | null): Map<string, PlayerSnapshot> {
    const players = new Map<string, PlayerSnapshot>();

    for (const [sessionId, player] of state?.players?.entries() ?? []) {
      players.set(sessionId, {
        displayName: typeof player.displayName === "string" ? player.displayName : "Player",
        playerIndex: Number(player.playerIndex ?? -1),
        isSpectator: Boolean(player.isSpectator),
      });
    }

    return players;
  }

  private toCount(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(Number(value)));
  }
}

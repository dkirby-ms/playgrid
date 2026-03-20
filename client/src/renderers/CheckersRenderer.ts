import type { Room } from "@colyseus/sdk";
import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED,
  RED_KING,
  type CheckersState,
  type GameResult,
} from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import {
  getPieceColor,
  getPlayerColorFromPlayerIndex,
  getValidMoves,
  type CheckersMove,
} from "../games/checkers/checkersClientLogic";
import { GameSidebar, escapeHtml, getTurnClockMarkup, getChessClockMarkup } from "../ui/GameSidebar";
import { DragHelper } from "./DragHelper";
import {
  ACCENT_BLUE,
  AMBER_500,
  BG_PRIMARY,
  BLACK as TOKEN_BLACK,
  BOARD_DARK_SQUARE,
  BOARD_LIGHT_SQUARE,
  BORDER_LIGHT,
  BORDER_LIGHT_ALPHA,
  CHECKERS_GRID_SHADOW,
  CHECKERS_GRID_SHADOW_ALPHA,
  CHECKERS_SELECTION_OFFSET,
  CHECKERS_SELECTION_RING,
  createBoardFrameGradient,
  createCheckersDarkSquareGradient,
  createCheckersLightSquareGradient,
  createPieceBodyGradient,
  createPieceHighlightGradient,
  KING_CROWN_RING_ALPHA,
  KING_CROWN_SHADOW,
  KING_CROWN_SHADOW_ALPHA,
  KING_MARKER,
  PIECE_BLACK_BORDER,
  PIECE_BLACK_GLOW,
  PIECE_RED_BORDER,
  PIECE_RED_GLOW,
  STATUS_ONLINE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_SUBTLE,
  WHITE,
  YELLOW_400,
} from "./DesignTokens";
import type {
  GameRenderer,
  GameRendererContext,
  GameRendererHUDStatus,
  RendererInputEvent,
} from "./GameRenderer";

const BOARD_DIMENSION = 8;
const BOARD_CELL_COUNT = BOARD_DIMENSION * BOARD_DIMENSION;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const LIGHT_SQUARE_COLOR = BOARD_LIGHT_SQUARE.from;
const LIGHT_SQUARE_ALT_COLOR = BOARD_LIGHT_SQUARE.via;
const DARK_SQUARE_COLOR = BOARD_DARK_SQUARE.from;
const DARK_SQUARE_ALT_COLOR = BOARD_DARK_SQUARE.via;
const DARK_SQUARE_SHADOW_COLOR = CHECKERS_GRID_SHADOW;
const KING_MARKER_COLOR = KING_MARKER;
const PIECE_DROP_SHADOW_COLOR = TOKEN_BLACK;
const VALID_TARGET_COLOR = ACCENT_BLUE;
const VALID_TARGET_ALPHA = 0.35;
const BOARD_FRAME_WIDTH = 24;
const HUD_TEXT_COLOR = TEXT_PRIMARY;
const SUBTLE_TEXT_COLOR = TEXT_SUBTLE;
const TURN_READY_COLOR = STATUS_ONLINE;
const TURN_WAITING_COLOR = TEXT_SECONDARY;
const OVERLAY_BACKDROP_COLOR = BG_PRIMARY;
const OVERLAY_BACKDROP_ALPHA = 0.66;
const CAPTURED_PIECE_TOTAL = 12;
const CAPTURED_PIECES_PER_ROW = 6;
const HOVER_PIECE_SCALE = 1.05;
const SELECTED_PIECE_SCALE = 0.95;
const DRAG_PIECE_SCALE = 1.15;
const VIEW_PADDING = 24;
const TOP_HUD_SPACE = 104;
const BOTTOM_HUD_SPACE = 96;
const GAME_ENDED_MESSAGE = "game-end";
const NO_FORCED_CAPTURE = -1;
const MAX_SIDEBAR_HISTORY_ITEMS = 8;
const COORD_LABEL_COLOR = 0xa8a29e;
const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ROW_NUMBERS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function toCssHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function toCssRgbaColor(color: number, alpha: number): string {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function boardIndexToNotation(index: number): string {
  const column = index % BOARD_DIMENSION;
  const row = Math.floor(index / BOARD_DIMENSION);
  return `${String.fromCharCode(65 + column)}${BOARD_DIMENSION - row}`;
}

type PlayerSnapshot = {
  displayName: string;
  playerIndex: number;
  isSpectator: boolean;
  controllerSessionId: string;
};

export class CheckersRenderer implements GameRenderer {
  readonly gameType = "checkers";
  readonly container = new Container();

  private readonly boardLayer = new Container();
  private readonly boardFrame = new Graphics();
  private readonly piecesLayer = new Container();
  private readonly dragLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly overlayBackground = new Graphics();
  private readonly blackCountText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "600",
      fill: TEXT_SECONDARY,
    },
  });
  private readonly redCountText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "600",
      fill: TEXT_SECONDARY,
    },
  });
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
  private readonly capturedPiecesGraphics = new Graphics();
  private readonly coordLabelsContainer = new Container();
  private readonly columnLabels: Text[] = [];
  private readonly rowLabels: Text[] = [];
  private readonly squareGraphics: Graphics[] = [];
  private room: Room | null = null;
  private requestLeave: (() => void) | null = null;
  private sidebar: GameSidebar | null = null;
  private turnClockSeconds: number | null = null;
  private showTurnClock = false;
  private player1TimeRemainingMs = 600000;
  private player2TimeRemainingMs = 600000;
  private unsubscribeGameEnded: (() => void) | null = null;
  private board: number[] = Array.from({ length: BOARD_CELL_COUNT }, () => EMPTY);
  private phase = "waiting";
  private currentTurn = "";
  private mustCaptureFrom = NO_FORCED_CAPTURE;
  private players = new Map<string, PlayerSnapshot>();
  private gameResult: GameResult | null = null;
  private selectedIndex: number | null = null;
  private hoveredIndex: number | null = null;
  private validTargetIndexes = new Set<number>();
  private moveHistory: string[] = [];
  private isFlipped = false;
  private dragHelper: DragHelper | null = null;
  private dragSourceIndex: number | null = null;
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private squareSize = Math.min(DEFAULT_WIDTH, DEFAULT_HEIGHT - TOP_HUD_SPACE - BOTTOM_HUD_SPACE)
    / BOARD_DIMENSION;
  private boardSize = this.squareSize * BOARD_DIMENSION;
  private boardOffsetX = (DEFAULT_WIDTH - this.boardSize) / 2;
  private boardOffsetY = TOP_HUD_SPACE
    + ((DEFAULT_HEIGHT - TOP_HUD_SPACE - BOTTOM_HUD_SPACE - this.boardSize) / 2);

  constructor() {
    this.container.eventMode = "static";
    this.piecesLayer.eventMode = "none";
    this.capturedPiecesGraphics.eventMode = "none";
    this.dragLayer.eventMode = "none";
    this.overlayLayer.eventMode = "none";
    this.overlayLayer.visible = false;
    this.blackCountText.anchor.set(0, 0);
    this.redCountText.anchor.set(1, 0);
    this.overlayTitleText.anchor.set(0.5);
    this.overlaySubtitleText.anchor.set(0.5);

    this.overlayLayer.addChild(this.overlayBackground, this.overlayTitleText, this.overlaySubtitleText);

    this.coordLabelsContainer.eventMode = "none";
    for (let i = 0; i < BOARD_DIMENSION; i += 1) {
      const colLabel = new Text({
        text: COLUMN_LETTERS[i],
        style: {
          fontFamily: "sans-serif",
          fontSize: 13,
          fontWeight: "500",
          fill: COORD_LABEL_COLOR,
        },
      });
      colLabel.anchor.set(0.5, 0.5);
      colLabel.eventMode = "none";
      this.columnLabels.push(colLabel);
      this.coordLabelsContainer.addChild(colLabel);

      const rowLabel = new Text({
        text: ROW_NUMBERS[i],
        style: {
          fontFamily: "sans-serif",
          fontSize: 13,
          fontWeight: "500",
          fill: COORD_LABEL_COLOR,
        },
      });
      rowLabel.anchor.set(0.5, 0.5);
      rowLabel.eventMode = "none";
      this.rowLabels.push(rowLabel);
      this.coordLabelsContainer.addChild(rowLabel);
    }

    for (let index = 0; index < BOARD_CELL_COUNT; index += 1) {
      const square = new Graphics();
      square.eventMode = "static";
      square.on("pointerdown", (e) => {
        this.handleSquarePointerDown(index, e);
      });
      square.on("pointerover", () => {
        this.handleSquareHover(index);
      });
      square.on("pointerout", () => {
        this.handleSquareHover(null);
      });
      this.squareGraphics.push(square);
      this.boardLayer.addChild(square);
    }

    this.container.addChild(
      this.boardFrame,
      this.coordLabelsContainer,
      this.boardLayer,
      this.piecesLayer,
      this.dragLayer,
      this.capturedPiecesGraphics,
      this.blackCountText,
      this.redCountText,
      this.overlayLayer,
    );

    this.dragHelper = new DragHelper(this.container, this.dragLayer, {
      onDragMove: (_id, x, y) => this.handleDragMove(x, y),
      onDrop: (id, x, y) => this.handleDragDrop(id, x, y),
      onDragCancel: () => this.handleDragCancel(),
    });
  }

  init(state: unknown, context?: GameRendererContext): void {
    this.unsubscribeFromRoomEvents();
    this.room = context?.room ?? null;
    this.requestLeave = context?.requestLeave ?? null;
    this.gameResult = null;
    this.selectedIndex = null;
    this.hoveredIndex = null;
    this.validTargetIndexes.clear();
    this.dragHelper?.cancel();
    this.dragSourceIndex = null;
    this.moveHistory = [];
    this.turnClockSeconds = null;
    this.showTurnClock = false;
    this.sidebar?.destroy();
    this.sidebar = new GameSidebar();
    this.sidebar.addPanel("game-info", "Game Info");
    this.sidebar.addPanel("game-clock", "Game Clock");
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

    // Only cancel a drag if the source piece is no longer valid (e.g. turn changed,
    // piece captured). Preserving the drag across routine state syncs prevents the
    // proxy from disappearing while the player is still moving slowly.
    if (this.dragSourceIndex !== null) {
      if (!this.isLocalPlayersTurn() || !this.isSelectableSquare(this.dragSourceIndex)) {
        this.dragHelper?.cancel();
      }
    }

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

  setTurnClock(seconds: number | null, visible: boolean): void {
    this.turnClockSeconds = seconds !== null ? Math.max(0, Math.floor(seconds)) : null;
    this.showTurnClock = visible && seconds !== null;
    this.updateSidebar();
  }

  getHUDStatus(_state: unknown): GameRendererHUDStatus {
    const { text, color } = this.getStatusLabel();
    const detail = this.getPlayerColorLabel();

    return {
      label: "Checkers",
      text,
      detail: detail.length > 0 ? detail : undefined,
      accentColor: toCssHexColor(color),
    };
  }

  destroy(): void {
    this.unsubscribeFromRoomEvents();
    this.dragHelper?.destroy();
    this.dragHelper = null;
    this.dragSourceIndex = null;
    this.room = null;
    this.requestLeave = null;
    this.players.clear();
    this.hoveredIndex = null;
    this.validTargetIndexes.clear();
    this.moveHistory = [];
    this.turnClockSeconds = null;
    this.showTurnClock = false;
    this.sidebar?.destroy();
    this.sidebar = null;
    this.clearPieces();
    this.capturedPiecesGraphics.clear();
    this.squareGraphics.length = 0;
    this.container.destroy({ children: true });
  }

  private layout(): void {
    const availableWidth = Math.max(BOARD_DIMENSION, this.width - (VIEW_PADDING * 2));
    const availableHeight = Math.max(BOARD_DIMENSION, this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE);
    this.boardSize = Math.min(availableWidth, availableHeight);
    this.squareSize = this.boardSize / BOARD_DIMENSION;
    this.boardOffsetX = (this.width - this.boardSize) / 2;
    this.boardOffsetY = TOP_HUD_SPACE + ((availableHeight - this.boardSize) / 2);

    this.blackCountText.position.set(this.boardOffsetX, this.boardOffsetY + this.boardSize + 12);
    this.redCountText.position.set(this.boardOffsetX + this.boardSize, this.boardOffsetY + this.boardSize + 12);
    this.overlayTitleText.style.wordWrapWidth = this.boardSize * 0.75;
    this.overlaySubtitleText.style.wordWrapWidth = this.boardSize * 0.75;
  }

  private redrawBoard(): void {
    const fw = BOARD_FRAME_WIDTH;
    const frameX = this.boardOffsetX - fw;
    const frameY = this.boardOffsetY - fw;
    const frameSize = this.boardSize + (fw * 2);
    const frameRadius = Math.max(18, this.squareSize * 0.36);
    const boardRadius = Math.max(14, this.squareSize * 0.18);
    const bevelWidth = Math.max(1, this.squareSize * 0.035);
    const lightSquareGradient = createCheckersLightSquareGradient();
    const darkSquareGradient = createCheckersDarkSquareGradient();

    this.boardFrame.clear();
    this.boardFrame
      .roundRect(frameX + 6, frameY + 10, frameSize, frameSize, frameRadius + 6)
      .fill({ color: CHECKERS_GRID_SHADOW, alpha: CHECKERS_GRID_SHADOW_ALPHA + 0.24 });
    this.boardFrame
      .roundRect(frameX - 4, frameY - 4, frameSize + 8, frameSize + 8, frameRadius + 8)
      .fill(BG_PRIMARY);
    this.boardFrame
      .roundRect(frameX, frameY, frameSize, frameSize, frameRadius + 6)
      .fill(createBoardFrameGradient())
      .stroke({ color: BORDER_LIGHT, alpha: BORDER_LIGHT_ALPHA, width: 2 });
    this.boardFrame
      .roundRect(this.boardOffsetX, this.boardOffsetY, this.boardSize, this.boardSize, boardRadius)
      .fill({ color: BG_PRIMARY, alpha: 1 })
      .stroke({ color: CHECKERS_SELECTION_OFFSET, alpha: 0.4, width: 2 });

    for (let displayIndex = 0; displayIndex < BOARD_CELL_COUNT; displayIndex += 1) {
      const boardIndex = this.toBoardIndex(displayIndex);
      const row = Math.floor(displayIndex / BOARD_DIMENSION);
      const column = displayIndex % BOARD_DIMENSION;
      const square = this.squareGraphics[displayIndex];
      const isDark = (row + column) % 2 !== 0;
      const x = this.boardOffsetX + (column * this.squareSize);
      const y = this.boardOffsetY + (row * this.squareSize);
      const isValidTarget = this.validTargetIndexes.has(boardIndex);
      const squareGradient = isDark ? darkSquareGradient : lightSquareGradient;
      const squareBorderColor = isDark ? DARK_SQUARE_COLOR : LIGHT_SQUARE_COLOR;
      const squareBevelColor = isDark ? DARK_SQUARE_ALT_COLOR : LIGHT_SQUARE_ALT_COLOR;
      const innerHighlightAlpha = isDark ? 0.05 : 0.1;
      const innerShadowAlpha = isDark ? 0.2 : 0.12;

      square.clear();
      square
        .rect(x, y, this.squareSize, this.squareSize)
        .fill(squareGradient)
        .stroke({ color: squareBorderColor, alpha: 0.28, width: 1 });
      square.rect(x + 1, y + 1, this.squareSize - 2, bevelWidth).fill({ color: squareBevelColor, alpha: innerHighlightAlpha + 0.02 });
      square.rect(x + 1, y + 1, bevelWidth, this.squareSize - 2).fill({ color: WHITE, alpha: innerHighlightAlpha * 0.75 });
      square.rect(x + 1, y + this.squareSize - bevelWidth - 1, this.squareSize - 2, bevelWidth)
        .fill({ color: DARK_SQUARE_SHADOW_COLOR, alpha: innerShadowAlpha });
      square.rect(x + this.squareSize - bevelWidth - 1, y + 1, bevelWidth, this.squareSize - 2)
        .fill({ color: DARK_SQUARE_SHADOW_COLOR, alpha: innerShadowAlpha * 0.85 });

      if (isValidTarget) {
        square.circle(
          x + (this.squareSize / 2),
          y + (this.squareSize / 2),
          this.squareSize * 0.18,
        ).fill({ color: VALID_TARGET_COLOR, alpha: VALID_TARGET_ALPHA });
        square.circle(
          x + (this.squareSize / 2),
          y + (this.squareSize / 2),
          this.squareSize * 0.24,
        ).stroke({ color: CHECKERS_SELECTION_RING, alpha: 0.42, width: Math.max(2, this.squareSize * 0.04) });
      }

      square.cursor = this.isSquareActionable(boardIndex) ? "pointer" : "default";
    }

    this.updateCoordLabels();
  }

  private updateCoordLabels(): void {
    const fontSize = Math.max(10, Math.min(14, this.squareSize * 0.22));
    const halfFrame = BOARD_FRAME_WIDTH / 2;

    for (let i = 0; i < BOARD_DIMENSION; i += 1) {
      const labelIndex = this.isFlipped ? BOARD_DIMENSION - 1 - i : i;

      const colLabel = this.columnLabels[i];
      colLabel.text = COLUMN_LETTERS[labelIndex];
      colLabel.style.fontSize = fontSize;
      colLabel.position.set(
        this.boardOffsetX + (i * this.squareSize) + (this.squareSize / 2),
        this.boardOffsetY - halfFrame,
      );

      const rowLabel = this.rowLabels[i];
      rowLabel.text = ROW_NUMBERS[labelIndex];
      rowLabel.style.fontSize = fontSize;
      rowLabel.position.set(
        this.boardOffsetX - halfFrame,
        this.boardOffsetY + (i * this.squareSize) + (this.squareSize / 2),
      );
    }
  }

  private redrawPieces(): void {
    this.clearPieces();

    const pieceGraphics = new Graphics();
    const pieceRadius = this.squareSize * 0.32;
    const outlineWidth = Math.max(1, this.squareSize * 0.04);
    const selectionRingWidth = Math.max(3, this.squareSize * 0.075);
    const blackGradient = createPieceBodyGradient("black");
    const redGradient = createPieceBodyGradient("red");
    const highlightGradient = createPieceHighlightGradient();

    for (const [index, piece] of this.board.entries()) {
      if (piece === EMPTY) {
        continue;
      }

      const displayIndex = this.toDisplayIndex(index);
      const row = Math.floor(displayIndex / BOARD_DIMENSION);
      const column = displayIndex % BOARD_DIMENSION;
      const centerX = this.boardOffsetX + (column * this.squareSize) + (this.squareSize / 2);
      const centerY = this.boardOffsetY + (row * this.squareSize) + (this.squareSize / 2);
      const isBlackPiece = piece === BLACK || piece === BLACK_KING;
      const isSelected = this.selectedIndex === index;
      const isHovered = this.hoveredIndex === index && this.isHoverablePiece(index);
      const radiusScale = isSelected ? SELECTED_PIECE_SCALE : isHovered ? HOVER_PIECE_SCALE : 1;
      const radius = pieceRadius * radiusScale;
      const pieceGradient = isBlackPiece ? blackGradient : redGradient;
      const pieceBorder = isBlackPiece ? PIECE_BLACK_BORDER : PIECE_RED_BORDER;
      const pieceGlow = isBlackPiece ? PIECE_BLACK_GLOW : PIECE_RED_GLOW;
      const shadowAlpha = isHovered ? 0.44 : 0.36;
      const glowAlpha = isSelected ? 0.3 : isHovered ? 0.22 : 0.16;

      if (isSelected) {
        pieceGraphics.circle(centerX, centerY, radius + (selectionRingWidth * 0.62)).stroke({
          color: CHECKERS_SELECTION_OFFSET,
          alpha: 0.55,
          width: selectionRingWidth + 2,
        });
        pieceGraphics.circle(centerX, centerY, radius + (selectionRingWidth * 0.36)).stroke({
          color: CHECKERS_SELECTION_RING,
          alpha: 0.96,
          width: selectionRingWidth,
        });
      }

      pieceGraphics
        .circle(centerX + (this.squareSize * 0.04), centerY + (this.squareSize * 0.06), radius * 1.08)
        .fill({ color: PIECE_DROP_SHADOW_COLOR, alpha: shadowAlpha });
      pieceGraphics
        .circle(centerX, centerY, radius * 1.08)
        .fill({ color: pieceGlow, alpha: glowAlpha });
      pieceGraphics
        .circle(centerX, centerY, radius)
        .fill(pieceGradient)
        .stroke({ color: pieceBorder, width: outlineWidth });
      pieceGraphics
        .circle(centerX - (radius * 0.15), centerY - (radius * 0.2), radius * 0.38)
        .fill(highlightGradient);

      if (isHovered) {
        pieceGraphics
          .circle(centerX, centerY, radius * 0.94)
          .fill({ color: WHITE, alpha: 0.06 });
      }

      if (piece === BLACK_KING || piece === RED_KING) {
        pieceGraphics.circle(centerX, centerY, radius * 0.64).stroke({
          color: KING_CROWN_SHADOW,
          alpha: KING_CROWN_SHADOW_ALPHA,
          width: Math.max(4, outlineWidth + 3),
        });
        pieceGraphics.circle(centerX, centerY, radius * 0.58).stroke({
          color: KING_MARKER_COLOR,
          alpha: KING_CROWN_RING_ALPHA,
          width: Math.max(3, this.squareSize * 0.05),
        });
      }
    }

    this.piecesLayer.addChild(pieceGraphics);
  }

  private updateHud(): void {
    const { blackCount, redCount } = this.countPieces();
    const blackCaptured = CAPTURED_PIECE_TOTAL - blackCount;
    const redCaptured = CAPTURED_PIECE_TOTAL - redCount;
    const labelFontSize = Math.max(13, this.squareSize * 0.24);

    this.blackCountText.text = `Black captured ${blackCaptured}`;
    this.blackCountText.style.fontSize = labelFontSize;
    this.blackCountText.style.fill = TEXT_SECONDARY;
    this.redCountText.text = `Red captured ${redCaptured}`;
    this.redCountText.style.fontSize = labelFontSize;
    this.redCountText.style.fill = TEXT_SECONDARY;

    this.drawCapturedPieces(blackCaptured, redCaptured);
  }

  private drawCapturedPieces(blackCaptured: number, redCaptured: number): void {
    this.capturedPiecesGraphics.clear();

    const pipRadius = Math.max(4, this.squareSize * 0.1);
    const pipGap = Math.max(4, pipRadius * 0.75);
    const pipRowGap = Math.max(6, pipRadius * 1.55);
    const pipStartY = this.boardOffsetY + this.boardSize + Math.max(30, this.squareSize * 0.34);
    const blackGradient = createPieceBodyGradient("black");
    const redGradient = createPieceBodyGradient("red");

    for (let index = 0; index < blackCaptured; index += 1) {
      const row = Math.floor(index / CAPTURED_PIECES_PER_ROW);
      const column = index % CAPTURED_PIECES_PER_ROW;
      const centerX = this.boardOffsetX + pipRadius + (column * ((pipRadius * 2) + pipGap));
      const centerY = pipStartY + (row * ((pipRadius * 2) + pipRowGap));
      this.drawCapturedPiece(centerX, centerY, pipRadius, blackGradient, PIECE_BLACK_BORDER);
    }

    for (let index = 0; index < redCaptured; index += 1) {
      const row = Math.floor(index / CAPTURED_PIECES_PER_ROW);
      const column = index % CAPTURED_PIECES_PER_ROW;
      const centerX = this.boardOffsetX + this.boardSize - pipRadius - (column * ((pipRadius * 2) + pipGap));
      const centerY = pipStartY + (row * ((pipRadius * 2) + pipRowGap));
      this.drawCapturedPiece(centerX, centerY, pipRadius, redGradient, PIECE_RED_BORDER);
    }
  }

  private drawCapturedPiece(
    centerX: number,
    centerY: number,
    radius: number,
    gradient: ReturnType<typeof createPieceBodyGradient>,
    borderColor: number,
  ): void {
    this.capturedPiecesGraphics
      .circle(centerX + 1.5, centerY + 2, radius * 1.06)
      .fill({ color: PIECE_DROP_SHADOW_COLOR, alpha: 0.26 });
    this.capturedPiecesGraphics
      .circle(centerX, centerY, radius)
      .fill(gradient)
      .stroke({ color: borderColor, width: Math.max(1, radius * 0.16) });
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
    this.overlayBackground.rect(
      this.boardOffsetX,
      this.boardOffsetY,
      this.boardSize,
      this.boardSize,
    ).fill({ color: OVERLAY_BACKDROP_COLOR, alpha: OVERLAY_BACKDROP_ALPHA });

    this.overlayTitleText.text = this.getGameOverTitle();
    this.overlayTitleText.style.fontSize = Math.max(28, this.squareSize * 0.68);
    this.overlayTitleText.position.set(
      this.boardOffsetX + (this.boardSize / 2),
      this.boardOffsetY + (this.boardSize / 2) - (this.squareSize * 0.28),
    );

    this.overlaySubtitleText.text = this.getGameOverSubtitle();
    this.overlaySubtitleText.visible = this.overlaySubtitleText.text.length > 0;
    this.overlaySubtitleText.style.fontSize = Math.max(18, this.squareSize * 0.34);
    this.overlaySubtitleText.position.set(
      this.boardOffsetX + (this.boardSize / 2),
      this.boardOffsetY + (this.boardSize / 2) + (this.squareSize * 0.4),
    );
  }

  private clearPieces(): void {
    for (const child of this.piecesLayer.removeChildren()) {
      child.destroy();
    }
  }

  private handleSquareHover(displayIndex: number | null): void {
    // Block hover changes while a drag is active OR pending (not yet promoted past threshold)
    if (this.dragHelper?.draggingId !== null) return;

    const hoveredIndex = displayIndex === null ? null : this.toBoardIndex(displayIndex);
    const nextHoveredIndex = hoveredIndex !== null && this.isHoverablePiece(hoveredIndex)
      ? hoveredIndex
      : null;

    if (this.hoveredIndex === nextHoveredIndex) {
      return;
    }

    this.hoveredIndex = nextHoveredIndex;
    this.redrawPieces();
  }

  private handleSquarePointerDown(displayIndex: number, e: import("pixi.js").FederatedPointerEvent): void {
    const boardIndex = this.toBoardIndex(displayIndex);

    if (!this.isLocalPlayersTurn()) {
      if (this.selectedIndex !== null) {
        this.clearSelection();
      }
      return;
    }

    // If clicking on a selectable piece, start a potential drag
    if (this.isSelectableSquare(boardIndex)) {
      this.setSelection(boardIndex);
      this.dragSourceIndex = boardIndex;
      const pos = this.container.toLocal(e.global);
      const proxy = this.createDragProxy(boardIndex);
      this.dragHelper?.beginDrag(String(boardIndex), proxy, pos.x, pos.y);
      return;
    }

    // If a piece is selected and we click a valid target, execute the move
    if (this.selectedIndex !== null && this.validTargetIndexes.has(boardIndex)) {
      this.room?.send("move", { from: this.selectedIndex, to: boardIndex });
      this.clearSelection();
      return;
    }

    // Toggle selection off if clicking the same piece
    if (this.selectedIndex === boardIndex) {
      this.clearSelection();
      return;
    }

    this.clearSelection();
  }

  private handleSquareClick(displayIndex: number): void {
    const boardIndex = this.toBoardIndex(displayIndex);

    if (!this.isLocalPlayersTurn()) {
      if (this.selectedIndex !== null) {
        this.clearSelection();
      }
      return;
    }

    if (this.selectedIndex !== null && this.validTargetIndexes.has(boardIndex)) {
      const selectedIndex = this.selectedIndex;
      this.room?.send("move", { from: selectedIndex, to: boardIndex });
      this.clearSelection();
      return;
    }

    if (this.selectedIndex === boardIndex) {
      this.clearSelection();
      return;
    }

    if (this.isSelectableSquare(boardIndex)) {
      this.setSelection(boardIndex);
      return;
    }

    this.clearSelection();
  }

  private createDragProxy(boardIndex: number): Graphics {
    const piece = this.board[boardIndex];
    const isBlackPiece = piece === BLACK || piece === BLACK_KING;
    const radius = this.squareSize * 0.32 * DRAG_PIECE_SCALE;
    const outlineWidth = Math.max(1, this.squareSize * 0.04);
    const gradient = createPieceBodyGradient(isBlackPiece ? "black" : "red");
    const border = isBlackPiece ? PIECE_BLACK_BORDER : PIECE_RED_BORDER;
    const glow = isBlackPiece ? PIECE_BLACK_GLOW : PIECE_RED_GLOW;
    const highlight = createPieceHighlightGradient();

    const g = new Graphics();
    g.circle(0, 0, radius * 1.08).fill({ color: glow, alpha: 0.3 });
    g.circle(0, 0, radius).fill(gradient).stroke({ color: border, width: outlineWidth });
    g.circle(-(radius * 0.15), -(radius * 0.2), radius * 0.38).fill(highlight);

    if (piece === BLACK_KING || piece === RED_KING) {
      g.circle(0, 0, radius * 0.64).stroke({
        color: KING_CROWN_SHADOW,
        alpha: KING_CROWN_SHADOW_ALPHA,
        width: Math.max(4, outlineWidth + 3),
      });
      g.circle(0, 0, radius * 0.58).stroke({
        color: KING_MARKER_COLOR,
        alpha: KING_CROWN_RING_ALPHA,
        width: Math.max(3, this.squareSize * 0.05),
      });
    }

    return g;
  }

  private handleDragMove(x: number, y: number): void {
    // Highlight the square under the cursor if it's a valid target
    const displayIndex = this.getDisplayIndexAtPoint(x, y);
    if (displayIndex !== null) {
      const boardIndex = this.toBoardIndex(displayIndex);
      if (this.validTargetIndexes.has(boardIndex)) {
        this.hoveredIndex = boardIndex;
        this.redrawBoard();
        return;
      }
    }
    if (this.hoveredIndex !== null) {
      this.hoveredIndex = null;
      this.redrawBoard();
    }
  }

  private handleDragDrop(id: string, x: number, y: number): boolean {
    const fromIndex = Number(id);
    const displayIndex = this.getDisplayIndexAtPoint(x, y);

    this.hoveredIndex = null;
    this.dragSourceIndex = null;

    if (displayIndex !== null) {
      const targetIndex = this.toBoardIndex(displayIndex);
      if (this.validTargetIndexes.has(targetIndex)) {
        this.room?.send("move", { from: fromIndex, to: targetIndex });
        this.clearSelection();
        this.redrawBoard();
        this.redrawPieces();
        return true;
      }
    }

    // Invalid drop — selection stays so player can click a target instead
    this.redrawBoard();
    this.redrawPieces();
    return false;
  }

  private handleDragCancel(): void {
    this.hoveredIndex = null;
    this.dragSourceIndex = null;
    this.redrawBoard();
    this.redrawPieces();
  }

  private getDisplayIndexAtPoint(x: number, y: number): number | null {
    const col = Math.floor((x - this.boardOffsetX) / this.squareSize);
    const row = Math.floor((y - this.boardOffsetY) / this.squareSize);
    if (col < 0 || col >= BOARD_DIMENSION || row < 0 || row >= BOARD_DIMENSION) {
      return null;
    }
    return row * BOARD_DIMENSION + col;
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
    const previousBoard = [...this.board];
    const previousCurrentTurn = this.currentTurn;
    const previousPlayers = new Map(this.players);
    const nextState = state as Partial<CheckersState> | null;
    this.board = this.parseBoard(nextState);
    this.phase = typeof nextState?.phase === "string" ? nextState.phase : "waiting";
    this.currentTurn = typeof nextState?.currentTurn === "string" ? nextState.currentTurn : "";
    this.mustCaptureFrom = Number.isInteger(nextState?.mustCaptureFrom)
      ? Number(nextState.mustCaptureFrom)
      : NO_FORCED_CAPTURE;
    this.players = this.parsePlayers(nextState);
    this.isFlipped = this.getPerspectivePlayerColor() === BLACK;
    
    // Extract chess clock times from state
    const stateWithClocks = nextState as { player1TimeRemainingMs?: number; player2TimeRemainingMs?: number };
    this.player1TimeRemainingMs = typeof stateWithClocks?.player1TimeRemainingMs === "number" 
      ? stateWithClocks.player1TimeRemainingMs 
      : 600000;
    this.player2TimeRemainingMs = typeof stateWithClocks?.player2TimeRemainingMs === "number" 
      ? stateWithClocks.player2TimeRemainingMs 
      : 600000;
    
    this.recordMove(previousBoard, previousCurrentTurn, previousPlayers);
  }

  private syncSelectionWithState(): void {
    if (this.selectedIndex === null) {
      this.validTargetIndexes.clear();
      return;
    }

    if (!this.isSelectableSquare(this.selectedIndex)) {
      this.clearSelection(false);
      return;
    }

    this.updateValidTargets(this.selectedIndex);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.updateValidTargets(index);
    this.redrawBoard();
    this.redrawPieces();
  }

  private clearSelection(redraw = true): void {
    this.selectedIndex = null;
    this.validTargetIndexes.clear();

    if (redraw) {
      this.redrawBoard();
      this.redrawPieces();
    }
  }

  private updateValidTargets(index: number): void {
    this.validTargetIndexes = new Set(this.getMovesForSquare(index).map((move) => move.to));
  }

  private countPieces(): { blackCount: number; redCount: number } {
    let blackCount = 0;
    let redCount = 0;

    for (const piece of this.board) {
      if (piece === BLACK || piece === BLACK_KING) {
        blackCount += 1;
      } else if (piece === RED || piece === RED_KING) {
        redCount += 1;
      }
    }

    return { blackCount, redCount };
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

    if (this.isHeadToHeadMode()) {
      return { text: `${this.getTurnOwnerLabel()} to move`, color: TURN_READY_COLOR };
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

    if (this.isHeadToHeadMode()) {
      return "Shared device mode — pass the device after each turn.";
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

    if (this.isHeadToHeadMode()) {
      const winnerColor = this.gameResult?.metadata?.winnerColor;
      if (winnerColor === BLACK) {
        return "Black wins";
      }
      if (winnerColor === RED) {
        return "Red wins";
      }
      return "Game over";
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
      return "Black wins the match.";
    }

    if (winnerColor === RED) {
      return "Red wins the match.";
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

  private isSquareActionable(index: number): boolean {
    if (!this.isLocalPlayersTurn()) {
      return false;
    }

    if (this.validTargetIndexes.has(index)) {
      return true;
    }

    return this.isSelectableSquare(index);
  }

  private isHoverablePiece(index: number): boolean {
    return this.board[index] !== EMPTY && this.isSquareActionable(index);
  }

  private isSelectableSquare(index: number): boolean {
    const controllablePlayerColor = this.getControllablePlayerColor();
    if (controllablePlayerColor === null || getPieceColor(this.board[index]) !== controllablePlayerColor) {
      return false;
    }

    return this.getMovesForSquare(index).length > 0;
  }

  private isLocalPlayersTurn(): boolean {
    const localSessionId = this.room?.sessionId;
    const currentTurnPlayer = this.getCurrentTurnPlayer();
    if (!localSessionId || !currentTurnPlayer || currentTurnPlayer.isSpectator) {
      return false;
    }

    return this.currentTurn === localSessionId
      || currentTurnPlayer.controllerSessionId === localSessionId;
  }

  private getLocalPlayer(): PlayerSnapshot | null {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId) {
      return null;
    }

    return this.players.get(localSessionId) ?? null;
  }

  private getPlayerByIndex(playerIndex: number): PlayerSnapshot | null {
    for (const player of this.players.values()) {
      if (player.playerIndex === playerIndex) {
        return player;
      }
    }
    return null;
  }

  private getLocalPlayerColor(): number | null {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer || localPlayer.isSpectator) {
      return null;
    }

    return getPlayerColorFromPlayerIndex(localPlayer.playerIndex);
  }

  private getCurrentTurnPlayer(): PlayerSnapshot | null {
    if (!this.currentTurn) {
      return null;
    }

    return this.players.get(this.currentTurn) ?? null;
  }

  private getPlayerColor(player: PlayerSnapshot | null): number | null {
    if (!player || player.isSpectator) {
      return null;
    }

    return getPlayerColorFromPlayerIndex(player.playerIndex);
  }

  private isHeadToHeadMode(): boolean {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId) {
      return false;
    }

    return Array.from(this.players.entries()).some(([sessionId, player]) => (
      !player.isSpectator
      && sessionId !== localSessionId
      && sessionId !== "cpu-opponent"
      && player.controllerSessionId === localSessionId
    ));
  }

  private getControllablePlayerColor(): number | null {
    if (this.isHeadToHeadMode()) {
      return this.getPlayerColor(this.getCurrentTurnPlayer());
    }

    return this.getLocalPlayerColor();
  }

  private getPerspectivePlayerColor(): number | null {
    if (this.isHeadToHeadMode()) {
      return this.getPlayerColor(this.getCurrentTurnPlayer());
    }

    return this.getLocalPlayerColor();
  }

  private getTurnOwnerLabel(): string {
    const currentTurnPlayerColor = this.getPlayerColor(this.getCurrentTurnPlayer());
    if (currentTurnPlayerColor === BLACK) {
      return "Black";
    }
    if (currentTurnPlayerColor === RED) {
      return "Red";
    }

    const currentPlayer = this.getCurrentTurnPlayer();
    return currentPlayer?.displayName || "Player";
  }

  private toDisplayIndex(boardIndex: number): number {
    return this.isFlipped ? (BOARD_CELL_COUNT - 1) - boardIndex : boardIndex;
  }

  private toBoardIndex(displayIndex: number): number {
    return this.isFlipped ? (BOARD_CELL_COUNT - 1) - displayIndex : displayIndex;
  }

  private getMovesForSquare(index: number): CheckersMove[] {
    return getValidMoves(this.board, index, this.mustCaptureFrom);
  }

  private updateSidebar(): void {
    if (!this.sidebar) {
      return;
    }

    const { blackCount, redCount } = this.countPieces();
    const notes: string[] = [];
    const playerColorLabel = this.getPlayerColorLabel();
    if (playerColorLabel.length > 0) {
      notes.push(`<div class="sidebar-note">${escapeHtml(playerColorLabel)}</div>`);
    }
    if (this.mustCaptureFrom !== NO_FORCED_CAPTURE) {
      notes.push(
        `<div class="sidebar-note">Forced capture continues from ${escapeHtml(boardIndexToNotation(this.mustCaptureFrom))}.</div>`,
      );
    }

    this.sidebar.updatePanel(
      "game-info",
      `<div class="sidebar-stat-list">
        ${this.getCurrentTurnRowMarkup()}
        ${getTurnClockMarkup(this.turnClockSeconds, this.showTurnClock)}
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Black pieces</span><span class="sidebar-stat-value">⚫ ${blackCount}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Red pieces</span><span class="sidebar-stat-value">🔴 ${redCount}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Status</span><span class="sidebar-stat-value">${escapeHtml(this.getSidebarStatus())}</span></div>
      </div>${notes.join("")}`,
    );

    // Update chess clock panel
    this.updateChessClockPanel();

    const historyMarkup = this.moveHistory.length > 0
      ? `<div class="sidebar-history-list">${this.moveHistory.map((move, index) => `
          <div class="sidebar-history-item">
            <span class="sidebar-history-index">${index + 1}</span>
            <span class="sidebar-history-text">${escapeHtml(move)}</span>
          </div>
        `).join("")}</div>`
      : `<div class="sidebar-empty">Moves will appear here once the first turn is made.</div>`;
    this.sidebar.updatePanel("move-history", historyMarkup);

    this.sidebar.updatePanel(
      "controls",
      `<div class="sidebar-button-group">
        <button type="button" class="sidebar-button sidebar-button--danger" data-action="resign"${this.requestLeave ? "" : " disabled"}>Resign</button>
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="offer-draw" disabled>Offer Draw</button>
      </div>
      <div class="sidebar-note">Use the HUD Leave Game button or resign here to concede. Draw offers are not available yet.</div>`,
    );

    const controlsPanel = this.sidebar.getPanelContent("controls");
    const resignButton = controlsPanel?.querySelector('[data-action="resign"]');
    if (resignButton instanceof HTMLButtonElement) {
      resignButton.onclick = () => {
        this.requestLeave?.();
      };
    }
  }

  private updateChessClockPanel(): void {
    if (!this.sidebar) {
      return;
    }

    // Get player names
    const player1 = this.getPlayerByIndex(0);
    const player2 = this.getPlayerByIndex(1);
    const player1Name = player1?.displayName || "Player 1";
    const player2Name = player2?.displayName || "Player 2";

    // Determine active player (0 for Black/player1, 1 for Red/player2)
    const currentPlayer = this.players.get(this.currentTurn);
    const activePlayerIndex = currentPlayer?.playerIndex ?? -1;

    // Generate chess clock markup
    const clockMarkup = getChessClockMarkup(
      this.player1TimeRemainingMs,
      this.player2TimeRemainingMs,
      activePlayerIndex,
      player1Name,
      player2Name,
    );

    this.sidebar.updatePanel("game-clock", clockMarkup);
  }

  private getCurrentTurnRowMarkup(): string {
    const isLocalTurn = this.isLocalPlayersTurn();
    const rowClass = isLocalTurn ? "sidebar-stat-row sidebar-stat-row--turn-active" : "sidebar-stat-row";
    const valueClass = isLocalTurn ? "sidebar-stat-value sidebar-stat-value--turn-active" : "sidebar-stat-value";
    const styleAttribute = isLocalTurn
      ? ` style="--sidebar-turn-indicator-border: ${toCssRgbaColor(STATUS_ONLINE, 0.44)}; --sidebar-turn-indicator-bg: ${toCssRgbaColor(AMBER_500, 0.18)}; --sidebar-turn-indicator-shadow: ${toCssRgbaColor(AMBER_500, 0.24)}; --sidebar-turn-indicator-accent: ${toCssHexColor(YELLOW_400)}; --sidebar-turn-indicator-text: ${toCssHexColor(WHITE)}; --sidebar-turn-indicator-text-glow: ${toCssRgbaColor(YELLOW_400, 0.26)};"`
      : "";
    const turnLabel = this.isHeadToHeadMode()
      ? `${this.getTurnOwnerLabel()} to move`
      : isLocalTurn ? "Your Turn" : this.getCurrentTurnLabel();

    return `<div class="${rowClass}"${styleAttribute}><span class="sidebar-stat-label">Current turn</span><span class="${valueClass}">${escapeHtml(turnLabel)}</span></div>`;
  }

  private getCurrentTurnLabel(): string {
    if (!this.currentTurn) {
      return "Waiting";
    }

    if (this.isHeadToHeadMode()) {
      return this.getTurnOwnerLabel();
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

  private getSidebarStatus(): string {
    if (this.phase === "waiting") {
      return this.isHeadToHeadMode()
        ? "Start the shared-device game when you are ready."
        : "Waiting for both players to join.";
    }

    if (this.phase === "ended") {
      return this.getGameOverSubtitle() || "Match complete.";
    }

    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      return "Waiting for players.";
    }

    if (localPlayer.isSpectator) {
      return "Spectating the live board.";
    }

    if (this.mustCaptureFrom !== NO_FORCED_CAPTURE) {
      return this.isHeadToHeadMode()
        ? "Finish the capture chain before passing the device."
        : "Capture chain in progress.";
    }

    if (this.isHeadToHeadMode()) {
      return `Pass the device and make ${this.getTurnOwnerLabel()}'s move.`;
    }

    return this.isLocalPlayersTurn() ? "Make a move on the board." : "Waiting for the opponent.";
  }

  private recordMove(
    previousBoard: number[],
    previousCurrentTurn: string,
    previousPlayers: Map<string, PlayerSnapshot>,
  ): void {
    if (previousCurrentTurn.length === 0 || previousBoard.every((piece) => piece === EMPTY)) {
      return;
    }

    const mover = previousPlayers.get(previousCurrentTurn);
    if (!mover || mover.isSpectator) {
      return;
    }

    const moverColor = getPlayerColorFromPlayerIndex(mover.playerIndex);
    if (moverColor !== BLACK && moverColor !== RED) {
      return;
    }

    const kingPiece = moverColor === BLACK ? BLACK_KING : RED_KING;
    let fromIndex: number | null = null;
    let toIndex: number | null = null;

    for (let index = 0; index < BOARD_CELL_COUNT; index += 1) {
      const previousPiece = previousBoard[index];
      const nextPiece = this.board[index];
      if (previousPiece === nextPiece) {
        continue;
      }

      const movedFrom = (previousPiece === moverColor || previousPiece === kingPiece) && nextPiece === EMPTY;
      const movedTo = (nextPiece === moverColor || nextPiece === kingPiece) && previousPiece !== nextPiece;
      if (movedFrom) {
        fromIndex = index;
      }
      if (movedTo) {
        toIndex = index;
      }
    }

    if (fromIndex === null || toIndex === null) {
      return;
    }

    const isCapture = Math.abs(Math.floor(fromIndex / BOARD_DIMENSION) - Math.floor(toIndex / BOARD_DIMENSION)) > 1;
    const promoted = previousBoard[toIndex] !== kingPiece && this.board[toIndex] === kingPiece;
    const moverLabel = moverColor === BLACK ? "Black" : "Red";
    this.pushMoveHistory(
      `${moverLabel}: ${boardIndexToNotation(fromIndex)} → ${boardIndexToNotation(toIndex)}${isCapture ? " ×" : ""}${promoted ? " (king)" : ""}`,
    );
  }

  private pushMoveHistory(move: string): void {
    this.moveHistory.unshift(move);
    if (this.moveHistory.length > MAX_SIDEBAR_HISTORY_ITEMS) {
      this.moveHistory.length = MAX_SIDEBAR_HISTORY_ITEMS;
    }
  }

  private parseBoard(state: Partial<CheckersState> | null): number[] {
    const normalizedBoard = state?.board ? Array.from(state.board, (cell) => Number(cell)) : [];

    if (normalizedBoard.length >= BOARD_CELL_COUNT) {
      return normalizedBoard.slice(0, BOARD_CELL_COUNT);
    }

    return [
      ...normalizedBoard,
      ...Array.from({ length: BOARD_CELL_COUNT - normalizedBoard.length }, () => EMPTY),
    ];
  }

  private parsePlayers(state: Partial<CheckersState> | null): Map<string, PlayerSnapshot> {
    const players = new Map<string, PlayerSnapshot>();

    for (const [sessionId, player] of state?.players?.entries() ?? []) {
      players.set(sessionId, {
        displayName: typeof player.displayName === "string" ? player.displayName : "Player",
        playerIndex: Number(player.playerIndex ?? -1),
        isSpectator: Boolean(player.isSpectator),
        controllerSessionId: typeof player.controllerSessionId === "string" ? player.controllerSessionId : "",
      });
    }

    return players;
  }
}

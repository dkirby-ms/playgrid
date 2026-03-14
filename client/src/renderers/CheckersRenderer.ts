import type { Room } from "@colyseus/sdk";
import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED_KING,
  type CheckersState,
} from "@eschaton/playgrid-shared";
import { Container, Graphics, Text } from "pixi.js";
import {
  getPieceColor,
  getPlayerColorFromPlayerIndex,
  getValidMoves,
  type CheckersMove,
} from "../games/checkers/checkersClientLogic";
import type { GameRenderer, GameRendererContext, RendererInputEvent } from "./GameRenderer";

const BOARD_DIMENSION = 8;
const BOARD_CELL_COUNT = BOARD_DIMENSION * BOARD_DIMENSION;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const LIGHT_SQUARE_COLOR = 0xf0d9b5;
const DARK_SQUARE_COLOR = 0xb58863;
const BLACK_PIECE_COLOR = 0x333333;
const RED_PIECE_COLOR = 0xcc3333;
const KING_MARKER_COLOR = 0xf7e36a;
const PIECE_OUTLINE_COLOR = 0x111111;
const SELECTED_SQUARE_COLOR = 0xf7e36a;
const VALID_TARGET_COLOR = 0x53d769;
const VALID_TARGET_ALPHA = 0.8;
const NO_FORCED_CAPTURE = -1;

type PlayerSnapshot = {
  playerIndex: number;
  isSpectator: boolean;
};

export class CheckersRenderer implements GameRenderer {
  readonly gameType = "checkers";
  readonly container = new Container();

  private readonly boardLayer = new Container();
  private readonly piecesLayer = new Container();
  private readonly squareGraphics: Graphics[] = [];
  private room: Room | null = null;
  private board: number[] = Array.from({ length: BOARD_CELL_COUNT }, () => EMPTY);
  private currentTurn = "";
  private mustCaptureFrom = NO_FORCED_CAPTURE;
  private players = new Map<string, PlayerSnapshot>();
  private selectedIndex: number | null = null;
  private validTargetIndexes = new Set<number>();
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private squareSize = Math.min(DEFAULT_WIDTH, DEFAULT_HEIGHT) / BOARD_DIMENSION;
  private boardSize = this.squareSize * BOARD_DIMENSION;
  private boardOffsetX = (DEFAULT_WIDTH - this.boardSize) / 2;
  private boardOffsetY = (DEFAULT_HEIGHT - this.boardSize) / 2;

  constructor() {
    this.piecesLayer.eventMode = "none";

    for (let index = 0; index < BOARD_CELL_COUNT; index += 1) {
      const square = new Graphics();
      square.eventMode = "static";
      square.on("pointertap", () => {
        this.handleSquareClick(index);
      });
      this.squareGraphics.push(square);
      this.boardLayer.addChild(square);
    }

    this.container.addChild(this.boardLayer, this.piecesLayer);
  }

  init(state: unknown, context?: GameRendererContext): void {
    this.room = context?.room ?? null;
    this.selectedIndex = null;
    this.validTargetIndexes.clear();
    this.applyState(state);
    this.redrawBoard();
    this.redrawPieces();
  }

  onStateChange(state: unknown): void {
    this.applyState(state);
    this.syncSelectionWithState();
    this.redrawBoard();
    this.redrawPieces();
  }

  update(_deltaTime: number): void {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.squareSize = Math.min(width, height) / BOARD_DIMENSION;
    this.boardSize = this.squareSize * BOARD_DIMENSION;
    this.boardOffsetX = (width - this.boardSize) / 2;
    this.boardOffsetY = (height - this.boardSize) / 2;
    this.redrawBoard();
    this.redrawPieces();
  }

  handleInput(_event: RendererInputEvent): void {}

  destroy(): void {
    this.room = null;
    this.players.clear();
    this.validTargetIndexes.clear();
    this.clearPieces();
    this.squareGraphics.length = 0;
    this.container.destroy({ children: true });
  }

  private redrawBoard(): void {
    for (let index = 0; index < BOARD_CELL_COUNT; index += 1) {
      const row = Math.floor(index / BOARD_DIMENSION);
      const column = index % BOARD_DIMENSION;
      const square = this.squareGraphics[index];
      const squareColor = (row + column) % 2 === 0 ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
      const x = this.boardOffsetX + (column * this.squareSize);
      const y = this.boardOffsetY + (row * this.squareSize);
      const isSelected = this.selectedIndex === index;
      const isValidTarget = this.validTargetIndexes.has(index);

      square.clear();
      square.rect(x, y, this.squareSize, this.squareSize).fill(squareColor);

      if (isSelected) {
        square.stroke({
          color: SELECTED_SQUARE_COLOR,
          width: Math.max(3, this.squareSize * 0.08),
        });
      }

      if (isValidTarget) {
        square.circle(
          x + (this.squareSize / 2),
          y + (this.squareSize / 2),
          this.squareSize * 0.14,
        ).fill({ color: VALID_TARGET_COLOR, alpha: VALID_TARGET_ALPHA });
      }

      square.cursor = this.isSquareActionable(index) ? "pointer" : "default";
    }
  }

  private redrawPieces(): void {
    this.clearPieces();

    const pieceGraphics = new Graphics();
    const pieceRadius = this.squareSize * 0.35;
    const outlineWidth = Math.max(1, this.squareSize * 0.04);

    for (const [index, piece] of this.board.entries()) {
      if (piece === EMPTY) {
        continue;
      }

      const row = Math.floor(index / BOARD_DIMENSION);
      const column = index % BOARD_DIMENSION;
      const centerX = this.boardOffsetX + (column * this.squareSize) + (this.squareSize / 2);
      const centerY = this.boardOffsetY + (row * this.squareSize) + (this.squareSize / 2);
      const pieceColor = piece === BLACK || piece === BLACK_KING ? BLACK_PIECE_COLOR : RED_PIECE_COLOR;

      pieceGraphics
        .circle(centerX, centerY, pieceRadius)
        .fill(pieceColor)
        .stroke({ color: PIECE_OUTLINE_COLOR, width: outlineWidth });

      if (piece === BLACK_KING || piece === RED_KING) {
        const kingMarker = new Text({
          text: "K",
          style: {
            fontFamily: "sans-serif",
            fontSize: this.squareSize * 0.34,
            fontWeight: "700",
            fill: KING_MARKER_COLOR,
            align: "center",
          },
        });
        kingMarker.anchor.set(0.5);
        kingMarker.position.set(centerX, centerY);
        this.piecesLayer.addChild(kingMarker);
      }
    }

    this.piecesLayer.addChildAt(pieceGraphics, 0);
  }

  private clearPieces(): void {
    for (const child of this.piecesLayer.removeChildren()) {
      child.destroy();
    }
  }

  private handleSquareClick(index: number): void {
    if (!this.isLocalPlayersTurn()) {
      if (this.selectedIndex !== null) {
        this.clearSelection();
      }
      return;
    }

    if (this.selectedIndex !== null && this.validTargetIndexes.has(index)) {
      const selectedIndex = this.selectedIndex;
      this.room?.send("move", { from: selectedIndex, to: index });
      this.clearSelection();
      return;
    }

    if (this.selectedIndex === index) {
      this.clearSelection();
      return;
    }

    if (this.isSelectableSquare(index)) {
      this.setSelection(index);
      return;
    }

    this.clearSelection();
  }

  private applyState(state: unknown): void {
    const nextState = state as Partial<CheckersState> | null;
    this.board = this.parseBoard(nextState);
    this.currentTurn = typeof nextState?.currentTurn === "string" ? nextState.currentTurn : "";
    this.mustCaptureFrom = Number.isInteger(nextState?.mustCaptureFrom)
      ? Number(nextState.mustCaptureFrom)
      : NO_FORCED_CAPTURE;
    this.players = this.parsePlayers(nextState);
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
  }

  private clearSelection(redraw = true): void {
    this.selectedIndex = null;
    this.validTargetIndexes.clear();

    if (redraw) {
      this.redrawBoard();
    }
  }

  private updateValidTargets(index: number): void {
    this.validTargetIndexes = new Set(this.getMovesForSquare(index).map((move) => move.to));
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

  private isSelectableSquare(index: number): boolean {
    const localPlayerColor = this.getLocalPlayerColor();
    if (localPlayerColor === null || getPieceColor(this.board[index]) !== localPlayerColor) {
      return false;
    }

    return this.getMovesForSquare(index).length > 0;
  }

  private isLocalPlayersTurn(): boolean {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId || localSessionId !== this.currentTurn) {
      return false;
    }

    const localPlayer = this.players.get(localSessionId);
    return Boolean(localPlayer && !localPlayer.isSpectator);
  }

  private getLocalPlayerColor(): number | null {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId) {
      return null;
    }

    const localPlayer = this.players.get(localSessionId);
    if (!localPlayer || localPlayer.isSpectator) {
      return null;
    }

    return getPlayerColorFromPlayerIndex(localPlayer.playerIndex);
  }

  private getMovesForSquare(index: number): CheckersMove[] {
    return getValidMoves(this.board, index, this.mustCaptureFrom);
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
        playerIndex: Number(player.playerIndex ?? -1),
        isSpectator: Boolean(player.isSpectator),
      });
    }

    return players;
  }
}

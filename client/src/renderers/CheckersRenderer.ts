import { BLACK, BLACK_KING, EMPTY, RED_KING, type CheckersState } from "@eschaton/playgrid-shared";
import { Container, Graphics, Text } from "pixi.js";
import type { GameRenderer, RendererInputEvent } from "./GameRenderer";

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

export class CheckersRenderer implements GameRenderer {
  readonly gameType = "checkers";
  readonly container = new Container();

  private readonly boardGraphics = new Graphics();
  private readonly piecesLayer = new Container();
  private board: number[] = Array.from({ length: BOARD_CELL_COUNT }, () => EMPTY);
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private squareSize = Math.min(DEFAULT_WIDTH, DEFAULT_HEIGHT) / BOARD_DIMENSION;
  private boardSize = this.squareSize * BOARD_DIMENSION;
  private boardOffsetX = (DEFAULT_WIDTH - this.boardSize) / 2;
  private boardOffsetY = (DEFAULT_HEIGHT - this.boardSize) / 2;

  constructor() {
    this.container.addChild(this.boardGraphics, this.piecesLayer);
  }

  init(state: unknown): void {
    this.board = this.parseBoard(state);
    this.redrawBoard();
    this.redrawPieces();
  }

  onStateChange(state: unknown): void {
    this.board = this.parseBoard(state);
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
    this.clearPieces();
    this.container.removeChildren();
    this.boardGraphics.destroy();
    this.piecesLayer.destroy();
    this.container.destroy();
  }

  private redrawBoard(): void {
    this.boardGraphics.clear();

    for (let row = 0; row < BOARD_DIMENSION; row += 1) {
      for (let column = 0; column < BOARD_DIMENSION; column += 1) {
        const squareColor = (row + column) % 2 === 0 ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
        const x = this.boardOffsetX + (column * this.squareSize);
        const y = this.boardOffsetY + (row * this.squareSize);

        this.boardGraphics
          .rect(x, y, this.squareSize, this.squareSize)
          .fill(squareColor);
      }
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

  private parseBoard(state: unknown): number[] {
    const board = (state as Partial<CheckersState> | null)?.board;
    const normalizedBoard = board ? Array.from(board, (cell) => Number(cell)) : [];

    if (normalizedBoard.length >= BOARD_CELL_COUNT) {
      return normalizedBoard.slice(0, BOARD_CELL_COUNT);
    }

    return [
      ...normalizedBoard,
      ...Array.from({ length: BOARD_CELL_COUNT - normalizedBoard.length }, () => EMPTY),
    ];
  }
}

import type { Room } from "@colyseus/sdk";
import {
  BLACK,
  BLACK_KING,
  EMPTY,
  RED,
  RED_KING,
  type CheckersState,
  type GameResult,
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
const HUD_TEXT_COLOR = 0xffffff;
const SUBTLE_TEXT_COLOR = 0xd7d9df;
const TURN_READY_COLOR = 0x53d769;
const TURN_WAITING_COLOR = 0xc0c4cf;
const OVERLAY_BACKDROP_COLOR = 0x000000;
const OVERLAY_BACKDROP_ALPHA = 0.66;
const VIEW_PADDING = 24;
const TOP_HUD_SPACE = 104;
const BOTTOM_HUD_SPACE = 60;
const GAME_ENDED_MESSAGE = "game-end";
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
  private readonly overlayLayer = new Container();
  private readonly overlayBackground = new Graphics();
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
  private readonly blackCountText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "600",
      fill: HUD_TEXT_COLOR,
    },
  });
  private readonly redCountText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      fontWeight: "600",
      fill: RED_PIECE_COLOR,
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
  private readonly squareGraphics: Graphics[] = [];
  private room: Room | null = null;
  private unsubscribeGameEnded: (() => void) | null = null;
  private board: number[] = Array.from({ length: BOARD_CELL_COUNT }, () => EMPTY);
  private phase = "waiting";
  private currentTurn = "";
  private mustCaptureFrom = NO_FORCED_CAPTURE;
  private players = new Map<string, PlayerSnapshot>();
  private gameResult: GameResult | null = null;
  private selectedIndex: number | null = null;
  private validTargetIndexes = new Set<number>();
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private squareSize = Math.min(DEFAULT_WIDTH, DEFAULT_HEIGHT - TOP_HUD_SPACE - BOTTOM_HUD_SPACE)
    / BOARD_DIMENSION;
  private boardSize = this.squareSize * BOARD_DIMENSION;
  private boardOffsetX = (DEFAULT_WIDTH - this.boardSize) / 2;
  private boardOffsetY = TOP_HUD_SPACE
    + ((DEFAULT_HEIGHT - TOP_HUD_SPACE - BOTTOM_HUD_SPACE - this.boardSize) / 2);

  constructor() {
    this.piecesLayer.eventMode = "none";
    this.overlayLayer.eventMode = "none";
    this.overlayLayer.visible = false;
    this.statusText.anchor.set(0.5);
    this.playerColorText.anchor.set(0.5);
    this.blackCountText.anchor.set(0, 0.5);
    this.redCountText.anchor.set(1, 0.5);
    this.overlayTitleText.anchor.set(0.5);
    this.overlaySubtitleText.anchor.set(0.5);

    this.overlayLayer.addChild(this.overlayBackground, this.overlayTitleText, this.overlaySubtitleText);

    for (let index = 0; index < BOARD_CELL_COUNT; index += 1) {
      const square = new Graphics();
      square.eventMode = "static";
      square.on("pointertap", () => {
        this.handleSquareClick(index);
      });
      this.squareGraphics.push(square);
      this.boardLayer.addChild(square);
    }

    this.container.addChild(
      this.statusText,
      this.playerColorText,
      this.boardLayer,
      this.piecesLayer,
      this.blackCountText,
      this.redCountText,
      this.overlayLayer,
    );
  }

  init(state: unknown, context?: GameRendererContext): void {
    this.unsubscribeFromRoomEvents();
    this.room = context?.room ?? null;
    this.gameResult = null;
    this.selectedIndex = null;
    this.validTargetIndexes.clear();
    this.subscribeToRoomEvents();
    this.applyState(state);
    this.layout();
    this.redrawBoard();
    this.redrawPieces();
    this.updateHud();
    this.updateGameOverOverlay();
  }

  onStateChange(state: unknown): void {
    this.applyState(state);
    this.syncSelectionWithState();
    this.redrawBoard();
    this.redrawPieces();
    this.updateHud();
    this.updateGameOverOverlay();
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
    this.players.clear();
    this.validTargetIndexes.clear();
    this.clearPieces();
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

    const statusCenterY = Math.max(34, this.boardOffsetY * 0.36);
    this.statusText.position.set(this.width / 2, statusCenterY);
    this.playerColorText.position.set(this.width / 2, statusCenterY + 30);
    this.blackCountText.position.set(this.boardOffsetX, this.boardOffsetY + this.boardSize + 28);
    this.redCountText.position.set(this.boardOffsetX + this.boardSize, this.boardOffsetY + this.boardSize + 28);
    this.overlayTitleText.style.wordWrapWidth = this.boardSize * 0.75;
    this.overlaySubtitleText.style.wordWrapWidth = this.boardSize * 0.75;
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

  private updateHud(): void {
    const { text: statusLabel, color: statusColor } = this.getStatusLabel();
    const { blackCount, redCount } = this.countPieces();

    this.statusText.text = statusLabel;
    this.statusText.style.fill = statusColor;
    this.statusText.style.fontSize = Math.max(22, this.squareSize * 0.5);
    this.playerColorText.text = this.getPlayerColorLabel();
    this.playerColorText.visible = this.playerColorText.text.length > 0;
    this.playerColorText.style.fontSize = Math.max(16, this.squareSize * 0.32);
    this.blackCountText.text = `⚫ Black: ${blackCount}`;
    this.blackCountText.style.fontSize = Math.max(16, this.squareSize * 0.32);
    this.blackCountText.style.fill = HUD_TEXT_COLOR;
    this.redCountText.text = `🔴 Red: ${redCount}`;
    this.redCountText.style.fontSize = Math.max(16, this.squareSize * 0.32);
    this.redCountText.style.fill = RED_PIECE_COLOR;
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

  private subscribeToRoomEvents(): void {
    if (!this.room) {
      return;
    }

    this.unsubscribeGameEnded = this.room.onMessage<GameResult>(GAME_ENDED_MESSAGE, (result) => {
      this.gameResult = result;
      this.updateHud();
      this.updateGameOverOverlay();
    });
  }

  private unsubscribeFromRoomEvents(): void {
    this.unsubscribeGameEnded?.();
    this.unsubscribeGameEnded = null;
  }

  private applyState(state: unknown): void {
    const nextState = state as Partial<CheckersState> | null;
    this.board = this.parseBoard(nextState);
    this.phase = typeof nextState?.phase === "string" ? nextState.phase : "waiting";
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

  private getLocalPlayer(): PlayerSnapshot | null {
    const localSessionId = this.room?.sessionId;
    if (!localSessionId) {
      return null;
    }

    return this.players.get(localSessionId) ?? null;
  }

  private getLocalPlayerColor(): number | null {
    const localPlayer = this.getLocalPlayer();
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

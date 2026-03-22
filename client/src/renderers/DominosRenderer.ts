import type { Room } from "@colyseus/sdk";
import type {
  BoardTile,
  DominosState,
  GameResult,
} from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import { GameSidebar, escapeHtml, getTurnClockMarkup } from "../ui/GameSidebar";
import { DragHelper } from "./DragHelper";
import { TweenManager } from "./TweenManager";
import {
  ACCENT_BLUE,
  AMBER_500,
  BG_CARD,
  BG_PRIMARY,
  BLACK as TOKEN_BLACK,
  BLUE_400,
  BORDER_LIGHT,
  BORDER_LIGHT_ALPHA,
  EMERALD_800,
  EMERALD_900,
  SLATE_700,
  SLATE_800,
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

// ── Layout constants ────────────────────────────────────────────────────────
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const VIEW_PADDING = 24;
const TOP_HUD_SPACE = 80;
const BOTTOM_HUD_SPACE = 160;
const HAND_AREA_HEIGHT = 130;
const HAND_TILE_GAP = 8;

// ── Tile rendering constants ────────────────────────────────────────────────
const TILE_WIDTH = 48;
const TILE_HEIGHT = 88;
const TILE_HALF = TILE_HEIGHT / 2;
const TILE_RADIUS = 6;
const PIP_RADIUS = 3.5;
const TILE_BG = WHITE;
const TILE_BORDER = SLATE_700;
const TILE_PIP_COLOR = TOKEN_BLACK;
const TILE_SHADOW_COLOR = TOKEN_BLACK;
const TILE_SHADOW_ALPHA = 0.25;
const TILE_DIVIDER_COLOR = SLATE_700;
const TILE_SELECTED_BORDER = ACCENT_BLUE;
const TILE_SELECTED_GLOW = BLUE_400;
const TILE_SELECTED_GLOW_ALPHA = 0.35;
const TILE_FACEDOWN_BG = SLATE_800;
const TILE_FACEDOWN_BORDER = SLATE_700;

// Board-chain tile sizing (horizontal orientation)
const BOARD_TILE_W = 56;
const BOARD_TILE_H = 28;
const BOARD_TILE_GAP = 4;

const END_MARKER_COLOR = ACCENT_BLUE;
const END_MARKER_ACTIVE_ALPHA = 0.85;
const END_LABEL_FONT_SIZE = 14;

// Spinner arm indicators (C/D arm discoverability)
const SPINNER_IND_LENGTH = 28;
const SPINNER_IND_DASH_LEN = 5;
const SPINNER_IND_GAP_LEN = 4;
const SPINNER_IND_ARROW_SIZE = 5;
const SPINNER_IND_LOCKED_COLOR = SLATE_700;
const SPINNER_IND_LOCKED_ALPHA = 0.35;
const SPINNER_IND_ACTIVE_COLOR = ACCENT_BLUE;
const SPINNER_IND_ACTIVE_ALPHA = 0.6;
const SPINNER_IND_FLASH_COLOR = BLUE_400;
const SPINNER_IND_FLASH_ALPHA = 1.0;
const SPINNER_UNLOCK_FLASH_MS = 1500;

const BONEYARD_BG = BG_CARD;
const BONEYARD_BORDER = BORDER_LIGHT;
const BONEYARD_RADIUS = 10;

const OVERLAY_BACKDROP_COLOR = BG_PRIMARY;
const OVERLAY_BACKDROP_ALPHA = 0.66;

const GAME_ENDED_MESSAGE = "game-end";

const TILE_ANIM_DURATION_MS = 250;

// ── Pip layout positions (normalised to 0..1 inside a half-tile) ────────────
// Standard domino pip patterns for 0-6
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
};

function toCssHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function toCssRgbaColor(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Snapshot types ──────────────────────────────────────────────────────────
type PlayerSnapshot = {
  displayName: string;
  playerIndex: number;
  isSpectator: boolean;
  sessionId: string;
};

type HandTile = {
  id: number;
  highPips: number;
  lowPips: number;
};

type BoardTileSnapshot = {
  id: number;
  highPips: number;
  lowPips: number;
  exposedEnd: number;
  arm: string;
  isDouble: boolean;
};

type EndPositions = {
  a: { x: number; y: number };
  b: { x: number; y: number };
  c: { x: number; y: number };
  d: { x: number; y: number };
};

export class DominosRenderer implements GameRenderer {
  readonly gameType = "dominos";
  readonly container = new Container();

  // ── Layers ──────────────────────────────────────────────────────────────
  private readonly boardBackground = new Graphics();
  private readonly boardLayer = new Container();
  private readonly ghostLayer = new Container();
  private readonly handLayer = new Container();
  private readonly dragLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly overlayBackground = new Graphics();
  private readonly overlayTitleText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 36,
      fontWeight: "800",
      fill: TEXT_PRIMARY,
      align: "center",
      wordWrap: true,
      wordWrapWidth: DEFAULT_WIDTH * 0.7,
    },
  });
  private readonly overlaySubtitleText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 18,
      fontWeight: "500",
      fill: TEXT_SUBTLE,
      align: "center",
      wordWrap: true,
      wordWrapWidth: DEFAULT_WIDTH * 0.7,
    },
  });

  // Board end-choice markers
  private readonly endMarkerA = new Graphics();
  private readonly endMarkerB = new Graphics();
  private readonly endMarkerC = new Graphics();
  private readonly endMarkerD = new Graphics();

  // Boneyard area
  private readonly boneyardGraphics = new Graphics();
  private readonly boneyardLabel = new Text({
    text: "Boneyard",
    style: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "600", fill: TEXT_SECONDARY },
  });
  private readonly boneyardCountText = new Text({
    text: "0",
    style: { fontFamily: "sans-serif", fontSize: 22, fontWeight: "700", fill: TEXT_PRIMARY },
  });

  // ── State ───────────────────────────────────────────────────────────────
  private room: Room | null = null;
  private requestLeave: (() => void) | null = null;
  private sidebar: GameSidebar | null = null;
  private turnClockSeconds: number | null = null;
  private showTurnClock = false;
  private unsubscribeGameEnded: (() => void) | null = null;
  private unsubscribePlayerData: (() => void) | null = null;

  private phase = "waiting";
  private currentTurn = "";
  private players = new Map<string, PlayerSnapshot>();
  private boardTiles: BoardTileSnapshot[] = [];
  private openEndA = -1;
  private openEndB = -1;
  private openEndC = -1;
  private openEndD = -1;
  private spinnerTileId = -1;
  private boneyardCount = 0;
  private lastPlayedTileId = -1;
  private playerStates = new Map<string, { handCount: number; score: number; passed: boolean }>();
  private gameResult: GameResult | null = null;

  // Local player's hand received via server message (hidden from other clients)
  private myHand: HandTile[] = [];

  // Interaction
  private selectedTileId: number | null = null;
  private choosingEnd = false;
  private validEnds: ("a" | "b" | "c" | "d")[] = [];
  private endPositions: EndPositions = {
    a: { x: 0, y: 0 },
    b: { x: 0, y: 0 },
    c: { x: 0, y: 0 },
    d: { x: 0, y: 0 },
  };
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private dragHelper: DragHelper | null = null;
  private dragTileId: number | null = null;
  private actionPending = false;

  // Layout state (stored during redraw for ghost tile computation)
  private boardScale = 1;
  private crossSpinnerCX = 0;
  private crossSpinnerCY = 0;
  private crossArmAEndX = 0;
  private crossArmBEndX = 0;
  private crossArmCEndY = 0;
  private crossArmDEndY = 0;
  private linearStartX = 0;
  private linearChainWidth = 0;
  private linearCenterY = 0;
  private layoutMode: "empty" | "linear" | "cross" = "empty";

  // Spinner arm indicators (C/D discoverability)
  private readonly spinnerIndicatorLayer = new Container();
  private prevArmsCDLocked = true;
  private spinnerUnlockFlashTimer = 0;

  // Tile placement animation
  private readonly animLayer = new Container();
  private readonly tweens = new TweenManager();
  private prevBoardTileIds = new Set<number>();

  constructor() {
    this.container.eventMode = "static";
    this.overlayLayer.eventMode = "none";
    this.dragLayer.eventMode = "none";
    this.overlayLayer.visible = false;
    this.overlayTitleText.anchor.set(0.5);
    this.overlaySubtitleText.anchor.set(0.5);
    this.overlayLayer.addChild(this.overlayBackground, this.overlayTitleText, this.overlaySubtitleText);

    this.endMarkerA.eventMode = "static";
    this.endMarkerA.cursor = "pointer";
    this.endMarkerA.on("pointertap", () => this.onEndChoice("a"));
    this.endMarkerB.eventMode = "static";
    this.endMarkerB.cursor = "pointer";
    this.endMarkerB.on("pointertap", () => this.onEndChoice("b"));
    this.endMarkerC.eventMode = "static";
    this.endMarkerC.cursor = "pointer";
    this.endMarkerC.on("pointertap", () => this.onEndChoice("c"));
    this.endMarkerD.eventMode = "static";
    this.endMarkerD.cursor = "pointer";
    this.endMarkerD.on("pointertap", () => this.onEndChoice("d"));

    this.boneyardGraphics.eventMode = "static";
    this.boneyardGraphics.cursor = "pointer";
    this.boneyardGraphics.on("pointertap", () => this.onBoneyardClick());

    this.boneyardLabel.anchor.set(0.5);
    this.boneyardCountText.anchor.set(0.5);

    this.container.addChild(
      this.boardBackground,
      this.boardLayer,
      this.animLayer,
      this.spinnerIndicatorLayer,
      this.ghostLayer,
      this.endMarkerA,
      this.endMarkerB,
      this.endMarkerC,
      this.endMarkerD,
      this.boneyardGraphics,
      this.boneyardLabel,
      this.boneyardCountText,
      this.handLayer,
      this.dragLayer,
      this.overlayLayer,
    );

    this.dragHelper = new DragHelper(this.container, this.dragLayer, {
      onDragMove: (_id, x, y) => this.handleTileDragMove(x, y),
      onDrop: (id, x, y) => this.handleTileDrop(id, x, y),
      onDragCancel: () => this.handleTileDragCancel(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GameRenderer interface
  // ═══════════════════════════════════════════════════════════════════════════

  init(state: unknown, context?: GameRendererContext): void {
    this.unsubscribeFromRoomEvents();
    this.room = context?.room ?? null;
    this.requestLeave = context?.requestLeave ?? null;
    this.gameResult = null;
    this.selectedTileId = null;
    this.choosingEnd = false;
    this.dragHelper?.cancel();
    this.dragTileId = null;
    this.turnClockSeconds = null;
    this.showTurnClock = false;
    this.tweens.cancelAll();

    this.sidebar?.destroy();
    this.sidebar = new GameSidebar();
    this.sidebar.addPanel("game-info", "Game Status");
    this.sidebar.addPanel("players", "Players");
    this.sidebar.addPanel("how-to-play", "How to Play");
    this.sidebar.addPanel("controls", "Controls");
    this.sidebar.show();

    this.subscribeToRoomEvents();
    this.applyState(state);
    this.prevBoardTileIds = new Set(this.boardTiles.map((t) => t.id));
    this.layout();
    this.redrawAll();
  }

  onStateChange(state: unknown): void {
    this.actionPending = false;

    // Detect C/D arm unlock transition (locked → active)
    const wasCDLocked = this.openEndC < 0 && this.openEndD < 0;

    // Snapshot board tile IDs before state update for animation detection
    const prevIds = this.prevBoardTileIds;

    this.applyState(state);

    // Update prev-board snapshot for next state change
    const currentIds = new Set(this.boardTiles.map((t) => t.id));
    this.prevBoardTileIds = currentIds;

    const isCDActive = this.openEndC >= 0 || this.openEndD >= 0;
    if (wasCDLocked && isCDActive && this.spinnerTileId !== -1) {
      this.spinnerUnlockFlashTimer = SPINNER_UNLOCK_FLASH_MS;
    }

    this.syncSelection();

    // Only cancel a drag if the tile is no longer in hand or it's no longer our turn.
    // Preserving the drag across routine state syncs prevents the proxy from
    // disappearing while the player is still moving slowly.
    if (this.dragTileId !== null) {
      const hand = this.getMyHand();
      if (!this.isLocalPlayersTurn() || !hand.some((t) => t.id === this.dragTileId)) {
        this.dragHelper?.cancel();
      }
    }

    this.redrawAll();

    // Animate newly placed tile only for opponent moves.
    // After applyState, isLocalPlayersTurn() means it's now OUR turn —
    // i.e. the opponent just played.
    if (prevIds.size > 0 && this.isLocalPlayersTurn()) {
      const newTile = this.boardTiles.find((t) => !prevIds.has(t.id));
      if (newTile) {
        this.animateTilePlacement(newTile);
      }
    }
  }

  update(deltaTime: number): void {
    this.tweens.tick(deltaTime);

    if (this.spinnerUnlockFlashTimer > 0) {
      this.spinnerUnlockFlashTimer -= deltaTime;
      if (this.spinnerUnlockFlashTimer <= 0) {
        this.spinnerUnlockFlashTimer = 0;
        this.redrawSpinnerIndicators();
      }
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layout();
    this.redrawAll();
  }

  handleInput(_event: RendererInputEvent): void {
    // Input handled via PixiJS event system on graphics objects
  }

  setTurnClock(seconds: number | null, visible: boolean): void {
    this.turnClockSeconds = seconds !== null ? Math.max(0, Math.floor(seconds)) : null;
    this.showTurnClock = visible && seconds !== null;
    this.updateSidebar();
  }

  getHUDStatus(_state: unknown): GameRendererHUDStatus | null {
    const { text, color } = this.getStatusLabel();
    return {
      label: "Dominos",
      text,
      accentColor: toCssHexColor(color),
    };
  }

  destroy(): void {
    this.unsubscribeFromRoomEvents();
    this.tweens.cancelAll();
    this.dragHelper?.destroy();
    this.dragHelper = null;
    this.dragTileId = null;
    this.room = null;
    this.requestLeave = null;
    this.players.clear();
    this.playerStates.clear();
    this.myHand = [];
    this.boardTiles = [];
    this.selectedTileId = null;
    this.choosingEnd = false;
    this.turnClockSeconds = null;
    this.showTurnClock = false;
    this.sidebar?.destroy();
    this.sidebar = null;
    this.boardLayer.removeChildren();
    this.animLayer.removeChildren();
    this.spinnerIndicatorLayer.removeChildren();
    this.ghostLayer.removeChildren();
    this.handLayer.removeChildren();
    this.validEnds = [];
    this.container.destroy({ children: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Room events
  // ═══════════════════════════════════════════════════════════════════════════

  private subscribeToRoomEvents(): void {
    if (!this.room) {
      return;
    }
    this.unsubscribeGameEnded = this.room.onMessage<GameResult>(GAME_ENDED_MESSAGE, (result) => {
      this.gameResult = result;
      this.redrawAll();
    });
    this.unsubscribePlayerData = this.room.onMessage<{ type: string; tiles: HandTile[] }>("player-data", (data) => {
      if (data?.type === "hand" && Array.isArray(data.tiles)) {
        this.myHand = data.tiles.map((t) => ({ id: t.id, highPips: t.highPips, lowPips: t.lowPips }));
        this.syncSelection();
        this.redrawAll();
      }
    });

    // The server sends player-data during onJoin/startGame, but our handler
    // may not be registered yet at that point. Re-request it now that the
    // listener is in place so the hand is never silently lost.
    this.room.send("request-player-data");
  }

  private unsubscribeFromRoomEvents(): void {
    this.unsubscribeGameEnded?.();
    this.unsubscribeGameEnded = null;
    this.unsubscribePlayerData?.();
    this.unsubscribePlayerData = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State parsing
  // ═══════════════════════════════════════════════════════════════════════════

  private applyState(state: unknown): void {
    const s = state as Partial<DominosState> | null;
    this.phase = typeof s?.phase === "string" ? s.phase : "waiting";
    this.currentTurn = typeof s?.currentTurn === "string" ? s.currentTurn : "";
    this.openEndA = typeof s?.openEndA === "number" ? s.openEndA : -1;
    this.openEndB = typeof s?.openEndB === "number" ? s.openEndB : -1;
    this.openEndC = typeof s?.openEndC === "number" ? s.openEndC : -1;
    this.openEndD = typeof s?.openEndD === "number" ? s.openEndD : -1;
    this.boneyardCount = typeof s?.boneyardCount === "number" ? s.boneyardCount : 0;
    this.lastPlayedTileId = typeof s?.lastPlayedTileId === "number" ? s.lastPlayedTileId : -1;
    this.spinnerTileId = typeof s?.spinnerTileId === "number" ? s.spinnerTileId : -1;

    this.boardTiles = [];
    if (s?.board) {
      s.board.forEach((tile: BoardTile) => {
        this.boardTiles.push({
          id: tile.id,
          highPips: tile.highPips,
          lowPips: tile.lowPips,
          exposedEnd: tile.exposedEnd,
          arm: typeof tile.arm === "string" ? tile.arm : "",
          isDouble: typeof tile.isDouble === "boolean" ? tile.isDouble : false,
        });
      });
    }

    this.players.clear();
    if (s?.players) {
      s.players.forEach((p, key) => {
        this.players.set(key, {
          displayName: p.displayName ?? key,
          playerIndex: p.playerIndex,
          isSpectator: p.isSpectator,
          sessionId: p.sessionId ?? key,
        });
      });
    }

    this.playerStates.clear();
    if (s?.playerStates) {
      s.playerStates.forEach((ps, key: string) => {
        this.playerStates.set(key, {
          handCount: typeof ps.handCount === "number" ? ps.handCount : 0,
          score: ps.score,
          passed: ps.passed,
        });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Selection logic
  // ═══════════════════════════════════════════════════════════════════════════

  private syncSelection(): void {
    if (this.selectedTileId === null) {
      return;
    }
    // Deselect if selected tile is no longer in hand
    const hand = this.getMyHand();
    if (!hand.some((t) => t.id === this.selectedTileId)) {
      this.selectedTileId = null;
      this.choosingEnd = false;
    }
  }

  private onTileClick(tileId: number): void {
    if (!this.isLocalPlayersTurn()) {
      return;
    }

    if (this.selectedTileId === tileId) {
      // Deselect
      this.selectedTileId = null;
      this.choosingEnd = false;
      this.validEnds = [];
      this.redrawAll();
      return;
    }

    this.selectedTileId = tileId;
    this.choosingEnd = false;
    this.validEnds = [];

    const tile = this.getMyHand().find((t) => t.id === tileId);
    if (!tile) {
      return;
    }

    // If board is empty, auto-play (no end choice needed)
    if (this.boardTiles.length === 0) {
      this.sendPlay(tileId, "a");
      return;
    }

    const ends: ("a" | "b" | "c" | "d")[] = [];
    if (this.canPlayOnEnd(tile, this.openEndA)) ends.push("a");
    if (this.canPlayOnEnd(tile, this.openEndB)) ends.push("b");
    if (this.openEndC >= 0 && this.canPlayOnEnd(tile, this.openEndC)) ends.push("c");
    if (this.openEndD >= 0 && this.canPlayOnEnd(tile, this.openEndD)) ends.push("d");

    if (ends.length === 0) {
      // Tile can't be played — leave selected for feedback
      return;
    }

    if (ends.length === 1) {
      this.sendPlay(tileId, ends[0]);
      return;
    }

    // Multiple valid ends — let player choose
    this.validEnds = ends;
    this.choosingEnd = true;
    this.redrawAll();
  }

  private onEndChoice(end: "a" | "b" | "c" | "d"): void {
    if (this.selectedTileId === null || !this.choosingEnd) {
      return;
    }
    if (!this.validEnds.includes(end)) {
      return;
    }
    this.sendPlay(this.selectedTileId, end);
  }

  private onBoneyardClick(): void {
    if (!this.isLocalPlayersTurn()) {
      return;
    }
    if (this.boneyardCount > 0) {
      this.sendAction("draw");
    } else {
      this.sendAction("pass");
    }
  }

  private canPlayOnEnd(tile: HandTile, endPips: number): boolean {
    if (endPips === -1) {
      return true;
    }
    return tile.highPips === endPips || tile.lowPips === endPips;
  }

  private sendPlay(tileId: number, end: "a" | "b" | "c" | "d"): void {
    if (this.actionPending) return;
    this.actionPending = true;
    this.selectedTileId = null;
    this.choosingEnd = false;
    this.validEnds = [];
    this.room?.send("play", { tileId, end });
    this.redrawAll();
  }

  private sendAction(type: "draw" | "pass"): void {
    if (this.actionPending) return;
    this.actionPending = true;
    this.selectedTileId = null;
    this.choosingEnd = false;
    this.validEnds = [];
    this.room?.send(type, {});
    this.redrawAll();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Drag-and-drop from hand to board
  // ═══════════════════════════════════════════════════════════════════════════

  private onTilePointerDown(tileId: number, e: import("pixi.js").FederatedPointerEvent): void {
    if (!this.isLocalPlayersTurn()) return;

    const tile = this.getMyHand().find((t) => t.id === tileId);
    if (!tile) return;

    this.dragTileId = tileId;

    // Compute valid ends for this tile
    const ends = this.getValidEndsForTile(tile);

    const pos = this.container.toLocal(e.global);
    const proxy = this.createTileDragProxy(tile);
    this.dragHelper?.beginDrag(String(tileId), proxy, pos.x, pos.y);

    // If tile has valid ends, highlight them during drag
    if (ends.length > 0 && this.boardTiles.length > 0) {
      this.validEnds = ends;
      this.choosingEnd = true;
      this.redrawEndMarkers();
    }
  }

  private getValidEndsForTile(tile: HandTile): ("a" | "b" | "c" | "d")[] {
    if (this.boardTiles.length === 0) return ["a"];
    const ends: ("a" | "b" | "c" | "d")[] = [];
    if (this.canPlayOnEnd(tile, this.openEndA)) ends.push("a");
    if (this.canPlayOnEnd(tile, this.openEndB)) ends.push("b");
    if (this.openEndC >= 0 && this.canPlayOnEnd(tile, this.openEndC)) ends.push("c");
    if (this.openEndD >= 0 && this.canPlayOnEnd(tile, this.openEndD)) ends.push("d");
    return ends;
  }

  private createTileDragProxy(tile: HandTile): Graphics {
    const g = new Graphics();
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;

    // Draw tile centered at (0,0)
    g.roundRect(-w / 2, -h / 2, w, h, TILE_RADIUS)
      .fill(TILE_BG)
      .stroke({ color: TILE_SELECTED_BORDER, width: 2 });

    // Divider
    g.moveTo(-w / 2 + 4, 0)
      .lineTo(w / 2 - 4, 0)
      .stroke({ color: TILE_DIVIDER_COLOR, width: 1 });

    // Pips
    this.drawPipsVertical(g, tile.highPips, -w / 2, -h / 2, w, TILE_HALF);
    this.drawPipsVertical(g, tile.lowPips, -w / 2, 0, w, TILE_HALF);

    g.alpha = 0.85;
    return g;
  }

  private handleTileDragMove(x: number, y: number): void {
    // Highlight the nearest valid end marker when dragging over the board area
    if (!this.dragTileId) return;

    const tile = this.getMyHand().find((t) => t.id === this.dragTileId);
    if (!tile) return;

    const ends = this.getValidEndsForTile(tile);
    if (ends.length > 0 && this.boardTiles.length > 0) {
      this.validEnds = ends;
      this.choosingEnd = true;
      this.redrawEndMarkers();
    }

    // Check proximity to end markers for visual feedback
    const boardY = this.height - HAND_AREA_HEIGHT - BOTTOM_HUD_SPACE;
    if (y < boardY) {
      // Cursor is over the board area — end markers are already highlighted
      return;
    }
  }

  private handleTileDrop(id: string, x: number, y: number): boolean {
    const tileId = Number(id);
    const tile = this.getMyHand().find((t) => t.id === tileId);
    this.dragTileId = null;

    if (!tile) {
      this.choosingEnd = false;
      this.validEnds = [];
      this.redrawAll();
      return false;
    }

    // Empty board — auto-play
    if (this.boardTiles.length === 0) {
      const ends = this.getValidEndsForTile(tile);
      if (ends.length > 0) {
        this.sendPlay(tileId, ends[0]);
        return true;
      }
      this.choosingEnd = false;
      this.validEnds = [];
      this.redrawAll();
      return false;
    }

    // Find the nearest valid end to the drop point
    const ends = this.getValidEndsForTile(tile);
    if (ends.length === 0) {
      this.choosingEnd = false;
      this.validEnds = [];
      this.redrawAll();
      return false;
    }

    if (ends.length === 1) {
      this.sendPlay(tileId, ends[0]);
      return true;
    }

    // Multiple valid ends — find the closest one to the drop position
    const closest = this.findClosestEnd(ends, x, y);
    if (closest) {
      this.sendPlay(tileId, closest);
      return true;
    }

    // Couldn't resolve — fall back to click-based end choice
    this.selectedTileId = tileId;
    this.validEnds = ends;
    this.choosingEnd = true;
    this.redrawAll();
    return false;
  }

  private handleTileDragCancel(): void {
    this.dragTileId = null;
    this.choosingEnd = false;
    this.validEnds = [];
    this.redrawAll();
  }

  private findClosestEnd(
    ends: ("a" | "b" | "c" | "d")[],
    x: number,
    y: number,
  ): "a" | "b" | "c" | "d" | null {
    let best: "a" | "b" | "c" | "d" | null = null;
    let bestDist = Infinity;

    for (const end of ends) {
      const pos = this.endPositions[end];
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = end;
      }
    }

    return best;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Layout
  // ═══════════════════════════════════════════════════════════════════════════

  private layout(): void {
    this.overlayTitleText.style.wordWrapWidth = this.width * 0.7;
    this.overlaySubtitleText.style.wordWrapWidth = this.width * 0.7;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Master redraw
  // ═══════════════════════════════════════════════════════════════════════════

  private redrawAll(): void {
    this.redrawBoardBackground();
    this.redrawBoard();
    this.redrawSpinnerIndicators();
    this.drawGhostTiles();
    this.redrawHand();
    this.redrawBoneyard();
    this.redrawEndMarkers();
    this.updateOverlay();
    this.updateSidebar();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tile placement animation
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Animate a newly placed tile dropping into its board position.
   * Hides the real tile during the tween to prevent visual doubling.
   */
  private animateTilePlacement(tile: BoardTileSnapshot): void {
    const boardChild = this.boardLayer.children.find(
      (c) => c.label === `board-tile-${tile.id}`,
    );
    if (!boardChild) return;

    const toX = boardChild.position.x;
    const toY = boardChild.position.y;

    // Animate from slightly above — a short "drop-in" effect
    const dropOffset = 50;
    const fromX = toX;
    const fromY = toY - dropOffset;

    // Hide the real tile so we don't see a doubled image
    boardChild.visible = false;

    // Create a temporary Graphics clone for the animation
    const animTile = new Graphics();
    animTile.eventMode = "none";

    const scale = this.boardScale;
    if (this.layoutMode === "linear") {
      const w = BOARD_TILE_W * scale;
      const h = BOARD_TILE_H * scale;
      this.drawBoardTile(animTile, tile, 0, 0, w, h, "horizontal", scale);
    } else {
      const isSpinner = tile.arm === "spinner";
      const isVerticalArm = tile.arm === "c" || tile.arm === "d";
      if (isSpinner) {
        const w = BOARD_TILE_H * scale;
        const h = BOARD_TILE_W * scale;
        this.drawBoardTile(animTile, tile, 0, 0, w, h, "vertical", scale);
      } else if (isVerticalArm) {
        const w = (tile.isDouble ? BOARD_TILE_W : BOARD_TILE_H) * scale;
        const h = (tile.isDouble ? BOARD_TILE_H : BOARD_TILE_W) * scale;
        this.drawBoardTile(animTile, tile, 0, 0, w, h, tile.isDouble ? "horizontal" : "vertical", scale);
      } else {
        const w = (tile.isDouble ? BOARD_TILE_H : BOARD_TILE_W) * scale;
        const h = (tile.isDouble ? BOARD_TILE_W : BOARD_TILE_H) * scale;
        this.drawBoardTile(animTile, tile, 0, 0, w, h, tile.isDouble ? "vertical" : "horizontal", scale);
      }
    }

    this.animLayer.addChild(animTile);

    this.tweens.animate(animTile, {
      fromX,
      fromY,
      toX,
      toY,
      duration: TILE_ANIM_DURATION_MS,
      onComplete: () => {
        animTile.destroy();
        boardChild.visible = true;
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Board background (emerald green playing surface)
  // ═══════════════════════════════════════════════════════════════════════════

  private redrawBoardBackground(): void {
    this.boardBackground.clear();
    const padding = VIEW_PADDING;
    const x = padding;
    const y = TOP_HUD_SPACE;
    const w = this.width - padding * 2;
    const h = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;

    this.boardBackground
      .roundRect(x, y, w, h, 10)
      .fill(EMERALD_900);

    // Subtle lighter emerald inner area
    this.boardBackground
      .roundRect(x + 4, y + 4, w - 8, h - 8, 8)
      .fill(EMERALD_800);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Board chain rendering
  // ═══════════════════════════════════════════════════════════════════════════

  private redrawBoard(): void {
    for (const child of this.boardLayer.removeChildren()) {
      child.destroy();
    }

    if (this.boardTiles.length === 0) {
      this.layoutMode = "empty";
      const emptyText = new Text({
        text: "Play any domino to start",
        style: { fontFamily: "sans-serif", fontSize: 16, fill: 0xa7f3d0 },
      });
      emptyText.anchor.set(0.5);
      emptyText.position.set(this.width / 2, (TOP_HUD_SPACE + (this.height - BOTTOM_HUD_SPACE)) / 2);
      this.boardLayer.addChild(emptyText);
      return;
    }

    if (this.spinnerTileId === -1) {
      this.redrawBoardLinear();
    } else {
      this.redrawBoardCross();
    }
  }

  /** Pre-spinner horizontal chain (original layout) */
  private redrawBoardLinear(): void {
    this.layoutMode = "linear";
    const availableWidth = this.width - VIEW_PADDING * 2;
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
    const tileStride = BOARD_TILE_W + BOARD_TILE_GAP;
    const totalChainWidth = this.boardTiles.length * tileStride - BOARD_TILE_GAP;

    const scale = totalChainWidth > availableWidth ? availableWidth / totalChainWidth : 1;
    const startX = this.width / 2 - (totalChainWidth * scale) / 2;
    const centerY = TOP_HUD_SPACE + availableHeight / 2;

    this.boardScale = scale;
    this.linearStartX = startX;
    this.linearChainWidth = totalChainWidth;
    this.linearCenterY = centerY;

    for (let i = 0; i < this.boardTiles.length; i++) {
      const bt = this.boardTiles[i];
      const g = new Graphics();
      const x = startX + i * tileStride * scale;
      const y = centerY - (BOARD_TILE_H * scale) / 2;
      const w = BOARD_TILE_W * scale;
      const h = BOARD_TILE_H * scale;
      this.drawBoardTile(g, bt, x, y, w, h, "horizontal", scale);
      g.label = `board-tile-${bt.id}`;
      g.eventMode = "none";
      this.boardLayer.addChild(g);
    }

    // End positions at the gap edge where a new tile's connecting side would be
    const chainRightEdge = startX + totalChainWidth * scale;
    const endY = centerY;
    this.endPositions.a = { x: startX - BOARD_TILE_GAP * scale, y: endY };
    this.endPositions.b = { x: chainRightEdge + BOARD_TILE_GAP * scale, y: endY };
    this.endPositions.c = { x: this.width / 2, y: centerY };
    this.endPositions.d = { x: this.width / 2, y: centerY };
  }

  /** Post-spinner cross layout with 4-way branching */
  private redrawBoardCross(): void {
    this.layoutMode = "cross";
    const spinner = this.boardTiles.find((t) => t.arm === "spinner");
    const armATiles = this.boardTiles.filter((t) => t.arm === "a");
    const armBTiles = this.boardTiles.filter((t) => t.arm === "b");
    const armCTiles = this.boardTiles.filter((t) => t.arm === "c");
    const armDTiles = this.boardTiles.filter((t) => t.arm === "d");

    if (!spinner) {
      this.redrawBoardLinear();
      return;
    }

    const availableWidth = this.width - VIEW_PADDING * 2;
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;

    // Spinner is a double on the horizontal chain → rendered vertically (crosswise)
    const spinnerW = BOARD_TILE_H;
    const spinnerH = BOARD_TILE_W;

    const armAExtent = this.getHorizontalArmExtent(armATiles);
    const armBExtent = this.getHorizontalArmExtent(armBTiles);
    const armCExtent = this.getVerticalArmExtent(armCTiles);
    const armDExtent = this.getVerticalArmExtent(armDTiles);

    const leftPad = armAExtent > 0 ? BOARD_TILE_GAP : 0;
    const rightPad = armBExtent > 0 ? BOARD_TILE_GAP : 0;
    const topPad = armCExtent > 0 ? BOARD_TILE_GAP : 0;
    const bottomPad = armDExtent > 0 ? BOARD_TILE_GAP : 0;

    const totalW = armAExtent + leftPad + spinnerW + rightPad + armBExtent;
    const totalH = armCExtent + topPad + spinnerH + bottomPad + armDExtent;

    const scaleX = totalW > availableWidth ? availableWidth / totalW : 1;
    const scaleY = totalH > availableHeight ? availableHeight / totalH : 1;
    const scale = Math.min(scaleX, scaleY, 1);

    this.boardScale = scale;

    // Position cross centered in available area
    const crossLeft = (this.width - totalW * scale) / 2;
    const crossTop = TOP_HUD_SPACE + (availableHeight - totalH * scale) / 2;
    const spinnerCX = crossLeft + (armAExtent + leftPad) * scale + (spinnerW * scale) / 2;
    const spinnerCY = crossTop + (armCExtent + topPad) * scale + (spinnerH * scale) / 2;

    this.crossSpinnerCX = spinnerCX;
    this.crossSpinnerCY = spinnerCY;

    // Draw spinner
    const sX = spinnerCX - (spinnerW * scale) / 2;
    const sY = spinnerCY - (spinnerH * scale) / 2;
    const spinnerG = new Graphics();
    this.drawBoardTile(spinnerG, spinner, sX, sY, spinnerW * scale, spinnerH * scale, "vertical", scale);
    spinnerG.label = `board-tile-${spinner.id}`;
    spinnerG.eventMode = "none";
    this.boardLayer.addChild(spinnerG);

    // Arm A — horizontal, extending LEFT from spinner
    let cursorX = sX - BOARD_TILE_GAP * scale;
    for (let i = 0; i < armATiles.length; i++) {
      const bt = armATiles[i];
      const tw = this.getHArmTileW(bt) * scale;
      const th = this.getHArmTileH(bt) * scale;
      cursorX -= tw;
      const tY = spinnerCY - th / 2;
      const g = new Graphics();
      this.drawBoardTile(g, bt, cursorX, tY, tw, th, bt.isDouble ? "vertical" : "horizontal", scale);
      g.label = `board-tile-${bt.id}`;
      g.eventMode = "none";
      this.boardLayer.addChild(g);
      cursorX -= BOARD_TILE_GAP * scale;
    }
    const armAEndX = armATiles.length > 0 ? cursorX + BOARD_TILE_GAP * scale : sX;

    // Arm B — horizontal, extending RIGHT from spinner
    cursorX = sX + spinnerW * scale + BOARD_TILE_GAP * scale;
    for (let i = 0; i < armBTiles.length; i++) {
      const bt = armBTiles[i];
      const tw = this.getHArmTileW(bt) * scale;
      const th = this.getHArmTileH(bt) * scale;
      const tY = spinnerCY - th / 2;
      const g = new Graphics();
      this.drawBoardTile(g, bt, cursorX, tY, tw, th, bt.isDouble ? "vertical" : "horizontal", scale);
      g.label = `board-tile-${bt.id}`;
      g.eventMode = "none";
      this.boardLayer.addChild(g);
      cursorX += tw + BOARD_TILE_GAP * scale;
    }
    const armBEndX = armBTiles.length > 0 ? cursorX - BOARD_TILE_GAP * scale : sX + spinnerW * scale;

    // Arm C — vertical, extending UP from spinner
    let cursorY = sY - BOARD_TILE_GAP * scale;
    for (let i = 0; i < armCTiles.length; i++) {
      const bt = armCTiles[i];
      const tw = this.getVArmTileW(bt) * scale;
      const th = this.getVArmTileH(bt) * scale;
      cursorY -= th;
      const tX = spinnerCX - tw / 2;
      const g = new Graphics();
      this.drawBoardTile(g, bt, tX, cursorY, tw, th, bt.isDouble ? "horizontal" : "vertical", scale);
      g.label = `board-tile-${bt.id}`;
      g.eventMode = "none";
      this.boardLayer.addChild(g);
      cursorY -= BOARD_TILE_GAP * scale;
    }
    const armCEndY = armCTiles.length > 0 ? cursorY + BOARD_TILE_GAP * scale : sY;

    // Arm D — vertical, extending DOWN from spinner
    cursorY = sY + spinnerH * scale + BOARD_TILE_GAP * scale;
    for (let i = 0; i < armDTiles.length; i++) {
      const bt = armDTiles[i];
      const tw = this.getVArmTileW(bt) * scale;
      const th = this.getVArmTileH(bt) * scale;
      const tX = spinnerCX - tw / 2;
      const g = new Graphics();
      this.drawBoardTile(g, bt, tX, cursorY, tw, th, bt.isDouble ? "horizontal" : "vertical", scale);
      g.label = `board-tile-${bt.id}`;
      g.eventMode = "none";
      this.boardLayer.addChild(g);
      cursorY += th + BOARD_TILE_GAP * scale;
    }
    const armDEndY = armDTiles.length > 0 ? cursorY - BOARD_TILE_GAP * scale : sY + spinnerH * scale;

    // Store arm end edges and compute end positions at the gap beyond the last tile
    this.crossArmAEndX = armAEndX;
    this.crossArmBEndX = armBEndX;
    this.crossArmCEndY = armCEndY;
    this.crossArmDEndY = armDEndY;

    this.endPositions.a = { x: armAEndX - BOARD_TILE_GAP * scale, y: spinnerCY };
    this.endPositions.b = { x: armBEndX + BOARD_TILE_GAP * scale, y: spinnerCY };
    this.endPositions.c = { x: spinnerCX, y: armCEndY - BOARD_TILE_GAP * scale };
    this.endPositions.d = { x: spinnerCX, y: armDEndY + BOARD_TILE_GAP * scale };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Spinner arm indicators (C/D discoverability)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Draws subtle visual indicators above/below the spinner to hint that
   * perpendicular arms (C up, D down) exist and whether they are locked or
   * playable. Indicators hide once a tile has been placed on the arm.
   */
  private redrawSpinnerIndicators(): void {
    for (const child of this.spinnerIndicatorLayer.removeChildren()) {
      child.destroy();
    }

    if (this.layoutMode !== "cross" || this.spinnerTileId === -1) {
      return;
    }

    const scale = this.boardScale;
    const spinnerHalfH = (BOARD_TILE_W * scale) / 2;
    const cx = this.crossSpinnerCX;
    const cy = this.crossSpinnerCY;

    const hasArmCTiles = this.boardTiles.some((t) => t.arm === "c");
    const hasArmDTiles = this.boardTiles.some((t) => t.arm === "d");
    const armCActive = this.openEndC >= 0;
    const armDActive = this.openEndD >= 0;

    // C indicator — extends UP from spinner
    if (!hasArmCTiles) {
      this.drawSpinnerArmIndicator(cx, cy - spinnerHalfH, -1, scale, armCActive, "C");
    }

    // D indicator — extends DOWN from spinner
    if (!hasArmDTiles) {
      this.drawSpinnerArmIndicator(cx, cy + spinnerHalfH, 1, scale, armDActive, "D");
    }
  }

  private drawSpinnerArmIndicator(
    x: number,
    edgeY: number,
    direction: 1 | -1,
    scale: number,
    isActive: boolean,
    label: string,
  ): void {
    const g = new Graphics();
    g.eventMode = "none";

    const isFlashing = this.spinnerUnlockFlashTimer > 0 && isActive;

    let color: number;
    let alpha: number;
    if (isFlashing) {
      color = SPINNER_IND_FLASH_COLOR;
      alpha = SPINNER_IND_FLASH_ALPHA;
    } else if (isActive) {
      color = SPINNER_IND_ACTIVE_COLOR;
      alpha = SPINNER_IND_ACTIVE_ALPHA;
    } else {
      color = SPINNER_IND_LOCKED_COLOR;
      alpha = SPINNER_IND_LOCKED_ALPHA;
    }

    const gap = 4 * scale;
    const length = SPINNER_IND_LENGTH * scale;
    const lineStartY = edgeY + direction * gap;
    const lineEndY = lineStartY + direction * length;

    if (isActive) {
      // Solid line for active/unlocked arms
      g.moveTo(x, lineStartY).lineTo(x, lineEndY).stroke({ color, alpha, width: 2 });
    } else {
      // Dashed line for locked arms
      const dashLen = SPINNER_IND_DASH_LEN * scale;
      const gapLen = SPINNER_IND_GAP_LEN * scale;
      let pos = 0;
      while (pos < length) {
        const segEnd = Math.min(pos + dashLen, length);
        g.moveTo(x, lineStartY + direction * pos)
          .lineTo(x, lineStartY + direction * segEnd);
        pos += dashLen + gapLen;
      }
      g.stroke({ color, alpha, width: 2 });
    }

    // Arrow tip (filled triangle) or locked circle at the end of the line
    const arrowSize = SPINNER_IND_ARROW_SIZE * scale;
    if (isActive) {
      g.moveTo(x, lineEndY + direction * arrowSize)
        .lineTo(x - arrowSize, lineEndY)
        .lineTo(x + arrowSize, lineEndY)
        .closePath()
        .fill({ color, alpha });
    } else {
      g.circle(x, lineEndY + direction * (arrowSize * 0.5), 3 * scale)
        .fill({ color, alpha });
    }

    // Glow ring during unlock flash
    if (isFlashing) {
      g.circle(x, lineEndY + direction * arrowSize, 8 * scale)
        .fill({ color: SPINNER_IND_FLASH_COLOR, alpha: 0.25 });
    }

    // Arm label
    const labelText = new Text({
      text: label,
      style: {
        fontFamily: "sans-serif",
        fontSize: Math.max(10, 11 * scale),
        fontWeight: isActive ? "700" : "500",
        fill: color,
      },
    });
    labelText.alpha = alpha;
    labelText.anchor.set(0.5);
    labelText.position.set(x + 12 * scale, (lineStartY + lineEndY) / 2);
    g.addChild(labelText);

    this.spinnerIndicatorLayer.addChild(g);
  }

  // ── Arm dimension helpers ──────────────────────────────────────────────────

  private getHArmTileW(tile: BoardTileSnapshot): number {
    return tile.isDouble ? BOARD_TILE_H : BOARD_TILE_W;
  }

  private getHArmTileH(tile: BoardTileSnapshot): number {
    return tile.isDouble ? BOARD_TILE_W : BOARD_TILE_H;
  }

  private getVArmTileW(tile: BoardTileSnapshot): number {
    return tile.isDouble ? BOARD_TILE_W : BOARD_TILE_H;
  }

  private getVArmTileH(tile: BoardTileSnapshot): number {
    return tile.isDouble ? BOARD_TILE_H : BOARD_TILE_W;
  }

  private getHorizontalArmExtent(tiles: BoardTileSnapshot[]): number {
    if (tiles.length === 0) return 0;
    let total = 0;
    for (const t of tiles) {
      total += this.getHArmTileW(t) + BOARD_TILE_GAP;
    }
    return total - BOARD_TILE_GAP;
  }

  private getVerticalArmExtent(tiles: BoardTileSnapshot[]): number {
    if (tiles.length === 0) return 0;
    let total = 0;
    for (const t of tiles) {
      total += this.getVArmTileH(t) + BOARD_TILE_GAP;
    }
    return total - BOARD_TILE_GAP;
  }

  // ── Ghost tile preview ─────────────────────────────────────────────────────

  private drawGhostTiles(): void {
    this.ghostLayer.removeChildren();

    if (!this.choosingEnd || this.selectedTileId === null || this.boardTiles.length === 0) {
      return;
    }

    const tile = this.getMyHand().find((t) => t.id === this.selectedTileId);
    if (!tile) {
      return;
    }

    const scale = this.boardScale;
    const isDouble = tile.highPips === tile.lowPips;

    for (const end of this.validEnds) {
      const ghost = this.computeGhostRect(end, isDouble, scale);
      if (!ghost) continue;

      const openEnd = this.getOpenEndForArm(end);
      const exposedEnd = this.resolveGhostExposedEnd(tile, openEnd, end);

      const ghostTile: BoardTileSnapshot = {
        id: -1,
        highPips: tile.highPips,
        lowPips: tile.lowPips,
        exposedEnd,
        arm: end,
        isDouble,
      };

      const g = new Graphics();
      g.alpha = 0.4;
      this.drawBoardTile(g, ghostTile, ghost.x, ghost.y, ghost.w, ghost.h, ghost.orientation, scale);
      g.eventMode = "none";
      this.ghostLayer.addChild(g);
    }
  }

  private computeGhostRect(
    end: "a" | "b" | "c" | "d",
    isDouble: boolean,
    scale: number,
  ): { x: number; y: number; w: number; h: number; orientation: "horizontal" | "vertical" } | null {
    if (this.layoutMode === "linear") {
      return this.computeLinearGhostRect(end, isDouble, scale);
    }
    if (this.layoutMode === "cross") {
      return this.computeCrossGhostRect(end, isDouble, scale);
    }
    return null;
  }

  private computeLinearGhostRect(
    end: "a" | "b",
    isDouble: boolean,
    scale: number,
  ): { x: number; y: number; w: number; h: number; orientation: "horizontal" | "vertical" } | null {
    // Linear layout: all tiles horizontal, doubles stay horizontal
    const tw = BOARD_TILE_W * scale;
    const th = BOARD_TILE_H * scale;
    const centerY = this.linearCenterY;

    if (end === "a") {
      // Ghost extends LEFT from chain start
      const x = this.endPositions.a.x - tw;
      const y = centerY - th / 2;
      return { x, y, w: tw, h: th, orientation: "horizontal" };
    }
    if (end === "b") {
      // Ghost extends RIGHT from chain end
      const x = this.endPositions.b.x;
      const y = centerY - th / 2;
      return { x, y, w: tw, h: th, orientation: "horizontal" };
    }
    return null;
  }

  private computeCrossGhostRect(
    end: "a" | "b" | "c" | "d",
    isDouble: boolean,
    scale: number,
  ): { x: number; y: number; w: number; h: number; orientation: "horizontal" | "vertical" } {
    const sCX = this.crossSpinnerCX;
    const sCY = this.crossSpinnerCY;
    const pos = this.endPositions[end];

    if (end === "a" || end === "b") {
      // Horizontal arm: doubles are vertical, regulars are horizontal
      const tw = (isDouble ? BOARD_TILE_H : BOARD_TILE_W) * scale;
      const th = (isDouble ? BOARD_TILE_W : BOARD_TILE_H) * scale;
      const orientation = isDouble ? "vertical" : "horizontal";
      const y = sCY - th / 2;

      if (end === "a") {
        // Extends LEFT: ghost right edge at pos.x
        return { x: pos.x - tw, y, w: tw, h: th, orientation };
      }
      // Extends RIGHT: ghost left edge at pos.x
      return { x: pos.x, y, w: tw, h: th, orientation };
    }

    // Vertical arm: doubles are horizontal, regulars are vertical
    const tw = (isDouble ? BOARD_TILE_W : BOARD_TILE_H) * scale;
    const th = (isDouble ? BOARD_TILE_H : BOARD_TILE_W) * scale;
    const orientation = isDouble ? "horizontal" : "vertical";
    const x = sCX - tw / 2;

    if (end === "c") {
      // Extends UP: ghost bottom edge at pos.y
      return { x, y: pos.y - th, w: tw, h: th, orientation };
    }
    // Extends DOWN: ghost top edge at pos.y
    return { x, y: pos.y, w: tw, h: th, orientation };
  }

  private getOpenEndForArm(end: "a" | "b" | "c" | "d"): number {
    switch (end) {
      case "a": return this.openEndA;
      case "b": return this.openEndB;
      case "c": return this.openEndC;
      case "d": return this.openEndD;
    }
  }

  /** Determine which pip value faces the chain's left/top on the ghost tile */
  private resolveGhostExposedEnd(
    tile: HandTile,
    openEnd: number,
    arm: "a" | "b" | "c" | "d",
  ): number {
    if (tile.highPips === tile.lowPips) return tile.highPips;
    if (openEnd === -1) return tile.lowPips;
    const connectingPip = tile.highPips === openEnd ? tile.highPips : tile.lowPips;
    const outwardPip = tile.highPips === openEnd ? tile.lowPips : tile.highPips;
    // Arms A/C extend left/up: outward pip faces left/top.
    // Arms B/D extend right/down: connecting pip faces left/top.
    return (arm === "b" || arm === "d") ? connectingPip : outwardPip;
  }

  // ── Board tile drawing ─────────────────────────────────────────────────────

  private drawBoardTile(
    g: Graphics,
    tile: BoardTileSnapshot,
    x: number,
    y: number,
    w: number,
    h: number,
    orientation: "horizontal" | "vertical",
    scale: number,
  ): void {
    const r = Math.max(2, TILE_RADIUS * scale * 0.5);

    // Shadow
    g.roundRect(x + 2, y + 2, w, h, r).fill({ color: TILE_SHADOW_COLOR, alpha: TILE_SHADOW_ALPHA });

    // Tile body
    g.roundRect(x, y, w, h, r).fill(TILE_BG).stroke({ color: TILE_BORDER, width: 1 });

    // Highlight last played
    if (tile.id === this.lastPlayedTileId) {
      g.roundRect(x, y, w, h, r).stroke({ color: TILE_SELECTED_BORDER, width: 2 });
    }

    if (orientation === "horizontal") {
      // Vertical divider
      g.moveTo(x + w / 2, y + 1).lineTo(x + w / 2, y + h - 1).stroke({ color: TILE_DIVIDER_COLOR, width: 1 });
      const halfW = w / 2;
      // Draw pips based on exposedEnd: the exposed end faces the chain's left/start
      const leftPips = tile.exposedEnd === tile.highPips ? tile.highPips : tile.lowPips;
      const rightPips = tile.exposedEnd === tile.highPips ? tile.lowPips : tile.highPips;
      this.drawPipsHorizontal(g, leftPips, x, y, halfW, h, scale);
      this.drawPipsHorizontal(g, rightPips, x + halfW, y, halfW, h, scale);
    } else {
      // Horizontal divider
      g.moveTo(x + 1, y + h / 2).lineTo(x + w - 1, y + h / 2).stroke({ color: TILE_DIVIDER_COLOR, width: 1 });
      const halfH = h / 2;
      // Draw pips based on exposedEnd: the exposed end faces the chain's top/start
      const topPips = tile.exposedEnd === tile.highPips ? tile.highPips : tile.lowPips;
      const bottomPips = tile.exposedEnd === tile.highPips ? tile.lowPips : tile.highPips;
      this.drawBoardPipsVertical(g, topPips, x, y, w, halfH, scale);
      this.drawBoardPipsVertical(g, bottomPips, x, y + halfH, w, halfH, scale);
    }
  }

  private drawBoardPipsVertical(
    g: Graphics,
    pips: number,
    x: number,
    y: number,
    w: number,
    h: number,
    scale: number,
  ): void {
    const layout = PIP_LAYOUTS[pips] ?? [];
    const pr = Math.max(1.5, PIP_RADIUS * scale * 0.7);
    for (const [px, py] of layout) {
      g.circle(x + w * px, y + h * py, pr).fill(TILE_PIP_COLOR);
    }
  }

  private drawPipsHorizontal(
    g: Graphics,
    pips: number,
    x: number,
    y: number,
    w: number,
    h: number,
    scale: number,
  ): void {
    const layout = PIP_LAYOUTS[pips] ?? [];
    const pr = Math.max(1.5, PIP_RADIUS * scale * 0.7);
    for (const [px, py] of layout) {
      g.circle(x + w * px, y + h * py, pr).fill(TILE_PIP_COLOR);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // End markers (for choosing which end to play on)
  // ═══════════════════════════════════════════════════════════════════════════

  private redrawEndMarkers(): void {
    this.endMarkerA.clear();
    this.endMarkerB.clear();
    this.endMarkerC.clear();
    this.endMarkerD.clear();
    for (const child of this.endMarkerA.removeChildren()) {
      child.destroy();
    }
    for (const child of this.endMarkerB.removeChildren()) {
      child.destroy();
    }
    for (const child of this.endMarkerC.removeChildren()) {
      child.destroy();
    }
    for (const child of this.endMarkerD.removeChildren()) {
      child.destroy();
    }
    this.endMarkerA.visible = false;
    this.endMarkerB.visible = false;
    this.endMarkerC.visible = false;
    this.endMarkerD.visible = false;

    if (!this.choosingEnd || this.boardTiles.length === 0 || this.selectedTileId === null) {
      return;
    }

    const tile = this.getMyHand().find((t) => t.id === this.selectedTileId);
    if (!tile) {
      return;
    }

    const scale = this.boardScale;
    const isDouble = tile.highPips === tile.lowPips;
    const markerSize = 32;

    const drawMarkerCentered = (marker: Graphics, label: string, ghostRect: { x: number; y: number; w: number; h: number }) => {
      const centerX = ghostRect.x + ghostRect.w / 2;
      const centerY = ghostRect.y + ghostRect.h / 2;
      const mX = centerX - markerSize / 2;
      const mY = centerY - markerSize / 2;

      marker.roundRect(mX, mY, markerSize, markerSize, 6)
        .fill({ color: END_MARKER_COLOR, alpha: END_MARKER_ACTIVE_ALPHA })
        .stroke({ color: WHITE, width: 2 });

      const text = new Text({
        text: label,
        style: { fontFamily: "sans-serif", fontSize: END_LABEL_FONT_SIZE, fontWeight: "700", fill: WHITE },
      });
      text.anchor.set(0.5);
      text.position.set(centerX, centerY);
      marker.addChild(text);
      marker.visible = true;
    };

    for (const end of this.validEnds) {
      const ghost = this.computeGhostRect(end, isDouble, scale);
      if (!ghost) continue;

      switch (end) {
        case "a": drawMarkerCentered(this.endMarkerA, "← A", ghost); break;
        case "b": drawMarkerCentered(this.endMarkerB, "B →", ghost); break;
        case "c": drawMarkerCentered(this.endMarkerC, "↑ C", ghost); break;
        case "d": drawMarkerCentered(this.endMarkerD, "D ↓", ghost); break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Boneyard
  // ═══════════════════════════════════════════════════════════════════════════

  private redrawBoneyard(): void {
    this.boneyardGraphics.clear();

    const bw = 100;
    const bh = 60;
    const bx = this.width - VIEW_PADDING - bw;
    const by = TOP_HUD_SPACE + 8;

    this.boneyardGraphics
      .roundRect(bx, by, bw, bh, BONEYARD_RADIUS)
      .fill(BONEYARD_BG)
      .stroke({ color: BONEYARD_BORDER, alpha: BORDER_LIGHT_ALPHA, width: 1 });

    this.boneyardLabel.position.set(bx + bw / 2, by + 16);
    this.boneyardCountText.text = String(this.boneyardCount);
    this.boneyardCountText.position.set(bx + bw / 2, by + 40);

    const canDraw = this.isLocalPlayersTurn() && this.boneyardCount > 0;
    const canPass = this.isLocalPlayersTurn() && this.boneyardCount === 0;
    this.boneyardGraphics.cursor = canDraw || canPass ? "pointer" : "default";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Hand rendering
  // ═══════════════════════════════════════════════════════════════════════════

  private redrawHand(): void {
    for (const child of this.handLayer.removeChildren()) {
      child.destroy();
    }

    const hand = this.getMyHand();
    const handY = this.height - HAND_AREA_HEIGHT;
    const totalW = hand.length * (TILE_WIDTH + HAND_TILE_GAP) - HAND_TILE_GAP;
    const startX = (this.width - totalW) / 2;

    for (let i = 0; i < hand.length; i++) {
      const tile = hand[i];
      const x = startX + i * (TILE_WIDTH + HAND_TILE_GAP);
      const y = handY;
      const isSelected = tile.id === this.selectedTileId;
      const g = new Graphics();

      // Selection glow
      if (isSelected) {
        g.roundRect(x - 3, y - 3, TILE_WIDTH + 6, TILE_HEIGHT + 6, TILE_RADIUS + 2)
          .fill({ color: TILE_SELECTED_GLOW, alpha: TILE_SELECTED_GLOW_ALPHA });
      }

      // Shadow
      g.roundRect(x + 2, y + 2, TILE_WIDTH, TILE_HEIGHT, TILE_RADIUS)
        .fill({ color: TILE_SHADOW_COLOR, alpha: TILE_SHADOW_ALPHA });

      // Tile body
      g.roundRect(x, y, TILE_WIDTH, TILE_HEIGHT, TILE_RADIUS)
        .fill(TILE_BG)
        .stroke({ color: isSelected ? TILE_SELECTED_BORDER : TILE_BORDER, width: isSelected ? 2 : 1 });

      // Divider line
      g.moveTo(x + 4, y + TILE_HALF)
        .lineTo(x + TILE_WIDTH - 4, y + TILE_HALF)
        .stroke({ color: TILE_DIVIDER_COLOR, width: 1 });

      // Pips — top half = highPips, bottom half = lowPips
      this.drawPipsVertical(g, tile.highPips, x, y, TILE_WIDTH, TILE_HALF);
      this.drawPipsVertical(g, tile.lowPips, x, y + TILE_HALF, TILE_WIDTH, TILE_HALF);

      g.eventMode = "static";
      g.cursor = this.isLocalPlayersTurn() ? "pointer" : "default";
      g.on("pointertap", () => this.onTileClick(tile.id));
      g.on("pointerdown", (e: import("pixi.js").FederatedPointerEvent) => {
        this.onTilePointerDown(tile.id, e);
      });
      this.handLayer.addChild(g);
    }

    // Show opponent hand counts as face-down tiles (small row above board)
    this.drawOpponentHands();
  }

  private drawPipsVertical(g: Graphics, pips: number, x: number, y: number, w: number, h: number): void {
    const layout = PIP_LAYOUTS[pips] ?? [];
    for (const [px, py] of layout) {
      g.circle(x + w * px, y + h * py, PIP_RADIUS).fill(TILE_PIP_COLOR);
    }
  }

  private drawOpponentHands(): void {
    const myId = this.getMySessionId();
    let offsetX = VIEW_PADDING;
    const y = TOP_HUD_SPACE + 8;

    this.playerStates.forEach((ps, sessionId) => {
      if (sessionId === myId) {
        return;
      }
      const player = this.players.get(sessionId);
      const name = player?.displayName ?? "Opponent";
      const count = ps.handCount;

      // Name label
      const nameText = new Text({
        text: `${name}: ${count}`,
        style: { fontFamily: "sans-serif", fontSize: 13, fill: TEXT_SECONDARY },
      });
      nameText.position.set(offsetX, y);
      nameText.eventMode = "none";
      this.handLayer.addChild(nameText);

      // Face-down tiles
      const tileScale = 0.4;
      const tw = TILE_WIDTH * tileScale;
      const th = TILE_HEIGHT * tileScale;
      const gap = 3;
      const maxShow = Math.min(count, 10);
      for (let i = 0; i < maxShow; i++) {
        const tx = offsetX + i * (tw + gap);
        const ty = y + 18;
        const fg = new Graphics();
        fg.roundRect(tx, ty, tw, th, 3)
          .fill(TILE_FACEDOWN_BG)
          .stroke({ color: TILE_FACEDOWN_BORDER, width: 1 });
        fg.eventMode = "none";
        this.handLayer.addChild(fg);
      }

      offsetX += Math.max(nameText.width, maxShow * (tw + gap)) + 20;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Overlay (game over)
  // ═══════════════════════════════════════════════════════════════════════════

  private updateOverlay(): void {
    if (this.phase !== "ended" || !this.gameResult) {
      this.overlayLayer.visible = false;
      return;
    }

    this.overlayLayer.visible = true;
    this.overlayBackground.clear();
    this.overlayBackground
      .rect(0, 0, this.width, this.height)
      .fill({ color: OVERLAY_BACKDROP_COLOR, alpha: OVERLAY_BACKDROP_ALPHA });

    const winnerName = this.getWinnerName();
    this.overlayTitleText.text = winnerName ? `${winnerName} wins!` : "Game Over";
    this.overlayTitleText.position.set(this.width / 2, this.height / 2 - 20);

    const scores = Object.entries(this.gameResult.scores)
      .map(([sid, score]) => {
        const p = this.players.get(sid);
        return `${p?.displayName ?? sid}: ${score}`;
      })
      .join("  •  ");
    this.overlaySubtitleText.text = scores || "";
    this.overlaySubtitleText.position.set(this.width / 2, this.height / 2 + 24);
  }

  private getWinnerName(): string | null {
    if (!this.gameResult?.winnerId) {
      return null;
    }
    const winner = this.players.get(this.gameResult.winnerId);
    return winner?.displayName ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Sidebar
  // ═══════════════════════════════════════════════════════════════════════════

  private updateSidebar(): void {
    if (!this.sidebar) {
      return;
    }

    this.sidebar.updatePanel(
      "game-info",
      `<div class="sidebar-stat-list">
        ${this.getCurrentTurnRowMarkup()}
        ${getTurnClockMarkup(this.turnClockSeconds, this.showTurnClock)}
        <div class="sidebar-stat-row">
          <span class="sidebar-stat-label">Tiles Played</span>
          <span class="sidebar-stat-value">${this.boardTiles.length}</span>
        </div>
        <div class="sidebar-stat-row">
          <span class="sidebar-stat-label">Boneyard</span>
          <span class="sidebar-stat-value">${this.boneyardCount} tiles</span>
        </div>
        <div class="sidebar-stat-row">
          <span class="sidebar-stat-label">Open ends</span>
          <span class="sidebar-stat-value">${this.getOpenEndsLabel()}</span>
        </div>
      </div>`,
    );

    // Players panel
    const playerRows: string[] = [];
    this.players.forEach((p, sessionId) => {
      if (p.isSpectator) {
        return;
      }
      const ps = this.playerStates.get(sessionId);
      const isTurn = sessionId === this.currentTurn;
      const turnDot = isTurn ? "🟢 " : "";
      const passedLabel = ps?.passed ? " (passed)" : "";
      playerRows.push(
        `<div class="sidebar-player-row">
          <span class="sidebar-stat-label">${turnDot}${escapeHtml(p.displayName)}${passedLabel}</span>
          <span class="sidebar-stat-value">Score: ${ps?.score ?? 0} • Hand: ${ps?.handCount ?? "?"}</span>
        </div>`,
      );
    });
    this.sidebar.updatePanel(
      "players",
      playerRows.length > 0
        ? `<div class="sidebar-player-list">${playerRows.join("")}</div>`
        : `<div class="sidebar-empty">Waiting for players to join.</div>`,
    );

    // How to Play panel
    this.sidebar.updatePanel(
      "how-to-play",
      `<ul class="sidebar-stat-list" style="list-style:none;padding:0;margin:0;">
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">Match numbers on the ends of the domino chain</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">The first double played is the <b>spinner</b></span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">After the spinner, play in up to 4 directions</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">Click a domino, then click A/B/C/D to choose an end</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">Draw from boneyard or pass if you can't play</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">First to play all tiles wins!</span></li>
      </ul>`,
    );

    // Controls panel
    const canDraw = this.isLocalPlayersTurn() && this.boneyardCount > 0 && !this.actionPending;
    const canPass = this.isLocalPlayersTurn() && this.boneyardCount === 0 && !this.actionPending;
    this.sidebar.updatePanel(
      "controls",
      `<div class="sidebar-button-group">
        <button type="button" class="sidebar-button sidebar-button--primary" data-action="draw"${canDraw ? "" : " disabled"}>Draw from Boneyard</button>
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="pass"${canPass ? "" : " disabled"}>Pass</button>
        <button type="button" class="sidebar-button sidebar-button--danger" data-action="resign"${this.requestLeave ? "" : " disabled"}>Resign</button>
      </div>`,
    );

    const controlsPanel = this.sidebar.getPanelContent("controls");
    if (controlsPanel) {
      const drawBtn = controlsPanel.querySelector('[data-action="draw"]');
      if (drawBtn instanceof HTMLButtonElement) {
        drawBtn.onclick = () => this.sendAction("draw");
      }
      const passBtn = controlsPanel.querySelector('[data-action="pass"]');
      if (passBtn instanceof HTMLButtonElement) {
        passBtn.onclick = () => this.sendAction("pass");
      }
      const resignBtn = controlsPanel.querySelector('[data-action="resign"]');
      if (resignBtn instanceof HTMLButtonElement) {
        resignBtn.onclick = () => this.requestLeave?.();
      }
    }
  }

  private getCurrentTurnRowMarkup(): string {
    const isLocalTurn = this.isLocalPlayersTurn();
    const rowClass = isLocalTurn ? "sidebar-stat-row sidebar-stat-row--turn-active" : "sidebar-stat-row";
    const valueClass = isLocalTurn ? "sidebar-stat-value sidebar-stat-value--turn-active" : "sidebar-stat-value";
    const styleAttr = isLocalTurn
      ? ` style="--sidebar-turn-indicator-border: ${toCssRgbaColor(STATUS_ONLINE, 0.44)}; --sidebar-turn-indicator-bg: ${toCssRgbaColor(AMBER_500, 0.18)}; --sidebar-turn-indicator-shadow: ${toCssRgbaColor(AMBER_500, 0.24)}; --sidebar-turn-indicator-accent: ${toCssHexColor(YELLOW_400)}; --sidebar-turn-indicator-text: ${toCssHexColor(WHITE)}; --sidebar-turn-indicator-text-glow: ${toCssRgbaColor(YELLOW_400, 0.26)};"`
      : "";
    const turnLabel = isLocalTurn ? "Your Turn" : this.getCurrentTurnLabel();
    return `<div class="${rowClass}"${styleAttr}><span class="sidebar-stat-label">Current turn</span><span class="${valueClass}">${escapeHtml(turnLabel)}</span></div>`;
  }

  private getCurrentTurnLabel(): string {
    if (!this.currentTurn) {
      return "Waiting";
    }
    if (this.room?.sessionId === this.currentTurn) {
      return "You";
    }
    const p = this.players.get(this.currentTurn);
    return p?.displayName ?? "Player";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private getStatusLabel(): { text: string; color: number } {
    if (this.phase === "waiting") {
      return { text: "Waiting for players", color: TEXT_SECONDARY };
    }
    if (this.phase === "ended") {
      return { text: "Game over", color: TEXT_SECONDARY };
    }
    const local = this.getLocalPlayer();
    if (!local || local.isSpectator) {
      return { text: "Spectating", color: TEXT_SECONDARY };
    }
    if (this.isLocalPlayersTurn()) {
      return { text: "Your turn", color: STATUS_ONLINE };
    }
    return { text: "Opponent's turn", color: TEXT_SECONDARY };
  }

  private getMySessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  private getLocalPlayer(): PlayerSnapshot | null {
    const sid = this.getMySessionId();
    if (!sid) {
      return null;
    }
    return this.players.get(sid) ?? null;
  }

  private isLocalPlayersTurn(): boolean {
    const sid = this.getMySessionId();
    return !!sid && this.currentTurn === sid && this.phase === "playing";
  }

  private getMyHand(): HandTile[] {
    return this.myHand;
  }

  private getOpenEndsLabel(): string {
    if (this.openEndA === -1) return "—";
    let label = `A:${this.openEndA} | B:${this.openEndB}`;
    if (this.openEndC >= 0) label += ` | C:${this.openEndC}`;
    if (this.openEndD >= 0) label += ` | D:${this.openEndD}`;
    return label;
  }
}

import type { Room } from "@colyseus/sdk";
import type {
  BoardTile,
  DominosState,
  GameResult,
} from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import { GameSidebar, escapeHtml, getTurnClockMarkup } from "../ui/GameSidebar";
import {
  ACCENT_VIOLET,
  AMBER_500,
  BG_CARD,
  BG_PRIMARY,
  BLACK as TOKEN_BLACK,
  BORDER_LIGHT,
  BORDER_LIGHT_ALPHA,
  EMERALD_800,
  EMERALD_900,
  STATUS_ONLINE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_SUBTLE,
  VIOLET_400,
  WHITE,
  YELLOW_400,
  ZINC_700,
  ZINC_800,
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
const TILE_BORDER = ZINC_700;
const TILE_PIP_COLOR = TOKEN_BLACK;
const TILE_SHADOW_COLOR = TOKEN_BLACK;
const TILE_SHADOW_ALPHA = 0.25;
const TILE_DIVIDER_COLOR = ZINC_700;
const TILE_SELECTED_BORDER = ACCENT_VIOLET;
const TILE_SELECTED_GLOW = VIOLET_400;
const TILE_SELECTED_GLOW_ALPHA = 0.35;
const TILE_FACEDOWN_BG = ZINC_800;
const TILE_FACEDOWN_BORDER = ZINC_700;

// Board-chain tile sizing (horizontal orientation)
const BOARD_TILE_W = 56;
const BOARD_TILE_H = 28;
const BOARD_TILE_GAP = 4;

const END_MARKER_COLOR = ACCENT_VIOLET;
const END_MARKER_ACTIVE_ALPHA = 0.85;
const END_LABEL_FONT_SIZE = 14;

const BONEYARD_BG = BG_CARD;
const BONEYARD_BORDER = BORDER_LIGHT;
const BONEYARD_RADIUS = 10;

const OVERLAY_BACKDROP_COLOR = BG_PRIMARY;
const OVERLAY_BACKDROP_ALPHA = 0.66;

const GAME_ENDED_MESSAGE = "game-end";

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
};

export class DominosRenderer implements GameRenderer {
  readonly gameType = "dominos";
  readonly container = new Container();

  // ── Layers ──────────────────────────────────────────────────────────────
  private readonly boardBackground = new Graphics();
  private readonly boardLayer = new Container();
  private readonly handLayer = new Container();
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
  private boneyardCount = 0;
  private lastPlayedTileId = -1;
  private playerStates = new Map<string, { handCount: number; score: number; passed: boolean }>();
  private gameResult: GameResult | null = null;

  // Local player's hand received via server message (hidden from other clients)
  private myHand: HandTile[] = [];

  // Interaction
  private selectedTileId: number | null = null;
  private choosingEnd = false;
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;

  constructor() {
    this.overlayLayer.eventMode = "none";
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

    this.boneyardGraphics.eventMode = "static";
    this.boneyardGraphics.cursor = "pointer";
    this.boneyardGraphics.on("pointertap", () => this.onBoneyardClick());

    this.boneyardLabel.anchor.set(0.5);
    this.boneyardCountText.anchor.set(0.5);

    this.container.addChild(
      this.boardBackground,
      this.boardLayer,
      this.endMarkerA,
      this.endMarkerB,
      this.boneyardGraphics,
      this.boneyardLabel,
      this.boneyardCountText,
      this.handLayer,
      this.overlayLayer,
    );
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
    this.turnClockSeconds = null;
    this.showTurnClock = false;

    this.sidebar?.destroy();
    this.sidebar = new GameSidebar();
    this.sidebar.addPanel("game-info", "Game Status");
    this.sidebar.addPanel("players", "Players");
    this.sidebar.addPanel("how-to-play", "How to Play");
    this.sidebar.addPanel("controls", "Controls");
    this.sidebar.show();

    this.subscribeToRoomEvents();
    this.applyState(state);
    this.layout();
    this.redrawAll();
  }

  onStateChange(state: unknown): void {
    this.applyState(state);
    this.syncSelection();
    this.redrawAll();
  }

  update(_deltaTime: number): void {
    // No per-frame animation needed currently
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
    this.handLayer.removeChildren();
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
    this.boneyardCount = typeof s?.boneyardCount === "number" ? s.boneyardCount : 0;
    this.lastPlayedTileId = typeof s?.lastPlayedTileId === "number" ? s.lastPlayedTileId : -1;

    this.boardTiles = [];
    if (s?.board) {
      s.board.forEach((tile: BoardTile) => {
        this.boardTiles.push({
          id: tile.id,
          highPips: tile.highPips,
          lowPips: tile.lowPips,
          exposedEnd: tile.exposedEnd,
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
      this.redrawAll();
      return;
    }

    this.selectedTileId = tileId;
    this.choosingEnd = false;

    const tile = this.getMyHand().find((t) => t.id === tileId);
    if (!tile) {
      return;
    }

    // If board is empty, auto-play (no end choice needed)
    if (this.boardTiles.length === 0) {
      this.sendPlay(tileId, "a");
      return;
    }

    const canA = this.canPlayOnEnd(tile, this.openEndA);
    const canB = this.canPlayOnEnd(tile, this.openEndB);

    if (canA && canB && this.openEndA !== this.openEndB) {
      // Both ends valid → let player choose
      this.choosingEnd = true;
      this.redrawAll();
    } else if (canA) {
      this.sendPlay(tileId, "a");
    } else if (canB) {
      this.sendPlay(tileId, "b");
    }
    // else tile can't be played — leave it selected for visual feedback then deselect
  }

  private onEndChoice(end: "a" | "b"): void {
    if (this.selectedTileId === null || !this.choosingEnd) {
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

  private sendPlay(tileId: number, end: "a" | "b"): void {
    this.selectedTileId = null;
    this.choosingEnd = false;
    this.room?.send("play", { tileId, end });
    this.redrawAll();
  }

  private sendAction(type: "draw" | "pass"): void {
    this.selectedTileId = null;
    this.choosingEnd = false;
    this.room?.send(type, {});
    this.redrawAll();
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
    this.redrawHand();
    this.redrawBoneyard();
    this.redrawEndMarkers();
    this.updateOverlay();
    this.updateSidebar();
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
    this.boardLayer.removeChildren();

    if (this.boardTiles.length === 0) {
      const emptyText = new Text({
        text: "Play any domino to start",
        style: { fontFamily: "sans-serif", fontSize: 16, fill: 0xa7f3d0 },
      });
      emptyText.anchor.set(0.5);
      emptyText.position.set(this.width / 2, (TOP_HUD_SPACE + (this.height - BOTTOM_HUD_SPACE)) / 2);
      this.boardLayer.addChild(emptyText);
      return;
    }

    const availableWidth = this.width - VIEW_PADDING * 2;
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
    const tileStride = BOARD_TILE_W + BOARD_TILE_GAP;
    const totalChainWidth = this.boardTiles.length * tileStride - BOARD_TILE_GAP;

    // Scale to fit if chain is wider than available area
    const scale = totalChainWidth > availableWidth ? availableWidth / totalChainWidth : 1;
    const startX = this.width / 2 - (totalChainWidth * scale) / 2;
    const centerY = TOP_HUD_SPACE + availableHeight / 2;

    for (let i = 0; i < this.boardTiles.length; i++) {
      const bt = this.boardTiles[i];
      const g = new Graphics();
      const x = startX + i * tileStride * scale;
      const y = centerY - (BOARD_TILE_H * scale) / 2;
      const w = BOARD_TILE_W * scale;
      const h = BOARD_TILE_H * scale;
      const r = Math.max(2, TILE_RADIUS * scale * 0.5);

      // Shadow
      g.roundRect(x + 2, y + 2, w, h, r).fill({ color: TILE_SHADOW_COLOR, alpha: TILE_SHADOW_ALPHA });

      // Tile body
      g.roundRect(x, y, w, h, r).fill(TILE_BG).stroke({ color: TILE_BORDER, width: 1 });

      // Highlight last played
      if (bt.id === this.lastPlayedTileId) {
        g.roundRect(x, y, w, h, r).stroke({ color: TILE_SELECTED_BORDER, width: 2 });
      }

      // Divider line
      g.moveTo(x + w / 2, y + 1).lineTo(x + w / 2, y + h - 1).stroke({ color: TILE_DIVIDER_COLOR, width: 1 });

      // Draw pips in left half (highPips) and right half (lowPips)
      const halfW = w / 2;
      this.drawPipsHorizontal(g, bt.highPips, x, y, halfW, h, scale);
      this.drawPipsHorizontal(g, bt.lowPips, x + halfW, y, halfW, h, scale);

      g.eventMode = "none";
      this.boardLayer.addChild(g);
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
    this.endMarkerA.visible = false;
    this.endMarkerB.visible = false;

    if (!this.choosingEnd || this.boardTiles.length === 0) {
      return;
    }

    const availableWidth = this.width - VIEW_PADDING * 2;
    const tileStride = BOARD_TILE_W + BOARD_TILE_GAP;
    const totalChainWidth = this.boardTiles.length * tileStride - BOARD_TILE_GAP;
    const scale = totalChainWidth > availableWidth ? availableWidth / totalChainWidth : 1;
    const startX = this.width / 2 - (totalChainWidth * scale) / 2;
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
    const centerY = TOP_HUD_SPACE + availableHeight / 2;
    const markerSize = 32;

    // End A marker — left of chain
    const aX = startX - markerSize - 8;
    const aY = centerY - markerSize / 2;
    this.endMarkerA.roundRect(aX, aY, markerSize, markerSize, 6)
      .fill({ color: END_MARKER_COLOR, alpha: END_MARKER_ACTIVE_ALPHA })
      .stroke({ color: WHITE, width: 2 });
    const labelA = new Text({
      text: "A",
      style: { fontFamily: "sans-serif", fontSize: END_LABEL_FONT_SIZE, fontWeight: "700", fill: WHITE },
    });
    labelA.anchor.set(0.5);
    labelA.position.set(aX + markerSize / 2, aY + markerSize / 2);
    this.endMarkerA.addChild(labelA);
    this.endMarkerA.visible = true;

    // End B marker — right of chain
    const bX = startX + totalChainWidth * scale + 8;
    const bY = centerY - markerSize / 2;
    this.endMarkerB.roundRect(bX, bY, markerSize, markerSize, 6)
      .fill({ color: END_MARKER_COLOR, alpha: END_MARKER_ACTIVE_ALPHA })
      .stroke({ color: WHITE, width: 2 });
    const labelB = new Text({
      text: "B",
      style: { fontFamily: "sans-serif", fontSize: END_LABEL_FONT_SIZE, fontWeight: "700", fill: WHITE },
    });
    labelB.anchor.set(0.5);
    labelB.position.set(bX + markerSize / 2, bY + markerSize / 2);
    this.endMarkerB.addChild(labelB);
    this.endMarkerB.visible = true;
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
    this.handLayer.removeChildren();

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
          <span class="sidebar-stat-value">${this.openEndA === -1 ? "—" : `${this.openEndA} | ${this.openEndB}`}</span>
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
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">Click a domino to select it</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">Click A or B markers to play on either end</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">Draw from boneyard or pass if you can't play</span></li>
        <li class="sidebar-stat-row" style="gap:0.5rem"><span style="color:#a78bfa">•</span><span class="sidebar-stat-label" style="flex:1">First to play all tiles wins!</span></li>
      </ul>`,
    );

    // Controls panel
    const canDraw = this.isLocalPlayersTurn() && this.boneyardCount > 0;
    const canPass = this.isLocalPlayersTurn() && this.boneyardCount === 0;
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
}

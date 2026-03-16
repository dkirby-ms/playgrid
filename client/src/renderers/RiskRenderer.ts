import type { Room } from "@colyseus/sdk";
import type { RiskState } from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import { canPlaceArmy, canSelectForAttack, canSelectForFortify } from "../games/risk/riskClientLogic";
import { GameSidebar, escapeHtml } from "../ui/GameSidebar";
import type {
  GameRenderer,
  GameRendererContext,
  GameRendererHUDStatus,
  RendererInputEvent,
} from "./GameRenderer";
import {
  ACCENT_VIOLET,
  BG_CARD,
  BG_CARD_SURFACE,
  BG_CARD_SURFACE_ALPHA,
  BG_GLASS,
  BG_GLASS_ALPHA,
  BG_PRIMARY,
  BORDER_DEFAULT,
  BORDER_LIGHT,
  BORDER_LIGHT_ALPHA,
  PLAYER_COLOR_ORDER,
  PLAYER_COLORS,
  RED_600,
  RED_700,
  STATUS_INGAME,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  type PlayerColorName,
  type PlayerColorSet,
  createPageBackgroundGradient,
  createPhaseBannerGradient,
  createPrimaryButtonGradient,
  createRiskBoardGradient,
  createRiskMapGradient,
  createRiskOceanGradient,
  withAlpha,
} from "./DesignTokens";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const VIEW_PADDING = 24;
const TOP_HUD_SPACE = 116;
const BOTTOM_HUD_SPACE = 96;
const MAP_WIDTH = 840;
const MAP_HEIGHT = 500;
const HUD_BUTTON_WIDTH = 136;
const HUD_BUTTON_HEIGHT = 40;
const HUD_BUTTON_RADIUS = 12;
const PHASE_BANNER_HEIGHT = 72;
const GRID_COLUMNS = 12;
const GRID_ROWS = 7;

const CONTINENT_ACCENTS: Record<string, PlayerColorName> = {
  "north-america": "green",
  "south-america": "yellow",
  europe: "purple",
  africa: "orange",
  asia: "red",
  australia: "blue",
};

interface TerritoryLayout {
  id: string;
  name: string;
  continent: string;
  x: number;
  y: number;
  adjacentTo: string[];
}

interface ContinentLabelLayout {
  continent: string;
  label: string;
  x: number;
  y: number;
}

const CONTINENT_LABELS: ContinentLabelLayout[] = [
  { continent: "north-america", label: "North America", x: 120, y: 34 },
  { continent: "south-america", label: "South America", x: 215, y: 334 },
  { continent: "europe", label: "Europe", x: 414, y: 80 },
  { continent: "africa", label: "Africa", x: 435, y: 310 },
  { continent: "asia", label: "Asia", x: 646, y: 54 },
  { continent: "australia", label: "Australia", x: 716, y: 368 },
];

const TERRITORY_LAYOUTS: TerritoryLayout[] = [
  { id: "alaska", name: "Alaska", continent: "north-america", x: 80, y: 100, adjacentTo: ["northwest-territory", "alberta", "kamchatka"] },
  { id: "northwest-territory", name: "NW Territory", continent: "north-america", x: 160, y: 80, adjacentTo: ["alaska", "alberta", "ontario", "greenland"] },
  { id: "greenland", name: "Greenland", continent: "north-america", x: 300, y: 60, adjacentTo: ["northwest-territory", "ontario", "quebec", "iceland"] },
  { id: "alberta", name: "Alberta", continent: "north-america", x: 120, y: 150, adjacentTo: ["alaska", "northwest-territory", "ontario", "western-united-states"] },
  { id: "ontario", name: "Ontario", continent: "north-america", x: 180, y: 140, adjacentTo: ["northwest-territory", "alberta", "greenland", "quebec", "western-united-states", "eastern-united-states"] },
  { id: "quebec", name: "Quebec", continent: "north-america", x: 240, y: 130, adjacentTo: ["ontario", "greenland", "eastern-united-states"] },
  { id: "western-united-states", name: "W USA", continent: "north-america", x: 120, y: 200, adjacentTo: ["alberta", "ontario", "eastern-united-states", "central-america"] },
  { id: "eastern-united-states", name: "E USA", continent: "north-america", x: 190, y: 200, adjacentTo: ["ontario", "quebec", "western-united-states", "central-america"] },
  { id: "central-america", name: "C America", continent: "north-america", x: 140, y: 260, adjacentTo: ["western-united-states", "eastern-united-states", "venezuela"] },
  { id: "venezuela", name: "Venezuela", continent: "south-america", x: 200, y: 310, adjacentTo: ["central-america", "peru", "brazil"] },
  { id: "peru", name: "Peru", continent: "south-america", x: 180, y: 370, adjacentTo: ["venezuela", "brazil", "argentina"] },
  { id: "brazil", name: "Brazil", continent: "south-america", x: 240, y: 360, adjacentTo: ["venezuela", "peru", "argentina", "north-africa"] },
  { id: "argentina", name: "Argentina", continent: "south-america", x: 200, y: 430, adjacentTo: ["peru", "brazil"] },
  { id: "iceland", name: "Iceland", continent: "europe", x: 360, y: 90, adjacentTo: ["greenland", "great-britain", "scandinavia"] },
  { id: "great-britain", name: "GB", continent: "europe", x: 360, y: 140, adjacentTo: ["iceland", "scandinavia", "northern-europe", "western-europe"] },
  { id: "scandinavia", name: "Scandinavia", continent: "europe", x: 430, y: 100, adjacentTo: ["iceland", "great-britain", "northern-europe", "ukraine"] },
  { id: "western-europe", name: "W Europe", continent: "europe", x: 360, y: 200, adjacentTo: ["great-britain", "northern-europe", "southern-europe", "north-africa"] },
  { id: "northern-europe", name: "N Europe", continent: "europe", x: 430, y: 160, adjacentTo: ["great-britain", "scandinavia", "ukraine", "southern-europe", "western-europe"] },
  { id: "southern-europe", name: "S Europe", continent: "europe", x: 430, y: 210, adjacentTo: ["western-europe", "northern-europe", "ukraine", "north-africa", "egypt", "middle-east"] },
  { id: "ukraine", name: "Ukraine", continent: "europe", x: 500, y: 130, adjacentTo: ["scandinavia", "northern-europe", "southern-europe", "ural", "afghanistan", "middle-east"] },
  { id: "north-africa", name: "N Africa", continent: "africa", x: 380, y: 280, adjacentTo: ["brazil", "western-europe", "southern-europe", "egypt", "east-africa", "congo"] },
  { id: "egypt", name: "Egypt", continent: "africa", x: 450, y: 270, adjacentTo: ["north-africa", "southern-europe", "middle-east", "east-africa"] },
  { id: "east-africa", name: "E Africa", continent: "africa", x: 480, y: 330, adjacentTo: ["north-africa", "egypt", "middle-east", "congo", "south-africa", "madagascar"] },
  { id: "congo", name: "Congo", continent: "africa", x: 420, y: 360, adjacentTo: ["north-africa", "east-africa", "south-africa"] },
  { id: "south-africa", name: "S Africa", continent: "africa", x: 450, y: 420, adjacentTo: ["congo", "east-africa", "madagascar"] },
  { id: "madagascar", name: "Madagascar", continent: "africa", x: 520, y: 420, adjacentTo: ["east-africa", "south-africa"] },
  { id: "ural", name: "Ural", continent: "asia", x: 570, y: 120, adjacentTo: ["ukraine", "siberia", "afghanistan", "china"] },
  { id: "siberia", name: "Siberia", continent: "asia", x: 630, y: 80, adjacentTo: ["ural", "yakutsk", "irkutsk", "mongolia", "china"] },
  { id: "yakutsk", name: "Yakutsk", continent: "asia", x: 690, y: 70, adjacentTo: ["siberia", "irkutsk", "kamchatka"] },
  { id: "kamchatka", name: "Kamchatka", continent: "asia", x: 750, y: 80, adjacentTo: ["yakutsk", "irkutsk", "mongolia", "japan", "alaska"] },
  { id: "irkutsk", name: "Irkutsk", continent: "asia", x: 680, y: 110, adjacentTo: ["siberia", "yakutsk", "kamchatka", "mongolia"] },
  { id: "mongolia", name: "Mongolia", continent: "asia", x: 700, y: 150, adjacentTo: ["siberia", "irkutsk", "kamchatka", "japan", "china"] },
  { id: "japan", name: "Japan", continent: "asia", x: 760, y: 160, adjacentTo: ["kamchatka", "mongolia"] },
  { id: "afghanistan", name: "Afghanistan", continent: "asia", x: 570, y: 180, adjacentTo: ["ukraine", "ural", "china", "india", "middle-east"] },
  { id: "china", name: "China", continent: "asia", x: 640, y: 180, adjacentTo: ["ural", "siberia", "mongolia", "afghanistan", "india", "siam"] },
  { id: "middle-east", name: "M East", continent: "asia", x: 520, y: 230, adjacentTo: ["ukraine", "southern-europe", "egypt", "east-africa", "afghanistan", "india"] },
  { id: "india", name: "India", continent: "asia", x: 600, y: 250, adjacentTo: ["afghanistan", "china", "middle-east", "siam"] },
  { id: "siam", name: "Siam", continent: "asia", x: 660, y: 270, adjacentTo: ["china", "india", "indonesia"] },
  { id: "indonesia", name: "Indonesia", continent: "australia", x: 680, y: 330, adjacentTo: ["siam", "new-guinea", "western-australia"] },
  { id: "new-guinea", name: "New Guinea", continent: "australia", x: 740, y: 340, adjacentTo: ["indonesia", "western-australia", "eastern-australia"] },
  { id: "western-australia", name: "W Australia", continent: "australia", x: 700, y: 400, adjacentTo: ["indonesia", "new-guinea", "eastern-australia"] },
  { id: "eastern-australia", name: "E Australia", continent: "australia", x: 760, y: 400, adjacentTo: ["new-guinea", "western-australia"] },
];

function toCssHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function getPlayerColorSetByIndex(playerIndex: number): PlayerColorSet {
  const normalizedIndex = ((playerIndex % PLAYER_COLOR_ORDER.length) + PLAYER_COLOR_ORDER.length) % PLAYER_COLOR_ORDER.length;
  return PLAYER_COLORS[PLAYER_COLOR_ORDER[normalizedIndex]];
}

export class RiskRenderer implements GameRenderer {
  readonly gameType = "risk";
  readonly container = new Container();

  private readonly mapLayer = new Container();
  private readonly boardBackdrop = new Graphics();
  private readonly boardFrame = new Graphics();
  private readonly boardSurface = new Graphics();
  private readonly oceanOverlay = new Graphics();
  private readonly gridOverlay = new Graphics();
  private readonly connectionLayer = new Graphics();
  private readonly continentLabelLayer = new Container();
  private readonly territoryLayer = new Container();
  private readonly hudLayer = new Container();
  private readonly phaseBanner = new Graphics();
  private readonly turnIndicator = new Graphics();
  private readonly armiesToPlacePill = new Graphics();
  private readonly statusText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 24,
      fontWeight: "700",
      fill: TEXT_PRIMARY,
      align: "left",
      dropShadow: {
        color: BG_PRIMARY,
        alpha: 0.7,
        blur: 4,
        distance: 1,
      },
    },
  });
  private readonly phaseText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: "600",
      fill: TEXT_SECONDARY,
      align: "left",
      dropShadow: {
        color: BG_PRIMARY,
        alpha: 0.55,
        blur: 3,
        distance: 1,
      },
    },
  });
  private readonly armiesToPlaceText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 15,
      fontWeight: "700",
      fill: TEXT_PRIMARY,
      dropShadow: {
        color: BG_PRIMARY,
        alpha: 0.65,
        blur: 3,
        distance: 1,
      },
    },
  });

  private readonly endPhaseButton = new Container();
  private readonly endPhaseButtonBg = new Graphics();
  private readonly endPhaseButtonText = new Text({
    text: "End Phase",
    style: {
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: "700",
      fill: TEXT_PRIMARY,
    },
  });

  private readonly tradeCardsButton = new Container();
  private readonly tradeCardsButtonBg = new Graphics();
  private readonly tradeCardsButtonText = new Text({
    text: "Trade Cards",
    style: {
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: "700",
      fill: TEXT_PRIMARY,
    },
  });

  private room: Room | null = null;
  private sidebar: GameSidebar | null = null;
  private state: RiskState | null = null;
  private selectedTerritory: string | null = null;
  private hoveredTerritory: string | null = null;
  private readonly validTargets = new Set<string>();
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private mapScale = 1;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  private readonly territoryGraphics = new Map<string, Graphics>();
  private isEndPhaseButtonHovered = false;
  private isTradeCardsButtonHovered = false;

  constructor() {
    this.territoryLayer.sortableChildren = true;
    this.statusText.anchor.set(0, 0.5);
    this.phaseText.anchor.set(0, 0.5);
    this.armiesToPlaceText.anchor.set(0, 0.5);
    this.endPhaseButtonText.anchor.set(0.5);
    this.tradeCardsButtonText.anchor.set(0.5);

    this.endPhaseButton.addChild(this.endPhaseButtonBg, this.endPhaseButtonText);
    this.endPhaseButton.eventMode = "static";
    this.endPhaseButton.on("pointertap", () => this.handleEndPhase());
    this.endPhaseButton.on("pointerenter", () => {
      this.isEndPhaseButtonHovered = true;
      this.updateButtons();
    });
    this.endPhaseButton.on("pointerleave", () => {
      this.isEndPhaseButtonHovered = false;
      this.updateButtons();
    });

    this.tradeCardsButton.addChild(this.tradeCardsButtonBg, this.tradeCardsButtonText);
    this.tradeCardsButton.eventMode = "static";
    this.tradeCardsButton.on("pointertap", () => this.handleTradeCards());
    this.tradeCardsButton.on("pointerenter", () => {
      this.isTradeCardsButtonHovered = true;
      this.updateButtons();
    });
    this.tradeCardsButton.on("pointerleave", () => {
      this.isTradeCardsButtonHovered = false;
      this.updateButtons();
    });

    this.mapLayer.addChild(
      this.boardBackdrop,
      this.boardFrame,
      this.boardSurface,
      this.oceanOverlay,
      this.gridOverlay,
      this.connectionLayer,
      this.continentLabelLayer,
    );

    this.hudLayer.addChild(
      this.phaseBanner,
      this.turnIndicator,
      this.statusText,
      this.phaseText,
      this.armiesToPlacePill,
      this.armiesToPlaceText,
      this.endPhaseButton,
      this.tradeCardsButton,
    );

    this.container.addChild(this.mapLayer, this.territoryLayer, this.hudLayer);
  }

  init(state: unknown, context?: GameRendererContext): void {
    this.room = context?.room ?? null;
    this.state = state as RiskState;
    this.selectedTerritory = null;
    this.hoveredTerritory = null;
    this.validTargets.clear();
    this.sidebar?.destroy();
    this.sidebar = new GameSidebar();
    this.sidebar.addPanel("game-info", "Game Info");
    this.sidebar.addPanel("players", "Players");
    this.sidebar.addPanel("controls", "Controls");
    this.sidebar.show();
    this.createTerritories();
    this.layout();
    this.redrawMap();
    this.updateHUD();
    this.updateSidebar();
  }

  onStateChange(state: unknown): void {
    this.state = state as RiskState;
    this.syncSelectionWithState();
    this.redrawMap();
    this.updateHUD();
    this.updateSidebar();
  }

  update(_deltaTime: number): void {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layout();
    this.redrawMap();
    this.updateHUD();
  }

  handleInput(_event: RendererInputEvent): void {}

  getHUDStatus(_state: unknown): GameRendererHUDStatus {
    const { text, color } = this.getStatusLabel();
    const detail = this.getPhaseLabel();

    return {
      label: "Risk",
      text,
      detail: detail.length > 0 ? detail : undefined,
      accentColor: toCssHexColor(color),
    };
  }

  destroy(): void {
    this.room = null;
    this.state = null;
    this.sidebar?.destroy();
    this.sidebar = null;
    this.validTargets.clear();
    this.territoryGraphics.clear();
    this.container.destroy({ children: true });
  }

  private createTerritories(): void {
    this.territoryGraphics.clear();
    this.territoryLayer.removeChildren().forEach((child) => child.destroy());

    for (const layout of TERRITORY_LAYOUTS) {
      const graphic = new Graphics();
      graphic.eventMode = "static";
      graphic.cursor = "pointer";
      graphic.on("pointertap", () => this.handleTerritoryClick(layout.id));
      graphic.on("pointerenter", () => {
        this.hoveredTerritory = layout.id;
        this.redrawMap();
      });
      graphic.on("pointerleave", () => {
        if (this.hoveredTerritory === layout.id) {
          this.hoveredTerritory = null;
          this.redrawMap();
        }
      });

      this.territoryGraphics.set(layout.id, graphic);
      this.territoryLayer.addChild(graphic);
    }
  }

  private layout(): void {
    const availableWidth = this.width - (VIEW_PADDING * 2);
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
    const scaleX = availableWidth / MAP_WIDTH;
    const scaleY = availableHeight / MAP_HEIGHT;
    this.mapScale = Math.min(scaleX, scaleY, 1);

    const scaledMapWidth = MAP_WIDTH * this.mapScale;
    const scaledMapHeight = MAP_HEIGHT * this.mapScale;

    this.mapOffsetX = (this.width - scaledMapWidth) / 2;
    this.mapOffsetY = TOP_HUD_SPACE + ((availableHeight - scaledMapHeight) / 2);

    const phaseBannerWidth = Math.min(Math.max(340, scaledMapWidth * 0.62), this.width - (VIEW_PADDING * 2));
    const phaseBannerX = (this.width - phaseBannerWidth) / 2;
    const phaseBannerY = Math.max(18, this.mapOffsetY * 0.22);

    this.phaseBanner.clear();
    this.phaseBanner
      .roundRect(phaseBannerX, phaseBannerY, phaseBannerWidth, PHASE_BANNER_HEIGHT, 18)
      .fill(createPhaseBannerGradient())
      .stroke({ color: ACCENT_VIOLET, width: 1.5, alpha: 0.35 });

    this.turnIndicator.position.set(phaseBannerX + 26, phaseBannerY + (PHASE_BANNER_HEIGHT / 2));
    this.statusText.position.set(phaseBannerX + 46, phaseBannerY + 26);
    this.phaseText.position.set(phaseBannerX + 46, phaseBannerY + 48);

    const bottomY = this.mapOffsetY + scaledMapHeight + 20;
    this.endPhaseButton.position.set(
      this.width - this.mapOffsetX - (HUD_BUTTON_WIDTH / 2),
      bottomY + (HUD_BUTTON_HEIGHT / 2),
    );
    this.tradeCardsButton.position.set(
      this.width - this.mapOffsetX - HUD_BUTTON_WIDTH - 14 - (HUD_BUTTON_WIDTH / 2),
      bottomY + (HUD_BUTTON_HEIGHT / 2),
    );

    this.drawBoardChrome(scaledMapWidth, scaledMapHeight);
    this.drawContinentLabels();
  }

  private drawBoardChrome(scaledMapWidth: number, scaledMapHeight: number): void {
    const framePadding = 18 * this.mapScale;
    const frameX = this.mapOffsetX - framePadding;
    const frameY = this.mapOffsetY - framePadding;
    const frameWidth = scaledMapWidth + (framePadding * 2);
    const frameHeight = scaledMapHeight + (framePadding * 2);

    this.boardBackdrop.clear();
    this.boardBackdrop
      .rect(0, 0, this.width, this.height)
      .fill(createPageBackgroundGradient());

    this.boardFrame.clear();
    this.boardFrame
      .roundRect(frameX + (3 * this.mapScale), frameY + (8 * this.mapScale), frameWidth, frameHeight, 28 * this.mapScale)
      .fill({ color: BG_PRIMARY, alpha: 0.42 });
    this.boardFrame
      .roundRect(frameX, frameY, frameWidth, frameHeight, 28 * this.mapScale)
      .fill(createRiskBoardGradient())
      .stroke({ color: BORDER_LIGHT, width: Math.max(1.2, this.mapScale * 1.4), alpha: BORDER_LIGHT_ALPHA + 0.18 });

    this.boardSurface.clear();
    this.boardSurface
      .roundRect(this.mapOffsetX, this.mapOffsetY, scaledMapWidth, scaledMapHeight, 22 * this.mapScale)
      .fill(createRiskMapGradient())
      .stroke({ color: BORDER_LIGHT, width: Math.max(1, this.mapScale * 1.2), alpha: 0.4 });

    this.oceanOverlay.clear();
    this.oceanOverlay
      .roundRect(this.mapOffsetX, this.mapOffsetY, scaledMapWidth, scaledMapHeight, 22 * this.mapScale)
      .fill(createRiskOceanGradient());

    this.gridOverlay.clear();
    const gridStepX = scaledMapWidth / GRID_COLUMNS;
    const gridStepY = scaledMapHeight / GRID_ROWS;
    for (let column = 1; column < GRID_COLUMNS; column += 1) {
      const x = this.mapOffsetX + (gridStepX * column);
      this.gridOverlay.moveTo(x, this.mapOffsetY);
      this.gridOverlay.lineTo(x, this.mapOffsetY + scaledMapHeight);
    }
    for (let row = 1; row < GRID_ROWS; row += 1) {
      const y = this.mapOffsetY + (gridStepY * row);
      this.gridOverlay.moveTo(this.mapOffsetX, y);
      this.gridOverlay.lineTo(this.mapOffsetX + scaledMapWidth, y);
    }
    this.gridOverlay.stroke({ color: BORDER_LIGHT, width: 1, alpha: 0.15 });
  }

  private drawContinentLabels(): void {
    this.continentLabelLayer.removeChildren().forEach((child) => child.destroy());

    for (const label of CONTINENT_LABELS) {
      const accent = PLAYER_COLORS[CONTINENT_ACCENTS[label.continent]];
      const pill = new Graphics();
      const width = Math.max(86, label.label.length * 7.4) * this.mapScale;
      const height = Math.max(22, 24 * this.mapScale);
      const x = this.mapOffsetX + (label.x * this.mapScale);
      const y = this.mapOffsetY + (label.y * this.mapScale);

      pill
        .roundRect(-width / 2, -height / 2, width, height, height / 2)
        .fill({ color: BG_CARD_SURFACE, alpha: BG_CARD_SURFACE_ALPHA + 0.16 })
        .stroke({ color: accent.border, width: Math.max(1, this.mapScale * 1.1), alpha: 0.62 });
      pill.position.set(x, y);

      const text = new Text({
        text: label.label,
        style: {
          fontFamily: "sans-serif",
          fontSize: Math.max(10, 12 * this.mapScale),
          fontWeight: "700",
          fill: TEXT_PRIMARY,
          align: "center",
          dropShadow: {
            color: BG_PRIMARY,
            alpha: 0.65,
            blur: 3,
            distance: 1,
          },
        },
      });
      text.anchor.set(0.5);
      text.position.set(x, y);

      this.continentLabelLayer.addChild(pill, text);
    }
  }

  private redrawMap(): void {
    this.drawConnections();

    for (const layout of TERRITORY_LAYOUTS) {
      const graphic = this.territoryGraphics.get(layout.id);
      if (!graphic) {
        continue;
      }

      const territory = this.state?.territories?.get(layout.id);
      const ownerColors = territory?.owner ? this.getPlayerColorSetForSessionId(territory.owner) : null;
      const x = this.mapOffsetX + (layout.x * this.mapScale);
      const y = this.mapOffsetY + (layout.y * this.mapScale);
      const cardWidth = Math.max(62, Math.min(102, (layout.name.length * 5.8) + 32)) * this.mapScale;
      const cardHeight = Math.max(34, 46 * this.mapScale);
      const badgeHeight = Math.max(16, 18 * this.mapScale);
      const badgeWidth = Math.max(26, Math.min(cardWidth - (10 * this.mapScale), 34 * this.mapScale));
      const borderWidth = Math.max(1.2, 1.8 * this.mapScale);
      const cornerRadius = Math.max(10, 12 * this.mapScale);
      const isSelected = this.selectedTerritory === layout.id;
      const isHovered = this.hoveredTerritory === layout.id;
      const isValidTarget = this.validTargets.has(layout.id);
      const isAttackTarget = isValidTarget && this.state?.turnPhase === "attack";
      const isAttackSource = isSelected && this.state?.turnPhase === "attack";
      const territoryFill = ownerColors?.bg ?? BG_CARD;
      const territoryBorder = ownerColors?.border ?? BORDER_LIGHT;
      const territoryText = ownerColors?.text ?? TEXT_MUTED;
      const scale = isSelected ? 1.08 : isHovered ? 1.05 : 1;

      graphic.clear();
      graphic.removeChildren().forEach((child) => child.destroy());
      graphic.position.set(x, y);
      graphic.scale.set(scale);
      graphic.zIndex = isSelected ? 30 : isHovered ? 20 : isValidTarget ? 15 : 10;

      graphic
        .roundRect(
          (-cardWidth / 2) + (2 * this.mapScale),
          (-cardHeight / 2) + (5 * this.mapScale),
          cardWidth,
          cardHeight,
          cornerRadius,
        )
        .fill({ color: BG_PRIMARY, alpha: 0.46 });

      graphic
        .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, cornerRadius)
        .fill({ color: territoryFill, alpha: ownerColors ? 0.94 : 0.88 })
        .stroke({ color: territoryBorder, width: borderWidth, alpha: 0.96 });

      if (!ownerColors) {
        graphic
          .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, cornerRadius)
          .fill({ color: BG_CARD_SURFACE, alpha: 0.24 });
      }

      if (isHovered) {
        graphic
          .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, cornerRadius)
          .fill({ color: TEXT_PRIMARY, alpha: 0.08 });
      }

      if (isValidTarget) {
        graphic
          .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, cornerRadius)
          .fill({ color: isAttackTarget ? RED_600 : ACCENT_VIOLET, alpha: isAttackTarget ? 0.24 : 0.18 });
      }

      if (isSelected) {
        graphic
          .roundRect(
            (-cardWidth / 2) - (4 * this.mapScale),
            (-cardHeight / 2) - (4 * this.mapScale),
            cardWidth + (8 * this.mapScale),
            cardHeight + (8 * this.mapScale),
            cornerRadius + (4 * this.mapScale),
          )
          .stroke({ color: ACCENT_VIOLET, width: Math.max(2, this.mapScale * 2.4), alpha: 0.95 });
      }

      if (isAttackSource) {
        graphic
          .roundRect(
            (-cardWidth / 2) - (8 * this.mapScale),
            (-cardHeight / 2) - (8 * this.mapScale),
            cardWidth + (16 * this.mapScale),
            cardHeight + (16 * this.mapScale),
            cornerRadius + (8 * this.mapScale),
          )
          .stroke({ color: territoryText, width: Math.max(3, this.mapScale * 3.2), alpha: 0.42 });
      }

      const nameFontSize = Math.max(8, Math.min(12, 11 * this.mapScale) - Math.max(0, (layout.name.length - 10) * 0.18));
      const nameText = new Text({
        text: layout.name,
        style: {
          fontFamily: "sans-serif",
          fontSize: nameFontSize,
          fontWeight: "700",
          fill: TEXT_PRIMARY,
          align: "center",
          wordWrap: true,
          wordWrapWidth: cardWidth - (12 * this.mapScale),
          dropShadow: {
            color: BG_PRIMARY,
            alpha: 0.78,
            blur: 2,
            distance: 1,
          },
        },
      });
      nameText.anchor.set(0.5);
      nameText.position.set(0, (-cardHeight / 2) + (14 * this.mapScale));

      const badgeTop = (cardHeight / 2) - badgeHeight - (4 * this.mapScale);
      graphic
        .roundRect(-badgeWidth / 2, badgeTop, badgeWidth, badgeHeight, badgeHeight / 2)
        .fill({ color: BG_CARD_SURFACE, alpha: BG_CARD_SURFACE_ALPHA + 0.3 })
        .stroke({ color: BORDER_DEFAULT, width: Math.max(1, this.mapScale), alpha: 0.72 });

      const armyText = new Text({
        text: String(territory?.armyCount ?? 0),
        style: {
          fontFamily: "sans-serif",
          fontSize: Math.max(10, 12 * this.mapScale),
          fontWeight: "800",
          fill: TEXT_PRIMARY,
          align: "center",
          dropShadow: {
            color: BG_PRIMARY,
            alpha: 0.88,
            blur: 3,
            distance: 1,
          },
        },
      });
      armyText.anchor.set(0.5);
      armyText.position.set(0, badgeTop + (badgeHeight / 2));

      graphic.addChild(nameText, armyText);
    }
  }

  private drawConnections(): void {
    this.connectionLayer.clear();

    const drawnEdges = new Set<string>();
    for (const territory of TERRITORY_LAYOUTS) {
      for (const adjacentId of territory.adjacentTo) {
        const edgeKey = [territory.id, adjacentId].sort().join(":");
        if (drawnEdges.has(edgeKey)) {
          continue;
        }
        drawnEdges.add(edgeKey);

        const adjacent = TERRITORY_LAYOUTS.find((layout) => layout.id === adjacentId);
        if (!adjacent) {
          continue;
        }

        const fromX = this.mapOffsetX + (territory.x * this.mapScale);
        const fromY = this.mapOffsetY + (territory.y * this.mapScale);
        const toX = this.mapOffsetX + (adjacent.x * this.mapScale);
        const toY = this.mapOffsetY + (adjacent.y * this.mapScale);
        const touchesSelection = this.selectedTerritory === territory.id || this.selectedTerritory === adjacent.id;
        const touchesValidTarget = this.validTargets.has(territory.id) || this.validTargets.has(adjacent.id);
        const isAttackLine = this.state?.turnPhase === "attack" && touchesSelection && touchesValidTarget;
        const lineColor = isAttackLine ? RED_700 : touchesSelection ? ACCENT_VIOLET : BORDER_LIGHT;
        const lineAlpha = isAttackLine ? 0.36 : touchesSelection ? 0.24 : 0.18;
        const lineWidth = isAttackLine ? Math.max(2, this.mapScale * 2.4) : Math.max(1, this.mapScale * 1.5);

        this.connectionLayer.moveTo(fromX, fromY);
        this.connectionLayer.lineTo(toX, toY);
        this.connectionLayer.stroke({ color: lineColor, width: lineWidth, alpha: lineAlpha });
      }
    }
  }

  private updateHUD(): void {
    const { text: statusLabel, color: statusColor } = this.getStatusLabel();
    const phaseLabel = this.getPhaseLabel();
    const armiesToPlace = this.getArmiesToPlace();
    const currentTurnColors = this.state?.currentTurn ? this.getPlayerColorSetForSessionId(this.state.currentTurn) : null;
    const bottomY = this.mapOffsetY + (MAP_HEIGHT * this.mapScale) + 20;

    this.statusText.text = statusLabel;
    this.statusText.style.fill = statusColor;

    this.phaseText.text = phaseLabel;
    this.phaseText.style.fill = phaseLabel.length > 0 ? TEXT_SECONDARY : TEXT_MUTED;

    this.turnIndicator.clear();
    this.turnIndicator
      .circle(0, 0, 7)
      .fill({ color: currentTurnColors?.bg ?? STATUS_INGAME, alpha: 1 });
    this.turnIndicator
      .circle(0, 0, 11)
      .stroke({ color: currentTurnColors?.text ?? TEXT_SECONDARY, width: 2, alpha: 0.4 });

    this.armiesToPlaceText.text = armiesToPlace > 0 ? `Armies to place: ${armiesToPlace}` : "";
    this.armiesToPlaceText.visible = armiesToPlace > 0;
    this.armiesToPlacePill.visible = armiesToPlace > 0;

    if (armiesToPlace > 0) {
      const pillPaddingX = 14;
      const pillWidth = this.armiesToPlaceText.width + (pillPaddingX * 2);
      const pillHeight = 32;
      this.armiesToPlacePill.clear();
      this.armiesToPlacePill
        .roundRect(this.mapOffsetX, bottomY, pillWidth, pillHeight, 16)
        .fill({ color: BG_GLASS, alpha: BG_GLASS_ALPHA + 0.18 })
        .stroke({ color: ACCENT_VIOLET, width: 1.2, alpha: 0.44 });
      this.armiesToPlaceText.position.set(this.mapOffsetX + pillPaddingX, bottomY + (pillHeight / 2));
    } else {
      this.armiesToPlacePill.clear();
      this.armiesToPlaceText.position.set(this.mapOffsetX, bottomY + 16);
    }

    this.updateButtons();
  }

  private updateButtons(): void {
    const canEndPhase = this.canEndPhase();
    const canTradeCards = this.canTradeCards();
    const myRiskPlayer = this.room ? this.state?.riskPlayers?.get(this.room.sessionId) : null;

    this.drawPrimaryActionButton(
      this.endPhaseButtonBg,
      HUD_BUTTON_WIDTH,
      HUD_BUTTON_HEIGHT,
      canEndPhase,
      this.isEndPhaseButtonHovered,
    );
    this.endPhaseButton.eventMode = canEndPhase ? "static" : "none";
    this.endPhaseButton.cursor = canEndPhase ? "pointer" : "default";

    this.drawGlassActionButton(
      this.tradeCardsButtonBg,
      HUD_BUTTON_WIDTH,
      HUD_BUTTON_HEIGHT,
      canTradeCards,
      this.isTradeCardsButtonHovered,
    );
    this.tradeCardsButton.eventMode = canTradeCards ? "static" : "none";
    this.tradeCardsButton.cursor = canTradeCards ? "pointer" : "default";
    this.tradeCardsButton.visible = canTradeCards;

    this.endPhaseButtonText.text = this.state?.turnPhase === "fortify" ? "End Turn" : "Next Phase";
    this.tradeCardsButtonText.text = canTradeCards
      ? `Trade Cards (${myRiskPlayer?.cardsHeld ?? 0})`
      : "Trade Cards";
  }

  private drawPrimaryActionButton(
    graphic: Graphics,
    width: number,
    height: number,
    enabled: boolean,
    hovered: boolean,
  ): void {
    graphic.clear();
    graphic
      .roundRect((-width / 2) + 2, (-height / 2) + 4, width, height, HUD_BUTTON_RADIUS)
      .fill({ color: BG_PRIMARY, alpha: 0.34 });
    graphic.roundRect(-width / 2, -height / 2, width, height, HUD_BUTTON_RADIUS);

    if (!enabled) {
      graphic
        .fill({ color: BG_CARD, alpha: 0.72 })
        .stroke({ color: BORDER_LIGHT, width: 1.2, alpha: 0.42 });
      return;
    }

    graphic
      .fill(createPrimaryButtonGradient())
      .stroke({ color: ACCENT_VIOLET, width: 1.4, alpha: hovered ? 0.72 : 0.5 });

    if (hovered) {
      graphic
        .roundRect(-width / 2, -height / 2, width, height, HUD_BUTTON_RADIUS)
        .fill({ color: TEXT_PRIMARY, alpha: 0.08 });
    }
  }

  private drawGlassActionButton(
    graphic: Graphics,
    width: number,
    height: number,
    enabled: boolean,
    hovered: boolean,
  ): void {
    graphic.clear();
    graphic
      .roundRect((-width / 2) + 2, (-height / 2) + 4, width, height, HUD_BUTTON_RADIUS)
      .fill({ color: BG_PRIMARY, alpha: 0.3 });
    graphic.roundRect(-width / 2, -height / 2, width, height, HUD_BUTTON_RADIUS);
    graphic
      .fill({ color: enabled ? BG_GLASS : BG_CARD, alpha: enabled ? BG_GLASS_ALPHA + 0.22 : 0.7 })
      .stroke({ color: enabled ? ACCENT_VIOLET : BORDER_LIGHT, width: 1.2, alpha: hovered ? 0.64 : 0.4 });

    if (enabled && hovered) {
      graphic
        .roundRect(-width / 2, -height / 2, width, height, HUD_BUTTON_RADIUS)
        .fill({ color: TEXT_PRIMARY, alpha: 0.06 });
    }
  }

  private updateSidebar(): void {
    if (!this.sidebar) {
      return;
    }

    if (!this.state) {
      this.sidebar.updatePanel("game-info", '<div class="sidebar-empty">Waiting for game state.</div>');
      this.sidebar.updatePanel("players", '<div class="sidebar-empty">Player stats will appear once the match starts.</div>');
      this.sidebar.updatePanel("controls", '<div class="sidebar-empty">Controls unlock when the match is ready.</div>');
      return;
    }

    const myRiskPlayer = this.room ? this.state.riskPlayers?.get(this.room.sessionId) : null;
    this.sidebar.updatePanel(
      "game-info",
      `<div class="sidebar-stat-list">
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Phase</span><span class="sidebar-stat-value">${escapeHtml(this.getPhaseLabel())}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Current turn</span><span class="sidebar-stat-value">${escapeHtml(this.getCurrentTurnLabel())}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Armies to place</span><span class="sidebar-stat-value">${this.getArmiesToPlace()}</span></div>
        <div class="sidebar-stat-row"><span class="sidebar-stat-label">Cards held</span><span class="sidebar-stat-value">${myRiskPlayer?.cardsHeld ?? 0}</span></div>
      </div>`,
    );

    const players = Array.from(this.state.players?.values() ?? [])
      .sort((left, right) => Number(left.playerIndex ?? 0) - Number(right.playerIndex ?? 0));
    const playersMarkup = players.length > 0
      ? `<div class="sidebar-player-list">${players.map((player) => {
          const displayName = typeof player.displayName === "string" && player.displayName.length > 0
            ? player.displayName
            : "Player";
          const riskPlayer = this.state?.riskPlayers?.get(player.sessionId);
          const colors = getPlayerColorSetByIndex(player.playerIndex ?? 0);
          const tags = [
            player.sessionId === this.room?.sessionId ? '<span class="sidebar-tag">You</span>' : "",
            player.sessionId === this.state?.currentTurn ? '<span class="sidebar-tag">Turn</span>' : "",
          ].join("");
          return `<div class="sidebar-player-row" style="border-color:${withAlpha(colors.border, 0.4)}; background:linear-gradient(135deg, ${withAlpha(colors.bg, 0.18)}, ${withAlpha(BG_CARD_SURFACE, 0.16)});">
            <div style="display:flex; align-items:center; gap:10px; flex:0 0 auto; margin-top:2px;">
              <span style="display:inline-flex; width:12px; height:12px; border-radius:999px; background:${toCssHexColor(colors.bg)}; box-shadow:0 0 0 3px ${withAlpha(colors.text, 0.16)};"></span>
            </div>
            <div class="sidebar-player-copy">
              <div class="sidebar-player-name" style="color:${toCssHexColor(colors.text)}">${escapeHtml(displayName)}</div>
              <div class="sidebar-player-meta">${riskPlayer?.territoriesOwned ?? 0} territories • ${this.getPlayerArmyCount(player.sessionId)} armies • ${riskPlayer?.cardsHeld ?? 0} cards</div>
            </div>
            ${tags}
          </div>`;
        }).join("")}</div>`
      : '<div class="sidebar-empty">Waiting for players.</div>';
    this.sidebar.updatePanel("players", playersMarkup);

    const selectedTerritory = this.selectedTerritory ? TERRITORY_LAYOUTS.find((territory) => territory.id === this.selectedTerritory) : null;
    const selectedCopy = selectedTerritory ? `Selected: ${selectedTerritory.name}.` : "Select a territory on the board for context.";

    this.sidebar.updatePanel(
      "controls",
      `<div class="sidebar-button-group">
        <button type="button" class="sidebar-button" data-action="end-phase"${this.canEndPhase() ? "" : " disabled"}>${this.state.turnPhase === "fortify" ? "End Turn" : "Next Phase"}</button>
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="fortify"${this.canEnterFortify() ? "" : " disabled"}>Fortify</button>
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="trade-cards"${this.canTradeCards() ? "" : " disabled"}>Trade Cards${myRiskPlayer ? ` (${myRiskPlayer.cardsHeld})` : ""}</button>
      </div>
      <div class="sidebar-note">${escapeHtml(selectedCopy)} Place armies, attack, and move units directly on the redesigned map cards.</div>`,
    );

    const controlsPanel = this.sidebar.getPanelContent("controls");
    const endPhaseButton = controlsPanel?.querySelector('[data-action="end-phase"]');
    if (endPhaseButton instanceof HTMLButtonElement) {
      endPhaseButton.onclick = () => {
        if (this.canEndPhase()) {
          this.handleEndPhase();
        }
      };
    }

    const fortifyButton = controlsPanel?.querySelector('[data-action="fortify"]');
    if (fortifyButton instanceof HTMLButtonElement) {
      fortifyButton.onclick = () => {
        if (this.canEnterFortify()) {
          this.handleEndPhase();
        }
      };
    }

    const tradeCardsButton = controlsPanel?.querySelector('[data-action="trade-cards"]');
    if (tradeCardsButton instanceof HTMLButtonElement) {
      tradeCardsButton.onclick = () => {
        if (this.canTradeCards()) {
          this.handleTradeCards();
        }
      };
    }
  }

  private canEndPhase(): boolean {
    if (!this.state || !this.room) {
      return false;
    }

    const isMyTurn = this.state.currentTurn === this.room.sessionId;
    if (!isMyTurn) {
      return false;
    }

    return this.state.turnPhase === "attack"
      || this.state.turnPhase === "fortify"
      || (this.state.turnPhase === "reinforce" && this.getArmiesToPlace() === 0);
  }

  private canTradeCards(): boolean {
    if (!this.state || !this.room) {
      return false;
    }

    const isMyTurn = this.state.currentTurn === this.room.sessionId;
    const riskPlayer = this.state.riskPlayers?.get(this.room.sessionId);
    return isMyTurn && this.state.turnPhase === "reinforce" && (riskPlayer?.cardsHeld ?? 0) >= 3;
  }

  private canEnterFortify(): boolean {
    return Boolean(this.state && this.room && this.state.currentTurn === this.room.sessionId && this.state.turnPhase === "attack");
  }

  private getCurrentTurnLabel(): string {
    if (!this.state?.currentTurn) {
      return "Waiting";
    }

    return this.getDisplayName(this.state.currentTurn);
  }

  private getDisplayName(sessionId: string): string {
    if (this.room?.sessionId === sessionId) {
      return "You";
    }

    const player = this.state?.players?.get(sessionId);
    if (typeof player?.displayName === "string" && player.displayName.length > 0) {
      return player.displayName;
    }

    return "Player";
  }

  private getPlayerArmyCount(sessionId: string): number {
    if (!this.state) {
      return 0;
    }

    let armies = 0;
    for (const territory of this.state.territories?.values() ?? []) {
      if (territory.owner === sessionId) {
        armies += territory.armyCount ?? 0;
      }
    }

    return armies;
  }

  private handleTerritoryClick(territoryId: string): void {
    if (!this.state || !this.room) {
      return;
    }

    const sessionId = this.room.sessionId;
    const isMyTurn = this.state.currentTurn === sessionId;

    if (!isMyTurn) {
      this.clearSelection();
      return;
    }

    if (this.state.turnPhase === "setup-pick" || this.state.turnPhase === "setup-place" || this.state.turnPhase === "reinforce") {
      if (canPlaceArmy(this.state, territoryId, sessionId)) {
        this.room.send("placeArmy", { territoryId });
        this.clearSelection();
      }
      return;
    }

    if (this.state.turnPhase === "attack") {
      if (this.selectedTerritory) {
        if (this.validTargets.has(territoryId)) {
          this.room.send("attack", {
            from: this.selectedTerritory,
            to: territoryId,
            attackDiceCount: 3,
          });
          this.clearSelection();
        } else if (canSelectForAttack(this.state, territoryId, sessionId)) {
          this.setSelection(territoryId);
        } else {
          this.clearSelection();
        }
      } else if (canSelectForAttack(this.state, territoryId, sessionId)) {
        this.setSelection(territoryId);
      }
      return;
    }

    if (this.state.turnPhase === "fortify") {
      if (this.selectedTerritory) {
        if (this.validTargets.has(territoryId)) {
          const fromTerritory = this.state.territories?.get(this.selectedTerritory);
          const moveCount = Math.max(1, (fromTerritory?.armyCount ?? 1) - 1);
          this.room.send("fortify", {
            from: this.selectedTerritory,
            to: territoryId,
            armyCount: moveCount,
          });
          this.clearSelection();
        } else if (canSelectForFortify(this.state, territoryId, sessionId)) {
          this.setSelection(territoryId);
        } else {
          this.clearSelection();
        }
      } else if (canSelectForFortify(this.state, territoryId, sessionId)) {
        this.setSelection(territoryId);
      }
    }
  }

  private handleEndPhase(): void {
    if (!this.room) {
      return;
    }

    this.room.send("endPhase", {});
    this.clearSelection();
  }

  private handleTradeCards(): void {
    if (!this.room) {
      return;
    }

    this.room.send("tradeCards", {});
  }

  private setSelection(territoryId: string): void {
    this.selectedTerritory = territoryId;
    this.updateValidTargets();
    this.redrawMap();
    this.updateSidebar();
  }

  private clearSelection(): void {
    this.selectedTerritory = null;
    this.validTargets.clear();
    this.redrawMap();
    this.updateSidebar();
  }

  private syncSelectionWithState(): void {
    if (!this.selectedTerritory || !this.state) {
      return;
    }

    const sessionId = this.room?.sessionId ?? "";
    const territory = this.state.territories?.get(this.selectedTerritory);

    if (!territory || territory.owner !== sessionId) {
      this.clearSelection();
      return;
    }

    this.updateValidTargets();
  }

  private updateValidTargets(): void {
    this.validTargets.clear();

    if (!this.selectedTerritory || !this.state) {
      return;
    }

    const sessionId = this.room?.sessionId ?? "";
    const selectedLayout = TERRITORY_LAYOUTS.find((territory) => territory.id === this.selectedTerritory);
    if (!selectedLayout) {
      return;
    }

    if (this.state.turnPhase === "attack") {
      for (const adjacentId of selectedLayout.adjacentTo) {
        const adjacent = this.state.territories?.get(adjacentId);
        if (adjacent && adjacent.owner !== sessionId) {
          this.validTargets.add(adjacentId);
        }
      }
    } else if (this.state.turnPhase === "fortify") {
      for (const adjacentId of selectedLayout.adjacentTo) {
        const adjacent = this.state.territories?.get(adjacentId);
        if (adjacent && adjacent.owner === sessionId) {
          this.validTargets.add(adjacentId);
        }
      }
    }
  }

  private getStatusLabel(): { text: string; color: number } {
    if (!this.state) {
      return { text: "Waiting for game", color: TEXT_SECONDARY };
    }

    const sessionId = this.room?.sessionId;
    const currentTurn = this.state.currentTurn;
    if (!sessionId || !currentTurn) {
      return { text: "Waiting for players", color: TEXT_SECONDARY };
    }

    const turnColor = this.getPlayerColorSetForSessionId(currentTurn)?.text ?? TEXT_PRIMARY;
    if (currentTurn === sessionId) {
      return { text: "Your turn", color: turnColor };
    }

    return { text: `${this.getDisplayName(currentTurn)} is acting`, color: turnColor };
  }

  private getPhaseLabel(): string {
    const turnPhase = this.state?.turnPhase;
    if (!turnPhase) {
      return "";
    }

    const phaseLabels: Record<string, string> = {
      "setup-pick": "Setup • Pick Territories",
      "setup-place": "Setup • Place Armies",
      reinforce: "Reinforce Phase",
      attack: "Attack Phase",
      fortify: "Fortify Phase",
    };

    return phaseLabels[turnPhase] ?? turnPhase;
  }

  private getArmiesToPlace(): number {
    if (!this.state || !this.room) {
      return 0;
    }

    const riskPlayer = this.state.riskPlayers?.get(this.room.sessionId);
    return riskPlayer?.armiesToPlace ?? 0;
  }

  private getPlayerIndex(sessionId: string): number {
    if (!this.state) {
      return -1;
    }

    const directPlayer = this.state.players?.get(sessionId);
    if (typeof directPlayer?.playerIndex === "number") {
      return directPlayer.playerIndex;
    }

    const playersList = Array.from(this.state.players?.values() ?? [])
      .sort((left, right) => Number(left.playerIndex ?? 0) - Number(right.playerIndex ?? 0));
    return playersList.findIndex((player) => player.sessionId === sessionId);
  }

  private getPlayerColorSetForSessionId(sessionId: string): PlayerColorSet | null {
    const playerIndex = this.getPlayerIndex(sessionId);
    return playerIndex >= 0 ? getPlayerColorSetByIndex(playerIndex) : null;
  }
}

import type { Room } from "@colyseus/sdk";
import type { RiskState } from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import { canPlaceArmy, canSelectForAttack, canSelectForFortify } from "../games/risk/riskClientLogic";
import { GameSidebar, escapeHtml, getTurnClockMarkup } from "../ui/GameSidebar";
import type {
  GameRenderer,
  GameRendererContext,
  GameRendererHUDStatus,
  RendererInputEvent,
} from "./GameRenderer";
import {
  ACCENT_BLUE,
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
  type PlayerColorSet,
  createPageBackgroundGradient,
  createPhaseBannerGradient,
  createPrimaryButtonGradient,
  createRiskBoardGradient,
  createRiskMapGradient,
  createRiskOceanGradient,
  withAlpha,
} from "./DesignTokens";
import { CLASSIC_RISK_MAP } from "./risk/classicRiskMap";
import type { RiskMapDefinition, TerritoryDef } from "./risk/RiskMapDefinition";
import { drawSvgPath } from "./risk/svgPathParser";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const VIEW_PADDING = 16;
const TOP_HUD_SPACE = 96;
const BOTTOM_HUD_SPACE = 72;
const HUD_BUTTON_WIDTH = 136;
const HUD_BUTTON_HEIGHT = 40;
const HUD_BUTTON_RADIUS = 12;
const PHASE_BANNER_HEIGHT = 72;

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

  private readonly mapDef: RiskMapDefinition = CLASSIC_RISK_MAP;
  private readonly mapLayer = new Container();
  private readonly boardBackdrop = new Graphics();
  private readonly boardFrame = new Graphics();
  private readonly boardSurface = new Graphics();
  private readonly oceanOverlay = new Graphics();
  private readonly connectionLayer = new Graphics();
  private readonly territoryLayer = new Container();
  private readonly labelLayer = new Container();
  private readonly hudLayer = new Container();
  private readonly phaseBanner = new Graphics();
  private readonly turnIndicator = new Graphics();
  private readonly armiesToPlacePill = new Graphics();
  private readonly statusText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 18,
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
      fontSize: 14,
      fontWeight: "500",
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
  private turnClockSeconds: number | null = null;
  private showTurnClock = false;
  private state: RiskState | null = null;
  private selectedTerritory: string | null = null;
  private hoveredTerritory: string | null = null;
  private readonly validTargets = new Set<string>();
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private mapScale = 1;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  /** Offset for raw SVG path drawing (accounts for group translate in the SVG) */
  private pathOffsetX = 0;
  private pathOffsetY = 0;
  private readonly territoryGraphics = new Map<string, Graphics>();
  private readonly territoryDefMap = new Map<string, TerritoryDef>();
  private isEndPhaseButtonHovered = false;
  private isTradeCardsButtonHovered = false;
  private actionPending = false;

  private turnIndicatorPulseTime = 0;

  constructor() {
    this.territoryLayer.sortableChildren = true;
    this.statusText.anchor.set(0, 0.5);
    this.phaseText.anchor.set(0, 0.5);
    this.armiesToPlaceText.anchor.set(0, 0.5);
    this.endPhaseButtonText.anchor.set(0.5);
    this.tradeCardsButtonText.anchor.set(0.5);

    // Build territory lookup from map definition
    for (const def of this.mapDef.territories) {
      this.territoryDefMap.set(def.id, def);
    }

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
      this.connectionLayer,
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

    this.container.addChild(this.mapLayer, this.territoryLayer, this.labelLayer, this.hudLayer);
  }

  init(state: unknown, context?: GameRendererContext): void {
    this.room = context?.room ?? null;
    this.state = state as RiskState;
    this.selectedTerritory = null;
    this.hoveredTerritory = null;
    this.validTargets.clear();
    this.turnClockSeconds = null;
    this.showTurnClock = false;
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
    this.actionPending = false;
    this.state = state as RiskState;
    this.syncSelectionWithState();
    this.redrawMap();
    this.updateHUD();
    this.updateSidebar();
  }

  update(deltaTime: number): void {
    // Animate turn indicator pulse
    this.turnIndicatorPulseTime += deltaTime;
    this.updateTurnIndicatorPulse();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layout();
    this.redrawMap();
    this.updateHUD();
  }

  handleInput(_event: RendererInputEvent): void {}

  setTurnClock(seconds: number | null, visible: boolean): void {
    this.turnClockSeconds = seconds !== null ? Math.max(0, Math.floor(seconds)) : null;
    this.showTurnClock = visible && seconds !== null;
    this.updateSidebar();
  }

  getHUDStatus(_state: unknown): GameRendererHUDStatus {
    const { turnText } = this.getCombinedTurnPhaseText();
    const currentTurnColors = this.state?.currentTurn ? this.getPlayerColorSetForSessionId(this.state.currentTurn) : null;

    return {
      label: "Risk",
      text: turnText,
      detail: undefined,
      accentColor: toCssHexColor(currentTurnColors?.text ?? TEXT_PRIMARY),
    };
  }

  destroy(): void {
    this.room = null;
    this.state = null;
    this.turnClockSeconds = null;
    this.showTurnClock = false;
    this.sidebar?.destroy();
    this.sidebar = null;
    this.validTargets.clear();
    this.territoryGraphics.clear();
    this.container.destroy({ children: true });
  }

  private createTerritories(): void {
    this.territoryGraphics.clear();
    this.territoryLayer.removeChildren().forEach((child) => child.destroy());

    for (const def of this.mapDef.territories) {
      const graphic = new Graphics();
      graphic.eventMode = "static";
      graphic.cursor = "pointer";
      graphic.on("pointertap", () => this.handleTerritoryClick(def.id));
      graphic.on("pointerenter", () => {
        this.hoveredTerritory = def.id;
        this.redrawMap();
      });
      graphic.on("pointerleave", () => {
        if (this.hoveredTerritory === def.id) {
          this.hoveredTerritory = null;
          this.redrawMap();
        }
      });

      this.territoryGraphics.set(def.id, graphic);
      this.territoryLayer.addChild(graphic);
    }
  }

  private layout(): void {
    const availableWidth = this.width - (VIEW_PADDING * 2);
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
    const scaleX = availableWidth / this.mapDef.viewBoxWidth;
    const scaleY = availableHeight / this.mapDef.viewBoxHeight;
    this.mapScale = Math.min(scaleX, scaleY);

    const scaledMapWidth = this.mapDef.viewBoxWidth * this.mapScale;
    const scaledMapHeight = this.mapDef.viewBoxHeight * this.mapScale;

    this.mapOffsetX = (this.width - scaledMapWidth) / 2;
    this.mapOffsetY = TOP_HUD_SPACE + ((availableHeight - scaledMapHeight) / 2);

    // Raw SVG path coordinates need the group translate applied
    this.pathOffsetX = this.mapOffsetX + (this.mapDef.contentOffsetX * this.mapScale);
    this.pathOffsetY = this.mapOffsetY + (this.mapDef.contentOffsetY * this.mapScale);

    const phaseBannerWidth = Math.min(Math.max(340, scaledMapWidth * 0.62), this.width - (VIEW_PADDING * 2));
    const phaseBannerX = (this.width - phaseBannerWidth) / 2;
    const phaseBannerY = Math.max(18, this.mapOffsetY * 0.22);

    this.phaseBanner.clear();
    this.phaseBanner
      .roundRect(phaseBannerX, phaseBannerY, phaseBannerWidth, PHASE_BANNER_HEIGHT, 18)
      .fill(createPhaseBannerGradient())
      .stroke({ color: ACCENT_BLUE, width: 1.5, alpha: 0.35 });

    this.turnIndicator.position.set(phaseBannerX + 22, phaseBannerY + (PHASE_BANNER_HEIGHT / 2));
    this.statusText.position.set(phaseBannerX + 46, phaseBannerY + 30);
    this.phaseText.position.set(phaseBannerX + 46, phaseBannerY + 50);

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
  }


  private redrawMap(): void {
    this.drawConnections();
    this.labelLayer.removeChildren().forEach((child) => child.destroy());

    for (const def of this.mapDef.territories) {
      const graphic = this.territoryGraphics.get(def.id);
      if (!graphic) continue;

      const territory = this.state?.territories?.get(def.id);
      const ownerColors = territory?.owner ? this.getPlayerColorSetForSessionId(territory.owner) : null;
      const isSelected = this.selectedTerritory === def.id;
      const isHovered = this.hoveredTerritory === def.id;
      const isValidTarget = this.validTargets.has(def.id);
      const isAttackTarget = isValidTarget && this.state?.turnPhase === "attack";
      const isAttackSource = isSelected && this.state?.turnPhase === "attack";
      const territoryFill = ownerColors?.bg ?? BG_CARD;
      const territoryBorder = ownerColors?.border ?? BORDER_LIGHT;
      const territoryText = ownerColors?.text ?? TEXT_MUTED;
      const borderWidth = Math.max(1, 1.4 * this.mapScale);

      graphic.clear();
      graphic.zIndex = isSelected ? 30 : isHovered ? 20 : isValidTarget ? 15 : 10;

      // Territory fill — draw SVG path shape
      drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
      graphic.fill({ color: territoryFill, alpha: ownerColors ? 0.88 : 0.72 });

      // Border stroke
      drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
      graphic.stroke({ color: territoryBorder, width: borderWidth, alpha: 0.9 });

      if (!ownerColors) {
        drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
        graphic.fill({ color: BG_CARD_SURFACE, alpha: 0.2 });
      }

      if (isHovered) {
        drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
        graphic.fill({ color: TEXT_PRIMARY, alpha: 0.12 });
      }

      if (isValidTarget) {
        drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
        graphic.fill({ color: isAttackTarget ? RED_600 : ACCENT_BLUE, alpha: isAttackTarget ? 0.28 : 0.22 });
      }

      if (isSelected) {
        drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
        graphic.stroke({ color: ACCENT_BLUE, width: Math.max(2.5, this.mapScale * 3), alpha: 0.95 });
      }

      if (isAttackSource) {
        drawSvgPath(graphic, def.path, this.pathOffsetX, this.pathOffsetY, this.mapScale);
        graphic.stroke({ color: territoryText, width: Math.max(3, this.mapScale * 3.5), alpha: 0.5 });
      }

      // Territory labels (rendered in a separate layer above all territory shapes)
      const labelX = this.mapOffsetX + (def.labelX * this.mapScale);
      const labelY = this.mapOffsetY + (def.labelY * this.mapScale);

      const nameFontSize = Math.max(7, Math.min(10, 9 * this.mapScale) - Math.max(0, (def.name.length - 10) * 0.15));
      const nameText = new Text({
        text: def.name,
        style: {
          fontFamily: "sans-serif",
          fontSize: nameFontSize,
          fontWeight: "700",
          fill: TEXT_PRIMARY,
          align: "center",
          dropShadow: {
            color: BG_PRIMARY,
            alpha: 0.9,
            blur: 3,
            distance: 1,
          },
        },
      });
      nameText.anchor.set(0.5, 1);
      nameText.position.set(labelX, labelY - (3 * this.mapScale));

      // Army count badge
      const badgeRadius = Math.max(8, 10 * this.mapScale);
      const badge = new Graphics();
      badge
        .circle(labelX, labelY + (badgeRadius * 0.6), badgeRadius)
        .fill({ color: BG_CARD_SURFACE, alpha: BG_CARD_SURFACE_ALPHA + 0.4 })
        .stroke({ color: BORDER_DEFAULT, width: Math.max(1, this.mapScale), alpha: 0.8 });

      const armyText = new Text({
        text: String(territory?.armyCount ?? 0),
        style: {
          fontFamily: "sans-serif",
          fontSize: Math.max(8, 10 * this.mapScale),
          fontWeight: "800",
          fill: TEXT_PRIMARY,
          align: "center",
          dropShadow: {
            color: BG_PRIMARY,
            alpha: 0.9,
            blur: 3,
            distance: 1,
          },
        },
      });
      armyText.anchor.set(0.5);
      armyText.position.set(labelX, labelY + (badgeRadius * 0.6));

      this.labelLayer.addChild(badge, nameText, armyText);
    }
  }

  private drawConnections(): void {
    this.connectionLayer.clear();

    const drawnEdges = new Set<string>();

    for (const def of this.mapDef.territories) {
      for (const adjacentId of def.adjacentTo) {
        const edgeKey = [def.id, adjacentId].sort().join(":");
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);

        const adjacent = this.territoryDefMap.get(adjacentId);
        if (!adjacent) continue;

        const touchesSelection = this.selectedTerritory === def.id || this.selectedTerritory === adjacentId;
        const touchesValidTarget = this.validTargets.has(def.id) || this.validTargets.has(adjacentId);
        const isAttackLine = this.state?.turnPhase === "attack" && touchesSelection && touchesValidTarget;
        const lineColor = isAttackLine ? RED_700 : touchesSelection ? ACCENT_BLUE : BORDER_LIGHT;
        const lineAlpha = isAttackLine ? 0.4 : touchesSelection ? 0.28 : 0.12;
        const lineWidth = isAttackLine ? Math.max(2, this.mapScale * 2.4) : Math.max(1, this.mapScale * 1.2);

        // Check for connection overrides (wrap-around lines)
        const override = this.mapDef.connectionOverrides.find(
          (c) => (c.from === def.id && c.to === adjacentId) || (c.from === adjacentId && c.to === def.id),
        );

        if (override?.waypoints && override.waypoints.length > 0) {
          const fromX = this.mapOffsetX + (def.labelX * this.mapScale);
          const fromY = this.mapOffsetY + (def.labelY * this.mapScale);
          this.connectionLayer.moveTo(fromX, fromY);
          for (const wp of override.waypoints) {
            this.connectionLayer.lineTo(this.mapOffsetX + (wp.x * this.mapScale), this.mapOffsetY + (wp.y * this.mapScale));
          }
          const toX = this.mapOffsetX + (adjacent.labelX * this.mapScale);
          const toY = this.mapOffsetY + (adjacent.labelY * this.mapScale);
          this.connectionLayer.lineTo(toX, toY);
        } else {
          const fromX = this.mapOffsetX + (def.labelX * this.mapScale);
          const fromY = this.mapOffsetY + (def.labelY * this.mapScale);
          const toX = this.mapOffsetX + (adjacent.labelX * this.mapScale);
          const toY = this.mapOffsetY + (adjacent.labelY * this.mapScale);
          this.connectionLayer.moveTo(fromX, fromY);
          this.connectionLayer.lineTo(toX, toY);
        }

        this.connectionLayer.stroke({ color: lineColor, width: lineWidth, alpha: lineAlpha });
      }
    }
  }

  private updateHUD(): void {
    const armiesToPlace = this.getArmiesToPlace();
    const currentTurnColors = this.state?.currentTurn ? this.getPlayerColorSetForSessionId(this.state.currentTurn) : null;
    const bottomY = this.mapOffsetY + (this.mapDef.viewBoxHeight * this.mapScale) + 20;

    // Combined status line: "[Player]'s Turn - [PHASE] Phase"
    const { turnText, phaseText } = this.getCombinedTurnPhaseText();
    this.statusText.text = turnText;
    this.statusText.style.fill = currentTurnColors?.text ?? TEXT_PRIMARY;

    this.phaseText.text = phaseText;
    this.phaseText.style.fill = phaseText.length > 0 ? TEXT_SECONDARY : TEXT_MUTED;

    // Turn indicator dot (will pulse via updateTurnIndicatorPulse)
    this.turnIndicator.clear();
    this.turnIndicator
      .circle(0, 0, 7)
      .fill({ color: currentTurnColors?.bg ?? STATUS_INGAME, alpha: 1 });

    this.armiesToPlaceText.text = armiesToPlace > 0 ? `Armies to deploy: ${armiesToPlace}` : "";
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
        .stroke({ color: ACCENT_BLUE, width: 1.2, alpha: 0.44 });
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
      .stroke({ color: ACCENT_BLUE, width: 1.4, alpha: hovered ? 0.72 : 0.5 });

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
      .stroke({ color: enabled ? ACCENT_BLUE : BORDER_LIGHT, width: 1.2, alpha: hovered ? 0.64 : 0.4 });

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
        ${getTurnClockMarkup(this.turnClockSeconds, this.showTurnClock)}
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

    const selectedTerritory = this.selectedTerritory ? this.territoryDefMap.get(this.selectedTerritory) : null;
    const selectedCopy = selectedTerritory ? `Selected: ${selectedTerritory.name}.` : "Select a territory on the board for context.";

    const isMyTurn = this.state.currentTurn === this.room?.sessionId;
    const isCaptureMove = this.state.turnPhase === "capture-move" && isMyTurn;

    if (isCaptureMove) {
      const fromName = this.territoryDefMap.get(this.state.captureFromId)?.name ?? this.state.captureFromId;
      const toName = this.territoryDefMap.get(this.state.captureToId)?.name ?? this.state.captureToId;
      const fromTerritory = this.state.territories?.get(this.state.captureFromId);
      const minMove = this.state.captureDiceCount;
      const maxMove = Math.max(minMove, (fromTerritory?.armyCount ?? 1) - 1);

      this.sidebar.updatePanel(
        "controls",
        `<div class="sidebar-note" style="margin-bottom:8px;">Move armies from <strong>${escapeHtml(fromName)}</strong> to <strong>${escapeHtml(toName)}</strong>.</div>
        <div class="sidebar-button-group" style="align-items:center; gap:6px;">
          <button type="button" class="sidebar-button sidebar-button--secondary" data-action="capture-dec" style="width:36px; min-width:36px; padding:0;">−</button>
          <span data-role="capture-count" style="font-size:1.1em; font-weight:600; min-width:32px; text-align:center;">${minMove}</span>
          <button type="button" class="sidebar-button sidebar-button--secondary" data-action="capture-inc" style="width:36px; min-width:36px; padding:0;">+</button>
          <button type="button" class="sidebar-button" data-action="capture-confirm">Move</button>
        </div>
        <div class="sidebar-note" style="margin-top:4px;">Min: ${minMove} / Max: ${maxMove}</div>`,
      );

      let captureCount = minMove;
      const controlsPanel = this.sidebar.getPanelContent("controls");
      const countDisplay = controlsPanel?.querySelector('[data-role="capture-count"]');

      const updateCount = (newCount: number) => {
        captureCount = Math.max(minMove, Math.min(maxMove, newCount));
        if (countDisplay) {
          countDisplay.textContent = String(captureCount);
        }
      };

      const decBtn = controlsPanel?.querySelector('[data-action="capture-dec"]');
      if (decBtn instanceof HTMLButtonElement) {
        decBtn.onclick = () => updateCount(captureCount - 1);
      }
      const incBtn = controlsPanel?.querySelector('[data-action="capture-inc"]');
      if (incBtn instanceof HTMLButtonElement) {
        incBtn.onclick = () => updateCount(captureCount + 1);
      }
      const confirmBtn = controlsPanel?.querySelector('[data-action="capture-confirm"]');
      if (confirmBtn instanceof HTMLButtonElement) {
        confirmBtn.onclick = () => {
          if (this.actionPending) return;
          this.actionPending = true;
          confirmBtn.disabled = true;
          confirmBtn.textContent = "Moving…";
          this.room?.send("captureMove", { count: captureCount });
        };
      }
      return;
    }

    this.sidebar.updatePanel(
      "controls",
      `<div class="sidebar-button-group">
        <button type="button" class="sidebar-button" data-action="end-phase"${this.canEndPhase() && !this.actionPending ? "" : " disabled"}>${this.state.turnPhase === "fortify" ? "End Turn" : "Next Phase"}</button>
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="fortify"${this.canEnterFortify() && !this.actionPending ? "" : " disabled"}>Fortify</button>
        <button type="button" class="sidebar-button sidebar-button--secondary" data-action="trade-cards"${this.canTradeCards() && !this.actionPending ? "" : " disabled"}>Trade Cards${myRiskPlayer ? ` (${myRiskPlayer.cardsHeld})` : ""}</button>
      </div>
      <div class="sidebar-note">${escapeHtml(selectedCopy)} Place armies, attack, and move units directly on the redesigned map cards.</div>`,
    );

    const controlsPanel = this.sidebar.getPanelContent("controls");
    const endPhaseButton = controlsPanel?.querySelector('[data-action="end-phase"]');
    if (endPhaseButton instanceof HTMLButtonElement) {
      endPhaseButton.onclick = () => {
        if (this.canEndPhase() && !this.actionPending) {
          this.actionPending = true;
          this.handleEndPhase();
          this.updateSidebar();
        }
      };
    }

    const fortifyButton = controlsPanel?.querySelector('[data-action="fortify"]');
    if (fortifyButton instanceof HTMLButtonElement) {
      fortifyButton.onclick = () => {
        if (this.canEnterFortify() && !this.actionPending) {
          this.actionPending = true;
          this.handleEndPhase();
          this.updateSidebar();
        }
      };
    }

    const tradeCardsButton = controlsPanel?.querySelector('[data-action="trade-cards"]');
    if (tradeCardsButton instanceof HTMLButtonElement) {
      tradeCardsButton.onclick = () => {
        if (this.canTradeCards() && !this.actionPending) {
          this.actionPending = true;
          this.handleTradeCards();
          this.updateSidebar();
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

    if (this.actionPending) return;

    if (this.state.turnPhase === "setup-pick") {
      const territory = this.state.territories?.get(territoryId);
      if (territory && territory.owner === "") {
        this.actionPending = true;
        this.room.send("pickTerritory", { territoryId });
        this.clearSelection();
      }
      return;
    }

    if (this.state.turnPhase === "setup-place" || this.state.turnPhase === "reinforce") {
      if (canPlaceArmy(this.state, territoryId, sessionId)) {
        this.actionPending = true;
        this.room.send("placeArmy", { territoryId });
        this.clearSelection();
      }
      return;
    }

    if (this.state.turnPhase === "attack") {
      if (this.selectedTerritory) {
        if (this.validTargets.has(territoryId)) {
          this.actionPending = true;
          this.room.send("attack", {
            from: this.selectedTerritory,
            to: territoryId,
            attackerDice: 3,
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

    if (this.state.turnPhase === "capture-move") {
      // Territory clicks disabled — army movement is handled via sidebar controls
      return;
    }

    if (this.state.turnPhase === "fortify") {
      if (this.selectedTerritory) {
        if (this.validTargets.has(territoryId)) {
          this.actionPending = true;
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
    const selectedLayout = this.selectedTerritory ? this.territoryDefMap.get(this.selectedTerritory) : undefined;
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
      "capture-move": "Move Armies Into Captured Territory",
      fortify: "Fortify Phase",
    };

    return phaseLabels[turnPhase] ?? turnPhase;
  }

  private getCombinedTurnPhaseText(): { turnText: string; phaseText: string } {
    if (!this.state) {
      return { turnText: "Waiting for game", phaseText: "" };
    }

    const sessionId = this.room?.sessionId;
    const currentTurn = this.state.currentTurn;
    if (!sessionId || !currentTurn) {
      return { turnText: "Waiting for players", phaseText: "" };
    }

    const playerName = this.getDisplayName(currentTurn);
    const turnPhase = this.state.turnPhase;
    const phaseMap: Record<string, string> = {
      "setup-pick": "SETUP",
      "setup-place": "SETUP",
      reinforce: "REINFORCE",
      attack: "ATTACK",
      "capture-move": "ATTACK",
      fortify: "FORTIFY",
    };

    const phaseUpper = phaseMap[turnPhase ?? ""] ?? (turnPhase ?? "").toUpperCase();
    const turnText = `${playerName}'s Turn - ${phaseUpper} Phase`;

    // Show armies to deploy count if in reinforce phase
    const armiesToPlace = this.getArmiesToPlace();
    const phaseText = turnPhase === "reinforce" && armiesToPlace > 0 
      ? `Armies to deploy: ${armiesToPlace}` 
      : "";

    return { turnText, phaseText };
  }

  private updateTurnIndicatorPulse(): void {
    if (!this.state?.currentTurn) {
      return;
    }

    // Pulse animation: scale from 1.0 to 1.15 and back (2 second cycle)
    const pulseSpeed = 2000; // milliseconds per full cycle
    const t = (this.turnIndicatorPulseTime % pulseSpeed) / pulseSpeed;
    const scale = 1 + 0.15 * Math.sin(t * Math.PI * 2);
    
    this.turnIndicator.scale.set(scale);
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

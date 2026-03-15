import type { Room } from "@colyseus/sdk";
import type { RiskState } from "@eschaton/shared";
import { Container, Graphics, Text } from "pixi.js";
import type { GameRenderer, GameRendererContext, RendererInputEvent } from "./GameRenderer";
import { canPlaceArmy, canSelectForAttack, canSelectForFortify } from "../games/risk/riskClientLogic";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const VIEW_PADDING = 24;
const TOP_HUD_SPACE = 104;
const BOTTOM_HUD_SPACE = 80;

const CONTINENT_COLORS: Record<string, number> = {
  "north-america": 0xf4e04d,
  "south-america": 0xe63946,
  "europe": 0x3a86ff,
  "africa": 0xff6b35,
  "asia": 0x06d6a0,
  "australia": 0xb56576,
};

const PLAYER_COLORS = [
  0xff3333,
  0x3366ff,
  0x33cc33,
  0xff9933,
  0xcc33ff,
  0x33cccc,
];

const TERRITORY_STROKE = 0x333333;
const SELECTED_TERRITORY_COLOR = 0xffd700;
const VALID_TARGET_COLOR = 0x53d769;
const TEXT_COLOR = 0xffffff;
const SUBTLE_TEXT_COLOR = 0xd7d9df;
const TURN_READY_COLOR = 0x53d769;
const TURN_WAITING_COLOR = 0xc0c4cf;
const BUTTON_COLOR = 0x4a90e2;
const BUTTON_HOVER_COLOR = 0x357abd;
const BUTTON_DISABLED_COLOR = 0x666666;

interface TerritoryLayout {
  id: string;
  name: string;
  continent: string;
  x: number;
  y: number;
  adjacentTo: string[];
}

const TERRITORY_LAYOUTS: TerritoryLayout[] = [
  // North America (top-left, 9 territories)
  { id: "alaska", name: "Alaska", continent: "north-america", x: 80, y: 100, adjacentTo: ["northwest-territory", "alberta", "kamchatka"] },
  { id: "northwest-territory", name: "NW Territory", continent: "north-america", x: 160, y: 80, adjacentTo: ["alaska", "alberta", "ontario", "greenland"] },
  { id: "greenland", name: "Greenland", continent: "north-america", x: 300, y: 60, adjacentTo: ["northwest-territory", "ontario", "quebec", "iceland"] },
  { id: "alberta", name: "Alberta", continent: "north-america", x: 120, y: 150, adjacentTo: ["alaska", "northwest-territory", "ontario", "western-united-states"] },
  { id: "ontario", name: "Ontario", continent: "north-america", x: 180, y: 140, adjacentTo: ["northwest-territory", "alberta", "greenland", "quebec", "western-united-states", "eastern-united-states"] },
  { id: "quebec", name: "Quebec", continent: "north-america", x: 240, y: 130, adjacentTo: ["ontario", "greenland", "eastern-united-states"] },
  { id: "western-united-states", name: "W USA", continent: "north-america", x: 120, y: 200, adjacentTo: ["alberta", "ontario", "eastern-united-states", "central-america"] },
  { id: "eastern-united-states", name: "E USA", continent: "north-america", x: 190, y: 200, adjacentTo: ["ontario", "quebec", "western-united-states", "central-america"] },
  { id: "central-america", name: "C America", continent: "north-america", x: 140, y: 260, adjacentTo: ["western-united-states", "eastern-united-states", "venezuela"] },
  
  // South America (left-center, 4 territories)
  { id: "venezuela", name: "Venezuela", continent: "south-america", x: 200, y: 310, adjacentTo: ["central-america", "peru", "brazil"] },
  { id: "peru", name: "Peru", continent: "south-america", x: 180, y: 370, adjacentTo: ["venezuela", "brazil", "argentina"] },
  { id: "brazil", name: "Brazil", continent: "south-america", x: 240, y: 360, adjacentTo: ["venezuela", "peru", "argentina", "north-africa"] },
  { id: "argentina", name: "Argentina", continent: "south-america", x: 200, y: 430, adjacentTo: ["peru", "brazil"] },
  
  // Europe (center-top, 7 territories)
  { id: "iceland", name: "Iceland", continent: "europe", x: 360, y: 90, adjacentTo: ["greenland", "great-britain", "scandinavia"] },
  { id: "great-britain", name: "GB", continent: "europe", x: 360, y: 140, adjacentTo: ["iceland", "scandinavia", "northern-europe", "western-europe"] },
  { id: "scandinavia", name: "Scandinavia", continent: "europe", x: 430, y: 100, adjacentTo: ["iceland", "great-britain", "northern-europe", "ukraine"] },
  { id: "western-europe", name: "W Europe", continent: "europe", x: 360, y: 200, adjacentTo: ["great-britain", "northern-europe", "southern-europe", "north-africa"] },
  { id: "northern-europe", name: "N Europe", continent: "europe", x: 430, y: 160, adjacentTo: ["great-britain", "scandinavia", "ukraine", "southern-europe", "western-europe"] },
  { id: "southern-europe", name: "S Europe", continent: "europe", x: 430, y: 210, adjacentTo: ["western-europe", "northern-europe", "ukraine", "north-africa", "egypt", "middle-east"] },
  { id: "ukraine", name: "Ukraine", continent: "europe", x: 500, y: 130, adjacentTo: ["scandinavia", "northern-europe", "southern-europe", "ural", "afghanistan", "middle-east"] },
  
  // Africa (center-bottom, 6 territories)
  { id: "north-africa", name: "N Africa", continent: "africa", x: 380, y: 280, adjacentTo: ["brazil", "western-europe", "southern-europe", "egypt", "east-africa", "congo"] },
  { id: "egypt", name: "Egypt", continent: "africa", x: 450, y: 270, adjacentTo: ["north-africa", "southern-europe", "middle-east", "east-africa"] },
  { id: "east-africa", name: "E Africa", continent: "africa", x: 480, y: 330, adjacentTo: ["north-africa", "egypt", "middle-east", "congo", "south-africa", "madagascar"] },
  { id: "congo", name: "Congo", continent: "africa", x: 420, y: 360, adjacentTo: ["north-africa", "east-africa", "south-africa"] },
  { id: "south-africa", name: "S Africa", continent: "africa", x: 450, y: 420, adjacentTo: ["congo", "east-africa", "madagascar"] },
  { id: "madagascar", name: "Madagascar", continent: "africa", x: 520, y: 420, adjacentTo: ["east-africa", "south-africa"] },
  
  // Asia (right-top, 12 territories)
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
  
  // Australia (right-bottom, 4 territories)
  { id: "indonesia", name: "Indonesia", continent: "australia", x: 680, y: 330, adjacentTo: ["siam", "new-guinea", "western-australia"] },
  { id: "new-guinea", name: "New Guinea", continent: "australia", x: 740, y: 340, adjacentTo: ["indonesia", "western-australia", "eastern-australia"] },
  { id: "western-australia", name: "W Australia", continent: "australia", x: 700, y: 400, adjacentTo: ["indonesia", "new-guinea", "eastern-australia"] },
  { id: "eastern-australia", name: "E Australia", continent: "australia", x: 760, y: 400, adjacentTo: ["new-guinea", "western-australia"] },
];

export class RiskRenderer implements GameRenderer {
  readonly gameType = "risk";
  readonly container = new Container();

  private readonly mapLayer = new Container();
  private readonly territoryLayer = new Container();
  private readonly hudLayer = new Container();
  
  private readonly statusText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 24,
      fontWeight: "700",
      fill: TURN_WAITING_COLOR,
      align: "center",
    },
  });
  
  private readonly phaseText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 18,
      fontWeight: "600",
      fill: SUBTLE_TEXT_COLOR,
      align: "center",
    },
  });
  
  private readonly armiesToPlaceText = new Text({
    text: "",
    style: {
      fontFamily: "sans-serif",
      fontSize: 18,
      fontWeight: "600",
      fill: TEXT_COLOR,
    },
  });

  private readonly endPhaseButton = new Container();
  private readonly endPhaseButtonBg = new Graphics();
  private readonly endPhaseButtonText = new Text({
    text: "End Phase",
    style: {
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: "600",
      fill: TEXT_COLOR,
    },
  });

  private readonly tradeCardsButton = new Container();
  private readonly tradeCardsButtonBg = new Graphics();
  private readonly tradeCardsButtonText = new Text({
    text: "Trade Cards",
    style: {
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: "600",
      fill: TEXT_COLOR,
    },
  });

  private room: Room | null = null;
  private state: RiskState | null = null;
  private selectedTerritory: string | null = null;
  private validTargets = new Set<string>();
  private width = DEFAULT_WIDTH;
  private height = DEFAULT_HEIGHT;
  private mapScale = 1;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  private territoryGraphics = new Map<string, Graphics>();
  private isEndPhaseButtonHovered = false;
  private isTradeCardsButtonHovered = false;

  constructor() {
    this.statusText.anchor.set(0.5);
    this.phaseText.anchor.set(0.5);
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

    this.hudLayer.addChild(
      this.statusText,
      this.phaseText,
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
    this.validTargets.clear();
    this.createTerritories();
    this.layout();
    this.redrawMap();
    this.updateHUD();
  }

  onStateChange(state: unknown): void {
    this.state = state as RiskState;
    this.syncSelectionWithState();
    this.redrawMap();
    this.updateHUD();
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

  destroy(): void {
    this.room = null;
    this.state = null;
    this.territoryGraphics.clear();
    this.validTargets.clear();
    this.container.destroy({ children: true });
  }

  private createTerritories(): void {
    this.territoryGraphics.clear();
    this.territoryLayer.removeChildren();

    for (const layout of TERRITORY_LAYOUTS) {
      const graphic = new Graphics();
      graphic.eventMode = "static";
      graphic.cursor = "pointer";
      graphic.on("pointertap", () => this.handleTerritoryClick(layout.id));
      
      this.territoryGraphics.set(layout.id, graphic);
      this.territoryLayer.addChild(graphic);
    }
  }

  private layout(): void {
    const availableWidth = this.width - (VIEW_PADDING * 2);
    const availableHeight = this.height - TOP_HUD_SPACE - BOTTOM_HUD_SPACE;
    
    const mapWidth = 840;
    const mapHeight = 500;
    
    const scaleX = availableWidth / mapWidth;
    const scaleY = availableHeight / mapHeight;
    this.mapScale = Math.min(scaleX, scaleY, 1);
    
    const scaledMapWidth = mapWidth * this.mapScale;
    const scaledMapHeight = mapHeight * this.mapScale;
    
    this.mapOffsetX = (this.width - scaledMapWidth) / 2;
    this.mapOffsetY = TOP_HUD_SPACE + (availableHeight - scaledMapHeight) / 2;

    const statusCenterY = Math.max(34, this.mapOffsetY * 0.36);
    this.statusText.position.set(this.width / 2, statusCenterY);
    this.phaseText.position.set(this.width / 2, statusCenterY + 30);
    this.armiesToPlaceText.position.set(this.mapOffsetX, this.mapOffsetY + scaledMapHeight + 20);

    const buttonWidth = 120;
    const buttonHeight = 36;
    const buttonSpacing = 12;
    const buttonY = this.mapOffsetY + scaledMapHeight + 15;
    
    this.endPhaseButton.position.set(
      this.width - this.mapOffsetX - buttonWidth,
      buttonY
    );
    
    this.tradeCardsButton.position.set(
      this.width - this.mapOffsetX - (buttonWidth * 2) - buttonSpacing,
      buttonY
    );
  }

  private redrawMap(): void {
    if (!this.state) return;

    for (const layout of TERRITORY_LAYOUTS) {
      const graphic = this.territoryGraphics.get(layout.id);
      if (!graphic) continue;

      const territory = this.state.territories?.get(layout.id);
      const x = this.mapOffsetX + (layout.x * this.mapScale);
      const y = this.mapOffsetY + (layout.y * this.mapScale);
      const radius = 28 * this.mapScale;

      graphic.clear();

      let fillColor = CONTINENT_COLORS[layout.continent] ?? 0x888888;
      
      if (territory?.owner) {
        const playerIndex = this.getPlayerIndex(territory.owner);
        if (playerIndex !== -1) {
          fillColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
        }
      }

      const isSelected = this.selectedTerritory === layout.id;
      const isValidTarget = this.validTargets.has(layout.id);

      graphic.circle(x, y, radius).fill(fillColor);
      
      if (isSelected) {
        graphic.circle(x, y, radius).stroke({
          color: SELECTED_TERRITORY_COLOR,
          width: Math.max(3, radius * 0.12),
        });
      } else if (isValidTarget) {
        graphic.circle(x, y, radius).stroke({
          color: VALID_TARGET_COLOR,
          width: Math.max(2, radius * 0.1),
        });
      } else {
        graphic.circle(x, y, radius).stroke({
          color: TERRITORY_STROKE,
          width: Math.max(1, radius * 0.05),
        });
      }

      const armyCount = territory?.armyCount ?? 0;
      if (armyCount > 0) {
        const armyText = new Text({
          text: String(armyCount),
          style: {
            fontFamily: "sans-serif",
            fontSize: Math.max(12, radius * 0.5),
            fontWeight: "700",
            fill: TEXT_COLOR,
            align: "center",
          },
        });
        armyText.anchor.set(0.5);
        armyText.position.set(x, y);
        graphic.addChild(armyText);
      }

      const nameText = new Text({
        text: layout.name,
        style: {
          fontFamily: "sans-serif",
          fontSize: Math.max(8, radius * 0.25),
          fontWeight: "500",
          fill: 0x000000,
          align: "center",
        },
      });
      nameText.anchor.set(0.5);
      nameText.position.set(x, y + radius + (6 * this.mapScale));
      graphic.addChild(nameText);
    }
  }

  private updateHUD(): void {
    if (!this.state) return;

    const { text: statusLabel, color: statusColor } = this.getStatusLabel();
    this.statusText.text = statusLabel;
    this.statusText.style.fill = statusColor;

    this.phaseText.text = this.getPhaseLabel();
    
    const armiesToPlace = this.getArmiesToPlace();
    this.armiesToPlaceText.text = armiesToPlace > 0 ? `Armies to place: ${armiesToPlace}` : "";
    this.armiesToPlaceText.visible = armiesToPlace > 0;

    this.updateButtons();
  }

  private updateButtons(): void {
    if (!this.state) return;

    const sessionId = this.room?.sessionId ?? "";
    const isMyTurn = this.state.currentTurn === sessionId;
    
    const canEndPhase = isMyTurn && (
      this.state.turnPhase === "attack" ||
      this.state.turnPhase === "fortify" ||
      (this.state.turnPhase === "reinforce" && this.getArmiesToPlace() === 0)
    );

    const riskPlayer = this.state.riskPlayers?.get(sessionId);
    const canTradeCards = isMyTurn && 
      this.state.turnPhase === "reinforce" && 
      (riskPlayer?.cardsHeld ?? 0) >= 3;

    const buttonWidth = 120;
    const buttonHeight = 36;
    const buttonRadius = 4;

    this.endPhaseButtonBg.clear();
    this.endPhaseButtonBg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, buttonRadius);
    
    if (!canEndPhase) {
      this.endPhaseButtonBg.fill(BUTTON_DISABLED_COLOR);
      this.endPhaseButton.eventMode = "none";
      this.endPhaseButton.cursor = "default";
    } else {
      const color = this.isEndPhaseButtonHovered ? BUTTON_HOVER_COLOR : BUTTON_COLOR;
      this.endPhaseButtonBg.fill(color);
      this.endPhaseButton.eventMode = "static";
      this.endPhaseButton.cursor = "pointer";
    }

    this.tradeCardsButtonBg.clear();
    this.tradeCardsButtonBg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, buttonRadius);
    
    if (!canTradeCards) {
      this.tradeCardsButtonBg.fill(BUTTON_DISABLED_COLOR);
      this.tradeCardsButton.eventMode = "none";
      this.tradeCardsButton.cursor = "default";
      this.tradeCardsButton.visible = false;
    } else {
      const color = this.isTradeCardsButtonHovered ? BUTTON_HOVER_COLOR : BUTTON_COLOR;
      this.tradeCardsButtonBg.fill(color);
      this.tradeCardsButton.eventMode = "static";
      this.tradeCardsButton.cursor = "pointer";
      this.tradeCardsButton.visible = true;
    }
  }

  private handleTerritoryClick(territoryId: string): void {
    if (!this.state || !this.room) return;

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
      return;
    }
  }

  private handleEndPhase(): void {
    if (!this.room) return;
    this.room.send("endPhase", {});
    this.clearSelection();
  }

  private handleTradeCards(): void {
    if (!this.room) return;
    this.room.send("tradeCards", {});
  }

  private setSelection(territoryId: string): void {
    this.selectedTerritory = territoryId;
    this.updateValidTargets();
    this.redrawMap();
  }

  private clearSelection(): void {
    this.selectedTerritory = null;
    this.validTargets.clear();
    this.redrawMap();
  }

  private syncSelectionWithState(): void {
    if (!this.selectedTerritory || !this.state) return;

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
    
    if (!this.selectedTerritory || !this.state) return;

    const sessionId = this.room?.sessionId ?? "";
    const selectedLayout = TERRITORY_LAYOUTS.find(t => t.id === this.selectedTerritory);
    
    if (!selectedLayout) return;

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
      return { text: "Waiting for game", color: TURN_WAITING_COLOR };
    }

    const sessionId = this.room?.sessionId ?? "";
    const isMyTurn = this.state.currentTurn === sessionId;

    if (isMyTurn) {
      return { text: "Your turn", color: TURN_READY_COLOR };
    }

    return { text: "Opponent's turn", color: TURN_WAITING_COLOR };
  }

  private getPhaseLabel(): string {
    if (!this.state) return "";

    const phaseLabels: Record<string, string> = {
      "setup-pick": "Setup: Pick Territories",
      "setup-place": "Setup: Place Armies",
      "reinforce": "Reinforce Phase",
      "attack": "Attack Phase",
      "fortify": "Fortify Phase",
    };

    return phaseLabels[this.state.turnPhase] ?? this.state.turnPhase;
  }

  private getArmiesToPlace(): number {
    if (!this.state || !this.room) return 0;
    
    const sessionId = this.room.sessionId;
    const riskPlayer = this.state.riskPlayers?.get(sessionId);
    
    return riskPlayer?.armiesToPlace ?? 0;
  }

  private getPlayerIndex(sessionId: string): number {
    if (!this.state) return -1;

    const playersList = Array.from(this.state.players?.values() ?? []);
    const index = playersList.findIndex(p => p.sessionId === sessionId);
    
    return index;
  }
}

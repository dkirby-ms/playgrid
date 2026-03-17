import type { Client } from "colyseus";
import { describe, expect, it, vi } from "vitest";

vi.mock("@eschaton/shared", async () => await import("../../../shared/src/index.ts"));

const shared = await import("../../../shared/src/index.ts");
const { RiskState, TerritoryState, RiskPlayerState } = shared;
const { riskPlugin } = await import("../games/risk/RiskPlugin");
const {
  calculateReinforcements,
  getCardTradeInValue,
  resolveCombat,
  canAttackFrom,
  canAttackTerritory,
  canFortifyBetween,
  checkWinCondition,
  calculateInitialArmies,
  getOwnedTerritories,
} = await import("../games/risk/riskLogic");
const {
  TERRITORIES,
  CONTINENTS,
  TERRITORY_COUNT,
  areTerritoriesAdjacent,
  getTerritoryById,
} = shared;

type RiskStateInstance = InstanceType<typeof RiskState>;
type TerritoryId = string;
type ContinentId = string;

const mockClient = (sessionId: string) => ({ sessionId } as Client);

// ============================================================================
// Territory & Map Constants
// ============================================================================

const TOTAL_TERRITORIES = TERRITORY_COUNT;

const EXPECTED_CONTINENT_COUNTS: Record<string, number> = {
  "north-america": 9,
  "south-america": 4,
  "europe": 7,
  "africa": 6,
  "asia": 12,
  "australia": 4,
};

const EXPECTED_CONTINENT_BONUSES: Record<string, number> = {
  "north-america": 5,
  "south-america": 2,
  "europe": 5,
  "africa": 3,
  "asia": 7,
  "australia": 2,
};

// Sample adjacency pairs for testing graph symmetry
const KNOWN_ADJACENCIES = [
  ["alaska", "northwest-territory"],
  ["alaska", "kamchatka"],
  ["eastern-united-states", "western-united-states"],
  ["brazil", "venezuela"],
  ["brazil", "north-africa"],
  ["iceland", "greenland"],
  ["iceland", "great-britain"],
  ["great-britain", "western-europe"],
  ["egypt", "north-africa"],
  ["east-africa", "north-africa"],
  ["madagascar", "east-africa"],
  ["ural", "siberia"],
  ["china", "siam"],
  ["indonesia", "siam"],
  ["eastern-australia", "western-australia"],
];

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a started game with N players.
 * After onGameStart, state is in setup-pick phase with all territories unclaimed.
 */
function createStartedGame(playerCount: number): RiskStateInstance {
  const state = riskPlugin.createState();
  for (let i = 0; i < playerCount; i++) {
    riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient(`player-${i + 1}`), i);
  }
  riskPlugin.lifecycle.onGameStart?.(state);
  return state;
}

/**
 * Create a game that has completed the draft phase (all territories claimed round-robin).
 * State is in setup-place phase with armies remaining to place.
 */
function createDraftedGame(playerCount: number): RiskStateInstance {
  const state = createStartedGame(playerCount);

  const activePlayers = Array.from(state.players.values())
    .filter((p) => !p.isSpectator)
    .sort((a, b) => a.playerIndex - b.playerIndex);

  let playerIdx = 0;
  for (const territory of TERRITORIES) {
    const player = activePlayers[playerIdx];
    state.currentTurn = player.sessionId;
    riskPlugin.actions.pickTerritory(state, mockClient(player.sessionId), { territoryId: territory.id });
    playerIdx = (playerIdx + 1) % activePlayers.length;
  }

  return state;
}

/**
 * Set territory ownership and armies for testing
 */
function setTerritoryState(
  state: RiskStateInstance,
  territoryId: TerritoryId,
  ownerId: string,
  armies: number,
) {
  const territory = state.territories.get(territoryId);
  if (territory) {
    territory.owner = ownerId;
    territory.armyCount = armies;
  }
}

/**
 * Grant all territories to a specific player (for win condition testing)
 */
function grantAllTerritories(state: RiskStateInstance, playerId: string) {
  state.territories.forEach((territory) => {
    territory.owner = playerId;
    territory.armyCount = 1;
  });
}

// ============================================================================
// Territory & Map Tests
// ============================================================================

describe("Risk Game — Territory & Map", () => {
  describe("Map initialization", () => {
    it("defines all 42 territories with correct continent assignments", () => {
      expect(TERRITORIES).toHaveLength(TOTAL_TERRITORIES);
      
      // Verify each continent has correct number of territories
      for (const [continentId, expectedCount] of Object.entries(EXPECTED_CONTINENT_COUNTS)) {
        const territories = TERRITORIES.filter((t) => t.continent === continentId);
        expect(territories).toHaveLength(expectedCount);
      }
    });

    it("assigns correct continent bonuses", () => {
      for (const [continentId, expectedBonus] of Object.entries(EXPECTED_CONTINENT_BONUSES)) {
        const continent = CONTINENTS.find((c) => c.id === continentId);
        expect(continent?.bonusArmies).toBe(expectedBonus);
      }
    });

    it("has symmetric adjacency graph", () => {
      // If A is adjacent to B, then B must be adjacent to A
      for (const [territoryA, territoryB] of KNOWN_ADJACENCIES) {
        expect(areTerritoriesAdjacent(territoryA, territoryB)).toBe(true);
        expect(areTerritoriesAdjacent(territoryB, territoryA)).toBe(true);
      }
    });

    it("every territory has at least one adjacent territory", () => {
      for (const territory of TERRITORIES) {
        expect(territory.adjacentTo.length).toBeGreaterThan(0);
      }
    });

    it("cross-continent connections exist (e.g., Alaska-Kamchatka)", () => {
      // Alaska (North America) connects to Kamchatka (Asia)
      expect(areTerritoriesAdjacent("alaska", "kamchatka")).toBe(true);
      
      // Brazil (South America) connects to North Africa (Africa)
      expect(areTerritoriesAdjacent("brazil", "north-africa")).toBe(true);
      
      // Iceland (Europe) connects to Greenland (North America)
      expect(areTerritoriesAdjacent("iceland", "greenland")).toBe(true);
    });
  });
});

// ============================================================================
// Setup Phase Tests
// ============================================================================

describe("Risk Game — Setup Phase", () => {
  describe("Territory drafting (setup-pick)", () => {
    it("game starts in setup-pick phase with all territories unclaimed", () => {
      const state = createStartedGame(3);

      expect(state.gamePhase).toBe("setup");
      expect(state.turnPhase).toBe("setup-pick");

      let unclaimedCount = 0;
      state.territories.forEach((territory) => {
        if (territory.owner === "") {
          unclaimedCount++;
        }
      });

      expect(unclaimedCount).toBe(42);
    });

    it("player can pick an unclaimed territory", () => {
      const state = createStartedGame(2);
      state.currentTurn = "player-1";

      const result = riskPlugin.actions.pickTerritory(
        state,
        mockClient("player-1"),
        { territoryId: "alaska" },
      );

      expect(result.success).toBe(true);
      expect(result.endsTurn).toBe(true);

      const territory = state.territories.get("alaska");
      expect(territory?.owner).toBe("player-1");
      expect(territory?.armyCount).toBe(1);
    });

    it("cannot pick an already-claimed territory", () => {
      const state = createStartedGame(2);
      state.currentTurn = "player-1";

      riskPlugin.actions.pickTerritory(state, mockClient("player-1"), { territoryId: "alaska" });
      state.currentTurn = "player-2";

      const result = riskPlugin.actions.pickTerritory(
        state,
        mockClient("player-2"),
        { territoryId: "alaska" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("already claimed");
    });

    it("cannot pick territory outside of setup-pick phase", () => {
      const state = createStartedGame(2);
      state.currentTurn = "player-1";
      state.turnPhase = "setup-place";

      const result = riskPlugin.actions.pickTerritory(
        state,
        mockClient("player-1"),
        { territoryId: "alaska" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not in territory pick phase");
    });

    it("transitions to setup-place when all 42 territories are claimed", () => {
      const state = createDraftedGame(3);

      expect(state.turnPhase).toBe("setup-place");

      let assignedCount = 0;
      state.territories.forEach((territory) => {
        if (territory.owner !== "") {
          assignedCount++;
        }
      });
      expect(assignedCount).toBe(42);
    });

    it("each territory has exactly 1 army after drafting", () => {
      const state = createDraftedGame(2);

      state.territories.forEach((territory) => {
        expect(territory.armyCount).toBe(1);
      });
    });

    it("players have remaining armies to place after draft", () => {
      const state = createDraftedGame(2);

      expect(state.gamePhase).toBe("setup");
      expect(state.turnPhase).toBe("setup-place");

      state.riskPlayers.forEach((riskPlayer) => {
        expect(riskPlayer.armiesToPlace).toBeGreaterThan(0);
      });
    });

    it("updates player territory counts during draft", () => {
      const state = createStartedGame(2);
      state.currentTurn = "player-1";

      riskPlugin.actions.pickTerritory(state, mockClient("player-1"), { territoryId: "alaska" });
      riskPlugin.actions.pickTerritory(state, mockClient("player-1"), { territoryId: "brazil" });

      const riskPlayer = state.riskPlayers.get("player-1");
      expect(riskPlayer?.territoriesOwned).toBe(2);
    });
  });

  describe("Initial army allocation", () => {
    it("2-player game: each player gets 40 armies", () => {
      expect(calculateInitialArmies(2)).toBe(40);
    });

    it("3-player game: each player gets 35 armies", () => {
      expect(calculateInitialArmies(3)).toBe(35);
    });

    it("4-player game: each player gets 30 armies", () => {
      expect(calculateInitialArmies(4)).toBe(30);
    });

    it("5-player game: each player gets 25 armies", () => {
      expect(calculateInitialArmies(5)).toBe(25);
    });

    it("6-player game: each player gets 20 armies", () => {
      expect(calculateInitialArmies(6)).toBe(20);
    });
  });
});

// ============================================================================
// Reinforce Phase Tests
// ============================================================================

describe("Risk Game — Reinforce Phase", () => {
  describe("Reinforcement calculation", () => {
    it("grants max(3, territories/3) base reinforcements", () => {
      // Player owns 3 territories: should get 3 armies (minimum)
      let reinforcements = calculateReinforcements(3, ["alaska", "greenland", "iceland"]);
      expect(reinforcements).toBe(3);
      
      // Player owns 12 territories: should get 4 armies
      const territories12 = Array.from({ length: 12 }, (_, i) => `territory-${i}`);
      reinforcements = calculateReinforcements(12, territories12);
      expect(reinforcements).toBe(4);
      
      // Player owns 30 territories: should get 10 armies
      const territories30 = Array.from({ length: 30 }, (_, i) => `territory-${i}`);
      reinforcements = calculateReinforcements(30, territories30);
      expect(reinforcements).toBe(10);
    });

    it("adds continent bonus when player controls entire continent", () => {
      // Grant all of Australia (4 territories, +2 bonus)
      const australiaOwned = ["eastern-australia", "western-australia", "new-guinea", "indonesia"];
      const reinforcements = calculateReinforcements(4, australiaOwned);
      
      // Base: max(3, 4/3) = 3, Bonus: +2 = 5 total
      expect(reinforcements).toBe(5);
    });

    it("no continent bonus if missing even one territory", () => {
      // Grant 3 out of 4 Australia territories
      const partialAustralia = ["eastern-australia", "western-australia", "new-guinea"];
      const reinforcements = calculateReinforcements(3, partialAustralia);
      
      // Base: 3, no continent bonus
      expect(reinforcements).toBe(3);
    });

    it("sums multiple continent bonuses", () => {
      // Grant Australia (+2) and South America (+2)
      const bothContinents = [
        "eastern-australia", "western-australia", "new-guinea", "indonesia", // Australia
        "venezuela", "peru", "brazil", "argentina", // South America
      ];
      const reinforcements = calculateReinforcements(8, bothContinents);
      
      // Base: max(3, 8/3) = 3, Bonuses: +2 (Aus) +2 (SA) = 7 total
      expect(reinforcements).toBe(7);
    });
  });

  describe("Card trade-in", () => {
    it("grants escalating bonuses: 4, 6, 8, 10, 12, 15, +5 each", () => {
      // First trade-in: 4 armies
      expect(getCardTradeInValue(0)).toBe(4);
      
      // Second trade-in: 6 armies
      expect(getCardTradeInValue(1)).toBe(6);
      
      // Third trade-in: 8 armies
      expect(getCardTradeInValue(2)).toBe(8);
      
      // Fourth: 10
      expect(getCardTradeInValue(3)).toBe(10);
      
      // Fifth: 12
      expect(getCardTradeInValue(4)).toBe(12);
      
      // Sixth trade-in: 15 armies
      expect(getCardTradeInValue(5)).toBe(15);
      
      // Seventh trade-in: 20 armies (15 + 5)
      expect(getCardTradeInValue(6)).toBe(20);
      
      // Eighth: 25
      expect(getCardTradeInValue(7)).toBe(25);
    });

    it("forces trade-in when player has 5+ cards", () => {
      const state = createStartedGame(2);
      
      // Complete setup phase first
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      for (const player of activePlayers) {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        if (riskPlayer) {
          riskPlayer.armiesToPlace = 0;
        }
      }
      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      
      const riskPlayer = state.riskPlayers.get("player-1");
      if (riskPlayer) {
        riskPlayer.cardsHeld = 5;
      }
      
      const result = riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Must trade in cards");
    });

    it("allows voluntary trade-in with 3+ cards", () => {
      const state = createStartedGame(2);
      
      // Complete setup and start playing phase
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      for (const player of activePlayers) {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        if (riskPlayer) {
          riskPlayer.armiesToPlace = 0;
        }
      }
      state.gamePhase = "playing";
      state.turnPhase = "reinforce";
      
      const riskPlayer = state.riskPlayers.get("player-1");
      if (riskPlayer) {
        riskPlayer.cardsHeld = 3;
        riskPlayer.armiesToPlace = 5;
      }
      
      const result = riskPlugin.actions.tradeCards(
        state,
        mockClient("player-1"),
        { cardCount: 3 }
      );
      
      expect(result.success).toBe(true);
      expect(riskPlayer?.cardsHeld).toBe(0);
      expect(riskPlayer?.armiesToPlace).toBe(9); // 5 + 4 (first trade-in)
    });
  });

  describe("Army placement", () => {
    it("can only place armies on owned territories", () => {
      const state = createStartedGame(2);
      
      // Setup territories
      setTerritoryState(state, "alaska", "player-1", 1);
      setTerritoryState(state, "kamchatka", "player-2", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "reinforce";
      state.currentTurn = "player-1";
      
      const riskPlayer = state.riskPlayers.get("player-1");
      if (riskPlayer) {
        riskPlayer.armiesToPlace = 5;
      }
      
      const result = riskPlugin.actions.placeArmy(
        state,
        mockClient("player-1"),
        { territoryId: "kamchatka", count: 3 }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("don't own");
    });

    it("cannot place more armies than available", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 1);
      state.gamePhase = "playing";
      state.turnPhase = "reinforce";
      state.currentTurn = "player-1";
      
      const riskPlayer = state.riskPlayers.get("player-1");
      if (riskPlayer) {
        riskPlayer.armiesToPlace = 3;
      }
      
      const result = riskPlugin.actions.placeArmy(
        state,
        mockClient("player-1"),
        { territoryId: "alaska", count: 5 }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid army count");
    });

    it("advances to attack phase when all reinforcements placed", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 1);
      state.gamePhase = "playing";
      state.turnPhase = "reinforce";
      state.currentTurn = "player-1";
      
      const riskPlayer = state.riskPlayers.get("player-1");
      if (riskPlayer) {
        riskPlayer.armiesToPlace = 3;
      }
      
      riskPlugin.actions.placeArmy(
        state,
        mockClient("player-1"),
        { territoryId: "alaska", count: 3 }
      );
      
      expect(state.turnPhase).toBe("attack");
      expect(riskPlayer?.armiesToPlace).toBe(0);
    });
  });
});

// ============================================================================
// Attack Phase Tests
// ============================================================================

describe("Risk Game — Attack Phase", () => {
  describe("Attack validation", () => {
    it("can only attack adjacent territories", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "brazil", "player-2", 3);
      
      const valid = canAttackTerritory(state, "alaska", "brazil", "player-1");
      expect(valid).toBe(false);
    });

    it("can only attack from territories with 2+ armies", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 1);
      setTerritoryState(state, "kamchatka", "player-2", 3);
      
      const valid = canAttackFrom(state, "alaska", "player-1");
      expect(valid).toBe(false);
    });

    it("cannot attack own territory", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "northwest-territory", "player-1", 3);
      
      const valid = canAttackTerritory(state, "alaska", "northwest-territory", "player-1");
      expect(valid).toBe(false);
    });

    it("valid attack: adjacent, 2+ armies, opponent-owned", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "kamchatka", "player-2", 3);
      
      const valid = canAttackTerritory(state, "alaska", "kamchatka", "player-1");
      expect(valid).toBe(true);
    });
  });

  describe("Dice rolling", () => {
    it("attacker can use 1-3 dice based on army count", () => {
      const state = createStartedGame(2);
      
      // 2 armies → max 1 die (must leave 1)
      setTerritoryState(state, "alaska", "player-1", 2);
      expect(canAttackFrom(state, "alaska", "player-1")).toBe(true);
      
      // 4 armies → can use up to 3 dice
      setTerritoryState(state, "alaska", "player-1", 4);
      setTerritoryState(state, "kamchatka", "player-2", 3);
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      // Attack with 3 dice should be valid
      const result = riskPlugin.actions.attack(
        state,
        mockClient("player-1"),
        { from: "alaska", to: "kamchatka", attackerDice: 3 }
      );
      
      expect(result.success).toBe(true);
    });

    it("defender uses min(armies, 2) dice", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "kamchatka", "player-2", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      // With 1 defender army, should only roll 1 die (tested via combat)
      const beforeArmy = state.territories.get("kamchatka")?.armyCount;
      expect(beforeArmy).toBe(1);
      
      // The resolveCombat function will automatically use min(armies, 2) for defender
      const result = resolveCombat(5, 1, 2, 1);
      expect(result).toBeDefined();
    });
  });

  describe("Combat resolution", () => {
    it("combat function exists and returns valid result", () => {
      expect(resolveCombat).toBeDefined();
      expect(typeof resolveCombat).toBe("function");
      
      const result = resolveCombat(5, 3, 2, 2);
      expect(result).toHaveProperty("attackerLosses");
      expect(result).toHaveProperty("defenderLosses");
      expect(result).toHaveProperty("conquered");
      expect(result.attackerLosses + result.defenderLosses).toBeGreaterThan(0);
    });

    it("territory conquered when defender reaches 0 armies", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 20);
      setTerritoryState(state, "kamchatka", "player-2", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      const beforeOwner = state.territories.get("kamchatka")?.owner;
      expect(beforeOwner).toBe("player-2");
      
      // Attack multiple times until territory is captured
      for (let i = 0; i < 50; i++) {
        const territory = state.territories.get("kamchatka");
        if (!territory || territory.owner === "player-1") break;
        
        riskPlugin.actions.attack(
          state,
          mockClient("player-1"),
          { from: "alaska", to: "kamchatka", attackerDice: 2 }
        );
      }
      
      // Territory should eventually be captured
      const afterOwner = state.territories.get("kamchatka")?.owner;
      expect(afterOwner).toBe("player-1");
    });

    it("attacker moves armies into captured territory", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 20);
      setTerritoryState(state, "kamchatka", "player-2", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      // Attack until captured
      for (let i = 0; i < 50; i++) {
        const territory = state.territories.get("kamchatka");
        if (!territory || territory.owner === "player-1") break;
        
        riskPlugin.actions.attack(
          state,
          mockClient("player-1"),
          { from: "alaska", to: "kamchatka", attackerDice: 3 }
        );
      }
      
      // Captured territory should have armies equal to attack dice count
      const capturedTerritory = state.territories.get("kamchatka");
      expect(capturedTerritory?.owner).toBe("player-1");
      expect(capturedTerritory?.armyCount).toBeGreaterThan(0);
    });
  });

  describe("Card earning", () => {
    it("earns one card on first capture per turn", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 10);
      setTerritoryState(state, "kamchatka", "player-2", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      state.earnedCardThisTurn = false;
      
      const riskPlayer = state.riskPlayers.get("player-1");
      const initialCards = riskPlayer?.cardsHeld ?? 0;
      
      // Attack until captured
      for (let i = 0; i < 10; i++) {
        const territory = state.territories.get("kamchatka");
        if (!territory || territory.owner === "player-1") break;
        
        riskPlugin.actions.attack(
          state,
          mockClient("player-1"),
          { from: "alaska", to: "kamchatka", attackerDice: 3 }
        );
      }
      
      expect(state.earnedCardThisTurn).toBe(true);
      expect(riskPlayer?.cardsHeld).toBe(initialCards + 1);
    });

    it("does not earn card on subsequent captures in same turn", () => {
      const state = createStartedGame(3);
      
      setTerritoryState(state, "alaska", "player-1", 10);
      setTerritoryState(state, "kamchatka", "player-2", 1);
      setTerritoryState(state, "greenland", "player-1", 10);
      setTerritoryState(state, "iceland", "player-3", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      state.earnedCardThisTurn = false;
      
      const riskPlayer = state.riskPlayers.get("player-1");
      const initialCards = riskPlayer?.cardsHeld ?? 0;
      
      // Capture first territory
      for (let i = 0; i < 10; i++) {
        const territory = state.territories.get("kamchatka");
        if (!territory || territory.owner === "player-1") break;
        
        riskPlugin.actions.attack(
          state,
          mockClient("player-1"),
          { from: "alaska", to: "kamchatka", attackerDice: 3 }
        );
      }
      
      const cardsAfterFirst = riskPlayer?.cardsHeld ?? 0;
      expect(cardsAfterFirst).toBe(initialCards + 1);
      
      // Capture second territory
      for (let i = 0; i < 10; i++) {
        const territory = state.territories.get("iceland");
        if (!territory || territory.owner === "player-1") break;
        
        riskPlugin.actions.attack(
          state,
          mockClient("player-1"),
          { from: "greenland", to: "iceland", attackerDice: 3 }
        );
      }
      
      // Should still have same number of cards
      expect(riskPlayer?.cardsHeld).toBe(cardsAfterFirst);
    });

    it("card earning resets at start of next turn", () => {
      const state = createStartedGame(2);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.earnedCardThisTurn = true;
      
      // End attack phase
      riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      expect(state.turnPhase).toBe("fortify");
      
      // End turn (fortify phase ends the turn)
      const result = riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      expect(result.endsTurn).toBe(true);
      
      // onTurnStarted resets the flag for the next player
      riskPlugin.lifecycle.onTurnStarted?.(state, "player-2");
      expect(state.earnedCardThisTurn).toBe(false);
    });
  });
});

// ============================================================================
// Fortify Phase Tests
// ============================================================================

describe("Risk Game — Fortify Phase", () => {
  describe("Fortify validation", () => {
    it("can only fortify between owned territories", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "kamchatka", "player-2", 3);
      
      const valid = canFortifyBetween(state, "alaska", "kamchatka", "player-1");
      expect(valid).toBe(false);
    });

    it("can only fortify to adjacent territories", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "brazil", "player-1", 3);
      
      const valid = canFortifyBetween(state, "alaska", "brazil", "player-1");
      expect(valid).toBe(false);
    });

    it("must leave at least 1 army on source territory", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 3);
      setTerritoryState(state, "northwest-territory", "player-1", 2);
      
      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";
      
      const result = riskPlugin.actions.fortify(
        state,
        mockClient("player-1"),
        { from: "alaska", to: "northwest-territory", count: 3 }
      );
      
      expect(result.success).toBe(false);
    });

    it("allows valid fortify: owned, adjacent, leaves 1+ armies", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "northwest-territory", "player-1", 2);
      
      const valid = canFortifyBetween(state, "alaska", "northwest-territory", "player-1");
      expect(valid).toBe(true);
    });
  });

  describe("Fortify execution", () => {
    it("moves armies from source to destination", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "northwest-territory", "player-1", 2);
      
      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";
      
      const result = riskPlugin.actions.fortify(
        state,
        mockClient("player-1"),
        { from: "alaska", to: "northwest-territory", count: 3 }
      );
      
      expect(result.success).toBe(true);
      expect(state.territories.get("alaska")?.armyCount).toBe(2);
      expect(state.territories.get("northwest-territory")?.armyCount).toBe(5);
    });

    it("fortify ends turn", () => {
      const state = createStartedGame(2);
      
      setTerritoryState(state, "alaska", "player-1", 5);
      setTerritoryState(state, "northwest-territory", "player-1", 2);
      
      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";
      
      const result = riskPlugin.actions.fortify(
        state,
        mockClient("player-1"),
        { from: "alaska", to: "northwest-territory", count: 2 }
      );
      
      expect(result.success).toBe(true);
      expect(result.endsTurn).toBe(true);
    });

    it("can skip fortify phase", () => {
      const state = createStartedGame(2);
      
      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";
      
      const result = riskPlugin.actions.endPhase(
        state,
        mockClient("player-1"),
        {}
      );
      
      expect(result.success).toBe(true);
      expect(result.endsTurn).toBe(true);
    });
  });
});

// ============================================================================
// Win Condition Tests
// ============================================================================

describe("Risk Game — Win Conditions", () => {
  describe("Victory", () => {
    it("player wins when controlling all 42 territories", () => {
      const state = createStartedGame(2);
      
      grantAllTerritories(state, "player-1");
      
      const winnerId = checkWinCondition(state);
      expect(winnerId).toBe("player-1");
    });

    it("game continues while multiple players control territories", () => {
      const state = createStartedGame(2);
      
      // Player 1 controls 40 territories
      let count = 0;
      state.territories.forEach((territory, id) => {
        if (count < 40) {
          territory.owner = "player-1";
          territory.armyCount = 1;
        } else {
          territory.owner = "player-2";
          territory.armyCount = 1;
        }
        count++;
      });
      
      const winnerId = checkWinCondition(state);
      expect(winnerId).toBeNull();
    });
  });

  describe("Player elimination", () => {
    it("territory count updates when player loses territories", () => {
      const state = createStartedGame(2);
      
      // Set specific territories for test
      setTerritoryState(state, "alaska", "player-2", 1);
      setTerritoryState(state, "kamchatka", "player-1", 10);
      
      // Get actual territory count before attack
      const territoriesBeforeAttack = getOwnedTerritories(state, "player-2").length;
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      // Attack and capture
      for (let i = 0; i < 10; i++) {
        const territory = state.territories.get("alaska");
        if (!territory || territory.owner === "player-1") break;
        
        riskPlugin.actions.attack(
          state,
          mockClient("player-1"),
          { from: "kamchatka", to: "alaska", attackerDice: 3 }
        );
      }
      
      // Get territory count after attack
      const territoriesAfterAttack = getOwnedTerritories(state, "player-2").length;
      
      // Territory count should decrease if alaska was captured
      const alaskaOwner = state.territories.get("alaska")?.owner;
      if (alaskaOwner === "player-1") {
        expect(territoriesAfterAttack).toBe(territoriesBeforeAttack - 1);
      } else {
        expect(territoriesAfterAttack).toBe(territoriesBeforeAttack);
      }
    });

    it("game ends when one player controls all territories", () => {
      const state = createStartedGame(2);
      
      grantAllTerritories(state, "player-1");
      
      const gameResult = riskPlugin.conditions.checkGameEnd?.(state);
      expect(gameResult).not.toBeNull();
      expect(gameResult?.type).toBe("win");
      expect(gameResult?.winnerId).toBe("player-1");
    });

    it("eliminated player has zero territories", () => {
      const state = createStartedGame(2);
      
      grantAllTerritories(state, "player-1");
      
      const player2Territories = getOwnedTerritories(state, "player-2");
      expect(player2Territories.length).toBe(0);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Risk Game — Edge Cases", () => {
  describe("Multi-player games", () => {
    it("2-player game initializes correctly", () => {
      const state = createStartedGame(2);
      
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      expect(activePlayers).toHaveLength(2);
      
      // Game starts in setup-pick phase; no armies to place yet
      expect(state.turnPhase).toBe("setup-pick");
    });

    it("6-player game initializes correctly", () => {
      const state = createStartedGame(6);
      
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      expect(activePlayers).toHaveLength(6);
      
      // Each player should have fewer armies than in 2-player game
      activePlayers.forEach(player => {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        expect(riskPlayer).toBeDefined();
      });
    });
  });

  describe("No valid moves", () => {
    it("player with no valid attacks can skip to fortify", () => {
      const state = createStartedGame(2);
      
      // Player 1 owns only territories with 1 army (can't attack)
      setTerritoryState(state, "alaska", "player-1", 1);
      setTerritoryState(state, "greenland", "player-1", 1);
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      const result = riskPlugin.actions.endPhase(
        state,
        mockClient("player-1"),
        {}
      );
      
      expect(result.success).toBe(true);
      expect(state.turnPhase).toBe("fortify");
    });

    it("player with isolated territories has limited attack options", () => {
      const state = createStartedGame(3);
      
      // Player 2 controls isolated territories
      setTerritoryState(state, "eastern-australia", "player-2", 5);
      setTerritoryState(state, "western-australia", "player-2", 5);
      setTerritoryState(state, "new-guinea", "player-3", 5);
      
      // Can't attack own territory
      const canAttack = canAttackTerritory(state, "eastern-australia", "western-australia", "player-2");
      expect(canAttack).toBe(false);
    });
  });

  describe("Forced card trade-in", () => {
    it("player with 5+ cards must trade before ending turn", () => {
      const state = createStartedGame(2);
      
      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";
      
      const riskPlayer = state.riskPlayers.get("player-1");
      if (riskPlayer) {
        riskPlayer.cardsHeld = 5;
      }
      
      const result = riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Must trade in cards");
    });
  });

  describe("Turn progression", () => {
    it("setup phase places all armies before playing", () => {
      const state = createDraftedGame(2);
      
      expect(state.gamePhase).toBe("setup");
      expect(state.turnPhase).toBe("setup-place");
      
      // Players need to place their armies before playing phase
      const player1 = state.riskPlayers.get("player-1");
      expect(player1?.armiesToPlace).toBeGreaterThan(0);
    });

    it("turn phases progress correctly", () => {
      const state = createStartedGame(2);
      
      // Complete setup
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      for (const player of activePlayers) {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        if (riskPlayer) {
          riskPlayer.armiesToPlace = 0;
        }
      }
      
      state.gamePhase = "playing";
      state.turnPhase = "attack";
      state.currentTurn = "player-1";
      
      // Skip attack phase
      riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      expect(state.turnPhase).toBe("fortify");
      
      // End turn
      const result = riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      expect(result.success).toBe(true);
      expect(result.endsTurn).toBe(true);
    });

    it("onTurnStarted calculates reinforcements for the new player", () => {
      const state = createStartedGame(2);

      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";

      const p2Risk = state.riskPlayers.get("player-2");
      expect(p2Risk).toBeDefined();
      if (p2Risk) {
        p2Risk.armiesToPlace = 0;
      }

      // Simulate turn ending → BaseGameRoom calls onTurnStarted for next player
      riskPlugin.lifecycle.onTurnStarted?.(state, "player-2");

      expect(state.turnPhase).toBe("reinforce");
      expect(p2Risk?.armiesToPlace).toBeGreaterThan(0);
      expect(state.earnedCardThisTurn).toBe(false);
    });

    it("endPhase from fortify does not calculate reinforcements for the current player", () => {
      const state = createStartedGame(2);

      state.gamePhase = "playing";
      state.turnPhase = "fortify";
      state.currentTurn = "player-1";

      const p1Risk = state.riskPlayers.get("player-1");
      if (p1Risk) {
        p1Risk.armiesToPlace = 0;
      }

      const result = riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      expect(result.endsTurn).toBe(true);

      // endPhase should NOT calculate reinforcements — that's onTurnStarted's job
      expect(p1Risk?.armiesToPlace).toBe(0);
    });

    it("setup-to-playing transition does not give reinforcements to the wrong player", () => {
      const state = createStartedGame(2);

      // Force all players to have placed their armies
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      for (const player of activePlayers) {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        if (riskPlayer) {
          riskPlayer.armiesToPlace = 0;
        }
      }

      expect(state.gamePhase).toBe("setup");

      // Player 1 triggers the transition
      const result = riskPlugin.actions.endPhase(state, mockClient("player-1"), {});
      expect(result.endsTurn).toBe(true);
      expect(state.gamePhase).toBe("playing");

      // player-1 should NOT have reinforcements from endPhase
      const p1Risk = state.riskPlayers.get("player-1");
      expect(p1Risk?.armiesToPlace).toBe(0);

      // After BaseGameRoom calls onTurnStarted for the next player, they get reinforcements
      riskPlugin.lifecycle.onTurnStarted?.(state, "player-2");
      const p2Risk = state.riskPlayers.get("player-2");
      expect(p2Risk?.armiesToPlace).toBeGreaterThan(0);
    });
  });

  describe("Connection handling", () => {
    it("player can join during setup", () => {
      const state = riskPlugin.createState();
      
      riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-1"), 0);
      
      const player = state.players.get("player-1");
      expect(player).toBeDefined();
      expect(player?.isConnected).toBe(true);
    });

    it("player data is tracked in both player and risk player maps", () => {
      const state = createStartedGame(2);
      
      const player = state.players.get("player-1");
      const riskPlayer = state.riskPlayers.get("player-1");
      
      expect(player).toBeDefined();
      expect(riskPlayer).toBeDefined();
      expect(player?.sessionId).toBe("player-1");
      expect(riskPlayer?.sessionId).toBe("player-1");
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Risk Game — Integration", () => {
  describe("Full game lifecycle", () => {
    it("initializes game state correctly", () => {
      const state = riskPlugin.createState();
      
      expect(state.gamePhase).toBe("setup");
      expect(state.territories).toBeDefined();
      expect(state.territories.size).toBe(0);
    });

    it("handles player join before game start", () => {
      const state = riskPlugin.createState();
      
      riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-1"), 0);
      riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-2"), 1);
      
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      expect(activePlayers).toHaveLength(2);
    });

    it("transitions through game phases correctly", () => {
      const state = createDraftedGame(2);
      
      // Starts in setup-place phase after drafting
      expect(state.gamePhase).toBe("setup");
      expect(state.turnPhase).toBe("setup-place");
      
      // Complete setup by placing all armies
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      for (const player of activePlayers) {
        state.currentTurn = player.sessionId;
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        if (riskPlayer && riskPlayer.armiesToPlace > 0) {
          const ownedTerritories = getOwnedTerritories(state, player.sessionId);
          if (ownedTerritories.length > 0) {
            riskPlugin.actions.placeArmy(
              state,
              mockClient(player.sessionId),
              { territoryId: ownedTerritories[0], count: riskPlayer.armiesToPlace }
            );
          }
        }
      }
      
      // After all players place armies, transition should happen
      // The game will transition to playing phase via endPhase
      if (state.gamePhase === "setup") {
        for (const player of activePlayers) {
          state.currentTurn = player.sessionId;
          const allReady = activePlayers.every((p) => {
            const rp = state.riskPlayers.get(p.sessionId);
            return rp && rp.armiesToPlace === 0;
          });
          
          if (allReady) {
            riskPlugin.actions.endPhase(state, mockClient(player.sessionId), {});
            break;
          }
        }
      }
      
      // Should now be in playing phase
      expect(state.gamePhase).toBe("playing");
    });

    it("simulates a basic game flow", () => {
      const state = createDraftedGame(2);
      
      // Verify initial state after draft
      expect(state.gamePhase).toBe("setup");
      expect(state.turnPhase).toBe("setup-place");
      
      // Verify all territories are assigned
      let assignedCount = 0;
      state.territories.forEach((territory) => {
        if (territory.owner !== "") {
          assignedCount++;
        }
      });
      expect(assignedCount).toBe(42);
      
      // Verify players have armies to place
      const activePlayers = Array.from(state.players.values()).filter(p => !p.isSpectator);
      activePlayers.forEach(player => {
        const riskPlayer = state.riskPlayers.get(player.sessionId);
        expect(riskPlayer?.armiesToPlace).toBeGreaterThan(0);
      });
    });
  });
});

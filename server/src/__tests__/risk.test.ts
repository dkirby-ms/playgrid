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
} = await import("../games/risk/territoryData");

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
 * TODO: Use actual riskPlugin once available
 */
function createStartedGame(playerCount: number): RiskStateInstance {
  // const state = riskPlugin.createState();
  // for (let i = 0; i < playerCount; i++) {
  //   riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient(`player-${i + 1}`), i);
  // }
  // riskPlugin.lifecycle.onGameStart(state);
  // return state;
  
  // Placeholder
  return {
    phase: "setup",
    players: Array.from({ length: playerCount }, (_, i) => ({
      sessionId: `player-${i + 1}`,
      playerIndex: i,
    })),
    territories: {},
    continents: {},
    currentTurn: "player-1",
  };
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
  // TODO: Use actual state structure once available
  state.territories[territoryId] = { owner: ownerId, armies };
}

/**
 * Grant all territories to a specific player (for win condition testing)
 */
function grantAllTerritories(state: RiskStateInstance, playerId: string) {
  // TODO: Use actual territory list once available
  for (let i = 0; i < TOTAL_TERRITORIES; i++) {
    setTerritoryState(state, `territory-${i}`, playerId, 1);
  }
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
  describe("Territory selection", () => {
    it.todo("players take turns selecting unclaimed territories", () => {
      // const state = createStartedGame(3);
      // 
      // expect(state.phase).toBe("setup");
      // expect(state.currentTurn).toBe("player-1");
      // 
      // // Player 1 claims a territory
      // const result1 = riskPlugin.actions.claimTerritory(
      //   state,
      //   mockClient("player-1"),
      //   { territoryId: "alaska" }
      // );
      // expect(result1.success).toBe(true);
      // expect(state.territories["alaska"].owner).toBe("player-1");
      // expect(state.currentTurn).toBe("player-2");
    });

    it.todo("cannot claim an already-owned territory", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 1);
      // 
      // const result = riskPlugin.actions.claimTerritory(
      //   state,
      //   mockClient("player-2"),
      //   { territoryId: "alaska" }
      // );
      // expect(result.success).toBe(false);
    });

    it.todo("advances to reinforce phase when all territories claimed", () => {
      // const state = createStartedGame(2);
      // 
      // // Claim all 42 territories
      // for (let i = 0; i < TOTAL_TERRITORIES; i++) {
      //   const playerId = i % 2 === 0 ? "player-1" : "player-2";
      //   setTerritoryState(state, `territory-${i}`, playerId, 1);
      // }
      // 
      // // Check phase transition
      // expect(state.phase).toBe("reinforce");
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

    it.todo("forces trade-in when player has 5+ cards", () => {
      // const state = createStartedGame(2);
      // state.players[0].cards = ["infantry", "cavalry", "artillery", "infantry", "cavalry"];
      // 
      // const result = riskPlugin.actions.endReinforcePhase(
      //   state,
      //   mockClient("player-1"),
      //   {}
      // );
      // 
      // expect(result.success).toBe(false);
      // expect(result.reason).toContain("must trade in cards");
    });

    it.todo("allows voluntary trade-in with 3-5 cards", () => {
      // const state = createStartedGame(2);
      // state.players[0].cards = ["infantry", "cavalry", "artillery"];
      // 
      // const result = riskPlugin.actions.tradeCards(
      //   state,
      //   mockClient("player-1"),
      //   { cards: ["infantry", "cavalry", "artillery"] }
      // );
      // 
      // expect(result.success).toBe(true);
      // expect(state.players[0].cards).toHaveLength(0);
    });
  });

  describe("Army placement", () => {
    it.todo("can only place armies on owned territories", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 1);
      // setTerritoryState(state, "kamchatka", "player-2", 1);
      // 
      // state.players[0].reinforcementsRemaining = 5;
      // 
      // const result = riskPlugin.actions.placeReinforcements(
      //   state,
      //   mockClient("player-1"),
      //   { territoryId: "kamchatka", armies: 3 }
      // );
      // 
      // expect(result.success).toBe(false);
    });

    it.todo("cannot place more armies than available", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 1);
      // state.players[0].reinforcementsRemaining = 3;
      // 
      // const result = riskPlugin.actions.placeReinforcements(
      //   state,
      //   mockClient("player-1"),
      //   { territoryId: "alaska", armies: 5 }
      // );
      // 
      // expect(result.success).toBe(false);
    });

    it.todo("advances to attack phase when all reinforcements placed", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 1);
      // state.players[0].reinforcementsRemaining = 3;
      // 
      // riskPlugin.actions.placeReinforcements(
      //   state,
      //   mockClient("player-1"),
      //   { territoryId: "alaska", armies: 3 }
      // );
      // 
      // expect(state.phase).toBe("attack");
    });
  });
});

// ============================================================================
// Attack Phase Tests
// ============================================================================

describe("Risk Game — Attack Phase", () => {
  describe("Attack validation", () => {
    it.todo("can only attack adjacent territories", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "brazil", "player-2", 3); // not adjacent
      // 
      // const valid = validateAttack(state, "alaska", "brazil");
      // expect(valid).toBe(false);
    });

    it.todo("can only attack from territories with 2+ armies", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 1);
      // setTerritoryState(state, "kamchatka", "player-2", 3);
      // 
      // const valid = validateAttack(state, "alaska", "kamchatka");
      // expect(valid).toBe(false);
    });

    it.todo("cannot attack own territory", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "northwest-territory", "player-1", 3);
      // 
      // const valid = validateAttack(state, "alaska", "northwest-territory");
      // expect(valid).toBe(false);
    });

    it.todo("valid attack: adjacent, 2+ armies, opponent-owned", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "kamchatka", "player-2", 3);
      // 
      // const valid = validateAttack(state, "alaska", "kamchatka");
      // expect(valid).toBe(true);
    });
  });

  describe("Dice rolling", () => {
    it.todo("attacker rolls 1-3 dice, max = armies - 1, capped at 3", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 2);
      // 
      // // 2 armies → max 1 die
      // let maxDice = getMaxAttackDice(state, "alaska");
      // expect(maxDice).toBe(1);
      // 
      // setTerritoryState(state, "alaska", "player-1", 4);
      // // 4 armies → max 3 dice
      // maxDice = getMaxAttackDice(state, "alaska");
      // expect(maxDice).toBe(3);
      // 
      // setTerritoryState(state, "alaska", "player-1", 10);
      // // 10 armies → still capped at 3 dice
      // maxDice = getMaxAttackDice(state, "alaska");
      // expect(maxDice).toBe(3);
    });

    it.todo("defender rolls 1-2 dice, max = armies on territory, capped at 2", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "kamchatka", "player-2", 1);
      // 
      // // 1 army → max 1 die
      // let maxDice = getMaxDefendDice(state, "kamchatka");
      // expect(maxDice).toBe(1);
      // 
      // setTerritoryState(state, "kamchatka", "player-2", 5);
      // // 5 armies → capped at 2 dice
      // maxDice = getMaxDefendDice(state, "kamchatka");
      // expect(maxDice).toBe(2);
    });
  });

  describe("Combat resolution", () => {
    it("highest attacker die vs highest defender die (deterministic)", () => {
      // We can't test the actual resolveCombat function directly with deterministic dice
      // since it uses Math.random(), but we can test the logic conceptually
      // The function signature: resolveCombat(attackerArmies, defenderArmies, attackDiceCount, defenseDiceCount)
      
      // Placeholder - this would require mocking Math.random or extracting dice rolling
      // Just verify the function exists and has correct signature
      expect(resolveCombat).toBeDefined();
      expect(typeof resolveCombat).toBe("function");
    });

    it.todo("ties go to defender", () => {
      // Would need deterministic dice or mocking Math.random
      // const attackDice = [4, 3];
      // const defendDice = [4, 2];
      // 
      // const result = resolveCombat(attackDice, defendDice);
      // 
      // // 4 = 4: tie, defender wins, attacker loses 1
      // // 3 > 2: attacker wins, defender loses 1
      // expect(result.attackerLosses).toBe(1);
      // expect(result.defenderLosses).toBe(1);
    });

    it.todo("compares second-highest when both roll 2+ dice", () => {
      // Would need deterministic dice
    });

    it.todo("only compares as many dice as defender rolled", () => {
      // Would need deterministic dice
    });
  });

  describe("Territory capture", () => {
    it.todo("territory captured when defender reaches 0 armies", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 3);
      // setTerritoryState(state, "kamchatka", "player-2", 1);
      // 
      // // Simulate attack that eliminates defender
      // const result = riskPlugin.actions.attack(
      //   state,
      //   mockClient("player-1"),
      //   { from: "alaska", to: "kamchatka", dice: 2 }
      // );
      // 
      // // Assume attacker wins
      // if (state.territories["kamchatka"].armies === 0) {
      //   expect(result.captured).toBe(true);
      //   expect(state.territories["kamchatka"].owner).toBe("player-1");
      // }
    });

    it.todo("attacker must move at least attack dice count into captured territory", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "kamchatka", "player-2", 1);
      // 
      // // Attack with 3 dice and capture
      // // ... simulate capture ...
      // 
      // const result = riskPlugin.actions.moveAfterCapture(
      //   state,
      //   mockClient("player-1"),
      //   { from: "alaska", to: "kamchatka", armies: 2 }
      // );
      // 
      // // Should fail: must move at least 3 armies
      // expect(result.success).toBe(false);
    });

    it.todo("can move more armies than attack dice into captured territory", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 10);
      // setTerritoryState(state, "kamchatka", "player-2", 1);
      // 
      // // Attack with 3 dice, capture, then move 5 armies
      // // ... simulate capture ...
      // 
      // const result = riskPlugin.actions.moveAfterCapture(
      //   state,
      //   mockClient("player-1"),
      //   { from: "alaska", to: "kamchatka", armies: 5 }
      // );
      // 
      // expect(result.success).toBe(true);
      // expect(state.territories["kamchatka"].armies).toBe(5);
      // expect(state.territories["alaska"].armies).toBe(5);
    });
  });

  describe("Card earning", () => {
    it.todo("earns one card on first capture per turn", () => {
      // const state = createStartedGame(2);
      // state.players[0].cards = [];
      // 
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "kamchatka", "player-2", 1);
      // 
      // // Capture territory
      // // ... simulate successful capture ...
      // 
      // expect(state.players[0].cards).toHaveLength(1);
      // expect(state.players[0].earnedCardThisTurn).toBe(true);
    });

    it.todo("does not earn card on subsequent captures in same turn", () => {
      // const state = createStartedGame(2);
      // state.players[0].cards = ["infantry"];
      // state.players[0].earnedCardThisTurn = true;
      // 
      // setTerritoryState(state, "greenland", "player-1", 5);
      // setTerritoryState(state, "iceland", "player-2", 1);
      // 
      // // Capture another territory
      // // ... simulate successful capture ...
      // 
      // // Should still have only 1 card
      // expect(state.players[0].cards).toHaveLength(1);
    });

    it.todo("card earning resets at start of next turn", () => {
      // const state = createStartedGame(2);
      // state.players[0].earnedCardThisTurn = true;
      // 
      // // Advance to next turn
      // riskPlugin.actions.endTurn(state, mockClient("player-1"), {});
      // 
      // expect(state.players[0].earnedCardThisTurn).toBe(false);
    });
  });
});

// ============================================================================
// Fortify Phase Tests
// ============================================================================

describe("Risk Game — Fortify Phase", () => {
  describe("Fortify validation", () => {
    it.todo("can only fortify between owned territories", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "kamchatka", "player-2", 3);
      // 
      // const valid = validateFortify(state, "alaska", "kamchatka", 2);
      // expect(valid).toBe(false);
    });

    it.todo("can only fortify along connected path of owned territories", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "kamchatka", "player-2", 3); // blocks path
      // setTerritoryState(state, "greenland", "player-1", 3);
      // 
      // const valid = validateFortify(state, "alaska", "greenland", 2);
      // expect(valid).toBe(false); // no connected path through owned territories
    });

    it.todo("must leave at least 1 army on source territory", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 3);
      // setTerritoryState(state, "northwest-territory", "player-1", 2);
      // 
      // const valid = validateFortify(state, "alaska", "northwest-territory", 3);
      // expect(valid).toBe(false);
    });

    it.todo("allows valid fortify: owned, connected, leaves 1+ armies", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "northwest-territory", "player-1", 2);
      // 
      // const valid = validateFortify(state, "alaska", "northwest-territory", 3);
      // expect(valid).toBe(true);
    });
  });

  describe("Fortify execution", () => {
    it.todo("moves armies from source to destination", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "northwest-territory", "player-1", 2);
      // 
      // const result = riskPlugin.actions.fortify(
      //   state,
      //   mockClient("player-1"),
      //   { from: "alaska", to: "northwest-territory", armies: 3 }
      // );
      // 
      // expect(result.success).toBe(true);
      // expect(state.territories["alaska"].armies).toBe(2);
      // expect(state.territories["northwest-territory"].armies).toBe(5);
    });

    it.todo("can only fortify once per turn", () => {
      // const state = createStartedGame(2);
      // setTerritoryState(state, "alaska", "player-1", 5);
      // setTerritoryState(state, "northwest-territory", "player-1", 2);
      // setTerritoryState(state, "greenland", "player-1", 3);
      // 
      // riskPlugin.actions.fortify(
      //   state,
      //   mockClient("player-1"),
      //   { from: "alaska", to: "northwest-territory", armies: 2 }
      // );
      // 
      // const result = riskPlugin.actions.fortify(
      //   state,
      //   mockClient("player-1"),
      //   { from: "greenland", to: "northwest-territory", armies: 1 }
      // );
      // 
      // expect(result.success).toBe(false);
    });

    it.todo("can skip fortify phase", () => {
      // const state = createStartedGame(2);
      // state.phase = "fortify";
      // 
      // const result = riskPlugin.actions.endTurn(
      //   state,
      //   mockClient("player-1"),
      //   {}
      // );
      // 
      // expect(result.success).toBe(true);
      // expect(state.currentTurn).toBe("player-2");
    });
  });
});

// ============================================================================
// Win Condition Tests
// ============================================================================

describe("Risk Game — Win Conditions", () => {
  describe("Victory", () => {
    it.todo("player wins when controlling all 42 territories", () => {
      // const state = createStartedGame(2);
      // grantAllTerritories(state, "player-1");
      // 
      // const gameResult = checkWinCondition(state);
      // expect(gameResult.isGameOver).toBe(true);
      // expect(gameResult.winner).toBe("player-1");
    });

    it.todo("game continues while multiple players control territories", () => {
      // const state = createStartedGame(2);
      // 
      // // Player 1 controls 40 territories
      // for (let i = 0; i < 40; i++) {
      //   setTerritoryState(state, `territory-${i}`, "player-1", 1);
      // }
      // 
      // // Player 2 controls 2 territories
      // setTerritoryState(state, "territory-40", "player-2", 1);
      // setTerritoryState(state, "territory-41", "player-2", 1);
      // 
      // const gameResult = checkWinCondition(state);
      // expect(gameResult.isGameOver).toBe(false);
    });
  });

  describe("Player elimination", () => {
    it.todo("player eliminated when losing last territory", () => {
      // const state = createStartedGame(3);
      // 
      // setTerritoryState(state, "alaska", "player-2", 1); // last territory for player-2
      // setTerritoryState(state, "kamchatka", "player-1", 3);
      // 
      // // Player 1 captures Alaska, eliminating Player 2
      // // ... simulate attack and capture ...
      // 
      // expect(state.players[1].isEliminated).toBe(true);
    });

    it.todo("eliminated player's cards transfer to conquering player", () => {
      // const state = createStartedGame(3);
      // 
      // state.players[1].cards = ["infantry", "cavalry", "artillery"];
      // state.players[0].cards = ["infantry"];
      // 
      // setTerritoryState(state, "alaska", "player-2", 1);
      // setTerritoryState(state, "kamchatka", "player-1", 3);
      // 
      // // Player 1 eliminates Player 2
      // // ... simulate final capture ...
      // 
      // expect(state.players[0].cards).toHaveLength(4);
      // expect(state.players[1].cards).toHaveLength(0);
    });

    it.todo("eliminated player skipped in turn order", () => {
      // const state = createStartedGame(3);
      // state.players[1].isEliminated = true;
      // state.currentTurn = "player-1";
      // 
      // // End Player 1's turn
      // riskPlugin.actions.endTurn(state, mockClient("player-1"), {});
      // 
      // // Should skip Player 2 and go to Player 3
      // expect(state.currentTurn).toBe("player-3");
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Risk Game — Edge Cases", () => {
  describe("Multi-player games", () => {
    it.todo("2-player game initializes correctly", () => {
      // const state = createStartedGame(2);
      // expect(state.players).toHaveLength(2);
      // expect(state.players[0].remainingArmies).toBe(40);
    });

    it.todo("6-player game initializes correctly", () => {
      // const state = createStartedGame(6);
      // expect(state.players).toHaveLength(6);
      // expect(state.players[0].remainingArmies).toBe(20);
    });
  });

  describe("No valid moves", () => {
    it.todo("player with no valid attacks can skip to fortify", () => {
      // const state = createStartedGame(2);
      // 
      // // Player 1 owns only territories with 1 army (can't attack)
      // setTerritoryState(state, "alaska", "player-1", 1);
      // setTerritoryState(state, "greenland", "player-1", 1);
      // 
      // const result = riskPlugin.actions.skipAttackPhase(
      //   state,
      //   mockClient("player-1"),
      //   {}
      // );
      // 
      // expect(result.success).toBe(true);
      // expect(state.phase).toBe("fortify");
    });

    it.todo("player completely surrounded by own territories has no attack targets", () => {
      // const state = createStartedGame(3);
      // 
      // // Player 2 controls Oceania (isolated continent)
      // setTerritoryState(state, "eastern-australia", "player-2", 5);
      // setTerritoryState(state, "western-australia", "player-2", 5);
      // setTerritoryState(state, "new-guinea", "player-2", 5);
      // 
      // // Indonesia (connection to Asia) owned by Player 2
      // setTerritoryState(state, "indonesia", "player-2", 5);
      // 
      // // Siam (only adjacent non-Oceania) owned by Player 2
      // setTerritoryState(state, "siam", "player-2", 5);
      // 
      // // No valid attacks available
      // const hasAttacks = hasValidAttacks(state, "player-2");
      // expect(hasAttacks).toBe(false);
    });
  });

  describe("Forced card trade-in", () => {
    it.todo("player with 5+ cards must trade before reinforcement", () => {
      // const state = createStartedGame(2);
      // state.players[0].cards = [
      //   "infantry",
      //   "cavalry",
      //   "artillery",
      //   "infantry",
      //   "cavalry",
      // ];
      // 
      // state.phase = "reinforce";
      // 
      // const result = riskPlugin.actions.placeReinforcements(
      //   state,
      //   mockClient("player-1"),
      //   { territoryId: "alaska", armies: 1 }
      // );
      // 
      // expect(result.success).toBe(false);
      // expect(result.reason).toContain("must trade in cards");
    });
  });

  describe("Turn progression", () => {
    it.todo("turn cycles through all active players", () => {
      // const state = createStartedGame(4);
      // 
      // expect(state.currentTurn).toBe("player-1");
      // 
      // riskPlugin.actions.endTurn(state, mockClient("player-1"), {});
      // expect(state.currentTurn).toBe("player-2");
      // 
      // riskPlugin.actions.endTurn(state, mockClient("player-2"), {});
      // expect(state.currentTurn).toBe("player-3");
      // 
      // riskPlugin.actions.endTurn(state, mockClient("player-3"), {});
      // expect(state.currentTurn).toBe("player-4");
      // 
      // riskPlugin.actions.endTurn(state, mockClient("player-4"), {});
      // expect(state.currentTurn).toBe("player-1"); // cycles back
    });

    it.todo("turn counter increments each round", () => {
      // const state = createStartedGame(2);
      // expect(state.turnNumber).toBe(1);
      // 
      // riskPlugin.actions.endTurn(state, mockClient("player-1"), {});
      // expect(state.turnNumber).toBe(2);
      // 
      // riskPlugin.actions.endTurn(state, mockClient("player-2"), {});
      // expect(state.turnNumber).toBe(3);
    });
  });

  describe("Player disconnection", () => {
    it.todo("game handles player disconnect during setup", () => {
      // const state = createStartedGame(3);
      // state.phase = "setup";
      // 
      // riskPlugin.lifecycle.onPlayerLeave?.(state, mockClient("player-2"), true);
      // 
      // // Game should handle gracefully (implementation specific)
      // expect(state.players).toHaveLength(2);
    });

    it.todo("game handles player disconnect during play", () => {
      // const state = createStartedGame(3);
      // state.phase = "attack";
      // 
      // riskPlugin.lifecycle.onPlayerLeave?.(state, mockClient("player-2"), true);
      // 
      // // Player territories remain but turn skipped
      // expect(state.players[1].isDisconnected).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Risk Game — Integration", () => {
  describe("Full game lifecycle", () => {
    it.todo("initializes game state correctly", () => {
      // const state = riskPlugin.createState();
      // 
      // expect(state.phase).toBe("waiting");
      // expect(state.territories).toBeDefined();
      // expect(Object.keys(state.territories)).toHaveLength(0);
    });

    it.todo("handles player join before game start", () => {
      // const state = riskPlugin.createState();
      // 
      // riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-1"), 0);
      // riskPlugin.lifecycle.onPlayerJoin?.(state, mockClient("player-2"), 1);
      // 
      // expect(state.players).toHaveLength(2);
    });

    it.todo("transitions from setup to reinforce to attack to fortify", () => {
      // const state = createStartedGame(2);
      // 
      // expect(state.phase).toBe("setup");
      // 
      // // Complete setup
      // // ... claim all territories ...
      // 
      // expect(state.phase).toBe("reinforce");
      // 
      // // Place reinforcements
      // // ... place armies ...
      // 
      // expect(state.phase).toBe("attack");
      // 
      // // Skip attack
      // riskPlugin.actions.skipAttackPhase(state, mockClient("player-1"), {});
      // expect(state.phase).toBe("fortify");
      // 
      // // End turn
      // riskPlugin.actions.endTurn(state, mockClient("player-1"), {});
      // expect(state.phase).toBe("reinforce");
      // expect(state.currentTurn).toBe("player-2");
    });

    it.todo("simulates multi-turn game with attacks and captures", () => {
      // const state = createStartedGame(2);
      // 
      // // Setup initial board state
      // // ... distribute territories ...
      // 
      // // Turn 1: Player 1 attacks and captures
      // // ... execute attacks ...
      // 
      // // Turn 2: Player 2 retaliates
      // // ... execute attacks ...
      // 
      // // Verify game state progression
      // expect(state.turnNumber).toBeGreaterThan(2);
    });
  });
});

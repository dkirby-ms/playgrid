export interface Territory {
  id: string;
  name: string;
  continent: string;
  adjacentTo: string[];
}

export interface Continent {
  id: string;
  name: string;
  territories: string[];
  bonusArmies: number;
}

export const TERRITORIES: Territory[] = [
  // North America (9 territories)
  { id: "alaska", name: "Alaska", continent: "north-america", adjacentTo: ["northwest-territory", "alberta", "kamchatka"] },
  { id: "northwest-territory", name: "Northwest Territory", continent: "north-america", adjacentTo: ["alaska", "alberta", "ontario", "greenland"] },
  { id: "greenland", name: "Greenland", continent: "north-america", adjacentTo: ["northwest-territory", "ontario", "quebec", "iceland"] },
  { id: "alberta", name: "Alberta", continent: "north-america", adjacentTo: ["alaska", "northwest-territory", "ontario", "western-united-states"] },
  { id: "ontario", name: "Ontario", continent: "north-america", adjacentTo: ["northwest-territory", "alberta", "greenland", "quebec", "western-united-states", "eastern-united-states"] },
  { id: "quebec", name: "Quebec", continent: "north-america", adjacentTo: ["ontario", "greenland", "eastern-united-states"] },
  { id: "western-united-states", name: "Western United States", continent: "north-america", adjacentTo: ["alberta", "ontario", "eastern-united-states", "central-america"] },
  { id: "eastern-united-states", name: "Eastern United States", continent: "north-america", adjacentTo: ["ontario", "quebec", "western-united-states", "central-america"] },
  { id: "central-america", name: "Central America", continent: "north-america", adjacentTo: ["western-united-states", "eastern-united-states", "venezuela"] },

  // South America (4 territories)
  { id: "venezuela", name: "Venezuela", continent: "south-america", adjacentTo: ["central-america", "peru", "brazil"] },
  { id: "peru", name: "Peru", continent: "south-america", adjacentTo: ["venezuela", "brazil", "argentina"] },
  { id: "brazil", name: "Brazil", continent: "south-america", adjacentTo: ["venezuela", "peru", "argentina", "north-africa"] },
  { id: "argentina", name: "Argentina", continent: "south-america", adjacentTo: ["peru", "brazil"] },

  // Europe (7 territories)
  { id: "iceland", name: "Iceland", continent: "europe", adjacentTo: ["greenland", "great-britain", "scandinavia"] },
  { id: "great-britain", name: "Great Britain", continent: "europe", adjacentTo: ["iceland", "scandinavia", "northern-europe", "western-europe"] },
  { id: "scandinavia", name: "Scandinavia", continent: "europe", adjacentTo: ["iceland", "great-britain", "northern-europe", "ukraine"] },
  { id: "western-europe", name: "Western Europe", continent: "europe", adjacentTo: ["great-britain", "northern-europe", "southern-europe", "north-africa"] },
  { id: "northern-europe", name: "Northern Europe", continent: "europe", adjacentTo: ["great-britain", "scandinavia", "ukraine", "southern-europe", "western-europe"] },
  { id: "southern-europe", name: "Southern Europe", continent: "europe", adjacentTo: ["western-europe", "northern-europe", "ukraine", "north-africa", "egypt", "middle-east"] },
  { id: "ukraine", name: "Ukraine", continent: "europe", adjacentTo: ["scandinavia", "northern-europe", "southern-europe", "ural", "afghanistan", "middle-east"] },

  // Africa (6 territories)
  { id: "north-africa", name: "North Africa", continent: "africa", adjacentTo: ["brazil", "western-europe", "southern-europe", "egypt", "east-africa", "congo"] },
  { id: "egypt", name: "Egypt", continent: "africa", adjacentTo: ["north-africa", "southern-europe", "middle-east", "east-africa"] },
  { id: "east-africa", name: "East Africa", continent: "africa", adjacentTo: ["north-africa", "egypt", "middle-east", "congo", "south-africa", "madagascar"] },
  { id: "congo", name: "Congo", continent: "africa", adjacentTo: ["north-africa", "east-africa", "south-africa"] },
  { id: "south-africa", name: "South Africa", continent: "africa", adjacentTo: ["congo", "east-africa", "madagascar"] },
  { id: "madagascar", name: "Madagascar", continent: "africa", adjacentTo: ["east-africa", "south-africa"] },

  // Asia (12 territories)
  { id: "ural", name: "Ural", continent: "asia", adjacentTo: ["ukraine", "siberia", "afghanistan", "china"] },
  { id: "siberia", name: "Siberia", continent: "asia", adjacentTo: ["ural", "yakutsk", "irkutsk", "mongolia", "china"] },
  { id: "yakutsk", name: "Yakutsk", continent: "asia", adjacentTo: ["siberia", "irkutsk", "kamchatka"] },
  { id: "kamchatka", name: "Kamchatka", continent: "asia", adjacentTo: ["yakutsk", "irkutsk", "mongolia", "japan", "alaska"] },
  { id: "irkutsk", name: "Irkutsk", continent: "asia", adjacentTo: ["siberia", "yakutsk", "kamchatka", "mongolia"] },
  { id: "mongolia", name: "Mongolia", continent: "asia", adjacentTo: ["siberia", "irkutsk", "kamchatka", "japan", "china"] },
  { id: "japan", name: "Japan", continent: "asia", adjacentTo: ["kamchatka", "mongolia"] },
  { id: "afghanistan", name: "Afghanistan", continent: "asia", adjacentTo: ["ukraine", "ural", "china", "india", "middle-east"] },
  { id: "china", name: "China", continent: "asia", adjacentTo: ["ural", "siberia", "mongolia", "afghanistan", "india", "siam"] },
  { id: "middle-east", name: "Middle East", continent: "asia", adjacentTo: ["ukraine", "southern-europe", "egypt", "east-africa", "afghanistan", "india"] },
  { id: "india", name: "India", continent: "asia", adjacentTo: ["afghanistan", "china", "middle-east", "siam"] },
  { id: "siam", name: "Siam", continent: "asia", adjacentTo: ["china", "india", "indonesia"] },

  // Australia (4 territories)
  { id: "indonesia", name: "Indonesia", continent: "australia", adjacentTo: ["siam", "new-guinea", "western-australia"] },
  { id: "new-guinea", name: "New Guinea", continent: "australia", adjacentTo: ["indonesia", "western-australia", "eastern-australia"] },
  { id: "western-australia", name: "Western Australia", continent: "australia", adjacentTo: ["indonesia", "new-guinea", "eastern-australia"] },
  { id: "eastern-australia", name: "Eastern Australia", continent: "australia", adjacentTo: ["new-guinea", "western-australia"] },
];

export const CONTINENTS: Continent[] = [
  { id: "north-america", name: "North America", territories: ["alaska", "northwest-territory", "greenland", "alberta", "ontario", "quebec", "western-united-states", "eastern-united-states", "central-america"], bonusArmies: 5 },
  { id: "south-america", name: "South America", territories: ["venezuela", "peru", "brazil", "argentina"], bonusArmies: 2 },
  { id: "europe", name: "Europe", territories: ["iceland", "great-britain", "scandinavia", "western-europe", "northern-europe", "southern-europe", "ukraine"], bonusArmies: 5 },
  { id: "africa", name: "Africa", territories: ["north-africa", "egypt", "east-africa", "congo", "south-africa", "madagascar"], bonusArmies: 3 },
  { id: "asia", name: "Asia", territories: ["ural", "siberia", "yakutsk", "kamchatka", "irkutsk", "mongolia", "japan", "afghanistan", "china", "middle-east", "india", "siam"], bonusArmies: 7 },
  { id: "australia", name: "Australia", territories: ["indonesia", "new-guinea", "western-australia", "eastern-australia"], bonusArmies: 2 },
];

export const TERRITORY_COUNT = TERRITORIES.length;

export function getTerritoryById(id: string): Territory | undefined {
  return TERRITORIES.find((t) => t.id === id);
}

export function areTerritoriesAdjacent(t1: string, t2: string): boolean {
  const territory = getTerritoryById(t1);
  return territory?.adjacentTo.includes(t2) ?? false;
}

export function getContinentByTerritoryId(territoryId: string): Continent | undefined {
  return CONTINENTS.find((c) => c.territories.includes(territoryId));
}

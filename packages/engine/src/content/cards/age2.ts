import type { CardDef } from "./types";

export const JET_STRIKER: CardDef = {
  id: "champion.age2.jet_striker",
  name: "Jet Striker",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 3,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};

export const TAX_REAVER: CardDef = {
  id: "champion.age2.tax_reaver",
  name: "Tax Reaver",
  rulesText:
    "Extort: When it kills a Champion, take up to 2 gold from that player (if possible).",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const SIEGE_ENGINEER: CardDef = {
  id: "champion.age2.siege_engineer",
  name: "Siege Engineer",
  rulesText: "On deploy: destroy 1 Bridge adjacent to its hex.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};

export const DUELIST_EXEMPLAR: CardDef = {
  id: "champion.age2.duelist_exemplar",
  name: "Duelist Exemplar",
  rulesText:
    "If any enemy Champion is in its battle, roll +1 die each combat round.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};

export const LONE_WOLF: CardDef = {
  id: "champion.age2.lone_wolf",
  name: "Lone Wolf",
  rulesText: "If there are no friendly Forces, roll 3 extra dice.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 1,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const RELIABLE_VETERAN: CardDef = {
  id: "champion.age2.reliable_veteran",
  name: "Reliable Veteran",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 65,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 1,
    hitFaces: 5,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const CAPTURER: CardDef = {
  id: "champion.age2.capturer",
  name: "Capturer",
  rulesText:
    "When this Champion wins a battle, deploy 1 Force to the hex it occupies.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 3,
    bounty: 0,
    goldCostByChampionCount: [1, 2, 5]
  }
};

export const AGE2_CARDS: CardDef[] = [
  JET_STRIKER,
  TAX_REAVER,
  SIEGE_ENGINEER,
  DUELIST_EXEMPLAR,
  LONE_WOLF,
  RELIABLE_VETERAN,
  CAPTURER
];

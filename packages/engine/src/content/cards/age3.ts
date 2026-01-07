import type { CardDef } from "./types";

export const LOGISTICS_OFFICER: CardDef = {
  id: "champion.age3.logistics_officer",
  name: "Logistics Officer",
  rulesText: "You may deploy to this Champion as if it were your Capital.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const TITAN_VANGUARD: CardDef = {
  id: "champion.age3.titan_vanguard",
  name: "Titan Vanguard",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 10,
    attackDice: 2,
    hitFaces: 3,
    bounty: 5,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const CENTER_BANNERMAN: CardDef = {
  id: "champion.age3.center_bannerman",
  name: "Center Bannerman",
  rulesText: "Worth 1 VP while occupying the Center.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 3,
    attackDice: 2,
    hitFaces: 2,
    bounty: 5,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const BLOOD_BANKER: CardDef = {
  id: "champion.age3.blood_banker",
  name: "Blood Banker",
  rulesText:
    "Blood Ledger (1/round): First time a Champion dies in this hex, gain +2 gold.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 7,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const STORMCALLER: CardDef = {
  id: "champion.age3.stormcaller",
  name: "Stormcaller",
  rulesText:
    "Tempest (1/round): deal 1 damage to every enemy Champion in adjacent hexes.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 8,
    attackDice: 3,
    hitFaces: 2,
    bounty: 4,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const GRAND_STRATEGIST: CardDef = {
  id: "champion.age3.grand_strategist",
  name: "Grand Strategist",
  rulesText:
    "Tactical Hand (1/round): in a battle it’s in, you may assign 3 of your hits.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 25,
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

export const CAPITAL_BREAKER: CardDef = {
  id: "champion.age3.capital_breaker",
  name: "Capital Breaker",
  rulesText:
    "Breach: In Capital sieges this round, your Forces in that siege hit on 1–3 in combat round 1.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 8,
    attackDice: 3,
    hitFaces: 3,
    bounty: 4,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const AGE3_CARDS: CardDef[] = [
  LOGISTICS_OFFICER,
  TITAN_VANGUARD,
  CENTER_BANNERMAN,
  BLOOD_BANKER,
  STORMCALLER,
  GRAND_STRATEGIST,
  CAPITAL_BREAKER
];

import type { CardDef } from "./types";

export const GRAND_MANEUVER: CardDef = {
  id: "age3.grand_maneuver",
  name: "Grand Maneuver",
  rulesText: "Move up to 2 different stacks up to 3 hexes along Bridges each.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 3,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 3 }]
};

export const GHOST_STEP: CardDef = {
  id: "age3.ghost_step",
  name: "Ghost Step",
  rulesText: "Move 1 stack up to 2 hexes ignoring Bridges. Burn.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 30,
  burn: true,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: false
  },
  effects: [{ kind: "moveStack", maxDistance: 2, requiresBridge: false }]
};

export const DEEP_RESERVES: CardDef = {
  id: "age3.deep_reserves",
  name: "Deep Reserves",
  rulesText: "Deploy 8 Forces to your Capital.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2, gold: 2 },
  initiative: 80,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 8 }]
};

export const FORWARD_LEGION: CardDef = {
  id: "age3.forward_legion",
  name: "Forward Legion",
  rulesText: "Deploy 5 Forces to a hex you occupy.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1, gold: 3 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "deployForces", count: 5 }]
};

export const ROYAL_MINT: CardDef = {
  id: "age3.royal_mint",
  name: "Royal Mint",
  rulesText: "Gain 5 gold.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 65,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 5 }]
};

export const TOME_OF_ORDERS: CardDef = {
  id: "age3.tome_of_orders",
  name: "Tome of Orders",
  rulesText: "Draw 2 cards. Then you may put 1 card from your hand on top of your draw pile.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 2 },
    { kind: "topdeckFromHand", count: 1 }
  ]
};

export const LAST_LECTURE: CardDef = {
  id: "age3.last_lecture",
  name: "Last Lecture",
  rulesText: "Draw 5 cards. Burn.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 80,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 5 }]
};

export const EXECUTION_ORDER: CardDef = {
  id: "age3.execution_order",
  name: "Execution Order",
  rulesText: "Deal 3 damage to an enemy Champion within 2 hexes of your Champion.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "enemy",
    requiresFriendlyChampion: true,
    maxDistance: 2
  },
  effects: [{ kind: "dealChampionDamage", amount: 3 }]
};

export const WORMHOLE_GATE: CardDef = {
  id: "age3.wormhole_gate",
  name: "Wormhole Gate",
  rulesText: "Choose 2 hexes anywhere on the board; treat them as adjacent this round. Burn.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hexPair",
    allowSame: false
  },
  effects: [{ kind: "linkHexes" }]
};

export const CONQUEST_RECORD: CardDef = {
  id: "age3.conquest_record",
  name: "Conquest Record",
  rulesText: "When played: Gain 3 gold.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 3 }]
};

export const FINAL_OATH: CardDef = {
  id: "age3.final_oath",
  name: "Final Oath",
  rulesText: "When played: Heal a friendly Champion anywhere 2.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "healChampion", amount: 2 }]
};

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
  GRAND_MANEUVER,
  GHOST_STEP,
  DEEP_RESERVES,
  FORWARD_LEGION,
  ROYAL_MINT,
  TOME_OF_ORDERS,
  LAST_LECTURE,
  EXECUTION_ORDER,
  WORMHOLE_GATE,
  CONQUEST_RECORD,
  FINAL_OATH,
  LOGISTICS_OFFICER,
  TITAN_VANGUARD,
  CENTER_BANNERMAN,
  BLOOD_BANKER,
  STORMCALLER,
  GRAND_STRATEGIST,
  CAPITAL_BREAKER
];

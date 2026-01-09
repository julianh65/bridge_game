import type { CardDef } from "./types";

export const COMMAND_SURGE: CardDef = {
  id: "power.age1.command_surge",
  name: "Command Surge",
  rulesText: "Gain +2 mana. Burn.",
  type: "Spell",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 0 },
  initiative: 10,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMana", amount: 2 }]
};

export const INSTANT_BRIDGE_NET: CardDef = {
  id: "power.age1.instant_bridge_net",
  name: "Instant Bridge Net",
  rulesText: "Build 3 Bridges, each touching a hex you occupy. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "multiEdge",
    minEdges: 3,
    maxEdges: 3
  },
  effects: [{ kind: "buildBridge" }]
};

export const SECRET_PLANS: CardDef = {
  id: "power.age1.secret_plans",
  name: "Secret Plans",
  rulesText: "Draw 2. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 0 },
  initiative: 15,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 2 }]
};

export const EMERGENCY_PAY: CardDef = {
  id: "power.age1.emergency_pay",
  name: "Emergency Pay",
  rulesText: "Gain +5 gold. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 50,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 5 }]
};

export const SHOCK_DRILL: CardDef = {
  id: "power.age1.shock_drill",
  name: "Shock Drill",
  rulesText:
    "In your next battle this round, your Forces hit on 1–5 in combat round 1. Burn.",
  type: "Spell",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 45,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "shockDrill" }]
};

export const BRIDGE_DEED: CardDef = {
  id: "power.age1.bridge_deed",
  name: "Bridge Deed",
  rulesText:
    "When played: Build 1 Bridge. Then you may move 1 stack 1 hex along a Bridge.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "edge",
    requiresOccupiedEndpoint: true
  },
  effects: [{ kind: "buildBridge" }, { kind: "moveStack", maxDistance: 1 }],
  victoryPoints: 1
};

export const MINE_CHARTER: CardDef = {
  id: "power.age1.mine_charter",
  name: "Mine Charter",
  rulesText: "When played: Gain +1 gold; if you occupy a Mine, gain +2 instead.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 1, bonusIfMine: 1 }],
  victoryPoints: 1
};

export const FORGE_SKETCH: CardDef = {
  id: "power.age1.forge_sketch",
  name: "Forge Sketch",
  rulesText: "When played: You may discard 1 card; if you do, draw 2.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "discardFromHand", count: 1 },
    { kind: "drawCards", count: 2 }
  ],
  victoryPoints: 1
};

export const CENTER_WRIT: CardDef = {
  id: "power.age1.center_writ",
  name: "Center Writ",
  rulesText: "When played: If you occupy Center, gain +1 mana.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 25,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainManaIfTile", tile: "center", amount: 1 }],
  victoryPoints: 1
};

export const OATHSTONE: CardDef = {
  id: "power.age1.oathstone",
  name: "Oathstone",
  rulesText: "When played: Heal a friendly Champion in your hex 2.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "healChampion", amount: 2 }],
  victoryPoints: 1
};

export const BANNER_OF_SPARKS: CardDef = {
  id: "power.age1.banner_of_sparks",
  name: "Banner of Sparks",
  rulesText: "When played: Deploy 3 Forces to your Capital.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 3 }],
  victoryPoints: 1
};

export const IMMUNITY_FIELD: CardDef = {
  id: "power.age2.immunity_field",
  name: "Immunity Field",
  rulesText: "Your champions cannot be targeted by enemy spells this round. Burn.",
  type: "Spell",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 2 },
  initiative: 40,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "immunityField" }]
};

export const RAPID_REINFORCEMENTS: CardDef = {
  id: "power.age2.rapid_reinforcements",
  name: "Rapid Reinforcements",
  rulesText: "Deploy 6 Forces to any hex you occupy. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "deployForces", count: 6 }]
};

export const HERO_JOINS_BATTLE: CardDef = {
  id: "power.age2.hero_joins_battle",
  name: "A Hero Joins the Battle",
  rulesText:
    "Randomly select from all 2 mana heroes and deploy them for free into your capital. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "deployRandomChampion", manaCost: 2 }]
};

export const WRIT_OF_INDUSTRY: CardDef = {
  id: "power.age2.writ_of_industry",
  name: "Writ of Industry",
  rulesText: "When played: If you occupy a Mine, gain +2 gold; else gain +1.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 1, bonusIfMine: 1 }],
  victoryPoints: 1
};

export const BRIDGE_CHARTER: CardDef = {
  id: "power.age2.bridge_charter",
  name: "Bridge Charter",
  rulesText: "When played: Build 2 Bridges, each touching a hex you occupy.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "multiEdge",
    minEdges: 2,
    maxEdges: 2
  },
  effects: [{ kind: "buildBridge" }],
  victoryPoints: 1
};

export const DISPATCH_TO_FRONT: CardDef = {
  id: "power.age2.dispatch_to_front",
  name: "Dispatch to Front",
  rulesText:
    "When played: Deploy 2 Forces to a hex you occupy that contains a Champion.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "deployForces", count: 2 }],
  victoryPoints: 1
};

export const BANNERMAN: CardDef = {
  id: "champion.power.bannerman",
  name: "Bannerman",
  rulesText: "Worth 1 VP while on the board.",
  type: "Champion",
  deck: "power",
  tags: ["power", "age2"],
  cost: { mana: 3 },
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

export const QUICK_MOBILIZATION: CardDef = {
  id: "power.age3.quick_mobilization",
  name: "Quick Mobilization",
  rulesText: "Move 2 stacks up to 3 along Bridges each. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 1 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 3,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 3 }]
};

export const FINAL_FUNDING: CardDef = {
  id: "power.age3.final_funding",
  name: "Final Funding",
  rulesText: "Gain +15 gold. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 3 },
  initiative: 50,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 15 }]
};

export const LAST_STAND: CardDef = {
  id: "power.age3.last_stand",
  name: "Last Stand",
  rulesText:
    "Until end of round, the first time an enemy stack enters your Capital, destroy 3 entering enemy Forces (random) before the siege. Burn.",
  type: "Spell",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 2 },
  initiative: 75,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "lastStand", forceLoss: 3 }]
};

export const IMPERIAL_WARRANT: CardDef = {
  id: "power.age3.imperial_warrant",
  name: "Imperial Warrant",
  rulesText: "When played: Move 1 stack up to 2 along Bridges.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 2 }],
  victoryPoints: 1
};

export const CROWN_COIN: CardDef = {
  id: "power.age3.crown_coin",
  name: "Crown Coin",
  rulesText: "When played: Gain +2 gold.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 2 }],
  victoryPoints: 1
};

export const DEEP_MINE_CHARTER: CardDef = {
  id: "power.age3.deep_mine_charter",
  name: "Deep Mine Charter",
  rulesText:
    "When played: Increase a Mine you occupy by +1 value (max 7).",
  type: "Victory",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 1, gold: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    tile: "mine"
  },
  effects: [{ kind: "increaseMineValue", amount: 1, maxValue: 7 }],
  victoryPoints: 1
};

export const SIEGE_CHRONICLE: CardDef = {
  id: "power.age3.siege_chronicle",
  name: "Siege Chronicle",
  rulesText:
    "When played: If your Capital currently contains enemy units, deploy 3 Forces to your Capital.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age3"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "deployForcesIfEnemyInCapital", count: 3 }],
  victoryPoints: 1
};

export const AGE1_POWER_CARDS: CardDef[] = [
  COMMAND_SURGE,
  INSTANT_BRIDGE_NET,
  SECRET_PLANS,
  EMERGENCY_PAY,
  SHOCK_DRILL,
  BRIDGE_DEED,
  MINE_CHARTER,
  FORGE_SKETCH,
  CENTER_WRIT,
  OATHSTONE,
  BANNER_OF_SPARKS
];

export const AGE2_POWER_CARDS: CardDef[] = [
  IMMUNITY_FIELD,
  RAPID_REINFORCEMENTS,
  HERO_JOINS_BATTLE,
  WRIT_OF_INDUSTRY,
  BRIDGE_CHARTER,
  DISPATCH_TO_FRONT,
  BANNERMAN
];

export const AGE3_POWER_CARDS: CardDef[] = [
  QUICK_MOBILIZATION,
  FINAL_FUNDING,
  LAST_STAND,
  IMPERIAL_WARRANT,
  CROWN_COIN,
  DEEP_MINE_CHARTER,
  SIEGE_CHRONICLE
];

export const POWER_CARDS: CardDef[] = [
  ...AGE1_POWER_CARDS,
  ...AGE2_POWER_CARDS,
  ...AGE3_POWER_CARDS
];

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

export const POWER_CARDS: CardDef[] = [...AGE1_POWER_CARDS];

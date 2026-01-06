import type { CardDef } from "./types";

export const QUICK_MARCH: CardDef = {
  id: "age1.quick_march",
  name: "Quick March",
  rulesText: "Move 1 stack up to 2 hexes along Bridges.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 2 }]
};

export const FLANK_STEP: CardDef = {
  id: "age1.flank_step",
  name: "Flank Step",
  rulesText: "Move 1 stack 1 hex ignoring Bridges.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "stack",
    owner: "self",
    maxDistance: 1,
    requiresBridge: false
  },
  effects: [{ kind: "moveStack", maxDistance: 1, requiresBridge: false }]
};

export const PROSPECTING: CardDef = {
  id: "age1.prospecting",
  name: "Prospecting",
  rulesText: "Gain +2 gold. If you occupy a Mine, gain +3 gold instead.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 2, bonusIfMine: 1 }]
};

export const TRADE_CARAVAN: CardDef = {
  id: "age1.trade_caravan",
  name: "Trade Caravan",
  rulesText: "Gain +3 gold.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 3 }]
};

export const SCAVENGERS_MARKET: CardDef = {
  id: "age1.scavengers_market",
  name: "Scavenger's Market",
  rulesText: "Gain +1 gold. Draw 1 card.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "gainGold", amount: 1 },
    { kind: "drawCards", count: 1 }
  ]
};

export const TEMPORARY_BRIDGE: CardDef = {
  id: "age1.temporary_bridge",
  name: "Temporary Bridge",
  rulesText:
    "Build 1 Bridge between any two adjacent hexes (no occupancy requirement). Destroy it in Cleanup.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: {
    kind: "edge",
    anywhere: true
  },
  effects: [{ kind: "buildBridge", temporary: true }]
};

export const PATCH_UP: CardDef = {
  id: "age1.patch_up",
  name: "Patch Up",
  rulesText:
    "Heal a friendly Champion anywhere 2. If it is in your Capital, heal 4 instead.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "patchUp", baseHeal: 2, capitalBonus: 2 }]
};

export const QUICK_STUDY: CardDef = {
  id: "age1.quick_study",
  name: "Quick Study",
  rulesText: "Draw 2 cards.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 25,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 2 }]
};

export const SUPPLY_LEDGER: CardDef = {
  id: "age1.supply_ledger",
  name: "Supply Ledger",
  rulesText: "When played: Gain +1 gold.",
  type: "Victory",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 1 }]
};

export const PATROL_RECORD: CardDef = {
  id: "age1.patrol_record",
  name: "Patrol Record",
  rulesText: "When played: Draw 1 card.",
  type: "Victory",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 1 }]
};

export const AGE1_CARDS: CardDef[] = [
  QUICK_MARCH,
  FLANK_STEP,
  PROSPECTING,
  TRADE_CARAVAN,
  SCAVENGERS_MARKET,
  TEMPORARY_BRIDGE,
  PATCH_UP,
  QUICK_STUDY,
  SUPPLY_LEDGER,
  PATROL_RECORD
];

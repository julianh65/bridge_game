import type { CardDef } from "./types";

const createStarterVariant = (
  base: CardDef,
  id: string,
  initiative: number
): CardDef => ({
  ...base,
  id,
  initiative
});

export const RECRUIT: CardDef = {
  id: "starter.recruit",
  name: "Recruit",
  rulesText: "Deploy either 2 Forces into your Capital or 1 Force into a hex you occupy.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1, gold: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [
      { kind: "capital" },
      { kind: "occupiedHex", owner: "self" }
    ]
  },
  effects: [{ kind: "recruit" }]
};

export const MARCH_ORDERS: CardDef = {
  id: "starter.march_orders",
  name: "March Orders",
  rulesText: "Move 1 stack up to 2 hexes along Bridges.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 100,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 2 }]
};

export const SUPPLY_CACHE: CardDef = {
  id: "starter.supply_cache",
  name: "Supply Cache",
  rulesText: "Gain +2 gold.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 2 }]
};

export const FIELD_MEDIC: CardDef = {
  id: "starter.field_medic",
  name: "Field Medic",
  rulesText: "Heal any Champion 2 HP.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "any"
  },
  effects: [{ kind: "healChampion", amount: 2 }]
};

export const BRIDGE_CREW: CardDef = {
  id: "starter.bridge_crew",
  name: "Bridge Crew",
  rulesText:
    "Build 1 Bridge between adjacent hexes where at least one endpoint is a hex you occupy. Then you may move 1 stack 1 hex.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 90,
  burn: false,
  targetSpec: {
    kind: "edge",
    requiresOccupiedEndpoint: true
  },
  effects: [{ kind: "buildBridge" }, { kind: "moveStack", maxDistance: 1 }]
};

export const QUICK_MOVE: CardDef = {
  id: "starter.quick_move",
  name: "Quick Move",
  rulesText: "Move 1 Force you control 1 hex along Bridges. Very low initiative.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 120,
  burn: false,
  targetSpec: {
    kind: "stack",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 1, forceCount: 1 }]
};

export const QUICK_MOVE_VEIL: CardDef = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.veil",
  115
);
export const QUICK_MOVE_AERIAL: CardDef = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.aerial",
  100
);
export const QUICK_MOVE_PROSPECT: CardDef = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.prospect",
  118
);
export const QUICK_MOVE_CIPHER: CardDef = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.cipher",
  117
);
export const QUICK_MOVE_GATEWRIGHT: CardDef = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.gatewright",
  110
);

export const ZAP: CardDef = {
  id: "starter.zap",
  name: "Zap",
  rulesText: "Deal 1 damage to a Champion within distance 1 of one of your Champions.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1, gold: 1 },
  initiative: 220,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "any",
    maxDistance: 1,
    requiresFriendlyChampion: true
  },
  effects: [{ kind: "dealChampionDamage", amount: 1 }]
};

export const ZAP_VEIL: CardDef = createStarterVariant(ZAP, "starter.zap.veil", 215);
export const ZAP_AERIAL: CardDef = createStarterVariant(ZAP, "starter.zap.aerial", 200);
export const ZAP_PROSPECT: CardDef = createStarterVariant(ZAP, "starter.zap.prospect", 218);
export const ZAP_CIPHER: CardDef = createStarterVariant(ZAP, "starter.zap.cipher", 217);
export const ZAP_GATEWRIGHT: CardDef = createStarterVariant(
  ZAP,
  "starter.zap.gatewright",
  210
);

export const STARTER_CARDS: CardDef[] = [
  RECRUIT,
  MARCH_ORDERS,
  SUPPLY_CACHE,
  FIELD_MEDIC,
  BRIDGE_CREW,
  QUICK_MOVE,
  QUICK_MOVE_VEIL,
  QUICK_MOVE_AERIAL,
  QUICK_MOVE_PROSPECT,
  QUICK_MOVE_CIPHER,
  QUICK_MOVE_GATEWRIGHT,
  ZAP,
  ZAP_VEIL,
  ZAP_AERIAL,
  ZAP_PROSPECT,
  ZAP_CIPHER,
  ZAP_GATEWRIGHT
];

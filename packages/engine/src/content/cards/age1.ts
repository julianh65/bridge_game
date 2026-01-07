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

export const RECRUIT_DETACHMENT: CardDef = {
  id: "age1.recruit_detachment",
  name: "Recruit Detachment",
  rulesText: "Deploy 4 Forces to your Capital, OR 2 Forces to a hex you occupy.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2, gold: 1 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [
      { kind: "capital" },
      { kind: "occupiedHex", owner: "self" }
    ]
  },
  effects: [{ kind: "recruit", capitalCount: 4, occupiedCount: 2 }]
};

export const PAID_VOLUNTEERS: CardDef = {
  id: "age1.paid_volunteers",
  name: "Paid Volunteers",
  rulesText: "Deploy 4 Forces to your Capital.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1, gold: 2 },
  initiative: 65,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 4 }]
};

export const ESCORT_DETAIL: CardDef = {
  id: "age1.escort_detail",
  name: "Escort Detail",
  rulesText: "Deploy 2 Forces to a friendly Champion's hex.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1, gold: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "deployForces", count: 2 }]
};

export const NATIONAL_SERVICE: CardDef = {
  id: "age1.national_service",
  name: "National Service",
  rulesText: "Deploy 1 Force to your Capital.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 0, gold: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 1 }]
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

export const SABOTAGE_BRIDGE: CardDef = {
  id: "age1.sabotage_bridge",
  name: "Sabotage Bridge",
  rulesText: "Destroy a Bridge adjacent to a hex you occupy.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 65,
  burn: false,
  targetSpec: {
    kind: "edge"
  },
  effects: [{ kind: "destroyBridge" }]
};

export const BRIDGE_TRAP: CardDef = {
  id: "age1.bridge_trap",
  name: "Bridge Trap",
  rulesText:
    "Choose a Bridge adjacent to a hex you occupy. The first enemy stack to cross it this round loses 1 Force (random).",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "edge"
  },
  effects: [{ kind: "trapBridge" }]
};

export const TUNNEL_NETWORK: CardDef = {
  id: "age1.tunnel_network",
  name: "Tunnel Network",
  rulesText:
    "Your Capital is considered connected to the center by a Bridge until end of round. Burn.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 80,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "linkCapitalToCenter" }]
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

export const BANNER_CLAIM: CardDef = {
  id: "age1.banner_claim",
  name: "Banner Claim",
  rulesText: "When played: Move 1 Force you control 1 hex along a Bridge.",
  type: "Victory",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "stack",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 1, forceCount: 1 }]
};

export const SKIRMISHER_CAPTAIN: CardDef = {
  id: "champion.age1.skirmisher_captain",
  name: "Skirmisher Captain",
  rulesText: "On deploy: Deploy 1 Force to its hex.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 65,
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
    bounty: 2,
    goldCostByChampionCount: [0, 2, 4]
  }
};

export const BRIDGE_RUNNER: CardDef = {
  id: "champion.age1.bridge_runner",
  name: "Bridge Runner",
  rulesText: "Pathfinder: may move to adjacent hexes without Bridges.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
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
    attackDice: 3,
    hitFaces: 2,
    bounty: 2,
    goldCostByChampionCount: [0, 2, 4]
  }
};

export const INSPIRING_GEEZER: CardDef = {
  id: "champion.age1.inspiring_geezer",
  name: "Inspiring Geezer",
  rulesText: "All friendly forces in this hex hit on 1-3.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 2,
    attackDice: 1,
    hitFaces: 2,
    bounty: 2,
    goldCostByChampionCount: [1, 3, 5]
  }
};

export const BRUTE: CardDef = {
  id: "champion.age1.brute",
  name: "Brute",
  rulesText:
    "If there is no enemy Champion in this hex, roll 2 extra dice (total 3) that hit on 1-3.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 1,
    hitFaces: 3,
    bounty: 2,
    goldCostByChampionCount: [2, 4, 6]
  }
};

export const BOUNTY_HUNTER: CardDef = {
  id: "champion.age1.bounty_hunter",
  name: "Bounty Hunter",
  rulesText:
    "Contract Pay: When an enemy Champion dies in a battle this Champion is in, gain +1 gold.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 75,
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
    bounty: 2,
    goldCostByChampionCount: [1, 3, 5]
  }
};

export const SERGEANT: CardDef = {
  id: "champion.age1.sergeant",
  name: "Sergeant",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 3,
    attackDice: 1,
    hitFaces: 3,
    bounty: 1,
    goldCostByChampionCount: [1, 1, 1]
  }
};

export const TRAITOR: CardDef = {
  id: "champion.age1.traitor",
  name: "Traitor",
  rulesText: "Upon death: set the owner's mana to 0.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 3,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 2, 5]
  }
};

export const AGE1_CARDS: CardDef[] = [
  QUICK_MARCH,
  FLANK_STEP,
  PROSPECTING,
  TRADE_CARAVAN,
  RECRUIT_DETACHMENT,
  PAID_VOLUNTEERS,
  ESCORT_DETAIL,
  NATIONAL_SERVICE,
  SCAVENGERS_MARKET,
  TEMPORARY_BRIDGE,
  SABOTAGE_BRIDGE,
  BRIDGE_TRAP,
  TUNNEL_NETWORK,
  PATCH_UP,
  QUICK_STUDY,
  SUPPLY_LEDGER,
  PATROL_RECORD,
  BANNER_CLAIM,
  SKIRMISHER_CAPTAIN,
  BRIDGE_RUNNER,
  INSPIRING_GEEZER,
  BRUTE,
  BOUNTY_HUNTER,
  SERGEANT,
  TRAITOR
];

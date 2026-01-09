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

export const ROLL_OUT: CardDef = {
  id: "age1.roll_out",
  name: "Roll Out",
  rulesText: "Move up to 2 different stacks up to 1 hex along Bridges each.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 1,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 1 }]
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

export const EMERGENCY_EVAC: CardDef = {
  id: "age1.emergency_evac",
  name: "Emergency Evac",
  rulesText: "Move 1 friendly Champion to your Capital. Heal it 1 HP.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "evacuateChampion" }, { kind: "healChampion", amount: 1 }]
};

export const COLUMN_ADVANCE: CardDef = {
  id: "age1.column_advance",
  name: "Column Advance",
  rulesText:
    "Move 1 stack up to 3 hexes along Bridges; must stop if it enters any occupied hex.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 3,
    requiresBridge: true,
    stopOnOccupied: true
  },
  effects: [{ kind: "moveStack", maxDistance: 3, stopOnOccupied: true }]
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

export const SPOILS_OF_WAR: CardDef = {
  id: "age1.spoils_of_war",
  name: "Spoils of War",
  rulesText: "If you win a battle this round, gain +3 gold.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 80,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "battleWinGold", amount: 3 }]
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

export const FRONTIER_CLAIM: CardDef = {
  id: "age1.frontier_claim",
  name: "Frontier Claim",
  rulesText:
    "Deploy 4 Forces to an empty hex within distance 1 of your Capital (ignoring Bridges).",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2, gold: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    maxDistanceFromCapital: 1,
    requiresEmpty: true,
    allowCapital: false
  },
  effects: [{ kind: "deployForces", count: 4 }]
};

export const PROPAGANDA_RECRUITMENT: CardDef = {
  id: "age1.propaganda_recruitment",
  name: "Propaganda Recruitment",
  rulesText:
    "Deploy 0 Forces to your Capital. Increase the amount by 1 each time this card is played (max 10).",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1, gold: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [
    {
      kind: "recruit",
      capitalCount: 0,
      scaleKey: "age1.propaganda_recruitment",
      scaleMax: 10,
      scaleOnPlay: true
    }
  ]
};

export const FUTURE_INVESTMENT: CardDef = {
  id: "age1.future_investment",
  name: "Future Investment",
  rulesText:
    "Deploy 2 Forces to your Capital. Increase the amount by 1 each time this card is discarded (max 10). Burn.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1, gold: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [
    {
      kind: "recruit",
      capitalCount: 2,
      scaleKey: "age1.future_investment",
      scaleMax: 10
    }
  ],
  onDiscard: [{ kind: "incrementCardCounter", key: "age1.future_investment", max: 8 }]
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

export const BATTLE_CRY: CardDef = {
  id: "age1.battle_cry",
  name: "Battle Cry",
  rulesText:
    "Until end of round, the first battle you fight: each of your Champions in that battle rolls +1 die in combat round 1.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "battleCry" }]
};

export const SMOKE_SCREEN: CardDef = {
  id: "age1.smoke_screen",
  name: "Smoke Screen",
  rulesText:
    "Until end of round, the first battle you fight: enemy Forces hit on 1 only in combat round 1.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "smokeScreen" }]
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

export const SCOUT_REPORT: CardDef = {
  id: "age1.scout_report",
  name: "Scout Report",
  rulesText: "Look at the top 3 cards of your draw pile. Put 1 into hand, discard 2.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 220,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "scoutReport", lookCount: 3, keepCount: 1 }]
};

export const MAKE_A_PLAY: CardDef = {
  id: "age1.make_a_play",
  name: "Make a Play",
  rulesText: "Gain 1 mana. Burn.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 0 },
  initiative: 70,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMana", amount: 1 }]
};

export const PAID_LOGISTICS: CardDef = {
  id: "age1.paid_logistics",
  name: "Paid Logistics",
  rulesText: "Gain 1 mana. Burn.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 0, gold: 6 },
  initiative: 70,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMana", amount: 1 }]
};

export const SMALL_HANDS: CardDef = {
  id: "age1.small_hands",
  name: "Small Hands",
  rulesText: "If this is the last card in your hand, draw 3 cards.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCardsIfHandEmpty", count: 3 }]
};

export const PRECISE_PLANNING: CardDef = {
  id: "age1.precise_planning",
  name: "Precise Planning",
  rulesText: "If your draw pile is empty, draw 3 cards and gain 1 mana.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "gainManaIfDrawPileEmpty", amount: 1 },
    { kind: "drawCardsIfDrawPileEmpty", count: 3 }
  ]
};

export const SPELLCASTER: CardDef = {
  id: "age1.spellcaster",
  name: "Spellcaster",
  rulesText: "Draw 1 card. If it is a Spell, draw 2 more.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "spellcaster" }]
};

export const SUPPLY_LEDGER: CardDef = {
  id: "age1.supply_ledger",
  name: "Supply Ledger",
  rulesText: "When played: Gain +1 gold.",
  type: "Victory",
  victoryPoints: 1,
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
  victoryPoints: 1,
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
  victoryPoints: 1,
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

export const FIELD_SURGEON: CardDef = {
  id: "champion.age1.field_surgeon",
  name: "Field Surgeon",
  rulesText: "Stitchwork (1/round): Heal a friendly Champion in this hex 2.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
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
  ROLL_OUT,
  FLANK_STEP,
  EMERGENCY_EVAC,
  COLUMN_ADVANCE,
  PROSPECTING,
  TRADE_CARAVAN,
  SPOILS_OF_WAR,
  RECRUIT_DETACHMENT,
  PAID_VOLUNTEERS,
  ESCORT_DETAIL,
  NATIONAL_SERVICE,
  FRONTIER_CLAIM,
  PROPAGANDA_RECRUITMENT,
  FUTURE_INVESTMENT,
  SCAVENGERS_MARKET,
  TEMPORARY_BRIDGE,
  SABOTAGE_BRIDGE,
  BRIDGE_TRAP,
  TUNNEL_NETWORK,
  PATCH_UP,
  BATTLE_CRY,
  SMOKE_SCREEN,
  QUICK_STUDY,
  SCOUT_REPORT,
  MAKE_A_PLAY,
  PAID_LOGISTICS,
  SPELLCASTER,
  SMALL_HANDS,
  PRECISE_PLANNING,
  SUPPLY_LEDGER,
  PATROL_RECORD,
  BANNER_CLAIM,
  SKIRMISHER_CAPTAIN,
  BRIDGE_RUNNER,
  INSPIRING_GEEZER,
  FIELD_SURGEON,
  BRUTE,
  BOUNTY_HUNTER,
  SERGEANT,
  TRAITOR
];

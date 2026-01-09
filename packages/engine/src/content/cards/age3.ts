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

export const FINAL_PUSH: CardDef = {
  id: "age3.final_push",
  name: "Final Push",
  rulesText:
    "Move 1 stack up to 1 along Bridges. If it wins a battle this round, draw 2 at Cleanup.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [{ kind: "battleWinDraw", drawCount: 2 }, { kind: "moveStack", maxDistance: 1 }]
};

export const EXTRACTION_RUN: CardDef = {
  id: "age3.extraction_run",
  name: "Extraction Run",
  rulesText: "Move 1 Champion to any Mine. Gain 1 gold.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "championMove",
    owner: "self",
    destination: {
      tile: "mine"
    }
  },
  effects: [{ kind: "moveChampion" }, { kind: "gainGold", amount: 1 }]
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

export const ENDLESS_CONSCRIPTION: CardDef = {
  id: "age3.endless_conscription",
  name: "Endless Conscription",
  rulesText:
    "Deploy X Forces to your Capital, where X is the number of cards in your hand.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2, gold: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruitByHandSize" }]
};

export const ELITE_GUARD: CardDef = {
  id: "age3.elite_guard",
  name: "Elite Guard",
  rulesText: "Deploy 5 Forces to your Capital. Heal a Champion there 2.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2, gold: 3 },
  initiative: 50,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [
    { kind: "recruit", capitalCount: 5 },
    { kind: "healChampionInCapital", amount: 2 }
  ]
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

export const MARKET_SQUEEZE: CardDef = {
  id: "age3.market_squeeze",
  name: "Market Squeeze",
  rulesText: "Choose an opponent. They lose up to 3 gold; you gain that much.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 45,
  burn: false,
  targetSpec: { kind: "player", owner: "enemy" },
  effects: [{ kind: "stealGold", amount: 3 }]
};

export const BLACK_MARKET_PULL: CardDef = {
  id: "age3.black_market_pull",
  name: "Black Market Pull",
  rulesText: "Gain 2 random Age III Market cards to your hand. Burn.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMarketCards", age: "III", count: 2 }]
};

export const PULLING_STRINGS: CardDef = {
  id: "age3.pulling_strings",
  name: "Pulling Strings",
  rulesText: "Whenever two other players fight a battle this round, gain 1 gold.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "pullingStrings", amount: 1 }]
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

export const MASTER_PLAN: CardDef = {
  id: "age3.master_plan",
  name: "Master Plan",
  rulesText: "Draw 4, discard 2.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 4 },
    { kind: "discardFromHand", count: 2 }
  ]
};

export const PERFECT_CYCLE: CardDef = {
  id: "age3.perfect_cycle",
  name: "Perfect Cycle",
  rulesText: "Draw 1, burn 1.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 45,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 1 },
    { kind: "burnFromHand", count: 1 }
  ]
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

export const ATTRITION: CardDef = {
  id: "age3.attrition",
  name: "Attrition",
  rulesText:
    "Enemy stack within distance 1 of your Champion: destroy up to 3 enemy Forces. Champions there take 1 damage.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 65,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "enemy",
    maxDistanceFromFriendlyChampion: 1
  },
  effects: [{ kind: "attrition", forceLoss: 3, championDamage: 1 }]
};

export const COMPLETE_ENCIRCLEMENT: CardDef = {
  id: "age3.complete_encirclement",
  name: "Complete Encirclement",
  rulesText:
    "Choose an enemy-occupied hex. If you occupy at least four adjacent hexes, destroy all Forces there and deal 3 damage to all Champions.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "enemy"
  },
  effects: [{ kind: "encirclement", minAdjacent: 4, maxForces: 99, championDamage: 3 }]
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

export const RUIN_THE_SPAN: CardDef = {
  id: "age3.ruin_the_span",
  name: "Ruin the Span",
  rulesText: "Destroy 2 Bridges anywhere.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "multiEdge",
    anywhere: true,
    minEdges: 2,
    maxEdges: 2
  },
  effects: [{ kind: "destroyBridge" }]
};

export const SIEGE_WRIT: CardDef = {
  id: "age3.siege_writ",
  name: "Siege Writ",
  rulesText:
    "If you occupy a hex adjacent to a capital, destroy 4 enemy Forces in that hex.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    allowCapital: false
  },
  effects: [{ kind: "siegeWrit", forceLoss: 4 }]
};

export const LAST_CONTRACT: CardDef = {
  id: "age3.last_contract",
  name: "Last Contract",
  rulesText: "The next Champion card you play this round costs 0 gold and 0 mana. Burn.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 20,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "freeNextChampion", count: 1 }]
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

export const TIMER: CardDef = {
  id: "age3.timer",
  name: "Timer",
  rulesText:
    "Must be played with 5+ mana. End of round: if you occupy the Center, gain 3 VP. Burn.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 35,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "centerVpOnRoundEnd", amount: 3, minMana: 5 }]
};

export const MONUMENT_PLAN: CardDef = {
  id: "age3.monument_plan",
  name: "Monument Plan",
  rulesText: "Gives +2 VP. When played: Discard 1 card.",
  type: "Victory",
  victoryPoints: 2,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "discardFromHand", count: 1 }]
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

export const OBSIDIAN_SENTINEL: CardDef = {
  id: "champion.age3.obsidian_sentinel",
  name: "Obsidian Sentinel",
  rulesText: "No special ability.",
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
    hp: 7,
    attackDice: 3,
    hitFaces: 2,
    bounty: 4,
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
  FINAL_PUSH,
  EXTRACTION_RUN,
  DEEP_RESERVES,
  ENDLESS_CONSCRIPTION,
  ELITE_GUARD,
  FORWARD_LEGION,
  ROYAL_MINT,
  MARKET_SQUEEZE,
  BLACK_MARKET_PULL,
  PULLING_STRINGS,
  TOME_OF_ORDERS,
  LAST_LECTURE,
  MASTER_PLAN,
  PERFECT_CYCLE,
  EXECUTION_ORDER,
  ATTRITION,
  COMPLETE_ENCIRCLEMENT,
  WORMHOLE_GATE,
  RUIN_THE_SPAN,
  SIEGE_WRIT,
  LAST_CONTRACT,
  CONQUEST_RECORD,
  FINAL_OATH,
  TIMER,
  MONUMENT_PLAN,
  LOGISTICS_OFFICER,
  TITAN_VANGUARD,
  OBSIDIAN_SENTINEL,
  CENTER_BANNERMAN,
  BLOOD_BANKER,
  STORMCALLER,
  // TODO: Grand Strategist disabled until manual hit assignment UI lands.
  CAPITAL_BREAKER
];

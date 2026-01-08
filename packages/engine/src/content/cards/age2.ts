import type { CardDef } from "./types";

export const TRIPLE_MARCH: CardDef = {
  id: "age2.triple_march",
  name: "Triple March",
  rulesText: "Move 1 stack up to 3 along Bridges.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 3,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 3 }]
};

export const COORDINATED_ADVANCE: CardDef = {
  id: "age2.coordinated_advance",
  name: "Coordinated Advance",
  rulesText: "Move 2 stacks up to 2 along Bridges each.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 2,
    minPaths: 2,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 2 }]
};

export const BREAKTHROUGH_LINE: CardDef = {
  id: "age2.breakthrough_line",
  name: "Breakthrough Line",
  rulesText:
    "Move 1 stack up to 2 along Bridges. If it wins a battle this round, draw 2 at Cleanup.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "battleWinDraw", drawCount: 2 }, { kind: "moveStack", maxDistance: 2 }]
};

export const FOCUS_FIRE: CardDef = {
  id: "age2.focus_fire",
  name: "Focus Fire",
  rulesText:
    "In your next battle this round, you assign hits you deal instead of random.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "focusFire" }]
};

export const SLOW: CardDef = {
  id: "age2.slow",
  name: "Slow",
  rulesText: "Selected champion rolls only 1 die in their next battle.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "enemy"
  },
  effects: [{ kind: "slow" }]
};

export const WARD: CardDef = {
  id: "age2.ward",
  name: "Ward",
  rulesText: "Choose a friendly Champion. It can't be targeted by enemy cards this round.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "ward" }]
};

export const FRENZY: CardDef = {
  id: "age2.frenzy",
  name: "Frenzy",
  rulesText: "Friendly Champion rolls +2 dice this round; it takes 2 damage immediately.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "frenzy", diceBonus: 2, damage: 2 }]
};

export const REPAIR_ORDERS: CardDef = {
  id: "age2.repair_orders",
  name: "Repair Orders",
  rulesText: "All your champions heal 1.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "healChampions", amount: 1 }]
};

export const GOLD_PLATED_ARMOR: CardDef = {
  id: "age2.gold_plated_armor",
  name: "Gold Plated Armor",
  rulesText:
    "Choose a friendly Champion. This round, each time it would take 1 damage, lose 2 gold and prevent that damage.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "goldPlatedArmor", costPerDamage: 2 }]
};

export const MORTAR_SHOT: CardDef = {
  id: "age2.mortar_shot",
  name: "Mortar Shot",
  rulesText:
    "Target a hex within distance 2 of your forces. 50% chance it hits that hex, otherwise it hits an adjacent hex. Destroy 4 forces and deal 2 damage to any champions in the hit hex.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 300,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    allowEmpty: true
  },
  effects: [{ kind: "mortarShot", maxDistance: 2, forceLoss: 4, damage: 2 }]
};

export const CHAMPION_RECALL: CardDef = {
  id: "age2.champion_recall",
  name: "Champion Recall",
  rulesText: "Recall a friendly Champion to your hand.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "recallChampion" }]
};

export const BURN_THE_BRIDGES: CardDef = {
  id: "age2.burn_the_bridges",
  name: "Burn the Bridges",
  rulesText:
    "Move 1 stack up to 1 along Bridges. After moving destroy every bridge connected to the hex you selected. Burn.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: true,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [
    { kind: "moveStack", maxDistance: 1 },
    { kind: "destroyConnectedBridges" }
  ]
};

export const WAR_TAXES: CardDef = {
  id: "age2.war_taxes",
  name: "War Taxes",
  rulesText: "Gain +4 gold.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 4 }]
};

export const REFINED_INGOTS: CardDef = {
  id: "age2.refined_ingots",
  name: "Refined Ingots",
  rulesText: "Gain +2 gold. If you occupy a Mine, gain +4 gold instead.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 2, bonusIfMine: 2 }]
};

export const GUILD_FAVOR: CardDef = {
  id: "age2.guild_favor",
  name: "Guild Favor",
  rulesText: "Gain +4 gold and draw 1.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 40,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "gainGold", amount: 4 },
    { kind: "drawCards", count: 1 }
  ]
};

export const BRIDGE_LOCKDOWN: CardDef = {
  id: "age2.bridge_lockdown",
  name: "Bridge Lockdown",
  rulesText: "Choose a Bridge adjacent to a hex you occupy; it can't be crossed this round.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 40,
  burn: false,
  targetSpec: { kind: "edge" },
  effects: [{ kind: "lockBridge" }]
};

export const BRIDGE_NETWORK: CardDef = {
  id: "age2.bridge_network",
  name: "Bridge Network",
  rulesText: "Build 3 Bridges, each touching a hex you occupy.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "multiEdge",
    minEdges: 3,
    maxEdges: 3
  },
  effects: [{ kind: "buildBridge" }]
};

export const WORMHOLE_LINK: CardDef = {
  id: "age2.wormhole_link",
  name: "Wormhole Link",
  rulesText:
    "Choose 2 hexes within distance 3 of your Champions; treat them as adjacent until end of round.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 80,
  burn: true,
  targetSpec: {
    kind: "hexPair",
    maxDistanceFromFriendlyChampion: 3
  },
  effects: [{ kind: "linkHexes" }]
};

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

export const GUERILLA_NATIVE_MERCENARY: CardDef = {
  id: "champion.age2.guerilla_native_mercenary",
  name: "Guerilla Native Mercenary",
  rulesText:
    "Can be deployed to any unoccupied hex on the board (in addition to being able to be deployed to anywhere you occupy).",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    allowEmpty: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
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
  TRIPLE_MARCH,
  COORDINATED_ADVANCE,
  BREAKTHROUGH_LINE,
  FOCUS_FIRE,
  SLOW,
  WARD,
  FRENZY,
  REPAIR_ORDERS,
  GOLD_PLATED_ARMOR,
  MORTAR_SHOT,
  CHAMPION_RECALL,
  BURN_THE_BRIDGES,
  WAR_TAXES,
  REFINED_INGOTS,
  GUILD_FAVOR,
  BRIDGE_LOCKDOWN,
  BRIDGE_NETWORK,
  WORMHOLE_LINK,
  JET_STRIKER,
  GUERILLA_NATIVE_MERCENARY,
  TAX_REAVER,
  SIEGE_ENGINEER,
  DUELIST_EXEMPLAR,
  LONE_WOLF,
  RELIABLE_VETERAN,
  CAPTURER
];

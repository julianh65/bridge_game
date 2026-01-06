import type { CardDef } from "./types";

export const HOLD_THE_LINE: CardDef = {
  id: "faction.bastion.hold_the_line",
  name: "Hold the Line",
  rulesText:
    "Choose a hex you occupy. Until end of round, when you defend in that hex, your Forces hit on 1-3.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "holdTheLine" }],
  factionId: "bastion"
};

export const MARKED_FOR_COIN: CardDef = {
  id: "faction.veil.marked_for_coin",
  name: "Marked for Coin",
  rulesText:
    "Mark an enemy Champion within distance 2 of one of your Champions. If it dies before end of round, gain +4 gold.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "enemy",
    maxDistance: 2,
    requiresFriendlyChampion: true
  },
  effects: [{ kind: "markForCoin", bounty: 4 }],
  factionId: "veil"
};

export const AIR_DROP: CardDef = {
  id: "faction.aerial.air_drop",
  name: "Air Drop",
  rulesText:
    "Deploy 3 Forces into any non-Capital hex within distance 1 of one of your Champions (ignores Bridges).",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2, gold: 1 },
  initiative: 30,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    maxDistanceFromFriendlyChampion: 1,
    allowCapital: false,
    ignoresBridges: true
  },
  effects: [{ kind: "deployForces", count: 3, ignoresBridges: true }],
  factionId: "aerial"
};

export const RICH_VEINS: CardDef = {
  id: "faction.prospect.rich_veins",
  name: "Rich Veins",
  rulesText: "If you occupy a Mine, increase its value permanently by 1 (max 7).",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "hex",
    tile: "mine",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "increaseMineValue", amount: 1, maxValue: 7 }],
  factionId: "prospect"
};

export const PERFECT_RECALL: CardDef = {
  id: "faction.cipher.perfect_recall",
  name: "Perfect Recall",
  rulesText: "Draw 1 card. Then you may put 1 card from your hand on top of your draw pile.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 25,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 1 }, { kind: "topdeckFromHand", count: 1 }],
  factionId: "cipher"
};

export const BRIDGEBORN_PATH: CardDef = {
  id: "faction.gatewright.bridgeborn_path",
  name: "Bridgeborn Path",
  rulesText: "Build 1 Bridge anywhere on the board.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: {
    kind: "edge",
    anywhere: true
  },
  effects: [{ kind: "buildBridge" }],
  factionId: "gatewright"
};

export const IRONCLAD_WARDEN: CardDef = {
  id: "champion.bastion.ironclad_warden",
  name: "Ironclad Warden",
  rulesText:
    "Bodyguard: the first hit that would be assigned to a friendly Champion is assigned to a friendly Force instead (if any).",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
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
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "bastion"
};

export const SHADEBLADE: CardDef = {
  id: "champion.veil.shadeblade",
  name: "Shadeblade",
  rulesText:
    "Assassin's Edge (1/round): before combat round 1 of a battle Shadeblade is in, deal 1 damage to an enemy Champion in that hex.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
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
    attackDice: 5,
    hitFaces: 1,
    bounty: 3,
    goldCostByChampionCount: [0, 2, 4]
  },
  factionId: "veil"
};

export const SKYSTRIKER_ACE: CardDef = {
  id: "champion.aerial.skystriker_ace",
  name: "Skystriker Ace",
  rulesText: "Flight: may move to adjacent hexes without Bridges.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
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
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [0, 2, 4]
  },
  factionId: "aerial"
};

export const MINE_OVERSEER: CardDef = {
  id: "champion.prospect.mine_overseer",
  name: "Mine Overseer",
  rulesText: "Extraction: while on a Mine you occupy, that Mine gives +1 gold at Collection.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 65,
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
    bounty: 4,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "prospect"
};

export const ARCHIVIST_PRIME: CardDef = {
  id: "champion.cipher.archivist_prime",
  name: "Archivist Prime",
  rulesText: "Ability: TODO.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
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
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "cipher"
};

export const WORMHOLE_ARTIFICER: CardDef = {
  id: "champion.gatewright.wormhole_artificer",
  name: "Wormhole Artificer",
  rulesText: "Ability: TODO.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 65,
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
  },
  factionId: "gatewright"
};

export const FACTION_SPELLS: CardDef[] = [
  HOLD_THE_LINE,
  MARKED_FOR_COIN,
  AIR_DROP,
  RICH_VEINS,
  PERFECT_RECALL,
  BRIDGEBORN_PATH
];

export const FACTION_CHAMPIONS: CardDef[] = [
  IRONCLAD_WARDEN,
  SHADEBLADE,
  SKYSTRIKER_ACE,
  MINE_OVERSEER,
  ARCHIVIST_PRIME,
  WORMHOLE_ARTIFICER
];

export const FACTION_CARDS: CardDef[] = [...FACTION_SPELLS, ...FACTION_CHAMPIONS];

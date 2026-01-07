import type { CardDefId } from "../../types";

export type CardType = "Order" | "Spell" | "Victory" | "Champion";
export type CardDeck = "starter" | "age1" | "age2" | "age3" | "power";

export type CardCost = {
  mana: number;
  gold?: number;
};

export type TargetSpec = {
  kind: string;
  [key: string]: unknown;
};

export type EffectSpec = {
  kind: string;
  [key: string]: unknown;
};

export type ChampionSpec = {
  hp: number;
  attackDice: number;
  hitFaces: number;
  bounty: number;
  goldCostByChampionCount: number[];
};

export type CardDef = {
  id: CardDefId;
  name: string;
  rulesText: string;
  type: CardType;
  deck: CardDeck;
  tags: string[];
  cost: CardCost;
  initiative: number;
  burn: boolean;
  targetSpec: TargetSpec;
  effects?: EffectSpec[];
  resolve?: (ctx: unknown, state: unknown, card: unknown, targets: unknown) => unknown;
  champion?: ChampionSpec;
  victoryPoints?: number;
  factionId?: string;
};

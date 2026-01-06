import type { CardDef, CardDefId } from "./types";
import { FACTION_CARDS } from "./faction";
import { STARTER_CARDS } from "./starter";

export * from "./types";
export * from "./faction";
export * from "./starter";

export const CARD_DEFS: CardDef[] = [...STARTER_CARDS, ...FACTION_CARDS];

export const CARD_DEFS_BY_ID: Record<CardDefId, CardDef> = CARD_DEFS.reduce(
  (acc, card) => {
    acc[card.id] = card;
    return acc;
  },
  {} as Record<CardDefId, CardDef>
);

export const getCardDef = (id: CardDefId): CardDef | undefined => {
  return CARD_DEFS_BY_ID[id];
};

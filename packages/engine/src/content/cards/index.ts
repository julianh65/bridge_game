import type { CardDef, CardDefId } from "./types";
import { AGE1_CARDS } from "./age1";
import { AGE3_CARDS } from "./age3";
import { FACTION_CARDS } from "./faction";
import { STARTER_CARDS } from "./starter";

export * from "./types";
export * from "./age1";
export * from "./age3";
export * from "./faction";
export * from "./starter";

const addDerivedTags = (card: CardDef): CardDef => {
  const tags = [...card.tags];
  const addTag = (tag: string, condition: boolean) => {
    if (condition && !tags.includes(tag)) {
      tags.push(tag);
    }
  };
  addTag("burn", card.burn);
  addTag("champion", card.type === "Champion");
  addTag("victory", card.type === "Victory");
  addTag("power", card.deck === "power");

  if (tags.length === card.tags.length) {
    return card;
  }
  return { ...card, tags };
};

export const CARD_DEFS: CardDef[] = [
  ...STARTER_CARDS,
  ...FACTION_CARDS,
  ...AGE1_CARDS,
  ...AGE3_CARDS
].map(addDerivedTags);

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

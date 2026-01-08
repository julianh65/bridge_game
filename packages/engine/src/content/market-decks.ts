import type { Age, CardDefId } from "../types";

import { AGE1_CARDS } from "./cards/age1";
import { AGE2_CARDS } from "./cards/age2";
import { AGE3_CARDS } from "./cards/age3";

const toIds = (cards: { id: CardDefId }[]): CardDefId[] => cards.map((card) => card.id);

export const AGE1_MARKET_DECK: CardDefId[] = toIds(AGE1_CARDS);
export const AGE2_MARKET_DECK: CardDefId[] = toIds(AGE2_CARDS);
export const AGE3_MARKET_DECK: CardDefId[] = toIds(AGE3_CARDS);

export const MARKET_DECKS_BY_AGE: Record<Age, CardDefId[]> = {
  I: AGE1_MARKET_DECK,
  II: AGE2_MARKET_DECK,
  III: AGE3_MARKET_DECK
};

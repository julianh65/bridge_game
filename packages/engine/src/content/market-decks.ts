import type { Age, CardDefId } from "../types";

import { AGE1_CARDS } from "./cards/age1";
import { AGE2_CARDS } from "./cards/age2";
import { AGE3_CARDS } from "./cards/age3";

const toIds = (cards: { id: CardDefId }[]): CardDefId[] => cards.map((card) => card.id);

const age1MarketDeck: CardDefId[] = toIds(AGE1_CARDS);
const age2MarketDeck: CardDefId[] = toIds(AGE2_CARDS);
const age3MarketDeck: CardDefId[] = toIds(AGE3_CARDS);

export const MARKET_DECKS_BY_AGE: Record<Age, CardDefId[]> = {
  I: age1MarketDeck,
  II: age2MarketDeck,
  III: age3MarketDeck
};

export const AGE1_MARKET_DECK: CardDefId[] = MARKET_DECKS_BY_AGE.I;
export const AGE2_MARKET_DECK: CardDefId[] = MARKET_DECKS_BY_AGE.II;
export const AGE3_MARKET_DECK: CardDefId[] = MARKET_DECKS_BY_AGE.III;

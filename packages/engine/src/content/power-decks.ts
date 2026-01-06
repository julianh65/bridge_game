import type { Age, CardDefId } from "../types";

import { AGE1_MARKET_DECK, AGE2_MARKET_DECK, AGE3_MARKET_DECK } from "./market-decks";

const clone = (deck: CardDefId[]) => deck.slice();

export const AGE1_POWER_DECK: CardDefId[] = clone(AGE1_MARKET_DECK);
export const AGE2_POWER_DECK: CardDefId[] = clone(AGE2_MARKET_DECK);
export const AGE3_POWER_DECK: CardDefId[] = clone(AGE3_MARKET_DECK);

export const POWER_DECKS_BY_AGE: Record<Age, CardDefId[]> = {
  I: AGE1_POWER_DECK,
  II: AGE2_POWER_DECK,
  III: AGE3_POWER_DECK
};

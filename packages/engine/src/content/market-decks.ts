import type { CardDefId } from "../types";

import { AGE1_CARDS } from "./cards/age1";

const toIds = (cards: { id: CardDefId }[]): CardDefId[] => cards.map((card) => card.id);

export const AGE1_MARKET_DECK: CardDefId[] = toIds(AGE1_CARDS);

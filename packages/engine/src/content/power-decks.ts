import type { Age, CardDefId } from "../types";

import { AGE2_MARKET_DECK, AGE3_MARKET_DECK } from "./market-decks";

const clone = (deck: CardDefId[]) => deck.slice();

export const AGE1_POWER_DECK: CardDefId[] = [
  "power.age1.command_surge",
  "power.age1.instant_bridge_net",
  "power.age1.secret_plans",
  "power.age1.emergency_pay",
  "power.age1.shock_drill",
  "power.age1.bridge_deed",
  "power.age1.mine_charter",
  "power.age1.forge_sketch",
  "power.age1.center_writ",
  "power.age1.oathstone",
  "power.age1.banner_of_sparks"
];
export const AGE2_POWER_DECK: CardDefId[] = clone(AGE2_MARKET_DECK);
export const AGE3_POWER_DECK: CardDefId[] = clone(AGE3_MARKET_DECK);

export const POWER_DECKS_BY_AGE: Record<Age, CardDefId[]> = {
  I: AGE1_POWER_DECK,
  II: AGE2_POWER_DECK,
  III: AGE3_POWER_DECK
};

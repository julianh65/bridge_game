import type { Age, CardDefId } from "../types";

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
export const AGE2_POWER_DECK: CardDefId[] = [
  "power.age2.immunity_field",
  "power.age2.rapid_reinforcements",
  "power.age2.writ_of_industry",
  "power.age2.bridge_charter",
  "power.age2.dispatch_to_front",
  "champion.power.bannerman"
];
export const AGE3_POWER_DECK: CardDefId[] = [
  "power.age3.quick_mobilization",
  "power.age3.final_funding",
  "power.age3.imperial_warrant",
  "power.age3.crown_coin",
  "power.age3.deep_mine_charter"
];

export const POWER_DECKS_BY_AGE: Record<Age, CardDefId[]> = {
  I: AGE1_POWER_DECK,
  II: AGE2_POWER_DECK,
  III: AGE3_POWER_DECK
};

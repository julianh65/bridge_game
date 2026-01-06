import type { CardDefId } from "../types";

export const COMMON_STARTER_DECK: CardDefId[] = [
  "starter.recruit",
  "starter.recruit",
  "starter.march_orders",
  "starter.supply_cache",
  "starter.field_medic",
  "starter.scout_report",
  "starter.bridge_crew",
  "starter.quick_move",
  "starter.zap"
];

export const DEFAULT_FACTION_ID = "bastion";

export const FACTION_STARTER_SPELLS: Record<string, CardDefId> = {
  bastion: "faction.bastion.hold_the_line",
  veil: "faction.veil.marked_for_coin",
  aerial: "faction.aerial.air_drop",
  prospect: "faction.prospect.rich_veins",
  cipher: "faction.cipher.perfect_recall",
  gatewright: "faction.gatewright.bridgeborn_path"
};

export const FACTION_STARTER_CHAMPIONS: Record<string, CardDefId> = {
  bastion: "champion.bastion.ironclad_warden",
  veil: "champion.veil.shadeblade",
  aerial: "champion.aerial.skystriker_ace",
  prospect: "champion.prospect.mine_overseer",
  cipher: "champion.cipher.archivist_prime",
  gatewright: "champion.gatewright.wormhole_artificer"
};

export type StarterFactionCards = {
  factionId: string;
  starterSpellId: CardDefId;
  championId: CardDefId;
  deck: CardDefId[];
};

export const resolveStarterFactionCards = (factionId: string): StarterFactionCards => {
  const hasFaction =
    Boolean(FACTION_STARTER_SPELLS[factionId]) && Boolean(FACTION_STARTER_CHAMPIONS[factionId]);
  const resolvedFaction = hasFaction ? factionId : DEFAULT_FACTION_ID;

  return {
    factionId: resolvedFaction,
    starterSpellId: FACTION_STARTER_SPELLS[resolvedFaction],
    championId: FACTION_STARTER_CHAMPIONS[resolvedFaction],
    deck: COMMON_STARTER_DECK
  };
};

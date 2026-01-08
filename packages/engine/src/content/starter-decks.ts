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

const QUICK_MOVE_ID = "starter.quick_move";
const ZAP_ID = "starter.zap";
const SCOUT_REPORT_ID = "starter.scout_report";

const applyStarterOverrides = (
  overrides: Partial<Record<CardDefId, CardDefId>>
): CardDefId[] => COMMON_STARTER_DECK.map((cardId) => overrides[cardId] ?? cardId);

export const FACTION_STARTER_DECKS: Record<string, CardDefId[]> = {
  bastion: [...COMMON_STARTER_DECK],
  veil: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.veil",
    [ZAP_ID]: "starter.zap.veil",
    [SCOUT_REPORT_ID]: "starter.scout_report.veil"
  }),
  aerial: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.aerial",
    [ZAP_ID]: "starter.zap.aerial",
    [SCOUT_REPORT_ID]: "starter.scout_report.aerial"
  }),
  prospect: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.prospect",
    [ZAP_ID]: "starter.zap.prospect",
    [SCOUT_REPORT_ID]: "starter.scout_report.prospect"
  }),
  cipher: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.cipher",
    [ZAP_ID]: "starter.zap.cipher",
    [SCOUT_REPORT_ID]: "starter.scout_report.cipher"
  }),
  gatewright: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.gatewright",
    [ZAP_ID]: "starter.zap.gatewright",
    [SCOUT_REPORT_ID]: "starter.scout_report.gatewright"
  })
};

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
    deck: FACTION_STARTER_DECKS[resolvedFaction] ?? COMMON_STARTER_DECK
  };
};

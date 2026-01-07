export type FactionOption = {
  id: string;
  name: string;
  symbol: string;
};

export const FACTIONS: FactionOption[] = [
  { id: "bastion", name: "Bastion", symbol: "BA" },
  { id: "veil", name: "Veil", symbol: "VE" },
  { id: "aerial", name: "Aerial", symbol: "AE" },
  { id: "prospect", name: "Prospect", symbol: "PR" },
  { id: "cipher", name: "Cipher", symbol: "CI" },
  { id: "gatewright", name: "Gatewright", symbol: "GW" }
];

const factionById = new Map(FACTIONS.map((faction) => [faction.id, faction]));

export const getFactionName = (id?: string | null): string => {
  if (!id) {
    return "Unassigned";
  }
  return factionById.get(id)?.name ?? id;
};

export const getFactionSymbol = (id?: string | null): string | null => {
  if (!id) {
    return null;
  }
  return factionById.get(id)?.symbol ?? null;
};

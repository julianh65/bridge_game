export type FactionOption = {
  id: string;
  name: string;
  symbol: string;
  description: string;
};

export const FACTIONS: FactionOption[] = [
  {
    id: "bastion",
    name: "Bastion",
    symbol: "BA",
    description: "Fortress builders with shield walls and stubborn champions."
  },
  {
    id: "veil",
    name: "Veil",
    symbol: "VE",
    description: "Shadow tacticians who tag targets and cash in."
  },
  {
    id: "aerial",
    name: "Aerial",
    symbol: "AE",
    description: "Skyborne raiders who drop troops where they want."
  },
  {
    id: "prospect",
    name: "Prospect",
    symbol: "PR",
    description: "Hardy miners who squeeze extra gold from the land."
  },
  {
    id: "cipher",
    name: "Cipher",
    symbol: "CI",
    description: "Scholar tacticians who redraw hands and plan ahead."
  },
  {
    id: "gatewright",
    name: "Gatewright",
    symbol: "GW",
    description: "Portal engineers linking far hexes for surprise moves."
  }
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

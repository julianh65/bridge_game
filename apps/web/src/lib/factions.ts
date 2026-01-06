export type FactionOption = {
  id: string;
  name: string;
};

export const FACTIONS: FactionOption[] = [
  { id: "bastion", name: "Bastion" },
  { id: "veil", name: "Veil" },
  { id: "aerial", name: "Aerial" },
  { id: "prospect", name: "Prospect" },
  { id: "cipher", name: "Cipher" },
  { id: "gatewright", name: "Gatewright" }
];

const factionNameById = new Map(FACTIONS.map((faction) => [faction.id, faction.name]));

export const getFactionName = (id?: string | null): string => {
  if (!id) {
    return "Unassigned";
  }
  return factionNameById.get(id) ?? id;
};

import aerialIconUrl from "../assets/factions/aerial.svg";
import bastionIconUrl from "../assets/factions/bastion.svg";
import cipherIconUrl from "../assets/factions/cipher.svg";
import prospectIconUrl from "../assets/factions/prospect.svg";
import veilIconUrl from "../assets/factions/veil.svg";

export type FactionPassive = {
  name: string;
  description: string;
};

export type FactionOption = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  iconUrl?: string;
  passives: FactionPassive[];
  starterSpellId: string;
  starterChampionId: string;
};

export const FACTIONS: FactionOption[] = [
  {
    id: "bastion",
    name: "Bastion",
    symbol: "BA",
    iconUrl: bastionIconUrl,
    description: "Gravity zealots who entrench, endure, and refuse to be moved.",
    passives: [
      {
        name: "Shield Wall",
        description: "Defending Forces hit on 1-3 in combat round 1."
      },
      {
        name: "Home Guard",
        description: "Deploying at your capital adds +1 Force."
      }
    ],
    starterSpellId: "faction.bastion.hold_the_line",
    starterChampionId: "champion.bastion.ironclad_warden"
  },
  {
    id: "veil",
    name: "Veil",
    symbol: "VE",
    iconUrl: veilIconUrl,
    description: "Silent executioners who profit from marked deaths.",
    passives: [
      {
        name: "Clean Exit",
        description: "Your Champions heal 1 after each battle."
      },
      {
        name: "Contracts",
        description: "Gain +2 gold per enemy Champion you kill."
      }
    ],
    starterSpellId: "faction.veil.marked_for_coin",
    starterChampionId: "champion.veil.shadeblade"
  },
  {
    id: "aerial",
    name: "Aerial",
    symbol: "AE",
    iconUrl: aerialIconUrl,
    description: "Roil-charged raiders who strike anywhere at terrible cost.",
    passives: [
      {
        name: "Tailwind",
        description: "Your first move each round gets +1 distance."
      },
      {
        name: "Wings",
        description: "May deploy to the center if you occupy it."
      }
    ],
    starterSpellId: "faction.aerial.air_drop",
    starterChampionId: "champion.aerial.skystriker_ace"
  },
  {
    id: "prospect",
    name: "Prospect",
    symbol: "PR",
    iconUrl: prospectIconUrl,
    description: "Aurum barons who turn mines into engines of permanence.",
    passives: [
      {
        name: "Ore Cut",
        description: "Mines you collect yield +1 gold."
      },
      {
        name: "Mine Militia",
        description: "Defending Forces in mines hit on 1-3."
      },
      {
        name: "Deep Tunnels",
        description: "Your occupied mines count as adjacent for movement."
      }
    ],
    starterSpellId: "faction.prospect.rich_veins",
    starterChampionId: "champion.prospect.mine_overseer"
  },
  {
    id: "cipher",
    name: "Cipher",
    symbol: "CI",
    iconUrl: cipherIconUrl,
    description: "Cold planners who redraw fate one calculation at a time.",
    passives: [
      {
        name: "Expanded Choice",
        description: "See 1 extra card when choosing from offers."
      },
      {
        name: "Quiet Study",
        description: "After market, discard up to 2 then draw."
      }
    ],
    starterSpellId: "faction.cipher.perfect_recall",
    starterChampionId: "champion.cipher.archivist_prime"
  },
  {
    id: "gatewright",
    name: "Gatewright",
    symbol: "GW",
    description: "Bridge-lords who weaponize pain, access, and siege.",
    passives: [
      {
        name: "Capital Assault",
        description: "Forces in enemy capitals hit on 1-3."
      },
      {
        name: "Capital Claim",
        description: "Enemy capital occupation is worth +2 VP."
      },
      {
        name: "Extortionists",
        description: "When you win a battle, steal up to 2 gold."
      }
    ],
    starterSpellId: "faction.gatewright.bridgeborn_path",
    starterChampionId: "champion.gatewright.wormhole_artificer"
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

export const getFactionIconUrl = (id?: string | null): string | null => {
  if (!id) {
    return null;
  }
  return factionById.get(id)?.iconUrl ?? null;
};

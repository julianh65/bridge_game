import type { CardDef, CardDefId } from "./types";
import type { CardInstanceOverrides } from "../../types";
import { AGE1_CARDS } from "./age1";
import { AGE2_CARDS } from "./age2";
import { AGE3_CARDS } from "./age3";
import { FACTION_CARDS } from "./faction";
import { POWER_CARDS } from "./power";
import { STARTER_CARDS } from "./starter";

export * from "./types";
export * from "./age1";
export * from "./age2";
export * from "./age3";
export * from "./faction";
export * from "./power";
export * from "./starter";

const DERIVED_TAGS = new Set(["burn", "champion", "victory", "power"]);

const addDerivedTags = (card: CardDef): CardDef => {
  const tags = [...card.tags];
  const addTag = (tag: string, condition: boolean) => {
    if (condition && !tags.includes(tag)) {
      tags.push(tag);
    }
  };
  addTag("burn", card.burn);
  addTag("champion", card.type === "Champion");
  addTag("victory", card.type === "Victory");
  addTag("power", card.deck === "power");

  if (tags.length === card.tags.length) {
    return card;
  }
  return { ...card, tags };
};

const stripDerivedTags = (tags: string[]) =>
  tags.filter((tag) => !DERIVED_TAGS.has(tag.trim().toLowerCase()));

export const applyCardInstanceOverrides = (
  card: CardDef,
  overrides?: CardInstanceOverrides | null
): CardDef => {
  if (!overrides) {
    return card;
  }

  const baseGold = card.cost.gold;
  const overrideCost = overrides.cost;
  const manaOverride = overrideCost?.mana;
  const goldOverride = overrideCost?.gold;
  const nextCost = overrideCost
    ? {
        mana:
          typeof manaOverride === "number" && Number.isFinite(manaOverride)
            ? Math.max(0, Math.floor(manaOverride))
            : card.cost.mana,
        ...(typeof goldOverride === "number" && Number.isFinite(goldOverride)
          ? { gold: Math.max(0, Math.floor(goldOverride)) }
          : baseGold !== undefined
            ? { gold: baseGold }
            : {})
      }
    : card.cost;

  const nextInitiative =
    typeof overrides.initiative === "number" && Number.isFinite(overrides.initiative)
      ? Math.max(0, Math.floor(overrides.initiative))
      : card.initiative;
  const nextBurn = typeof overrides.burn === "boolean" ? overrides.burn : card.burn;
  const nextName = overrides.name ?? card.name;
  const nextRulesText = overrides.rulesText ?? card.rulesText;
  const baseTags = overrides.tags ?? card.tags;
  const nextTags = stripDerivedTags(baseTags);

  const addTag = (tag: string, condition: boolean) => {
    if (condition && !nextTags.includes(tag)) {
      nextTags.push(tag);
    }
  };
  addTag("burn", nextBurn);
  addTag("champion", card.type === "Champion");
  addTag("victory", card.type === "Victory");
  addTag("power", card.deck === "power");

  return {
    ...card,
    name: nextName,
    rulesText: nextRulesText,
    cost: nextCost,
    initiative: nextInitiative,
    burn: nextBurn,
    tags: nextTags
  };
};

export const CARD_DEFS: CardDef[] = [
  ...STARTER_CARDS,
  ...FACTION_CARDS,
  ...AGE1_CARDS,
  ...AGE2_CARDS,
  ...AGE3_CARDS,
  ...POWER_CARDS
].map(addDerivedTags);

export const CARD_DEFS_BY_ID: Record<CardDefId, CardDef> = CARD_DEFS.reduce(
  (acc, card) => {
    acc[card.id] = card;
    return acc;
  },
  {} as Record<CardDefId, CardDef>
);

export const getCardDef = (id: CardDefId): CardDef | undefined => {
  return CARD_DEFS_BY_ID[id];
};

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config";
import { COMMON_STARTER_DECK, FACTION_STARTER_CHAMPIONS, FACTION_STARTER_SPELLS } from "../starter-decks";
import { CARD_DEFS, getCardDef } from "./index";

const collectValues = (record: Record<string, string>): string[] => Object.values(record);

describe("card registry", () => {
  it("uses unique card ids", () => {
    const ids = CARD_DEFS.map((card) => card.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("covers the free starting card pool", () => {
    for (const id of DEFAULT_CONFIG.freeStartingCardPool) {
      expect(getCardDef(id)).toBeDefined();
    }
  });

  it("covers starter deck and faction starter cards", () => {
    const starterIds = [
      ...COMMON_STARTER_DECK,
      ...collectValues(FACTION_STARTER_SPELLS),
      ...collectValues(FACTION_STARTER_CHAMPIONS)
    ];

    for (const id of starterIds) {
      expect(getCardDef(id)).toBeDefined();
    }
  });
});

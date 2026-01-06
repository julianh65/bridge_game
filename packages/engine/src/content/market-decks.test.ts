import { describe, expect, it } from "vitest";

import { getCardDef } from "./cards";
import { AGE1_MARKET_DECK } from "./market-decks";

describe("market decks", () => {
  it("ships a non-empty age 1 deck", () => {
    expect(AGE1_MARKET_DECK.length).toBeGreaterThan(0);
  });

  it("uses unique card ids", () => {
    const unique = new Set(AGE1_MARKET_DECK);
    expect(unique.size).toBe(AGE1_MARKET_DECK.length);
  });

  it("references only registered age 1 cards", () => {
    for (const id of AGE1_MARKET_DECK) {
      const card = getCardDef(id);
      expect(card).toBeDefined();
      expect(card?.deck).toBe("age1");
    }
  });
});

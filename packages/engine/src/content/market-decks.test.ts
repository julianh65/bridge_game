import { describe, expect, it } from "vitest";

import { getCardDef } from "./cards";
import { AGE1_MARKET_DECK, AGE2_MARKET_DECK, AGE3_MARKET_DECK } from "./market-decks";

describe("market decks", () => {
  const decks = [
    { label: "age 1", deck: AGE1_MARKET_DECK, expectedDeck: "age1" },
    { label: "age 2", deck: AGE2_MARKET_DECK, expectedDeck: "age2" },
    { label: "age 3", deck: AGE3_MARKET_DECK, expectedDeck: "age3" }
  ];

  for (const { label, deck, expectedDeck } of decks) {
    it(`ships a non-empty ${label} deck`, () => {
      expect(deck.length).toBeGreaterThan(0);
    });

    it(`uses unique card ids for ${label}`, () => {
      const unique = new Set(deck);
      expect(unique.size).toBe(deck.length);
    });

    it(`references only registered ${label} cards`, () => {
      for (const id of deck) {
        const card = getCardDef(id);
        expect(card).toBeDefined();
        expect(card?.deck).toBe(expectedDeck);
      }
    });
  }
});

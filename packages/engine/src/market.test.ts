import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";
import { AGE1_MARKET_DECK } from "./content/market-decks";
import { prepareMarketRow } from "./market";

describe("market", () => {
  it("initializes market decks from age lists", () => {
    const state = createNewGame(DEFAULT_CONFIG, 7, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    expect(state.marketDecks.I.length).toBe(AGE1_MARKET_DECK.length);
    expect(state.marketDecks.II.length).toBe(0);
    expect(state.marketDecks.III.length).toBe(0);
    expect([...state.marketDecks.I].sort()).toEqual([...AGE1_MARKET_DECK].sort());
  });

  it("builds a market row using preview counts", () => {
    const config = {
      ...DEFAULT_CONFIG,
      marketPreviewByRound: { ...DEFAULT_CONFIG.marketPreviewByRound, 2: 1 }
    };
    const base = createNewGame(config, 11, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const state = {
      ...base,
      round: 2,
      phase: "round.market",
      market: {
        ...base.market,
        age: "I",
        currentRow: [],
        passPot: 5,
        bids: {
          p1: { kind: "buy", amount: 2 },
          p2: { kind: "pass", amount: 1 }
        },
        playersOut: {
          p1: true,
          p2: false
        }
      },
      marketDecks: {
        I: ["age1.card.a", "age1.card.b"],
        II: ["age2.card.a", "age2.card.b"],
        III: []
      }
    };

    const next = prepareMarketRow(state);

    expect(next.market.currentRow).toHaveLength(2);
    expect(next.market.currentRow.every((card) => card.revealed)).toBe(true);
    expect(next.market.currentRow.filter((card) => card.age === "I")).toHaveLength(1);
    expect(next.market.currentRow.filter((card) => card.age === "II")).toHaveLength(1);
    expect(next.market.rowIndexResolving).toBe(0);
    expect(next.market.passPot).toBe(0);
    expect(next.market.bids.p1).toBeNull();
    expect(next.market.bids.p2).toBeNull();
    expect(next.market.playersOut.p1).toBe(false);
    expect(next.market.playersOut.p2).toBe(false);

    const rowIds = next.market.currentRow.map((card) => card.cardId);
    expect(next.marketDecks.I.length).toBe(1);
    expect(next.marketDecks.II.length).toBe(1);
    for (const id of rowIds) {
      expect(next.marketDecks.I).not.toContain(id);
      expect(next.marketDecks.II).not.toContain(id);
    }
  });

  it("skips draw when a market row already exists", () => {
    const base = createNewGame(DEFAULT_CONFIG, 2, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const state = {
      ...base,
      market: {
        ...base.market,
        currentRow: [{ cardId: "age1.card.a", age: "I", revealed: true }]
      }
    };

    const next = prepareMarketRow(state);

    expect(next).toBe(state);
  });
});

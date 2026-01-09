import { afterEach, describe, expect, it, vi } from "vitest";
import * as shared from "@bridgefront/shared";

import { DEFAULT_CONFIG } from "./config";
import { createNewGame, applyCommand, runUntilBlocked } from "./engine";
import {
  AGE1_MARKET_DECK,
  AGE2_MARKET_DECK,
  AGE3_MARKET_DECK
} from "./content/market-decks";
import {
  AGE1_POWER_DECK,
  AGE2_POWER_DECK,
  AGE3_POWER_DECK
} from "./content/power-decks";
import { prepareMarketRow } from "./market";
import type { GameState } from "./types";

describe("market", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes market decks from age lists", () => {
    const state = createNewGame(DEFAULT_CONFIG, 7, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    expect(state.marketDecks.I.length).toBe(AGE1_MARKET_DECK.length);
    expect(state.marketDecks.II.length).toBe(AGE2_MARKET_DECK.length);
    expect(state.marketDecks.III.length).toBe(AGE3_MARKET_DECK.length);
    expect([...state.marketDecks.I].sort()).toEqual([...AGE1_MARKET_DECK].sort());
    expect([...state.marketDecks.II].sort()).toEqual([...AGE2_MARKET_DECK].sort());
    expect([...state.marketDecks.III].sort()).toEqual([...AGE3_MARKET_DECK].sort());
    expect(state.powerDecks.I.length).toBe(AGE1_POWER_DECK.length);
    expect(state.powerDecks.II.length).toBe(AGE2_POWER_DECK.length);
    expect(state.powerDecks.III.length).toBe(AGE3_POWER_DECK.length);
    expect([...state.powerDecks.I].sort()).toEqual([...AGE1_POWER_DECK].sort());
    expect([...state.powerDecks.II].sort()).toEqual([...AGE2_POWER_DECK].sort());
    expect([...state.powerDecks.III].sort()).toEqual([...AGE3_POWER_DECK].sort());
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

describe("market bidding", () => {
  const createMarketState = (): GameState => {
    const base = createNewGame(DEFAULT_CONFIG, 31, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    return {
      ...base,
      phase: "round.market",
      blocks: undefined,
      players: base.players.map((player) => ({
        ...player,
        resources: {
          ...player.resources,
          gold: 5
        }
      })),
      market: {
        ...base.market,
        currentRow: [
          { cardId: "age1.card.a", age: "I", revealed: true },
          { cardId: "age1.card.b", age: "I", revealed: true }
        ],
        rowIndexResolving: 0,
        passPot: 0,
        bids: {
          p1: null,
          p2: null
        },
        playersOut: {
          p1: false,
          p2: false
        }
      }
    };
  };

  it("awards the highest buy bid and marks the winner out", () => {
    let state = createMarketState();

    state = runUntilBlocked(state);
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "buy", amount: 2 } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "buy", amount: 3 } },
      "p2"
    );
    state = runUntilBlocked(state);

    expect(state.market.rowIndexResolving).toBe(1);
    expect(state.market.playersOut.p2).toBe(true);
    expect(state.market.playersOut.p1).toBe(false);

    const p2 = state.players.find((player) => player.id === "p2");
    expect(p2?.resources.gold).toBe(2);
    expect(p2?.deck.drawPile.length).toBe(1);
    const p2Card = p2?.deck.drawPile[0] ?? "";
    expect(state.cardsByInstanceId[p2Card]?.defId).toBe("age1.card.a");
  });

  it("resolves pass bids by lowest amount and awards the pot", () => {
    let state = createMarketState();

    state = runUntilBlocked(state);
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "pass", amount: 0 } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "pass", amount: 2 } },
      "p2"
    );
    state = runUntilBlocked(state);

    const p1 = state.players.find((player) => player.id === "p1");
    const p2 = state.players.find((player) => player.id === "p2");
    expect(state.market.playersOut.p1).toBe(true);
    expect(p1?.resources.gold).toBe(7);
    expect(p2?.resources.gold).toBe(3);
    expect(p1?.deck.drawPile.length).toBe(1);
    const p1Card = p1?.deck.drawPile[0] ?? "";
    expect(state.cardsByInstanceId[p1Card]?.defId).toBe("age1.card.a");
  });

  it("breaks pass-bid ties with a roll-off", () => {
    vi.spyOn(shared, "rollDie")
      .mockImplementationOnce((rng) => ({ value: 6, next: rng }))
      .mockImplementationOnce((rng) => ({ value: 2, next: rng }));

    let state = createMarketState();

    state = runUntilBlocked(state);
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "pass", amount: 1 } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "pass", amount: 1 } },
      "p2"
    );
    state = runUntilBlocked(state);
    state = applyCommand(state, { type: "SubmitMarketRollOff" }, "p1");
    state = applyCommand(state, { type: "SubmitMarketRollOff" }, "p2");
    state = runUntilBlocked(state);

    expect(state.market.playersOut.p1).toBe(true);
    const passEvent = [...state.logs].reverse().find((entry) => entry.type === "market.pass");
    const rollOff = passEvent?.payload?.rollOff;
    expect(Array.isArray(rollOff)).toBe(true);
  });

  it("breaks buy-bid ties with a roll-off", () => {
    vi.spyOn(shared, "rollDie")
      .mockImplementationOnce((rng) => ({ value: 3, next: rng }))
      .mockImplementationOnce((rng) => ({ value: 1, next: rng }));

    let state = createMarketState();

    state = runUntilBlocked(state);
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "buy", amount: 2 } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitMarketBid", payload: { kind: "buy", amount: 2 } },
      "p2"
    );
    state = runUntilBlocked(state);
    state = applyCommand(state, { type: "SubmitMarketRollOff" }, "p1");
    state = applyCommand(state, { type: "SubmitMarketRollOff" }, "p2");
    state = runUntilBlocked(state);

    expect(state.market.playersOut.p1).toBe(true);
    const p1 = state.players.find((player) => player.id === "p1");
    expect(p1?.resources.gold).toBe(3);
  });
});

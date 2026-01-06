import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type { BoardState, EdgeKey, GameState, HexKey } from "./types";
import { DEFAULT_CONFIG, applyCommand, createNewGame, getBridgeKey, runUntilBlocked } from "./index";
import { DEFAULT_FACTION_ID, resolveStarterFactionCards } from "./content/starter-decks";

const pickStartingEdges = (capital: HexKey, board: BoardState): EdgeKey[] => {
  const neighbors = neighborHexKeys(capital).filter((key) => Boolean(board.hexes[key]));
  if (neighbors.length < 2) {
    throw new Error("capital must have at least two neighbors for test");
  }
  return [getBridgeKey(capital, neighbors[0]), getBridgeKey(capital, neighbors[1])];
};

const advanceThroughMarket = (state: GameState): GameState => {
  let nextState = state;

  while (nextState.phase === "round.market") {
    if (!nextState.blocks) {
      nextState = runUntilBlocked(nextState);
      continue;
    }

    if (nextState.blocks.type !== "market.bidsForCard") {
      throw new Error(`unexpected block during market: ${nextState.blocks.type}`);
    }

    for (const playerId of nextState.blocks.waitingFor) {
      nextState = applyCommand(
        nextState,
        { type: "SubmitMarketBid", payload: { kind: "pass", amount: 0 } },
        playerId
      );
    }

    nextState = runUntilBlocked(nextState);
  }

  return nextState;
};

describe("setup flow", () => {
  it("advances through setup blocks once players submit choices", () => {
    let state = createNewGame(DEFAULT_CONFIG, 123, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.capitalDraft");

    const slots = state.blocks?.payload.availableSlots ?? [];
    const p2Slot = slots[0];
    const p1Slot = slots[1] ?? slots[0];

    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: p2Slot } },
      "p2"
    );
    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.capitalDraft");

    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: p1Slot } },
      "p1"
    );
    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.startingBridges");

    const p1Capital = state.players.find((player) => player.id === "p1")?.capitalHex;
    const p2Capital = state.players.find((player) => player.id === "p2")?.capitalHex;
    expect(p1Capital).toBeTruthy();
    expect(p2Capital).toBeTruthy();

    const starter = resolveStarterFactionCards(DEFAULT_FACTION_ID);
    const expectedDeckSize = starter.deck.length + 1;
    const expectedDrawPile = expectedDeckSize - 5;

    const p1 = state.players.find((player) => player.id === "p1");
    const p2 = state.players.find((player) => player.id === "p2");
    expect(p1?.factionId).toBe(DEFAULT_FACTION_ID);
    expect(p2?.factionId).toBe(DEFAULT_FACTION_ID);
    expect(p1?.deck.hand.length).toBe(6);
    expect(p2?.deck.hand.length).toBe(6);
    expect(p1?.deck.drawPile.length).toBe(expectedDrawPile);
    expect(p2?.deck.drawPile.length).toBe(expectedDrawPile);

    const p1HandDefs = (p1?.deck.hand ?? []).map((cardId) => state.cardsByInstanceId[cardId]?.defId);
    const p2HandDefs = (p2?.deck.hand ?? []).map((cardId) => state.cardsByInstanceId[cardId]?.defId);
    expect(p1HandDefs).toContain(starter.championId);
    expect(p2HandDefs).toContain(starter.championId);
    const modifierIds = state.modifiers.map((modifier) => modifier.id);
    expect(modifierIds).toContain(`faction.${DEFAULT_FACTION_ID}.p1.shield_wall`);
    expect(modifierIds).toContain(`faction.${DEFAULT_FACTION_ID}.p2.shield_wall`);

    const p1Hex = state.board.hexes[p1Capital as HexKey];
    const p2Hex = state.board.hexes[p2Capital as HexKey];
    expect(p1Hex?.occupants["p1"]?.length).toBe(4);
    expect(p2Hex?.occupants["p2"]?.length).toBe(4);

    const hexes = Object.values(state.board.hexes);
    const mineCount = hexes.filter((hex) => hex.tile === "mine");
    const forgeCount = hexes.filter((hex) => hex.tile === "forge");
    const tileCounts = DEFAULT_CONFIG.tileCountsByPlayerCount[2];
    expect(mineCount.length).toBe(tileCounts.mines);
    expect(forgeCount.length).toBe(tileCounts.forges);
    for (const mine of mineCount) {
      expect(mine.mineValue).toBeTypeOf("number");
    }

    const [p1EdgeA, p1EdgeB] = pickStartingEdges(p1Capital as HexKey, state.board);
    const [p2EdgeA, p2EdgeB] = pickStartingEdges(p2Capital as HexKey, state.board);

    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: p1EdgeA } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: p1EdgeB } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: p2EdgeA } },
      "p2"
    );
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: p2EdgeB } },
      "p2"
    );

    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.freeStartingCardPick");

    const p1Offer = state.blocks?.payload.offers["p1"]?.[0];
    const p2Offer = state.blocks?.payload.offers["p2"]?.[0];
    expect(p1Offer).toBeTruthy();
    expect(p2Offer).toBeTruthy();

    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId: p1Offer as string } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId: p2Offer as string } },
      "p2"
    );

    state = runUntilBlocked(state);
    state = advanceThroughMarket(state);
    expect(state.phase).toBe("round.action");
    expect(state.blocks?.type).toBe("actionStep.declarations");
    expect(state.round).toBe(1);

    const p1AfterReset = state.players.find((player) => player.id === "p1");
    const p2AfterReset = state.players.find((player) => player.id === "p2");
    expect(p1AfterReset?.resources.gold).toBe(DEFAULT_CONFIG.START_GOLD + DEFAULT_CONFIG.BASE_INCOME);
    expect(p2AfterReset?.resources.gold).toBe(DEFAULT_CONFIG.START_GOLD + DEFAULT_CONFIG.BASE_INCOME);
    expect(p1AfterReset?.resources.mana).toBe(DEFAULT_CONFIG.MAX_MANA);
    expect(p2AfterReset?.resources.mana).toBe(DEFAULT_CONFIG.MAX_MANA);
    const totalCards = Object.keys(state.cardsByInstanceId).length;
    expect(totalCards).toBe(26);

    const finalP1 = state.players.find((player) => player.id === "p1");
    const finalP2 = state.players.find((player) => player.id === "p2");
    const p1DrawDefs = (finalP1?.deck.drawPile ?? []).map(
      (cardId) => state.cardsByInstanceId[cardId]?.defId
    );
    const p2DrawDefs = (finalP2?.deck.drawPile ?? []).map(
      (cardId) => state.cardsByInstanceId[cardId]?.defId
    );
    expect(p1DrawDefs).toContain(p1Offer);
    expect(p2DrawDefs).toContain(p2Offer);
    expect(finalP1?.deck.drawPile.length).toBe(expectedDrawPile + 2);
    expect(finalP2?.deck.drawPile.length).toBe(expectedDrawPile + 2);
  });
});

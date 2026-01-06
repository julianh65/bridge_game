import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type { BoardState, EdgeKey, HexKey } from "./types";
import { DEFAULT_CONFIG, applyCommand, createNewGame, getBridgeKey, runUntilBlocked } from "./index";

const pickStartingEdges = (capital: HexKey, board: BoardState): EdgeKey[] => {
  const neighbors = neighborHexKeys(capital).filter((key) => Boolean(board.hexes[key]));
  if (neighbors.length < 2) {
    throw new Error("capital must have at least two neighbors for test");
  }
  return [getBridgeKey(capital, neighbors[0]), getBridgeKey(capital, neighbors[1])];
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
    expect(state.phase).toBe("round.reset");
    expect(state.blocks).toBeUndefined();
    expect(state.cardsByInstanceId).toMatchObject({
      ci_1: { defId: p1Offer },
      ci_2: { defId: p2Offer }
    });
    expect(state.players.find((player) => player.id === "p1")?.deck.drawPile.length).toBe(1);
    expect(state.players.find((player) => player.id === "p2")?.deck.drawPile.length).toBe(1);
  });
});

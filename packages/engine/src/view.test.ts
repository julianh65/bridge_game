import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type { BoardState, EdgeKey, GameState, HexKey } from "./types";
import { getBridgeKey } from "./board";
import { DEFAULT_CONFIG } from "./config";
import { createCardInstance } from "./cards";
import { applyCommand, createNewGame, runUntilBlocked } from "./engine";
import { buildView } from "./view";

const pickStartingEdges = (capital: HexKey, board: BoardState): EdgeKey[] => {
  const neighbors = neighborHexKeys(capital).filter((key) => Boolean(board.hexes[key]));
  if (neighbors.length < 2) {
    throw new Error("capital must have at least two neighbors for test");
  }
  return [getBridgeKey(capital, neighbors[0]), getBridgeKey(capital, neighbors[1])];
};

const advanceSetup = (state: GameState): GameState => {
  const hostId = state.players.find((player) => player.seatIndex === 0)?.id;
  if (!hostId) {
    throw new Error("no host available to advance setup");
  }
  return applyCommand(state, { type: "AdvanceSetup" }, hostId);
};

const readyDeckPreview = (state: GameState): GameState => {
  if (state.blocks?.type !== "setup.deckPreview") {
    return state;
  }
  let nextState = state;
  for (const player of state.players) {
    nextState = applyCommand(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "readyDeckPreview" } },
      player.id
    );
  }
  return nextState;
};

describe("view", () => {
  it("includes burned pile counts in the private view", () => {
    let state = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const created = createCardInstance(state, "starter.quick_move");
    state = {
      ...created.state,
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? { ...player, burned: [...player.burned, created.instanceId] }
          : player
      )
    };

    const view = buildView(state, "p1");
    expect(view.private?.deckCounts.burned).toBe(1);
    expect(view.private?.deckCards.burned.map((card) => card.id)).toContain(
      created.instanceId
    );
  });

  it("exposes setup gating + bridge selection status in the view", () => {
    let state = createNewGame(DEFAULT_CONFIG, 123, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.deckPreview");

    state = readyDeckPreview(state);
    state = advanceSetup(state);
    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.capitalDraft");

    const slots = state.blocks?.payload.availableSlots ?? [];
    const p1Slot = slots[0];
    const p2Slot = slots[1] ?? slots[0];

    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: p1Slot } },
      "p1"
    );
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: p2Slot } },
      "p2"
    );
    state = runUntilBlocked(state);
    state = advanceSetup(state);
    state = runUntilBlocked(state);
    expect(state.blocks?.type).toBe("setup.startingBridges");

    const p1Capital = state.players.find((player) => player.id === "p1")?.capitalHex as HexKey;
    const p2Capital = state.players.find((player) => player.id === "p2")?.capitalHex as HexKey;
    const [p1EdgeA, p1EdgeB] = pickStartingEdges(p1Capital, state.board);
    const [p2EdgeA, p2EdgeB] = pickStartingEdges(p2Capital, state.board);

    let view = buildView(state, "p1");
    expect(view.public.setup?.type).toBe("setup.startingBridges");
    if (view.public.setup?.type !== "setup.startingBridges") {
      throw new Error("expected setup.startingBridges view");
    }
    expect(view.public.setup.remaining["p1"]).toBe(2);
    expect(view.public.setup.remaining["p2"]).toBe(2);
    expect("selectedEdges" in view.public.setup).toBe(false);

    expect(view.private?.setup?.type).toBe("setup.startingBridges");
    if (view.private?.setup?.type !== "setup.startingBridges") {
      throw new Error("expected private setup view");
    }
    expect(view.private.setup.remaining).toBe(2);
    expect(view.private.setup.selectedEdges).toEqual([]);

    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: p1EdgeA } },
      "p1"
    );
    state = runUntilBlocked(state);

    view = buildView(state, "p1");
    if (view.public.setup?.type !== "setup.startingBridges") {
      throw new Error("expected setup.startingBridges view");
    }
    expect(view.public.setup.remaining["p1"]).toBe(1);
    expect(view.public.setup.waitingForPlayerIds).toContain("p1");
    expect(view.public.setup.waitingForPlayerIds).toContain("p2");

    if (view.private?.setup?.type !== "setup.startingBridges") {
      throw new Error("expected private setup view");
    }
    expect(view.private.setup.remaining).toBe(1);
    expect(view.private.setup.selectedEdges).toEqual([p1EdgeA]);

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

    view = buildView(state, "p1");
    if (view.public.setup?.type !== "setup.startingBridges") {
      throw new Error("expected setup.startingBridges view");
    }
    expect(view.public.setup.remaining["p1"]).toBe(0);
    expect(view.public.setup.remaining["p2"]).toBe(0);
    expect(view.public.setup.waitingForPlayerIds).toEqual([]);
    expect(view.public.setupStatus?.canAdvance).toBe(true);

    state = advanceSetup(state);
    state = runUntilBlocked(state);
    view = buildView(state, "p1");
    expect(view.public.setup?.type).toBe("setup.freeStartingCardPick");
    if (view.public.setup?.type !== "setup.freeStartingCardPick") {
      throw new Error("expected freeStartingCardPick view");
    }
    expect(view.public.setup.chosen["p1"]).toBe(false);
    expect(view.public.setup.chosen["p2"]).toBe(false);
  });
});

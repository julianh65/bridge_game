import { neighborHexKeys, parseEdgeKey } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type { BoardState, EdgeKey, GameState, HexKey } from "./types";
import { createCardInstance } from "./cards";
import { applyCommand, createNewGame, DEFAULT_CONFIG, getBridgeKey, runUntilBlocked } from "./index";
import { addForcesToHex } from "./units";

const pickStartingEdges = (capital: HexKey, board: BoardState): EdgeKey[] => {
  const neighbors = neighborHexKeys(capital).filter((key) => Boolean(board.hexes[key]));
  if (neighbors.length < 2) {
    throw new Error("capital must have at least two neighbors for test");
  }
  return [getBridgeKey(capital, neighbors[0]), getBridgeKey(capital, neighbors[1])];
};

const pickOpenBridgeEdge = (capital: HexKey, board: BoardState): EdgeKey => {
  const neighbors = neighborHexKeys(capital).filter((key) => Boolean(board.hexes[key]));
  for (const neighbor of neighbors) {
    const edgeKey = getBridgeKey(capital, neighbor);
    if (!board.bridges[edgeKey]) {
      return edgeKey;
    }
  }
  throw new Error("no available edge for build bridge test");
};

const setupToActionPhase = (): { state: GameState; p1Capital: HexKey; p1Edges: EdgeKey[] } => {
  let state = createNewGame(DEFAULT_CONFIG, 123, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);

  state = runUntilBlocked(state);
  const slots = state.blocks?.payload.availableSlots ?? [];
  const p2Slot = slots[0];
  const p1Slot = slots[1] ?? slots[0];

  state = applyCommand(
    state,
    { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: p2Slot } },
    "p2"
  );
  state = applyCommand(
    state,
    { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: p1Slot } },
    "p1"
  );
  state = runUntilBlocked(state);

  const p1Capital = state.players.find((player) => player.id === "p1")?.capitalHex;
  const p2Capital = state.players.find((player) => player.id === "p2")?.capitalHex;
  if (!p1Capital || !p2Capital) {
    throw new Error("capitals were not assigned");
  }

  const p1Edges = pickStartingEdges(p1Capital, state.board);
  const p2Edges = pickStartingEdges(p2Capital, state.board);

  for (const edge of p1Edges) {
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: edge } },
      "p1"
    );
  }
  for (const edge of p2Edges) {
    state = applyCommand(
      state,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey: edge } },
      "p2"
    );
  }

  state = runUntilBlocked(state);

  const p1Offer = state.blocks?.payload.offers["p1"]?.[0];
  const p2Offer = state.blocks?.payload.offers["p2"]?.[0];
  if (!p1Offer || !p2Offer) {
    throw new Error("free starting card offers missing");
  }

  state = applyCommand(
    state,
    { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId: p1Offer } },
    "p1"
  );
  state = applyCommand(
    state,
    { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId: p2Offer } },
    "p2"
  );

  state = runUntilBlocked(state);

  return { state, p1Capital, p1Edges };
};

const addCardToHand = (
  state: GameState,
  playerId: string,
  cardDefId: string
): { state: GameState; instanceId: string } => {
  const created = createCardInstance(state, cardDefId);
  const player = created.state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`missing player: ${playerId}`);
  }

  return {
    state: {
      ...created.state,
      players: created.state.players.map((entry) =>
        entry.id === playerId
          ? {
              ...entry,
              deck: {
                ...entry.deck,
                hand: [...entry.deck.hand, created.instanceId]
              }
            }
          : entry
      )
    },
    instanceId: created.instanceId
  };
};

const findMineHex = (state: GameState): HexKey => {
  const mineHex = Object.values(state.board.hexes).find((hex) => hex.tile === "mine");
  if (!mineHex) {
    throw new Error("mine hex not found");
  }
  return mineHex.key;
};

describe("action flow", () => {
  it("creates an action step block once the market phase passes", () => {
    const { state } = setupToActionPhase();
    expect(state.phase).toBe("round.action");
    expect(state.blocks?.type).toBe("actionStep.declarations");
    expect(state.blocks?.waitingFor.length).toBe(2);
  });

  it("resolves build bridge actions and spends mana", () => {
    let { state, p1Capital } = setupToActionPhase();
    const newEdge = pickOpenBridgeEdge(p1Capital, state.board);

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "basic", action: { kind: "buildBridge", edgeKey: newEdge } } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    expect(state.board.bridges[newEdge]).toBeTruthy();
    const p1 = state.players.find((player) => player.id === "p1");
    expect(p1?.resources.mana).toBe(DEFAULT_CONFIG.MAX_MANA - 1);
  });

  it("does not spend resources on invalid action declarations", () => {
    let { state, p1Capital } = setupToActionPhase();
    const neighborSet = new Set(
      neighborHexKeys(p1Capital).filter((key) => Boolean(state.board.hexes[key]))
    );
    const invalidTarget = Object.keys(state.board.hexes).find(
      (key) => key !== p1Capital && !neighborSet.has(key)
    );
    if (!invalidTarget) {
      throw new Error("no non-adjacent hex for invalid action test");
    }
    const invalidEdge = getBridgeKey(p1Capital, invalidTarget);
    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: { kind: "basic", action: { kind: "buildBridge", edgeKey: invalidEdge } }
      },
      "p1"
    );

    const p1After = state.players.find((player) => player.id === "p1");
    expect(p1After?.resources.gold).toBe(p1Before.resources.gold);
    expect(p1After?.resources.mana).toBe(p1Before.resources.mana);
    expect(state.blocks?.payload.declarations["p1"]).toBeNull();
    expect(state.blocks?.waitingFor).toContain("p1");
  });

  it("moves a stack one hex along a bridge", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const to = a === p1Capital ? b : a;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: { kind: "basic", action: { kind: "march", from: p1Capital, to } }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const fromHex = state.board.hexes[p1Capital];
    const toHex = state.board.hexes[to];
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(0);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(4);
  });

  it("reinforces a capital and spends gold", () => {
    let { state, p1Capital } = setupToActionPhase();
    const startingGold = DEFAULT_CONFIG.START_GOLD + DEFAULT_CONFIG.BASE_INCOME;

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "basic", action: { kind: "capitalReinforce" } } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const capital = state.board.hexes[p1Capital];
    expect(capital.occupants["p1"]?.length ?? 0).toBe(5);
    const p1 = state.players.find((player) => player.id === "p1");
    expect(p1?.resources.gold).toBe(startingGold - 1);
    expect(p1?.resources.mana).toBe(DEFAULT_CONFIG.MAX_MANA - 1);
  });

  it("plays a no-target card and discards it after resolution", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "starter.supply_cache");
    state = injected.state;

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: injected.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }
    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 2);
    expect(p1After.resources.mana).toBe(p1Before.resources.mana - 1);
    expect(p1After.deck.hand.includes(injected.instanceId)).toBe(false);
    expect(p1After.deck.discardPile).toContain(injected.instanceId);
  });

  it("plays prospecting and gains base gold without a mine", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "age1.prospecting");
    state = injected.state;

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: injected.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }
    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 2);
  });

  it("plays prospecting and gains bonus gold when occupying a mine", () => {
    let { state } = setupToActionPhase();
    const mineHex = findMineHex(state);
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", mineHex, 1)
    };
    const injected = addCardToHand(state, "p1", "age1.prospecting");
    state = injected.state;

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: injected.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }
    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 3);
  });
});

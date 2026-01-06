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

const addChampionToHex = (
  state: GameState,
  playerId: string,
  hexKey: HexKey,
  options?: { hp?: number; maxHp?: number; bounty?: number }
): { state: GameState; unitId: string } => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    throw new Error(`hex not found: ${hexKey}`);
  }

  let index = 1;
  let unitId = `c_${index}`;
  while (state.board.units[unitId]) {
    index += 1;
    unitId = `c_${index}`;
  }

  const hp = options?.hp ?? 2;
  const maxHp = options?.maxHp ?? hp;
  const bounty = options?.bounty ?? 2;

  const champion = {
    id: unitId,
    ownerPlayerId: playerId,
    kind: "champion" as const,
    hex: hexKey,
    cardDefId: `test.${unitId}`,
    hp,
    maxHp,
    attackDice: 0,
    hitFaces: 0,
    bounty,
    abilityUses: {}
  };

  return {
    state: {
      ...state,
      board: {
        ...state.board,
        units: {
          ...state.board.units,
          [unitId]: champion
        },
        hexes: {
          ...state.board.hexes,
          [hexKey]: {
            ...hex,
            occupants: {
              ...hex.occupants,
              [playerId]: [...(hex.occupants[playerId] ?? []), unitId]
            }
          }
        }
      }
    },
    unitId
  };
};

const findMineHex = (state: GameState): HexKey => {
  const mineHex = Object.values(state.board.hexes).find((hex) => hex.tile === "mine");
  if (!mineHex) {
    throw new Error("mine hex not found");
  }
  return mineHex.key;
};

const findEmptyEdge = (state: GameState): EdgeKey => {
  const hexes = Object.values(state.board.hexes);
  const isEmpty = (hex: BoardState["hexes"][string]) =>
    Object.values(hex.occupants).every((units) => units.length === 0);

  for (const hex of hexes) {
    if (!isEmpty(hex)) {
      continue;
    }
    const neighbors = neighborHexKeys(hex.key).filter((key) => Boolean(state.board.hexes[key]));
    for (const neighborKey of neighbors) {
      const neighbor = state.board.hexes[neighborKey];
      if (!neighbor || !isEmpty(neighbor)) {
        continue;
      }
      const edgeKey = getBridgeKey(hex.key, neighborKey);
      if (!state.board.bridges[edgeKey]) {
        return edgeKey;
      }
    }
  }

  throw new Error("no empty edge available");
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

  it("plays a stack-move card along a bridge", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const to = a === p1Capital ? b : a;

    const injected = addCardToHand(state, "p1", "starter.quick_move");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { from: p1Capital, to }
        }
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

  it("plays a path-move card along a bridge", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const to = a === p1Capital ? b : a;

    const injected = addCardToHand(state, "p1", "starter.march_orders");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { path: [p1Capital, to] }
        }
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

  it("plays a bridge-building card on an empty edge", () => {
    let { state } = setupToActionPhase();
    const edgeKey = findEmptyEdge(state);
    const injected = addCardToHand(state, "p1", "age1.temporary_bridge");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { edgeKey }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    expect(state.board.bridges[edgeKey]).toBeTruthy();
    expect(state.board.bridges[edgeKey]?.temporary).toBe(true);
  });

  it("plays bridge crew to build a bridge and move along it", () => {
    let { state, p1Capital } = setupToActionPhase();
    const edgeKey = pickOpenBridgeEdge(p1Capital, state.board);
    const [a, b] = parseEdgeKey(edgeKey);
    const to = a === p1Capital ? b : a;

    const injected = addCardToHand(state, "p1", "starter.bridge_crew");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { edgeKey, path: [p1Capital, to] }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    expect(state.board.bridges[edgeKey]).toBeTruthy();
    const fromHex = state.board.hexes[p1Capital];
    const toHex = state.board.hexes[to];
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(0);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(4);
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

  it("plays recruit to add forces to the capital", () => {
    let { state, p1Capital } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "starter.recruit");
    state = injected.state;

    const before = state.board.hexes[p1Capital].occupants["p1"]?.length ?? 0;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { choice: "capital" }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const after = state.board.hexes[p1Capital].occupants["p1"]?.length ?? 0;
    expect(after).toBe(before + 2);
  });

  it("plays recruit to add a force to an occupied hex", () => {
    let { state, p1Capital } = setupToActionPhase();
    const neighbor = neighborHexKeys(p1Capital).find((key) => Boolean(state.board.hexes[key]));
    if (!neighbor) {
      throw new Error("missing neighbor for recruit test");
    }
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", neighbor, 1)
    };
    const injected = addCardToHand(state, "p1", "starter.recruit");
    state = injected.state;

    const before = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { choice: "occupiedHex", hexKey: neighbor }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const after = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;
    expect(after).toBe(before + 1);
  });

  it("plays field medic to heal a champion and caps at max HP", () => {
    let { state, p1Capital } = setupToActionPhase();
    const created = addChampionToHex(state, "p1", p1Capital, { hp: 1, maxHp: 3 });
    state = created.state;

    const injected = addCardToHand(state, "p1", "starter.field_medic");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { unitId: created.unitId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const healed = state.board.units[created.unitId];
    if (!healed || healed.kind !== "champion") {
      throw new Error("missing healed champion");
    }
    expect(healed.hp).toBe(3);
  });

  it("plays patch up to heal extra when the champion is in the capital", () => {
    let { state, p1Capital } = setupToActionPhase();
    const created = addChampionToHex(state, "p1", p1Capital, { hp: 1, maxHp: 6 });
    state = created.state;

    const injected = addCardToHand(state, "p1", "age1.patch_up");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { unitId: created.unitId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const healed = state.board.units[created.unitId];
    if (!healed || healed.kind !== "champion") {
      throw new Error("missing patched champion");
    }
    expect(healed.hp).toBe(5);
  });

  it("plays zap to damage a champion, remove it, and award bounty", () => {
    let { state } = setupToActionPhase();
    const p2Capital = state.players.find((player) => player.id === "p2")?.capitalHex;
    if (!p2Capital) {
      throw new Error("missing p2 capital");
    }
    const created = addChampionToHex(state, "p2", p2Capital, { hp: 1, maxHp: 3, bounty: 4 });
    state = created.state;

    const injected = addCardToHand(state, "p1", "starter.zap");
    state = injected.state;

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { unitId: created.unitId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    expect(state.board.units[created.unitId]).toBeUndefined();
    expect(state.board.hexes[p2Capital]?.occupants["p2"] ?? []).not.toContain(created.unitId);
    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }
    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 4);
  });
});

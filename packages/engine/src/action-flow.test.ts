import {
  areAdjacent,
  axialDistance,
  neighborHexKeys,
  parseEdgeKey,
  parseHexKey
} from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type { BoardState, EdgeKey, GameState, HexKey } from "./types";
import { createBaseBoard } from "./board-generation";
import { createCardInstance, createCardInstances } from "./cards";
import { isCardPlayable, resolveCardEffects, validateMovePath } from "./card-effects";
import { getCardDef } from "./content/cards";
import type { CardDef } from "./content/cards";
import {
  applyCommand,
  countPlayersOnHex,
  createNewGame,
  DEFAULT_CONFIG,
  getBridgeKey,
  runUntilBlocked
} from "./index";
import { applyChampionDeployment } from "./champions";
import { applyModifierQuery, getCombatModifiers } from "./modifiers";
import {
  getCardsDiscardedThisRound,
  getCardsPlayedThisRound,
  incrementCardsPlayedThisRound
} from "./player-flags";
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

const pickTwoStepMarchTarget = (
  capital: HexKey,
  edge: EdgeKey,
  board: BoardState
): { mid: HexKey; to: HexKey } => {
  const [a, b] = parseEdgeKey(edge);
  const mid = a === capital ? b : a;
  const neighbors = neighborHexKeys(mid).filter((key) => key !== capital && Boolean(board.hexes[key]));
  for (const neighbor of neighbors) {
    const hex = board.hexes[neighbor];
    if (!hex) {
      continue;
    }
    if (countPlayersOnHex(hex) > 0) {
      continue;
    }
    return { mid, to: neighbor };
  }
  throw new Error("no open two-step march target");
};

const pickNonAdjacentMinePair = (board: BoardState): [HexKey, HexKey] => {
  const mines = Object.values(board.hexes).filter((hex) => hex.tile === "mine");
  for (let i = 0; i < mines.length; i += 1) {
    const from = mines[i];
    if (!from) {
      continue;
    }
    for (let j = i + 1; j < mines.length; j += 1) {
      const to = mines[j];
      if (!to) {
        continue;
      }
      if (!areAdjacent(parseHexKey(from.key), parseHexKey(to.key))) {
        return [from.key, to.key];
      }
    }
  }
  throw new Error("no non-adjacent mine pair found");
};

const buildLinearPath = (start: HexKey, steps: number, board: BoardState): HexKey[] => {
  const neighbors = neighborHexKeys(start).filter((key) => Boolean(board.hexes[key]));
  const first = neighbors[0];
  if (!first) {
    throw new Error("missing neighbor for path");
  }
  const startCoord = parseHexKey(start);
  const nextCoord = parseHexKey(first);
  const dq = nextCoord.q - startCoord.q;
  const dr = nextCoord.r - startCoord.r;

  const path: HexKey[] = [start];
  let q = startCoord.q;
  let r = startCoord.r;

  for (let step = 0; step < steps; step += 1) {
    q += dq;
    r += dr;
    const key = `${q},${r}`;
    if (!board.hexes[key]) {
      throw new Error(`missing path hex: ${key}`);
    }
    path.push(key);
  }

  return path;
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

const setupToActionPhase = (
  factions: Partial<Record<"p1" | "p2", string>> = {}
): { state: GameState; p1Capital: HexKey; p1Edges: EdgeKey[] } => {
  let state = createNewGame(DEFAULT_CONFIG, 123, [
    { id: "p1", name: "Player 1", factionId: factions.p1 },
    { id: "p2", name: "Player 2", factionId: factions.p2 }
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
  state = advanceThroughMarket(state);

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

const findChampionInHand = (
  state: GameState,
  playerId: string
): { instanceId: string; defId: string } => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`missing player: ${playerId}`);
  }

  for (const instanceId of player.deck.hand) {
    const defId = state.cardsByInstanceId[instanceId]?.defId;
    if (defId?.startsWith("champion.")) {
      return { instanceId, defId };
    }
  }

  throw new Error("champion card not found in hand");
};

const addChampionToHex = (
  state: GameState,
  playerId: string,
  hexKey: HexKey,
  options?: { hp?: number; maxHp?: number; bounty?: number; cardDefId?: string }
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
    cardDefId: options?.cardDefId ?? `test.${unitId}`,
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

const findCenterHex = (state: GameState): HexKey => {
  const centerHex = Object.values(state.board.hexes).find((hex) => hex.tile === "center");
  if (!centerHex) {
    throw new Error("center hex not found");
  }
  return centerHex.key;
};

const findDistantHex = (state: GameState, from: HexKey, minDistance = 2): HexKey => {
  for (const hex of Object.values(state.board.hexes)) {
    if (hex.key === from) {
      continue;
    }
    try {
      if (axialDistance(parseHexKey(from), parseHexKey(hex.key)) >= minDistance) {
        return hex.key;
      }
    } catch {
      continue;
    }
  }
  throw new Error("no distant hex found");
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

  it("tracks cards played this round when declaring a card", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "starter.supply_cache");
    state = injected.state;

    const before = getCardsPlayedThisRound(state, "p1");
    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId
        }
      },
      "p1"
    );

    expect(getCardsPlayedThisRound(state, "p1")).toBe(before + 1);
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

  it("does not spend resources or remove cards on invalid card declarations", () => {
    let { state, p1Capital } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "starter.quick_move");
    state = injected.state;

    const openEdge = pickOpenBridgeEdge(p1Capital, state.board);
    const [a, b] = parseEdgeKey(openEdge);
    const to = a === p1Capital ? b : a;

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
          targets: { from: p1Capital, to }
        }
      },
      "p1"
    );

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }

    expect(p1After.resources.gold).toBe(p1Before.resources.gold);
    expect(p1After.resources.mana).toBe(p1Before.resources.mana);
    expect(p1After.deck.hand).toEqual(p1Before.deck.hand);
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

  it("treats linked hexes as adjacent for movement", () => {
    let { state, p1Capital } = setupToActionPhase();
    const targetHex = findDistantHex(state, p1Capital);

    const before = validateMovePath(state, "p1", [p1Capital, targetHex], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });
    expect(before).toBeNull();

    const linkCard: CardDef = {
      id: "test.wormhole_link",
      name: "Wormhole Link",
      rulesText: "Choose 2 hexes; treat them as adjacent this round.",
      type: "Spell",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: true,
      targetSpec: { kind: "hexPair" },
      effects: [{ kind: "linkHexes" }]
    };

    state = resolveCardEffects(state, "p1", linkCard, { hexKeys: [p1Capital, targetHex] });

    const after = validateMovePath(state, "p1", [p1Capital, targetHex], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });
    expect(after).toEqual([p1Capital, targetHex]);
  });

  it("links capital to center for the round via tunnel network", () => {
    let { state, p1Capital } = setupToActionPhase();
    const centerHex = findCenterHex(state);

    const before = validateMovePath(state, "p1", [p1Capital, centerHex], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });
    expect(before).toBeNull();

    const tunnelCard: CardDef = {
      id: "test.tunnel_network",
      name: "Tunnel Network",
      rulesText: "Your capital is connected to the center by a bridge this round.",
      type: "Order",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: true,
      targetSpec: { kind: "none" },
      effects: [{ kind: "linkCapitalToCenter" }]
    };

    state = resolveCardEffects(state, "p1", tunnelCard);

    const after = validateMovePath(state, "p1", [p1Capital, centerHex], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });
    expect(after).toEqual([p1Capital, centerHex]);
  });

  it("blocks movement across a locked bridge", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const to = a === p1Capital ? b : a;

    const lockBridgeCard: CardDef = {
      id: "test.lock_bridge",
      name: "Lock Bridge",
      rulesText: "Choose a bridge; it cannot be crossed this round.",
      type: "Order",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: false,
      targetSpec: { kind: "edge", requiresOccupiedEndpoint: true },
      effects: [{ kind: "lockBridge" }]
    };

    state = resolveCardEffects(state, "p1", lockBridgeCard, { edgeKey: edge });

    const path = validateMovePath(state, "p1", [p1Capital, to], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });

    expect(path).toBeNull();
  });

  it("triggers a bridge trap on the first enemy crossing", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const neighbor = a === p1Capital ? b : a;

    const capitalHex = state.board.hexes[p1Capital];
    if (!capitalHex) {
      throw new Error("missing capital hex");
    }
    const removedUnits = capitalHex.occupants["p1"] ?? [];
    const nextUnits = { ...state.board.units };
    for (const unitId of removedUnits) {
      delete nextUnits[unitId];
    }
    state = {
      ...state,
      board: {
        ...state.board,
        units: nextUnits,
        hexes: {
          ...state.board.hexes,
          [p1Capital]: {
            ...capitalHex,
            occupants: {
              ...capitalHex.occupants,
              p1: []
            }
          }
        }
      }
    };

    state = {
      ...state,
      board: addForcesToHex(state.board, "p2", neighbor, 2)
    };

    const trapBridgeCard: CardDef = {
      id: "test.trap_bridge",
      name: "Trap Bridge",
      rulesText: "Trap a bridge; the first enemy crossing loses 1 Force.",
      type: "Order",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: false,
      targetSpec: { kind: "edge", anywhere: true },
      effects: [{ kind: "trapBridge", loss: 1 }]
    };

    state = resolveCardEffects(state, "p1", trapBridgeCard, { edgeKey: edge });

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: { kind: "basic", action: { kind: "march", from: neighbor, to: p1Capital } }
      },
      "p2"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p1");

    state = runUntilBlocked(state);

    const targetHex = state.board.hexes[p1Capital];
    expect(targetHex.occupants["p2"]?.length ?? 0).toBe(1);
  });

  it("destroys a bridge with a destroy-bridge effect", () => {
    let { state, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;

    const destroyBridgeCard: CardDef = {
      id: "test.destroy_bridge",
      name: "Destroy Bridge",
      rulesText: "Destroy a bridge adjacent to a hex you occupy.",
      type: "Order",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: false,
      targetSpec: { kind: "edge", requiresOccupiedEndpoint: true },
      effects: [{ kind: "destroyBridge" }]
    };

    state = resolveCardEffects(state, "p1", destroyBridgeCard, { edgeKey: edge });

    expect(state.board.bridges[edge]).toBeUndefined();
  });

  it("moves part of a stack when forceCount is set", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const to = a === p1Capital ? b : a;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "basic",
          action: { kind: "march", from: p1Capital, to, forceCount: 2 }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const fromHex = state.board.hexes[p1Capital];
    const toHex = state.board.hexes[to];
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(2);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(2);
  });

  it("allows Aerial tailwind to march an extra hex", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase({ p1: "aerial" });
    const [edge] = p1Edges;
    const { mid, to } = pickTwoStepMarchTarget(p1Capital, edge, state.board);

    const bridgeKey = getBridgeKey(mid, to);
    if (!state.board.bridges[bridgeKey]) {
      state = {
        ...state,
        board: {
          ...state.board,
          bridges: {
            ...state.board.bridges,
            [bridgeKey]: {
              key: bridgeKey,
              from: mid,
              to
            }
          }
        }
      };
    }

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

    const p1 = state.players.find((player) => player.id === "p1");
    expect(p1?.flags.movedThisRound).toBe(true);
  });

  it("does not allow tailwind marches after a move is recorded", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase({ p1: "aerial" });
    const [edge] = p1Edges;
    const { mid, to } = pickTwoStepMarchTarget(p1Capital, edge, state.board);

    const bridgeKey = getBridgeKey(mid, to);
    if (!state.board.bridges[bridgeKey]) {
      state = {
        ...state,
        board: {
          ...state.board,
          bridges: {
            ...state.board.bridges,
            [bridgeKey]: {
              key: bridgeKey,
              from: mid,
              to
            }
          }
        }
      };
    }

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              flags: {
                ...player.flags,
                movedThisRound: true
              }
            }
          : player
      )
    };

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: { kind: "basic", action: { kind: "march", from: p1Capital, to } }
      },
      "p1"
    );

    expect(state.blocks?.payload.declarations["p1"]).toBeNull();
  });

  it("allows Prospect deep tunnels to march between occupied mines", () => {
    let { state } = setupToActionPhase({ p1: "prospect" });
    const [fromMine, toMine] = pickNonAdjacentMinePair(state.board);

    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", fromMine, 1)
    };
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", toMine, 1)
    };

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: { kind: "basic", action: { kind: "march", from: fromMine, to: toMine } }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const fromHex = state.board.hexes[fromMine];
    const toHex = state.board.hexes[toMine];
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(0);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(2);
  });

  it("allows flight champions to march without bridges", () => {
    let { state } = setupToActionPhase();

    let fromHex: HexKey | null = null;
    let toHex: HexKey | null = null;
    for (const hex of Object.values(state.board.hexes)) {
      if (countPlayersOnHex(hex) > 0) {
        continue;
      }
      const neighbors = neighborHexKeys(hex.key).filter((key) => Boolean(state.board.hexes[key]));
      for (const neighbor of neighbors) {
        const neighborHex = state.board.hexes[neighbor];
        if (!neighborHex || countPlayersOnHex(neighborHex) > 0) {
          continue;
        }
        const edgeKey = getBridgeKey(hex.key, neighbor);
        if (state.board.bridges[edgeKey]) {
          continue;
        }
        fromHex = hex.key;
        toHex = neighbor;
        break;
      }
      if (fromHex && toHex) {
        break;
      }
    }

    if (!fromHex || !toHex) {
      throw new Error("no open adjacent hex pair without bridges");
    }

    const championId = "c_flight";
    const champion = {
      id: championId,
      ownerPlayerId: "p1",
      kind: "champion" as const,
      hex: fromHex,
      cardDefId: "champion.aerial.skystriker_ace",
      hp: 4,
      maxHp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 3,
      abilityUses: {}
    };

    const fromStateHex = state.board.hexes[fromHex];
    const updatedFromHex = {
      ...fromStateHex,
      occupants: {
        ...fromStateHex.occupants,
        p1: [championId]
      }
    };

    state = {
      ...state,
      board: {
        ...state.board,
        units: {
          ...state.board.units,
          [championId]: champion
        },
        hexes: {
          ...state.board.hexes,
          [fromHex]: updatedFromHex
        }
      }
    };
    state = applyChampionDeployment(state, championId, champion.cardDefId, "p1");

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: { kind: "basic", action: { kind: "march", from: fromHex, to: toHex } }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const moved = state.board.units[championId];
    expect(moved?.hex).toBe(toHex);
    expect(state.board.hexes[fromHex].occupants["p1"] ?? []).not.toContain(championId);
    expect(state.board.hexes[toHex].occupants["p1"] ?? []).toContain(championId);
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
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(3);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(1);
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

  it("plays quick march to move up to two hexes along bridges", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const first = a === p1Capital ? b : a;
    const second = neighborHexKeys(first).find(
      (key) => key !== p1Capital && Boolean(state.board.hexes[key])
    );
    if (!second) {
      throw new Error("missing second step for quick march test");
    }

    const secondEdge = getBridgeKey(first, second);
    state = {
      ...state,
      board: {
        ...state.board,
        bridges: {
          ...state.board.bridges,
          [secondEdge]: { key: secondEdge, from: first, to: second }
        }
      }
    };

    const injected = addCardToHand(state, "p1", "age1.quick_march");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { path: [p1Capital, first, second] }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const fromHex = state.board.hexes[p1Capital];
    const toHex = state.board.hexes[second];
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(0);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(4);
  });

  it("plays flank step to move without a bridge", () => {
    let { state, p1Capital } = setupToActionPhase();
    const edgeKey = pickOpenBridgeEdge(p1Capital, state.board);
    const [a, b] = parseEdgeKey(edgeKey);
    const to = a === p1Capital ? b : a;

    const injected = addCardToHand(state, "p1", "age1.flank_step");
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
    expect(capital.occupants["p1"]?.length ?? 0).toBe(6);
    const p1 = state.players.find((player) => player.id === "p1");
    expect(p1?.resources.gold).toBe(startingGold - 1);
    expect(p1?.resources.mana).toBe(DEFAULT_CONFIG.MAX_MANA - 1);
  });

  it("allows Aerial wings to reinforce an occupied center", () => {
    let { state } = setupToActionPhase({ p1: "aerial" });
    const centerHex = findCenterHex(state);

    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", centerHex, 1)
    };

    const before = state.board.hexes[centerHex].occupants["p1"]?.length ?? 0;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "basic",
          action: { kind: "capitalReinforce", hexKey: centerHex }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const after = state.board.hexes[centerHex].occupants["p1"]?.length ?? 0;
    expect(after).toBe(before + 1);
  });

  it("allows Logistics Officer to reinforce its hex", () => {
    let { state, p1Capital } = setupToActionPhase();
    const neighbor = neighborHexKeys(p1Capital).find((key) => Boolean(state.board.hexes[key]));
    if (!neighbor) {
      throw new Error("missing neighbor hex for logistics officer test");
    }

    const deployed = addChampionToHex(state, "p1", neighbor, {
      cardDefId: "champion.age3.logistics_officer",
      hp: 4,
      bounty: 3
    });
    state = deployed.state;

    const before = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "basic",
          action: { kind: "capitalReinforce", hexKey: neighbor }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const after = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;
    expect(after).toBe(before + 1);
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

  it("plays scavenger's market to gain gold and draw a card", () => {
    let { state } = setupToActionPhase();
    const playCard = createCardInstance(state, "age1.scavengers_market");
    const drawCard = createCardInstance(playCard.state, "starter.supply_cache");
    state = drawCard.state;

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                hand: [playCard.instanceId],
                drawPile: [drawCard.instanceId],
                discardPile: [],
                scrapped: []
              }
            }
          : player
      )
    };

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: playCard.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }
    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 1);
    expect(p1After.deck.hand).toContain(drawCard.instanceId);
    expect(p1After.deck.hand).not.toContain(playCard.instanceId);
    expect(p1After.deck.discardPile).toContain(playCard.instanceId);
  });

  it("plays supply ledger to gain gold", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "age1.supply_ledger");
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

    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 1);
    expect(p1After.resources.mana).toBe(p1Before.resources.mana - 1);
    expect(p1After.deck.hand).not.toContain(injected.instanceId);
    expect(p1After.deck.discardPile).toContain(injected.instanceId);
  });

  it("plays trade caravan to gain gold", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "age1.trade_caravan");
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
    expect(p1After.resources.mana).toBe(p1Before.resources.mana - 1);
    expect(p1After.deck.hand).not.toContain(injected.instanceId);
    expect(p1After.deck.discardPile).toContain(injected.instanceId);
  });

  it("plays patrol record to draw a card", () => {
    let { state } = setupToActionPhase();
    const playCard = createCardInstance(state, "age1.patrol_record");
    const drawCard = createCardInstance(playCard.state, "starter.supply_cache");
    state = drawCard.state;

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                hand: [playCard.instanceId],
                drawPile: [drawCard.instanceId],
                discardPile: [],
                scrapped: []
              }
            }
          : player
      )
    };

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: playCard.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }

    expect(p1After.resources.mana).toBe(p1Before.resources.mana - 1);
    expect(p1After.deck.hand).toContain(drawCard.instanceId);
    expect(p1After.deck.hand).not.toContain(playCard.instanceId);
    expect(p1After.deck.discardPile).toContain(playCard.instanceId);
  });

  it("plays quick study to draw two cards", () => {
    let { state } = setupToActionPhase();
    const playCard = createCardInstance(state, "age1.quick_study");
    const drawCards = createCardInstances(playCard.state, [
      "test.quick_study.first",
      "test.quick_study.second"
    ]);
    state = drawCards.state;

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                hand: [playCard.instanceId],
                drawPile: drawCards.instanceIds,
                discardPile: [],
                scrapped: []
              }
            }
          : player
      )
    };

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: playCard.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }

    expect(p1After.resources.mana).toBe(p1Before.resources.mana - 1);
    expect(p1After.deck.hand).toEqual(drawCards.instanceIds);
    expect(p1After.deck.hand).not.toContain(playCard.instanceId);
    expect(p1After.deck.discardPile).toContain(playCard.instanceId);
  });

  it("plays make a play to gain mana and burn", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "age1.make_a_play");
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

    expect(p1After.resources.mana).toBe(p1Before.resources.mana + 1);
    expect(p1After.deck.hand).not.toContain(injected.instanceId);
    expect(p1After.burned).toContain(injected.instanceId);
  });

  it("plays paid logistics to gain mana for gold and burn", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "age1.paid_logistics");
    state = injected.state;

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              resources: {
                ...player.resources,
                gold: 6
              }
            }
          : player
      )
    };

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

    expect(p1After.resources.gold).toBe(p1Before.resources.gold - 6);
    expect(p1After.resources.mana).toBe(p1Before.resources.mana + 1);
    expect(p1After.deck.hand).not.toContain(injected.instanceId);
    expect(p1After.burned).toContain(injected.instanceId);
  });

  it("plays small hands to draw when the hand is empty", () => {
    let { state } = setupToActionPhase();
    const playCard = createCardInstance(state, "age1.small_hands");
    const drawCards = createCardInstances(playCard.state, [
      "test.small_hands.first",
      "test.small_hands.second",
      "test.small_hands.third"
    ]);
    state = drawCards.state;

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                hand: [playCard.instanceId],
                drawPile: drawCards.instanceIds,
                discardPile: [],
                scrapped: []
              }
            }
          : player
      )
    };

    const p1Before = state.players.find((player) => player.id === "p1");
    if (!p1Before) {
      throw new Error("missing p1 state");
    }

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: playCard.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }

    expect(p1After.resources.mana).toBe(p1Before.resources.mana - 1);
    expect(p1After.deck.hand).toEqual(drawCards.instanceIds);
    expect(p1After.deck.hand).not.toContain(playCard.instanceId);
    expect(p1After.deck.discardPile).toContain(playCard.instanceId);
  });

  it("plays banner claim to move along a bridge", () => {
    let { state, p1Capital, p1Edges } = setupToActionPhase();
    const [edge] = p1Edges;
    const [a, b] = parseEdgeKey(edge);
    const to = a === p1Capital ? b : a;

    const injected = addCardToHand(state, "p1", "age1.banner_claim");
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
    expect(fromHex.occupants["p1"]?.length ?? 0).toBe(3);
    expect(toHex.occupants["p1"]?.length ?? 0).toBe(1);
  });

  it("plays scout report to keep the top card and discard the rest", () => {
    let { state } = setupToActionPhase();
    const injected = addCardToHand(state, "p1", "starter.scout_report");
    state = injected.state;

    const created = createCardInstances(state, [
      "test.scout.top",
      "test.scout.middle",
      "test.scout.bottom"
    ]);
    state = created.state;

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                drawPile: created.instanceIds,
                discardPile: [],
                hand: [injected.instanceId],
                scrapped: []
              }
            }
          : player
      )
    };

    state = applyCommand(
      state,
      { type: "SubmitAction", payload: { kind: "card", cardInstanceId: injected.instanceId } },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    const beforeDiscards = getCardsDiscardedThisRound(state, "p1");
    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state");
    }

    expect(p1After.deck.hand).toEqual([created.instanceIds[0]]);
    expect(p1After.deck.drawPile).toEqual([]);
    const expectedDiscard = [injected.instanceId, ...created.instanceIds.slice(1)].sort();
    expect([...p1After.deck.discardPile].sort()).toEqual(expectedDiscard);
    expect(getCardsDiscardedThisRound(state, "p1")).toBe(beforeDiscards + 2);
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
    expect(after).toBe(before + 3);
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

  it("plays recruit detachment with custom capital and occupied counts", () => {
    let { state, p1Capital } = setupToActionPhase({ p1: "aerial" });
    const card = getCardDef("age1.recruit_detachment");
    if (!card) {
      throw new Error("missing recruit detachment card");
    }

    const capitalBefore = state.board.hexes[p1Capital].occupants["p1"]?.length ?? 0;
    state = resolveCardEffects(state, "p1", card, { choice: "capital" });
    const capitalAfter = state.board.hexes[p1Capital].occupants["p1"]?.length ?? 0;
    expect(capitalAfter - capitalBefore).toBe(4);

    const neighbor = neighborHexKeys(p1Capital).find((key) => Boolean(state.board.hexes[key]));
    if (!neighbor) {
      throw new Error("missing neighbor for recruit detachment test");
    }
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", neighbor, 1)
    };
    const occupiedBefore = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;
    state = resolveCardEffects(state, "p1", card, { choice: "occupiedHex", hexKey: neighbor });
    const occupiedAfter = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;
    expect(occupiedAfter - occupiedBefore).toBe(2);
  });

  it("plays paid volunteers to deploy forces to the capital", () => {
    let { state, p1Capital } = setupToActionPhase({ p1: "aerial" });
    const injected = addCardToHand(state, "p1", "age1.paid_volunteers");
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
    expect(after - before).toBe(4);
  });

  it("plays national service to deploy a force to the capital", () => {
    let { state, p1Capital } = setupToActionPhase({ p1: "aerial" });
    const injected = addCardToHand(state, "p1", "age1.national_service");
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
    expect(after - before).toBe(1);
  });

  it("plays air drop to deploy forces near a friendly champion", () => {
    let { state, p1Capital } = setupToActionPhase();
    const neighbor = neighborHexKeys(p1Capital).find((key) => Boolean(state.board.hexes[key]));
    if (!neighbor) {
      throw new Error("missing neighbor for air drop test");
    }

    state = addChampionToHex(state, "p1", p1Capital).state;
    const injected = addCardToHand(state, "p1", "faction.aerial.air_drop");
    state = injected.state;

    const before = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { hexKey: neighbor }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const after = state.board.hexes[neighbor].occupants["p1"]?.length ?? 0;
    expect(after).toBe(before + 3);
  });

  it("plays escort detail to deploy forces onto a friendly champion", () => {
    let { state, p1Capital } = setupToActionPhase({ p1: "aerial" });
    const champion = addChampionToHex(state, "p1", p1Capital);
    state = champion.state;
    const injected = addCardToHand(state, "p1", "age1.escort_detail");
    state = injected.state;

    const occupants = state.board.hexes[p1Capital].occupants["p1"] ?? [];
    const before = occupants.filter((unitId) => state.board.units[unitId]?.kind === "force")
      .length;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { unitId: champion.unitId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const afterOccupants = state.board.hexes[p1Capital].occupants["p1"] ?? [];
    const after = afterOccupants.filter((unitId) => state.board.units[unitId]?.kind === "force")
      .length;
    expect(after).toBe(before + 2);
  });

  it("plays rich veins to increase a mine value", () => {
    let { state } = setupToActionPhase();
    const mineHex = findMineHex(state);
    state = {
      ...state,
      board: addForcesToHex(state.board, "p1", mineHex, 1)
    };
    const injected = addCardToHand(state, "p1", "faction.prospect.rich_veins");
    state = injected.state;

    const before = state.board.hexes[mineHex].mineValue ?? 0;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { hexKey: mineHex }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const after = state.board.hexes[mineHex].mineValue ?? 0;
    expect(after).toBe(Math.min(before + 1, 7));
  });

  it("plays a champion card to deploy a champion and scales gold cost", () => {
    let { state, p1Capital } = setupToActionPhase();
    const seeded = addChampionToHex(state, "p1", p1Capital);
    state = seeded.state;

    const championCard = findChampionInHand(state, "p1");
    const cardDef = getCardDef(championCard.defId);
    if (!cardDef?.champion) {
      throw new Error("missing champion card def");
    }

    const existingChampions = Object.values(state.board.units).filter(
      (unit) => unit.kind === "champion" && unit.ownerPlayerId === "p1"
    ).length;
    const costs = cardDef.champion.goldCostByChampionCount;
    const expectedGoldCost =
      costs[Math.min(existingChampions, costs.length - 1)] ?? 0;

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
          cardInstanceId: championCard.instanceId,
          targets: { hexKey: p1Capital }
        }
      },
      "p1"
    );

    const p1AfterDeclaration = state.players.find((player) => player.id === "p1");
    if (!p1AfterDeclaration) {
      throw new Error("missing p1 state after declaration");
    }
    expect(p1AfterDeclaration.resources.mana).toBe(p1Before.resources.mana - cardDef.cost.mana);
    expect(p1AfterDeclaration.resources.gold).toBe(p1Before.resources.gold - expectedGoldCost);

    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");
    state = runUntilBlocked(state);

    const deployed = Object.values(state.board.units).find(
      (unit) =>
        unit.kind === "champion" &&
        unit.ownerPlayerId === "p1" &&
        unit.cardDefId === championCard.defId
    );
    if (!deployed || deployed.kind !== "champion") {
      throw new Error("missing deployed champion");
    }
    expect(deployed.hex).toBe(p1Capital);
    expect(deployed.hp).toBe(cardDef.champion.hp);
    expect(deployed.maxHp).toBe(cardDef.champion.hp);
  });

  it("blocks champion play when at the champion limit", () => {
    let { state, p1Capital } = setupToActionPhase();
    const limit = state.config.CHAMPION_LIMIT;
    for (let i = 0; i < limit; i += 1) {
      state = addChampionToHex(state, "p1", p1Capital).state;
    }

    const championCard = findChampionInHand(state, "p1");
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
          cardInstanceId: championCard.instanceId,
          targets: { hexKey: p1Capital }
        }
      },
      "p1"
    );

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state after limit check");
    }
    expect(p1After.resources).toEqual(p1Before.resources);
    expect(p1After.deck.hand).toContain(championCard.instanceId);
    expect(state.blocks?.waitingFor ?? []).toContain("p1");
  });

  it("boosts Archivist Prime attack dice for cards played this round", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const unitId = "c_archivist";

    board.units = {
      [unitId]: {
        id: unitId,
        ownerPlayerId: "p1",
        kind: "champion",
        hex: hexKey,
        cardDefId: "champion.cipher.archivist_prime",
        hp: 5,
        maxHp: 5,
        attackDice: 1,
        hitFaces: 2,
        bounty: 3,
        abilityUses: {}
      }
    };
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        ...board.hexes[hexKey]?.occupants,
        p1: [unitId]
      }
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };
    state = applyChampionDeployment(state, unitId, "champion.cipher.archivist_prime", "p1");
    state = incrementCardsPlayedThisRound(state, "p1", 2);

    const unit = state.board.units[unitId];
    if (!unit || unit.kind !== "champion") {
      throw new Error("missing archivist prime unit");
    }
    const modifiers = getCombatModifiers(state, hexKey);
    const attackDice = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getChampionAttackDice,
      {
        hexKey,
        attackerPlayerId: "p1",
        defenderPlayerId: "p2",
        round: 1,
        side: "attackers",
        unitId,
        unit
      },
      unit.attackDice
    );

    expect(attackDice).toBe(unit.attackDice + 2);
  });

  it("lets Wormhole Artificer move an extra hex when alone", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(3);
    const hexKey = "0,0";
    const unitId = "c_wormhole";

    board.units = {
      [unitId]: {
        id: unitId,
        ownerPlayerId: "p1",
        kind: "champion",
        hex: hexKey,
        cardDefId: "champion.gatewright.wormhole_artificer",
        hp: 5,
        maxHp: 5,
        attackDice: 2,
        hitFaces: 3,
        bounty: 3,
        abilityUses: {}
      }
    };
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        ...board.hexes[hexKey]?.occupants,
        p1: [unitId]
      }
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };
    state = applyChampionDeployment(
      state,
      unitId,
      "champion.gatewright.wormhole_artificer",
      "p1"
    );

    const path = buildLinearPath(hexKey, 3, board);
    const validated = validateMovePath(state, "p1", path, {
      maxDistance: 2,
      requiresBridge: false,
      requireStartOccupied: true
    });
    expect(validated).toEqual(path);
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

  it("plays hold the line to boost defending forces on the chosen hex", () => {
    let { state, p1Capital } = setupToActionPhase({ p1: "aerial" });

    const injected = addCardToHand(state, "p1", "faction.bastion.hold_the_line");
    state = injected.state;

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: injected.instanceId,
          targets: { hexKey: p1Capital }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");

    state = runUntilBlocked(state);

    const hex = state.board.hexes[p1Capital];
    const unitId = hex?.occupants["p1"]?.[0];
    if (!unitId) {
      throw new Error("missing p1 force on capital");
    }
    const unit = state.board.units[unitId];
    if (!unit || unit.kind !== "force") {
      throw new Error("expected a force unit on the capital");
    }

    const modifiers = getCombatModifiers(state, p1Capital);
    const hitFaces = applyModifierQuery(
      state,
      modifiers,
      (hooks) => hooks.getForceHitFaces,
      {
        hexKey: p1Capital,
        attackerPlayerId: "p2",
        defenderPlayerId: "p1",
        round: 1,
        side: "defenders",
        unitId,
        unit
      },
      2
    );

    expect(hitFaces).toBe(3);
  });

  it("plays marked for coin to award bonus gold when the target champion dies", () => {
    let { state, p1Capital } = setupToActionPhase({ p1: "bastion" });
    const neighbor = neighborHexKeys(p1Capital).find((key) => Boolean(state.board.hexes[key]));
    if (!neighbor) {
      throw new Error("missing neighbor hex for marked for coin test");
    }

    state = addChampionToHex(state, "p1", p1Capital).state;
    const target = addChampionToHex(state, "p2", neighbor, { hp: 1, maxHp: 1, bounty: 2 });
    state = target.state;

    const marked = addCardToHand(state, "p1", "faction.veil.marked_for_coin");
    state = marked.state;
    const zap = addCardToHand(state, "p1", "starter.zap");
    state = zap.state;

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
          cardInstanceId: marked.instanceId,
          targets: { unitId: target.unitId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");
    state = runUntilBlocked(state);

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: zap.instanceId,
          targets: { unitId: target.unitId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");
    state = runUntilBlocked(state);

    expect(state.board.units[target.unitId]).toBeUndefined();
    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state after marked for coin");
    }
    expect(p1After.resources.gold).toBe(p1Before.resources.gold + 6);
  });

  it("applies ward to block enemy card targeting", () => {
    let { state } = setupToActionPhase();
    const p2Capital = state.players.find((player) => player.id === "p2")?.capitalHex;
    if (!p2Capital) {
      throw new Error("missing p2 capital");
    }

    const target = addChampionToHex(state, "p2", p2Capital);
    state = target.state;

    const wardCard: CardDef = {
      id: "test.ward",
      name: "Ward",
      rulesText: "",
      type: "Spell",
      deck: "power",
      tags: ["test"],
      cost: { mana: 0 },
      initiative: 0,
      burn: false,
      targetSpec: {
        kind: "champion",
        owner: "self"
      },
      effects: [{ kind: "ward" }]
    };

    state = resolveCardEffects(state, "p2", wardCard, { unitId: target.unitId });

    const wardModifier = state.modifiers.find(
      (modifier) => modifier.attachedUnitId === target.unitId
    );
    const targeting = wardModifier?.data?.targeting;
    if (!targeting || typeof targeting !== "object") {
      throw new Error("missing ward targeting data");
    }
    expect(targeting).toMatchObject({ blockEnemyCards: true });

    const zapCard = getCardDef("starter.zap");
    if (!zapCard) {
      throw new Error("missing zap card");
    }

    expect(isCardPlayable(state, "p1", zapCard, { unitId: target.unitId })).toBe(false);
    expect(isCardPlayable(state, "p2", zapCard, { unitId: target.unitId })).toBe(true);
  });

  it("applies immunity field to block enemy spells only", () => {
    let { state } = setupToActionPhase();
    const p2Capital = state.players.find((player) => player.id === "p2")?.capitalHex;
    if (!p2Capital) {
      throw new Error("missing p2 capital");
    }

    const target = addChampionToHex(state, "p2", p2Capital);
    state = target.state;

    const immunityField: CardDef = {
      id: "test.immunity_field",
      name: "Immunity Field",
      rulesText: "",
      type: "Spell",
      deck: "power",
      tags: ["test"],
      cost: { mana: 0 },
      initiative: 0,
      burn: false,
      targetSpec: { kind: "none" },
      effects: [{ kind: "immunityField" }]
    };

    state = resolveCardEffects(state, "p2", immunityField);

    const spellCard: CardDef = {
      id: "test.enemy_spell",
      name: "Enemy Spell",
      rulesText: "",
      type: "Spell",
      deck: "power",
      tags: ["test"],
      cost: { mana: 0 },
      initiative: 0,
      burn: false,
      targetSpec: {
        kind: "champion",
        owner: "any"
      },
      effects: [{ kind: "dealChampionDamage", amount: 1 }]
    };

    const zapCard = getCardDef("starter.zap");
    if (!zapCard) {
      throw new Error("missing zap card");
    }

    expect(isCardPlayable(state, "p1", spellCard, { unitId: target.unitId })).toBe(false);
    expect(isCardPlayable(state, "p1", zapCard, { unitId: target.unitId })).toBe(true);
    expect(isCardPlayable(state, "p2", spellCard, { unitId: target.unitId })).toBe(true);
  });

  it("plays perfect recall to draw and optionally topdeck a card", () => {
    let { state } = setupToActionPhase();

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                hand: []
              }
            }
          : player
      )
    };

    const recall = addCardToHand(state, "p1", "faction.cipher.perfect_recall");
    state = recall.state;
    const topdeck = addCardToHand(state, "p1", "starter.zap");
    state = topdeck.state;

    const drawCard = createCardInstance(state, "starter.quick_move");
    state = drawCard.state;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                drawPile: [drawCard.instanceId, ...player.deck.drawPile]
              }
            }
          : player
      )
    };

    state = applyCommand(
      state,
      {
        type: "SubmitAction",
        payload: {
          kind: "card",
          cardInstanceId: recall.instanceId,
          targets: { cardInstanceId: topdeck.instanceId }
        }
      },
      "p1"
    );
    state = applyCommand(state, { type: "SubmitAction", payload: { kind: "done" } }, "p2");
    state = runUntilBlocked(state);

    const p1After = state.players.find((player) => player.id === "p1");
    if (!p1After) {
      throw new Error("missing p1 state after perfect recall");
    }
    expect(p1After.deck.hand).toContain(drawCard.instanceId);
    expect(p1After.deck.hand).not.toContain(topdeck.instanceId);
    expect(p1After.deck.drawPile[0]).toBe(topdeck.instanceId);
  });
});

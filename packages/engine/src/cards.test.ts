import { describe, expect, it } from "vitest";

import { createRngState, randInt } from "@bridgefront/shared";

import {
  createCardInstance,
  createCardInstances,
  drawCards,
  insertCardIntoDrawPileRandom
} from "./cards";
import { CARD_DEFS_BY_ID, getCardDef } from "./content/cards";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";
import { emit } from "./events";
import type { Modifier } from "./types";

const createStateWithDeck = (handLimit = DEFAULT_CONFIG.HAND_LIMIT) => {
  let state = createNewGame(
    { ...DEFAULT_CONFIG, HAND_LIMIT: handLimit },
    123,
    [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]
  );

  const defIds = ["test.card.1", "test.card.2", "test.card.3"];
  const created = createCardInstances(state, defIds);
  state = created.state;

  const players = state.players.map((player) =>
    player.id === "p1"
      ? {
          ...player,
          deck: {
            drawPile: created.instanceIds,
            discardPile: [],
            hand: [],
            scrapped: []
          }
        }
      : player
  );

  return { state: { ...state, players }, instanceIds: created.instanceIds };
};

describe("cards", () => {
  it("discards draws that exceed the hand limit", () => {
    const { state, instanceIds } = createStateWithDeck(2);
    const next = drawCards(state, "p1", 3);
    const player = next.players.find((entry) => entry.id === "p1");

    expect(player?.deck.hand).toEqual([instanceIds[0], instanceIds[1]]);
    expect(player?.deck.discardPile).toEqual([instanceIds[2]]);
    expect(player?.deck.drawPile).toEqual([]);
  });

  it("reshuffles discard into draw pile when empty", () => {
    const { state, instanceIds } = createStateWithDeck();
    const players = state.players.map((player) =>
      player.id === "p1"
        ? {
            ...player,
            deck: {
              drawPile: [],
              discardPile: instanceIds.slice(0, 2),
              hand: [],
              scrapped: []
            }
          }
        : player
    );

    const next = drawCards({ ...state, players }, "p1", 1);
    const player = next.players.find((entry) => entry.id === "p1");
    const remaining = [
      ...(player?.deck.hand ?? []),
      ...(player?.deck.drawPile ?? [])
    ];

    expect(player?.deck.discardPile).toEqual([]);
    expect(remaining.sort()).toEqual(instanceIds.slice(0, 2).sort());
  });

  it("fires onCardDraw hooks for hand draws", () => {
    const { state } = createStateWithDeck();
    const modifiers: Modifier[] = [
      {
        id: "m1",
        source: { type: "card", sourceId: "test" },
        duration: { type: "permanent" },
        hooks: {
          onCardDraw: ({ state: nextState, playerId, cardDefId, destination }) =>
            emit(nextState, {
              type: "test.onDraw",
              payload: { playerId, cardDefId, destination }
            })
        }
      }
    ];

    const next = drawCards({ ...state, modifiers }, "p1", 1);
    const entry = next.logs.find((log) => log.type === "test.onDraw");

    expect(entry?.payload).toEqual({
      playerId: "p1",
      cardDefId: "test.card.1",
      destination: "hand"
    });
  });

  it("fires onCardDraw hooks when draws overflow to discard", () => {
    const { state } = createStateWithDeck(0);
    const modifiers: Modifier[] = [
      {
        id: "m1",
        source: { type: "card", sourceId: "test" },
        duration: { type: "permanent" },
        hooks: {
          onCardDraw: ({ state: nextState, playerId, cardDefId, destination }) =>
            emit(nextState, {
              type: "test.onDraw",
              payload: { playerId, cardDefId, destination }
            })
        }
      }
    ];

    const next = drawCards({ ...state, modifiers }, "p1", 1);
    const entry = next.logs.find((log) => log.type === "test.onDraw");

    expect(entry?.payload).toEqual({
      playerId: "p1",
      cardDefId: "test.card.1",
      destination: "discard"
    });
  });

  it("creates sequential card instance ids across calls", () => {
    const base = createNewGame(DEFAULT_CONFIG, 10, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const first = createCardInstances(base, ["test.card.a", "test.card.b"]);
    const second = createCardInstances(first.state, ["test.card.c"]);

    expect(first.instanceIds).toEqual(["ci_1", "ci_2"]);
    expect(second.instanceIds).toEqual(["ci_3"]);
    expect(Object.keys(second.state.cardsByInstanceId).sort()).toEqual([
      "ci_1",
      "ci_2",
      "ci_3"
    ]);
  });

  it("inserts a card into the draw pile using RNG position", () => {
    const base = createNewGame(DEFAULT_CONFIG, 22, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const created = createCardInstances(base, [
      "test.card.1",
      "test.card.2",
      "test.card.3",
      "test.card.4"
    ]);
    const [first, second, third, inserted] = created.instanceIds;

    const seededState = {
      ...created.state,
      rngState: createRngState(55),
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                drawPile: [first, second, third],
                discardPile: [],
                hand: [],
                scrapped: []
              }
            }
          : {
              ...player,
              deck: {
                drawPile: [],
                discardPile: [],
                hand: [],
                scrapped: []
              }
            }
      )
    };

    const { value: insertIndex, next: expectedRng } = randInt(
      seededState.rngState,
      0,
      3
    );
    const expectedDrawPile = [first, second, third];
    expectedDrawPile.splice(insertIndex, 0, inserted);

    const nextState = insertCardIntoDrawPileRandom(seededState, "p1", inserted);
    const p1 = nextState.players.find((player) => player.id === "p1");
    const p2 = nextState.players.find((player) => player.id === "p2");

    expect(p1?.deck.drawPile).toEqual(expectedDrawPile);
    expect(p2?.deck.drawPile).toEqual([]);
    expect(nextState.rngState).toEqual(expectedRng);
  });

  it("awards configured victory points when gaining a Victory card", () => {
    const base = createNewGame(DEFAULT_CONFIG, 91, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const cardDef = getCardDef("age1.supply_ledger");
    expect(cardDef).toBeTruthy();
    if (cardDef) {
      CARD_DEFS_BY_ID[cardDef.id] = { ...cardDef, victoryPoints: 2 };
    }
    try {
      const created = createCardInstance(base, "age1.supply_ledger");
      const nextState = insertCardIntoDrawPileRandom(created.state, "p1", created.instanceId);
      const p1 = nextState.players.find((player) => player.id === "p1");

      expect(p1?.vp.permanent).toBe(2);
    } finally {
      if (cardDef) {
        CARD_DEFS_BY_ID[cardDef.id] = cardDef;
      }
    }
  });
});

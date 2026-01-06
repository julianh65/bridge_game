import { describe, expect, it } from "vitest";

import { createCardInstances, drawCards } from "./cards";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";

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
});

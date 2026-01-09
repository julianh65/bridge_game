import { describe, expect, it } from "vitest";

import { resolveCardEffects, isCardPlayable } from "./card-effects";
import { createCardInstance } from "./cards";
import { DEFAULT_CONFIG } from "./config";
import { CHRONICLE_OF_WAR } from "./content/cards/power";
import { createNewGame } from "./engine";

const setupChronicleState = () => {
  const base = createNewGame(DEFAULT_CONFIG, 11, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);

  const discardCard = createCardInstance(base, "starter.quick_march");
  const drawCard = createCardInstance(discardCard.state, "starter.supply_cache");

  const state = {
    ...drawCard.state,
    phase: "round.action",
    blocks: undefined,
    players: drawCard.state.players.map((player) =>
      player.id === "p1"
        ? {
            ...player,
            resources: { ...player.resources, mana: 2 },
            deck: {
              ...player.deck,
              drawPile: [drawCard.instanceId],
              discardPile: [],
              hand: [discardCard.instanceId]
            }
          }
        : player
    )
  };

  return { state, discardCard, drawCard };
};

describe("Chronicle of War", () => {
  it("draws a card without discarding or gaining mana", () => {
    const { state, discardCard, drawCard } = setupChronicleState();

    expect(isCardPlayable(state, "p1", CHRONICLE_OF_WAR)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", CHRONICLE_OF_WAR);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.resources.mana).toBe(2);
    expect(p1.deck.hand).toEqual([discardCard.instanceId, drawCard.instanceId]);
    expect(p1.deck.drawPile).toHaveLength(0);
    expect(p1.deck.discardPile).toHaveLength(0);
  });

  it("discards to gain mana and still draws", () => {
    const { state, discardCard, drawCard } = setupChronicleState();

    expect(
      isCardPlayable(state, "p1", CHRONICLE_OF_WAR, {
        cardInstanceIds: [discardCard.instanceId]
      })
    ).toBe(true);

    const resolved = resolveCardEffects(state, "p1", CHRONICLE_OF_WAR, {
      cardInstanceIds: [discardCard.instanceId]
    });
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.resources.mana).toBe(3);
    expect(p1.deck.hand).toEqual([drawCard.instanceId]);
    expect(p1.deck.drawPile).toHaveLength(0);
    expect(p1.deck.discardPile).toEqual([discardCard.instanceId]);
  });
});

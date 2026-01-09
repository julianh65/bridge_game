import { describe, expect, it } from "vitest";

import { resolveCardEffects, isCardPlayable } from "./card-effects";
import { createCardInstance } from "./cards";
import { FORGE_SKETCH } from "./content/cards/power";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";

const setupForgeSketchState = () => {
  const base = createNewGame(DEFAULT_CONFIG, 11, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);

  const discardCard = createCardInstance(base, "starter.quick_march");
  const firstDraw = createCardInstance(discardCard.state, "starter.supply_cache");
  const secondDraw = createCardInstance(firstDraw.state, "starter.quick_march");

  const state = {
    ...secondDraw.state,
    phase: "round.action",
    blocks: undefined,
    players: secondDraw.state.players.map((player) =>
      player.id === "p1"
        ? {
            ...player,
            deck: {
              ...player.deck,
              drawPile: [firstDraw.instanceId, secondDraw.instanceId],
              discardPile: [],
              hand: [discardCard.instanceId]
            }
          }
        : player
    )
  };

  return { state, discardCard, firstDraw, secondDraw };
};

describe("Forge Sketch", () => {
  it("allows skipping the discard and does not draw", () => {
    const { state, discardCard, firstDraw, secondDraw } = setupForgeSketchState();

    expect(isCardPlayable(state, "p1", FORGE_SKETCH)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", FORGE_SKETCH);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.deck.hand).toEqual([discardCard.instanceId]);
    expect(p1.deck.drawPile).toEqual([firstDraw.instanceId, secondDraw.instanceId]);
    expect(p1.deck.discardPile).toHaveLength(0);
  });

  it("discards a card and draws 2 when a discard target is supplied", () => {
    const { state, discardCard, firstDraw, secondDraw } = setupForgeSketchState();

    expect(
      isCardPlayable(state, "p1", FORGE_SKETCH, {
        cardInstanceIds: [discardCard.instanceId]
      })
    ).toBe(true);

    const resolved = resolveCardEffects(state, "p1", FORGE_SKETCH, {
      cardInstanceIds: [discardCard.instanceId]
    });
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.deck.discardPile).toEqual([discardCard.instanceId]);
    expect(p1.deck.hand).toEqual([firstDraw.instanceId, secondDraw.instanceId]);
    expect(p1.deck.drawPile).toHaveLength(0);
  });
});

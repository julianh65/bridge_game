import { describe, expect, it } from "vitest";

import { resolveCardEffects } from "./card-effects";
import { createCardInstance } from "./cards";
import { SMALL_HANDS } from "./content/cards/age1";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";

describe("Small Hands", () => {
  it("draws cards when your hand is empty", () => {
    const base = createNewGame(DEFAULT_CONFIG, 11, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const first = createCardInstance(base, "starter.quick_march");
    const second = createCardInstance(first.state, "starter.supply_cache");
    const third = createCardInstance(second.state, "starter.recruit");

    const state = {
      ...third.state,
      phase: "round.action",
      blocks: undefined,
      players: third.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                drawPile: [first.instanceId, second.instanceId, third.instanceId],
                discardPile: [],
                hand: []
              }
            }
          : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", SMALL_HANDS);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.deck.hand).toEqual([first.instanceId, second.instanceId, third.instanceId]);
    expect(p1.deck.drawPile).toHaveLength(0);
  });

  it("does not draw if you still have cards in hand", () => {
    const base = createNewGame(DEFAULT_CONFIG, 15, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const first = createCardInstance(base, "starter.quick_march");
    const second = createCardInstance(first.state, "starter.supply_cache");
    const third = createCardInstance(second.state, "starter.recruit");
    const handCard = createCardInstance(third.state, "starter.zap");

    const state = {
      ...handCard.state,
      phase: "round.action",
      blocks: undefined,
      players: handCard.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                drawPile: [first.instanceId, second.instanceId, third.instanceId],
                discardPile: [],
                hand: [handCard.instanceId]
              }
            }
          : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", SMALL_HANDS);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.deck.hand).toEqual([handCard.instanceId]);
    expect(p1.deck.drawPile).toEqual([first.instanceId, second.instanceId, third.instanceId]);
  });
});

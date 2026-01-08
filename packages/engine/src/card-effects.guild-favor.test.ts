import { describe, expect, it } from "vitest";

import { resolveCardEffects } from "./card-effects";
import { GUILD_FAVOR } from "./content/cards/age2";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";
import { createCardInstance } from "./cards";

describe("Guild Favor", () => {
  it("grants gold and draws a card", () => {
    const base = createNewGame(DEFAULT_CONFIG, 12, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const created = createCardInstance(base, "starter.quick_march");
    const state = {
      ...created.state,
      phase: "round.action",
      blocks: undefined,
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              resources: {
                ...player.resources,
                gold: 0
              },
              deck: {
                ...player.deck,
                drawPile: [created.instanceId],
                discardPile: [],
                hand: []
              }
            }
          : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", GUILD_FAVOR);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.resources.gold).toBe(4);
    expect(p1.deck.hand).toEqual([created.instanceId]);
    expect(p1.deck.drawPile).toHaveLength(0);
  });
});

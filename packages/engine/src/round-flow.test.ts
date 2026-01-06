import { describe, expect, it } from "vitest";

import { createCardInstances } from "./cards";
import { DEFAULT_CONFIG, createNewGame } from "./index";
import { applyRoundReset } from "./round-flow";

describe("round reset", () => {
  it("applies income, mana reset, and draws with hand limit overflow", () => {
    const config = {
      ...DEFAULT_CONFIG,
      HAND_LIMIT: 3,
      BASE_INCOME: 2,
      MAX_MANA: 4
    };
    let state = createNewGame(config, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const cardDefs = [
      "test.card.a",
      "test.card.b",
      "test.card.c",
      "test.card.d",
      "test.card.e",
      "test.card.f"
    ];
    const created = createCardInstances(state, cardDefs);
    const ids = created.instanceIds;

    state = {
      ...created.state,
      phase: "round.reset",
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                drawPile: ids.slice(0, 3),
                discardPile: ids.slice(3, 5),
                hand: [ids[5]],
                scrapped: []
              }
            }
          : player
      )
    };

    const next = applyRoundReset(state);
    const player = next.players[0];

    expect(next.phase).toBe("round.market");
    expect(next.round).toBe(1);
    expect(player.resources.gold).toBe(config.START_GOLD + config.BASE_INCOME);
    expect(player.resources.mana).toBe(config.MAX_MANA);
    expect(player.deck.hand.length).toBe(config.HAND_LIMIT);
    expect(player.deck.drawPile.length + player.deck.discardPile.length).toBe(3);
  });
});

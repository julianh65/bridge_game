import { describe, expect, it } from "vitest";

import { resolveCardEffects } from "./card-effects";
import { WAR_TAXES } from "./content/cards/age2";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";

describe("War Taxes", () => {
  it("grants 4 gold", () => {
    const base = createNewGame(DEFAULT_CONFIG, 5, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      players: base.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              resources: {
                ...player.resources,
                gold: 0
              }
            }
          : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", WAR_TAXES);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.resources.gold).toBe(4);
  });
});

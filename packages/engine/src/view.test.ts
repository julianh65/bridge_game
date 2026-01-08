import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { createCardInstance } from "./cards";
import { createNewGame } from "./engine";
import { buildView } from "./view";

describe("view", () => {
  it("includes burned pile counts in the private view", () => {
    let state = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const created = createCardInstance(state, "starter.quick_move");
    state = {
      ...created.state,
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? { ...player, burned: [...player.burned, created.instanceId] }
          : player
      )
    };

    const view = buildView(state, "p1");
    expect(view.private?.deckCounts.burned).toBe(1);
    expect(view.private?.deckCards.burned.map((card) => card.id)).toContain(
      created.instanceId
    );
  });
});

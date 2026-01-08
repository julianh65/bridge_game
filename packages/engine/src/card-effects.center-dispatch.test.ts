import { describe, expect, it } from "vitest";

import { getCenterHexKey } from "./board";
import { resolveCardEffects } from "./card-effects";
import { createCardInstance } from "./cards";
import { CENTER_DISPATCH } from "./content/cards/age2";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";
import { addForcesToHex } from "./units";

describe("Center Dispatch", () => {
  it("draws 1 card when you do not occupy the center", () => {
    const base = createNewGame(DEFAULT_CONFIG, 7, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const first = createCardInstance(base, "starter.quick_march");
    const second = createCardInstance(first.state, "starter.supply_cache");

    const state = {
      ...second.state,
      phase: "round.action",
      blocks: undefined,
      players: second.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                drawPile: [first.instanceId, second.instanceId],
                discardPile: [],
                hand: []
              }
            }
          : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", CENTER_DISPATCH);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.deck.hand).toEqual([first.instanceId]);
    expect(p1.deck.drawPile).toEqual([second.instanceId]);
  });

  it("draws 2 cards when you occupy the center", () => {
    const base = createNewGame(DEFAULT_CONFIG, 9, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const first = createCardInstance(base, "starter.quick_march");
    const second = createCardInstance(first.state, "starter.supply_cache");

    const setupState = {
      ...second.state,
      phase: "round.action",
      blocks: undefined,
      players: second.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                drawPile: [first.instanceId, second.instanceId],
                discardPile: [],
                hand: []
              }
            }
          : player
      )
    };

    const centerHexKey = getCenterHexKey(setupState.board);
    if (!centerHexKey) {
      throw new Error("missing center hex");
    }

    const occupiedState = {
      ...setupState,
      board: addForcesToHex(setupState.board, "p1", centerHexKey, 1)
    };

    const resolved = resolveCardEffects(occupiedState, "p1", CENTER_DISPATCH);
    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing player");
    }

    expect(p1.deck.hand).toEqual([first.instanceId, second.instanceId]);
    expect(p1.deck.drawPile).toHaveLength(0);
  });
});

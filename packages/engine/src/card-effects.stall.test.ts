import { describe, expect, it } from "vitest";

import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { STALL } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";

describe("Stall", () => {
  it("is playable and leaves state unchanged", () => {
    const base = createNewGame(DEFAULT_CONFIG, 11, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined
    };

    expect(isCardPlayable(state, "p1", STALL)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", STALL);
    expect(resolved).toEqual(state);
  });
});

import { createRngState, randInt } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { resolveCardEffects } from "./card-effects";
import { WAR_PROFITEERS } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";

const buildState = (seed: number): GameState => {
  const base = createNewGame(DEFAULT_CONFIG, 1, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);
  return {
    ...base,
    phase: "round.action",
    blocks: undefined,
    rngState: createRngState(seed)
  };
};

const findSeed = (predicate: (value: number) => boolean) => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const roll = randInt(createRngState(seed), 1, 6);
    if (predicate(roll.value)) {
      return { seed, roll };
    }
  }
  throw new Error("unable to find seed for roll predicate");
};

describe("War Profiteers", () => {
  it("awards low gold on a low roll", () => {
    const low = findSeed((value) => value <= 4);
    const state = buildState(low.seed);
    const beforeGold =
      state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;

    const resolved = resolveCardEffects(state, "p1", WAR_PROFITEERS);
    const afterGold =
      resolved.players.find((player) => player.id === "p1")?.resources.gold ?? 0;

    expect(low.roll.value).toBeLessThanOrEqual(4);
    expect(afterGold).toBe(beforeGold + 1);
    expect(resolved.rngState).toEqual(low.roll.next);
  });

  it("awards high gold on a high roll", () => {
    const high = findSeed((value) => value >= 5);
    const state = buildState(high.seed);
    const beforeGold =
      state.players.find((player) => player.id === "p1")?.resources.gold ?? 0;

    const resolved = resolveCardEffects(state, "p1", WAR_PROFITEERS);
    const afterGold =
      resolved.players.find((player) => player.id === "p1")?.resources.gold ?? 0;

    expect(high.roll.value).toBeGreaterThanOrEqual(5);
    expect(afterGold).toBe(beforeGold + 6);
    expect(resolved.rngState).toEqual(high.roll.next);
  });
});

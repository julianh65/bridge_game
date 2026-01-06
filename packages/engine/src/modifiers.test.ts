import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, createNewGame } from "./index";
import { emit } from "./events";
import { runModifierEvents } from "./modifiers";
import type { CombatEndContext, Modifier } from "./types";

describe("modifier durations", () => {
  it("consumes uses on event hooks and removes when empty", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const modifiers: Modifier[] = [
      {
        id: "m1",
        source: { type: "card", sourceId: "test" },
        duration: { type: "uses", remaining: 2 },
        hooks: {
          afterBattle: ({ state }) => emit(state, { type: "test.m1" })
        }
      },
      {
        id: "m2",
        source: { type: "card", sourceId: "test" },
        duration: { type: "uses", remaining: 1 },
        hooks: {
          afterBattle: ({ state }) => emit(state, { type: "test.m2" })
        }
      }
    ];

    const state = {
      ...base,
      modifiers
    };

    const context: CombatEndContext = {
      hexKey: "0,0",
      attackerPlayerId: "p1",
      defenderPlayerId: "p2",
      round: 1,
      reason: "eliminated",
      winnerPlayerId: "p1",
      attackers: [],
      defenders: []
    };

    const next = runModifierEvents(
      state,
      state.modifiers,
      (hooks) => hooks.afterBattle,
      context
    );

    expect(next.logs.map((entry) => entry.type)).toEqual(["test.m1", "test.m2"]);
    expect(next.modifiers).toHaveLength(1);
    expect(next.modifiers[0]?.id).toBe("m1");
    expect(next.modifiers[0]?.duration).toEqual({ type: "uses", remaining: 1 });
  });
});

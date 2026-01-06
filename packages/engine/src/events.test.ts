import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, createNewGame, emit } from "./index";

const createState = () =>
  createNewGame(DEFAULT_CONFIG, 123, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);

describe("events", () => {
  it("appends a new event to the log", () => {
    const state = createState();
    const event = { type: "test.event", payload: { value: 1 } };
    const next = emit(state, event);

    expect(state.logs).toEqual([]);
    expect(next.logs).toEqual([event]);
  });

  it("caps the log length at the latest 200 events", () => {
    let state = createState();

    for (let i = 0; i < 205; i += 1) {
      state = emit(state, { type: `evt_${i}` });
    }

    expect(state.logs).toHaveLength(200);
    expect(state.logs[0].type).toBe("evt_5");
    expect(state.logs[199].type).toBe("evt_204");
  });
});

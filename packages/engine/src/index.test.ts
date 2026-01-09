import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, createNewGame, runUntilBlocked } from "./index";

describe("engine", () => {
  it("blocks on deck preview during setup", () => {
    const state = createNewGame(DEFAULT_CONFIG, 123, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const next = runUntilBlocked(state);

    expect(next.phase).toBe("setup");
    expect(next.blocks?.type).toBe("setup.deckPreview");
    expect(next.blocks?.waitingFor).toEqual(["p1", "p2"]);
  });
});

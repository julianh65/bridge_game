import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { TEMPORARY_BRIDGE } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";

describe("Temporary Bridge", () => {
  it("builds a temporary bridge without requiring occupied endpoints", () => {
    const base = createNewGame(DEFAULT_CONFIG, 12, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const from = "0,0";
    const to = "1,0";
    const edgeKey = getBridgeKey(from, to);

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: createBaseBoard(2)
    };

    expect(isCardPlayable(state, "p1", TEMPORARY_BRIDGE, { edgeKey })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", TEMPORARY_BRIDGE, { edgeKey });
    const bridge = resolved.board.bridges[edgeKey];

    expect(bridge).toBeTruthy();
    expect(bridge?.temporary).toBe(true);
    expect(bridge?.ownerPlayerId).toBe("p1");
  });
});

import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { SABOTAGE_BRIDGE } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Sabotage Bridge", () => {
  it("destroys an adjacent bridge", () => {
    const base = createNewGame(DEFAULT_CONFIG, 18, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const from = "0,0";
    const to = "1,0";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", from, 1);

    const edgeKey = getBridgeKey(from, to);
    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [edgeKey]: { key: edgeKey, from, to }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    expect(isCardPlayable(state, "p1", SABOTAGE_BRIDGE, { edgeKey })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", SABOTAGE_BRIDGE, { edgeKey });
    expect(resolved.board.bridges[edgeKey]).toBeUndefined();
  });
});

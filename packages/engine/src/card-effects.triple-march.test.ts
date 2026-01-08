import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { TRIPLE_MARCH } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Triple March", () => {
  it("moves up to three bridge steps and rejects longer paths", () => {
    const base = createNewGame(DEFAULT_CONFIG, 14, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const start = "0,0";
    const mid1 = "1,0";
    const mid2 = "2,0";
    const mid3 = "3,0";
    const dest = "4,0";

    let board = createBaseBoard(4);
    board = addForcesToHex(board, "p1", start, 2);

    const bridgeA = getBridgeKey(start, mid1);
    const bridgeB = getBridgeKey(mid1, mid2);
    const bridgeC = getBridgeKey(mid2, mid3);
    const bridgeD = getBridgeKey(mid3, dest);

    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [bridgeA]: { key: bridgeA, from: start, to: mid1 },
        [bridgeB]: { key: bridgeB, from: mid1, to: mid2 },
        [bridgeC]: { key: bridgeC, from: mid2, to: mid3 },
        [bridgeD]: { key: bridgeD, from: mid3, to: dest }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const okPath = [start, mid1, mid2, mid3];
    const tooFarPath = [start, mid1, mid2, mid3, dest];

    expect(isCardPlayable(state, "p1", TRIPLE_MARCH, { path: okPath })).toBe(true);
    expect(isCardPlayable(state, "p1", TRIPLE_MARCH, { path: tooFarPath })).toBe(false);

    const startUnits = [...(board.hexes[start]?.occupants.p1 ?? [])];
    const resolved = resolveCardEffects(state, "p1", TRIPLE_MARCH, { path: okPath });

    for (const unitId of startUnits) {
      expect(resolved.board.units[unitId]?.hex).toBe(mid3);
    }
    expect(resolved.board.hexes[start]?.occupants.p1 ?? []).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { COLUMN_ADVANCE } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Column Advance", () => {
  it("cannot move past an occupied hex", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const start = "0,0";
    const mid = "1,0";
    const dest = "2,0";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", start, 2);
    board = addForcesToHex(board, "p1", mid, 1);

    const bridgeA = getBridgeKey(start, mid);
    const bridgeB = getBridgeKey(mid, dest);
    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [bridgeA]: { key: bridgeA, from: start, to: mid },
        [bridgeB]: { key: bridgeB, from: mid, to: dest }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    expect(
      isCardPlayable(state, "p1", COLUMN_ADVANCE, { path: [start, mid, dest] })
    ).toBe(false);
  });

  it("allows ending on an occupied hex", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const start = "0,0";
    const mid = "1,0";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", start, 2);
    board = addForcesToHex(board, "p1", mid, 1);

    const bridge = getBridgeKey(start, mid);
    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [bridge]: { key: bridge, from: start, to: mid }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const startUnits = [...(board.hexes[start]?.occupants.p1 ?? [])];
    const resolved = resolveCardEffects(state, "p1", COLUMN_ADVANCE, {
      path: [start, mid]
    });

    for (const unitId of startUnits) {
      expect(resolved.board.units[unitId]?.hex).toBe(mid);
    }
    expect(resolved.board.hexes[start]?.occupants.p1 ?? []).toHaveLength(0);
  });
});

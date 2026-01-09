import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { BRIDGE_CREW } from "./content/cards/starter";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";
import { addForcesToHex } from "./units";

describe("Bridge Crew", () => {
  it("builds a bridge and moves a stack across it", () => {
    const base = createNewGame(DEFAULT_CONFIG, 5, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const from = "0,0";
    const to = "1,0";
    const edgeKey = getBridgeKey(from, to);

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", from, 2);

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const targets = { edgeKey, from, to };

    expect(isCardPlayable(state, "p1", BRIDGE_CREW, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", BRIDGE_CREW, targets);
    const bridge = resolved.board.bridges[edgeKey];
    const movedUnits = resolved.board.hexes[to]?.occupants.p1 ?? [];

    expect(bridge).toBeTruthy();
    expect(movedUnits).toHaveLength(2);
    expect(resolved.board.hexes[from]?.occupants.p1 ?? []).toHaveLength(0);
    for (const unitId of movedUnits) {
      expect(resolved.board.units[unitId]?.hex).toBe(to);
    }
  });
});

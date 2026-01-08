import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { BRIDGE_LOCKDOWN } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Bridge Lockdown", () => {
  it("locks an existing bridge adjacent to friendly units", () => {
    const base = createNewGame(DEFAULT_CONFIG, 23, [
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

    expect(isCardPlayable(state, "p1", BRIDGE_LOCKDOWN, { edgeKey })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", BRIDGE_LOCKDOWN, { edgeKey });
    const modifier = resolved.modifiers.find((entry) => entry.attachedEdge === edgeKey);

    expect(modifier).toBeTruthy();
    expect(modifier?.source).toEqual({ type: "card", sourceId: BRIDGE_LOCKDOWN.id });
    expect(modifier?.duration?.type).toBe("endOfRound");
  });
});

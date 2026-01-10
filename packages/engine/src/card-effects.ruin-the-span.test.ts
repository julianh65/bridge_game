import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { RUIN_THE_SPAN } from "./content/cards/age3";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";

describe("Ruin the Span", () => {
  it("destroys two bridges anywhere on the board", () => {
    const base = createNewGame(DEFAULT_CONFIG, 19, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const center = "0,0";
    const board = createBaseBoard(2);
    const neighbors = neighborHexKeys(center).filter((key) => Boolean(board.hexes[key]));
    if (neighbors.length < 2) {
      throw new Error("expected at least two neighbors for ruin the span");
    }

    const edgeA = getBridgeKey(center, neighbors[0]);
    const edgeB = getBridgeKey(center, neighbors[1]);

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: {
        ...board,
        bridges: {
          ...board.bridges,
          [edgeA]: { key: edgeA, from: center, to: neighbors[0] },
          [edgeB]: { key: edgeB, from: center, to: neighbors[1] }
        }
      }
    };

    const targets = { edgeKeys: [edgeA, edgeB] };
    expect(isCardPlayable(state, "p1", RUIN_THE_SPAN, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", RUIN_THE_SPAN, targets);
    expect(resolved.board.bridges[edgeA]).toBeUndefined();
    expect(resolved.board.bridges[edgeB]).toBeUndefined();
  });
});

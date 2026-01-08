import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { BRIDGE_NETWORK } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Bridge Network", () => {
  it("builds three bridges touching an occupied hex", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const center = "0,0";
    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", center, 1);

    const neighbors = neighborHexKeys(center).filter((key) => Boolean(board.hexes[key]));
    if (neighbors.length < 3) {
      throw new Error("expected at least three neighbors for bridge network");
    }
    const edgeKeys = neighbors.slice(0, 3).map((neighbor) => getBridgeKey(center, neighbor));

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const resolved = resolveCardEffects(state, "p1", BRIDGE_NETWORK, { edgeKeys });

    for (const edgeKey of edgeKeys) {
      const bridge = resolved.board.bridges[edgeKey];
      expect(bridge).toBeDefined();
      expect(bridge?.ownerPlayerId).toBe("p1");
    }
  });
});

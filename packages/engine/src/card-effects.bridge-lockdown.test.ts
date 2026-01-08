import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { resolveCardEffects, validateMovePath } from "./card-effects";
import { BRIDGE_LOCKDOWN } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Bridge Lockdown", () => {
  it("blocks movement across the locked bridge", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const center = "0,0";
    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", center, 1);

    const neighbor = neighborHexKeys(center).find((key) => Boolean(board.hexes[key]));
    if (!neighbor) {
      throw new Error("expected adjacent hex for bridge lockdown test");
    }
    const edgeKey = getBridgeKey(center, neighbor);
    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [edgeKey]: { key: edgeKey, from: center, to: neighbor, ownerPlayerId: "p1" }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const before = validateMovePath(state, "p1", [center, neighbor], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });
    expect(before).not.toBeNull();

    const resolved = resolveCardEffects(state, "p1", BRIDGE_LOCKDOWN, { edgeKey });
    const after = validateMovePath(resolved, "p1", [center, neighbor], {
      maxDistance: 1,
      requiresBridge: true,
      requireStartOccupied: true
    });
    expect(after).toBeNull();
  });
});

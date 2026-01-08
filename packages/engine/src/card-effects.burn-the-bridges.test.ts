import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { BURN_THE_BRIDGES } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Burn the Bridges", () => {
  it("moves along a bridge then destroys all bridges connected to the destination", () => {
    const base = createNewGame(DEFAULT_CONFIG, 9, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const from = "0,0";
    const to = "1,0";
    const extraFrom = "0,1";
    const extraTo = "0,2";
    const side = "1,1";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", from, 2);

    const moveBridge = getBridgeKey(from, to);
    const sideBridge = getBridgeKey(to, side);
    const extraBridge = getBridgeKey(extraFrom, extraTo);

    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [moveBridge]: { key: moveBridge, from, to },
        [sideBridge]: { key: sideBridge, from: to, to: side },
        [extraBridge]: { key: extraBridge, from: extraFrom, to: extraTo }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const targets = { path: [from, to] };

    expect(isCardPlayable(state, "p1", BURN_THE_BRIDGES, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", BURN_THE_BRIDGES, targets);

    const movedUnits = resolved.board.hexes[to]?.occupants.p1 ?? [];
    expect(movedUnits).toHaveLength(2);
    expect(resolved.board.hexes[from]?.occupants.p1 ?? []).toHaveLength(0);

    expect(resolved.board.bridges[moveBridge]).toBeUndefined();
    expect(resolved.board.bridges[sideBridge]).toBeUndefined();
    expect(resolved.board.bridges[extraBridge]).toBeTruthy();
  });
});

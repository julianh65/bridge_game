import { describe, expect, it } from "vitest";

import { getBridgeKey } from "./board";
import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { ROLL_OUT } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Roll Out", () => {
  it("moves up to two different stacks along bridges", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const startA = "0,0";
    const destA = "1,0";
    const startB = "0,1";
    const destB = "0,2";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", startA, 2);
    board = addForcesToHex(board, "p1", startB, 3);

    const bridgeA = getBridgeKey(startA, destA);
    const bridgeB = getBridgeKey(startB, destB);
    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [bridgeA]: { key: bridgeA, from: startA, to: destA },
        [bridgeB]: { key: bridgeB, from: startB, to: destB }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const startUnitsA = [...(board.hexes[startA]?.occupants.p1 ?? [])];
    const startUnitsB = [...(board.hexes[startB]?.occupants.p1 ?? [])];

    const resolved = resolveCardEffects(state, "p1", ROLL_OUT, {
      paths: [
        [startA, destA],
        [startB, destB]
      ]
    });

    for (const unitId of startUnitsA) {
      expect(resolved.board.units[unitId]?.hex).toBe(destA);
    }
    for (const unitId of startUnitsB) {
      expect(resolved.board.units[unitId]?.hex).toBe(destB);
    }
    expect(resolved.board.hexes[startA]?.occupants.p1 ?? []).toHaveLength(0);
    expect(resolved.board.hexes[startB]?.occupants.p1 ?? []).toHaveLength(0);
  });

  it("requires different starting hexes", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const start = "0,0";
    const destA = "1,0";
    const destB = "0,1";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", start, 2);

    const bridgeA = getBridgeKey(start, destA);
    const bridgeB = getBridgeKey(start, destB);
    board = {
      ...board,
      bridges: {
        ...board.bridges,
        [bridgeA]: { key: bridgeA, from: start, to: destA },
        [bridgeB]: { key: bridgeB, from: start, to: destB }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const playable = isCardPlayable(state, "p1", ROLL_OUT, {
      paths: [
        [start, destA],
        [start, destB]
      ]
    });

    expect(playable).toBe(false);
  });
});

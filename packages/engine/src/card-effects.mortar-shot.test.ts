import { afterEach, describe, expect, it, vi } from "vitest";
import { neighborHexKeys } from "@bridgefront/shared";
import * as shared from "@bridgefront/shared";

import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { MORTAR_SHOT } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex, addForcesToHex } from "./units";
import type { GameState } from "./types";

const countForcesAtHex = (state: GameState, hexKey: string): number => {
  return Object.values(state.board.units).filter(
    (unit) => unit.kind === "force" && unit.hex === hexKey
  ).length;
};

const getChampionHp = (state: GameState, unitId: string): number | null => {
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return null;
  }
  return unit.hp;
};

describe("Mortar Shot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits the target hex on a low roll, removing forces and damaging champions", () => {
    vi.spyOn(shared, "randInt").mockImplementation((rng) => ({ value: 0, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const targetHex = "0,0";
    const neighborHex = "1,0";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", targetHex, 2);
    board = addForcesToHex(board, "p2", targetHex, 3);
    board = addForcesToHex(board, "p1", "0,1", 1);

    const first = addChampionToHex(board, "p1", targetHex, {
      cardDefId: "champion.test.alpha",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    const second = addChampionToHex(first.board, "p2", targetHex, {
      cardDefId: "champion.test.beta",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    const third = addChampionToHex(second.board, "p2", neighborHex, {
      cardDefId: "champion.test.gamma",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: third.board
    };

    const resolved = resolveCardEffects(state, "p1", MORTAR_SHOT, {
      hexKey: targetHex
    });

    expect(countForcesAtHex(resolved, targetHex)).toBe(1);
    expect(countForcesAtHex(resolved, neighborHex)).toBe(
      countForcesAtHex(state, neighborHex)
    );
    expect(getChampionHp(resolved, first.unitId)).toBe(2);
    expect(getChampionHp(resolved, second.unitId)).toBe(2);
    expect(getChampionHp(resolved, third.unitId)).toBe(4);
  });

  it("can scatter to an adjacent hex on a high roll", () => {
    const randSpy = vi.spyOn(shared, "randInt");
    randSpy
      .mockImplementationOnce((rng) => ({ value: 75, next: rng }))
      .mockImplementationOnce((rng, min) => ({ value: min, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 2, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const targetHex = "0,0";
    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", targetHex, 1);

    const neighborHex =
      neighborHexKeys(targetHex).find((hexKey) => board.hexes[hexKey]) ?? null;
    if (!neighborHex) {
      throw new Error("missing neighbor hex");
    }

    board = addForcesToHex(board, "p2", neighborHex, 4);
    const targetChampion = addChampionToHex(board, "p2", targetHex, {
      cardDefId: "champion.test.delta",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    const neighborChampion = addChampionToHex(targetChampion.board, "p2", neighborHex, {
      cardDefId: "champion.test.epsilon",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: neighborChampion.board
    };

    const resolved = resolveCardEffects(state, "p1", MORTAR_SHOT, {
      hexKey: targetHex
    });

    expect(countForcesAtHex(resolved, targetHex)).toBe(
      countForcesAtHex(state, targetHex)
    );
    expect(countForcesAtHex(resolved, neighborHex)).toBe(0);
    expect(getChampionHp(resolved, targetChampion.unitId)).toBe(4);
    expect(getChampionHp(resolved, neighborChampion.unitId)).toBe(2);
  });
});

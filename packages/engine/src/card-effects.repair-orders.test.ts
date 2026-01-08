import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { REPAIR_ORDERS } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex } from "./units";
import type { GameState } from "./types";

describe("Repair Orders", () => {
  it("heals all friendly champions by 1 up to max HP", () => {
    const base = createNewGame(DEFAULT_CONFIG, 2, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    let board = createBaseBoard(2);
    const first = addChampionToHex(board, "p1", "0,0", {
      cardDefId: "champion.age1.sergeant",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = first.board;
    const second = addChampionToHex(board, "p1", "1,0", {
      cardDefId: "champion.age1.brute",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = second.board;
    const enemy = addChampionToHex(board, "p2", "0,1", {
      cardDefId: "champion.age1.sergeant",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = enemy.board;

    board = {
      ...board,
      units: {
        ...board.units,
        [first.unitId]: { ...board.units[first.unitId], hp: 2, maxHp: 4 },
        [second.unitId]: { ...board.units[second.unitId], hp: 4, maxHp: 5 },
        [enemy.unitId]: { ...board.units[enemy.unitId], hp: 3, maxHp: 5 }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const resolved = resolveCardEffects(state, "p1", REPAIR_ORDERS);

    const updatedFirst = resolved.board.units[first.unitId];
    const updatedSecond = resolved.board.units[second.unitId];
    const updatedEnemy = resolved.board.units[enemy.unitId];

    if (!updatedFirst || updatedFirst.kind !== "champion") {
      throw new Error("missing first champion");
    }
    if (!updatedSecond || updatedSecond.kind !== "champion") {
      throw new Error("missing second champion");
    }
    if (!updatedEnemy || updatedEnemy.kind !== "champion") {
      throw new Error("missing enemy champion");
    }

    expect(updatedFirst.hp).toBe(3);
    expect(updatedSecond.hp).toBe(5);
    expect(updatedEnemy.hp).toBe(3);
  });
});

import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { ATTRITION } from "./content/cards/age3";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex, addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Attrition", () => {
  it("removes up to three enemy forces and damages champions on the target hex", () => {
    const base = createNewGame(DEFAULT_CONFIG, 20, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const friendlyHex = "0,0";
    const targetHex = "1,0";

    let board = createBaseBoard(2);
    const friendly = addChampionToHex(board, "p1", friendlyHex, {
      cardDefId: "test.friendly",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = friendly.board;
    board = addForcesToHex(board, "p2", targetHex, 4);
    const enemy = addChampionToHex(board, "p2", targetHex, {
      cardDefId: "test.enemy",
      hp: 3,
      attackDice: 1,
      hitFaces: 3,
      bounty: 1
    });
    board = enemy.board;

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const targets = { hexKey: targetHex };
    expect(isCardPlayable(state, "p1", ATTRITION, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", ATTRITION, targets);
    const p2Occupants = resolved.board.hexes[targetHex]?.occupants["p2"] ?? [];
    const remainingForces = p2Occupants.filter(
      (unitId) => resolved.board.units[unitId]?.kind === "force"
    );
    expect(remainingForces).toHaveLength(1);

    const enemyUnit = resolved.board.units[enemy.unitId];
    if (!enemyUnit || enemyUnit.kind !== "champion") {
      throw new Error("missing enemy champion");
    }
    expect(enemyUnit.hp).toBe(2);

    const friendlyUnit = resolved.board.units[friendly.unitId];
    if (!friendlyUnit || friendlyUnit.kind !== "champion") {
      throw new Error("missing friendly champion");
    }
    expect(friendlyUnit.hp).toBe(4);
  });
});

import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { PATCH_UP } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex } from "./units";
import type { GameState } from "./types";

describe("Patch Up", () => {
  it("heals extra when the champion is in the capital", () => {
    const base = createNewGame(DEFAULT_CONFIG, 3, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    let board = createBaseBoard(2);
    const deployed = addChampionToHex(board, "p1", "0,0", {
      cardDefId: "champion.age1.sergeant",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = deployed.board;
    board = {
      ...board,
      units: {
        ...board.units,
        [deployed.unitId]: { ...board.units[deployed.unitId], hp: 1, maxHp: 5 }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board,
      players: base.players.map((player) =>
        player.id === "p1" ? { ...player, capitalHex: "0,0" } : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", PATCH_UP, {
      unitId: deployed.unitId
    });

    const unit = resolved.board.units[deployed.unitId];
    if (!unit || unit.kind !== "champion") {
      throw new Error("missing champion");
    }

    expect(unit.hp).toBe(5);
  });

  it("heals base amount when the champion is not in the capital", () => {
    const base = createNewGame(DEFAULT_CONFIG, 4, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    let board = createBaseBoard(2);
    const deployed = addChampionToHex(board, "p1", "1,0", {
      cardDefId: "champion.age1.sergeant",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = deployed.board;
    board = {
      ...board,
      units: {
        ...board.units,
        [deployed.unitId]: { ...board.units[deployed.unitId], hp: 2, maxHp: 5 }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board,
      players: base.players.map((player) =>
        player.id === "p1" ? { ...player, capitalHex: "0,0" } : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", PATCH_UP, {
      unitId: deployed.unitId
    });

    const unit = resolved.board.units[deployed.unitId];
    if (!unit || unit.kind !== "champion") {
      throw new Error("missing champion");
    }

    expect(unit.hp).toBe(4);
  });
});

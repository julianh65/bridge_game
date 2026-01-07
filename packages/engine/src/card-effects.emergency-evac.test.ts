import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { EMERGENCY_EVAC } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex } from "./units";
import type { GameState } from "./types";

describe("Emergency Evac", () => {
  it("moves a friendly champion to the capital and heals 1", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const capitalKey = "0,0";
    const startHex = "1,0";

    board.hexes[capitalKey] = {
      ...board.hexes[capitalKey],
      tile: "capital",
      ownerPlayerId: "p1"
    };

    const deployed = addChampionToHex(board, "p1", startHex, {
      cardDefId: "champion.test",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });

    const champion = deployed.board.units[deployed.unitId];
    if (!champion || champion.kind !== "champion") {
      throw new Error("expected champion unit");
    }

    const adjustedBoard = {
      ...deployed.board,
      units: {
        ...deployed.board.units,
        [deployed.unitId]: {
          ...champion,
          hp: 2,
          maxHp: 4
        }
      }
    };

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: adjustedBoard,
      players: base.players.map((player) =>
        player.id === "p1" ? { ...player, capitalHex: capitalKey } : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", EMERGENCY_EVAC, {
      unitId: deployed.unitId
    });

    const moved = resolved.board.units[deployed.unitId];
    if (!moved || moved.kind !== "champion") {
      throw new Error("missing moved champion");
    }

    expect(moved.hex).toBe(capitalKey);
    expect(moved.hp).toBe(3);
    expect(resolved.board.hexes[startHex]?.occupants.p1 ?? []).not.toContain(
      deployed.unitId
    );
    expect(resolved.board.hexes[capitalKey]?.occupants.p1 ?? []).toContain(
      deployed.unitId
    );
  });
});

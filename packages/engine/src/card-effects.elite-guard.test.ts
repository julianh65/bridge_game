import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { ELITE_GUARD } from "./content/cards/age3";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";
import { addChampionToHex } from "./units";

describe("Elite Guard", () => {
  it("deploys forces to the capital and heals a champion there", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const capitalHex = "0,0";
    const board = createBaseBoard(2);
    board.hexes[capitalHex] = {
      ...board.hexes[capitalHex],
      tile: "capital",
      ownerPlayerId: "p1"
    };

    const deployed = addChampionToHex(board, "p1", capitalHex, {
      cardDefId: "champion.test",
      hp: 5,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });

    const champion = deployed.board.units[deployed.unitId];
    if (!champion || champion.kind !== "champion") {
      throw new Error("expected champion unit");
    }

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: {
        ...deployed.board,
        units: {
          ...deployed.board.units,
          [deployed.unitId]: {
            ...champion,
            hp: 3,
            maxHp: 5
          }
        }
      },
      players: base.players.map((player) =>
        player.id === "p1" ? { ...player, capitalHex } : player
      )
    };

    const targets = { choice: "capital", hexKey: capitalHex };
    expect(isCardPlayable(state, "p1", ELITE_GUARD, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", ELITE_GUARD, targets);
    const occupantIds = resolved.board.hexes[capitalHex]?.occupants.p1 ?? [];
    const forceIds = occupantIds.filter(
      (unitId) => resolved.board.units[unitId]?.kind === "force"
    );

    expect(forceIds).toHaveLength(5);

    const healed = resolved.board.units[deployed.unitId];
    if (!healed || healed.kind !== "champion") {
      throw new Error("missing healed champion");
    }
    expect(healed.hp).toBe(5);
  });
});

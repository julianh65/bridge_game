import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { BATTALION_CONTRACT } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";

describe("Battalion Contract", () => {
  it("deploys 10 forces to the player's capital", () => {
    const base = createNewGame(DEFAULT_CONFIG, 7, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const capitalHex = "0,0";
    const board = createBaseBoard(2);
    const players = base.players.map((player) =>
      player.id === "p1" ? { ...player, capitalHex } : player
    );

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board,
      players
    };

    const targets = { choice: "capital", hexKey: capitalHex };

    expect(isCardPlayable(state, "p1", BATTALION_CONTRACT, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", BATTALION_CONTRACT, targets);
    const occupantIds = resolved.board.hexes[capitalHex]?.occupants.p1 ?? [];

    expect(occupantIds).toHaveLength(10);
    for (const unitId of occupantIds) {
      expect(resolved.board.units[unitId]?.kind).toBe("force");
    }
  });
});

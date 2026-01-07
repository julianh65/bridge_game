import { describe, expect, it } from "vitest";

import { createCardInstance } from "./cards";
import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { CHAMPION_RECALL } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex } from "./units";
import type { GameState } from "./types";

describe("Champion Recall", () => {
  it("removes a friendly champion and returns its card from the burn pile", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexKey = "0,0";

    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age1.sergeant",
      hp: 4,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board: deployed.board,
      modifiers: [
        {
          id: "m1",
          source: { type: "card", sourceId: "test.mod" },
          ownerPlayerId: "p1",
          attachedUnitId: deployed.unitId,
          duration: { type: "endOfRound" },
          hooks: {}
        }
      ]
    };

    const created = createCardInstance(state, "champion.age1.sergeant");
    state = {
      ...created.state,
      players: created.state.players.map((player) =>
        player.id === "p1" ? { ...player, burned: [created.instanceId] } : player
      )
    };

    const resolved = resolveCardEffects(state, "p1", CHAMPION_RECALL, {
      unitId: deployed.unitId
    });

    const p1 = resolved.players.find((player) => player.id === "p1");
    if (!p1) {
      throw new Error("missing p1");
    }

    expect(resolved.board.units[deployed.unitId]).toBeUndefined();
    expect(resolved.board.hexes[hexKey]?.occupants.p1 ?? []).not.toContain(
      deployed.unitId
    );
    expect(p1.burned).not.toContain(created.instanceId);
    expect(p1.deck.hand).toContain(created.instanceId);
    expect(resolved.modifiers.some((modifier) => modifier.id === "m1")).toBe(false);
  });
});

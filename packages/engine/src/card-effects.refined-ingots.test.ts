import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { REFINED_INGOTS } from "./content/cards/age2";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";
import type { GameState } from "./types";
import { addForcesToHex } from "./units";

const setupState = (occupiesMine: boolean): GameState => {
  const base = createNewGame(DEFAULT_CONFIG, 11, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);

  const hexKey = "0,0";
  let board = createBaseBoard(1);
  board = {
    ...board,
    hexes: {
      ...board.hexes,
      [hexKey]: {
        ...board.hexes[hexKey],
        tile: "mine",
        mineValue: 4
      }
    }
  };

  if (occupiesMine) {
    board = addForcesToHex(board, "p1", hexKey, 1);
  }

  return {
    ...base,
    phase: "round.action",
    blocks: undefined,
    board,
    players: base.players.map((player) =>
      player.id === "p1"
        ? {
            ...player,
            resources: {
              ...player.resources,
              gold: 0
            }
          }
        : player
    )
  };
};

describe("Refined Ingots", () => {
  it("grants bonus gold when occupying a mine", () => {
    const state = setupState(true);
    const resolved = resolveCardEffects(state, "p1", REFINED_INGOTS);
    const gold = resolved.players.find((player) => player.id === "p1")?.resources.gold;
    expect(gold).toBe(4);
  });

  it("grants base gold when not occupying a mine", () => {
    const state = setupState(false);
    const resolved = resolveCardEffects(state, "p1", REFINED_INGOTS);
    const gold = resolved.players.find((player) => player.id === "p1")?.resources.gold;
    expect(gold).toBe(2);
  });
});

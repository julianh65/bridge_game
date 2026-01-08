import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { resolveCardEffects } from "./card-effects";
import { SMUGGLING_RING } from "./content/cards/age2";
import { DEFAULT_CONFIG } from "./config";
import { createNewGame } from "./engine";
import type { GameState } from "./types";
import { addForcesToHex } from "./units";

const setupState = (occupiesEnemyCapital: boolean): GameState => {
  const base = createNewGame(DEFAULT_CONFIG, 9, [
    { id: "p1", name: "Player 1" },
    { id: "p2", name: "Player 2" }
  ]);

  const hexKey = "0,0";
  let board = createBaseBoard(1);
  board.hexes[hexKey] = {
    ...board.hexes[hexKey],
    tile: "capital",
    ownerPlayerId: "p2"
  };

  if (occupiesEnemyCapital) {
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

describe("Smuggling Ring", () => {
  it("grants bonus gold when occupying an enemy capital", () => {
    const state = setupState(true);
    const resolved = resolveCardEffects(state, "p1", SMUGGLING_RING);
    const gold = resolved.players.find((player) => player.id === "p1")?.resources.gold;
    expect(gold).toBe(5);
  });

  it("only grants base gold when not occupying an enemy capital", () => {
    const state = setupState(false);
    const resolved = resolveCardEffects(state, "p1", SMUGGLING_RING);
    const gold = resolved.players.find((player) => player.id === "p1")?.resources.gold;
    expect(gold).toBe(2);
  });
});

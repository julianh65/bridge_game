import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { DEEP_SHAFT_RIG } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameState } from "./types";
import { addForcesToHex } from "./units";

describe("Deep Shaft Rig", () => {
  const baseState = () =>
    createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

  const buildState = (board: GameState["board"]): GameState => {
    const base = baseState();
    return {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };
  };

  it("increases mine value and deploys a force", () => {
    const mineHex = "1,0";

    let board = createBaseBoard(2);
    board = {
      ...board,
      hexes: {
        ...board.hexes,
        [mineHex]: {
          ...board.hexes[mineHex],
          tile: "mine",
          mineValue: 6
        }
      }
    };
    board = addForcesToHex(board, "p1", mineHex, 1);

    const state = buildState(board);

    expect(isCardPlayable(state, "p1", DEEP_SHAFT_RIG, { hexKey: mineHex })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", DEEP_SHAFT_RIG, {
      hexKey: mineHex
    });
    const resolvedHex = resolved.board.hexes[mineHex];

    expect(resolvedHex?.mineValue).toBe(7);
    expect(resolvedHex?.occupants.p1 ?? []).toHaveLength(2);
  });

  it("caps mine value at 7", () => {
    const mineHex = "1,0";

    let board = createBaseBoard(2);
    board = {
      ...board,
      hexes: {
        ...board.hexes,
        [mineHex]: {
          ...board.hexes[mineHex],
          tile: "mine",
          mineValue: 7
        }
      }
    };
    board = addForcesToHex(board, "p1", mineHex, 1);

    const state = buildState(board);

    const resolved = resolveCardEffects(state, "p1", DEEP_SHAFT_RIG, {
      hexKey: mineHex
    });
    const resolvedHex = resolved.board.hexes[mineHex];

    expect(resolvedHex?.mineValue).toBe(7);
    expect(resolvedHex?.occupants.p1 ?? []).toHaveLength(2);
  });
});

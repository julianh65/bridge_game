import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { GUERILLA_NATIVE_MERCENARY } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Guerilla Native Mercenary", () => {
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

  it("allows deployment to empty or friendly occupied hexes", () => {
    const friendlyHex = "0,0";
    const emptyHex = "1,0";
    const enemyHex = "0,1";

    let board = createBaseBoard(2);
    board = addForcesToHex(board, "p1", friendlyHex, 1);
    board = addForcesToHex(board, "p2", enemyHex, 1);

    const state = buildState(board);

    expect(
      isCardPlayable(state, "p1", GUERILLA_NATIVE_MERCENARY, { hexKey: friendlyHex })
    ).toBe(true);
    expect(
      isCardPlayable(state, "p1", GUERILLA_NATIVE_MERCENARY, { hexKey: emptyHex })
    ).toBe(true);
    expect(
      isCardPlayable(state, "p1", GUERILLA_NATIVE_MERCENARY, { hexKey: enemyHex })
    ).toBe(false);

    const resolved = resolveCardEffects(state, "p1", GUERILLA_NATIVE_MERCENARY, {
      hexKey: emptyHex
    });
    const occupantIds = resolved.board.hexes[emptyHex]?.occupants.p1 ?? [];
    expect(occupantIds).toHaveLength(1);
    const unit = resolved.board.units[occupantIds[0]];
    expect(unit?.kind).toBe("champion");
    expect(unit?.cardDefId).toBe(GUERILLA_NATIVE_MERCENARY.id);
  });
});

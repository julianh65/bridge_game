import { describe, expect, it } from "vitest";

import { neighborHexKeys } from "@bridgefront/shared";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { ENCIRCLEMENT } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Encirclement", () => {
  it("removes up to 6 enemy forces when surrounded by at least 3 friendly hexes", () => {
    const base = createNewGame(DEFAULT_CONFIG, 21, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const targetHex = "0,0";
    const boardRadius = 2;
    let board = createBaseBoard(boardRadius);

    const neighbors = neighborHexKeys(targetHex).filter((hexKey) => Boolean(board.hexes[hexKey]));
    const friendlyHexes = neighbors.slice(0, 3);

    for (const hexKey of friendlyHexes) {
      board = addForcesToHex(board, "p1", hexKey, 1);
    }
    board = addForcesToHex(board, "p2", targetHex, 7);

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    expect(isCardPlayable(state, "p1", ENCIRCLEMENT, { hexKey: targetHex })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", ENCIRCLEMENT, { hexKey: targetHex });
    const enemyUnits = resolved.board.hexes[targetHex]?.occupants.p2 ?? [];

    expect(enemyUnits).toHaveLength(1);
  });

  it("does nothing if fewer than 3 adjacent friendly hexes are occupied", () => {
    const base = createNewGame(DEFAULT_CONFIG, 22, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const targetHex = "0,0";
    let board = createBaseBoard(2);

    const neighbors = neighborHexKeys(targetHex).filter((hexKey) => Boolean(board.hexes[hexKey]));
    const friendlyHexes = neighbors.slice(0, 2);

    for (const hexKey of friendlyHexes) {
      board = addForcesToHex(board, "p1", hexKey, 1);
    }
    board = addForcesToHex(board, "p2", targetHex, 3);

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    expect(isCardPlayable(state, "p1", ENCIRCLEMENT, { hexKey: targetHex })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", ENCIRCLEMENT, { hexKey: targetHex });
    const enemyUnits = resolved.board.hexes[targetHex]?.occupants.p2 ?? [];

    expect(enemyUnits).toHaveLength(3);
  });
});

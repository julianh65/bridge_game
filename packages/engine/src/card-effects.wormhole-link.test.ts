import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { WORMHOLE_LINK } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex } from "./units";
import type { GameState } from "./types";

describe("Wormhole Link", () => {
  it("adds a hex-link modifier between two hexes in champion range", () => {
    const base = createNewGame(DEFAULT_CONFIG, 15, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    let board = createBaseBoard(3);
    const deployed = addChampionToHex(board, "p1", "0,0", {
      cardDefId: "test.champion",
      hp: 3,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = deployed.board;

    const from = "0,3";
    const to = "3,0";

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    const targets = { from, to };

    expect(isCardPlayable(state, "p1", WORMHOLE_LINK, targets)).toBe(true);

    const resolved = resolveCardEffects(state, "p1", WORMHOLE_LINK, targets);
    const modifier = resolved.modifiers.find((entry) => {
      const link = entry.data?.link as { from?: string; to?: string } | undefined;
      if (!link?.from || !link?.to) {
        return false;
      }
      return (
        (link.from === from && link.to === to) ||
        (link.from === to && link.to === from)
      );
    });

    expect(modifier).toBeTruthy();
    expect(modifier?.duration?.type).toBe("endOfRound");
  });

  it("rejects hexes outside friendly champion range", () => {
    const base = createNewGame(DEFAULT_CONFIG, 16, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    let board = createBaseBoard(4);
    const deployed = addChampionToHex(board, "p1", "0,0", {
      cardDefId: "test.champion",
      hp: 3,
      attackDice: 2,
      hitFaces: 3,
      bounty: 1
    });
    board = deployed.board;

    const state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board
    };

    expect(isCardPlayable(state, "p1", WORMHOLE_LINK, { from: "4,0", to: "0,0" })).toBe(
      false
    );
  });
});

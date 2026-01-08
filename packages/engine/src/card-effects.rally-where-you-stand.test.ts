import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { RALLY_WHERE_YOU_STAND } from "./content/cards/age2";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addChampionToHex } from "./units";
import type { GameState } from "./types";

describe("Rally Where You Stand", () => {
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

  it("deploys forces to a friendly champion hex", () => {
    const hexKey = "0,0";

    let board = createBaseBoard(2);
    const deployed = addChampionToHex(board, "p1", hexKey, {
      cardDefId: "champion.age1.sergeant",
      hp: 3,
      attackDice: 1,
      hitFaces: 3,
      bounty: 1
    });
    board = deployed.board;

    const state = buildState(board);

    expect(
      isCardPlayable(state, "p1", RALLY_WHERE_YOU_STAND, { unitId: deployed.unitId })
    ).toBe(true);

    const resolved = resolveCardEffects(state, "p1", RALLY_WHERE_YOU_STAND, {
      unitId: deployed.unitId
    });

    expect(resolved.board.hexes[hexKey]?.occupants.p1 ?? []).toHaveLength(4);
  });

  it("rejects enemy champion targets", () => {
    const hexKey = "0,0";

    let board = createBaseBoard(2);
    const deployed = addChampionToHex(board, "p2", hexKey, {
      cardDefId: "champion.age1.sergeant",
      hp: 3,
      attackDice: 1,
      hitFaces: 3,
      bounty: 1
    });
    board = deployed.board;

    const state = buildState(board);

    expect(
      isCardPlayable(state, "p1", RALLY_WHERE_YOU_STAND, { unitId: deployed.unitId })
    ).toBe(false);
  });
});

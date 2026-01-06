import { createRngState } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { resolveBattleAtHex, resolveImmediateBattles, resolveSieges } from "./combat";
import { DEFAULT_CONFIG, createNewGame } from "./index";

const createChampion = (
  id: string,
  ownerPlayerId: string,
  hex: string,
  hp: number,
  hitFaces: number,
  bounty: number
) => ({
  id,
  ownerPlayerId,
  kind: "champion" as const,
  hex,
  cardDefId: `test.${id}`,
  hp,
  maxHp: hp,
  attackDice: 1,
  hitFaces,
  bounty,
  abilityUses: {}
});

describe("combat resolution", () => {
  it("skips capital battles during immediate resolution", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const capitalKey = "0,0";
    const skirmishKey = "1,0";

    board.hexes[capitalKey] = {
      ...board.hexes[capitalKey],
      tile: "capital",
      ownerPlayerId: "p1",
      occupants: {
        p1: ["c1"],
        p2: ["c2"]
      }
    };
    board.hexes[skirmishKey] = {
      ...board.hexes[skirmishKey],
      occupants: {
        p1: ["s1"],
        p2: ["s2"]
      }
    };

    board.units = {
      c1: createChampion("c1", "p1", capitalKey, 2, 6, 2),
      c2: createChampion("c2", "p2", capitalKey, 1, 0, 1),
      s1: createChampion("s1", "p1", skirmishKey, 2, 6, 2),
      s2: createChampion("s2", "p2", skirmishKey, 1, 0, 1)
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(42),
      board
    };

    const resolved = resolveImmediateBattles(state);
    const skirmish = resolved.board.hexes[skirmishKey];
    const capital = resolved.board.hexes[capitalKey];

    expect(skirmish.occupants["p2"] ?? []).toHaveLength(0);
    expect(capital.occupants["p2"] ?? []).toHaveLength(1);
    expect(resolved.board.units["c2"]).toBeDefined();
  });

  it("halts battles when neither side can hit", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["c1"],
        p2: ["c2"]
      }
    };
    board.units = {
      c1: createChampion("c1", "p1", hexKey, 2, 0, 2),
      c2: createChampion("c2", "p2", hexKey, 2, 0, 2)
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(1),
      board
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const hex = resolved.board.hexes[hexKey];

    expect(hex.occupants["p1"]).toEqual(["c1"]);
    expect(hex.occupants["p2"]).toEqual(["c2"]);
  });

  it("resolves sieges on contested capitals", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const capitalKey = "0,0";
    board.hexes[capitalKey] = {
      ...board.hexes[capitalKey],
      tile: "capital",
      ownerPlayerId: "p1",
      occupants: {
        p1: ["c1"],
        p2: ["c2"]
      }
    };
    board.units = {
      c1: createChampion("c1", "p1", capitalKey, 2, 6, 2),
      c2: createChampion("c2", "p2", capitalKey, 1, 0, 1)
    };

    const state = {
      ...base,
      phase: "round.sieges",
      blocks: undefined,
      rngState: createRngState(99),
      board
    };

    const resolved = resolveSieges(state);
    const capital = resolved.board.hexes[capitalKey];

    expect(capital.occupants["p2"] ?? []).toHaveLength(0);
    expect(resolved.board.units["c2"]).toBeUndefined();
  });
});

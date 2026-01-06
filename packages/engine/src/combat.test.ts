import { createRngState } from "@bridgefront/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as shared from "@bridgefront/shared";

import { createBaseBoard } from "./board-generation";
import { resolveBattleAtHex, resolveImmediateBattles, resolveSieges } from "./combat";
import { applyChampionDeployment } from "./champions";
import { emit } from "./events";
import { createFactionModifiers } from "./faction-passives";
import { DEFAULT_CONFIG, createNewGame } from "./index";
import type { Modifier } from "./types";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("logs combat start and end events", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 1,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };

    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(5),
      board
    };

    const resolved = resolveBattleAtHex(state, hexKey);

    expect(resolved.logs.map((entry) => entry.type)).toEqual(["combat.start", "combat.end"]);
    expect(resolved.logs[1]?.payload?.reason).toBe("eliminated");
    expect(resolved.logs[1]?.payload?.winnerPlayerId ?? null).toBeNull();
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

  it("stops after repeated no-hit rounds", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 6,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };

    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(7),
      board
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const hex = resolved.board.hexes[hexKey];

    expect(hex.occupants["p1"]).toEqual(["f1"]);
    expect(hex.occupants["p2"]).toEqual(["f2"]);
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

  it("applies force hit face modifiers", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const modifier: Modifier = {
      id: "m1",
      source: { type: "card", sourceId: "test" },
      attachedHex: hexKey,
      duration: { type: "endOfBattle" },
      hooks: {
        getForceHitFaces: () => 0
      }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(11),
      board,
      modifiers: [modifier]
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const hex = resolved.board.hexes[hexKey];

    expect(resolved.logs[1]?.payload?.reason).toBe("noHits");
    expect(hex.occupants["p1"]).toEqual(["f1"]);
    expect(hex.occupants["p2"]).toEqual(["f2"]);
  });

  it("redirects the first champion hit to a force with Bodyguard", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 1,
      next: rng
    }));
    vi.spyOn(shared, "randInt").mockImplementation((rng) => ({
      value: 0,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["c1", "f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey },
      c1: {
        id: "c1",
        ownerPlayerId: "p2",
        kind: "champion",
        hex: hexKey,
        cardDefId: "champion.bastion.ironclad_warden",
        hp: 6,
        maxHp: 6,
        attackDice: 2,
        hitFaces: 2,
        bounty: 3,
        abilityUses: {}
      }
    };

    let state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(11),
      board,
      modifiers: []
    };

    state = applyChampionDeployment(
      state,
      "c1",
      "champion.bastion.ironclad_warden",
      "p2"
    );

    const resolved = resolveBattleAtHex(state, hexKey);
    const champion = resolved.board.units["c1"];

    expect(champion?.kind).toBe("champion");
    if (champion && champion.kind === "champion") {
      expect(champion.hp).toBe(6);
    }
    expect(resolved.board.units["f2"]).toBeUndefined();
  });

  it("applies Assassin's Edge before combat round 1", () => {
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
      c1: {
        id: "c1",
        ownerPlayerId: "p1",
        kind: "champion",
        hex: hexKey,
        cardDefId: "champion.veil.shadeblade",
        hp: 3,
        maxHp: 3,
        attackDice: 0,
        hitFaces: 0,
        bounty: 3,
        abilityUses: {}
      },
      c2: {
        id: "c2",
        ownerPlayerId: "p2",
        kind: "champion",
        hex: hexKey,
        cardDefId: "champion.bastion.ironclad_warden",
        hp: 3,
        maxHp: 3,
        attackDice: 0,
        hitFaces: 0,
        bounty: 2,
        abilityUses: {}
      }
    };

    let state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(12),
      board,
      modifiers: []
    };

    state = applyChampionDeployment(state, "c1", "champion.veil.shadeblade", "p1");

    const resolved = resolveBattleAtHex(state, hexKey);
    const enemy = resolved.board.units["c2"];
    const shadeblade = resolved.board.units["c1"];

    expect(enemy?.kind).toBe("champion");
    if (enemy && enemy.kind === "champion") {
      expect(enemy.hp).toBe(2);
    }
    expect(shadeblade?.kind).toBe("champion");
    if (shadeblade && shadeblade.kind === "champion") {
      expect(shadeblade.abilityUses["assassins_edge"]?.remaining).toBe(0);
    }
  });

  it("applies bastion shield wall to defender forces in round 1", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 3,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(12),
      board,
      modifiers: createFactionModifiers("bastion", "p2")
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const hex = resolved.board.hexes[hexKey];

    expect(hex.occupants["p1"]).toHaveLength(0);
    expect(hex.occupants["p2"]).toEqual(["f2"]);
  });

  it("applies prospect mine militia to defender forces in mines", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 3,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      tile: "mine",
      mineValue: 2,
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(13),
      board,
      modifiers: createFactionModifiers("prospect", "p2")
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const hex = resolved.board.hexes[hexKey];

    expect(hex.occupants["p1"]).toHaveLength(0);
    expect(hex.occupants["p2"]).toEqual(["f2"]);
  });

  it("applies gatewright capital assault in enemy capitals", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 3,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      tile: "capital",
      ownerPlayerId: "p2",
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(21),
      board,
      modifiers: createFactionModifiers("gatewright", "p1")
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const hex = resolved.board.hexes[hexKey];

    expect(hex.occupants["p2"]).toHaveLength(0);
    expect(hex.occupants["p1"]).toEqual(["f1"]);
  });

  it("steals gold on gatewright battle wins", () => {
    let rollCount = 0;
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => {
      rollCount += 1;
      return { value: rollCount === 1 ? 1 : 6, next: rng };
    });

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(22),
      board,
      modifiers: createFactionModifiers("gatewright", "p1"),
      players: base.players.map((player) =>
        player.id === "p1"
          ? { ...player, resources: { ...player.resources, gold: 1 } }
          : { ...player, resources: { ...player.resources, gold: 3 } }
      )
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const p1 = resolved.players.find((player) => player.id === "p1");
    const p2 = resolved.players.find((player) => player.id === "p2");

    expect(p1?.resources.gold).toBe(3);
    expect(p2?.resources.gold).toBe(1);
  });

  it("heals veil champions after battle", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 1,
      next: rng
    }));

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
        p2: ["f2"]
      }
    };
    board.units = {
      c1: {
        id: "c1",
        ownerPlayerId: "p1",
        kind: "champion",
        hex: hexKey,
        cardDefId: "test.c1",
        hp: 2,
        maxHp: 3,
        attackDice: 1,
        hitFaces: 3,
        bounty: 2,
        abilityUses: {}
      },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(23),
      board,
      modifiers: createFactionModifiers("veil", "p1")
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const champion = resolved.board.units["c1"];

    expect(champion).toBeDefined();
    if (!champion || champion.kind !== "champion") {
      throw new Error("expected champion to survive");
    }
    expect(champion.hp).toBe(2);
  });

  it("dispatches before/after combat hooks", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({
      value: 1,
      next: rng
    }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const modifier: Modifier = {
      id: "m2",
      source: { type: "card", sourceId: "test" },
      attachedHex: hexKey,
      duration: { type: "endOfBattle" },
      hooks: {
        beforeCombatRound: ({ state }) =>
          emit(state, { type: "test.beforeCombatRound" }),
        afterBattle: ({ state }) => emit(state, { type: "test.afterBattle" })
      }
    };

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(9),
      board,
      modifiers: [modifier]
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const events = resolved.logs.map((entry) => entry.type);

    expect(events).toContain("test.beforeCombatRound");
    expect(events).toContain("test.afterBattle");
    expect(events.indexOf("test.beforeCombatRound")).toBeLessThan(
      events.indexOf("combat.end")
    );
    expect(events.indexOf("test.afterBattle")).toBeGreaterThan(
      events.indexOf("combat.end")
    );
  });

  it("expires end-of-battle modifiers after combat", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";
    const otherHex = "1,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: {
        p1: ["f1"],
        p2: ["f2"]
      }
    };
    board.units = {
      f1: { id: "f1", ownerPlayerId: "p1", kind: "force", hex: hexKey },
      f2: { id: "f2", ownerPlayerId: "p2", kind: "force", hex: hexKey }
    };

    const modifiers: Modifier[] = [
      {
        id: "m1",
        source: { type: "card", sourceId: "test" },
        attachedHex: hexKey,
        duration: { type: "endOfBattle" }
      },
      {
        id: "m2",
        source: { type: "card", sourceId: "test" },
        attachedHex: otherHex,
        duration: { type: "endOfBattle" }
      },
      {
        id: "m3",
        source: { type: "card", sourceId: "test" },
        duration: { type: "permanent" }
      }
    ];

    const state = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(17),
      board,
      modifiers
    };

    const resolved = resolveBattleAtHex(state, hexKey);
    const remaining = resolved.modifiers.map((modifier) => modifier.id).sort();

    expect(remaining).toEqual(["m2", "m3"]);
  });
});

import { createRngState, neighborHexKeys } from "@bridgefront/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as shared from "@bridgefront/shared";

import { resolveBattleAtHex } from "./combat";
import { resolveCardEffects } from "./card-effects";
import { createBaseBoard } from "./board-generation";
import { BATTLE_CRY, SMOKE_SCREEN } from "./content/cards/age1";
import { SLOW } from "./content/cards/age2";
import type { CardDef } from "./content/cards";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { GameEvent, GameState } from "./types";

type CombatRoundPayload = Extract<GameEvent, { type: "combat.round" }>["payload"];

type ChampionUnit = GameState["board"]["units"][string] & { kind: "champion" };

type ForceUnit = GameState["board"]["units"][string] & { kind: "force" };

const createChampion = (
  id: string,
  ownerPlayerId: string,
  hex: string,
  hp = 2,
  attackDice = 1
): ChampionUnit => ({
  id,
  ownerPlayerId,
  kind: "champion",
  hex,
  cardDefId: `test.${id}`,
  hp,
  maxHp: hp,
  attackDice,
  hitFaces: 3,
  bounty: 1,
  abilityUses: {}
});

const createForce = (id: string, ownerPlayerId: string, hex: string): ForceUnit => ({
  id,
  ownerPlayerId,
  kind: "force",
  hex
});

const getFirstCombatRound = (state: GameState, hexKey: string): CombatRoundPayload => {
  const entry = state.logs.find(
    (event) => event.type === "combat.round" && event.payload.hexKey === hexKey
  );
  if (!entry || entry.type !== "combat.round") {
    throw new Error(`missing combat round log for ${hexKey}`);
  }
  return entry.payload;
};

const getDiceCount = (payload: CombatRoundPayload, playerId: string): number => {
  if (payload.attackers.playerId === playerId) {
    return payload.attackers.dice.length;
  }
  if (payload.defenders.playerId === playerId) {
    return payload.defenders.dice.length;
  }
  throw new Error(`missing dice for ${playerId}`);
};

const getHits = (payload: CombatRoundPayload, playerId: string): number => {
  if (payload.attackers.playerId === playerId) {
    return payload.attackers.hits;
  }
  if (payload.defenders.playerId === playerId) {
    return payload.defenders.hits;
  }
  throw new Error(`missing hits for ${playerId}`);
};

describe("combat card effects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("battle cry boosts champion dice for the first battle only", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 1, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexA = "0,0";
    const hexB = "1,0";

    board.hexes[hexA] = {
      ...board.hexes[hexA],
      occupants: { p1: ["c1"], p2: ["c2"] }
    };
    board.hexes[hexB] = {
      ...board.hexes[hexB],
      occupants: { p1: ["c3"], p2: ["c4"] }
    };

    board.units = {
      c1: createChampion("c1", "p1", hexA),
      c2: createChampion("c2", "p2", hexA),
      c3: createChampion("c3", "p1", hexB),
      c4: createChampion("c4", "p2", hexB)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(9),
      board
    };

    state = resolveCardEffects(state, "p1", BATTLE_CRY);
    state = resolveBattleAtHex(state, hexA);

    const firstRound = getFirstCombatRound(state, hexA);
    expect(getDiceCount(firstRound, "p1")).toBe(2);
    expect(getDiceCount(firstRound, "p2")).toBe(1);

    state = resolveBattleAtHex(state, hexB);
    const secondRound = getFirstCombatRound(state, hexB);
    expect(getDiceCount(secondRound, "p1")).toBe(1);
    expect(getDiceCount(secondRound, "p2")).toBe(1);

    const hasBattleCryModifier = state.modifiers.some(
      (modifier) => modifier.source.sourceId === BATTLE_CRY.id
    );
    expect(hasBattleCryModifier).toBe(false);
  });

  it("smoke screen suppresses enemy force hits for the first battle only", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 2, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 2, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexA = "0,0";
    const hexB = "1,0";

    board.hexes[hexA] = {
      ...board.hexes[hexA],
      occupants: { p1: ["f1"], p2: ["f2"] }
    };
    board.hexes[hexB] = {
      ...board.hexes[hexB],
      occupants: { p1: ["f3"], p2: ["f4"] }
    };

    board.units = {
      f1: createForce("f1", "p1", hexA),
      f2: createForce("f2", "p2", hexA),
      f3: createForce("f3", "p1", hexB),
      f4: createForce("f4", "p2", hexB)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(5),
      board
    };

    state = resolveCardEffects(state, "p1", SMOKE_SCREEN);
    state = resolveBattleAtHex(state, hexA);

    const firstRound = getFirstCombatRound(state, hexA);
    expect(getHits(firstRound, "p2")).toBe(0);

    state = resolveBattleAtHex(state, hexB);
    const secondRound = getFirstCombatRound(state, hexB);
    expect(getHits(secondRound, "p2")).toBe(1);
  });

  it("frenzy boosts dice for the round and deals damage immediately", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 6, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 4, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: { p1: ["c1"], p2: ["c2"] }
    };

    board.units = {
      c1: createChampion("c1", "p1", hexKey, 4),
      c2: createChampion("c2", "p2", hexKey, 4)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(9),
      board
    };

    const frenzyCard: CardDef = {
      id: "test.frenzy",
      name: "Frenzy",
      rulesText: "Target friendly Champion rolls +2 dice this round; it takes 2 damage.",
      type: "Spell",
      deck: "starter",
      tags: [],
      cost: { mana: 1 },
      initiative: 1,
      burn: false,
      targetSpec: {
        kind: "champion",
        owner: "self"
      },
      effects: [{ kind: "frenzy", diceBonus: 2, damage: 2 }]
    };

    state = resolveCardEffects(state, "p1", frenzyCard, { unitId: "c1" });
    const damaged = state.board.units.c1;
    if (!damaged || damaged.kind !== "champion") {
      throw new Error("missing frenzy target");
    }
    expect(damaged.hp).toBe(2);

    state = resolveBattleAtHex(state, hexKey);

    const round = getFirstCombatRound(state, hexKey);
    expect(getDiceCount(round, "p1")).toBe(3);
    expect(getDiceCount(round, "p2")).toBe(1);
  });

  it("slow limits a target champion to 1 die in its next battle", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 1, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 5, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexA = "0,0";
    const hexB = "1,0";

    board.hexes[hexA] = {
      ...board.hexes[hexA],
      occupants: { p1: ["c1"], p2: ["c2"] }
    };
    board.hexes[hexB] = {
      ...board.hexes[hexB],
      occupants: { p1: ["c3"], p2: ["c4"] }
    };

    board.units = {
      c1: createChampion("c1", "p1", hexA, 3, 3),
      c2: createChampion("c2", "p2", hexA),
      c3: createChampion("c3", "p1", hexB),
      c4: createChampion("c4", "p2", hexB)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(11),
      board
    };

    state = resolveCardEffects(state, "p2", SLOW, { unitId: "c1" });
    state = resolveBattleAtHex(state, hexB);

    const hasSlowBeforeTargetBattle = state.modifiers.some(
      (modifier) => modifier.source.sourceId === SLOW.id
    );
    expect(hasSlowBeforeTargetBattle).toBe(true);

    state = resolveBattleAtHex(state, hexA);

    const slowedRound = getFirstCombatRound(state, hexA);
    expect(getDiceCount(slowedRound, "p1")).toBe(1);

    const hasSlowAfterTargetBattle = state.modifiers.some(
      (modifier) => modifier.source.sourceId === SLOW.id
    );
    expect(hasSlowAfterTargetBattle).toBe(false);
  });

  it("focus fire assigns hits to champions in the next battle only", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 1, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 4, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: { p1: ["f1", "f2"], p2: ["c1", "c2", "f3"] }
    };

    board.units = {
      f1: createForce("f1", "p1", hexKey),
      f2: createForce("f2", "p1", hexKey),
      f3: createForce("f3", "p2", hexKey),
      c1: { ...createChampion("c1", "p2", hexKey), hp: 1 },
      c2: createChampion("c2", "p2", hexKey)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(12),
      board
    };

    const focusFireCard: CardDef = {
      id: "test.focus_fire",
      name: "Focus Fire",
      rulesText: "Assign your hits in the next battle.",
      type: "Spell",
      deck: "starter",
      tags: [],
      cost: { mana: 1 },
      initiative: 10,
      burn: false,
      targetSpec: { kind: "none" },
      effects: [{ kind: "focusFire" }]
    };

    state = resolveCardEffects(state, "p1", focusFireCard);
    state = resolveBattleAtHex(state, hexKey);

    const round = getFirstCombatRound(state, hexKey);
    const championHits = round.hitsToDefenders.champions.map((entry) => entry.unitId).sort();
    expect(championHits).toEqual(["c1", "c2"]);
    expect(round.hitsToDefenders.forces).toBe(0);

    const focusFireActive = state.modifiers.some(
      (modifier) => modifier.source.sourceId === focusFireCard.id
    );
    expect(focusFireActive).toBe(false);
  });

  it("set to skirmish retreats units to an empty adjacent hex", () => {
    const base = createNewGame(DEFAULT_CONFIG, 3, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: { p1: ["f1", "c1"], p2: ["f2"] }
    };

    board.units = {
      f1: createForce("f1", "p1", hexKey),
      c1: createChampion("c1", "p1", hexKey),
      f2: createForce("f2", "p2", hexKey)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(17),
      board
    };

    const skirmishCard: CardDef = {
      id: "test.set_to_skirmish",
      name: "Set to Skirmish",
      rulesText: "Retreat from battle in the chosen hex.",
      type: "Order",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: false,
      targetSpec: { kind: "hex" },
      effects: [{ kind: "setToSkirmish" }]
    };

    state = resolveCardEffects(state, "p1", skirmishCard, { hexKey });
    state = resolveBattleAtHex(state, hexKey);

    const finalHex = state.board.hexes[hexKey];
    expect(finalHex.occupants["p1"] ?? []).toHaveLength(0);
    expect(finalHex.occupants["p2"] ?? []).toHaveLength(1);

    const retreatHexes = new Set(
      ["f1", "c1"]
        .map((unitId) => state.board.units[unitId]?.hex)
        .filter((key): key is string => typeof key === "string")
    );
    expect(retreatHexes.size).toBe(1);
    const [retreatHex] = [...retreatHexes];
    const neighbors = neighborHexKeys(hexKey).filter((key) =>
      Boolean(state.board.hexes[key])
    );
    expect(neighbors).toContain(retreatHex);

    const retreatOccupants = state.board.hexes[retreatHex].occupants;
    expect(retreatOccupants["p2"] ?? []).toHaveLength(0);
  });

  it("set to skirmish removes units if no adjacent hex is empty", () => {
    const base = createNewGame(DEFAULT_CONFIG, 4, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    const hexKey = "0,0";

    board.hexes[hexKey] = {
      ...board.hexes[hexKey],
      occupants: { p1: ["f1", "c1"], p2: ["f2"] }
    };

    const blockingUnits: Record<string, ForceUnit> = {};
    const neighbors = neighborHexKeys(hexKey).filter((key) =>
      Boolean(board.hexes[key])
    );
    neighbors.forEach((neighbor, index) => {
      const unitId = `b${index}`;
      blockingUnits[unitId] = createForce(unitId, "p2", neighbor);
      board.hexes[neighbor] = {
        ...board.hexes[neighbor],
        occupants: { p2: [unitId] }
      };
    });

    board.units = {
      f1: createForce("f1", "p1", hexKey),
      c1: createChampion("c1", "p1", hexKey),
      f2: createForce("f2", "p2", hexKey),
      ...blockingUnits
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(21),
      board
    };

    const skirmishCard: CardDef = {
      id: "test.set_to_skirmish.blocked",
      name: "Set to Skirmish",
      rulesText: "Retreat from battle in the chosen hex.",
      type: "Order",
      deck: "starter",
      tags: [],
      cost: { mana: 0 },
      initiative: 1,
      burn: false,
      targetSpec: { kind: "hex" },
      effects: [{ kind: "setToSkirmish" }]
    };

    state = resolveCardEffects(state, "p1", skirmishCard, { hexKey });
    state = resolveBattleAtHex(state, hexKey);

    const finalHex = state.board.hexes[hexKey];
    expect(finalHex.occupants["p1"] ?? []).toHaveLength(0);
    expect(finalHex.occupants["p2"] ?? []).toHaveLength(1);
    expect(state.board.units["f1"]).toBeUndefined();
    expect(state.board.units["c1"]).toBeUndefined();
  });
});

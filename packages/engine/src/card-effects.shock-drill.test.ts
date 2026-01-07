import { createRngState } from "@bridgefront/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as shared from "@bridgefront/shared";

import { resolveBattleAtHex } from "./combat";
import { resolveCardEffects } from "./card-effects";
import { createBaseBoard } from "./board-generation";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import type { CardDef } from "./content/cards";
import type { GameEvent, GameState } from "./types";

type CombatRoundPayload = Extract<GameEvent, { type: "combat.round" }>["payload"];

type ForceUnit = GameState["board"]["units"][string] & { kind: "force" };

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

const getHits = (payload: CombatRoundPayload, playerId: string): number => {
  if (payload.attackers.playerId === playerId) {
    return payload.attackers.hits;
  }
  if (payload.defenders.playerId === playerId) {
    return payload.defenders.hits;
  }
  throw new Error(`missing hits for ${playerId}`);
};

describe("shock drill card effect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("boosts friendly force hits in the next battle only", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 4, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 6, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const hexA = "0,0";
    const hexB = "1,0";

    board.hexes[hexA] = {
      ...board.hexes[hexA],
      occupants: { p1: ["f1", "f2"], p2: ["e1", "e2"] }
    };
    board.hexes[hexB] = {
      ...board.hexes[hexB],
      occupants: { p1: ["f3", "f4"], p2: ["e3", "e4"] }
    };

    board.units = {
      f1: createForce("f1", "p1", hexA),
      f2: createForce("f2", "p1", hexA),
      f3: createForce("f3", "p1", hexB),
      f4: createForce("f4", "p1", hexB),
      e1: createForce("e1", "p2", hexA),
      e2: createForce("e2", "p2", hexA),
      e3: createForce("e3", "p2", hexB),
      e4: createForce("e4", "p2", hexB)
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(9),
      board
    };

    const shockDrillCard: CardDef = {
      id: "test.shock_drill",
      name: "Shock Drill",
      rulesText: "In your next battle this round, your forces hit on 1-5.",
      type: "Spell",
      deck: "starter",
      tags: [],
      cost: { mana: 1 },
      initiative: 45,
      burn: true,
      targetSpec: { kind: "none" },
      effects: [{ kind: "shockDrill" }]
    };

    state = resolveCardEffects(state, "p1", shockDrillCard);
    state = resolveBattleAtHex(state, hexA);

    const firstRound = getFirstCombatRound(state, hexA);
    expect(getHits(firstRound, "p1")).toBe(2);
    expect(getHits(firstRound, "p2")).toBe(0);

    state = resolveBattleAtHex(state, hexB);
    const secondRound = getFirstCombatRound(state, hexB);
    expect(getHits(secondRound, "p1")).toBe(0);
  });
});

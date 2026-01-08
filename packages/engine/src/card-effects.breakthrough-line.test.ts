import { createRngState } from "@bridgefront/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as shared from "@bridgefront/shared";

import { resolveBattleAtHex } from "./combat";
import { resolveCardEffects } from "./card-effects";
import { createBaseBoard } from "./board-generation";
import { BREAKTHROUGH_LINE } from "./content/cards/age2";
import { createCardInstances } from "./cards";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { getBridgeKey } from "./board";
import { applyCleanup } from "./round-flow";
import type { GameState } from "./types";

const createForce = (id: string, ownerPlayerId: string, hex: string) => ({
  id,
  ownerPlayerId,
  kind: "force" as const,
  hex
});

describe("breakthrough line", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws at cleanup after the moved stack wins a battle", () => {
    vi.spyOn(shared, "rollDie").mockImplementation((rng) => ({ value: 1, next: rng }));

    const base = createNewGame(DEFAULT_CONFIG, 3, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(2);
    const from = "0,0";
    const to = "1,0";

    board.hexes[from] = {
      ...board.hexes[from],
      occupants: { p1: ["u1", "u2", "u3"], p2: [] }
    };
    board.hexes[to] = {
      ...board.hexes[to],
      occupants: { p1: [], p2: ["u4"] }
    };
    board.units = {
      u1: createForce("u1", "p1", from),
      u2: createForce("u2", "p1", from),
      u3: createForce("u3", "p1", from),
      u4: createForce("u4", "p2", to)
    };

    const edgeKey = getBridgeKey(from, to);
    board.bridges = {
      [edgeKey]: { key: edgeKey, from, to }
    };

    let state: GameState = {
      ...base,
      phase: "round.action",
      blocks: undefined,
      rngState: createRngState(7),
      board
    };

    const created = createCardInstances(state, [
      "starter.supply_cache",
      "starter.quick_move"
    ]);
    state = created.state;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                hand: [],
                drawPile: created.instanceIds,
                discardPile: []
              }
            }
          : player
      )
    };

    state = resolveCardEffects(state, "p1", BREAKTHROUGH_LINE, {
      path: [from, to]
    });
    state = resolveBattleAtHex(state, to);
    state = applyCleanup(state);

    const p1 = state.players.find((player) => player.id === "p1");
    expect(p1?.deck.hand).toEqual(created.instanceIds);
  });
});

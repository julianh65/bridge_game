import { describe, expect, it } from "vitest";

import { createBaseBoard } from "./board-generation";
import { isCardPlayable, resolveCardEffects } from "./card-effects";
import { FRONTIER_CLAIM } from "./content/cards/age1";
import { createNewGame, DEFAULT_CONFIG } from "./index";
import { addForcesToHex } from "./units";
import type { GameState } from "./types";

describe("Frontier Claim", () => {
  const baseState = () =>
    createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

  const buildState = (board: GameState["board"], capitalHex: string): GameState => {
    const base = baseState();
    return {
      ...base,
      phase: "round.action",
      blocks: undefined,
      board,
      players: base.players.map((player) =>
        player.id === "p1" ? { ...player, capitalHex } : player
      )
    };
  };

  it("deploys to an empty hex within 1 of the capital", () => {
    const capitalHex = "0,0";
    const targetHex = "1,0";

    let board = createBaseBoard(2);
    board = {
      ...board,
      hexes: {
        ...board.hexes,
        [capitalHex]: {
          ...board.hexes[capitalHex],
          tile: "capital",
          ownerPlayerId: "p1"
        }
      }
    };

    const state = buildState(board, capitalHex);

    expect(isCardPlayable(state, "p1", FRONTIER_CLAIM, { hexKey: targetHex })).toBe(true);

    const resolved = resolveCardEffects(state, "p1", FRONTIER_CLAIM, { hexKey: targetHex });
    expect(resolved.board.hexes[targetHex]?.occupants.p1 ?? []).toHaveLength(4);
  });

  it("rejects occupied or out-of-range hexes", () => {
    const capitalHex = "0,0";
    const occupiedHex = "1,0";
    const farHex = "2,0";

    let board = createBaseBoard(2);
    board = {
      ...board,
      hexes: {
        ...board.hexes,
        [capitalHex]: {
          ...board.hexes[capitalHex],
          tile: "capital",
          ownerPlayerId: "p1"
        }
      }
    };
    board = addForcesToHex(board, "p1", occupiedHex, 1);

    const state = buildState(board, capitalHex);

    expect(isCardPlayable(state, "p1", FRONTIER_CLAIM, { hexKey: occupiedHex })).toBe(
      false
    );
    expect(isCardPlayable(state, "p1", FRONTIER_CLAIM, { hexKey: farHex })).toBe(false);
  });
});

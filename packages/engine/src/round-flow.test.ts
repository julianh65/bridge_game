import { describe, expect, it } from "vitest";

import { createCardInstances } from "./cards";
import { createBaseBoard } from "./board-generation";
import { DEFAULT_CONFIG, createNewGame } from "./index";
import { applyCollection, applyRoundReset } from "./round-flow";

describe("round reset", () => {
  it("applies income, mana reset, and draws with hand limit overflow", () => {
    const config = {
      ...DEFAULT_CONFIG,
      HAND_LIMIT: 3,
      BASE_INCOME: 2,
      MAX_MANA: 4
    };
    let state = createNewGame(config, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const cardDefs = [
      "test.card.a",
      "test.card.b",
      "test.card.c",
      "test.card.d",
      "test.card.e",
      "test.card.f"
    ];
    const created = createCardInstances(state, cardDefs);
    const ids = created.instanceIds;

    state = {
      ...created.state,
      phase: "round.reset",
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                drawPile: ids.slice(0, 3),
                discardPile: ids.slice(3, 5),
                hand: [ids[5]],
                scrapped: []
              }
            }
          : player
      )
    };

    const next = applyRoundReset(state);
    const player = next.players[0];

    expect(next.phase).toBe("round.market");
    expect(next.round).toBe(1);
    expect(player.resources.gold).toBe(config.START_GOLD + config.BASE_INCOME);
    expect(player.resources.mana).toBe(config.MAX_MANA);
    expect(player.deck.hand.length).toBe(config.HAND_LIMIT);
    expect(player.deck.drawPile.length + player.deck.discardPile.length).toBe(3);
  });

  it("rotates lead seat index by round", () => {
    const state = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const next = applyRoundReset({
      ...state,
      round: 1,
      leadSeatIndex: 0,
      phase: "round.reset"
    });

    expect(next.round).toBe(2);
    expect(next.leadSeatIndex).toBe(1);
  });
});

describe("collection", () => {
  it("grants mine gold to the sole occupying player", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.hexes["1,0"] = {
      ...board.hexes["1,0"],
      tile: "mine",
      mineValue: 3,
      occupants: {
        p1: ["u1"]
      }
    };
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "mine",
      mineValue: 2,
      occupants: {
        p2: ["u2"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "1,0"
      },
      u2: {
        id: "u2",
        ownerPlayerId: "p2",
        kind: "force",
        hex: "0,1"
      }
    };

    const state = {
      ...base,
      board,
      players: base.players.map((player) => ({
        ...player,
        resources: { ...player.resources, gold: 0 }
      }))
    };

    const next = applyCollection(state);
    const p1 = next.players.find((player) => player.id === "p1");
    const p2 = next.players.find((player) => player.id === "p2");

    expect(p1?.resources.gold).toBe(3);
    expect(p2?.resources.gold).toBe(2);
  });
});

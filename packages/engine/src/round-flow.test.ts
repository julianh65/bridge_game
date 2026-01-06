import { describe, expect, it } from "vitest";

import { createCardInstances } from "./cards";
import { createBaseBoard } from "./board-generation";
import { DEFAULT_CONFIG, createNewGame } from "./index";
import {
  applyAgeUpdate,
  applyCleanup,
  applyRoundReset,
  applyScoring,
  applyCollectionChoice,
  createCollectionBlock,
  resolveCollectionChoices
} from "./round-flow";

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
  it("resolves mine gold and forge draft choices", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const deck = [
      "age1.quick_march",
      "age1.trade_caravan",
      "age1.patch_up",
      "age1.temporary_bridge"
    ];

    const board = createBaseBoard(1);
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "mine",
      mineValue: 2,
      occupants: {
        p1: ["u1"]
      }
    };
    board.hexes["1,0"] = {
      ...board.hexes["1,0"],
      tile: "forge",
      occupants: {
        p1: ["u2"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "0,1"
      },
      u2: {
        id: "u2",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "1,0"
      }
    };

    const state = {
      ...base,
      phase: "round.collection" as const,
      board,
      market: {
        ...base.market,
        age: "I"
      },
      marketDecks: {
        I: deck,
        II: [],
        III: []
      },
      players: base.players.map((player) => ({
        ...player,
        resources: { ...player.resources, gold: 0 }
      }))
    };

    const created = createCollectionBlock(state);
    expect(created.block).not.toBeNull();
    const block = created.block!;
    const prompts = block.payload.prompts.p1 ?? [];
    expect(prompts).toHaveLength(2);
    const promptMap = new Map(prompts.map((prompt) => [`${prompt.kind}:${prompt.hexKey}`, prompt]));
    expect(promptMap.get("mine:0,1")?.revealed).toEqual([deck[0]]);
    expect(promptMap.get("forge:1,0")?.revealed).toEqual(deck.slice(1, 4));
    expect(created.state.marketDecks.I).toHaveLength(0);

    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [
        { kind: "mine", hexKey: "0,1", choice: "gold" },
        { kind: "forge", hexKey: "1,0", choice: "draft", cardId: deck[1] }
      ],
      "p1"
    );
    expect(nextState.blocks?.waitingFor).toHaveLength(0);

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.resources.gold).toBe(2);
    expect(player?.deck.drawPile.length).toBe(1);
    const gainedCard = player?.deck.drawPile[0];
    expect(resolved.cardsByInstanceId[gainedCard ?? ""]?.defId).toBe(deck[1]);
    expect([...resolved.marketDecks.I].sort()).toEqual([deck[0], deck[2], deck[3]].sort());
  });
});

describe("scoring", () => {
  it("computes control VP and declares a winner when threshold is met", () => {
    const config = {
      ...DEFAULT_CONFIG,
      VP_TO_WIN: 5
    };
    const base = createNewGame(config, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.hexes["0,0"] = {
      ...board.hexes["0,0"],
      tile: "center",
      occupants: { p1: ["u1"] }
    };
    board.hexes["1,0"] = {
      ...board.hexes["1,0"],
      tile: "forge",
      occupants: { p1: ["u2"] }
    };
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "capital",
      ownerPlayerId: "p2",
      occupants: { p1: ["u3"] }
    };
    board.hexes["0,-1"] = {
      ...board.hexes["0,-1"],
      tile: "capital",
      ownerPlayerId: "p1",
      occupants: {}
    };

    board.units = {
      u1: { id: "u1", ownerPlayerId: "p1", kind: "force", hex: "0,0" },
      u2: { id: "u2", ownerPlayerId: "p1", kind: "force", hex: "1,0" },
      u3: { id: "u3", ownerPlayerId: "p1", kind: "force", hex: "0,1" }
    };

    const state = {
      ...base,
      board,
      players: base.players.map((player) =>
        player.id === "p1"
          ? { ...player, capitalHex: "0,-1", vp: { ...player.vp, permanent: 2 } }
          : player
      )
    };

    const next = applyScoring(state);
    const p1 = next.players.find((player) => player.id === "p1");
    const p2 = next.players.find((player) => player.id === "p2");

    expect(p1?.vp.control).toBe(3);
    expect(p1?.vp.total).toBe(5);
    expect(p2?.vp.control).toBe(0);
    expect(next.winnerPlayerId).toBe("p1");
  });

  it("applies round cap tiebreakers when no one meets the VP threshold", () => {
    const config = {
      ...DEFAULT_CONFIG,
      VP_TO_WIN: 10,
      ROUNDS_MAX: 1
    };
    const base = createNewGame(config, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.hexes["0,0"] = {
      ...board.hexes["0,0"],
      tile: "center",
      occupants: { p2: ["u1"] }
    };
    board.units = {
      u1: { id: "u1", ownerPlayerId: "p2", kind: "force", hex: "0,0" }
    };

    const state = {
      ...base,
      round: 1,
      board,
      players: base.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              vp: { ...player.vp, permanent: 1 },
              resources: { ...player.resources, gold: 5 }
            }
          : {
              ...player,
              vp: { ...player.vp, permanent: 1 },
              resources: { ...player.resources, gold: 3 }
            }
      )
    };

    const next = applyScoring(state);
    expect(next.winnerPlayerId).toBe("p2");
  });
});

describe("cleanup", () => {
  it("discards hands, removes end-of-round modifiers, and clears temporary bridges", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.bridges = {
      "0,0|1,0": {
        key: "0,0|1,0",
        from: "0,0",
        to: "1,0",
        temporary: true
      }
    };

    const state = {
      ...base,
      board,
      modifiers: [
        { id: "m1", source: { type: "card", sourceId: "test" }, duration: { type: "endOfRound" } },
        { id: "m2", source: { type: "card", sourceId: "test" }, duration: { type: "permanent" } }
      ],
      players: base.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: { ...player.deck, hand: ["c1"], discardPile: ["c2"] }
            }
          : player
      )
    };

    const next = applyCleanup(state);
    const p1 = next.players.find((player) => player.id === "p1");

    expect(p1?.deck.hand).toEqual([]);
    expect(p1?.deck.discardPile).toEqual(["c2", "c1"]);
    expect(Object.keys(next.board.bridges)).toHaveLength(0);
    expect(next.modifiers.map((modifier) => modifier.id)).toEqual(["m2"]);
  });
});

describe("age update", () => {
  it("updates market age based on next round mapping", () => {
    const config = {
      ...DEFAULT_CONFIG,
      ageByRound: {
        1: "I",
        2: "II"
      }
    };
    const base = createNewGame(config, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const state = {
      ...base,
      round: 1,
      market: { ...base.market, age: "I" }
    };

    const next = applyAgeUpdate(state);
    expect(next.market.age).toBe("II");
  });
});

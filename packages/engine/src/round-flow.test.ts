import { describe, expect, it } from "vitest";

import { createCardInstances } from "./cards";
import { createBaseBoard } from "./board-generation";
import { applyChampionDeployment } from "./champions";
import { createFactionModifiers } from "./faction-passives";
import { DEFAULT_CONFIG, createNewGame } from "./index";
import {
  applyAgeUpdate,
  applyCleanup,
  applyQuietStudyChoice,
  applyRoundReset,
  applyScoring,
  applyCollectionChoice,
  createCollectionBlock,
  createQuietStudyBlock,
  resolveQuietStudyChoices,
  resolveCollectionChoices
} from "./round-flow";
import { addChampionToHex } from "./units";

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

describe("quiet study", () => {
  it("allows discarding up to two cards and redrawing that many", () => {
    let state = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const created = createCardInstances(state, [
      "test.card.a",
      "test.card.b",
      "test.card.c",
      "test.card.d",
      "test.card.e",
      "test.card.f",
      "test.card.g",
      "test.card.h"
    ]);
    const [
      handA,
      handB,
      handC,
      handD,
      drawA,
      drawB,
      drawC,
      drawD
    ] = created.instanceIds;

    state = {
      ...created.state,
      phase: "round.reset",
      modifiers: createFactionModifiers("cipher", "p1"),
      players: created.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              factionId: "cipher",
              deck: {
                drawPile: [drawA, drawB, drawC, drawD],
                discardPile: [],
                hand: [handA, handB, handC, handD],
                scrapped: []
              }
            }
          : player
      )
    };

    state = applyRoundReset(state);
    expect(state.phase).toBe("round.market");

    state = { ...state, phase: "round.study" };
    const block = createQuietStudyBlock(state);
    if (!block || block.type !== "round.quietStudy") {
      throw new Error("expected quiet study block");
    }
    state = { ...state, blocks: block };

    state = applyQuietStudyChoice(state, [handB, drawA], "p1");
    state = resolveQuietStudyChoices(state);

    const player = state.players.find((entry) => entry.id === "p1");
    if (!player) {
      throw new Error("missing p1 state after quiet study");
    }

    expect(player.deck.discardPile).toEqual([handB, drawA]);
    expect(player.deck.hand).toHaveLength(6);
    expect(player.deck.hand).toEqual([handA, handC, handD, drawB, drawC, drawD]);
    expect(player.deck.drawPile).toHaveLength(0);
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

  it("expands collection reveal counts for cipher expanded choice", () => {
    const base = createNewGame(DEFAULT_CONFIG, 2, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const marketDeck = [
      "age1.quick_march",
      "age1.trade_caravan",
      "age1.patch_up",
      "age1.temporary_bridge",
      "age1.quick_study",
      "age1.prospecting"
    ];
    const powerDeck = ["age1.supply_ledger", "age1.patrol_record", "age1.banner_claim"];

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
    board.hexes["0,-1"] = {
      ...board.hexes["0,-1"],
      tile: "center",
      occupants: {
        p1: ["u3"]
      }
    };
    board.units = {
      u1: { id: "u1", ownerPlayerId: "p1", kind: "force", hex: "0,1" },
      u2: { id: "u2", ownerPlayerId: "p1", kind: "force", hex: "1,0" },
      u3: { id: "u3", ownerPlayerId: "p1", kind: "force", hex: "0,-1" }
    };

    const state = {
      ...base,
      phase: "round.collection" as const,
      board,
      market: { ...base.market, age: "I" as const },
      marketDecks: { I: marketDeck, II: [], III: [] },
      powerDecks: { I: powerDeck, II: [], III: [] },
      modifiers: createFactionModifiers("cipher", "p1"),
      players: base.players.map((player) =>
        player.id === "p1" ? { ...player, factionId: "cipher" } : player
      )
    };

    const created = createCollectionBlock(state);
    const prompts = created.block?.payload.prompts.p1 ?? [];
    const promptMap = new Map(
      prompts.map((prompt) => [`${prompt.kind}:${prompt.hexKey}`, prompt])
    );

    expect(promptMap.get("mine:0,1")?.revealed).toHaveLength(2);
    expect(promptMap.get("forge:1,0")?.revealed).toHaveLength(4);
    expect(promptMap.get("center:0,-1")?.revealed).toHaveLength(3);
  });

  it("applies prospect ore cut bonus to mine gold collection", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "mine",
      mineValue: 2,
      occupants: {
        p1: ["u1"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "0,1"
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
        I: [],
        II: [],
        III: []
      },
      players: base.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              factionId: "prospect",
              resources: { ...player.resources, gold: 0 }
            }
          : player
      ),
      modifiers: createFactionModifiers("prospect", "p1")
    };

    const created = createCollectionBlock(state);
    expect(created.block).not.toBeNull();
    const block = created.block!;

    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [{ kind: "mine", hexKey: "0,1", choice: "gold" }],
      "p1"
    );

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.resources.gold).toBe(3);
  });

  it("applies mine overseer bonus to mine gold collection", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "mine",
      mineValue: 2,
      occupants: {
        p1: ["c1"]
      }
    };
    board.units = {
      c1: {
        id: "c1",
        ownerPlayerId: "p1",
        kind: "champion",
        hex: "0,1",
        cardDefId: "champion.prospect.mine_overseer",
        hp: 5,
        maxHp: 5,
        attackDice: 2,
        hitFaces: 2,
        bounty: 4,
        abilityUses: {}
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
        I: [],
        II: [],
        III: []
      },
      players: base.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              resources: { ...player.resources, gold: 0 }
            }
          : player
      )
    };

    const created = createCollectionBlock(state);
    expect(created.block).not.toBeNull();
    const block = created.block!;

    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [{ kind: "mine", hexKey: "0,1", choice: "gold" }],
      "p1"
    );

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.resources.gold).toBe(3);
  });

  it("returns mine draft cards to the market deck when declined", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const deck = ["age1.quick_march"];

    const board = createBaseBoard(1);
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "mine",
      mineValue: 3,
      occupants: {
        p1: ["u1"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "0,1"
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
      }
    };

    const created = createCollectionBlock(state);
    const block = created.block!;
    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [{ kind: "mine", hexKey: "0,1", choice: "draft", gainCard: false }],
      "p1"
    );

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.deck.drawPile).toHaveLength(0);
    expect(resolved.marketDecks.I).toEqual(deck);
  });

  it("grants mine draft cards to the draw pile when accepted", () => {
    const base = createNewGame(DEFAULT_CONFIG, 2, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const deck = ["age1.trade_caravan"];

    const board = createBaseBoard(1);
    board.hexes["0,1"] = {
      ...board.hexes["0,1"],
      tile: "mine",
      mineValue: 2,
      occupants: {
        p1: ["u1"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "0,1"
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
      }
    };

    const created = createCollectionBlock(state);
    const block = created.block!;
    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [{ kind: "mine", hexKey: "0,1", choice: "draft", gainCard: true }],
      "p1"
    );

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.deck.drawPile.length).toBe(1);
    const gainedCard = player?.deck.drawPile[0];
    expect(resolved.cardsByInstanceId[gainedCard ?? ""]?.defId).toBe(deck[0]);
    expect(resolved.marketDecks.I).toHaveLength(0);
  });

  it("reforges at a forge by scrapping a card and returning reveals", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const deck = ["age1.quick_march", "age1.trade_caravan", "age1.patch_up"];
    const createdCards = createCardInstances(base, ["test.scrap.card"]);
    const scrapCardId = createdCards.instanceIds[0];

    const board = createBaseBoard(1);
    board.hexes["1,0"] = {
      ...board.hexes["1,0"],
      tile: "forge",
      occupants: {
        p1: ["u1"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "1,0"
      }
    };

    const state = {
      ...createdCards.state,
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
      players: createdCards.state.players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              deck: {
                ...player.deck,
                hand: [scrapCardId]
              }
            }
          : player
      )
    };

    const created = createCollectionBlock(state);
    const block = created.block!;
    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [
        {
          kind: "forge",
          hexKey: "1,0",
          choice: "reforge",
          scrapCardId
        }
      ],
      "p1"
    );

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.deck.hand).not.toContain(scrapCardId);
    expect(player?.deck.scrapped).toContain(scrapCardId);
    expect([...resolved.marketDecks.I].sort()).toEqual(deck.slice().sort());
  });

  it("resolves center pick gains a card and returns leftovers", () => {
    const base = createNewGame(DEFAULT_CONFIG, 3, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const deck = ["age1.temporary_bridge", "age1.quick_march"];

    const board = createBaseBoard(1);
    board.hexes["0,0"] = {
      ...board.hexes["0,0"],
      tile: "center",
      occupants: {
        p1: ["u1"]
      }
    };
    board.units = {
      u1: {
        id: "u1",
        ownerPlayerId: "p1",
        kind: "force",
        hex: "0,0"
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
      powerDecks: {
        I: deck,
        II: [],
        III: []
      }
    };

    const created = createCollectionBlock(state);
    const block = created.block!;
    let nextState = { ...created.state, blocks: block };
    nextState = applyCollectionChoice(
      nextState,
      [
        {
          kind: "center",
          hexKey: "0,0",
          cardId: deck[1]
        }
      ],
      "p1"
    );

    const resolved = resolveCollectionChoices(nextState);
    const player = resolved.players.find((entry) => entry.id === "p1");
    expect(player?.deck.drawPile.length).toBe(1);
    const gainedCard = player?.deck.drawPile[0];
    expect(resolved.cardsByInstanceId[gainedCard ?? ""]?.defId).toBe(deck[1]);
    expect(resolved.powerDecks.I).toEqual([deck[0]]);
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

  it("boosts control VP for gatewright occupying an enemy capital", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    const board = createBaseBoard(1);
    board.hexes["0,0"] = {
      ...board.hexes["0,0"],
      tile: "capital",
      ownerPlayerId: "p2",
      occupants: { p1: ["u1"] }
    };
    board.hexes["0,-1"] = {
      ...board.hexes["0,-1"],
      tile: "capital",
      ownerPlayerId: "p1",
      occupants: {}
    };
    board.units = {
      u1: { id: "u1", ownerPlayerId: "p1", kind: "force", hex: "0,0" }
    };

    const state = {
      ...base,
      board,
      modifiers: createFactionModifiers("gatewright", "p1"),
      players: base.players.map((player) =>
        player.id === "p1"
          ? { ...player, capitalHex: "0,-1", factionId: "gatewright" }
          : player
      )
    };

    const next = applyScoring(state);
    const p1 = next.players.find((player) => player.id === "p1");

    expect(p1?.vp.control).toBe(2);
  });

  it("adds control bonus for Bannerman while on the board", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const bannerman = addChampionToHex(board, "p1", "1,0", {
      cardDefId: "champion.power.bannerman",
      hp: 3,
      attackDice: 2,
      hitFaces: 2,
      bounty: 5
    });
    let state = {
      ...base,
      board: bannerman.board
    };
    state = applyChampionDeployment(state, bannerman.unitId, "champion.power.bannerman", "p1");

    const next = applyScoring(state);
    const p1 = next.players.find((player) => player.id === "p1");

    expect(p1?.vp.control).toBe(1);
  });

  it("adds center bannerman bonus when on the center", () => {
    const base = createNewGame(DEFAULT_CONFIG, 1, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);
    const board = createBaseBoard(1);
    const bannerman = addChampionToHex(board, "p1", "0,0", {
      cardDefId: "champion.age3.center_bannerman",
      hp: 3,
      attackDice: 2,
      hitFaces: 2,
      bounty: 5
    });
    let state = {
      ...base,
      board: bannerman.board
    };
    state = applyChampionDeployment(
      state,
      bannerman.unitId,
      "champion.age3.center_bannerman",
      "p1"
    );

    const next = applyScoring(state);
    const p1 = next.players.find((player) => player.id === "p1");

    expect(p1?.vp.control).toBe(2);
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

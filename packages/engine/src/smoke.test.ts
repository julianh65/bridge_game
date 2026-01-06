import { neighborHexKeys } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type {
  CollectionChoice,
  CollectionPrompt,
  GameState,
  PlayerID
} from "./types";
import { applyCommand, createNewGame, DEFAULT_CONFIG, getBridgeKey, runUntilBlocked } from "./index";

const resolveCapitalDraftBlock = (state: GameState): GameState => {
  let nextState = state;

  while (
    nextState.blocks?.type === "setup.capitalDraft" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const taken = new Set(
      Object.values(block.payload.choices).filter((value): value is string => Boolean(value))
    );
    const slot = block.payload.availableSlots.find((candidate) => !taken.has(candidate));
    if (!slot) {
      throw new Error("no available capital slot to pick");
    }
    const playerId = block.waitingFor[0];
    nextState = applyCommand(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: slot } },
      playerId
    );
  }

  return nextState;
};

const resolveStartingBridgesBlock = (state: GameState): GameState => {
  let nextState = state;

  while (
    nextState.blocks?.type === "setup.startingBridges" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const playerId = block.waitingFor[0];
    const player = nextState.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      throw new Error(`missing capital for ${playerId}`);
    }

    const placedEdges = new Set(block.payload.placedEdges[playerId] ?? []);
    const neighbors = neighborHexKeys(player.capitalHex).filter(
      (key) => Boolean(nextState.board.hexes[key])
    );
    const edgeKey = neighbors
      .map((neighbor) => getBridgeKey(player.capitalHex, neighbor))
      .find((candidate) => !placedEdges.has(candidate));
    if (!edgeKey) {
      throw new Error(`no starting bridge available for ${playerId}`);
    }

    nextState = applyCommand(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey } },
      playerId
    );
  }

  return nextState;
};

const resolveFreeStartingCardBlock = (state: GameState): GameState => {
  let nextState = state;

  while (
    nextState.blocks?.type === "setup.freeStartingCardPick" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const playerId = block.waitingFor[0];
    const offer = block.payload.offers[playerId]?.[0];
    if (!offer) {
      throw new Error(`missing free starting card offer for ${playerId}`);
    }
    nextState = applyCommand(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId: offer } },
      playerId
    );
  }

  return nextState;
};

const resolveMarketBidBlock = (state: GameState): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "market.bidsForCard") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    nextState = applyCommand(
      nextState,
      { type: "SubmitMarketBid", payload: { kind: "pass", amount: 0 } },
      playerId
    );
  }

  return nextState;
};

const resolveActionStepBlock = (state: GameState): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "actionStep.declarations") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    nextState = applyCommand(
      nextState,
      { type: "SubmitAction", payload: { kind: "done" } },
      playerId
    );
  }

  return nextState;
};

const buildCollectionChoices = (
  state: GameState,
  playerId: PlayerID,
  prompts: CollectionPrompt[]
): CollectionChoice[] => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`missing player ${playerId}`);
  }

  return prompts.map((prompt) => {
    if (prompt.kind === "mine") {
      return {
        kind: "mine",
        hexKey: prompt.hexKey,
        choice: "gold"
      };
    }

    if (prompt.kind === "forge") {
      if (prompt.revealed.length > 0) {
        return {
          kind: "forge",
          hexKey: prompt.hexKey,
          choice: "draft",
          cardId: prompt.revealed[0]
        };
      }

      const scrapCardId = player.deck.hand[0];
      if (!scrapCardId) {
        throw new Error(`missing scrap card for forge prompt on ${playerId}`);
      }

      return {
        kind: "forge",
        hexKey: prompt.hexKey,
        choice: "reforge",
        scrapCardId
      };
    }

    const revealed = prompt.revealed[0];
    if (!revealed) {
      throw new Error(`missing center reveal for ${playerId}`);
    }

    return {
      kind: "center",
      hexKey: prompt.hexKey,
      cardId: revealed
    };
  });
};

const resolveCollectionBlock = (state: GameState): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "collection.choices") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const prompts = block.payload.prompts[playerId] ?? [];
    const choices = buildCollectionChoices(nextState, playerId, prompts);
    nextState = applyCommand(
      nextState,
      { type: "SubmitCollectionChoices", payload: choices },
      playerId
    );
  }

  return nextState;
};

const resolveBlock = (state: GameState): GameState => {
  const block = state.blocks;
  if (!block) {
    return state;
  }

  switch (block.type) {
    case "setup.capitalDraft":
      return resolveCapitalDraftBlock(state);
    case "setup.startingBridges":
      return resolveStartingBridgesBlock(state);
    case "setup.freeStartingCardPick":
      return resolveFreeStartingCardBlock(state);
    case "market.bidsForCard":
      return resolveMarketBidBlock(state);
    case "actionStep.declarations":
      return resolveActionStepBlock(state);
    case "collection.choices":
      return resolveCollectionBlock(state);
    default: {
      const _exhaustive: never = block;
      throw new Error(`Unhandled block type: ${(_exhaustive as { type: string }).type}`);
    }
  }
};

const advanceWithAutoChoices = (state: GameState, targetRound: number): GameState => {
  let nextState = state;
  let steps = 0;
  const maxSteps = 200;

  while (nextState.round < targetRound && !nextState.winnerPlayerId) {
    if (steps >= maxSteps) {
      throw new Error(`auto-play exceeded ${maxSteps} steps`);
    }
    nextState = runUntilBlocked(nextState);
    if (!nextState.blocks) {
      throw new Error("expected a block while advancing game");
    }
    nextState = resolveBlock(nextState);
    steps += 1;
  }

  return nextState;
};

describe("smoke sim", () => {
  it("auto-resolves blocks across a few rounds", () => {
    let state = createNewGame(DEFAULT_CONFIG, 123, [
      { id: "p1", name: "Player 1" },
      { id: "p2", name: "Player 2" }
    ]);

    state = advanceWithAutoChoices(state, 3);

    expect(state.round).toBeGreaterThanOrEqual(3);
  });
});

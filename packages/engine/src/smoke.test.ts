import { createRngState, neighborHexKeys, randInt } from "@bridgefront/shared";
import { describe, expect, it } from "vitest";

import type {
  ActionDeclaration,
  BasicAction,
  CollectionChoice,
  CollectionPrompt,
  Command,
  GameState,
  PlayerID
} from "./types";
import {
  applyCommand,
  createNewGame,
  DEFAULT_CONFIG,
  getBridgeKey,
  hasBridge,
  isOccupiedByPlayer,
  runUntilBlocked,
  wouldExceedTwoPlayers
} from "./index";
import { isCardPlayable } from "./card-effects";
import { getCardDef } from "./content/cards";

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

const advanceSetupGate = (state: GameState): GameState => {
  const hostId = state.players.find((player) => player.seatIndex === 0)?.id;
  if (!hostId) {
    throw new Error("no host available to advance setup");
  }
  return applyCommand(state, { type: "AdvanceSetup" }, hostId);
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
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveCapitalDraftBlock(state);
    case "setup.startingBridges":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveStartingBridgesBlock(state);
    case "setup.freeStartingCardPick":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
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

type DecisionPicker = {
  pick: <T>(items: readonly T[], context: string) => T;
  pickBool: () => boolean;
  pickInt: (min: number, max: number) => number;
};

const createDecisionPicker = (seed: number): DecisionPicker => {
  let rng = createRngState(seed);

  const pickInt = (min: number, max: number) => {
    const { value, next } = randInt(rng, min, max);
    rng = next;
    return value;
  };

  const pickBool = () => pickInt(0, 1) === 1;

  const pick = <T>(items: readonly T[], context: string): T => {
    if (items.length === 0) {
      throw new Error(`no options available for ${context}`);
    }
    return items[pickInt(0, items.length - 1)];
  };

  return { pick, pickBool, pickInt };
};

const applyCommandOrThrow = (
  state: GameState,
  command: Command,
  playerId: PlayerID,
  context: string
): GameState => {
  const nextState = applyCommand(state, command, playerId);
  if (nextState === state) {
    throw new Error(`failed to apply ${context} for ${playerId}`);
  }
  return nextState;
};

const getPlayer = (state: GameState, playerId: PlayerID) =>
  state.players.find((entry) => entry.id === playerId) ?? null;

const getPlayerOccupiedHexKeys = (state: GameState, playerId: PlayerID): string[] =>
  Object.values(state.board.hexes)
    .filter((hex) => isOccupiedByPlayer(hex, playerId))
    .map((hex) => hex.key);

const getBuildBridgeActions = (state: GameState, playerId: PlayerID): BasicAction[] => {
  const options = new Set<string>();

  for (const from of getPlayerOccupiedHexKeys(state, playerId)) {
    for (const neighbor of neighborHexKeys(from)) {
      if (!state.board.hexes[neighbor]) {
        continue;
      }
      if (hasBridge(state.board, from, neighbor)) {
        continue;
      }
      options.add(getBridgeKey(from, neighbor));
    }
  }

  return [...options].map((edgeKey) => ({ kind: "buildBridge", edgeKey }));
};

const getMarchActions = (state: GameState, playerId: PlayerID): BasicAction[] => {
  const options: BasicAction[] = [];

  for (const from of getPlayerOccupiedHexKeys(state, playerId)) {
    for (const neighbor of neighborHexKeys(from)) {
      const toHex = state.board.hexes[neighbor];
      if (!toHex) {
        continue;
      }
      if (!hasBridge(state.board, from, neighbor)) {
        continue;
      }
      if (wouldExceedTwoPlayers(toHex, playerId)) {
        continue;
      }
      options.push({ kind: "march", from, to: neighbor });
    }
  }

  return options;
};

const getCapitalReinforceAction = (
  state: GameState,
  playerId: PlayerID
): BasicAction | null => {
  const player = getPlayer(state, playerId);
  if (!player?.capitalHex) {
    return null;
  }

  const capitalHex = state.board.hexes[player.capitalHex];
  if (!capitalHex) {
    return null;
  }

  if (wouldExceedTwoPlayers(capitalHex, playerId)) {
    return null;
  }

  return { kind: "capitalReinforce" };
};

const getBasicActionOptions = (state: GameState, playerId: PlayerID): BasicAction[] => {
  const player = getPlayer(state, playerId);
  if (!player) {
    return [];
  }

  if (player.resources.mana < 1) {
    return [];
  }

  const options: BasicAction[] = [
    ...getBuildBridgeActions(state, playerId),
    ...getMarchActions(state, playerId)
  ];

  const reinforce = getCapitalReinforceAction(state, playerId);
  if (reinforce && player.resources.gold >= 1) {
    options.push(reinforce);
  }

  return options;
};

const getPlayableCardDeclarations = (
  state: GameState,
  playerId: PlayerID
): ActionDeclaration[] => {
  const player = getPlayer(state, playerId);
  if (!player) {
    return [];
  }

  return player.deck.hand.flatMap((cardInstanceId) => {
    const instance = state.cardsByInstanceId[cardInstanceId];
    if (!instance) {
      return [];
    }
    const card = getCardDef(instance.defId);
    if (!card) {
      return [];
    }
    const goldCost = card.cost.gold ?? 0;
    if (card.cost.mana > player.resources.mana || goldCost > player.resources.gold) {
      return [];
    }
    if (!isCardPlayable(state, playerId, card, null)) {
      return [];
    }
    return [{ kind: "card", cardInstanceId }];
  });
};

const getActionDeclarationOptions = (
  state: GameState,
  playerId: PlayerID
): ActionDeclaration[] => {
  const options: ActionDeclaration[] = [{ kind: "done" }];
  const basicOptions = getBasicActionOptions(state, playerId).map((action) => ({
    kind: "basic",
    action
  }));
  options.push(...basicOptions);
  options.push(...getPlayableCardDeclarations(state, playerId));
  return options;
};

const resolveCapitalDraftBlockRandom = (
  state: GameState,
  picker: DecisionPicker
): GameState => {
  let nextState = state;

  while (
    nextState.blocks?.type === "setup.capitalDraft" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const taken = new Set(
      Object.values(block.payload.choices).filter((value): value is string => Boolean(value))
    );
    const availableSlots = block.payload.availableSlots.filter(
      (candidate) => !taken.has(candidate)
    );
    const slot = picker.pick(availableSlots, "capital draft slot");
    const playerId = block.waitingFor[0];
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "pickCapital", hexKey: slot } },
      playerId,
      "capital draft pick"
    );
  }

  return nextState;
};

const resolveStartingBridgesBlockRandom = (
  state: GameState,
  picker: DecisionPicker
): GameState => {
  let nextState = state;

  while (
    nextState.blocks?.type === "setup.startingBridges" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const playerId = block.waitingFor[0];
    const player = getPlayer(nextState, playerId);
    if (!player?.capitalHex) {
      throw new Error(`missing capital for ${playerId}`);
    }

    const placedEdges = new Set(block.payload.placedEdges[playerId] ?? []);
    const neighbors = neighborHexKeys(player.capitalHex).filter(
      (key) => Boolean(nextState.board.hexes[key])
    );
    const edgeOptions = neighbors
      .map((neighbor) => getBridgeKey(player.capitalHex, neighbor))
      .filter((edgeKey) => !placedEdges.has(edgeKey));
    const edgeKey = picker.pick(edgeOptions, `starting bridge for ${playerId}`);

    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "placeStartingBridge", edgeKey } },
      playerId,
      "starting bridge placement"
    );
  }

  return nextState;
};

const resolveFreeStartingCardBlockRandom = (
  state: GameState,
  picker: DecisionPicker
): GameState => {
  let nextState = state;

  while (
    nextState.blocks?.type === "setup.freeStartingCardPick" &&
    nextState.blocks.waitingFor.length > 0
  ) {
    const block = nextState.blocks;
    const playerId = block.waitingFor[0];
    const offers = block.payload.offers[playerId] ?? [];
    const cardId = picker.pick(offers, `free starting card for ${playerId}`);
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitSetupChoice", payload: { kind: "pickFreeStartingCard", cardId } },
      playerId,
      "free starting card pick"
    );
  }

  return nextState;
};

const resolveMarketBidBlockRandom = (state: GameState, picker: DecisionPicker): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "market.bidsForCard") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const player = getPlayer(nextState, playerId);
    if (!player) {
      throw new Error(`missing player ${playerId}`);
    }

    const gold = player.resources.gold;
    const shouldBuy = gold > 0 && picker.pickBool();
    const amount = shouldBuy ? picker.pickInt(1, gold) : picker.pickInt(0, gold);
    nextState = applyCommandOrThrow(
      nextState,
      {
        type: "SubmitMarketBid",
        payload: { kind: shouldBuy ? "buy" : "pass", amount }
      },
      playerId,
      "market bid"
    );
  }

  return nextState;
};

const resolveActionStepBlockRandom = (state: GameState, picker: DecisionPicker): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "actionStep.declarations") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const options = getActionDeclarationOptions(nextState, playerId);
    const declaration = picker.pick(options, `action declaration for ${playerId}`);
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitAction", payload: declaration },
      playerId,
      "action declaration"
    );
  }

  return nextState;
};

const buildRandomCollectionChoices = (
  state: GameState,
  playerId: PlayerID,
  prompts: CollectionPrompt[],
  picker: DecisionPicker
): CollectionChoice[] => {
  const player = getPlayer(state, playerId);
  if (!player) {
    throw new Error(`missing player ${playerId}`);
  }

  return prompts.map((prompt) => {
    if (prompt.kind === "mine") {
      if (prompt.revealed.length > 0 && picker.pickBool()) {
        const gainCard = picker.pickBool();
        return {
          kind: "mine",
          hexKey: prompt.hexKey,
          choice: "draft",
          gainCard,
          cardId: gainCard ? picker.pick(prompt.revealed, `mine draft for ${playerId}`) : undefined
        };
      }
      return {
        kind: "mine",
        hexKey: prompt.hexKey,
        choice: "gold"
      };
    }

    if (prompt.kind === "forge") {
      const canDraft = prompt.revealed.length > 0;
      const canReforge = player.deck.hand.length > 0;

      if (canDraft && (!canReforge || picker.pickBool())) {
        const cardId = picker.pick(prompt.revealed, `forge draft for ${playerId}`);
        return {
          kind: "forge",
          hexKey: prompt.hexKey,
          choice: "draft",
          cardId
        };
      }

      if (canReforge) {
        const scrapCardId = picker.pick(player.deck.hand, `forge scrap for ${playerId}`);
        return {
          kind: "forge",
          hexKey: prompt.hexKey,
          choice: "reforge",
          scrapCardId
        };
      }

      throw new Error(`no valid forge choice for ${playerId}`);
    }

    const cardId = picker.pick(prompt.revealed, `center pick for ${playerId}`);
    return {
      kind: "center",
      hexKey: prompt.hexKey,
      cardId
    };
  });
};

const resolveCollectionBlockRandom = (state: GameState, picker: DecisionPicker): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "collection.choices") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const prompts = block.payload.prompts[playerId] ?? [];
    const choices = buildRandomCollectionChoices(nextState, playerId, prompts, picker);
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitCollectionChoices", payload: choices },
      playerId,
      "collection choices"
    );
  }

  return nextState;
};

const resolveQuietStudyBlockRandom = (state: GameState, picker: DecisionPicker): GameState => {
  let nextState = state;
  const block = nextState.blocks;
  if (!block || block.type !== "round.quietStudy") {
    return nextState;
  }

  for (const playerId of block.waitingFor) {
    const player = nextState.players.find((entry) => entry.id === playerId);
    if (!player) {
      continue;
    }
    const hand = [...player.deck.hand];
    const maxDiscard = Math.min(block.payload.maxDiscard, hand.length);
    const discardCount = maxDiscard > 0 ? picker.pickInt(0, maxDiscard) : 0;
    const selected: string[] = [];
    for (let i = 0; i < discardCount; i += 1) {
      const index = picker.pickInt(0, hand.length - 1);
      const [picked] = hand.splice(index, 1);
      if (picked) {
        selected.push(picked);
      }
    }
    nextState = applyCommandOrThrow(
      nextState,
      { type: "SubmitQuietStudy", payload: { cardInstanceIds: selected } },
      playerId,
      "quiet study"
    );
  }

  return nextState;
};

const resolveBlockRandom = (state: GameState, picker: DecisionPicker): GameState => {
  const block = state.blocks;
  if (!block) {
    return state;
  }

  switch (block.type) {
    case "setup.capitalDraft":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveCapitalDraftBlockRandom(state, picker);
    case "setup.startingBridges":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveStartingBridgesBlockRandom(state, picker);
    case "setup.freeStartingCardPick":
      if (block.waitingFor.length === 0) {
        return advanceSetupGate(state);
      }
      return resolveFreeStartingCardBlockRandom(state, picker);
    case "market.bidsForCard":
      return resolveMarketBidBlockRandom(state, picker);
    case "actionStep.declarations":
      return resolveActionStepBlockRandom(state, picker);
    case "round.quietStudy":
      return resolveQuietStudyBlockRandom(state, picker);
    case "collection.choices":
      return resolveCollectionBlockRandom(state, picker);
    default: {
      const _exhaustive: never = block;
      throw new Error(`Unhandled block type: ${(_exhaustive as { type: string }).type}`);
    }
  }
};

const advanceWithRandomChoices = (
  state: GameState,
  picker: DecisionPicker,
  targetRound: number,
  maxSteps = 200
): { state: GameState; steps: number } => {
  let nextState = state;
  let steps = 0;

  while (nextState.round < targetRound && !nextState.winnerPlayerId) {
    if (steps >= maxSteps) {
      throw new Error(`random auto-play exceeded ${maxSteps} steps`);
    }
    nextState = runUntilBlocked(nextState);
    if (!nextState.blocks) {
      throw new Error("expected a block while advancing game");
    }
    const resolved = resolveBlockRandom(nextState, picker);
    if (resolved === nextState) {
      throw new Error("random resolution made no progress");
    }
    nextState = resolved;
    steps += 1;
  }

  return { state: nextState, steps };
};

describe("smoke sim", () => {
  const buildLobbyPlayers = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`
    }));
  const playerCounts = [2, 3, 4, 5, 6];

  playerCounts.forEach((count) => {
    it(`auto-resolves blocks across a few rounds (${count}p)`, () => {
      let state = createNewGame(DEFAULT_CONFIG, 120 + count, buildLobbyPlayers(count));

      state = advanceWithAutoChoices(state, 3);

      expect(state.round).toBeGreaterThanOrEqual(3);
    });
  });

  playerCounts.forEach((count) => {
    it(`runs randomized legal commands without crashing (${count}p)`, () => {
      const picker = createDecisionPicker(8675309 + count);
      const startState = createNewGame(DEFAULT_CONFIG, 450 + count, buildLobbyPlayers(count));
      const targetRound = count > 2 ? 3 : 4;
      const maxSteps = 240 + count * 80;

      const { state, steps } = advanceWithRandomChoices(
        startState,
        picker,
        targetRound,
        maxSteps
      );

      expect(steps).toBeGreaterThan(0);
      expect(state.round).toBeGreaterThan(0);
    });
  });
});

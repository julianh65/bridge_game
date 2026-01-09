import {
  axialDistance,
  parseEdgeKey,
  parseHexKey,
  shuffle
} from "@bridgefront/shared";

import type {
  BlockState,
  CardDefId,
  GameEvent,
  GameState,
  HexKey,
  PlayerID,
  PlayerState,
  SetupChoice
} from "./types";
import { getBridgeKey } from "./board";
import { placeRandomBridges, placeSpecialTiles } from "./board-generation";
import {
  createCardInstance,
  createCardInstances,
  drawToHandSize,
  insertCardIntoDrawPileRandom,
  shuffleCardIds
} from "./cards";
import { resolveStarterFactionCards } from "./content/starter-decks";
import { emit } from "./events";
import { addFactionModifiers } from "./faction-passives";
import { getCardChoiceCount } from "./modifiers";
import { addForcesToHex } from "./units";

const withUpdatedPlayer = (state: GameState, playerId: PlayerID, update: (player: PlayerState) => PlayerState) => {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player))
  };
};

const getCapitalDraftWaitingFor = (
  players: PlayerState[],
  choices: Record<PlayerID, HexKey | null>
): PlayerID[] => {
  return players.map((player) => player.id).filter((playerId) => !choices[playerId]);
};

const getStartingBridgeWaitingFor = (
  players: PlayerState[],
  remaining: Record<PlayerID, number>
): PlayerID[] => {
  return players
    .map((player) => player.id)
    .filter((playerId) => (remaining[playerId] ?? 0) > 0);
};

const getFreeStartingCardWaitingFor = (
  players: PlayerState[],
  chosen: Record<PlayerID, CardDefId | null>
): PlayerID[] => {
  return players.map((player) => player.id).filter((playerId) => !chosen[playerId]);
};

export const createCapitalDraftBlock = (players: PlayerState[], availableSlots: HexKey[]): BlockState => ({
  type: "setup.capitalDraft",
  waitingFor: players.map((player) => player.id),
  payload: {
    availableSlots,
    choices: Object.fromEntries(players.map((player) => [player.id, null]))
  }
});

export const createDeckPreviewBlock = (): BlockState => ({
  type: "setup.deckPreview",
  waitingFor: [],
  payload: {}
});

export const createStartingBridgesBlock = (players: PlayerState[]): BlockState => ({
  type: "setup.startingBridges",
  waitingFor: players.map((player) => player.id),
  payload: {
    remaining: Object.fromEntries(players.map((player) => [player.id, 2])),
    selectedEdges: Object.fromEntries(players.map((player) => [player.id, []]))
  }
});

export const createFreeStartingCardBlock = (
  state: GameState
): { state: GameState; block: BlockState } => {
  const pool = state.config.freeStartingCardPool;
  const baseOfferCount = 3;
  const offerCounts = state.players.map((player) => {
    const rawCount = getCardChoiceCount(
      state,
      { playerId: player.id, kind: "freeStartingCard", baseCount: baseOfferCount },
      baseOfferCount
    );
    const normalized = Number.isFinite(rawCount) ? Math.floor(rawCount) : baseOfferCount;
    return {
      playerId: player.id,
      count: Math.max(baseOfferCount, normalized)
    };
  });
  const maxOfferCount = offerCounts.reduce(
    (max, entry) => Math.max(max, entry.count),
    baseOfferCount
  );
  if (pool.length < maxOfferCount) {
    throw new Error(`freeStartingCardPool must contain at least ${maxOfferCount} cards`);
  }

  let rngState = state.rngState;
  const deck: CardDefId[] = [];
  const minCards = offerCounts.reduce((total, entry) => total + entry.count, 0);
  while (deck.length < minCards) {
    deck.push(...pool);
  }
  const { value: shuffledDeck, next: shuffledState } = shuffle(rngState, deck);
  rngState = shuffledState;

  const offers: Record<PlayerID, CardDefId[]> = {};
  let remainingDeck = shuffledDeck.slice();
  for (const entry of offerCounts) {
    const offer = remainingDeck.slice(0, entry.count);
    if (offer.length < entry.count) {
      throw new Error("freeStartingCardPool must have enough cards for all players");
    }
    offers[entry.playerId] = offer;
    remainingDeck = remainingDeck.slice(entry.count);
  }

  return {
    state: { ...state, rngState },
    block: {
      type: "setup.freeStartingCardPick",
      waitingFor: state.players.map((player) => player.id),
      payload: {
        offers,
        chosen: Object.fromEntries(state.players.map((player) => [player.id, null])),
        remainingDeck
      }
    }
  };
};

export const initializeStartingAssets = (state: GameState): GameState => {
  let nextState = state;
  const playerIds = state.players.map((player) => player.id);

  for (const playerId of playerIds) {
    const player = nextState.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error(`player not found: ${playerId}`);
    }
    if (!player.capitalHex) {
      throw new Error("player has no capital to place starting forces");
    }

    nextState = {
      ...nextState,
      board: addForcesToHex(nextState.board, playerId, player.capitalHex, 4)
    };

    const starter = resolveStarterFactionCards(player.factionId);
    let workingState = nextState;
    if (starter.factionId !== player.factionId) {
      workingState = withUpdatedPlayer(workingState, playerId, (entry) => ({
        ...entry,
        factionId: starter.factionId
      }));
    }
    workingState = addFactionModifiers(workingState, playerId, starter.factionId);

    const { state: withDeckCards, instanceIds: deckInstances } = createCardInstances(
      workingState,
      [...starter.deck, starter.starterSpellId]
    );
    const { state: withChampion, instanceIds: championInstances } = createCardInstances(
      withDeckCards,
      [starter.championId]
    );
    const championInstanceId = championInstances[0];

    const shuffled = shuffleCardIds(withChampion, deckInstances);
    let updatedState = withUpdatedPlayer(shuffled.state, playerId, (entry) => ({
      ...entry,
      deck: {
        drawPile: shuffled.cardIds,
        discardPile: [],
        hand: [championInstanceId],
        scrapped: []
      }
    }));

    updatedState = drawToHandSize(updatedState, playerId, state.config.HAND_DRAW_SIZE);
    nextState = updatedState;
  }

  return nextState;
};

export const finalizeCapitalDraft = (state: GameState): GameState => {
  const capitalHexes = state.players.map((player) => {
    if (!player.capitalHex) {
      throw new Error("player missing capital after draft");
    }
    return player.capitalHex;
  });
  const uniqueCapitals = new Set(capitalHexes);
  if (uniqueCapitals.size !== capitalHexes.length) {
    throw new Error("capital draft resulted in duplicate capitals");
  }

  const tileCounts = state.config.tileCountsByPlayerCount[state.players.length];
  if (!tileCounts) {
    throw new Error("missing tile counts for player count");
  }

  const placement = placeSpecialTiles(state.board, state.rngState, {
    capitalHexes,
    forgeCount: tileCounts.forges,
    mineCount: tileCounts.mines,
    rules: state.config.boardGenerationRules
  });

  const bridged = placeRandomBridges(placement.board, placement.rngState, {
    capitalHexes,
    count: tileCounts.randomBridges,
    rules: state.config.boardGenerationRules
  });

  const nextState = {
    ...state,
    board: bridged.board,
    rngState: bridged.rngState
  };

  return initializeStartingAssets(nextState);
};

export const finalizeStartingBridges = (state: GameState): GameState => {
  const block = state.blocks;
  if (!block || block.type !== "setup.startingBridges") {
    return state;
  }

  const selectedEdges = block.payload.selectedEdges;
  const existing = new Set(Object.keys(state.board.bridges));
  const nextBridges = { ...state.board.bridges };
  const events: GameEvent[] = [];

  for (const player of state.players) {
    const edges = selectedEdges[player.id] ?? [];
    for (const edgeKey of edges) {
      const [rawA, rawB] = parseEdgeKey(edgeKey);
      const canonical = getBridgeKey(rawA, rawB);
      const alreadyExists = existing.has(canonical);
      if (!alreadyExists) {
        existing.add(canonical);
        nextBridges[canonical] = {
          key: canonical,
          from: rawA,
          to: rawB,
          ownerPlayerId: player.id
        };
      }
      events.push({
        type: "setup.startingBridgePlaced",
        payload: { playerId: player.id, edgeKey: canonical, alreadyExists }
      });
    }
  }

  let nextState: GameState = {
    ...state,
    board: {
      ...state.board,
      bridges: nextBridges
    }
  };

  for (const event of events) {
    nextState = emit(nextState, event);
  }

  return nextState;
};

export const finalizeFreeStartingCardPick = (state: GameState): GameState => {
  const block = state.blocks;
  if (!block || block.type !== "setup.freeStartingCardPick") {
    return state;
  }

  let nextState = state;
  let remainingDeck = [...block.payload.remainingDeck];

  for (const player of state.players) {
    const chosen = block.payload.chosen[player.id];
    if (!chosen) {
      throw new Error("player missing free starting card choice");
    }
    const offers = block.payload.offers[player.id] ?? [];
    const unchosen = offers.filter((cardId) => cardId !== chosen);
    if (unchosen.length > 0) {
      const { value: returnedCards, next } = shuffle(nextState.rngState, unchosen);
      remainingDeck = [...remainingDeck, ...returnedCards];
      nextState = { ...nextState, rngState: next };
    }

    const { state: stateWithCard, instanceId } = createCardInstance(nextState, chosen);
    nextState = insertCardIntoDrawPileRandom(stateWithCard, player.id, instanceId);
  }

  return {
    ...nextState,
    blocks: {
      ...block,
      payload: {
        ...block.payload,
        remainingDeck
      }
    }
  };
};

export const applySetupChoice = (state: GameState, choice: SetupChoice, playerId: PlayerID): GameState => {
  const block = state.blocks;
  if (!block) {
    throw new Error("no active block to accept setup choice");
  }

  if (block.type === "setup.capitalDraft") {
    if (choice.kind === "unlockCapital") {
      const pickedHex = block.payload.choices[playerId];
      if (!pickedHex) {
        throw new Error("player has no capital to unlock");
      }

      const hex = state.board.hexes[pickedHex];
      if (!hex) {
        throw new Error("capital hex does not exist");
      }

      const updatedBoard = {
        ...state.board,
        hexes: {
          ...state.board.hexes,
          [pickedHex]: {
            ...hex,
            tile: hex.tile === "capital" ? "normal" : hex.tile,
            ownerPlayerId: undefined
          }
        }
      };

      const updatedState = withUpdatedPlayer(state, playerId, (player) => ({
        ...player,
        capitalHex: undefined
      }));

      const updatedChoices = { ...block.payload.choices, [playerId]: null };
      const nextState = {
        ...updatedState,
        board: updatedBoard,
        blocks: {
          ...block,
          waitingFor: getCapitalDraftWaitingFor(state.players, updatedChoices),
          payload: {
            ...block.payload,
            choices: updatedChoices
          }
        }
      };

      return emit(nextState, {
        type: "setup.capitalUnlocked",
        payload: { playerId, hexKey: pickedHex }
      });
    }

    if (choice.kind !== "pickCapital") {
      throw new Error("expected pickCapital during capital draft");
    }
    if (block.payload.choices[playerId]) {
      throw new Error("player already locked a capital");
    }

    const hexKey = choice.hexKey;
    if (!block.payload.availableSlots.includes(hexKey)) {
      throw new Error("invalid capital slot");
    }
    if (Object.values(block.payload.choices).includes(hexKey)) {
      throw new Error("capital slot already taken");
    }

    const hex = state.board.hexes[hexKey];
    if (!hex) {
      throw new Error("capital hex does not exist");
    }
    if (hex.tile === "capital") {
      throw new Error("hex already marked as capital");
    }

    const updatedBoard = {
      ...state.board,
      hexes: {
        ...state.board.hexes,
        [hexKey]: {
          ...hex,
          tile: "capital",
          ownerPlayerId: playerId
        }
      }
    };

    const updatedState = withUpdatedPlayer(state, playerId, (player) => {
      if (player.capitalHex) {
        throw new Error("player already has a capital");
      }
      return { ...player, capitalHex: hexKey };
    });

    const updatedChoices = { ...block.payload.choices, [playerId]: hexKey };
    const nextState = {
      ...updatedState,
      board: updatedBoard,
      blocks: {
        ...block,
        waitingFor: getCapitalDraftWaitingFor(state.players, updatedChoices),
        payload: {
          ...block.payload,
          choices: updatedChoices
        }
      }
    };

    return emit(nextState, {
      type: "setup.capitalPicked",
      payload: { playerId, hexKey }
    });
  }

  if (block.type === "setup.startingBridges") {
    if (choice.kind === "removeStartingBridge") {
      const [rawA, rawB] = parseEdgeKey(choice.edgeKey);
      const edgeKey = getBridgeKey(rawA, rawB);
      const selected = block.payload.selectedEdges[playerId] ?? [];
      if (!selected.includes(edgeKey)) {
        throw new Error("starting bridge not selected by player");
      }

      const nextSelected = {
        ...block.payload.selectedEdges,
        [playerId]: selected.filter((edge) => edge !== edgeKey)
      };
      const nextRemaining = {
        ...block.payload.remaining,
        [playerId]: Math.min(2, (block.payload.remaining[playerId] ?? 0) + 1)
      };

      return {
        ...state,
        blocks: {
          ...block,
          waitingFor: getStartingBridgeWaitingFor(state.players, nextRemaining),
          payload: {
            remaining: nextRemaining,
            selectedEdges: nextSelected
          }
        }
      };
    }

    if (choice.kind !== "placeStartingBridge") {
      throw new Error("expected placeStartingBridge during starting bridge placement");
    }
    if (!block.waitingFor.includes(playerId)) {
      throw new Error("player has already placed starting bridges");
    }

    const remaining = block.payload.remaining[playerId];
    if (!remaining || remaining <= 0) {
      throw new Error("no remaining starting bridges to place");
    }

    const [rawA, rawB] = parseEdgeKey(choice.edgeKey);
    const edgeKey = getBridgeKey(rawA, rawB);
    if (!state.board.hexes[rawA] || !state.board.hexes[rawB]) {
      throw new Error("bridge endpoints must be on the board");
    }

    const dist = axialDistance(parseHexKey(rawA), parseHexKey(rawB));
    if (dist !== 1) {
      throw new Error("bridge endpoints must be adjacent");
    }

    const player = state.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      throw new Error("player has no capital to anchor starting bridge");
    }

    const capitalCoord = parseHexKey(player.capitalHex);
    const withinRange =
      axialDistance(capitalCoord, parseHexKey(rawA)) <= 2 ||
      axialDistance(capitalCoord, parseHexKey(rawB)) <= 2;
    if (!withinRange) {
      throw new Error("starting bridge must touch within distance 2 of capital");
    }

    if (block.payload.selectedEdges[playerId].includes(edgeKey)) {
      throw new Error("starting bridge already selected by player");
    }

    const nextRemaining = {
      ...block.payload.remaining,
      [playerId]: remaining - 1
    };

    const nextSelected = {
      ...block.payload.selectedEdges,
      [playerId]: [...block.payload.selectedEdges[playerId], edgeKey]
    };

    const nextState = {
      ...state,
      blocks: {
        ...block,
        waitingFor: getStartingBridgeWaitingFor(state.players, nextRemaining),
        payload: {
          remaining: nextRemaining,
          selectedEdges: nextSelected
        }
      }
    };

    return nextState;
  }

  if (block.type === "setup.freeStartingCardPick") {
    if (choice.kind === "unpickFreeStartingCard") {
      if (!block.payload.chosen[playerId]) {
        throw new Error("player has no free starting card to unpick");
      }
      const nextChosen = { ...block.payload.chosen, [playerId]: null };

      return {
        ...state,
        blocks: {
          ...block,
          waitingFor: getFreeStartingCardWaitingFor(state.players, nextChosen),
          payload: {
            ...block.payload,
            chosen: nextChosen
          }
        }
      };
    }

    if (choice.kind !== "pickFreeStartingCard") {
      throw new Error("expected pickFreeStartingCard during free starting card pick");
    }

    const offers = block.payload.offers[playerId];
    if (!offers || !offers.includes(choice.cardId)) {
      throw new Error("card is not in player's offer");
    }
    const alreadyChosen = block.payload.chosen[playerId] ?? null;
    if (!block.waitingFor.includes(playerId) && !alreadyChosen) {
      throw new Error("player already picked a free starting card");
    }
    if (alreadyChosen === choice.cardId) {
      return state;
    }

    const nextChosen = {
      ...block.payload.chosen,
      [playerId]: choice.cardId
    };

    const nextState = {
      ...state,
      blocks: {
        ...block,
        waitingFor: getFreeStartingCardWaitingFor(state.players, nextChosen),
        payload: {
          ...block.payload,
          chosen: nextChosen
        }
      }
    };

    return emit(nextState, {
      type: "setup.freeStartingCardPicked",
      payload: { playerId, cardId: choice.cardId }
    });
  }

  return state;
};

import {
  axialDistance,
  parseEdgeKey,
  parseHexKey,
  shuffle
} from "@bridgefront/shared";

import type {
  BlockState,
  CardDefId,
  GameState,
  HexKey,
  PlayerID,
  PlayerState,
  SetupChoice
} from "./types";
import { getBridgeKey } from "./board";
import { placeSpecialTiles } from "./board-generation";
import {
  createCardInstance,
  createCardInstances,
  drawToHandSize,
  insertCardIntoDrawPileRandom,
  shuffleCardIds
} from "./cards";
import { resolveStarterFactionCards } from "./content/starter-decks";
import { addForcesToHex } from "./units";

const withUpdatedPlayer = (state: GameState, playerId: PlayerID, update: (player: PlayerState) => PlayerState) => {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player))
  };
};

export const createCapitalDraftBlock = (players: PlayerState[], availableSlots: HexKey[]): BlockState => ({
  type: "setup.capitalDraft",
  waitingFor: players.map((player) => player.id).reverse(),
  payload: {
    availableSlots,
    choices: Object.fromEntries(players.map((player) => [player.id, null]))
  }
});

export const createStartingBridgesBlock = (players: PlayerState[]): BlockState => ({
  type: "setup.startingBridges",
  waitingFor: players.map((player) => player.id),
  payload: {
    remaining: Object.fromEntries(players.map((player) => [player.id, 2])),
    placedEdges: Object.fromEntries(players.map((player) => [player.id, []]))
  }
});

export const createFreeStartingCardBlock = (
  state: GameState
): { state: GameState; block: BlockState } => {
  const pool = state.config.freeStartingCardPool;
  if (pool.length < 3) {
    throw new Error("freeStartingCardPool must contain at least 3 cards");
  }

  let rngState = state.rngState;
  const offers: Record<PlayerID, CardDefId[]> = {};
  for (const player of state.players) {
    const { value: shuffled, next } = shuffle(rngState, pool);
    rngState = next;
    offers[player.id] = shuffled.slice(0, 3);
  }

  return {
    state: { ...state, rngState },
    block: {
      type: "setup.freeStartingCardPick",
      waitingFor: state.players.map((player) => player.id),
      payload: {
        offers,
        chosen: Object.fromEntries(state.players.map((player) => [player.id, null]))
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
    if (starter.factionId !== player.factionId) {
      nextState = withUpdatedPlayer(nextState, playerId, (entry) => ({
        ...entry,
        factionId: starter.factionId
      }));
    }

    const { state: withDeckCards, instanceIds: deckInstances } = createCardInstances(
      nextState,
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

    updatedState = drawToHandSize(updatedState, playerId, 6);
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

  const nextState = {
    ...state,
    board: placement.board,
    rngState: placement.rngState
  };

  return initializeStartingAssets(nextState);
};

export const applySetupChoice = (state: GameState, choice: SetupChoice, playerId: PlayerID): GameState => {
  const block = state.blocks;
  if (!block) {
    throw new Error("no active block to accept setup choice");
  }

  if (block.type === "setup.capitalDraft") {
    if (choice.kind !== "pickCapital") {
      throw new Error("expected pickCapital during capital draft");
    }
    if (block.waitingFor[0] !== playerId) {
      throw new Error("not your turn to pick a capital");
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

    return {
      ...updatedState,
      board: updatedBoard,
      blocks: {
        ...block,
        waitingFor: block.waitingFor.slice(1),
        payload: {
          ...block.payload,
          choices: { ...block.payload.choices, [playerId]: hexKey }
        }
      }
    };
  }

  if (block.type === "setup.startingBridges") {
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

    if (block.payload.placedEdges[playerId].includes(edgeKey)) {
      throw new Error("starting bridge already selected by player");
    }

    const bridgeAlreadyExists = Boolean(state.board.bridges[edgeKey]);
    const updatedBoard = {
      ...state.board,
      bridges: bridgeAlreadyExists
        ? state.board.bridges
        : {
            ...state.board.bridges,
            [edgeKey]: {
              key: edgeKey,
              from: rawA,
              to: rawB,
              ownerPlayerId: playerId
            }
          }
    };

    const nextRemaining = {
      ...block.payload.remaining,
      [playerId]: remaining - 1
    };

    const nextPlaced = {
      ...block.payload.placedEdges,
      [playerId]: [...block.payload.placedEdges[playerId], edgeKey]
    };

    const nextWaitingFor =
      nextRemaining[playerId] === 0
        ? block.waitingFor.filter((id) => id !== playerId)
        : block.waitingFor;

    return {
      ...state,
      board: updatedBoard,
      blocks: {
        ...block,
        waitingFor: nextWaitingFor,
        payload: {
          remaining: nextRemaining,
          placedEdges: nextPlaced
        }
      }
    };
  }

  if (block.type === "setup.freeStartingCardPick") {
    if (choice.kind !== "pickFreeStartingCard") {
      throw new Error("expected pickFreeStartingCard during free starting card pick");
    }
    if (!block.waitingFor.includes(playerId)) {
      throw new Error("player already picked a free starting card");
    }

    const offers = block.payload.offers[playerId];
    if (!offers || !offers.includes(choice.cardId)) {
      throw new Error("card is not in player's offer");
    }
    if (block.payload.chosen[playerId]) {
      throw new Error("player already chose a free starting card");
    }

    const { state: stateWithCard, instanceId } = createCardInstance(state, choice.cardId);
    const updatedState = insertCardIntoDrawPileRandom(stateWithCard, playerId, instanceId);

    return {
      ...updatedState,
      blocks: {
        ...block,
        waitingFor: block.waitingFor.filter((id) => id !== playerId),
        payload: {
          ...block.payload,
          chosen: {
            ...block.payload.chosen,
            [playerId]: choice.cardId
          }
        }
      }
    };
  }

  return state;
};

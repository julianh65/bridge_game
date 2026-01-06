import {
  axialDistance,
  createRngState,
  parseEdgeKey,
  parseHexKey,
  randInt,
  shuffle
} from "@bridgefront/shared";

import type {
  BlockState,
  CardDefId,
  CardInstanceID,
  Command,
  GameState,
  GameView,
  HexKey,
  LobbyPlayer,
  PlayerID,
  PlayerState,
  SetupChoice
} from "./types";
import { DEFAULT_CONFIG } from "./config";
import { createBaseBoard, getCapitalSlots } from "./board-generation";
import { getBridgeKey } from "./board";

const createCapitalDraftBlock = (players: PlayerState[], availableSlots: HexKey[]): BlockState => ({
  type: "setup.capitalDraft",
  waitingFor: players.map((player) => player.id).reverse(),
  payload: {
    availableSlots,
    choices: Object.fromEntries(players.map((player) => [player.id, null]))
  }
});

const createStartingBridgesBlock = (players: PlayerState[]): BlockState => ({
  type: "setup.startingBridges",
  waitingFor: players.map((player) => player.id),
  payload: {
    remaining: Object.fromEntries(players.map((player) => [player.id, 2])),
    placedEdges: Object.fromEntries(players.map((player) => [player.id, []]))
  }
});

const createFreeStartingCardBlock = (state: GameState): { state: GameState; block: BlockState } => {
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

const createPlayerState = (player: LobbyPlayer, seatIndex: number, startingGold: number): PlayerState => {
  return {
    id: player.id,
    name: player.name,
    seatIndex,
    factionId: "unassigned",
    capitalHex: undefined,
    resources: { gold: startingGold, mana: 0 },
    vp: { permanent: 0 },
    doneThisRound: false,
    deck: {
      drawPile: [],
      discardPile: [],
      hand: [],
      scrapped: []
    },
    burned: [],
    flags: {},
    visibility: { connected: true }
  };
};

const normalizeSeed = (seed: GameState["seed"]): number => {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new Error("seed must be a finite number");
    }
    return seed >>> 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const withUpdatedPlayer = (state: GameState, playerId: PlayerID, update: (player: PlayerState) => PlayerState) => {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player))
  };
};

const createCardInstance = (
  state: GameState,
  defId: CardDefId
): { state: GameState; instanceId: CardInstanceID } => {
  const nextIndex = Object.keys(state.cardsByInstanceId).length + 1;
  const instanceId = `ci_${nextIndex}`;
  return {
    state: {
      ...state,
      cardsByInstanceId: {
        ...state.cardsByInstanceId,
        [instanceId]: { id: instanceId, defId }
      }
    },
    instanceId
  };
};

export const createNewGame = (
  config: GameState["config"] = DEFAULT_CONFIG,
  seed: GameState["seed"],
  lobbyPlayers: LobbyPlayer[]
): GameState => {
  const playerCount = lobbyPlayers.length;
  const players = lobbyPlayers.map((player, seatIndex) =>
    createPlayerState(player, seatIndex, config.START_GOLD)
  );
  const radius = config.boardRadiusByPlayerCount[playerCount] ?? 0;
  const board = createBaseBoard(radius);
  const capitalSlots = getCapitalSlots(playerCount, radius);

  const state: GameState = {
    config,
    seed,
    rngState: createRngState(normalizeSeed(seed)),
    revision: 0,
    createdAt: Date.now(),
    players,
    round: 0,
    leadSeatIndex: 0,
    phase: "setup",
    board,
    market: {
      age: "I",
      currentRow: [],
      rowIndexResolving: 0,
      passPot: 0,
      bids: Object.fromEntries(players.map((player) => [player.id, null])),
      playersOut: Object.fromEntries(players.map((player) => [player.id, false]))
    },
    logs: [],
    modifiers: [],
    blocks: createCapitalDraftBlock(players, capitalSlots),
    cardsByInstanceId: {}
  };

  return state;
};

export const applyCommand = (
  state: GameState,
  _command: Command,
  _playerId: PlayerID
): GameState => {
  if (_command.type !== "SubmitSetupChoice") {
    return state;
  }

  return applySetupChoice(state, _command.payload, _playerId);
};

const applySetupChoice = (state: GameState, choice: SetupChoice, playerId: PlayerID): GameState => {
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
    const player = stateWithCard.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error("player not found");
    }

    const { value: insertIndex, next: nextRng } = randInt(
      stateWithCard.rngState,
      0,
      player.deck.drawPile.length
    );
    const newDrawPile = player.deck.drawPile.slice();
    newDrawPile.splice(insertIndex, 0, instanceId);

    const updatedState = {
      ...stateWithCard,
      rngState: nextRng,
      players: stateWithCard.players.map((entry) =>
        entry.id === playerId
          ? { ...entry, deck: { ...entry.deck, drawPile: newDrawPile } }
          : entry
      )
    };

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

export const runUntilBlocked = (state: GameState): GameState => {
  let nextState = state;

  while (true) {
    if (nextState.phase !== "setup") {
      return nextState;
    }

    if (!nextState.blocks) {
      const capitalSlots = getCapitalSlots(nextState.players.length, nextState.board.radius);
      return {
        ...nextState,
        blocks: createCapitalDraftBlock(nextState.players, capitalSlots)
      };
    }

    if (nextState.blocks.waitingFor.length > 0) {
      return nextState;
    }

    if (nextState.blocks.type === "setup.capitalDraft") {
      nextState = {
        ...nextState,
        blocks: createStartingBridgesBlock(nextState.players)
      };
      continue;
    }

    if (nextState.blocks.type === "setup.startingBridges") {
      const { state: updatedState, block } = createFreeStartingCardBlock(nextState);
      nextState = {
        ...updatedState,
        blocks: block
      };
      continue;
    }

    if (nextState.blocks.type === "setup.freeStartingCardPick") {
      return {
        ...nextState,
        phase: "round.reset",
        blocks: undefined
      };
    }

    return nextState;
  }
};

export const buildView = (state: GameState, viewerPlayerId: PlayerID | null): GameView => {
  const viewer = state.players.find((player) => player.id === viewerPlayerId) ?? null;

  return {
    public: {
      round: state.round,
      phase: state.phase,
      board: state.board,
      market: state.market,
      logs: state.logs,
      players: state.players.map((player) => ({
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        resources: player.resources,
        doneThisRound: player.doneThisRound,
        connected: player.visibility.connected
      }))
    },
    private: viewer
      ? {
          playerId: viewer.id,
          hand: viewer.deck.hand,
          deckCounts: {
            drawPile: viewer.deck.drawPile.length,
            discardPile: viewer.deck.discardPile.length,
            scrapped: viewer.deck.scrapped.length
          },
          vp: viewer.vp
        }
      : null
  };
};

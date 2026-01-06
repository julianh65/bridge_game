import { createRngState } from "@bridgefront/shared";

import type {
  Command,
  GameState,
  GameView,
  LobbyPlayer,
  PlayerID,
  PlayerState
} from "./types";
import { DEFAULT_CONFIG } from "./config";
import { createBaseBoard, getCapitalSlots } from "./board-generation";
import {
  applySetupChoice,
  createCapitalDraftBlock,
  createFreeStartingCardBlock,
  createStartingBridgesBlock,
  finalizeCapitalDraft
} from "./setup-flow";
import {
  applyAgeUpdate,
  applyCleanup,
  applyCollection,
  applyRoundReset,
  applyScoring
} from "./round-flow";
import { applyActionDeclaration, createActionStepBlock, resolveActionStep } from "./action-flow";
import { resolveSieges } from "./combat";
import { emit } from "./events";

const createPlayerState = (player: LobbyPlayer, seatIndex: number, startingGold: number): PlayerState => {
  return {
    id: player.id,
    name: player.name,
    seatIndex,
    factionId: "unassigned",
    capitalHex: undefined,
    resources: { gold: startingGold, mana: 0 },
    vp: { permanent: 0, control: 0, total: 0 },
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

const enterPhase = (state: GameState, phase: GameState["phase"]): GameState => {
  return emit(
    { ...state, phase, blocks: undefined },
    { type: `phase.${phase}`, payload: { round: state.round } }
  );
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
  const capitalSlots = getCapitalSlots(playerCount, radius, config.capitalSlotsByPlayerCount);

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
    cardsByInstanceId: {},
    winnerPlayerId: null
  };

  return state;
};

export const applyCommand = (
  state: GameState,
  _command: Command,
  _playerId: PlayerID
): GameState => {
  if (_command.type === "SubmitSetupChoice") {
    return applySetupChoice(state, _command.payload, _playerId);
  }

  if (_command.type === "SubmitAction") {
    return applyActionDeclaration(state, _command.payload, _playerId);
  }

  return state;
};

export const runUntilBlocked = (state: GameState): GameState => {
  let nextState = state;

  while (true) {
    if (nextState.winnerPlayerId) {
      return nextState;
    }

    if (nextState.phase === "round.reset") {
      const resetState = applyRoundReset(nextState);
      nextState =
        resetState.phase !== nextState.phase
          ? enterPhase(resetState, resetState.phase)
          : resetState;
      continue;
    }

    if (nextState.phase === "round.market") {
      nextState = enterPhase(nextState, "round.action");
      continue;
    }

    if (nextState.phase === "round.action") {
      if (!nextState.blocks) {
        const block = createActionStepBlock(nextState);
        if (!block) {
          nextState = enterPhase(nextState, "round.sieges");
          continue;
        }
        nextState = {
          ...nextState,
          blocks: block
        };
        continue;
      }

      if (nextState.blocks.type === "actionStep.declarations") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveActionStep(nextState, nextState.blocks.payload.declarations);
        nextState = {
          ...nextState,
          blocks: undefined
        };
        continue;
      }

      return nextState;
    }

    if (nextState.phase === "round.sieges") {
      nextState = resolveSieges(nextState);
      nextState = enterPhase(nextState, "round.collection");
      continue;
    }

    if (nextState.phase === "round.collection") {
      nextState = applyCollection(nextState);
      nextState = enterPhase(nextState, "round.scoring");
      continue;
    }

    if (nextState.phase === "round.scoring") {
      nextState = applyScoring(nextState);
      if (nextState.winnerPlayerId) {
        return nextState;
      }
      nextState = enterPhase(nextState, "round.cleanup");
      continue;
    }

    if (nextState.phase === "round.cleanup") {
      nextState = applyCleanup(nextState);
      nextState = enterPhase(nextState, "round.ageUpdate");
      continue;
    }

    if (nextState.phase === "round.ageUpdate") {
      nextState = applyAgeUpdate(nextState);
      nextState = enterPhase(nextState, "round.reset");
      continue;
    }

    if (nextState.phase !== "setup") {
      return nextState;
    }

    if (!nextState.blocks) {
      const capitalSlots = getCapitalSlots(
        nextState.players.length,
        nextState.board.radius,
        nextState.config.capitalSlotsByPlayerCount
      );
      return {
        ...nextState,
        blocks: createCapitalDraftBlock(nextState.players, capitalSlots)
      };
    }

    if (nextState.blocks.waitingFor.length > 0) {
      return nextState;
    }

    if (nextState.blocks.type === "setup.capitalDraft") {
      const setupState = finalizeCapitalDraft(nextState);
      nextState = {
        ...setupState,
        blocks: createStartingBridgesBlock(setupState.players)
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
      nextState = enterPhase(nextState, "round.reset");
      continue;
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
      })),
      winnerPlayerId: state.winnerPlayerId
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

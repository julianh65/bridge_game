import { createRngState } from "@bridgefront/shared";

import type {
  Command,
  GameState,
  LobbyPlayer,
  PlayerID,
  PlayerState
} from "./types";
import { DEFAULT_CONFIG } from "./config";
import { createBaseBoard, getCapitalSlots } from "./board-generation";
import {
  applySetupChoice,
  createCapitalDraftBlock,
  createDeckPreviewBlock,
  createFreeStartingCardBlock,
  createStartingBridgesBlock,
  finalizeCapitalDraft,
  finalizeFreeStartingCardPick,
  finalizeStartingBridges
} from "./setup-flow";
import {
  applyAgeUpdate,
  applyCleanup,
  applyQuietStudyChoice,
  applyRoundReset,
  applyScoring,
  applyCollectionChoice,
  createQuietStudyBlock,
  createCollectionBlock,
  resolveQuietStudyChoices,
  resolveCollectionChoices
} from "./round-flow";
import {
  applyActionDeclaration,
  createActionResolutionState,
  createActionStepBlock,
  resolveNextActionEntry
} from "./action-flow";
import { applyScoutReportChoice, resolveScoutReportBlock } from "./card-effects";
import { applyCombatRetreatChoice, resolveCombatRetreatBlock, resolveSieges } from "./combat";
import { emit } from "./events";
import {
  applyMarketBid,
  createMarketBidBlock,
  initializeMarketDecks,
  initializePowerDecks,
  prepareMarketRow,
  resolveMarketBids
} from "./market";

const createPlayerState = (player: LobbyPlayer, seatIndex: number, startingGold: number): PlayerState => {
  return {
    id: player.id,
    name: player.name,
    seatIndex,
    factionId: player.factionId ?? "unassigned",
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

const getHostPlayerId = (state: GameState): PlayerID | null => {
  return state.players.find((player) => player.seatIndex === 0)?.id ?? null;
};

const requestSetupAdvance = (state: GameState, playerId: PlayerID): GameState => {
  if (state.phase !== "setup") {
    throw new Error("setup advance is only available during setup");
  }
  const hostPlayerId = getHostPlayerId(state);
  if (!hostPlayerId || hostPlayerId !== playerId) {
    throw new Error("only the host can advance setup");
  }
  if (!state.blocks) {
    throw new Error("no setup block to advance");
  }
  if (state.blocks.waitingFor.length > 0) {
    throw new Error("setup cannot advance until all players are ready");
  }
  return {
    ...state,
    setup: {
      ...state.setup,
      advanceRequested: true
    }
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

  let state: GameState = {
    config,
    seed,
    rngState: createRngState(normalizeSeed(seed)),
    revision: 0,
    createdAt: Date.now(),
    players,
    round: 0,
    leadSeatIndex: 0,
    phase: "setup",
    setup: { advanceRequested: false },
    board,
    market: {
      age: "I",
      currentRow: [],
      rowIndexResolving: 0,
      passPot: 0,
      bids: Object.fromEntries(players.map((player) => [player.id, null])),
      playersOut: Object.fromEntries(players.map((player) => [player.id, false]))
    },
    marketDecks: { I: [], II: [], III: [] },
    powerDecks: { I: [], II: [], III: [] },
    logs: [],
    modifiers: [],
    blocks: createCapitalDraftBlock(players, capitalSlots),
    cardsByInstanceId: {},
    winnerPlayerId: null
  };

  state = initializeMarketDecks(state);
  state = initializePowerDecks(state);
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

  if (_command.type === "AdvanceSetup") {
    return requestSetupAdvance(state, _playerId);
  }

  if (_command.type === "SubmitQuietStudy") {
    return applyQuietStudyChoice(state, _command.payload.cardInstanceIds, _playerId);
  }

  if (_command.type === "SubmitScoutReportChoice") {
    return applyScoutReportChoice(state, _command.payload.cardInstanceIds, _playerId);
  }

  if (_command.type === "SubmitAction") {
    return applyActionDeclaration(state, _command.payload, _playerId);
  }

  if (_command.type === "SubmitMarketBid") {
    return applyMarketBid(state, _command.payload, _playerId);
  }

  if (_command.type === "SubmitCollectionChoices") {
    return applyCollectionChoice(state, _command.payload, _playerId);
  }

  if (_command.type === "SubmitCombatRetreat") {
    return applyCombatRetreatChoice(state, _playerId, _command.payload);
  }

  return state;
};

export const runUntilBlocked = (state: GameState): GameState => {
  let nextState = state;

  while (true) {
    if (nextState.winnerPlayerId) {
      return nextState;
    }

    if (nextState.blocks?.type === "combat.retreat") {
      if (nextState.blocks.waitingFor.length > 0) {
        return nextState;
      }
      nextState = resolveCombatRetreatBlock(nextState, nextState.blocks);
      nextState = {
        ...nextState,
        blocks: undefined
      };
      continue;
    }

    if (nextState.blocks?.type === "action.scoutReport") {
      if (nextState.blocks.waitingFor.length > 0) {
        return nextState;
      }
      nextState = resolveScoutReportBlock(nextState, nextState.blocks);
      nextState = {
        ...nextState,
        blocks: undefined
      };
      continue;
    }

    if (nextState.phase === "round.reset") {
      const resetState = applyRoundReset(nextState);
      nextState =
        resetState.phase !== nextState.phase
          ? enterPhase(resetState, resetState.phase)
          : resetState;
      continue;
    }

    if (nextState.phase === "round.study") {
      if (!nextState.blocks) {
        const block = createQuietStudyBlock(nextState);
        if (!block) {
          nextState = enterPhase(nextState, "round.action");
          continue;
        }
        nextState = {
          ...nextState,
          blocks: block
        };
        if (block.waitingFor.length > 0) {
          return nextState;
        }
      }

      if (nextState.blocks.type === "round.quietStudy") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveQuietStudyChoices(nextState);
        nextState = {
          ...nextState,
          blocks: undefined
        };
        nextState = enterPhase(nextState, "round.market");
        continue;
      }

      return nextState;
    }

    if (nextState.phase === "round.market") {
      nextState = prepareMarketRow(nextState);
      if (!nextState.blocks) {
        const block = createMarketBidBlock(nextState);
        if (!block) {
          const quietStudyBlock = createQuietStudyBlock(nextState);
          if (quietStudyBlock) {
            nextState = enterPhase(nextState, "round.study");
            continue;
          }
          nextState = enterPhase(nextState, "round.action");
          continue;
        }
        nextState = {
          ...nextState,
          blocks: block
        };
        continue;
      }

      if (nextState.blocks.type === "market.bidsForCard") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveMarketBids(nextState);
        nextState = {
          ...nextState,
          blocks: undefined
        };
        continue;
      }

      return nextState;
    }

    if (nextState.phase === "round.action") {
      if (nextState.actionResolution) {
        nextState = resolveNextActionEntry(nextState);
        if (nextState.blocks?.type === "combat.retreat") {
          return nextState;
        }
        continue;
      }

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
        nextState = {
          ...nextState,
          blocks: undefined,
          actionResolution: createActionResolutionState(
            nextState,
            nextState.blocks.payload.declarations
          )
        };
        continue;
      }

      return nextState;
    }

    if (nextState.phase === "round.sieges") {
      nextState = resolveSieges(nextState);
      if (nextState.blocks?.type === "combat.retreat") {
        return nextState;
      }
      nextState = enterPhase(nextState, "round.collection");
      continue;
    }

    if (nextState.phase === "round.collection") {
      if (!nextState.blocks) {
        const collection = createCollectionBlock(nextState);
        if (!collection.block) {
          nextState = enterPhase(collection.state, "round.scoring");
          continue;
        }
        nextState = {
          ...collection.state,
          blocks: collection.block
        };
        continue;
      }

      if (nextState.blocks.type === "collection.choices") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveCollectionChoices(nextState);
        nextState = {
          ...nextState,
          blocks: undefined
        };
        nextState = enterPhase(nextState, "round.scoring");
        continue;
      }

      return nextState;
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
      return {
        ...nextState,
        blocks: createDeckPreviewBlock()
      };
    }

    if (nextState.blocks.waitingFor.length > 0) {
      return nextState;
    }

    if (!nextState.setup.advanceRequested) {
      return nextState;
    }

    const advanceReadyState = {
      ...nextState,
      setup: {
        ...nextState.setup,
        advanceRequested: false
      }
    };

    if (advanceReadyState.blocks.type === "setup.deckPreview") {
      const capitalSlots = getCapitalSlots(
        advanceReadyState.players.length,
        advanceReadyState.board.radius,
        advanceReadyState.config.capitalSlotsByPlayerCount
      );
      nextState = {
        ...advanceReadyState,
        blocks: createCapitalDraftBlock(advanceReadyState.players, capitalSlots)
      };
      continue;
    }

    if (advanceReadyState.blocks.type === "setup.capitalDraft") {
      const setupState = finalizeCapitalDraft(advanceReadyState);
      nextState = {
        ...setupState,
        blocks: createStartingBridgesBlock(setupState.players)
      };
      continue;
    }

    if (advanceReadyState.blocks.type === "setup.startingBridges") {
      const revealed = finalizeStartingBridges(advanceReadyState);
      const { state: updatedState, block } = createFreeStartingCardBlock(revealed);
      nextState = {
        ...updatedState,
        blocks: block
      };
      continue;
    }

    if (advanceReadyState.blocks.type === "setup.freeStartingCardPick") {
      const finalized = finalizeFreeStartingCardPick(advanceReadyState);
      nextState = enterPhase(finalized, "round.reset");
      continue;
    }

    return nextState;
  }
};

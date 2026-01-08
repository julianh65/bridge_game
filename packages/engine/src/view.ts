import type {
  BlockState,
  GameState,
  GameView,
  Modifier,
  ModifierView,
  PlayerID,
  SetupPrivateView,
  SetupPublicView,
  SetupStatusView
} from "./types";

type SetupBlockState = Extract<
  BlockState,
  { type: "setup.capitalDraft" | "setup.startingBridges" | "setup.freeStartingCardPick" }
>;

const isSetupBlock = (block: BlockState): block is SetupBlockState =>
  block.type === "setup.capitalDraft" ||
  block.type === "setup.startingBridges" ||
  block.type === "setup.freeStartingCardPick";

const buildSetupPublicView = (block: SetupBlockState): SetupPublicView => {
  if (block.type === "setup.capitalDraft") {
    return {
      type: block.type,
      waitingForPlayerIds: block.waitingFor,
      availableSlots: block.payload.availableSlots,
      choices: block.payload.choices
    };
  }
  if (block.type === "setup.startingBridges") {
    return {
      type: block.type,
      waitingForPlayerIds: block.waitingFor,
      remaining: block.payload.remaining
    };
  }
  const chosen = Object.fromEntries(
    Object.entries(block.payload.chosen).map(([playerId, cardId]) => [playerId, Boolean(cardId)])
  );
  return {
    type: block.type,
    waitingForPlayerIds: block.waitingFor,
    chosen
  };
};

const buildSetupPrivateView = (block: SetupBlockState, playerId: PlayerID): SetupPrivateView => {
  if (block.type === "setup.startingBridges") {
    return {
      type: block.type,
      remaining: block.payload.remaining[playerId] ?? 0,
      selectedEdges: block.payload.selectedEdges[playerId] ?? []
    };
  }
  if (block.type !== "setup.freeStartingCardPick") {
    return null;
  }
  return {
    type: block.type,
    offers: block.payload.offers[playerId] ?? [],
    chosen: block.payload.chosen[playerId] ?? null
  };
};

const buildSetupStatusView = (state: GameState): SetupStatusView | null => {
  if (state.phase !== "setup") {
    return null;
  }

  const setupBlock = state.blocks && isSetupBlock(state.blocks) ? state.blocks : null;
  const waitingForPlayerIds = setupBlock?.waitingFor ?? [];
  const hostPlayerId = state.players.find((player) => player.seatIndex === 0)?.id ?? null;
  const lockedByPlayerId = Object.fromEntries(
    state.players.map((player) => [player.id, !waitingForPlayerIds.includes(player.id)])
  );

  return {
    phase: setupBlock ? setupBlock.type : "setup.lobby",
    hostPlayerId,
    lockedByPlayerId,
    waitingForPlayerIds,
    canAdvance: Boolean(setupBlock && waitingForPlayerIds.length === 0)
  };
};

const mapCardInstances = (state: GameState, instanceIds: string[]) => {
  return instanceIds.map(
    (instanceId) =>
      state.cardsByInstanceId[instanceId] ?? { id: instanceId, defId: "unknown" }
  );
};

const toModifierView = (modifier: Modifier): ModifierView => {
  const { hooks, ...rest } = modifier;
  return rest;
};

export const buildView = (state: GameState, viewerPlayerId: PlayerID | null): GameView => {
  const viewer = state.players.find((player) => player.id === viewerPlayerId) ?? null;
  const actionStep =
    state.blocks?.type === "actionStep.declarations"
      ? {
          eligiblePlayerIds: Object.keys(state.blocks.payload.declarations),
          waitingForPlayerIds: state.blocks.waitingFor
        }
      : null;
  const setupPublic =
    state.phase === "setup" && state.blocks && isSetupBlock(state.blocks)
      ? buildSetupPublicView(state.blocks)
      : null;
  const setupPrivate =
    viewer && state.phase === "setup" && state.blocks && isSetupBlock(state.blocks)
      ? buildSetupPrivateView(state.blocks, viewer.id)
      : null;
  const collectionPublic =
    state.phase === "round.collection" && state.blocks?.type === "collection.choices"
      ? { waitingForPlayerIds: state.blocks.waitingFor }
      : null;
  const collectionPrivate =
    viewer && state.phase === "round.collection" && state.blocks?.type === "collection.choices"
      ? {
          prompts: state.blocks.payload.prompts[viewer.id] ?? [],
          choices: state.blocks.payload.choices[viewer.id] ?? null
        }
      : null;
  const quietStudyPublic =
    state.phase === "round.study" && state.blocks?.type === "round.quietStudy"
      ? { waitingForPlayerIds: state.blocks.waitingFor }
      : null;
  const quietStudyPrivate =
    viewer && state.phase === "round.study" && state.blocks?.type === "round.quietStudy"
      ? {
          maxDiscard: state.blocks.payload.maxDiscard,
          selected: state.blocks.payload.choices[viewer.id] ?? null,
          isWaiting: state.blocks.waitingFor.includes(viewer.id)
        }
      : null;
  const setupStatus = buildSetupStatusView(state);

  return {
    public: {
      config: state.config,
      seed: state.seed,
      round: state.round,
      phase: state.phase,
      board: state.board,
      modifiers: state.modifiers.map(toModifierView),
      market: state.market,
      logs: state.logs,
      players: state.players.map((player) => ({
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        factionId: player.factionId,
        resources: player.resources,
        handCount: player.deck.hand.length,
        vp: state.winnerPlayerId ? player.vp : null,
        doneThisRound: player.doneThisRound,
        connected: player.visibility.connected
      })),
      actionStep,
      setup: setupPublic,
      setupStatus,
      collection: collectionPublic,
      quietStudy: quietStudyPublic,
      winnerPlayerId: state.winnerPlayerId
    },
    private: viewer
      ? {
          playerId: viewer.id,
          hand: viewer.deck.hand,
          handCards: mapCardInstances(state, viewer.deck.hand),
          deckCounts: {
            drawPile: viewer.deck.drawPile.length,
            discardPile: viewer.deck.discardPile.length,
            scrapped: viewer.deck.scrapped.length
          },
          deckCards: {
            drawPile: mapCardInstances(state, viewer.deck.drawPile),
            discardPile: mapCardInstances(state, viewer.deck.discardPile),
            scrapped: mapCardInstances(state, viewer.deck.scrapped)
          },
          vp: viewer.vp,
          setup: setupPrivate,
          collection: collectionPrivate,
          quietStudy: quietStudyPrivate
        }
      : null
  };
};

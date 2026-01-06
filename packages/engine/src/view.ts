import type {
  BlockState,
  GameState,
  GameView,
  PlayerID,
  SetupPrivateView,
  SetupPublicView
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
      remaining: block.payload.remaining,
      placedEdges: block.payload.placedEdges
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
  if (block.type !== "setup.freeStartingCardPick") {
    return null;
  }
  return {
    type: block.type,
    offers: block.payload.offers[playerId] ?? [],
    chosen: block.payload.chosen[playerId] ?? null
  };
};

const mapCardInstances = (state: GameState, instanceIds: string[]) => {
  return instanceIds.map(
    (instanceId) =>
      state.cardsByInstanceId[instanceId] ?? { id: instanceId, defId: "unknown" }
  );
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

  return {
    public: {
      seed: state.seed,
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
      actionStep,
      setup: setupPublic,
      collection: collectionPublic,
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
          collection: collectionPrivate
        }
      : null
  };
};

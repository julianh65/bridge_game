import type {
  BlockState,
  Command,
  GameState,
  GameView,
  LobbyPlayer,
  PlayerID,
  PlayerState
} from "./types";
import { DEFAULT_CONFIG } from "./config";

const EMPTY_BLOCK: BlockState = {
  type: "setup.capitalDraft",
  waitingFor: []
};

const createPlayerState = (player: LobbyPlayer, seatIndex: number, startingGold: number): PlayerState => {
  return {
    id: player.id,
    name: player.name,
    seatIndex,
    factionId: "unassigned",
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

  const state: GameState = {
    config,
    seed,
    rngState: { seed: Number(seed) || 0, position: 0 },
    revision: 0,
    createdAt: Date.now(),
    players,
    round: 0,
    leadSeatIndex: 0,
    phase: "setup",
    board: {
      radius,
      hexes: {},
      bridges: {},
      units: {}
    },
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
    blocks: {
      type: "setup.capitalDraft",
      waitingFor: [...players]
        .map((player) => player.id)
        .reverse()
    },
    cardsByInstanceId: {}
  };

  return state;
};

export const applyCommand = (
  state: GameState,
  _command: Command,
  _playerId: PlayerID
): GameState => {
  return state;
};

export const runUntilBlocked = (state: GameState): GameState => {
  if (!state.blocks) {
    return {
      ...state,
      blocks: {
        ...EMPTY_BLOCK,
        waitingFor: state.players.map((player) => player.id).reverse()
      }
    };
  }

  return state;
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

import type { GameState, PlayerID } from "./types";

export const MOVED_THIS_ROUND_FLAG = "movedThisRound";
export const CARDS_PLAYED_THIS_ROUND_FLAG = "cardsPlayedThisRound";
export const CARDS_DISCARDED_THIS_ROUND_FLAG = "cardsDiscardedThisRound";

const readCardsPlayedThisRound = (player: GameState["players"][number]): number => {
  const raw = player.flags[CARDS_PLAYED_THIS_ROUND_FLAG];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.floor(raw));
};

const readCardsDiscardedThisRound = (player: GameState["players"][number]): number => {
  const raw = player.flags[CARDS_DISCARDED_THIS_ROUND_FLAG];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.floor(raw));
};

export const hasPlayerMovedThisRound = (state: GameState, playerId: PlayerID): boolean => {
  const player = state.players.find((entry) => entry.id === playerId);
  return Boolean(player?.flags[MOVED_THIS_ROUND_FLAG]);
};

export const markPlayerMovedThisRound = (state: GameState, playerId: PlayerID): GameState => {
  const index = state.players.findIndex((entry) => entry.id === playerId);
  if (index < 0) {
    return state;
  }

  const player = state.players[index];
  if (player.flags[MOVED_THIS_ROUND_FLAG] === true) {
    return state;
  }

  const nextPlayers = [...state.players];
  nextPlayers[index] = {
    ...player,
    flags: {
      ...player.flags,
      [MOVED_THIS_ROUND_FLAG]: true
    }
  };

  return {
    ...state,
    players: nextPlayers
  };
};

export const getCardsPlayedThisRound = (state: GameState, playerId: PlayerID): number => {
  const player = state.players.find((entry) => entry.id === playerId);
  return player ? readCardsPlayedThisRound(player) : 0;
};

export const getCardsDiscardedThisRound = (state: GameState, playerId: PlayerID): number => {
  const player = state.players.find((entry) => entry.id === playerId);
  return player ? readCardsDiscardedThisRound(player) : 0;
};

export const incrementCardsPlayedThisRound = (
  state: GameState,
  playerId: PlayerID,
  amount = 1
): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }

  const index = state.players.findIndex((entry) => entry.id === playerId);
  if (index < 0) {
    return state;
  }

  const player = state.players[index];
  const nextCount = readCardsPlayedThisRound(player) + Math.floor(amount);
  if (player.flags[CARDS_PLAYED_THIS_ROUND_FLAG] === nextCount) {
    return state;
  }

  const nextPlayers = [...state.players];
  nextPlayers[index] = {
    ...player,
    flags: {
      ...player.flags,
      [CARDS_PLAYED_THIS_ROUND_FLAG]: nextCount
    }
  };

  return {
    ...state,
    players: nextPlayers
  };
};

export const incrementCardsDiscardedThisRound = (
  state: GameState,
  playerId: PlayerID,
  amount = 1
): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }

  const index = state.players.findIndex((entry) => entry.id === playerId);
  if (index < 0) {
    return state;
  }

  const player = state.players[index];
  const nextCount = readCardsDiscardedThisRound(player) + Math.floor(amount);
  if (player.flags[CARDS_DISCARDED_THIS_ROUND_FLAG] === nextCount) {
    return state;
  }

  const nextPlayers = [...state.players];
  nextPlayers[index] = {
    ...player,
    flags: {
      ...player.flags,
      [CARDS_DISCARDED_THIS_ROUND_FLAG]: nextCount
    }
  };

  return {
    ...state,
    players: nextPlayers
  };
};

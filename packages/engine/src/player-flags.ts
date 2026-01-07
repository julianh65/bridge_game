import type { GameState, PlayerID } from "./types";

export const MOVED_THIS_ROUND_FLAG = "movedThisRound";

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

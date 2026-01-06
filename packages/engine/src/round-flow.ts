import type { GameState, PlayerID } from "./types";
import { getPlayerIdsOnHex } from "./board";
import { drawToHandSize } from "./cards";

export const applyRoundReset = (state: GameState): GameState => {
  const nextRound = state.round + 1;
  const playerCount = state.players.length;
  let nextState: GameState = {
    ...state,
    round: nextRound,
    leadSeatIndex: playerCount > 0 ? (nextRound - 1) % playerCount : 0,
    players: state.players.map((player) => ({
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold + state.config.BASE_INCOME,
        mana: state.config.MAX_MANA
      },
      doneThisRound: false
    }))
  };

  for (const player of nextState.players) {
    nextState = drawToHandSize(nextState, player.id, 6);
  }

  return {
    ...nextState,
    phase: "round.market"
  };
};

export const applyCollection = (state: GameState): GameState => {
  const goldGains: Record<PlayerID, number> = {};

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.tile !== "mine") {
      continue;
    }
    if (!hex.mineValue || hex.mineValue <= 0) {
      continue;
    }
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const playerId = occupants[0];
    goldGains[playerId] = (goldGains[playerId] ?? 0) + hex.mineValue;
  }

  if (Object.keys(goldGains).length === 0) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      const gain = goldGains[player.id] ?? 0;
      if (gain <= 0) {
        return player;
      }
      return {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + gain
        }
      };
    })
  };
};

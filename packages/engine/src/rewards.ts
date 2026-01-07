import type { ChampionKillContext, GameState, PlayerID } from "./types";
import { getChampionKillBonusGold } from "./modifiers";

const addGold = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (amount <= 0) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            resources: {
              ...player.resources,
              gold: player.resources.gold + amount
            }
          }
        : player
    )
  };
};

export const applyChampionKillRewards = (state: GameState, context: ChampionKillContext): GameState => {
  if (context.killerPlayerId === context.victimPlayerId) {
    return state;
  }
  if (context.killedChampions.length === 0) {
    return state;
  }

  const bonus = getChampionKillBonusGold(state, context, 0);
  const total = context.bounty + bonus;
  if (total <= 0) {
    return state;
  }

  return addGold(state, context.killerPlayerId, total);
};

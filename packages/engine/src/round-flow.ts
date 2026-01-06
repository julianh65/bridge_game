import type { GameState } from "./types";
import { drawToHandSize } from "./cards";

export const applyRoundReset = (state: GameState): GameState => {
  let nextState: GameState = {
    ...state,
    round: state.round + 1,
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

import type { GameState } from "./types";
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

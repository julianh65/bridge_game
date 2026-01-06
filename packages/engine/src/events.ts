import type { GameEvent, GameState } from "./types";

const MAX_LOGS = 200;

export const emit = (state: GameState, event: GameEvent): GameState => {
  const logs = [...state.logs, event];
  if (logs.length <= MAX_LOGS) {
    return { ...state, logs };
  }
  return { ...state, logs: logs.slice(logs.length - MAX_LOGS) };
};

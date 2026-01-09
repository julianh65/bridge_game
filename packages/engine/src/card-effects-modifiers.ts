import type { GameState } from "./types";

export const removeModifierById = (state: GameState, modifierId: string): GameState => {
  const nextModifiers = state.modifiers.filter((modifier) => modifier.id !== modifierId);
  return nextModifiers.length === state.modifiers.length
    ? state
    : { ...state, modifiers: nextModifiers };
};

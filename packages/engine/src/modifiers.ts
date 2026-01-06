import type {
  CombatAssignmentContext,
  CombatEndContext,
  CombatRoundContext,
  CombatUnitContext,
  GameState,
  HexKey,
  Modifier,
  ModifierEventHook,
  ModifierHooks,
  ModifierQueryHook
} from "./types";

const getHooks = (modifier: Modifier): ModifierHooks | null => {
  if (!modifier.hooks) {
    return null;
  }
  return modifier.hooks as ModifierHooks;
};

export const getCombatModifiers = (state: GameState, hexKey: HexKey): Modifier[] => {
  return state.modifiers.filter((modifier) => {
    if (modifier.attachedHex && modifier.attachedHex !== hexKey) {
      return false;
    }
    if (modifier.attachedEdge) {
      return false;
    }
    return true;
  });
};

export const applyModifierQuery = <TContext, TValue>(
  state: GameState,
  modifiers: Modifier[],
  getHook: (hooks: ModifierHooks) => ModifierQueryHook<TContext, TValue> | undefined,
  context: TContext,
  base: TValue
): TValue => {
  let value = base;
  for (const modifier of modifiers) {
    const hooks = getHooks(modifier);
    if (!hooks) {
      continue;
    }
    const hook = getHook(hooks);
    if (!hook) {
      continue;
    }
    value = hook({ ...context, modifier, state }, value);
  }
  return value;
};

export const runModifierEvents = <TContext>(
  state: GameState,
  modifiers: Modifier[],
  getHook: (hooks: ModifierHooks) => ModifierEventHook<TContext> | undefined,
  context: TContext
): GameState => {
  let nextState = state;
  for (const modifier of modifiers) {
    const hooks = getHooks(modifier);
    if (!hooks) {
      continue;
    }
    const hook = getHook(hooks);
    if (!hook) {
      continue;
    }
    nextState = hook({ ...context, modifier, state: nextState });
  }
  return nextState;
};

export type {
  CombatAssignmentContext,
  CombatEndContext,
  CombatRoundContext,
  CombatUnitContext
};

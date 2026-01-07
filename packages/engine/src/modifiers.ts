import type {
  CardChoiceContext,
  ChampionKillContext,
  CombatAssignmentContext,
  CombatEndContext,
  CombatRoundContext,
  CombatUnitContext,
  ControlValueContext,
  DeployForcesContext,
  GameState,
  HexKey,
  Modifier,
  MoveContext,
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

const isModifierActive = (modifier: Modifier): boolean => {
  if (modifier.duration.type === "uses") {
    return modifier.duration.remaining > 0;
  }
  return true;
};

const consumeModifierUse = (state: GameState, modifierId: string): GameState => {
  const index = state.modifiers.findIndex((modifier) => modifier.id === modifierId);
  if (index < 0) {
    return state;
  }

  const modifier = state.modifiers[index];
  if (modifier.duration.type !== "uses") {
    return state;
  }

  const remaining = modifier.duration.remaining - 1;
  const nextModifiers = [...state.modifiers];

  if (remaining <= 0) {
    nextModifiers.splice(index, 1);
  } else {
    nextModifiers[index] = {
      ...modifier,
      duration: { type: "uses", remaining }
    };
  }

  return { ...state, modifiers: nextModifiers };
};

const filterActiveModifiers = (modifiers: Modifier[]): Modifier[] => {
  return modifiers.filter((modifier) => isModifierActive(modifier));
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

export const expireEndOfRoundModifiers = (state: GameState): GameState => {
  const modifiers = filterActiveModifiers(
    state.modifiers.filter((modifier) => modifier.duration.type !== "endOfRound")
  );
  return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
};

export const expireEndOfBattleModifiers = (state: GameState, hexKey: HexKey): GameState => {
  const modifiers = filterActiveModifiers(
    state.modifiers.filter((modifier) => {
      if (modifier.duration.type !== "endOfBattle") {
        return true;
      }
      if (!modifier.attachedHex) {
        return false;
      }
      return modifier.attachedHex !== hexKey;
    })
  );
  return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
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
    if (!isModifierActive(modifier)) {
      continue;
    }
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

export const getMoveRequiresBridge = (
  state: GameState,
  context: MoveContext,
  base: boolean
): boolean => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMoveRequiresBridge,
    context,
    base
  );
};

export const getMoveAdjacency = (
  state: GameState,
  context: MoveContext,
  base: boolean
): boolean => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMoveAdjacency,
    context,
    base
  );
};

export const getMoveMaxDistance = (
  state: GameState,
  context: MoveContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMoveMaxDistance,
    context,
    base
  );
};

export const getDeployForcesCount = (
  state: GameState,
  context: DeployForcesContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getDeployForcesCount,
    context,
    base
  );
};

export const getChampionKillBonusGold = (
  state: GameState,
  context: ChampionKillContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getChampionKillBonusGold,
    context,
    base
  );
};

export const getCardChoiceCount = (
  state: GameState,
  context: CardChoiceContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getCardChoiceCount,
    context,
    base
  );
};

export const getControlValue = (
  state: GameState,
  context: ControlValueContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getControlValue,
    context,
    base
  );
};

export const runModifierEvents = <TContext>(
  state: GameState,
  modifiers: Modifier[],
  getHook: (hooks: ModifierHooks) => ModifierEventHook<TContext> | undefined,
  context: TContext
): GameState => {
  let nextState = state;
  for (const modifier of modifiers) {
    if (!isModifierActive(modifier)) {
      continue;
    }
    const hooks = getHooks(modifier);
    if (!hooks) {
      continue;
    }
    const hook = getHook(hooks);
    if (!hook) {
      continue;
    }
    nextState = hook({ ...context, modifier, state: nextState });
    nextState = consumeModifierUse(nextState, modifier.id);
  }
  return nextState;
};

export type {
  CardChoiceContext,
  CombatAssignmentContext,
  CombatEndContext,
  CombatRoundContext,
  CombatUnitContext,
  ControlValueContext,
  DeployForcesContext,
  MoveContext
};

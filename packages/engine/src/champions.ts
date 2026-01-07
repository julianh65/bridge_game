import { randInt } from "@bridgefront/shared";

import type { CardDefId, GameState, Modifier, PlayerID, UnitID } from "./types";
import { applyChampionKillRewards } from "./rewards";

const BODYGUARD_CHAMPION_ID = "champion.bastion.ironclad_warden";
const ASSASSINS_EDGE_CHAMPION_ID = "champion.veil.shadeblade";
const FLIGHT_CHAMPION_ID = "champion.aerial.skystriker_ace";

const ASSASSINS_EDGE_KEY = "assassins_edge";

const PER_ROUND_ABILITY_USES: Record<CardDefId, Record<string, number>> = {
  [ASSASSINS_EDGE_CHAMPION_ID]: {
    [ASSASSINS_EDGE_KEY]: 1
  }
};

const buildChampionModifierId = (unitId: UnitID, key: string) => `champion.${unitId}.${key}`;

const getModifierUnitId = (modifier: Modifier): UnitID | null => {
  const unitId = modifier.data?.unitId;
  return typeof unitId === "string" && unitId.length > 0 ? unitId : null;
};

const getPerRoundAbilityUses = (cardDefId: CardDefId): Record<string, number> | null => {
  return PER_ROUND_ABILITY_USES[cardDefId] ?? null;
};

const buildAbilityUses = (cardDefId: CardDefId): Record<string, { remaining: number }> => {
  const perRound = getPerRoundAbilityUses(cardDefId);
  if (!perRound) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(perRound).map(([key, count]) => [key, { remaining: count }])
  );
};

const setChampionAbilityUses = (
  state: GameState,
  unitId: UnitID,
  abilityUses: Record<string, { remaining: number }>
): GameState => {
  if (Object.keys(abilityUses).length === 0) {
    return state;
  }

  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      units: {
        ...state.board.units,
        [unitId]: {
          ...unit,
          abilityUses: {
            ...unit.abilityUses,
            ...abilityUses
          }
        }
      }
    }
  };
};

const getChampionAbilityRemaining = (unit: GameState["board"]["units"][string], key: string) => {
  if (unit.kind !== "champion") {
    return 0;
  }
  const current = unit.abilityUses[key]?.remaining;
  if (typeof current === "number") {
    return current;
  }
  const perRound = getPerRoundAbilityUses(unit.cardDefId)?.[key];
  return typeof perRound === "number" ? perRound : 0;
};

const canChampionUseAbility = (unit: GameState["board"]["units"][string], key: string) =>
  getChampionAbilityRemaining(unit, key) > 0;

const consumeChampionAbilityUse = (
  state: GameState,
  unitId: UnitID,
  key: string
): GameState => {
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  const remaining = getChampionAbilityRemaining(unit, key);
  if (remaining <= 0) {
    return state;
  }
  return setChampionAbilityUses(state, unitId, {
    [key]: { remaining: remaining - 1 }
  });
};

const createBodyguardModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "bodyguard"),
  source: { type: "champion", sourceId: BODYGUARD_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getHitAssignmentPolicy: ({ modifier, targetUnitIds, state }, current) => {
      if (current === "bodyguard") {
        return current;
      }
      const guardId = getModifierUnitId(modifier);
      if (!guardId) {
        return current;
      }
      if (!targetUnitIds.includes(guardId)) {
        return current;
      }
      const hasForce = targetUnitIds.some(
        (targetId) => state.board.units[targetId]?.kind === "force"
      );
      if (!hasForce) {
        return current;
      }
      return "bodyguard";
    }
  }
});

const createAssassinsEdgeModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "assassins_edge"),
  source: { type: "champion", sourceId: ASSASSINS_EDGE_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    beforeCombatRound: ({ state, modifier, round, attackers, defenders }) => {
      if (round !== 1) {
        return state;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (!canChampionUseAbility(sourceUnit, ASSASSINS_EDGE_KEY)) {
        return state;
      }

      const onAttackers = attackers.includes(sourceUnitId);
      const onDefenders = defenders.includes(sourceUnitId);
      if (!onAttackers && !onDefenders) {
        return state;
      }

      const enemyUnitIds = (onAttackers ? defenders : attackers).filter((enemyId) => {
        const unit = state.board.units[enemyId];
        return unit?.kind === "champion";
      });
      if (enemyUnitIds.length === 0) {
        return state;
      }

      const pick = randInt(state.rngState, 0, enemyUnitIds.length - 1);
      const targetId = enemyUnitIds[pick.value] ?? enemyUnitIds[0];
      let nextState: GameState = {
        ...state,
        rngState: pick.next
      };
      nextState = consumeChampionAbilityUse(nextState, sourceUnitId, ASSASSINS_EDGE_KEY);
      return dealChampionDamage(nextState, sourceUnit.ownerPlayerId, targetId, 1);
    }
  }
});

const createFlightModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "flight"),
  source: { type: "champion", sourceId: FLIGHT_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getMoveRequiresBridge: ({ modifier, movingUnitIds, state }, current) => {
      if (!current) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      if (!movingUnitIds.includes(sourceUnitId)) {
        return current;
      }
      if (movingUnitIds.length === 0) {
        return current;
      }
      const movingUnits = movingUnitIds
        .map((id) => state.board.units[id])
        .filter(Boolean);
      if (movingUnits.some((unit) => unit?.kind !== "champion")) {
        return current;
      }
      if (
        movingUnits.some(
          (unit) => unit?.kind === "champion" && unit.cardDefId !== FLIGHT_CHAMPION_ID
        )
      ) {
        return current;
      }
      return false;
    }
  }
});

const createChampionModifiers = (
  unitId: UnitID,
  cardDefId: CardDefId,
  ownerPlayerId: PlayerID
): Modifier[] => {
  switch (cardDefId) {
    case BODYGUARD_CHAMPION_ID:
      return [createBodyguardModifier(unitId, ownerPlayerId)];
    case ASSASSINS_EDGE_CHAMPION_ID:
      return [createAssassinsEdgeModifier(unitId, ownerPlayerId)];
    case FLIGHT_CHAMPION_ID:
      return [createFlightModifier(unitId, ownerPlayerId)];
    default:
      return [];
  }
};

export const applyChampionDeployment = (
  state: GameState,
  unitId: UnitID,
  cardDefId: CardDefId,
  ownerPlayerId: PlayerID
): GameState => {
  let nextState = setChampionAbilityUses(state, unitId, buildAbilityUses(cardDefId));
  const modifiers = createChampionModifiers(unitId, cardDefId, ownerPlayerId);
  if (modifiers.length === 0) {
    return nextState;
  }
  const existing = new Set(nextState.modifiers.map((modifier) => modifier.id));
  const nextModifiers = [...nextState.modifiers];
  for (const modifier of modifiers) {
    if (!existing.has(modifier.id)) {
      nextModifiers.push(modifier);
    }
  }
  if (nextModifiers.length === nextState.modifiers.length) {
    return nextState;
  }
  return { ...nextState, modifiers: nextModifiers };
};

export const refreshChampionAbilityUsesForRound = (state: GameState): GameState => {
  let changed = false;
  const nextUnits = { ...state.board.units };

  for (const [unitId, unit] of Object.entries(state.board.units)) {
    if (unit.kind !== "champion") {
      continue;
    }
    const resetCounts = getPerRoundAbilityUses(unit.cardDefId);
    if (!resetCounts) {
      continue;
    }
    const nextUses = { ...unit.abilityUses };
    let unitChanged = false;
    for (const [key, count] of Object.entries(resetCounts)) {
      if (nextUses[key]?.remaining !== count) {
        nextUses[key] = { remaining: count };
        unitChanged = true;
      }
    }
    if (unitChanged) {
      nextUnits[unitId] = { ...unit, abilityUses: nextUses };
      changed = true;
    }
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      units: nextUnits
    }
  };
};

export const removeChampionModifiers = (state: GameState, unitIds: UnitID[]): GameState => {
  if (unitIds.length === 0) {
    return state;
  }
  const idSet = new Set(unitIds);
  const nextModifiers = state.modifiers.filter((modifier) => {
    if (modifier.source.type !== "champion") {
      return true;
    }
    const modifierUnitId = getModifierUnitId(modifier);
    if (!modifierUnitId) {
      return true;
    }
    return !idSet.has(modifierUnitId);
  });

  if (nextModifiers.length === state.modifiers.length) {
    return state;
  }
  return { ...state, modifiers: nextModifiers };
};

export const healChampion = (state: GameState, unitId: UnitID, amount: number): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }

  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }

  const nextHp = Math.min(unit.maxHp, unit.hp + amount);
  if (nextHp === unit.hp) {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      units: {
        ...state.board.units,
        [unitId]: {
          ...unit,
          hp: nextHp
        }
      }
    }
  };
};

export const dealChampionDamage = (
  state: GameState,
  sourcePlayerId: PlayerID,
  unitId: UnitID,
  amount: number
): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }

  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }

  const nextHp = unit.hp - amount;
  if (nextHp > 0) {
    return {
      ...state,
      board: {
        ...state.board,
        units: {
          ...state.board.units,
          [unitId]: {
            ...unit,
            hp: nextHp
          }
        }
      }
    };
  }

  const units = { ...state.board.units };
  delete units[unitId];

  let nextState: GameState = {
    ...state,
    board: {
      ...state.board,
      units
    }
  };

  const hex = state.board.hexes[unit.hex];
  if (hex) {
    const updatedHex = {
      ...hex,
      occupants: {
        ...hex.occupants,
        [unit.ownerPlayerId]: (hex.occupants[unit.ownerPlayerId] ?? []).filter(
          (id) => id !== unitId
        )
      }
    };
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        hexes: {
          ...nextState.board.hexes,
          [unit.hex]: updatedHex
        }
      }
    };
  }

  nextState = removeChampionModifiers(nextState, [unitId]);

  if (unit.ownerPlayerId !== sourcePlayerId) {
    nextState = applyChampionKillRewards(nextState, {
      killerPlayerId: sourcePlayerId,
      victimPlayerId: unit.ownerPlayerId,
      killedChampions: [unit],
      bounty: unit.bounty,
      hexKey: unit.hex,
      source: "effect"
    });
  }

  return nextState;
};

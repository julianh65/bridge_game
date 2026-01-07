import { neighborHexKeys, randInt } from "@bridgefront/shared";

import type {
  CardDefId,
  ChampionUnitState,
  GameState,
  Modifier,
  PlayerID,
  UnitID
} from "./types";
import { getBridgeKey } from "./board";
import { applyChampionKillRewards } from "./rewards";
import { getCardsPlayedThisRound } from "./player-flags";
import { addForcesToHex } from "./units";

const BODYGUARD_CHAMPION_ID = "champion.bastion.ironclad_warden";
const ASSASSINS_EDGE_CHAMPION_ID = "champion.veil.shadeblade";
const FLIGHT_CHAMPION_ID = "champion.aerial.skystriker_ace";
const ARCHIVIST_PRIME_CHAMPION_ID = "champion.cipher.archivist_prime";
const WORMHOLE_ARTIFICER_CHAMPION_ID = "champion.gatewright.wormhole_artificer";
const SKIRMISHER_CAPTAIN_CHAMPION_ID = "champion.age1.skirmisher_captain";
const BRIDGE_RUNNER_CHAMPION_ID = "champion.age1.bridge_runner";
const INSPIRING_GEEZER_CHAMPION_ID = "champion.age1.inspiring_geezer";
const FIELD_SURGEON_CHAMPION_ID = "champion.age1.field_surgeon";
const BRUTE_CHAMPION_ID = "champion.age1.brute";
const BOUNTY_HUNTER_CHAMPION_ID = "champion.age1.bounty_hunter";
const TRAITOR_CHAMPION_ID = "champion.age1.traitor";
const DUELIST_EXEMPLAR_CHAMPION_ID = "champion.age2.duelist_exemplar";
const LONE_WOLF_CHAMPION_ID = "champion.age2.lone_wolf";
const RELIABLE_VETERAN_CHAMPION_ID = "champion.age2.reliable_veteran";
const SIEGE_ENGINEER_CHAMPION_ID = "champion.age2.siege_engineer";
const CAPTURER_CHAMPION_ID = "champion.age2.capturer";
const TAX_REAVER_CHAMPION_ID = "champion.age2.tax_reaver";
const BLOOD_BANKER_CHAMPION_ID = "champion.age3.blood_banker";
const STORMCALLER_CHAMPION_ID = "champion.age3.stormcaller";
export const GRAND_STRATEGIST_CHAMPION_ID = "champion.age3.grand_strategist";
const CAPITAL_BREAKER_CHAMPION_ID = "champion.age3.capital_breaker";
const BANNERMAN_CHAMPION_ID = "champion.power.bannerman";
const CENTER_BANNERMAN_CHAMPION_ID = "champion.age3.center_bannerman";

const ASSASSINS_EDGE_KEY = "assassins_edge";
const STITCHWORK_KEY = "stitchwork";
const BLOOD_LEDGER_KEY = "blood_ledger";
const TEMPEST_KEY = "tempest";
export const TACTICAL_HAND_KEY = "tactical_hand";

const BRIDGE_BYPASS_CHAMPION_IDS = new Set([FLIGHT_CHAMPION_ID, BRIDGE_RUNNER_CHAMPION_ID]);

const PER_ROUND_ABILITY_USES: Record<CardDefId, Record<string, number>> = {
  [ASSASSINS_EDGE_CHAMPION_ID]: {
    [ASSASSINS_EDGE_KEY]: 1
  },
  [FIELD_SURGEON_CHAMPION_ID]: {
    [STITCHWORK_KEY]: 1
  },
  [BLOOD_BANKER_CHAMPION_ID]: {
    [BLOOD_LEDGER_KEY]: 1
  },
  [STORMCALLER_CHAMPION_ID]: {
    [TEMPEST_KEY]: 1
  },
  [GRAND_STRATEGIST_CHAMPION_ID]: {
    [TACTICAL_HAND_KEY]: 1
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

export const consumeChampionAbilityUse = (
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

const createBridgeBypassModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID,
  sourceId: CardDefId
): Modifier => ({
  id: buildChampionModifierId(unitId, "bridge_bypass"),
  source: { type: "champion", sourceId },
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
          (unit) => unit?.kind === "champion" && !BRIDGE_BYPASS_CHAMPION_IDS.has(unit.cardDefId)
        )
      ) {
        return current;
      }
      return false;
    }
  }
});

const createArchivistPrimeModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "archivist_prime"),
  source: { type: "champion", sourceId: ARCHIVIST_PRIME_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const bonus = getCardsPlayedThisRound(state, unit.ownerPlayerId);
      return bonus > 0 ? current + bonus : current;
    }
  }
});

const createWormholeArtificerModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "wormhole_artificer"),
  source: { type: "champion", sourceId: WORMHOLE_ARTIFICER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getMoveMaxDistance: ({ modifier, movingUnitIds }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      if (movingUnitIds.length !== 1 || movingUnitIds[0] !== sourceUnitId) {
        return current;
      }
      return current + 1;
    }
  }
});

const createInspiringGeezerModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "inspiring_geezer"),
  source: { type: "champion", sourceId: INSPIRING_GEEZER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getForceHitFaces: ({ modifier, unit, hexKey, state }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});

const createFieldSurgeonModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "stitchwork"),
  source: { type: "champion", sourceId: FIELD_SURGEON_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    afterBattle: ({ state, modifier, hexKey }) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (sourceUnit.hex !== hexKey) {
        return state;
      }
      if (!canChampionUseAbility(sourceUnit, STITCHWORK_KEY)) {
        return state;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return state;
      }
      const candidateIds = (hex.occupants[sourceUnit.ownerPlayerId] ?? [])
        .map((unitId) => {
          const unit = state.board.units[unitId];
          if (!unit || unit.kind !== "champion") {
            return null;
          }
          const missing = unit.maxHp - unit.hp;
          if (missing <= 0) {
            return null;
          }
          return { unitId, missing };
        })
        .filter((entry): entry is { unitId: UnitID; missing: number } => Boolean(entry));
      if (candidateIds.length === 0) {
        return state;
      }

      candidateIds.sort((a, b) => {
        if (a.missing !== b.missing) {
          return b.missing - a.missing;
        }
        return a.unitId.localeCompare(b.unitId);
      });
      const targetId = candidateIds[0]?.unitId;
      if (!targetId) {
        return state;
      }

      let nextState = consumeChampionAbilityUse(state, sourceUnitId, STITCHWORK_KEY);
      nextState = healChampion(nextState, targetId, 2);
      return nextState;
    }
  }
});

const createBruteModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "brute"),
  source: { type: "champion", sourceId: BRUTE_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, hexKey, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return current;
      }
      for (const [playerId, unitIds] of Object.entries(hex.occupants)) {
        if (playerId === unit.ownerPlayerId) {
          continue;
        }
        for (const occupantId of unitIds ?? []) {
          if (state.board.units[occupantId]?.kind === "champion") {
            return current;
          }
        }
      }
      return current + 2;
    }
  }
});

const createDuelistExemplarModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "duelist_exemplar"),
  source: { type: "champion", sourceId: DUELIST_EXEMPLAR_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, hexKey, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return current;
      }
      for (const [playerId, unitIds] of Object.entries(hex.occupants)) {
        if (playerId === unit.ownerPlayerId) {
          continue;
        }
        for (const occupantId of unitIds ?? []) {
          if (state.board.units[occupantId]?.kind === "champion") {
            return current + 1;
          }
        }
      }
      return current;
    }
  }
});

const createLoneWolfModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "lone_wolf"),
  source: { type: "champion", sourceId: LONE_WOLF_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, hexKey, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return current;
      }
      const friendly = hex.occupants[unit.ownerPlayerId] ?? [];
      const hasFriendlyForces = friendly.some(
        (unitId) => state.board.units[unitId]?.kind === "force"
      );
      if (hasFriendlyForces) {
        return current;
      }
      return current + 3;
    }
  }
});

const createReliableVeteranModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "reliable_veteran"),
  source: { type: "champion", sourceId: RELIABLE_VETERAN_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionHitFaces: ({ modifier, unitId: contextUnitId, unit }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      return Math.max(current, 5);
    }
  }
});

const createBountyHunterModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "bounty_hunter"),
  source: { type: "champion", sourceId: BOUNTY_HUNTER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionKillBonusGold: (
      { modifier, state, killerPlayerId, hexKey, source, killedChampions },
      current
    ) => {
      if (source !== "battle") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== killerPlayerId) {
        return current;
      }
      if (killedChampions.length === 0) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      return current + killedChampions.length;
    }
  }
});

const createTaxReaverModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "tax_reaver"),
  source: { type: "champion", sourceId: TAX_REAVER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionKillStealGold: (
      { modifier, state, killerPlayerId, hexKey, source, killedChampions },
      current
    ) => {
      if (source !== "battle") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== killerPlayerId) {
        return current;
      }
      if (killedChampions.length === 0) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      return current + killedChampions.length * 2;
    }
  }
});

const createCapturerModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "capturer"),
  source: { type: "champion", sourceId: CAPTURER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    afterBattle: ({ state, modifier, winnerPlayerId, hexKey, attackers, defenders }) => {
      const ownerId = modifier.ownerPlayerId;
      if (!ownerId || winnerPlayerId !== ownerId) {
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
      if (sourceUnit.hex !== hexKey) {
        return state;
      }
      if (![...attackers, ...defenders].includes(sourceUnitId)) {
        return state;
      }
      return {
        ...state,
        board: addForcesToHex(state.board, ownerId, hexKey, 1)
      };
    }
  }
});

const createStormcallerModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "stormcaller"),
  source: { type: "champion", sourceId: STORMCALLER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    beforeCombatRound: ({ state, modifier, attackers, defenders }) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (!canChampionUseAbility(sourceUnit, TEMPEST_KEY)) {
        return state;
      }
      if (![...attackers, ...defenders].includes(sourceUnitId)) {
        return state;
      }

      const neighborKeys = neighborHexKeys(sourceUnit.hex).filter(
        (key) => Boolean(state.board.hexes[key])
      );
      if (neighborKeys.length === 0) {
        return state;
      }

      const targetIds: UnitID[] = [];
      for (const hexKey of neighborKeys) {
        const hex = state.board.hexes[hexKey];
        if (!hex) {
          continue;
        }
        for (const [playerId, unitIds] of Object.entries(hex.occupants)) {
          if (playerId === sourceUnit.ownerPlayerId) {
            continue;
          }
          for (const targetId of unitIds ?? []) {
            const unit = state.board.units[targetId];
            if (unit?.kind === "champion") {
              targetIds.push(targetId);
            }
          }
        }
      }

      if (targetIds.length === 0) {
        return state;
      }

      let nextState = consumeChampionAbilityUse(state, sourceUnitId, TEMPEST_KEY);
      for (const targetId of targetIds) {
        nextState = dealChampionDamage(nextState, sourceUnit.ownerPlayerId, targetId, 1);
      }
      return nextState;
    }
  }
});

const createCapitalBreakerModifier = (
  unitId: UnitID,
  ownerPlayerId: PlayerID
): Modifier => ({
  id: buildChampionModifierId(unitId, "capital_breaker"),
  source: { type: "champion", sourceId: CAPITAL_BREAKER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getForceHitFaces: ({ modifier, unit, hexKey, state, round }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (round !== 1) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || hex.tile !== "capital") {
        return current;
      }
      if (!hex.ownerPlayerId || hex.ownerPlayerId === unit.ownerPlayerId) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});

const createBannermanModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "bannerman"),
  source: { type: "champion", sourceId: BANNERMAN_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getControlBonus: ({ modifier, state, playerId }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== playerId) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      return current + 1;
    }
  }
});

const createCenterBannermanModifier = (unitId: UnitID, ownerPlayerId: PlayerID): Modifier => ({
  id: buildChampionModifierId(unitId, "center_bannerman"),
  source: { type: "champion", sourceId: CENTER_BANNERMAN_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getControlBonus: ({ modifier, state, playerId }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== playerId) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      const hex = state.board.hexes[sourceUnit.hex];
      if (!hex || hex.tile !== "center") {
        return current;
      }
      return current + 1;
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
      return [createBridgeBypassModifier(unitId, ownerPlayerId, cardDefId)];
    case ARCHIVIST_PRIME_CHAMPION_ID:
      return [createArchivistPrimeModifier(unitId, ownerPlayerId)];
    case WORMHOLE_ARTIFICER_CHAMPION_ID:
      return [createWormholeArtificerModifier(unitId, ownerPlayerId)];
    case BRIDGE_RUNNER_CHAMPION_ID:
      return [createBridgeBypassModifier(unitId, ownerPlayerId, cardDefId)];
    case INSPIRING_GEEZER_CHAMPION_ID:
      return [createInspiringGeezerModifier(unitId, ownerPlayerId)];
    case FIELD_SURGEON_CHAMPION_ID:
      return [createFieldSurgeonModifier(unitId, ownerPlayerId)];
    case BRUTE_CHAMPION_ID:
      return [createBruteModifier(unitId, ownerPlayerId)];
    case DUELIST_EXEMPLAR_CHAMPION_ID:
      return [createDuelistExemplarModifier(unitId, ownerPlayerId)];
    case LONE_WOLF_CHAMPION_ID:
      return [createLoneWolfModifier(unitId, ownerPlayerId)];
    case RELIABLE_VETERAN_CHAMPION_ID:
      return [createReliableVeteranModifier(unitId, ownerPlayerId)];
    case BOUNTY_HUNTER_CHAMPION_ID:
      return [createBountyHunterModifier(unitId, ownerPlayerId)];
    case TAX_REAVER_CHAMPION_ID:
      return [createTaxReaverModifier(unitId, ownerPlayerId)];
    case CAPTURER_CHAMPION_ID:
      return [createCapturerModifier(unitId, ownerPlayerId)];
    case STORMCALLER_CHAMPION_ID:
      return [createStormcallerModifier(unitId, ownerPlayerId)];
    case CAPITAL_BREAKER_CHAMPION_ID:
      return [createCapitalBreakerModifier(unitId, ownerPlayerId)];
    case BANNERMAN_CHAMPION_ID:
      return [createBannermanModifier(unitId, ownerPlayerId)];
    case CENTER_BANNERMAN_CHAMPION_ID:
      return [createCenterBannermanModifier(unitId, ownerPlayerId)];
    default:
      return [];
  }
};

const getDeployForcesOnChampionDeploy = (cardDefId: CardDefId): number => {
  switch (cardDefId) {
    case SKIRMISHER_CAPTAIN_CHAMPION_ID:
      return 1;
    default:
      return 0;
  }
};

const getAdjacentBridgeKeys = (state: GameState, hexKey: string): string[] => {
  const neighbors = neighborHexKeys(hexKey).filter((key) => Boolean(state.board.hexes[key]));
  const bridgeKeys: string[] = [];
  for (const neighbor of neighbors) {
    const edgeKey = getBridgeKey(hexKey, neighbor);
    if (state.board.bridges[edgeKey]) {
      bridgeKeys.push(edgeKey);
    }
  }
  return bridgeKeys;
};

const destroyAdjacentBridgeOnDeploy = (
  state: GameState,
  unitId: UnitID,
  cardDefId: CardDefId
): GameState => {
  if (cardDefId !== SIEGE_ENGINEER_CHAMPION_ID) {
    return state;
  }
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  const bridgeKeys = getAdjacentBridgeKeys(state, unit.hex);
  if (bridgeKeys.length === 0) {
    return state;
  }
  const pick = randInt(state.rngState, 0, bridgeKeys.length - 1);
  const edgeKey = bridgeKeys[pick.value] ?? bridgeKeys[0];
  if (!edgeKey || !state.board.bridges[edgeKey]) {
    return { ...state, rngState: pick.next };
  }
  const { [edgeKey]: _removed, ...bridges } = state.board.bridges;
  return {
    ...state,
    rngState: pick.next,
    board: {
      ...state.board,
      bridges
    }
  };
};

const applyChampionOnDeploy = (
  state: GameState,
  unitId: UnitID,
  cardDefId: CardDefId,
  ownerPlayerId: PlayerID
): GameState => {
  let nextState = state;
  const forceCount = getDeployForcesOnChampionDeploy(cardDefId);
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return nextState;
  }
  if (forceCount > 0) {
    nextState = {
      ...nextState,
      board: addForcesToHex(nextState.board, ownerPlayerId, unit.hex, forceCount)
    };
  }
  return destroyAdjacentBridgeOnDeploy(nextState, unitId, cardDefId);
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
    return applyChampionOnDeploy(nextState, unitId, cardDefId, ownerPlayerId);
  }
  const existing = new Set(nextState.modifiers.map((modifier) => modifier.id));
  const nextModifiers = [...nextState.modifiers];
  for (const modifier of modifiers) {
    if (!existing.has(modifier.id)) {
      nextModifiers.push(modifier);
    }
  }
  if (nextModifiers.length === nextState.modifiers.length) {
    return applyChampionOnDeploy(nextState, unitId, cardDefId, ownerPlayerId);
  }
  nextState = { ...nextState, modifiers: nextModifiers };
  return applyChampionOnDeploy(nextState, unitId, cardDefId, ownerPlayerId);
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

const setPlayerMana = (state: GameState, playerId: PlayerID, mana: number): GameState => {
  let changed = false;
  const players = state.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }
    if (player.resources.mana === mana) {
      return player;
    }
    changed = true;
    return {
      ...player,
      resources: {
        ...player.resources,
        mana
      }
    };
  });

  return changed ? { ...state, players } : state;
};

const addGold = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (amount <= 0) {
    return state;
  }
  let changed = false;
  const players = state.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }
    changed = true;
    return {
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold + amount
      }
    };
  });
  return changed ? { ...state, players } : state;
};

export const applyChampionDeathEffects = (
  state: GameState,
  killedChampions: ChampionUnitState[]
): GameState => {
  if (killedChampions.length === 0) {
    return state;
  }

  let nextState = state;
  for (const champion of killedChampions) {
    if (champion.cardDefId !== TRAITOR_CHAMPION_ID) {
      continue;
    }
    nextState = setPlayerMana(nextState, champion.ownerPlayerId, 0);
  }

  for (const champion of killedChampions) {
    const hex = nextState.board.hexes[champion.hex];
    if (!hex) {
      continue;
    }
    const occupantGroups = Object.values(hex.occupants);
    for (const unitIds of occupantGroups) {
      for (const unitId of unitIds ?? []) {
        const unit = nextState.board.units[unitId];
        if (!unit || unit.kind !== "champion") {
          continue;
        }
        if (unit.cardDefId !== BLOOD_BANKER_CHAMPION_ID) {
          continue;
        }
        if (!canChampionUseAbility(unit, BLOOD_LEDGER_KEY)) {
          continue;
        }
        nextState = consumeChampionAbilityUse(nextState, unitId, BLOOD_LEDGER_KEY);
        nextState = addGold(nextState, unit.ownerPlayerId, 2);
      }
    }
  }

  return nextState;
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
  nextState = applyChampionDeathEffects(nextState, [unit]);

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

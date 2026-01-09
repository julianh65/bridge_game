import type { CardDef } from "./content/cards";
import type { CardPlayTargets, GameState, Modifier, PlayerID } from "./types";
import { axialDistance, parseHexKey } from "@bridgefront/shared";

import { countPlayersOnHex, hasEnemyUnits, isOccupiedByPlayer } from "./board";
import {
  getChampionTargetId,
  getHexKeyTarget,
  getTargetRecord,
  type TargetRecord
} from "./card-effects-targets";

const isWithinDistance = (from: string, to: string, maxDistance: number): boolean => {
  if (!Number.isFinite(maxDistance) || maxDistance < 0) {
    return false;
  }
  try {
    return axialDistance(parseHexKey(from), parseHexKey(to)) <= maxDistance;
  } catch {
    return false;
  }
};

export const hasFriendlyChampionWithinRange = (
  state: GameState,
  playerId: PlayerID,
  targetHex: string,
  maxDistance: number
): boolean => {
  return Object.values(state.board.units).some(
    (unit) =>
      unit.kind === "champion" &&
      unit.ownerPlayerId === playerId &&
      isWithinDistance(unit.hex, targetHex, maxDistance)
  );
};

export const hasFriendlyForceWithinRange = (
  state: GameState,
  playerId: PlayerID,
  targetHex: string,
  maxDistance: number
): boolean => {
  return Object.values(state.board.units).some(
    (unit) =>
      unit.kind === "force" &&
      unit.ownerPlayerId === playerId &&
      isWithinDistance(unit.hex, targetHex, maxDistance)
  );
};

type TargetingGuard = {
  blockEnemyCards: boolean;
  blockEnemySpells: boolean;
  scope: "attachedUnit" | "ownerChampions";
};

const isModifierActive = (modifier: Modifier): boolean => {
  if (modifier.duration.type === "uses") {
    return modifier.duration.remaining > 0;
  }
  return true;
};

const getTargetingGuard = (modifier: Modifier): TargetingGuard | null => {
  if (!isModifierActive(modifier)) {
    return null;
  }
  const raw = modifier.data?.targeting;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const blockEnemyCards = record.blockEnemyCards === true;
  const blockEnemySpells = record.blockEnemySpells === true;
  if (!blockEnemyCards && !blockEnemySpells) {
    return null;
  }
  const scope = record.scope === "ownerChampions" ? "ownerChampions" : "attachedUnit";
  return { blockEnemyCards, blockEnemySpells, scope };
};

const guardAppliesToChampion = (
  modifier: Modifier,
  guard: TargetingGuard,
  unitId: string,
  unitOwnerId: PlayerID
): boolean => {
  if (guard.scope === "ownerChampions") {
    return modifier.ownerPlayerId === unitOwnerId;
  }
  return modifier.attachedUnitId === unitId;
};

const isChampionTargetableByCard = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  unit: GameState["board"]["units"][string]
): boolean => {
  if (playerId === unit.ownerPlayerId) {
    return true;
  }
  const isSpell = card.type === "Spell";

  for (const modifier of state.modifiers) {
    const guard = getTargetingGuard(modifier);
    if (!guard) {
      continue;
    }
    if (!guardAppliesToChampion(modifier, guard, unit.id, unit.ownerPlayerId)) {
      continue;
    }
    if (guard.blockEnemyCards) {
      return false;
    }
    if (guard.blockEnemySpells && isSpell) {
      return false;
    }
  }

  return true;
};

export const getChampionTarget = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets,
  card?: CardDef
): { unitId: string; unit: GameState["board"]["units"][string] } | null => {
  const unitId = getChampionTargetId(targets);
  if (!unitId) {
    return null;
  }

  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return null;
  }

  if (!state.board.hexes[unit.hex]) {
    return null;
  }

  const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
  if (owner !== "self" && owner !== "enemy" && owner !== "any") {
    return null;
  }
  if (owner === "self" && unit.ownerPlayerId !== playerId) {
    return null;
  }
  if (owner === "enemy" && unit.ownerPlayerId === playerId) {
    return null;
  }

  if (targetSpec.requiresFriendlyChampion === true) {
    const maxDistance =
      typeof targetSpec.maxDistance === "number" ? targetSpec.maxDistance : NaN;
    if (!hasFriendlyChampionWithinRange(state, playerId, unit.hex, maxDistance)) {
      return null;
    }
  }

  if (card && !isChampionTargetableByCard(state, playerId, card, unit)) {
    return null;
  }

  return { unitId, unit };
};

const resolveHexTarget = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  hexKey: string
): { hexKey: string; hex: GameState["board"]["hexes"][string] } | null => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return null;
  }

  const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
  if (owner !== "self" && owner !== "enemy" && owner !== "any") {
    return null;
  }
  const allowEmpty = targetSpec.allowEmpty === true;
  const requiresEmpty = targetSpec.requiresEmpty === true;
  const isEmpty = countPlayersOnHex(hex) === 0;

  if (owner === "self" && !isOccupiedByPlayer(hex, playerId)) {
    if (!(allowEmpty || requiresEmpty) || !isEmpty) {
      return null;
    }
  }

  if (owner === "enemy" && !hasEnemyUnits(hex, playerId)) {
    return null;
  }

  const requiresOccupied = targetSpec.occupied === true;
  if (requiresOccupied && isEmpty) {
    return null;
  }

  const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
  if (tile && hex.tile !== tile) {
    return null;
  }

  if (targetSpec.allowCapital === false && hex.tile === "capital") {
    return null;
  }

  if (requiresEmpty && !isEmpty) {
    return null;
  }

  const maxDistanceFromCapital =
    typeof targetSpec.maxDistanceFromCapital === "number"
      ? targetSpec.maxDistanceFromCapital
      : NaN;
  if (Number.isFinite(maxDistanceFromCapital)) {
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      return null;
    }
    if (!state.board.hexes[player.capitalHex]) {
      return null;
    }
    if (!isWithinDistance(player.capitalHex, hexKey, maxDistanceFromCapital)) {
      return null;
    }
  }

  const maxDistance =
    typeof targetSpec.maxDistanceFromFriendlyChampion === "number"
      ? targetSpec.maxDistanceFromFriendlyChampion
      : NaN;
  if (Number.isFinite(maxDistance)) {
    if (!hasFriendlyChampionWithinRange(state, playerId, hexKey, maxDistance)) {
      return null;
    }
  }

  return { hexKey, hex };
};

export const getHexTarget = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): { hexKey: string; hex: GameState["board"]["hexes"][string] } | null => {
  const hexKey = getHexKeyTarget(targets);
  if (!hexKey) {
    return null;
  }
  return resolveHexTarget(state, playerId, targetSpec, hexKey);
};

export const getHexPairTarget = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): { from: string; to: string } | null => {
  const record = getTargetRecord(targets);
  const explicitKeys = Array.isArray(record?.hexKeys) ? record?.hexKeys : null;
  const rawKeys =
    explicitKeys && explicitKeys.length > 0
      ? explicitKeys
      : typeof record?.from === "string" && typeof record?.to === "string"
        ? [record.from, record.to]
        : null;
  if (!rawKeys || rawKeys.length !== 2) {
    return null;
  }
  const [rawFrom, rawTo] = rawKeys;
  if (typeof rawFrom !== "string" || typeof rawTo !== "string") {
    return null;
  }
  if (rawFrom.length === 0 || rawTo.length === 0) {
    return null;
  }
  const allowSame = targetSpec.allowSame === true;
  if (!allowSame && rawFrom === rawTo) {
    return null;
  }
  const fromTarget = resolveHexTarget(state, playerId, targetSpec, rawFrom);
  if (!fromTarget) {
    return null;
  }
  const toTarget = resolveHexTarget(state, playerId, targetSpec, rawTo);
  if (!toTarget) {
    return null;
  }
  return { from: fromTarget.hexKey, to: toTarget.hexKey };
};

import type { CardDef } from "./content/cards";
import { areAdjacent, axialDistance, parseEdgeKey, parseHexKey } from "@bridgefront/shared";

import type { CardPlayTargets, GameState, Modifier, PlayerID, TileType } from "./types";
import {
  countPlayersOnHex,
  getBridgeKey,
  hasBridge,
  hasEnemyUnits,
  isOccupiedByPlayer,
  wouldExceedTwoPlayers
} from "./board";
import {
  addCardToDiscardPile,
  addCardToHandWithOverflow,
  drawCards,
  takeTopCards,
  topdeckCardFromHand
} from "./cards";
import { applyChampionDeployment, dealChampionDamage, healChampion } from "./champions";
import {
  addChampionToHex,
  addForcesToHex,
  countPlayerChampions,
  selectMovingUnits
} from "./units";
import {
  getDeployForcesCount,
  getMoveAdjacency,
  getMoveMaxDistance,
  getMoveRequiresBridge
} from "./modifiers";
import { resolveCapitalDeployHex } from "./deploy-utils";
import { markPlayerMovedThisRound } from "./player-flags";

const SUPPORTED_TARGET_KINDS = new Set(["none", "edge", "stack", "path", "champion", "choice", "hex"]);
const SUPPORTED_EFFECTS = new Set([
  "gainGold",
  "drawCards",
  "scoutReport",
  "prospecting",
  "buildBridge",
  "moveStack",
  "deployForces",
  "increaseMineValue",
  "healChampion",
  "dealChampionDamage",
  "patchUp",
  "recruit",
  "holdTheLine",
  "markForCoin",
  "topdeckFromHand",
  "ward",
  "immunityField",
  "lockBridge"
]);

type TargetRecord = Record<string, unknown>;

type BuildBridgePlan = {
  from: string;
  to: string;
  key: string;
};

type MoveValidation = {
  maxDistance?: number;
  requiresBridge: boolean;
  requireStartOccupied: boolean;
  forceCount?: number;
};

const getTargetRecord = (targets: CardPlayTargets): TargetRecord | null => {
  if (!targets || typeof targets !== "object") {
    return null;
  }
  return targets as TargetRecord;
};

const getForceCountTarget = (targets: CardPlayTargets): number | null => {
  const record = getTargetRecord(targets);
  const forceCount = record?.forceCount;
  return typeof forceCount === "number" && Number.isFinite(forceCount) ? forceCount : null;
};

const getMoveStackForceCount = (
  card: CardDef,
  effect?: TargetRecord,
  targets?: CardPlayTargets
): number | undefined => {
  const targetCount = getForceCountTarget(targets ?? null);
  if (targetCount !== null) {
    return targetCount;
  }
  const effectCount = effect?.forceCount;
  if (typeof effectCount === "number") {
    return effectCount;
  }
  const specCount = (card.targetSpec as TargetRecord | undefined)?.forceCount;
  if (typeof specCount === "number") {
    return specCount;
  }
  return undefined;
};

const getEdgeKeyTarget = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const edgeKey = record?.edgeKey;
  return typeof edgeKey === "string" && edgeKey.length > 0 ? edgeKey : null;
};

const getHexKeyTarget = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const hexKey = record?.hexKey;
  return typeof hexKey === "string" && hexKey.length > 0 ? hexKey : null;
};

const getPathTarget = (targets: CardPlayTargets): string[] | null => {
  const record = getTargetRecord(targets);
  const path = record?.path;
  if (!Array.isArray(path) || path.length < 2) {
    return null;
  }
  if (!path.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return null;
  }
  return path;
};

const getStackTarget = (targets: CardPlayTargets): { from: string; to: string } | null => {
  const record = getTargetRecord(targets);
  const from = record?.from;
  const to = record?.to;
  if (typeof from !== "string" || typeof to !== "string") {
    return null;
  }
  if (from.length === 0 || to.length === 0) {
    return null;
  }
  return { from, to };
};

const getMovePathTarget = (targets: CardPlayTargets): string[] | null => {
  const path = getPathTarget(targets);
  if (path) {
    return path;
  }
  const stack = getStackTarget(targets);
  if (!stack) {
    return null;
  }
  return [stack.from, stack.to];
};

const getChoiceTarget = (
  targets: CardPlayTargets
):
  | { kind: "capital"; hexKey?: string }
  | { kind: "occupiedHex"; hexKey: string }
  | null => {
  const record = getTargetRecord(targets);
  const choice = record?.choice ?? record?.kind;
  if (choice === "capital") {
    const hexKey = record?.hexKey;
    if (typeof hexKey === "string" && hexKey.length > 0) {
      return { kind: "capital", hexKey };
    }
    return { kind: "capital" };
  }
  if (choice === "occupiedHex") {
    const hexKey = record?.hexKey;
    if (typeof hexKey !== "string" || hexKey.length === 0) {
      return null;
    }
    return { kind: "occupiedHex", hexKey };
  }
  return null;
};

const getChampionTargetId = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const unitId = record?.unitId ?? record?.championId;
  return typeof unitId === "string" && unitId.length > 0 ? unitId : null;
};

const getCardInstanceTargets = (targets: CardPlayTargets): string[] => {
  const record = getTargetRecord(targets);
  const ids = record?.cardInstanceIds;
  if (Array.isArray(ids)) {
    return ids.filter((entry) => typeof entry === "string" && entry.length > 0);
  }
  const id = record?.cardInstanceId;
  return typeof id === "string" && id.length > 0 ? [id] : [];
};

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

const hasFriendlyChampionWithinRange = (
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

const getChampionTarget = (
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

const getHexTarget = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): { hexKey: string; hex: GameState["board"]["hexes"][string] } | null => {
  const hexKey = getHexKeyTarget(targets);
  if (!hexKey) {
    return null;
  }

  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return null;
  }

  const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
  if (owner !== "self" && owner !== "enemy" && owner !== "any") {
    return null;
  }

  if (owner === "self" && !isOccupiedByPlayer(hex, playerId)) {
    return null;
  }

  if (owner === "enemy" && !hasEnemyUnits(hex, playerId)) {
    return null;
  }

  const requiresOccupied = targetSpec.occupied === true;
  if (requiresOccupied && countPlayersOnHex(hex) === 0) {
    return null;
  }

  const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
  if (tile && hex.tile !== tile) {
    return null;
  }

  if (targetSpec.allowCapital === false && hex.tile === "capital") {
    return null;
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

const getBuildBridgePlan = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): BuildBridgePlan | null => {
  const edgeKey = getEdgeKeyTarget(targets);
  if (!edgeKey) {
    return null;
  }

  let rawA: string;
  let rawB: string;
  try {
    [rawA, rawB] = parseEdgeKey(edgeKey);
  } catch {
    return null;
  }

  const fromHex = state.board.hexes[rawA];
  const toHex = state.board.hexes[rawB];
  if (!fromHex || !toHex) {
    return null;
  }

  try {
    if (!areAdjacent(parseHexKey(rawA), parseHexKey(rawB))) {
      return null;
    }
  } catch {
    return null;
  }

  const canonicalKey = getBridgeKey(rawA, rawB);
  if (state.board.bridges[canonicalKey]) {
    return null;
  }

  const allowAnywhere = targetSpec.anywhere === true;
  const requiresOccupiedEndpoint = allowAnywhere ? false : targetSpec.requiresOccupiedEndpoint !== false;
  if (
    requiresOccupiedEndpoint &&
    !isOccupiedByPlayer(fromHex, playerId) &&
    !isOccupiedByPlayer(toHex, playerId)
  ) {
    return null;
  }

  return { from: rawA, to: rawB, key: canonicalKey };
};

const getExistingBridgePlan = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): BuildBridgePlan | null => {
  const edgeKey = getEdgeKeyTarget(targets);
  if (!edgeKey) {
    return null;
  }

  let rawA: string;
  let rawB: string;
  try {
    [rawA, rawB] = parseEdgeKey(edgeKey);
  } catch {
    return null;
  }

  const fromHex = state.board.hexes[rawA];
  const toHex = state.board.hexes[rawB];
  if (!fromHex || !toHex) {
    return null;
  }

  try {
    if (!areAdjacent(parseHexKey(rawA), parseHexKey(rawB))) {
      return null;
    }
  } catch {
    return null;
  }

  const canonicalKey = getBridgeKey(rawA, rawB);
  if (!state.board.bridges[canonicalKey]) {
    return null;
  }

  const allowAnywhere = targetSpec.anywhere === true;
  const requiresOccupiedEndpoint = allowAnywhere ? false : targetSpec.requiresOccupiedEndpoint !== false;
  if (
    requiresOccupiedEndpoint &&
    !isOccupiedByPlayer(fromHex, playerId) &&
    !isOccupiedByPlayer(toHex, playerId)
  ) {
    return null;
  }

  return { from: rawA, to: rawB, key: canonicalKey };
};

export const validateMovePath = (
  state: GameState,
  playerId: PlayerID,
  path: string[],
  options: MoveValidation
): string[] | null => {
  if (path.length < 2) {
    return null;
  }

  for (const hexKey of path) {
    if (!state.board.hexes[hexKey]) {
      return null;
    }
  }

  const movingUnitIds = selectMovingUnits(state.board, playerId, path[0], options.forceCount);
  if (options.requireStartOccupied && movingUnitIds.length === 0) {
    return null;
  }
  let maxDistance = options.maxDistance;
  if (typeof maxDistance === "number") {
    maxDistance = getMoveMaxDistance(
      state,
      {
        playerId,
        from: path[0],
        to: path[path.length - 1],
        path,
        movingUnitIds
      },
      maxDistance
    );
    if (maxDistance <= 0 || path.length - 1 > maxDistance) {
      return null;
    }
  }
  const requiresBridge = getMoveRequiresBridge(
    state,
    {
      playerId,
      from: path[0],
      to: path[path.length - 1],
      path,
      movingUnitIds
    },
    options.requiresBridge
  );

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    let baseAdjacent = false;
    try {
      baseAdjacent = areAdjacent(parseHexKey(from), parseHexKey(to));
    } catch {
      return null;
    }
    const isAdjacent = getMoveAdjacency(
      state,
      { playerId, from, to, path, movingUnitIds },
      baseAdjacent
    );
    if (!isAdjacent) {
      return null;
    }
    if (requiresBridge && baseAdjacent && !hasBridge(state.board, from, to)) {
      return null;
    }
    if (index < path.length - 2) {
      const hex = state.board.hexes[to];
      if (hex && hasEnemyUnits(hex, playerId)) {
        return null;
      }
    }
  }

  const destination = state.board.hexes[path[path.length - 1]];
  if (destination && wouldExceedTwoPlayers(destination, playerId)) {
    return null;
  }

  return path;
};

const moveUnits = (
  state: GameState,
  playerId: PlayerID,
  unitIds: string[],
  from: string,
  to: string
): GameState => {
  if (unitIds.length === 0 || from === to) {
    return state;
  }

  const fromHex = state.board.hexes[from];
  const toHex = state.board.hexes[to];
  if (!fromHex || !toHex) {
    return state;
  }

  const movingSet = new Set(unitIds);
  const fromUnits = fromHex.occupants[playerId] ?? [];
  const movingUnits = fromUnits.filter((unitId) => movingSet.has(unitId));
  if (movingUnits.length === 0) {
    return state;
  }

  const remainingUnits = fromUnits.filter((unitId) => !movingSet.has(unitId));
  const toUnits = [...(toHex.occupants[playerId] ?? []), ...movingUnits];

  const units = { ...state.board.units };
  for (const unitId of movingUnits) {
    const unit = units[unitId];
    if (!unit) {
      continue;
    }
    units[unitId] = {
      ...unit,
      hex: to
    };
  }

  return {
    ...state,
    board: {
      ...state.board,
      units,
      hexes: {
        ...state.board.hexes,
        [from]: {
          ...fromHex,
          occupants: {
            ...fromHex.occupants,
            [playerId]: remainingUnits
          }
        },
        [to]: {
          ...toHex,
          occupants: {
            ...toHex.occupants,
            [playerId]: toUnits
          }
        }
      }
    }
  };
};

const moveUnitsAlongPath = (
  state: GameState,
  playerId: PlayerID,
  path: string[],
  forceCount?: number
): GameState => {
  const movingUnitIds = selectMovingUnits(state.board, playerId, path[0], forceCount);
  if (movingUnitIds.length === 0) {
    return state;
  }

  let nextState = state;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    nextState = moveUnits(nextState, playerId, movingUnitIds, from, to);
  }

  return nextState;
};

export const isCardPlayable = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  targets?: CardPlayTargets
): boolean => {
  if (!SUPPORTED_TARGET_KINDS.has(card.targetSpec.kind)) {
    return false;
  }

  const hasEffects = Array.isArray(card.effects) && card.effects.length > 0;
  const isChampionCard = card.type === "Champion";
  if (!isChampionCard && !hasEffects) {
    return false;
  }
  if (hasEffects && !card.effects?.every((effect) => SUPPORTED_EFFECTS.has(effect.kind))) {
    return false;
  }
  if (isChampionCard) {
    if (!card.champion) {
      return false;
    }
    if (countPlayerChampions(state.board, playerId) >= state.config.CHAMPION_LIMIT) {
      return false;
    }
  }

  if (card.targetSpec.kind === "none") {
    if (targets == null) {
      return true;
    }
    const canTopdeck = card.effects?.some((effect) => effect.kind === "topdeckFromHand");
    if (!canTopdeck) {
      return false;
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) {
      return false;
    }
    const targetIds = getCardInstanceTargets(targets);
    if (targetIds.length === 0) {
      return false;
    }
    return targetIds.every((id) => player.deck.hand.includes(id));
  }

  if (card.targetSpec.kind === "hex") {
    const target = getHexTarget(
      state,
      playerId,
      card.targetSpec as TargetRecord,
      targets ?? null
    );
    if (!target) {
      return false;
    }
    if (card.effects?.some((effect) => effect.kind === "deployForces")) {
      return !wouldExceedTwoPlayers(target.hex, playerId);
    }
    return true;
  }

  if (card.targetSpec.kind === "edge") {
    const hasBuildBridge = card.effects?.some((effect) => effect.kind === "buildBridge") ?? false;
    const hasLockBridge = card.effects?.some((effect) => effect.kind === "lockBridge") ?? false;
    const plan = hasBuildBridge
      ? getBuildBridgePlan(state, playerId, card.targetSpec as TargetRecord, targets ?? null)
      : hasLockBridge
        ? getExistingBridgePlan(state, playerId, card.targetSpec as TargetRecord, targets ?? null)
        : getBuildBridgePlan(state, playerId, card.targetSpec as TargetRecord, targets ?? null);
    if (!plan) {
      return false;
    }

    if (!hasBuildBridge) {
      return true;
    }

    const movePath = getMovePathTarget(targets ?? null);
    if (!movePath) {
      return true;
    }

    const moveEffect = card.effects?.find(
      (effect) => effect.kind === "moveStack"
    ) as TargetRecord | undefined;
    if (!moveEffect) {
      return true;
    }

    const maxDistance =
      typeof moveEffect.maxDistance === "number"
        ? moveEffect.maxDistance
        : typeof card.targetSpec.maxDistance === "number"
          ? card.targetSpec.maxDistance
          : undefined;
    const requiresBridge =
      moveEffect.requiresBridge === false ? false : card.targetSpec.requiresBridge !== false;
    const forceCount = getMoveStackForceCount(card, moveEffect, targets ?? null);

    let moveState = state;
    if (card.effects?.some((effect) => effect.kind === "buildBridge")) {
      moveState = {
        ...state,
        board: {
          ...state.board,
          bridges: {
            ...state.board.bridges,
            [plan.key]: {
              key: plan.key,
              from: plan.from,
              to: plan.to
            }
          }
        }
      };
    }

    return Boolean(
      validateMovePath(moveState, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        forceCount
      })
    );
  }

  if (card.targetSpec.kind === "stack" || card.targetSpec.kind === "path") {
    const owner = typeof card.targetSpec.owner === "string" ? card.targetSpec.owner : "self";
    if (owner !== "self") {
      return false;
    }
    const movePath = getMovePathTarget(targets ?? null);
    if (!movePath) {
      return false;
    }
    const maxDistance =
      typeof card.targetSpec.maxDistance === "number" ? card.targetSpec.maxDistance : undefined;
    const requiresBridge = card.targetSpec.requiresBridge !== false;
    const moveEffect = card.effects?.find(
      (effect) => effect.kind === "moveStack"
    ) as TargetRecord | undefined;
    const forceCount = getMoveStackForceCount(card, moveEffect, targets ?? null);
    return Boolean(
      validateMovePath(state, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        forceCount
      })
    );
  }

  if (card.targetSpec.kind === "champion") {
    return Boolean(
      getChampionTarget(state, playerId, card.targetSpec as TargetRecord, targets ?? null, card)
    );
  }

  if (card.targetSpec.kind === "choice") {
    const choice = getChoiceTarget(targets ?? null);
    if (!choice) {
      return false;
    }
    const options = Array.isArray(card.targetSpec.options)
      ? (card.targetSpec.options as TargetRecord[])
      : [];
    if (!options.some((option) => option.kind === choice.kind)) {
      return false;
    }

    if (choice.kind === "capital") {
      return Boolean(resolveCapitalDeployHex(state, playerId, choice.hexKey ?? null));
    }

    if (choice.kind === "occupiedHex") {
      const hex = state.board.hexes[choice.hexKey];
      if (!hex) {
        return false;
      }
      if (!isOccupiedByPlayer(hex, playerId)) {
        return false;
      }
      return !wouldExceedTwoPlayers(hex, playerId);
    }
  }

  return false;
};

const addGold = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
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

const playerOccupiesTile = (
  state: GameState,
  playerId: PlayerID,
  tileType: TileType
): boolean => {
  return Object.values(state.board.hexes).some(
    (hex) => hex.tile === tileType && (hex.occupants[playerId]?.length ?? 0) > 0
  );
};

export const resolveCardEffects = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  targets?: CardPlayTargets
): GameState => {
  let nextState = state;

  if (card.type === "Champion" && card.champion) {
    const target = getHexTarget(
      nextState,
      playerId,
      card.targetSpec as TargetRecord,
      targets ?? null
    );
    if (target) {
      const deployed = addChampionToHex(nextState.board, playerId, target.hexKey, {
        cardDefId: card.id,
        hp: card.champion.hp,
        attackDice: card.champion.attackDice,
        hitFaces: card.champion.hitFaces,
        bounty: card.champion.bounty
      });
      nextState = {
        ...nextState,
        board: deployed.board
      };
      nextState = applyChampionDeployment(nextState, deployed.unitId, card.id, playerId);
    }
  }

  for (const effect of card.effects ?? []) {
    switch (effect.kind) {
      case "gainGold": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = addGold(nextState, playerId, amount);
        break;
      }
      case "drawCards": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        nextState = drawCards(nextState, playerId, count);
        break;
      }
      case "topdeckFromHand": {
        const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 1;
        if (count <= 0) {
          break;
        }
        const targetIds = getCardInstanceTargets(targets ?? null);
        if (targetIds.length === 0) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        const validTargets = targetIds.filter((id) => player.deck.hand.includes(id));
        if (validTargets.length === 0) {
          break;
        }
        for (const cardInstanceId of validTargets.slice(0, count)) {
          nextState = topdeckCardFromHand(nextState, playerId, cardInstanceId);
        }
        break;
      }
      case "scoutReport": {
        const lookCount = Math.max(0, Number(effect.lookCount) || 0);
        const keepCount = Math.max(0, Number(effect.keepCount) || 0);
        if (lookCount <= 0) {
          break;
        }
        const taken = takeTopCards(nextState, playerId, lookCount);
        nextState = taken.state;
        const keep = taken.cards.slice(0, keepCount);
        const discard = taken.cards.slice(keepCount);
        for (const cardId of keep) {
          nextState = addCardToHandWithOverflow(nextState, playerId, cardId);
        }
        for (const cardId of discard) {
          nextState = addCardToDiscardPile(nextState, playerId, cardId, {
            countAsDiscard: true
          });
        }
        break;
      }
      case "prospecting": {
        const baseGold = typeof effect.baseGold === "number" ? effect.baseGold : 0;
        const bonusIfMine = typeof effect.bonusIfMine === "number" ? effect.bonusIfMine : 0;
        const amount =
          baseGold +
          (bonusIfMine > 0 && playerOccupiesTile(nextState, playerId, "mine")
            ? bonusIfMine
            : 0);
        nextState = addGold(nextState, playerId, amount);
        break;
      }
      case "recruit": {
        const choice = getChoiceTarget(targets ?? null);
        if (!choice) {
          break;
        }
        if (choice.kind === "capital") {
          const deployHex = resolveCapitalDeployHex(nextState, playerId, choice.hexKey ?? null);
          if (!deployHex) {
            break;
          }
          const baseCount = 2;
          const count = getDeployForcesCount(
            nextState,
            { playerId, hexKey: deployHex, baseCount },
            baseCount
          );
          nextState = {
            ...nextState,
            board: addForcesToHex(nextState.board, playerId, deployHex, count)
          };
          break;
        }
        if (choice.kind === "occupiedHex") {
          const hex = nextState.board.hexes[choice.hexKey];
          if (!hex) {
            break;
          }
          if (!isOccupiedByPlayer(hex, playerId)) {
            break;
          }
          if (wouldExceedTwoPlayers(hex, playerId)) {
            break;
          }
          const baseCount = 1;
          const count = getDeployForcesCount(
            nextState,
            { playerId, hexKey: choice.hexKey, baseCount },
            baseCount
          );
          nextState = {
            ...nextState,
            board: addForcesToHex(nextState.board, playerId, choice.hexKey, count)
          };
        }
        break;
      }
      case "deployForces": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          break;
        }
        if (wouldExceedTwoPlayers(target.hex, playerId)) {
          break;
        }
        const baseCount = typeof effect.count === "number" ? effect.count : 0;
        if (baseCount <= 0) {
          break;
        }
        const count = getDeployForcesCount(
          nextState,
          { playerId, hexKey: target.hexKey, baseCount },
          baseCount
        );
        if (count <= 0) {
          break;
        }
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, target.hexKey, count)
        };
        break;
      }
      case "increaseMineValue": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const current = target.hex.mineValue;
        if (typeof current !== "number") {
          break;
        }
        const amount = typeof effect.amount === "number" ? effect.amount : NaN;
        if (!Number.isFinite(amount) || amount <= 0) {
          break;
        }
        const maxValue =
          typeof effect.maxValue === "number" ? effect.maxValue : Number.POSITIVE_INFINITY;
        const nextValue = Math.min(current + amount, maxValue);
        if (nextValue === current) {
          break;
        }
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            hexes: {
              ...nextState.board.hexes,
              [target.hexKey]: {
                ...target.hex,
                mineValue: nextValue
              }
            }
          }
        };
        break;
      }
      case "healChampion": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = healChampion(nextState, target.unitId, amount);
        break;
      }
      case "dealChampionDamage": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = dealChampionDamage(nextState, playerId, target.unitId, amount);
        break;
      }
      case "patchUp": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const baseHeal = typeof effect.baseHeal === "number" ? effect.baseHeal : 0;
        const capitalBonus = typeof effect.capitalBonus === "number" ? effect.capitalBonus : 0;
        let amount = baseHeal;
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (player?.capitalHex && target.unit.hex === player.capitalHex) {
          amount += capitalBonus;
        }
        nextState = healChampion(nextState, target.unitId, amount);
        break;
      }
      case "holdTheLine": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.hexKey}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedHex: target.hexKey,
              duration: { type: "endOfRound" },
              hooks: {
                getForceHitFaces: ({ modifier, unit, defenderPlayerId }, current) => {
                  if (unit.kind !== "force") {
                    return current;
                  }
                  if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
                    return current;
                  }
                  if (defenderPlayerId !== unit.ownerPlayerId) {
                    return current;
                  }
                  return Math.max(current, 3);
                }
              }
            }
          ]
        };
        break;
      }
      case "markForCoin": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const bounty = typeof effect.bounty === "number" ? Math.max(0, effect.bounty) : 0;
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              data: {
                markedUnitId: target.unitId,
                bonusGold: bounty
              }
            }
          ]
        };
        break;
      }
      case "ward": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              data: {
                targeting: {
                  blockEnemyCards: true,
                  scope: "attachedUnit"
                }
              }
            }
          ]
        };
        break;
      }
      case "immunityField": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              data: {
                targeting: {
                  blockEnemySpells: true,
                  scope: "ownerChampions"
                }
              }
            }
          ]
        };
        break;
      }
      case "buildBridge": {
        const plan = getBuildBridgePlan(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!plan) {
          break;
        }
        const isTemporary = effect.temporary === true;
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges: {
              ...nextState.board.bridges,
              [plan.key]: {
                key: plan.key,
                from: plan.from,
                to: plan.to,
                ownerPlayerId: playerId,
                temporary: isTemporary ? true : undefined
              }
            }
          }
        };
        break;
      }
      case "lockBridge": {
        const plan = getExistingBridgePlan(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!plan) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${plan.key}.lock`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedEdge: plan.key,
              duration: { type: "endOfRound" },
              hooks: {
                getMoveAdjacency: ({ modifier, from, to }, current) => {
                  if (!modifier.attachedEdge) {
                    return current;
                  }
                  return getBridgeKey(from, to) === modifier.attachedEdge ? false : current;
                }
              }
            }
          ]
        };
        break;
      }
      case "moveStack": {
        const movePath = getMovePathTarget(targets ?? null);
        if (!movePath) {
          break;
        }
        const maxDistance =
          typeof effect.maxDistance === "number"
            ? effect.maxDistance
            : typeof card.targetSpec.maxDistance === "number"
              ? card.targetSpec.maxDistance
              : undefined;
        const requiresBridge =
          effect.requiresBridge === false ? false : card.targetSpec.requiresBridge !== false;
        const forceCount = getMoveStackForceCount(card, effect, targets ?? null);
        const validPath = validateMovePath(nextState, playerId, movePath, {
          maxDistance,
          requiresBridge,
          requireStartOccupied: true,
          forceCount
        });
        if (!validPath) {
          break;
        }
        nextState = moveUnitsAlongPath(nextState, playerId, validPath, forceCount);
        nextState = markPlayerMovedThisRound(nextState, playerId);
        break;
      }
      default:
        break;
    }
  }

  return nextState;
};

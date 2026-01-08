import type { CardDef } from "./content/cards";
import {
  areAdjacent,
  axialDistance,
  neighborHexKeys,
  parseEdgeKey,
  parseHexKey,
  randInt
} from "@bridgefront/shared";

import type {
  BlockState,
  CardInstanceID,
  CardPlayTargets,
  GameState,
  Modifier,
  PlayerID,
  TileType
} from "./types";
import {
  countPlayersOnHex,
  getCenterHexKey,
  getBridgeKey,
  hasBridge,
  hasEnemyUnits,
  isOccupiedByPlayer,
  wouldExceedTwoPlayers
} from "./board";
import {
  addCardToDiscardPile,
  addCardToHandWithOverflow,
  createCardInstance,
  drawCards,
  takeTopCards,
  topdeckCardFromHand
} from "./cards";
import {
  applyChampionDeployment,
  dealChampionDamage,
  healChampion,
  removeChampionModifiers
} from "./champions";
import {
  addChampionToHex,
  addForcesToHex,
  countPlayerChampions,
  moveUnitToHex,
  selectMovingUnits
} from "./units";
import {
  getDeployForcesCount,
  getMoveAdjacency,
  getMoveMaxDistance,
  getMoveRequiresBridge,
  runMoveEvents
} from "./modifiers";
import { resolveCapitalDeployHex } from "./deploy-utils";
import { markPlayerMovedThisRound } from "./player-flags";

const SUPPORTED_TARGET_KINDS = new Set([
  "none",
  "edge",
  "multiEdge",
  "stack",
  "path",
  "multiPath",
  "champion",
  "choice",
  "hex",
  "hexPair"
]);
const SUPPORTED_EFFECTS = new Set([
  "gainGold",
  "gainMana",
  "drawCards",
  "drawCardsOtherPlayers",
  "rollGold",
  "drawCardsIfTile",
  "drawCardsIfHandEmpty",
  "scoutReport",
  "prospecting",
  "gainGoldIfEnemyCapital",
  "buildBridge",
  "moveStack",
  "moveStacks",
  "deployForces",
  "deployForcesOnMines",
  "increaseMineValue",
  "healChampion",
  "healChampions",
  "dealChampionDamage",
  "goldPlatedArmor",
  "patchUp",
  "recruit",
  "holdTheLine",
  "markForCoin",
  "topdeckFromHand",
  "ward",
  "immunityField",
  "lockBridge",
  "trapBridge",
  "destroyBridge",
  "bridgePivot",
  "battleWinDraw",
  "destroyConnectedBridges",
  "linkHexes",
  "linkCapitalToCenter",
  "battleCry",
  "smokeScreen",
  "frenzy",
  "shockDrill",
  "focusFire",
  "encirclement",
  "mortarShot",
  "setToSkirmish",
  "evacuateChampion",
  "recallChampion"
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
  movingUnitIds?: string[];
  stopOnOccupied?: boolean;
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

const getEdgeKeyTargets = (targets: CardPlayTargets): string[] | null => {
  const record = getTargetRecord(targets);
  const raw = record?.edgeKeys ?? record?.edges ?? record?.edgeKey;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return raw.length > 0 ? [raw] : null;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const edges: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.length === 0) {
      return null;
    }
    edges.push(entry);
  }
  return edges;
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

const normalizePath = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  if (!value.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return null;
  }
  return value as string[];
};

const getMultiPathTargets = (targets: CardPlayTargets): string[][] | null => {
  const record = getTargetRecord(targets);
  const raw = record?.paths ?? record?.path;
  if (!raw) {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  if (raw.every((entry) => typeof entry === "string")) {
    const single = normalizePath(raw);
    return single ? [single] : null;
  }
  const paths: string[][] = [];
  for (const entry of raw) {
    const path = normalizePath(entry);
    if (!path) {
      return null;
    }
    paths.push(path);
  }
  return paths.length > 0 ? paths : null;
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

const hasFriendlyForceWithinRange = (
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

const removeModifierById = (state: GameState, modifierId: string): GameState => {
  const nextModifiers = state.modifiers.filter((modifier) => modifier.id !== modifierId);
  return nextModifiers.length === state.modifiers.length
    ? state
    : { ...state, modifiers: nextModifiers };
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
  return resolveHexTarget(state, playerId, targetSpec, hexKey);
};

const getHexPairTarget = (
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

const addHexLinkModifier = (
  state: GameState,
  playerId: PlayerID,
  cardId: string,
  from: string,
  to: string
): GameState => {
  if (from === to) {
    return state;
  }
  const modifierId = `card.${cardId}.${playerId}.${state.revision}.${from}.${to}.link`;
  return {
    ...state,
    modifiers: [
      ...state.modifiers,
      {
        id: modifierId,
        source: { type: "card", sourceId: cardId },
        ownerPlayerId: playerId,
        duration: { type: "endOfRound" },
        data: { link: { from, to } },
        hooks: {
          getMoveAdjacency: ({ modifier, playerId: movingPlayerId, from, to }, current) => {
            if (current) {
              return true;
            }
            if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
              return current;
            }
            const link = modifier.data?.link as { from?: string; to?: string } | undefined;
            if (!link?.from || !link?.to) {
              return current;
            }
            if (link.from === from && link.to === to) {
              return true;
            }
            if (link.from === to && link.to === from) {
              return true;
            }
            return current;
          }
        }
      }
    ]
  };
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

const getBuildBridgePlans = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): BuildBridgePlan[] | null => {
  const edgeKeys = getEdgeKeyTargets(targets);
  if (!edgeKeys || edgeKeys.length === 0) {
    return null;
  }
  const plans: BuildBridgePlan[] = [];
  const seen = new Set<string>();
  for (const edgeKey of edgeKeys) {
    const plan = getBuildBridgePlan(state, playerId, targetSpec, { edgeKey });
    if (!plan || seen.has(plan.key)) {
      return null;
    }
    seen.add(plan.key);
    plans.push(plan);
  }
  return plans;
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

const getExistingBridgePlans = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): BuildBridgePlan[] | null => {
  const edgeKeys = getEdgeKeyTargets(targets);
  if (!edgeKeys || edgeKeys.length === 0) {
    return null;
  }
  const plans: BuildBridgePlan[] = [];
  const seen = new Set<string>();
  for (const edgeKey of edgeKeys) {
    const plan = getExistingBridgePlan(state, playerId, targetSpec, { edgeKey });
    if (!plan || seen.has(plan.key)) {
      return null;
    }
    seen.add(plan.key);
    plans.push(plan);
  }
  return plans;
};

const getBridgePivotPlans = (
  state: GameState,
  playerId: PlayerID,
  targetSpec: TargetRecord,
  targets: CardPlayTargets
): { existing: BuildBridgePlan; build: BuildBridgePlan; sharedHex: string } | null => {
  const edgeKeys = getEdgeKeyTargets(targets);
  if (!edgeKeys || edgeKeys.length === 0) {
    return null;
  }
  const minEdges =
    typeof targetSpec.minEdges === "number" ? Math.max(0, Math.floor(targetSpec.minEdges)) : 2;
  const maxEdges =
    typeof targetSpec.maxEdges === "number"
      ? Math.max(0, Math.floor(targetSpec.maxEdges))
      : 2;
  if (edgeKeys.length < minEdges || edgeKeys.length > maxEdges) {
    return null;
  }

  let existing: BuildBridgePlan | null = null;
  let build: BuildBridgePlan | null = null;

  for (const edgeKey of edgeKeys) {
    let rawA: string;
    let rawB: string;
    try {
      [rawA, rawB] = parseEdgeKey(edgeKey);
    } catch {
      return null;
    }
    const canonicalKey = getBridgeKey(rawA, rawB);
    if (state.board.bridges[canonicalKey]) {
      const plan = getExistingBridgePlan(state, playerId, targetSpec, { edgeKey });
      if (!plan || existing) {
        return null;
      }
      existing = plan;
    } else {
      const plan = getBuildBridgePlan(state, playerId, targetSpec, { edgeKey });
      if (!plan || build) {
        return null;
      }
      build = plan;
    }
  }

  if (!existing || !build) {
    return null;
  }

  const sharedHex =
    existing.from === build.from || existing.from === build.to
      ? existing.from
      : existing.to === build.from || existing.to === build.to
        ? existing.to
        : null;
  if (!sharedHex) {
    return null;
  }

  const allowAnywhere = targetSpec.anywhere === true;
  if (!allowAnywhere) {
    const shared = state.board.hexes[sharedHex];
    if (!shared || !isOccupiedByPlayer(shared, playerId)) {
      return null;
    }
  }

  return { existing, build, sharedHex };
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

  const fromHex = state.board.hexes[path[0]];
  if (!fromHex) {
    return null;
  }
  const providedUnits =
    Array.isArray(options.movingUnitIds) && options.movingUnitIds.length > 0
      ? options.movingUnitIds
      : null;
  const movingUnitIds = providedUnits
    ? providedUnits
    : selectMovingUnits(state.board, playerId, path[0], options.forceCount);
  if (providedUnits) {
    const occupantSet = new Set(fromHex.occupants[playerId] ?? []);
    if (!providedUnits.every((unitId) => occupantSet.has(unitId))) {
      return null;
    }
  }
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
      if (hex && options.stopOnOccupied && countPlayersOnHex(hex) > 0) {
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

const removeForcesFromHex = (
  state: GameState,
  playerId: PlayerID,
  hexKey: string,
  unitIds: string[],
  count: number
): GameState => {
  if (!Number.isFinite(count) || count <= 0) {
    return state;
  }
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return state;
  }
  const occupants = hex.occupants[playerId] ?? [];
  if (occupants.length === 0) {
    return state;
  }

  const occupantSet = new Set(occupants);
  const eligible = unitIds.filter((unitId) => {
    if (!occupantSet.has(unitId)) {
      return false;
    }
    const unit = state.board.units[unitId];
    return unit?.kind === "force" && unit.ownerPlayerId === playerId;
  });
  if (eligible.length === 0) {
    return state;
  }

  const removeCount = Math.min(Math.floor(count), eligible.length);
  const removeIds = new Set(eligible.slice(0, removeCount));
  const nextUnits = { ...state.board.units };
  for (const unitId of removeIds) {
    delete nextUnits[unitId];
  }
  const nextOccupants = occupants.filter((unitId) => !removeIds.has(unitId));

  return {
    ...state,
    board: {
      ...state.board,
      units: nextUnits,
      hexes: {
        ...state.board.hexes,
        [hexKey]: {
          ...hex,
          occupants: {
            ...hex.occupants,
            [playerId]: nextOccupants
          }
        }
      }
    }
  };
};

const removeChampionFromBoard = (state: GameState, unitId: string): GameState => {
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }

  const hex = state.board.hexes[unit.hex];
  const nextUnits = { ...state.board.units };
  delete nextUnits[unitId];

  let nextState: GameState = {
    ...state,
    board: {
      ...state.board,
      units: nextUnits
    }
  };

  if (hex) {
    const occupants = (hex.occupants[unit.ownerPlayerId] ?? []).filter(
      (entry) => entry !== unitId
    );
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        hexes: {
          ...nextState.board.hexes,
          [unit.hex]: {
            ...hex,
            occupants: {
              ...hex.occupants,
              [unit.ownerPlayerId]: occupants
            }
          }
        }
      }
    };
  }

  nextState = removeChampionModifiers(nextState, [unitId]);
  const nextModifiers = nextState.modifiers.filter(
    (modifier) => modifier.attachedUnitId !== unitId
  );
  return nextModifiers.length === nextState.modifiers.length
    ? nextState
    : { ...nextState, modifiers: nextModifiers };
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
    nextState = runMoveEvents(nextState, { playerId, from, to, path, movingUnitIds });
  }

  return nextState;
};

const moveUnitIdsAlongPath = (
  state: GameState,
  playerId: PlayerID,
  path: string[],
  movingUnitIds: string[]
): GameState => {
  if (movingUnitIds.length === 0) {
    return state;
  }

  let nextState = state;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    nextState = moveUnits(nextState, playerId, movingUnitIds, from, to);
    nextState = runMoveEvents(nextState, { playerId, from, to, path, movingUnitIds });
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
    const mortarEffect = card.effects?.find(
      (effect) => effect.kind === "mortarShot"
    ) as TargetRecord | undefined;
    if (mortarEffect) {
      const maxDistance =
        typeof mortarEffect.maxDistance === "number" ? mortarEffect.maxDistance : 2;
      if (!hasFriendlyForceWithinRange(state, playerId, target.hexKey, maxDistance)) {
        return false;
      }
    }
    if (card.effects?.some((effect) => effect.kind === "deployForces")) {
      return !wouldExceedTwoPlayers(target.hex, playerId);
    }
    return true;
  }

  if (card.targetSpec.kind === "hexPair") {
    return Boolean(
      getHexPairTarget(state, playerId, card.targetSpec as TargetRecord, targets ?? null)
    );
  }

  if (card.targetSpec.kind === "edge") {
    const hasBuildBridge = card.effects?.some((effect) => effect.kind === "buildBridge") ?? false;
    const hasExistingBridgeEffect =
      card.effects?.some(
        (effect) =>
          effect.kind === "lockBridge" ||
          effect.kind === "trapBridge" ||
          effect.kind === "destroyBridge"
      ) ?? false;
    const plan = hasBuildBridge
      ? getBuildBridgePlan(state, playerId, card.targetSpec as TargetRecord, targets ?? null)
      : hasExistingBridgeEffect
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
    const stopOnOccupied =
      moveEffect.stopOnOccupied === true ||
      (card.targetSpec as TargetRecord | undefined)?.stopOnOccupied === true;

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
        forceCount,
        stopOnOccupied
      })
    );
  }

  if (card.targetSpec.kind === "multiEdge") {
    const targetSpec = card.targetSpec as TargetRecord;
    const edgeKeys = getEdgeKeyTargets(targets ?? null);
    if (!edgeKeys || edgeKeys.length === 0) {
      return false;
    }
    const minEdges =
      typeof targetSpec.minEdges === "number" ? Math.max(0, Math.floor(targetSpec.minEdges)) : 1;
    const maxEdges =
      typeof targetSpec.maxEdges === "number"
        ? Math.max(0, Math.floor(targetSpec.maxEdges))
        : Number.POSITIVE_INFINITY;
    if (edgeKeys.length < minEdges || edgeKeys.length > maxEdges) {
      return false;
    }
    const hasBridgePivot =
      card.effects?.some((effect) => effect.kind === "bridgePivot") ?? false;
    if (hasBridgePivot) {
      return Boolean(getBridgePivotPlans(state, playerId, targetSpec, targets ?? null));
    }
    const hasBuildBridge = card.effects?.some((effect) => effect.kind === "buildBridge") ?? false;
    const hasExistingBridgeEffect =
      card.effects?.some(
        (effect) =>
          effect.kind === "lockBridge" ||
          effect.kind === "trapBridge" ||
          effect.kind === "destroyBridge"
      ) ?? false;
    const planResolver = hasBuildBridge
      ? getBuildBridgePlan
      : hasExistingBridgeEffect
        ? getExistingBridgePlan
        : getBuildBridgePlan;
    const seen = new Set<string>();
    for (const edgeKey of edgeKeys) {
      const plan = planResolver(state, playerId, targetSpec, { edgeKey });
      if (!plan || seen.has(plan.key)) {
        return false;
      }
      seen.add(plan.key);
    }
    return true;
  }

  if (card.targetSpec.kind === "multiPath") {
    const targetSpec = card.targetSpec as TargetRecord;
    const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
    if (owner !== "self") {
      return false;
    }
    const paths = getMultiPathTargets(targets ?? null);
    if (!paths || paths.length === 0) {
      return false;
    }
    const minPaths =
      typeof targetSpec.minPaths === "number" ? Math.max(0, Math.floor(targetSpec.minPaths)) : 1;
    const maxPaths =
      typeof targetSpec.maxPaths === "number"
        ? Math.max(0, Math.floor(targetSpec.maxPaths))
        : Number.POSITIVE_INFINITY;
    if (paths.length < minPaths || paths.length > maxPaths) {
      return false;
    }
    const moveEffect = card.effects?.find(
      (effect) => effect.kind === "moveStacks"
    ) as TargetRecord | undefined;
    const maxDistance =
      typeof moveEffect?.maxDistance === "number"
        ? moveEffect.maxDistance
        : typeof targetSpec.maxDistance === "number"
          ? targetSpec.maxDistance
          : undefined;
    const requiresBridge =
      moveEffect?.requiresBridge === false ? false : targetSpec.requiresBridge !== false;
    const stopOnOccupied =
      moveEffect?.stopOnOccupied === true || targetSpec.stopOnOccupied === true;
    const seenStarts = new Set<string>();
    let moveState = state;
    for (const path of paths) {
      const start = path[0];
      if (seenStarts.has(start)) {
        return false;
      }
      seenStarts.add(start);
      if (
        !validateMovePath(moveState, playerId, path, {
          maxDistance,
          requiresBridge,
          requireStartOccupied: true,
          stopOnOccupied
        })
      ) {
        return false;
      }
      moveState = markPlayerMovedThisRound(moveState, playerId);
    }
    return true;
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
    const stopOnOccupied =
      moveEffect?.stopOnOccupied === true || card.targetSpec.stopOnOccupied === true;
    return Boolean(
      validateMovePath(state, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        forceCount,
        stopOnOccupied
      })
    );
  }

  if (card.targetSpec.kind === "champion") {
    const target = getChampionTarget(
      state,
      playerId,
      card.targetSpec as TargetRecord,
      targets ?? null,
      card
    );
    if (!target) {
      return false;
    }
    const needsCapital = card.effects?.some(
      (effect) => effect.kind === "evacuateChampion"
    );
    if (!needsCapital) {
      return true;
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      return false;
    }
    const capitalHex = state.board.hexes[player.capitalHex];
    if (!capitalHex) {
      return false;
    }
    return !wouldExceedTwoPlayers(capitalHex, playerId);
  }

  if (card.targetSpec.kind === "choice") {
    const choice = getChoiceTarget(targets ?? null);
    if (!choice) {
      return false;
    }
    const options = Array.isArray(card.targetSpec.options)
      ? (card.targetSpec.options as TargetRecord[])
      : [];
    const matchingOptions = options.filter((option) => option.kind === choice.kind);
    if (matchingOptions.length === 0) {
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
      const tileAllowed = matchingOptions.some((option) => {
        const tile = typeof option.tile === "string" ? option.tile : null;
        return !tile || tile === hex.tile;
      });
      if (!tileAllowed) {
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

const addMana = (state: GameState, playerId: PlayerID, amount: number): GameState => {
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
              mana: player.resources.mana + amount
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

const playerOccupiesEnemyCapital = (state: GameState, playerId: PlayerID): boolean => {
  return Object.values(state.board.hexes).some((hex) => {
    if (hex.tile !== "capital") {
      return false;
    }
    if (!hex.ownerPlayerId || hex.ownerPlayerId === playerId) {
      return false;
    }
    return (hex.occupants[playerId]?.length ?? 0) > 0;
  });
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
      case "gainGoldIfEnemyCapital": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        if (amount <= 0) {
          break;
        }
        if (!playerOccupiesEnemyCapital(nextState, playerId)) {
          break;
        }
        nextState = addGold(nextState, playerId, amount);
        break;
      }
      case "gainMana": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = addMana(nextState, playerId, amount);
        break;
      }
      case "drawCards": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        nextState = drawCards(nextState, playerId, count);
        break;
      }
      case "drawCardsOtherPlayers": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        if (count <= 0) {
          break;
        }
        for (const player of nextState.players) {
          if (player.id === playerId) {
            continue;
          }
          nextState = drawCards(nextState, player.id, count);
        }
        break;
      }
      case "rollGold": {
        const sides = Number.isFinite(effect.sides) ? Math.max(1, Math.floor(effect.sides)) : 6;
        const highMin =
          Number.isFinite(effect.highMin) && Number(effect.highMin) >= 1
            ? Math.floor(effect.highMin)
            : 5;
        const lowGain = typeof effect.lowGain === "number" ? effect.lowGain : 0;
        const highGain = typeof effect.highGain === "number" ? effect.highGain : 0;
        if (sides <= 0 || (lowGain <= 0 && highGain <= 0)) {
          break;
        }
        const threshold = Math.min(highMin, sides);
        const roll = randInt(nextState.rngState, 1, sides);
        nextState = { ...nextState, rngState: roll.next };
        const amount = roll.value >= threshold ? highGain : lowGain;
        if (amount > 0) {
          nextState = addGold(nextState, playerId, amount);
        }
        break;
      }
      case "drawCardsIfTile": {
        const tile = typeof effect.tile === "string" ? effect.tile : null;
        const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
        if (!tile || count <= 0) {
          break;
        }
        if (playerOccupiesTile(nextState, playerId, tile as TileType)) {
          nextState = drawCards(nextState, playerId, count);
        }
        break;
      }
      case "drawCardsIfHandEmpty": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        if (count <= 0) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        if (player.deck.hand.length > 0) {
          break;
        }
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
        const maxKeep = Math.min(keepCount, taken.cards.length);
        if (maxKeep <= 0) {
          for (const cardId of taken.cards) {
            nextState = addCardToDiscardPile(nextState, playerId, cardId, {
              countAsDiscard: true
            });
          }
          break;
        }
        if (maxKeep >= taken.cards.length || nextState.blocks) {
          const keep = taken.cards.slice(0, maxKeep);
          const discard = taken.cards.filter((cardId) => !keep.includes(cardId));
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
        nextState = {
          ...nextState,
          blocks: {
            type: "action.scoutReport",
            waitingFor: [playerId],
            payload: {
              playerId,
              offers: taken.cards,
              keepCount: maxKeep,
              chosen: null
            }
          }
        };
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
        const options = Array.isArray(card.targetSpec.options)
          ? (card.targetSpec.options as TargetRecord[])
          : [];
        const capitalCountRaw =
          typeof effect.capitalCount === "number" ? effect.capitalCount : 2;
        const occupiedCountRaw =
          typeof effect.occupiedCount === "number" ? effect.occupiedCount : 1;
        const capitalCount = Math.max(0, Math.floor(capitalCountRaw));
        const occupiedCount = Math.max(0, Math.floor(occupiedCountRaw));
        if (choice.kind === "capital") {
          if (!options.some((option) => option.kind === "capital")) {
            break;
          }
          const deployHex = resolveCapitalDeployHex(nextState, playerId, choice.hexKey ?? null);
          if (!deployHex) {
            break;
          }
          const baseCount = capitalCount;
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
          const tileAllowed = options.some((option) => {
            if (option.kind !== "occupiedHex") {
              return false;
            }
            const tile = typeof option.tile === "string" ? option.tile : null;
            return !tile || tile === hex.tile;
          });
          if (!tileAllowed) {
            break;
          }
          if (wouldExceedTwoPlayers(hex, playerId)) {
            break;
          }
          const baseCount = occupiedCount;
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
        let targetHexKey: string | null = null;
        if (card.targetSpec.kind === "champion") {
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
          targetHexKey = target.unit.hex;
        } else {
          const target = getHexTarget(
            nextState,
            playerId,
            card.targetSpec as TargetRecord,
            targets ?? null
          );
          if (!target) {
            break;
          }
          targetHexKey = target.hexKey;
        }
        if (!targetHexKey) {
          break;
        }
        const targetHex = nextState.board.hexes[targetHexKey];
        if (!targetHex) {
          break;
        }
        if (wouldExceedTwoPlayers(targetHex, playerId)) {
          break;
        }
        const baseCount = typeof effect.count === "number" ? effect.count : 0;
        if (baseCount <= 0) {
          break;
        }
        const count = getDeployForcesCount(
          nextState,
          { playerId, hexKey: targetHexKey, baseCount },
          baseCount
        );
        if (count <= 0) {
          break;
        }
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, targetHexKey, count)
        };
        break;
      }
      case "deployForcesOnMines": {
        const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
        if (count <= 0) {
          break;
        }
        for (const hex of Object.values(nextState.board.hexes)) {
          if (hex.tile !== "mine") {
            continue;
          }
          if (!isOccupiedByPlayer(hex, playerId)) {
            continue;
          }
          nextState = {
            ...nextState,
            board: addForcesToHex(nextState.board, playerId, hex.key, count)
          };
        }
        break;
      }
      case "evacuateChampion": {
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
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player?.capitalHex) {
          break;
        }
        const capitalHex = nextState.board.hexes[player.capitalHex];
        if (!capitalHex) {
          break;
        }
        if (wouldExceedTwoPlayers(capitalHex, playerId)) {
          break;
        }
        nextState = {
          ...nextState,
          board: moveUnitToHex(nextState.board, target.unitId, player.capitalHex)
        };
        break;
      }
      case "recallChampion": {
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
        const cardDefId = target.unit.cardDefId;
        nextState = removeChampionFromBoard(nextState, target.unitId);
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        let recalledInstanceId: string | null = null;
        for (const instanceId of player.burned) {
          const defId = nextState.cardsByInstanceId[instanceId]?.defId;
          if (defId === cardDefId) {
            recalledInstanceId = instanceId;
            break;
          }
        }
        if (recalledInstanceId) {
          nextState = {
            ...nextState,
            players: nextState.players.map((entry) =>
              entry.id === playerId
                ? {
                    ...entry,
                    burned: entry.burned.filter((id) => id !== recalledInstanceId)
                  }
                : entry
            )
          };
        } else {
          const created = createCardInstance(nextState, cardDefId);
          nextState = created.state;
          recalledInstanceId = created.instanceId;
        }
        if (recalledInstanceId) {
          nextState = addCardToHandWithOverflow(nextState, playerId, recalledInstanceId);
        }
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
      case "healChampions": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        if (amount <= 0) {
          break;
        }
        const unitIds = Object.keys(nextState.board.units);
        for (const unitId of unitIds) {
          const unit = nextState.board.units[unitId];
          if (!unit || unit.kind !== "champion") {
            continue;
          }
          if (unit.ownerPlayerId !== playerId) {
            continue;
          }
          nextState = healChampion(nextState, unitId, amount);
        }
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
      case "encirclement": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const minAdjacent =
          typeof effect.minAdjacent === "number" ? Math.max(0, Math.floor(effect.minAdjacent)) : 3;
        const maxForces =
          typeof effect.maxForces === "number" ? Math.max(0, Math.floor(effect.maxForces)) : 6;
        if (maxForces <= 0) {
          break;
        }
        const neighbors = neighborHexKeys(target.hexKey).filter(
          (hexKey) => Boolean(nextState.board.hexes[hexKey])
        );
        const adjacentCount = neighbors.reduce((count, hexKey) => {
          const hex = nextState.board.hexes[hexKey];
          if (!hex) {
            return count;
          }
          return isOccupiedByPlayer(hex, playerId) ? count + 1 : count;
        }, 0);
        if (adjacentCount < minAdjacent) {
          break;
        }
        const hex = nextState.board.hexes[target.hexKey];
        if (!hex) {
          break;
        }
        const enemyEntry = Object.entries(hex.occupants).find(
          ([occupantId, units]) => occupantId !== playerId && units.length > 0
        );
        if (!enemyEntry) {
          break;
        }
        const [enemyId, unitIds] = enemyEntry;
        const enemyForces = unitIds.filter(
          (unitId) => nextState.board.units[unitId]?.kind === "force"
        );
        if (enemyForces.length === 0) {
          break;
        }
        const removeCount = Math.min(maxForces, enemyForces.length);
        nextState = removeForcesFromHex(nextState, enemyId, target.hexKey, unitIds, removeCount);
        break;
      }
      case "mortarShot": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const maxDistance =
          typeof effect.maxDistance === "number" ? effect.maxDistance : 2;
        if (!hasFriendlyForceWithinRange(nextState, playerId, target.hexKey, maxDistance)) {
          break;
        }

        const neighbors = neighborHexKeys(target.hexKey).filter(
          (hexKey) => Boolean(nextState.board.hexes[hexKey])
        );
        const roll = randInt(nextState.rngState, 0, 99);
        nextState = { ...nextState, rngState: roll.next };

        let strikeHexKey = target.hexKey;
        if (neighbors.length > 0 && roll.value >= 50) {
          const pick = randInt(nextState.rngState, 0, neighbors.length - 1);
          nextState = { ...nextState, rngState: pick.next };
          strikeHexKey = neighbors[pick.value] ?? neighbors[0];
        }

        const forceLoss = typeof effect.forceLoss === "number" ? effect.forceLoss : 4;
        let remainingLoss = Math.max(0, Math.floor(forceLoss));
        for (const player of nextState.players) {
          if (remainingLoss <= 0) {
            break;
          }
          const hex = nextState.board.hexes[strikeHexKey];
          if (!hex) {
            break;
          }
          const occupants = hex.occupants[player.id] ?? [];
          const available = occupants.filter(
            (unitId) => nextState.board.units[unitId]?.kind === "force"
          ).length;
          if (available <= 0) {
            continue;
          }
          const removeCount = Math.min(remainingLoss, available);
          nextState = removeForcesFromHex(
            nextState,
            player.id,
            strikeHexKey,
            occupants,
            removeCount
          );
          remainingLoss -= removeCount;
        }

        const damage = typeof effect.damage === "number" ? effect.damage : 2;
        if (damage > 0) {
          for (const unit of Object.values(nextState.board.units)) {
            if (unit.kind !== "champion") {
              continue;
            }
            if (unit.hex !== strikeHexKey) {
              continue;
            }
            nextState = dealChampionDamage(nextState, playerId, unit.id, damage);
          }
        }
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
      case "goldPlatedArmor": {
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
        const costPerDamage =
          typeof effect.costPerDamage === "number" ? effect.costPerDamage : 2;
        if (!Number.isFinite(costPerDamage) || costPerDamage <= 0) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.gold_armor`;
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
                goldArmor: {
                  costPerDamage
                }
              }
            }
          ]
        };
        break;
      }
      case "battleCry": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.battle_cry`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state;
                  }
                  const tempModifier: Modifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getChampionAttackDice: ({ unit, round }, current) => {
                        if (round !== 1 || unit.kind !== "champion") {
                          return current;
                        }
                        if (unit.ownerPlayerId !== ownerId) {
                          return current;
                        }
                        return current + 1;
                      }
                    }
                  };
                  const cleaned = removeModifierById(state, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "smokeScreen": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.smoke_screen`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state;
                  }
                  const tempModifier: Modifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getForceHitFaces: ({ unit, round }, current) => {
                        if (round !== 1 || unit.kind !== "force") {
                          return current;
                        }
                        if (unit.ownerPlayerId === ownerId) {
                          return current;
                        }
                        return Math.min(current, 1);
                      }
                    }
                  };
                  const cleaned = removeModifierById(state, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "shockDrill": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.shock_drill`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state;
                  }
                  const tempModifier: Modifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getForceHitFaces: ({ unit, round }, current) => {
                        if (round !== 1 || unit.kind !== "force") {
                          return current;
                        }
                        if (unit.ownerPlayerId !== ownerId) {
                          return current;
                        }
                        return Math.max(current, 5);
                      }
                    }
                  };
                  const cleaned = removeModifierById(state, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "frenzy": {
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
        const diceBonus = typeof effect.diceBonus === "number" ? effect.diceBonus : 0;
        const damage = typeof effect.damage === "number" ? effect.damage : 0;
        nextState = dealChampionDamage(nextState, playerId, target.unitId, damage);
        const updated = nextState.board.units[target.unitId];
        if (!updated || updated.kind !== "champion") {
          break;
        }
        if (diceBonus <= 0) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.frenzy`;
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
              hooks: {
                getChampionAttackDice: ({ unit }, current) => {
                  if (unit.kind !== "champion") {
                    return current;
                  }
                  if (unit.id !== target.unitId) {
                    return current;
                  }
                  return current + diceBonus;
                }
              }
            }
          ]
        };
        break;
      }
      case "slow": {
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
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.slow`;
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
              hooks: {
                beforeCombatRound: ({ state, modifier, hexKey }) => {
                  const unitId = modifier.attachedUnitId;
                  if (!unitId) {
                    return state;
                  }
                  const unit = state.board.units[unitId];
                  if (!unit || unit.kind !== "champion") {
                    return state;
                  }
                  if (unit.hex !== hexKey) {
                    return state;
                  }
                  const tempModifier: Modifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: modifier.ownerPlayerId,
                    attachedUnitId: unitId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getChampionAttackDice: ({ unit }, current) => {
                        if (unit.kind !== "champion" || unit.id !== unitId) {
                          return current;
                        }
                        return Math.min(current, 1);
                      }
                    }
                  };
                  const cleaned = removeModifierById(state, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "focusFire": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.focus_fire`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state;
                  }
                  const tempModifier: Modifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getHitAssignmentPolicy: (
                        { targetSide, attackerPlayerId, defenderPlayerId },
                        current
                      ) => {
                        if (ownerId === attackerPlayerId && targetSide === "defenders") {
                          return "focusFire";
                        }
                        if (ownerId === defenderPlayerId && targetSide === "attackers") {
                          return "focusFire";
                        }
                        return current;
                      }
                    }
                  };
                  const cleaned = removeModifierById(state, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "battleWinDraw": {
        const drawCountRaw = typeof effect.drawCount === "number" ? effect.drawCount : 0;
        const drawCount = Math.max(0, Math.floor(drawCountRaw));
        if (drawCount <= 0) {
          break;
        }
        const movePath = getMovePathTarget(targets ?? null);
        if (!movePath) {
          break;
        }
        const moveEffect = card.effects?.find(
          (entry) => entry.kind === "moveStack"
        ) as TargetRecord | undefined;
        const forceCount = getMoveStackForceCount(card, moveEffect, targets ?? null);
        const movingUnitIds = selectMovingUnits(
          nextState.board,
          playerId,
          movePath[0],
          forceCount
        );
        if (movingUnitIds.length === 0) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.battle_win_draw`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              data: { trackedUnitIds: movingUnitIds, drawCount },
              hooks: {
                afterBattle: ({
                  state,
                  modifier,
                  winnerPlayerId,
                  attackerPlayerId,
                  defenderPlayerId,
                  attackers,
                  defenders
                }) => {
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId || winnerPlayerId !== ownerId) {
                    return state;
                  }
                  const trackedRaw = modifier.data?.trackedUnitIds;
                  if (!Array.isArray(trackedRaw) || trackedRaw.length === 0) {
                    return state;
                  }
                  const tracked = trackedRaw.filter((id) => typeof id === "string");
                  const survivors =
                    winnerPlayerId === attackerPlayerId
                      ? attackers
                      : winnerPlayerId === defenderPlayerId
                        ? defenders
                        : [];
                  if (
                    tracked.length === 0 ||
                    survivors.length === 0 ||
                    !tracked.some((id) => survivors.includes(id))
                  ) {
                    return state;
                  }
                  const countRaw =
                    typeof modifier.data?.drawCount === "number" ? modifier.data.drawCount : 0;
                  const count = Math.max(0, Math.floor(countRaw));
                  if (count <= 0) {
                    return state;
                  }
                  const cleaned = removeModifierById(state, modifier.id);
                  return {
                    ...cleaned,
                    modifiers: [
                      ...cleaned.modifiers,
                      {
                        id: `${modifier.id}.cleanup`,
                        source: modifier.source,
                        ownerPlayerId: ownerId,
                        duration: { type: "uses", remaining: 1 },
                        hooks: {
                          onRoundEnd: ({ state }) => drawCards(state, ownerId, count)
                        }
                      }
                    ]
                  };
                }
              }
            }
          ]
        };
        break;
      }
      case "setToSkirmish": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.hexKey}.skirmish`;
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
                beforeCombatRound: ({ state, modifier, hexKey, round }) => {
                  if (round !== 1) {
                    return state;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state;
                  }
                  const hex = state.board.hexes[hexKey];
                  if (!hex) {
                    return state;
                  }
                  const ownerUnits = hex.occupants[ownerId] ?? [];
                  if (ownerUnits.length === 0) {
                    return state;
                  }

                  const candidates = neighborHexKeys(hexKey).filter((neighbor) => {
                    const neighborHex = state.board.hexes[neighbor];
                    if (!neighborHex) {
                      return false;
                    }
                    return countPlayersOnHex(neighborHex) === 0;
                  });

                  if (candidates.length === 0) {
                    let nextState = state;
                    const forceCount = ownerUnits.filter(
                      (unitId) => state.board.units[unitId]?.kind === "force"
                    ).length;
                    if (forceCount > 0) {
                      nextState = removeForcesFromHex(
                        nextState,
                        ownerId,
                        hexKey,
                        ownerUnits,
                        forceCount
                      );
                    }
                    for (const unitId of ownerUnits) {
                      const unit = nextState.board.units[unitId];
                      if (!unit || unit.kind !== "champion") {
                        continue;
                      }
                      nextState = dealChampionDamage(
                        nextState,
                        ownerId,
                        unitId,
                        unit.hp
                      );
                    }
                    return nextState;
                  }

                  const roll = randInt(state.rngState, 0, candidates.length - 1);
                  const retreatHex = candidates[roll.value] ?? candidates[0];
                  let nextState: GameState = {
                    ...state,
                    rngState: roll.next
                  };
                  nextState = moveUnits(nextState, ownerId, ownerUnits, hexKey, retreatHex);
                  return nextState;
                }
              }
            }
          ]
        };
        break;
      }
      case "buildBridge": {
        const isTemporary = effect.temporary === true;
        if (card.targetSpec.kind === "multiEdge") {
          const plans = getBuildBridgePlans(
            nextState,
            playerId,
            card.targetSpec as TargetRecord,
            targets ?? null
          );
          if (!plans || plans.length === 0) {
            break;
          }
          const bridges = { ...nextState.board.bridges };
          for (const plan of plans) {
            bridges[plan.key] = {
              key: plan.key,
              from: plan.from,
              to: plan.to,
              ownerPlayerId: playerId,
              temporary: isTemporary ? true : undefined
            };
          }
          nextState = {
            ...nextState,
            board: {
              ...nextState.board,
              bridges
            }
          };
          break;
        }
        const plan = getBuildBridgePlan(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!plan) {
          break;
        }
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
      case "trapBridge": {
        const plan = getExistingBridgePlan(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!plan) {
          break;
        }
        const lossValue =
          typeof effect.forceLoss === "number"
            ? effect.forceLoss
            : typeof effect.loss === "number"
              ? effect.loss
              : 1;
        const loss = Number.isFinite(lossValue) ? Math.max(1, Math.floor(lossValue)) : 1;
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${plan.key}.trap`;
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
                onMove: ({ state, modifier, playerId: movingPlayerId, from, to, movingUnitIds }) => {
                  if (!modifier.attachedEdge) {
                    return state;
                  }
                  if (modifier.ownerPlayerId && modifier.ownerPlayerId === movingPlayerId) {
                    return state;
                  }
                  if (getBridgeKey(from, to) !== modifier.attachedEdge) {
                    return state;
                  }
                  const nextState = removeForcesFromHex(
                    state,
                    movingPlayerId,
                    to,
                    movingUnitIds,
                    loss
                  );
                  if (nextState === state) {
                    return state;
                  }
                  const nextModifiers = nextState.modifiers.filter(
                    (entry) => entry.id !== modifier.id
                  );
                  return nextModifiers.length === nextState.modifiers.length
                    ? nextState
                    : { ...nextState, modifiers: nextModifiers };
                }
              }
            }
          ]
        };
        break;
      }
      case "destroyBridge": {
        const targetSpec = card.targetSpec as TargetRecord;
        if (card.targetSpec.kind === "multiEdge") {
          const plans = getExistingBridgePlans(nextState, playerId, targetSpec, targets ?? null);
          if (!plans || plans.length === 0) {
            break;
          }
          const bridges = { ...nextState.board.bridges };
          for (const plan of plans) {
            delete bridges[plan.key];
          }
          nextState = {
            ...nextState,
            board: {
              ...nextState.board,
              bridges
            }
          };
          break;
        }
        const plan = getExistingBridgePlan(nextState, playerId, targetSpec, targets ?? null);
        if (!plan) {
          break;
        }
        const { [plan.key]: _removed, ...bridges } = nextState.board.bridges;
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges
          }
        };
        break;
      }
      case "bridgePivot": {
        const targetSpec = card.targetSpec as TargetRecord;
        const plans = getBridgePivotPlans(nextState, playerId, targetSpec, targets ?? null);
        if (!plans) {
          break;
        }
        const bridges = { ...nextState.board.bridges };
        delete bridges[plans.existing.key];
        bridges[plans.build.key] = {
          key: plans.build.key,
          from: plans.build.from,
          to: plans.build.to,
          ownerPlayerId: playerId
        };
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges
          }
        };
        break;
      }
      case "destroyConnectedBridges": {
        const movePath = targets ? getMovePathTarget(targets) : null;
        const targetHex = movePath ? movePath[movePath.length - 1] : getHexKeyTarget(targets ?? null);
        if (!targetHex) {
          break;
        }
        const bridges = Object.fromEntries(
          Object.entries(nextState.board.bridges).filter(
            ([, bridge]) => bridge.from !== targetHex && bridge.to !== targetHex
          )
        );
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges
          }
        };
        break;
      }
      case "linkHexes": {
        const link = getHexPairTarget(
          nextState,
          playerId,
          card.targetSpec as TargetRecord,
          targets ?? null
        );
        if (!link) {
          break;
        }
        nextState = addHexLinkModifier(nextState, playerId, card.id, link.from, link.to);
        break;
      }
      case "linkCapitalToCenter": {
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player?.capitalHex) {
          break;
        }
        const centerHexKey = getCenterHexKey(nextState.board);
        if (!centerHexKey) {
          break;
        }
        nextState = addHexLinkModifier(
          nextState,
          playerId,
          card.id,
          player.capitalHex,
          centerHexKey
        );
        break;
      }
      case "moveStacks": {
        const paths = getMultiPathTargets(targets ?? null);
        if (!paths || paths.length === 0) {
          break;
        }
        const targetSpec = card.targetSpec as TargetRecord;
        const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
        if (owner !== "self") {
          break;
        }
        const minPaths =
          typeof targetSpec.minPaths === "number"
            ? Math.max(0, Math.floor(targetSpec.minPaths))
            : 1;
        const maxPaths =
          typeof targetSpec.maxPaths === "number"
            ? Math.max(0, Math.floor(targetSpec.maxPaths))
            : Number.POSITIVE_INFINITY;
        if (paths.length < minPaths || paths.length > maxPaths) {
          break;
        }
        const maxDistance =
          typeof effect.maxDistance === "number"
            ? effect.maxDistance
            : typeof targetSpec.maxDistance === "number"
              ? targetSpec.maxDistance
              : undefined;
        const requiresBridge =
          effect.requiresBridge === false ? false : targetSpec.requiresBridge !== false;
        const stopOnOccupied =
          effect.stopOnOccupied === true || targetSpec.stopOnOccupied === true;
        const seenStarts = new Set<string>();
        const movePlans: Array<{ path: string[]; unitIds: string[] }> = [];
        let validationState = nextState;
        const snapshotBoard = nextState.board;
        for (const path of paths) {
          const start = path[0];
          if (seenStarts.has(start)) {
            movePlans.length = 0;
            break;
          }
          seenStarts.add(start);
          const unitIds = selectMovingUnits(snapshotBoard, playerId, start);
          if (unitIds.length === 0) {
            movePlans.length = 0;
            break;
          }
          const validPath = validateMovePath(validationState, playerId, path, {
            maxDistance,
            requiresBridge,
            requireStartOccupied: true,
            movingUnitIds: unitIds,
            stopOnOccupied
          });
          if (!validPath) {
            movePlans.length = 0;
            break;
          }
          movePlans.push({ path: validPath, unitIds });
          validationState = markPlayerMovedThisRound(validationState, playerId);
        }
        if (movePlans.length === 0) {
          break;
        }
        for (const plan of movePlans) {
          nextState = moveUnitIdsAlongPath(nextState, playerId, plan.path, plan.unitIds);
          nextState = markPlayerMovedThisRound(nextState, playerId);
        }
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
        const stopOnOccupied =
          effect.stopOnOccupied === true ||
          (card.targetSpec as TargetRecord | undefined)?.stopOnOccupied === true;
        const forceCount = getMoveStackForceCount(card, effect, targets ?? null);
        const validPath = validateMovePath(nextState, playerId, movePath, {
          maxDistance,
          requiresBridge,
          requireStartOccupied: true,
          forceCount,
          stopOnOccupied
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

const isScoutReportChoiceValid = (
  state: GameState,
  block: Extract<BlockState, { type: "action.scoutReport" }>,
  playerId: PlayerID,
  cardInstanceIds: CardInstanceID[]
): boolean => {
  if (block.payload.playerId !== playerId) {
    return false;
  }
  const maxKeep = Math.min(block.payload.keepCount, block.payload.offers.length);
  if (cardInstanceIds.length > maxKeep) {
    return false;
  }
  const unique = new Set(cardInstanceIds);
  if (unique.size !== cardInstanceIds.length) {
    return false;
  }
  const offerSet = new Set(block.payload.offers);
  if (!cardInstanceIds.every((id) => offerSet.has(id))) {
    return false;
  }
  const player = state.players.find((entry) => entry.id === playerId);
  return Boolean(player);
};

const resolveScoutReportSelection = (
  block: Extract<BlockState, { type: "action.scoutReport" }>
): CardInstanceID[] => {
  const offers = block.payload.offers;
  const maxKeep = Math.min(block.payload.keepCount, offers.length);
  if (maxKeep <= 0) {
    return [];
  }
  const rawChosen = block.payload.chosen ?? [];
  const offerSet = new Set(offers);
  const filtered = rawChosen.filter((id) => offerSet.has(id));
  const unique = Array.from(new Set(filtered)).slice(0, maxKeep);
  if (unique.length > 0) {
    return unique;
  }
  return offers.slice(0, maxKeep);
};

export const applyScoutReportChoice = (
  state: GameState,
  cardInstanceIds: CardInstanceID[],
  playerId: PlayerID
): GameState => {
  const block = state.blocks;
  if (!block || block.type !== "action.scoutReport") {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (block.payload.chosen) {
    return state;
  }
  if (!isScoutReportChoiceValid(state, block, playerId, cardInstanceIds)) {
    return state;
  }

  return {
    ...state,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        chosen: cardInstanceIds
      }
    }
  };
};

export const resolveScoutReportBlock = (
  state: GameState,
  block: Extract<BlockState, { type: "action.scoutReport" }>
): GameState => {
  const selected = resolveScoutReportSelection(block);
  const selectedSet = new Set(selected);
  let nextState = state;
  for (const cardId of selected) {
    nextState = addCardToHandWithOverflow(nextState, block.payload.playerId, cardId);
  }
  for (const cardId of block.payload.offers) {
    if (selectedSet.has(cardId)) {
      continue;
    }
    nextState = addCardToDiscardPile(nextState, block.payload.playerId, cardId, {
      countAsDiscard: true
    });
  }
  return nextState;
};

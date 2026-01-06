import type { CardDef } from "./content/cards";
import { areAdjacent, parseEdgeKey, parseHexKey } from "@bridgefront/shared";

import type { CardPlayTargets, GameState, PlayerID, TileType } from "./types";
import { getBridgeKey, hasBridge, hasEnemyUnits, isOccupiedByPlayer, wouldExceedTwoPlayers } from "./board";
import { drawCards } from "./cards";

const SUPPORTED_TARGET_KINDS = new Set(["none", "edge", "stack", "path"]);
const SUPPORTED_EFFECTS = new Set([
  "gainGold",
  "drawCards",
  "prospecting",
  "buildBridge",
  "moveStack"
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
};

const getTargetRecord = (targets: CardPlayTargets): TargetRecord | null => {
  if (!targets || typeof targets !== "object") {
    return null;
  }
  return targets as TargetRecord;
};

const getEdgeKeyTarget = (targets: CardPlayTargets): string | null => {
  const record = getTargetRecord(targets);
  const edgeKey = record?.edgeKey;
  return typeof edgeKey === "string" && edgeKey.length > 0 ? edgeKey : null;
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

const validateMovePath = (
  state: GameState,
  playerId: PlayerID,
  path: string[],
  options: MoveValidation
): string[] | null => {
  if (path.length < 2) {
    return null;
  }

  if (
    typeof options.maxDistance === "number" &&
    (options.maxDistance <= 0 || path.length - 1 > options.maxDistance)
  ) {
    return null;
  }

  for (const hexKey of path) {
    if (!state.board.hexes[hexKey]) {
      return null;
    }
  }

  const startHex = state.board.hexes[path[0]];
  if (options.requireStartOccupied && !isOccupiedByPlayer(startHex, playerId)) {
    return null;
  }

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    try {
      if (!areAdjacent(parseHexKey(from), parseHexKey(to))) {
        return null;
      }
    } catch {
      return null;
    }
    if (options.requiresBridge && !hasBridge(state.board, from, to)) {
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
  path: string[]
): GameState => {
  const startHex = state.board.hexes[path[0]];
  if (!startHex) {
    return state;
  }
  const movingUnitIds = startHex.occupants[playerId] ?? [];
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

  if (card.targetSpec.kind === "none" && targets != null) {
    return false;
  }

  if (!card.effects || card.effects.length === 0) {
    return false;
  }

  if (!card.effects.every((effect) => SUPPORTED_EFFECTS.has(effect.kind))) {
    return false;
  }

  if (card.targetSpec.kind === "none") {
    return targets == null;
  }

  if (card.targetSpec.kind === "edge") {
    return Boolean(
      getBuildBridgePlan(state, playerId, card.targetSpec as TargetRecord, targets ?? null)
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
    return Boolean(
      validateMovePath(state, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true
      })
    );
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
        const validPath = validateMovePath(nextState, playerId, movePath, {
          maxDistance,
          requiresBridge,
          requireStartOccupied: true
        });
        if (!validPath) {
          break;
        }
        nextState = moveUnitsAlongPath(nextState, playerId, validPath);
        break;
      }
      default:
        break;
    }
  }

  return nextState;
};

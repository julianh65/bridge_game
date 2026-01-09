import {
  areAdjacent,
  parseHexKey
} from "@bridgefront/shared";

import type { CardDef } from "./content/cards";
import type { CardPlayTargets, GameState, Modifier, PlayerID } from "./types";
import {
  countPlayersOnHex,
  hasBridge,
  hasEnemyUnits,
  wouldExceedTwoPlayers
} from "./board";
import { drawCards } from "./cards";
import {
  getBooleanTarget,
  getForceCountTarget,
  getMovePathTarget,
  getMultiPathTargets,
  type TargetRecord
} from "./card-effects-targets";
import { selectMovingUnits } from "./units";
import {
  getMoveAdjacency,
  getMoveMaxDistance,
  getMoveRequiresBridge,
  runMoveEvents
} from "./modifiers";
import { removeModifierById } from "./card-effects-modifiers";
import { markPlayerMovedThisRound } from "./player-flags";

export type MoveValidation = {
  maxDistance?: number;
  requiresBridge: boolean;
  requireStartOccupied: boolean;
  forceCount?: number;
  includeChampions?: boolean;
  movingUnitIds?: string[];
  stopOnOccupied?: boolean;
};

export const getMoveStackForceCount = (
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

export const getMoveStackIncludeChampions = (
  card: CardDef,
  effect?: TargetRecord,
  targets?: CardPlayTargets
): boolean | undefined => {
  const targetInclude = getBooleanTarget(targets ?? null, "includeChampions");
  if (targetInclude !== null) {
    return targetInclude;
  }
  const effectInclude = effect?.includeChampions;
  if (typeof effectInclude === "boolean") {
    return effectInclude;
  }
  const specInclude = (card.targetSpec as TargetRecord | undefined)?.includeChampions;
  if (typeof specInclude === "boolean") {
    return specInclude;
  }
  return undefined;
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
    : selectMovingUnits(
        state.board,
        playerId,
        path[0],
        options.forceCount,
        options.includeChampions
      );
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

type ResolvedMovePath = {
  path: string[];
  movingUnitIds: string[];
};

const resolveMovePath = (
  state: GameState,
  playerId: PlayerID,
  path: string[],
  options: MoveValidation
): ResolvedMovePath | null => {
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
    : selectMovingUnits(
        state.board,
        playerId,
        path[0],
        options.forceCount,
        options.includeChampions
      );
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

  const stopOnOccupied = options.stopOnOccupied === true;
  let stopIndex: number | null = null;

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
    const hex = state.board.hexes[to];
    if (!hex) {
      return null;
    }
    const hasEnemy = hasEnemyUnits(hex, playerId);
    const isOccupied = countPlayersOnHex(hex) > 0;
    if (hasEnemy || (stopOnOccupied && isOccupied)) {
      stopIndex = index + 1;
      break;
    }
  }

  const resolvedPath = stopIndex === null ? path : path.slice(0, stopIndex + 1);
  const destination = state.board.hexes[resolvedPath[resolvedPath.length - 1]];
  if (destination && wouldExceedTwoPlayers(destination, playerId)) {
    return null;
  }

  return { path: resolvedPath, movingUnitIds };
};

export const moveUnits = (
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

export const resolveMovementEffect = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  effect: TargetRecord,
  targets: CardPlayTargets | null
): GameState | null => {
  let nextState = state;

  switch (effect.kind) {
    case "battleWinDraw": {
      const drawCountRaw = typeof effect.drawCount === "number" ? effect.drawCount : 0;
      const drawCount = Math.max(0, Math.floor(drawCountRaw));
      if (drawCount <= 0) {
        return nextState;
      }
      const movePath = getMovePathTarget(targets ?? null);
      if (!movePath) {
        return nextState;
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
        return nextState;
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
      return nextState;
    }
    case "moveStacks": {
      const paths = getMultiPathTargets(targets ?? null);
      if (!paths || paths.length === 0) {
        return nextState;
      }
      const targetSpec = card.targetSpec as TargetRecord;
      const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
      if (owner !== "self") {
        return nextState;
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
        return nextState;
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
        const resolved = resolveMovePath(validationState, playerId, path, {
          maxDistance,
          requiresBridge,
          requireStartOccupied: true,
          movingUnitIds: unitIds,
          stopOnOccupied
        });
        if (!resolved) {
          movePlans.length = 0;
          break;
        }
        movePlans.push({ path: resolved.path, unitIds: resolved.movingUnitIds });
        validationState = markPlayerMovedThisRound(validationState, playerId);
      }
      if (movePlans.length === 0) {
        return nextState;
      }
      for (const plan of movePlans) {
        nextState = moveUnitIdsAlongPath(nextState, playerId, plan.path, plan.unitIds);
        nextState = markPlayerMovedThisRound(nextState, playerId);
      }
      return nextState;
    }
    case "moveStack": {
      const movePath = getMovePathTarget(targets ?? null);
      if (!movePath) {
        return nextState;
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
      const includeChampions = getMoveStackIncludeChampions(card, effect, targets ?? null);
      const resolved = resolveMovePath(nextState, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        forceCount,
        includeChampions,
        stopOnOccupied
      });
      if (!resolved) {
        return nextState;
      }
      nextState = moveUnitIdsAlongPath(
        nextState,
        playerId,
        resolved.path,
        resolved.movingUnitIds
      );
      nextState = markPlayerMovedThisRound(nextState, playerId);
      return nextState;
    }
    default:
      return null;
  }
};

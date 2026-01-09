import {
  areAdjacent,
  parseEdgeKey,
  parseHexKey
} from "@bridgefront/shared";

import type { CardDef } from "./content/cards";
import type { CardPlayTargets, GameState, PlayerID } from "./types";
import {
  getCenterHexKey,
  getBridgeKey,
  isOccupiedByPlayer
} from "./board";
import {
  getEdgeKeyTarget,
  getEdgeKeyTargets,
  getHexKeyTarget,
  getMovePathTarget,
  type TargetRecord
} from "./card-effects-targets";
import { getHexPairTarget } from "./card-effects-targeting";
import { removeForcesFromHex } from "./card-effects-units";

export type BuildBridgePlan = {
  from: string;
  to: string;
  key: string;
};

export const getBuildBridgePlan = (
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

export const getExistingBridgePlan = (
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

export const getBridgePivotPlans = (
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

export const resolveBridgeEffect = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  effect: TargetRecord,
  targets: CardPlayTargets | null
): GameState | null => {
  let nextState = state;

  switch (effect.kind) {
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
          return nextState;
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
        return nextState;
      }
      const plan = getBuildBridgePlan(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!plan) {
        return nextState;
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
      return nextState;
    }
    case "lockBridge": {
      const plan = getExistingBridgePlan(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!plan) {
        return nextState;
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
      return nextState;
    }
    case "trapBridge": {
      const plan = getExistingBridgePlan(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!plan) {
        return nextState;
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
      return nextState;
    }
    case "destroyBridge": {
      const targetSpec = card.targetSpec as TargetRecord;
      if (card.targetSpec.kind === "multiEdge") {
        const plans = getExistingBridgePlans(nextState, playerId, targetSpec, targets ?? null);
        if (!plans || plans.length === 0) {
          return nextState;
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
        return nextState;
      }
      const plan = getExistingBridgePlan(nextState, playerId, targetSpec, targets ?? null);
      if (!plan) {
        return nextState;
      }
      const { [plan.key]: _removed, ...bridges } = nextState.board.bridges;
      nextState = {
        ...nextState,
        board: {
          ...nextState.board,
          bridges
        }
      };
      return nextState;
    }
    case "bridgePivot": {
      const targetSpec = card.targetSpec as TargetRecord;
      const plans = getBridgePivotPlans(nextState, playerId, targetSpec, targets ?? null);
      if (!plans) {
        return nextState;
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
      return nextState;
    }
    case "destroyConnectedBridges": {
      const movePath = targets ? getMovePathTarget(targets) : null;
      const targetHex = movePath ? movePath[movePath.length - 1] : getHexKeyTarget(targets ?? null);
      if (!targetHex) {
        return nextState;
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
      return nextState;
    }
    case "linkHexes": {
      const link = getHexPairTarget(
        nextState,
        playerId,
        card.targetSpec as TargetRecord,
        targets ?? null
      );
      if (!link) {
        return nextState;
      }
      nextState = addHexLinkModifier(nextState, playerId, card.id, link.from, link.to);
      return nextState;
    }
    case "linkCapitalToCenter": {
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player?.capitalHex) {
        return nextState;
      }
      const centerHexKey = getCenterHexKey(nextState.board);
      if (!centerHexKey) {
        return nextState;
      }
      nextState = addHexLinkModifier(
        nextState,
        playerId,
        card.id,
        player.capitalHex,
        centerHexKey
      );
      return nextState;
    }
    default:
      return null;
  }
};

import type { CardDef } from "./content/cards";

import type { BlockState, CardInstanceID, CardPlayTargets, GameState, PlayerID } from "./types";
import {
  isOccupiedByPlayer,
  wouldExceedTwoPlayers
} from "./board";
import {
  addCardToDiscardPile,
  addCardToHandWithOverflow
} from "./cards";
import {
  getCardInstanceTargets,
  getChoiceTarget,
  getEdgeKeyTargets,
  getMovePathTarget,
  getMultiPathTargets,
  type TargetRecord
} from "./card-effects-targets";
import {
  getChampionTarget,
  getHexPairTarget,
  getHexTarget,
  hasFriendlyForceWithinRange
} from "./card-effects-targeting";
import { resolveEconomyEffect } from "./card-effects-economy";
import {
  getBridgePivotPlans,
  getBuildBridgePlan,
  getExistingBridgePlan,
  resolveBridgeEffect
} from "./card-effects-bridges";
import { resolveCombatEffect } from "./card-effects-combat";
import {
  getMoveStackForceCount,
  resolveMovementEffect,
  validateMovePath
} from "./card-effects-movement";
import { resolveChampionCardPlay, resolveUnitEffect } from "./card-effects-units";
import { countPlayerChampions } from "./units";
import { resolveCapitalDeployHex } from "./deploy-utils";
import { markPlayerMovedThisRound } from "./player-flags";

export { validateMovePath };

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
  "gainManaIfTile",
  "drawCards",
  "drawCardsOtherPlayers",
  "rollGold",
  "drawCardsIfTile",
  "drawCardsIfHandEmpty",
  "discardFromHand",
  "burnFromHand",
  "scoutReport",
  "prospecting",
  "gainGoldIfEnemyCapital",
  "gainMarketCards",
  "buildBridge",
  "moveStack",
  "moveStacks",
  "deployForces",
  "recruitByHandSize",
  "deployForcesOnMines",
  "deployRandomChampion",
  "deployForcesIfEnemyInCapital",
  "increaseMineValue",
  "healChampion",
  "healChampions",
  "dealChampionDamage",
  "cataclysmCore",
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
  "pullingStrings",
  "destroyConnectedBridges",
  "linkHexes",
  "linkCapitalToCenter",
  "battleCry",
  "smokeScreen",
  "slow",
  "lastStand",
  "frenzy",
  "shockDrill",
  "focusFire",
  "attrition",
  "encirclement",
  "mortarShot",
  "setToSkirmish",
  "evacuateChampion",
  "recallChampion"
]);

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
  if (!isChampionCard && !hasEffects && card.targetSpec.kind !== "none") {
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
    const getHandEffectCount = (kind: string, defaultCount: number) => {
      const effect = card.effects?.find((entry) => entry.kind === kind) as
        | TargetRecord
        | undefined;
      if (!effect) {
        return 0;
      }
      const rawCount = typeof effect.count === "number" ? effect.count : defaultCount;
      return Math.max(0, Math.floor(rawCount));
    };

    const discardCount = getHandEffectCount("discardFromHand", 1);
    const burnCount = getHandEffectCount("burnFromHand", 1);
    const topdeckCount = getHandEffectCount("topdeckFromHand", 1);

    if (targets == null) {
      if (discardCount > 0 || burnCount > 0) {
        return false;
      }
      return true;
    }

    if (discardCount === 0 && burnCount === 0 && topdeckCount === 0) {
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
    const uniqueIds = new Set(targetIds);
    if (uniqueIds.size !== targetIds.length) {
      return false;
    }
    if (!targetIds.every((id) => player.deck.hand.includes(id))) {
      return false;
    }

    const requiredCount = Math.max(discardCount, burnCount);
    if (requiredCount > 0) {
      return targetIds.length === requiredCount;
    }
    return targetIds.length <= topdeckCount;
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

export const resolveCardEffects = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  targets?: CardPlayTargets
): GameState => {
  let nextState = state;

  const championResult = resolveChampionCardPlay(nextState, playerId, card, targets ?? null);
  if (championResult !== null) {
    nextState = championResult;
  }

  for (const effect of card.effects ?? []) {
    const economyResult = resolveEconomyEffect(nextState, playerId, effect, targets ?? null);
    if (economyResult !== null) {
      nextState = economyResult;
      continue;
    }
    const unitResult = resolveUnitEffect(nextState, playerId, card, effect, targets ?? null);
    if (unitResult !== null) {
      nextState = unitResult;
      continue;
    }
    const combatResult = resolveCombatEffect(nextState, playerId, card, effect, targets ?? null);
    if (combatResult !== null) {
      nextState = combatResult;
      continue;
    }
    const bridgeResult = resolveBridgeEffect(nextState, playerId, card, effect, targets ?? null);
    if (bridgeResult !== null) {
      nextState = bridgeResult;
      continue;
    }
    const movementResult = resolveMovementEffect(nextState, playerId, card, effect, targets ?? null);
    if (movementResult !== null) {
      nextState = movementResult;
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

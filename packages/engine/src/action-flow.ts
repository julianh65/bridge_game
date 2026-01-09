import { areAdjacent, neighborHexKeys, parseEdgeKey, parseHexKey } from "@bridgefront/shared";

import type {
  ActionDeclaration,
  ActionResolutionEntry,
  ActionResolutionState,
  BasicAction,
  BlockState,
  CardPlayDeclaration,
  GameState,
  PlayerID,
  PlayerState
} from "./types";
import { getBridgeKey, isOccupiedByPlayer } from "./board";
import { addCardToBurned, addCardToDiscardPile, removeCardFromHand } from "./cards";
import { resolveCardEffects, isCardPlayable, validateMovePath } from "./card-effects";
import { resolveImmediateBattles } from "./combat";
import type { CardDef } from "./content/cards";
import { getCardDef } from "./content/cards";
import { resolveCapitalDeployHex } from "./deploy-utils";
import { emit } from "./events";
import { getDeployForcesCount, runMoveEvents } from "./modifiers";
import {
  consumeFreeChampionPlay,
  getFreeChampionPlays,
  incrementCardsPlayedThisRound,
  markPlayerMovedThisRound
} from "./player-flags";
import { addForcesToHex, countPlayerChampions, moveStack, selectMovingUnits } from "./units";

const BASIC_ACTION_MANA_COST = 1;
const REINFORCE_GOLD_COST = 1;

type ActionCost = {
  mana: number;
  gold: number;
  usesFreeChampion?: boolean;
};

type BuildBridgePlan = {
  from: string;
  to: string;
  key: string;
};

const getCardDefinition = (state: GameState, cardInstanceId: string) => {
  const instance = state.cardsByInstanceId[cardInstanceId];
  if (!instance) {
    return null;
  }
  return getCardDef(instance.defId) ?? null;
};

const getChampionGoldCost = (card: CardDef, championCount: number): number => {
  if (card.type !== "Champion" || !card.champion) {
    return 0;
  }
  const costs = card.champion.goldCostByChampionCount;
  if (!Array.isArray(costs) || costs.length === 0) {
    return 0;
  }
  const index = Math.min(Math.max(0, championCount), costs.length - 1);
  const cost = Number(costs[index]);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
};

const getDeclarationCost = (
  state: GameState,
  playerId: PlayerID,
  declaration: ActionDeclaration
): ActionCost => {
  if (declaration.kind === "card") {
    const card = getCardDefinition(state, declaration.cardInstanceId);
    if (!card) {
      return { mana: 0, gold: 0 };
    }
    const championGold =
      card.type === "Champion"
        ? getChampionGoldCost(card, countPlayerChampions(state.board, playerId))
        : 0;
    if (card.type === "Champion" && getFreeChampionPlays(state, playerId) > 0) {
      return { mana: 0, gold: 0, usesFreeChampion: true };
    }
    return { mana: card.cost.mana, gold: (card.cost.gold ?? 0) + championGold };
  }

  if (declaration.kind === "basic") {
    if (declaration.action.kind === "capitalReinforce") {
      return { mana: BASIC_ACTION_MANA_COST, gold: REINFORCE_GOLD_COST };
    }

    return { mana: BASIC_ACTION_MANA_COST, gold: 0 };
  }

  return { mana: 0, gold: 0 };
};

const getBuildBridgePlan = (
  state: GameState,
  playerId: PlayerID,
  edgeKey: string
): BuildBridgePlan | null => {
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

  if (!isOccupiedByPlayer(fromHex, playerId) && !isOccupiedByPlayer(toHex, playerId)) {
    return null;
  }

  const canonicalKey = getBridgeKey(rawA, rawB);
  if (state.board.bridges[canonicalKey]) {
    return null;
  }

  return { from: rawA, to: rawB, key: canonicalKey };
};

const canMarch = (
  state: GameState,
  playerId: PlayerID,
  from: string,
  to: string,
  forceCount?: number,
  includeChampions?: boolean
): boolean => {
  const fromHex = state.board.hexes[from];
  const toHex = state.board.hexes[to];
  if (!fromHex || !toHex) {
    return false;
  }

  if (!isOccupiedByPlayer(fromHex, playerId)) {
    return false;
  }

  const options = { maxDistance: 1, requiresBridge: true, requireStartOccupied: true };

  if (
    validateMovePath(state, playerId, [from, to], {
      ...options,
      forceCount,
      includeChampions
    })
  ) {
    return true;
  }

  let neighbors: string[];
  try {
    neighbors = neighborHexKeys(from);
  } catch {
    return false;
  }

  for (const mid of neighbors) {
    if (!state.board.hexes[mid]) {
      continue;
    }
    try {
      if (!areAdjacent(parseHexKey(mid), parseHexKey(to))) {
        continue;
      }
    } catch {
      continue;
    }
    if (
      validateMovePath(state, playerId, [from, mid, to], {
        ...options,
        forceCount,
        includeChampions
      })
    ) {
      return true;
    }
  }

  return false;
};

const getCapitalReinforceHex = (
  state: GameState,
  playerId: PlayerID,
  preferredHex?: string
): string | null => resolveCapitalDeployHex(state, playerId, preferredHex ?? null);

const isBasicActionValid = (state: GameState, playerId: PlayerID, action: BasicAction): boolean => {
  switch (action.kind) {
    case "buildBridge":
      return Boolean(getBuildBridgePlan(state, playerId, action.edgeKey));
    case "march":
      return canMarch(
        state,
        playerId,
        action.from,
        action.to,
        action.forceCount,
        action.includeChampions
      );
    case "capitalReinforce":
      return Boolean(getCapitalReinforceHex(state, playerId, action.hexKey));
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};

const isCardDeclarationValid = (
  state: GameState,
  player: PlayerState,
  declaration: CardPlayDeclaration
): boolean => {
  const card = getCardDefinition(state, declaration.cardInstanceId);
  if (!card) {
    return false;
  }

  if (!player.deck.hand.includes(declaration.cardInstanceId)) {
    return false;
  }

  return isCardPlayable(state, player.id, card, declaration.targets);
};

const isDeclarationValid = (
  state: GameState,
  player: PlayerState,
  declaration: ActionDeclaration
): boolean => {
  if (declaration.kind === "done") {
    return true;
  }

  if (declaration.kind === "basic") {
    return isBasicActionValid(state, player.id, declaration.action);
  }

  if (declaration.kind === "card") {
    return isCardDeclarationValid(state, player, declaration);
  }

  return false;
};

const getLeadOrderedPlayers = (players: PlayerState[], leadSeatIndex: number): PlayerState[] => {
  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const leadIndex = ordered.findIndex((player) => player.seatIndex === leadSeatIndex);
  if (leadIndex <= 0) {
    return ordered;
  }
  return [...ordered.slice(leadIndex), ...ordered.slice(0, leadIndex)];
};

const getBasicActionOrderedPlayers = (
  state: GameState,
  leadOrderedPlayers: PlayerState[]
): PlayerState[] => {
  const factionOrder = state.config.basicActionFactionOrder;
  if (!Array.isArray(factionOrder) || factionOrder.length === 0) {
    return leadOrderedPlayers;
  }

  const factionPriority = new Map(
    factionOrder.map((factionId, index) => [factionId, index])
  );
  const leadIndex = new Map(leadOrderedPlayers.map((player, index) => [player.id, index]));

  return [...leadOrderedPlayers].sort((a, b) => {
    const aPriority = factionPriority.get(a.factionId) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = factionPriority.get(b.factionId) ?? Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return (leadIndex.get(a.id) ?? 0) - (leadIndex.get(b.id) ?? 0);
  });
};

const finalizeCardPlay = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: string,
  card: CardDef | null
): GameState => {
  if (card && (card.burn || card.type === "Champion")) {
    return addCardToBurned(state, playerId, cardInstanceId);
  }
  return addCardToDiscardPile(state, playerId, cardInstanceId);
};

export const createActionStepBlock = (state: GameState): BlockState | null => {
  const eligible = state.players
    .filter((player) => player.resources.mana >= 1 && !player.doneThisRound)
    .map((player) => player.id);

  if (eligible.length === 0) {
    return null;
  }

  return {
    type: "actionStep.declarations",
    waitingFor: eligible,
    payload: {
      declarations: Object.fromEntries(eligible.map((playerId) => [playerId, null])),
      startedAt: Date.now()
    }
  };
};

const buildActionResolutionEntries = (
  state: GameState,
  declarations: Record<PlayerID, ActionDeclaration | null>
): ActionResolutionEntry[] => {
  const orderedPlayers = getLeadOrderedPlayers(state.players, state.leadSeatIndex);
  const basicActionOrder = getBasicActionOrderedPlayers(state, orderedPlayers);
  const leadOrderIndex = new Map(
    orderedPlayers.map((player, index) => [player.id, index])
  );

  const cardPlays: Array<{
    player: PlayerState;
    declaration: CardPlayDeclaration;
    card: CardDef | null;
  }> = [];

  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (declaration?.kind === "card") {
      cardPlays.push({
        player,
        declaration,
        card: getCardDefinition(state, declaration.cardInstanceId)
      });
    }
  }

  const orderedCardPlays = [...cardPlays].sort((a, b) => {
    const aInitiative = a.card?.initiative ?? Number.MAX_SAFE_INTEGER;
    const bInitiative = b.card?.initiative ?? Number.MAX_SAFE_INTEGER;
    if (aInitiative !== bInitiative) {
      return aInitiative - bInitiative;
    }
    return (leadOrderIndex.get(a.player.id) ?? 0) - (leadOrderIndex.get(b.player.id) ?? 0);
  });

  const entries: ActionResolutionEntry[] = [];
  for (const entry of orderedCardPlays) {
    entries.push({
      kind: "card",
      playerId: entry.player.id,
      cardInstanceId: entry.declaration.cardInstanceId,
      targets: entry.declaration.targets ?? null
    });
  }

  for (const player of basicActionOrder) {
    const declaration = declarations[player.id];
    if (declaration?.kind === "basic") {
      entries.push({ kind: "basic", playerId: player.id, action: declaration.action });
    }
  }

  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (declaration?.kind === "done") {
      entries.push({ kind: "done", playerId: player.id });
    }
  }

  return entries;
};

export const createActionResolutionState = (
  state: GameState,
  declarations: Record<PlayerID, ActionDeclaration | null>
): ActionResolutionState => {
  return {
    entries: buildActionResolutionEntries(state, declarations),
    index: 0
  };
};

export const applyActionDeclaration = (
  state: GameState,
  declaration: ActionDeclaration,
  playerId: PlayerID
): GameState => {
  if (state.phase !== "round.action") {
    return state;
  }

  const block = state.blocks;
  if (!block || block.type !== "actionStep.declarations") {
    return state;
  }

  if (!block.waitingFor.includes(playerId)) {
    return state;
  }

  if (block.payload.declarations[playerId]) {
    return state;
  }

  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return state;
  }

  if (!isDeclarationValid(state, player, declaration)) {
    return state;
  }

  const cost = getDeclarationCost(state, playerId, declaration);
  if (player.resources.mana < cost.mana || player.resources.gold < cost.gold) {
    return state;
  }

  const startedAt = block.payload.startedAt;
  const elapsedMs =
    typeof startedAt === "number" && Number.isFinite(startedAt)
      ? Math.max(0, Date.now() - startedAt)
      : null;

  const nextPlayers = state.players.map((entry) =>
    entry.id === playerId
      ? (() => {
          const timing = entry.timing ?? {
            actionCount: 0,
            actionTotalMs: 0,
            lastActionMs: null
          };
          return {
            ...entry,
            resources: {
              gold: entry.resources.gold - cost.gold,
              mana: entry.resources.mana - cost.mana
            },
            timing:
              elapsedMs === null
                ? timing
                : {
                    ...timing,
                    actionCount: timing.actionCount + 1,
                    actionTotalMs: timing.actionTotalMs + elapsedMs,
                    lastActionMs: elapsedMs
                  }
          };
        })()
      : entry
  );

  let nextState: GameState = {
    ...state,
    players: nextPlayers,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        declarations: {
          ...block.payload.declarations,
          [playerId]: declaration
        }
      }
    }
  };

  if (cost.usesFreeChampion) {
    nextState = consumeFreeChampionPlay(nextState, playerId);
  }

  if (declaration.kind === "card") {
    nextState = removeCardFromHand(nextState, playerId, declaration.cardInstanceId);
    nextState = incrementCardsPlayedThisRound(nextState, playerId);
  }

  return nextState;
};

export const resolveActionStep = (
  state: GameState,
  declarations: Record<PlayerID, ActionDeclaration | null>
): GameState => {
  const entries = buildActionResolutionEntries(state, declarations);
  let nextState = state;
  for (const entry of entries) {
    nextState = resolveActionEntry(nextState, entry);
    if (nextState.blocks?.type === "combat.retreat") {
      return nextState;
    }
  }

  return nextState;
};

const resolveBasicAction = (state: GameState, playerId: PlayerID, action: BasicAction): GameState => {
  switch (action.kind) {
    case "buildBridge":
      return resolveBuildBridge(state, playerId, action.edgeKey);
    case "march":
      return resolveMarch(
        state,
        playerId,
        action.from,
        action.to,
        action.forceCount,
        action.includeChampions
      );
    case "capitalReinforce":
      return resolveCapitalReinforce(state, playerId, action.hexKey);
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
};

function resolveActionEntry(state: GameState, entry: ActionResolutionEntry): GameState {
  if (entry.kind === "card") {
    const card = getCardDefinition(state, entry.cardInstanceId);
    const cardId = card?.id ?? "unknown";
    let nextState = emit(state, {
      type: `action.card.${cardId}`,
      payload: {
        playerId: entry.playerId,
        cardId,
        targets: entry.targets ?? null
      }
    });
    if (card) {
      nextState = resolveCardEffects(nextState, entry.playerId, card, entry.targets ?? null);
    }
    nextState = finalizeCardPlay(nextState, entry.playerId, entry.cardInstanceId, card);
    return resolveImmediateBattles(nextState);
  }

  if (entry.kind === "basic") {
    let nextState = emit(state, {
      type: `action.basic.${entry.action.kind}`,
      payload: { playerId: entry.playerId, action: entry.action }
    });
    nextState = resolveBasicAction(nextState, entry.playerId, entry.action);
    return resolveImmediateBattles(nextState);
  }

  let nextState = emit(state, {
    type: "action.done",
    payload: { playerId: entry.playerId }
  });
  nextState = {
    ...nextState,
    players: nextState.players.map((player) =>
      player.id === entry.playerId ? { ...player, doneThisRound: true } : player
    )
  };
  return nextState;
}

export const resolveNextActionEntry = (state: GameState): GameState => {
  const pending = state.actionResolution;
  if (!pending) {
    return state;
  }
  const entry = pending.entries[pending.index];
  if (!entry) {
    return {
      ...state,
      actionResolution: undefined
    };
  }

  const nextState = resolveActionEntry(state, entry);
  const nextIndex = pending.index + 1;
  if (nextIndex >= pending.entries.length) {
    return {
      ...nextState,
      actionResolution: undefined
    };
  }

  return {
    ...nextState,
    actionResolution: {
      entries: pending.entries,
      index: nextIndex
    }
  };
};

const resolveBuildBridge = (state: GameState, playerId: PlayerID, edgeKey: string): GameState => {
  const plan = getBuildBridgePlan(state, playerId, edgeKey);
  if (!plan) {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      bridges: {
        ...state.board.bridges,
        [plan.key]: {
          key: plan.key,
          from: plan.from,
          to: plan.to,
          ownerPlayerId: playerId
        }
      }
    }
  };
};

const resolveMarch = (
  state: GameState,
  playerId: PlayerID,
  from: string,
  to: string,
  forceCount?: number,
  includeChampions?: boolean
): GameState => {
  if (!canMarch(state, playerId, from, to, forceCount, includeChampions)) {
    return state;
  }

  const movingUnitIds = selectMovingUnits(
    state.board,
    playerId,
    from,
    forceCount,
    includeChampions
  );
  if (movingUnitIds.length === 0) {
    return state;
  }

  let nextState: GameState = {
    ...state,
    board: moveStack(state.board, playerId, from, to, forceCount, includeChampions)
  };
  nextState = runMoveEvents(nextState, { playerId, from, to, path: [from, to], movingUnitIds });
  return markPlayerMovedThisRound(nextState, playerId);
};

const resolveCapitalReinforce = (
  state: GameState,
  playerId: PlayerID,
  preferredHex?: string
): GameState => {
  const capitalHex = getCapitalReinforceHex(state, playerId, preferredHex);
  if (!capitalHex) {
    return state;
  }

  const baseCount = 1;
  const count = getDeployForcesCount(state, { playerId, hexKey: capitalHex, baseCount }, baseCount);

  return {
    ...state,
    board: addForcesToHex(state.board, playerId, capitalHex, count)
  };
};

import { areAdjacent, neighborHexKeys, parseEdgeKey, parseHexKey } from "@bridgefront/shared";

import type {
  ActionDeclaration,
  BasicAction,
  BlockState,
  CardPlayDeclaration,
  GameState,
  PlayerID,
  PlayerState
} from "./types";
import { getBridgeKey, isOccupiedByPlayer, wouldExceedTwoPlayers } from "./board";
import { addCardToBurned, addCardToDiscardPile, removeCardFromHand } from "./cards";
import { resolveCardEffects, isCardPlayable, validateMovePath } from "./card-effects";
import { resolveImmediateBattles } from "./combat";
import type { CardDef } from "./content/cards";
import { getCardDef } from "./content/cards";
import { emit } from "./events";
import { getDeployForcesCount } from "./modifiers";
import { markPlayerMovedThisRound } from "./player-flags";
import { addForcesToHex, countPlayerChampions, moveStack } from "./units";

const BASIC_ACTION_MANA_COST = 1;
const REINFORCE_GOLD_COST = 1;

type ActionCost = {
  mana: number;
  gold: number;
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

const canMarch = (state: GameState, playerId: PlayerID, from: string, to: string): boolean => {
  const fromHex = state.board.hexes[from];
  const toHex = state.board.hexes[to];
  if (!fromHex || !toHex) {
    return false;
  }

  if (!isOccupiedByPlayer(fromHex, playerId)) {
    return false;
  }

  const options = { maxDistance: 1, requiresBridge: true, requireStartOccupied: true };

  try {
    if (areAdjacent(parseHexKey(from), parseHexKey(to))) {
      return Boolean(validateMovePath(state, playerId, [from, to], options));
    }
  } catch {
    return false;
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
    if (validateMovePath(state, playerId, [from, mid, to], options)) {
      return true;
    }
  }

  return false;
};

const getCapitalReinforceHex = (state: GameState, playerId: PlayerID): string | null => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return null;
  }

  const capitalHex = state.board.hexes[player.capitalHex];
  if (!capitalHex) {
    return null;
  }

  if (wouldExceedTwoPlayers(capitalHex, playerId)) {
    return null;
  }

  return player.capitalHex;
};

const isBasicActionValid = (state: GameState, playerId: PlayerID, action: BasicAction): boolean => {
  switch (action.kind) {
    case "buildBridge":
      return Boolean(getBuildBridgePlan(state, playerId, action.edgeKey));
    case "march":
      return canMarch(state, playerId, action.from, action.to);
    case "capitalReinforce":
      return Boolean(getCapitalReinforceHex(state, playerId));
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
      declarations: Object.fromEntries(eligible.map((playerId) => [playerId, null]))
    }
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

  const nextPlayers = state.players.map((entry) =>
    entry.id === playerId
      ? {
          ...entry,
          resources: {
            gold: entry.resources.gold - cost.gold,
            mana: entry.resources.mana - cost.mana
          }
        }
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

  if (declaration.kind === "card") {
    nextState = removeCardFromHand(nextState, playerId, declaration.cardInstanceId);
  }

  return nextState;
};

export const resolveActionStep = (
  state: GameState,
  declarations: Record<PlayerID, ActionDeclaration | null>
): GameState => {
  let nextState = state;
  const orderedPlayers = getLeadOrderedPlayers(state.players, state.leadSeatIndex);
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

  for (const entry of orderedCardPlays) {
    const cardId = entry.card?.id ?? "unknown";
    nextState = emit(nextState, {
      type: `action.card.${cardId}`,
      payload: {
        playerId: entry.player.id,
        cardId
      }
    });
    if (entry.card) {
      nextState = resolveCardEffects(
        nextState,
        entry.player.id,
        entry.card,
        entry.declaration.targets
      );
    }
    nextState = finalizeCardPlay(
      nextState,
      entry.player.id,
      entry.declaration.cardInstanceId,
      entry.card
    );
    nextState = resolveImmediateBattles(nextState);
  }

  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (!declaration || declaration.kind !== "basic") {
      continue;
    }

    nextState = emit(nextState, {
      type: `action.basic.${declaration.action.kind}`,
      payload: { playerId: player.id, action: declaration.action }
    });
    nextState = resolveBasicAction(nextState, player.id, declaration.action);
    nextState = resolveImmediateBattles(nextState);
  }

  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (!declaration || declaration.kind !== "done") {
      continue;
    }
    nextState = emit(nextState, {
      type: "action.done",
      payload: { playerId: player.id }
    });
    nextState = {
      ...nextState,
      players: nextState.players.map((entry) =>
        entry.id === player.id ? { ...entry, doneThisRound: true } : entry
      )
    };
  }

  return nextState;
};

const resolveBasicAction = (state: GameState, playerId: PlayerID, action: BasicAction): GameState => {
  switch (action.kind) {
    case "buildBridge":
      return resolveBuildBridge(state, playerId, action.edgeKey);
    case "march":
      return resolveMarch(state, playerId, action.from, action.to);
    case "capitalReinforce":
      return resolveCapitalReinforce(state, playerId);
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
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

const resolveMarch = (state: GameState, playerId: PlayerID, from: string, to: string): GameState => {
  if (!canMarch(state, playerId, from, to)) {
    return state;
  }

  const movedState = {
    ...state,
    board: moveStack(state.board, playerId, from, to)
  };
  return markPlayerMovedThisRound(movedState, playerId);
};

const resolveCapitalReinforce = (state: GameState, playerId: PlayerID): GameState => {
  const capitalHex = getCapitalReinforceHex(state, playerId);
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

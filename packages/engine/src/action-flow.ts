import { areAdjacent, parseEdgeKey, parseHexKey } from "@bridgefront/shared";

import type {
  ActionDeclaration,
  BasicAction,
  BlockState,
  GameState,
  PlayerID,
  PlayerState
} from "./types";
import { getBridgeKey, hasBridge, isOccupiedByPlayer, wouldExceedTwoPlayers } from "./board";
import { addForcesToHex, moveStack } from "./units";

const BASIC_ACTION_MANA_COST = 1;
const REINFORCE_GOLD_COST = 1;

type ActionCost = {
  mana: number;
  gold: number;
};

const getDeclarationCost = (declaration: ActionDeclaration): ActionCost => {
  if (declaration.kind !== "basic") {
    return { mana: 0, gold: 0 };
  }

  if (declaration.action.kind === "capitalReinforce") {
    return { mana: BASIC_ACTION_MANA_COST, gold: REINFORCE_GOLD_COST };
  }

  return { mana: BASIC_ACTION_MANA_COST, gold: 0 };
};

const getLeadOrderedPlayers = (players: PlayerState[], leadSeatIndex: number): PlayerState[] => {
  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const leadIndex = ordered.findIndex((player) => player.seatIndex === leadSeatIndex);
  if (leadIndex <= 0) {
    return ordered;
  }
  return [...ordered.slice(leadIndex), ...ordered.slice(0, leadIndex)];
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

  const cost = getDeclarationCost(declaration);
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

  return {
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
};

export const resolveActionStep = (
  state: GameState,
  declarations: Record<PlayerID, ActionDeclaration | null>
): GameState => {
  let nextState = state;
  const orderedPlayers = getLeadOrderedPlayers(state.players, state.leadSeatIndex);

  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (!declaration) {
      continue;
    }

    if (declaration.kind === "done") {
      nextState = {
        ...nextState,
        players: nextState.players.map((entry) =>
          entry.id === player.id ? { ...entry, doneThisRound: true } : entry
        )
      };
      continue;
    }

    nextState = resolveBasicAction(nextState, player.id, declaration.action);
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
  let rawA: string;
  let rawB: string;
  try {
    [rawA, rawB] = parseEdgeKey(edgeKey);
  } catch {
    return state;
  }

  const fromHex = state.board.hexes[rawA];
  const toHex = state.board.hexes[rawB];
  if (!fromHex || !toHex) {
    return state;
  }

  if (!areAdjacent(parseHexKey(rawA), parseHexKey(rawB))) {
    return state;
  }

  if (!isOccupiedByPlayer(fromHex, playerId) && !isOccupiedByPlayer(toHex, playerId)) {
    return state;
  }

  const canonicalKey = getBridgeKey(rawA, rawB);
  if (state.board.bridges[canonicalKey]) {
    return state;
  }

  return {
    ...state,
    board: {
      ...state.board,
      bridges: {
        ...state.board.bridges,
        [canonicalKey]: {
          key: canonicalKey,
          from: rawA,
          to: rawB,
          ownerPlayerId: playerId
        }
      }
    }
  };
};

const resolveMarch = (state: GameState, playerId: PlayerID, from: string, to: string): GameState => {
  const fromHex = state.board.hexes[from];
  const toHex = state.board.hexes[to];
  if (!fromHex || !toHex) {
    return state;
  }

  if (!areAdjacent(parseHexKey(from), parseHexKey(to))) {
    return state;
  }

  if (!hasBridge(state.board, from, to)) {
    return state;
  }

  if (!isOccupiedByPlayer(fromHex, playerId)) {
    return state;
  }

  if (wouldExceedTwoPlayers(toHex, playerId)) {
    return state;
  }

  return {
    ...state,
    board: moveStack(state.board, playerId, from, to)
  };
};

const resolveCapitalReinforce = (state: GameState, playerId: PlayerID): GameState => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return state;
  }

  const capitalHex = state.board.hexes[player.capitalHex];
  if (!capitalHex) {
    return state;
  }

  if (wouldExceedTwoPlayers(capitalHex, playerId)) {
    return state;
  }

  return {
    ...state,
    board: addForcesToHex(state.board, playerId, player.capitalHex, 1)
  };
};

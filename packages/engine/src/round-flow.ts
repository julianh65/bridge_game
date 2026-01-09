import { shuffle } from "@bridgefront/shared";

import type {
  BlockState,
  CardDefId,
  CardInstanceID,
  CollectionChoice,
  CollectionPrompt,
  GameState,
  HexKey,
  PlayerID,
  PlayerState,
  RoundEndContext
} from "./types";
import { getPlayerIdsOnHex, hasEnemyUnits } from "./board";
import {
  createCardInstance,
  discardCardFromHand,
  drawToHandSize,
  insertCardIntoDrawPileRandom,
  scrapCardFromHand
} from "./cards";
import { refreshChampionAbilityUsesForRound } from "./champions";
import { hasCipherQuietStudy } from "./faction-passives";
import {
  applyModifierQuery,
  expireEndOfRoundModifiers,
  getCardChoiceCount,
  getControlBonus,
  getControlValue,
  runModifierEvents
} from "./modifiers";
import {
  CARDS_DISCARDED_THIS_ROUND_FLAG,
  CARDS_PLAYED_THIS_ROUND_FLAG,
  MOVED_THIS_ROUND_FLAG
} from "./player-flags";

const MINE_OVERSEER_CHAMPION_ID = "champion.prospect.mine_overseer";
const QUIET_STUDY_MAX_DISCARD = 2;

export const applyRoundReset = (state: GameState): GameState => {
  const nextRound = state.round + 1;
  const playerCount = state.players.length;
  let nextState: GameState = {
    ...state,
    round: nextRound,
    leadSeatIndex: playerCount > 0 ? (nextRound - 1) % playerCount : 0,
    players: state.players.map((player) => ({
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold + state.config.BASE_INCOME,
        mana: state.config.MAX_MANA
      },
      doneThisRound: false,
      flags: {
        ...player.flags,
        [MOVED_THIS_ROUND_FLAG]: false,
        [CARDS_PLAYED_THIS_ROUND_FLAG]: 0,
        [CARDS_DISCARDED_THIS_ROUND_FLAG]: 0
      }
    }))
  };

  nextState = refreshChampionAbilityUsesForRound(nextState);

  for (const player of nextState.players) {
    nextState = drawToHandSize(nextState, player.id, state.config.HAND_DRAW_SIZE);
  }

  return {
    ...nextState,
    phase: "round.market"
  };
};

export const createQuietStudyBlock = (state: GameState): BlockState | null => {
  const quietStudyPlayers = state.players
    .filter((player) => hasCipherQuietStudy(state, player.id))
    .map((player) => player.id);

  if (quietStudyPlayers.length === 0) {
    return null;
  }

  return {
    type: "round.quietStudy",
    waitingFor: quietStudyPlayers,
    payload: {
      maxDiscard: QUIET_STUDY_MAX_DISCARD,
      choices: Object.fromEntries(quietStudyPlayers.map((playerId) => [playerId, null]))
    }
  };
};

const isQuietStudyChoiceValid = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceIds: CardInstanceID[],
  maxDiscard: number
): boolean => {
  if (cardInstanceIds.length > maxDiscard) {
    return false;
  }

  const uniqueIds = new Set(cardInstanceIds);
  if (uniqueIds.size !== cardInstanceIds.length) {
    return false;
  }

  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return false;
  }

  return cardInstanceIds.every((id) => player.deck.hand.includes(id));
};

export const applyQuietStudyChoice = (
  state: GameState,
  cardInstanceIds: CardInstanceID[],
  playerId: PlayerID
): GameState => {
  if (state.phase !== "round.study") {
    return state;
  }

  const block = state.blocks;
  if (!block || block.type !== "round.quietStudy") {
    return state;
  }

  if (!block.waitingFor.includes(playerId)) {
    return state;
  }

  if (block.payload.choices[playerId]) {
    return state;
  }

  if (!isQuietStudyChoiceValid(state, playerId, cardInstanceIds, block.payload.maxDiscard)) {
    return state;
  }

  return {
    ...state,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        choices: {
          ...block.payload.choices,
          [playerId]: cardInstanceIds
        }
      }
    }
  };
};

export const resolveQuietStudyChoices = (state: GameState): GameState => {
  const block = state.blocks;
  if (!block || block.type !== "round.quietStudy") {
    return state;
  }

  let nextState = state;
  for (const player of state.players) {
    const selected = block.payload.choices[player.id] ?? [];
    if (selected.length === 0) {
      continue;
    }
    for (const cardInstanceId of selected) {
      nextState = discardCardFromHand(nextState, player.id, cardInstanceId, {
        countAsDiscard: true
      });
    }
    nextState = drawToHandSize(nextState, player.id, state.config.HAND_DRAW_SIZE);
  }

  return nextState;
};

type DeckDraw = {
  drawn: CardDefId[];
  remaining: CardDefId[];
};

const takeFromDeck = (deck: CardDefId[], count: number): DeckDraw => {
  if (count <= 0 || deck.length === 0) {
    return { drawn: [], remaining: deck };
  }
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
};

const getSeatOrderedPlayers = (players: PlayerState[]): PlayerState[] => {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
};

const getPromptKey = (kind: CollectionPrompt["kind"], hexKey: string) => `${kind}:${hexKey}`;

const getPlayer = (state: GameState, playerId: PlayerID) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`player not found: ${playerId}`);
  }
  return player;
};

const addGold = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (amount <= 0) {
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

const hasMineOverseer = (state: GameState, playerId: PlayerID, hexKey: HexKey): boolean => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return false;
  }
  const unitIds = hex.occupants[playerId] ?? [];
  return unitIds.some((unitId) => {
    const unit = state.board.units[unitId];
    return unit?.kind === "champion" && unit.cardDefId === MINE_OVERSEER_CHAMPION_ID;
  });
};

const getMineGoldValue = (
  state: GameState,
  playerId: PlayerID,
  hexKey: HexKey,
  mineValue: number
): number => {
  const baseValue = mineValue + (hasMineOverseer(state, playerId, hexKey) ? 1 : 0);
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMineGoldValue,
    { playerId, hexKey, mineValue },
    baseValue
  );
};

const getChoiceCount = (
  state: GameState,
  playerId: PlayerID,
  kind: "freeStartingCard" | "forgeDraft" | "centerPick",
  baseCount: number
): number => {
  const rawCount = getCardChoiceCount(
    state,
    { playerId, kind, baseCount },
    baseCount
  );
  const normalized = Number.isFinite(rawCount) ? Math.floor(rawCount) : baseCount;
  return Math.max(baseCount, normalized);
};

const returnToBottomRandom = (
  state: GameState,
  deck: CardDefId[],
  cardIds: CardDefId[]
): { state: GameState; deck: CardDefId[] } => {
  if (cardIds.length === 0) {
    return { state, deck };
  }
  if (cardIds.length === 1) {
    return { state, deck: [...deck, ...cardIds] };
  }
  const { value, next } = shuffle(state.rngState, cardIds);
  return { state: { ...state, rngState: next }, deck: [...deck, ...value] };
};

const buildCollectionPrompts = (state: GameState): Record<PlayerID, CollectionPrompt[]> => {
  const prompts: Record<PlayerID, CollectionPrompt[]> = Object.fromEntries(
    state.players.map((player) => [player.id, []])
  );

  const specialHexes = Object.values(state.board.hexes)
    .filter((hex) => hex.tile === "forge" || hex.tile === "center")
    .sort((a, b) => a.key.localeCompare(b.key));

  for (const hex of specialHexes) {
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const playerId = occupants[0];
    if (!prompts[playerId]) {
      continue;
    }
    if (hex.tile === "forge") {
      prompts[playerId].push({
        kind: "forge",
        hexKey: hex.key,
        revealed: []
      });
    } else if (hex.tile === "center") {
      prompts[playerId].push({
        kind: "center",
        hexKey: hex.key,
        revealed: []
      });
    }
  }

  return prompts;
};

const applyMineGoldCollection = (state: GameState): GameState => {
  const mineHexes = Object.values(state.board.hexes)
    .filter((hex) => hex.tile === "mine")
    .sort((a, b) => a.key.localeCompare(b.key));

  let nextState = state;
  for (const hex of mineHexes) {
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const playerId = occupants[0];
    const mineGold = getMineGoldValue(nextState, playerId, hex.key, hex.mineValue ?? 0);
    nextState = addGold(nextState, playerId, mineGold);
  }

  return nextState;
};

export const createCollectionBlock = (
  state: GameState
): { state: GameState; block: BlockState | null } => {
  const stateWithMineGold = applyMineGoldCollection(state);
  const promptsByPlayer = buildCollectionPrompts(stateWithMineGold);
  const playersInSeatOrder = getSeatOrderedPlayers(stateWithMineGold.players);

  const currentAge = stateWithMineGold.market.age;
  let marketDeck = stateWithMineGold.marketDecks[currentAge] ?? [];
  let powerDeck = stateWithMineGold.powerDecks[currentAge] ?? [];
  const nextPrompts: Record<PlayerID, CollectionPrompt[]> = { ...promptsByPlayer };

  for (const player of playersInSeatOrder) {
    const prompts = promptsByPlayer[player.id] ?? [];
    if (prompts.length === 0) {
      continue;
    }
    const resolved: CollectionPrompt[] = [];
    for (const prompt of prompts) {
      let drawn: CardDefId[] = [];
      if (prompt.kind === "forge") {
        const drawCount = getChoiceCount(stateWithMineGold, player.id, "forgeDraft", 3);
        const draw = takeFromDeck(marketDeck, drawCount);
        drawn = draw.drawn;
        marketDeck = draw.remaining;
      } else if (prompt.kind === "center") {
        const drawCount = getChoiceCount(stateWithMineGold, player.id, "centerPick", 2);
        const draw = takeFromDeck(powerDeck, drawCount);
        drawn = draw.drawn;
        powerDeck = draw.remaining;
      }
      if (prompt.kind === "center" && drawn.length === 0) {
        continue;
      }
      resolved.push({ ...prompt, revealed: drawn });
    }
    nextPrompts[player.id] = resolved;
  }

  const waitingFor = playersInSeatOrder
    .filter((player) => (nextPrompts[player.id] ?? []).length > 0)
    .map((player) => player.id);

  if (waitingFor.length === 0) {
    return {
      state: {
        ...stateWithMineGold,
        marketDecks: {
          ...stateWithMineGold.marketDecks,
          [currentAge]: marketDeck
        },
        powerDecks: {
          ...stateWithMineGold.powerDecks,
          [currentAge]: powerDeck
        }
      },
      block: null
    };
  }

  const nextState: GameState = {
    ...stateWithMineGold,
    marketDecks: {
      ...stateWithMineGold.marketDecks,
      [currentAge]: marketDeck
    },
    powerDecks: {
      ...stateWithMineGold.powerDecks,
      [currentAge]: powerDeck
    }
  };

  return {
    state: nextState,
    block: {
      type: "collection.choices",
      waitingFor,
      payload: {
        prompts: nextPrompts,
        choices: Object.fromEntries(
          stateWithMineGold.players.map((player) => [player.id, null])
        ) as Record<PlayerID, CollectionChoice[] | null>
      }
    }
  };
};

const isCollectionChoiceValid = (
  state: GameState,
  playerId: PlayerID,
  prompt: CollectionPrompt,
  choice: CollectionChoice
): boolean => {
  if (prompt.kind !== choice.kind || prompt.hexKey !== choice.hexKey) {
    return false;
  }

  if (choice.kind === "forge") {
    if (choice.choice === "reforge") {
      const player = getPlayer(state, playerId);
      return player.deck.hand.includes(choice.scrapCardId);
    }
    return prompt.revealed.includes(choice.cardId);
  }

  if (choice.kind === "center") {
    return prompt.revealed.includes(choice.cardId);
  }

  return false;
};

const areCollectionChoicesValid = (
  state: GameState,
  playerId: PlayerID,
  prompts: CollectionPrompt[],
  choices: CollectionChoice[]
): boolean => {
  if (choices.length !== prompts.length) {
    return false;
  }

  const promptMap = new Map<string, CollectionPrompt>(
    prompts.map((prompt) => [getPromptKey(prompt.kind, prompt.hexKey), prompt])
  );
  const seen = new Set<string>();

  for (const choice of choices) {
    const key = getPromptKey(choice.kind, choice.hexKey);
    if (seen.has(key)) {
      return false;
    }
    const prompt = promptMap.get(key);
    if (!prompt) {
      return false;
    }
    if (!isCollectionChoiceValid(state, playerId, prompt, choice)) {
      return false;
    }
    seen.add(key);
  }

  return seen.size === prompts.length;
};

export const applyCollectionChoice = (
  state: GameState,
  choices: CollectionChoice[],
  playerId: PlayerID
): GameState => {
  if (state.phase !== "round.collection") {
    return state;
  }

  const block = state.blocks;
  if (!block || block.type !== "collection.choices") {
    return state;
  }

  if (!block.waitingFor.includes(playerId)) {
    return state;
  }

  if (block.payload.choices[playerId]) {
    return state;
  }

  const prompts = block.payload.prompts[playerId] ?? [];
  if (prompts.length === 0) {
    return state;
  }

  if (!areCollectionChoicesValid(state, playerId, prompts, choices)) {
    return state;
  }

  return {
    ...state,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        choices: {
          ...block.payload.choices,
          [playerId]: choices
        }
      }
    }
  };
};

export const resolveCollectionChoices = (state: GameState): GameState => {
  const block = state.blocks;
  if (!block || block.type !== "collection.choices") {
    return state;
  }

  const currentAge = state.market.age;
  let marketDeck = state.marketDecks[currentAge] ?? [];
  let powerDeck = state.powerDecks[currentAge] ?? [];
  let nextState: GameState = state;
  const playersInSeatOrder = getSeatOrderedPlayers(state.players);

  for (const player of playersInSeatOrder) {
    const prompts = block.payload.prompts[player.id] ?? [];
    const choices = block.payload.choices[player.id] ?? [];
    if (prompts.length === 0) {
      continue;
    }
    const choiceMap = new Map(
      choices.map((choice) => [getPromptKey(choice.kind, choice.hexKey), choice])
    );

    for (const prompt of prompts) {
      const choice = choiceMap.get(getPromptKey(prompt.kind, prompt.hexKey));
      if (!choice) {
        continue;
      }

      if (choice.kind === "forge") {
        if (choice.choice === "reforge") {
          nextState = scrapCardFromHand(nextState, player.id, choice.scrapCardId);
          const returned = returnToBottomRandom(nextState, marketDeck, prompt.revealed);
          nextState = returned.state;
          marketDeck = returned.deck;
        } else if (prompt.revealed.includes(choice.cardId)) {
          const leftovers = prompt.revealed.filter((cardId) => cardId !== choice.cardId);
          const returned = returnToBottomRandom(nextState, marketDeck, leftovers);
          nextState = returned.state;
          marketDeck = returned.deck;
          const created = createCardInstance(nextState, choice.cardId);
          nextState = insertCardIntoDrawPileRandom(
            created.state,
            player.id,
            created.instanceId
          );
        }
      } else if (choice.kind === "center") {
        if (prompt.revealed.includes(choice.cardId)) {
          const leftovers = prompt.revealed.filter((cardId) => cardId !== choice.cardId);
          const returned = returnToBottomRandom(nextState, powerDeck, leftovers);
          nextState = returned.state;
          powerDeck = returned.deck;
          const created = createCardInstance(nextState, choice.cardId);
          nextState = insertCardIntoDrawPileRandom(
            created.state,
            player.id,
            created.instanceId
          );
        }
      }
    }
  }

  return {
    ...nextState,
    marketDecks: {
      ...nextState.marketDecks,
      [currentAge]: marketDeck
    },
    powerDecks: {
      ...nextState.powerDecks,
      [currentAge]: powerDeck
    }
  };
};

type ControlTotals = Record<PlayerID, number>;

const addControl = (totals: ControlTotals, playerId: PlayerID, amount: number) => {
  if (amount <= 0) {
    return totals;
  }
  return {
    ...totals,
    [playerId]: (totals[playerId] ?? 0) + amount
  };
};

export const getControlTotals = (state: GameState): ControlTotals => {
  let controlTotals: ControlTotals = {};

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.tile !== "center" && hex.tile !== "forge" && hex.tile !== "capital") {
      continue;
    }
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const occupant = occupants[0];
    let baseControl = 0;
    if (hex.tile === "center" || hex.tile === "forge") {
      baseControl = 1;
    } else if (hex.tile === "capital" && hex.ownerPlayerId && hex.ownerPlayerId !== occupant) {
      baseControl = 1;
    }
    if (baseControl <= 0) {
      continue;
    }
    const adjusted = getControlValue(
      state,
      { playerId: occupant, hexKey: hex.key, tile: hex.tile, baseValue: baseControl },
      baseControl
    );
    controlTotals = addControl(controlTotals, occupant, adjusted);
  }

  return controlTotals;
};

const resolveTiebreak = (players: GameState["players"]): PlayerID | null => {
  if (players.length === 0) {
    return null;
  }

  const sorted = [...players].sort((a, b) => {
    if (a.vp.total !== b.vp.total) {
      return b.vp.total - a.vp.total;
    }
    if (a.vp.permanent !== b.vp.permanent) {
      return b.vp.permanent - a.vp.permanent;
    }
    if (a.resources.gold !== b.resources.gold) {
      return b.resources.gold - a.resources.gold;
    }
    return a.seatIndex - b.seatIndex;
  });

  return sorted[0]?.id ?? null;
};

const capitalIsSafe = (state: GameState, playerId: PlayerID): boolean => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return false;
  }
  const capital = state.board.hexes[player.capitalHex];
  if (!capital) {
    return false;
  }
  return !hasEnemyUnits(capital, playerId);
};

export const applyScoring = (state: GameState): GameState => {
  const controlTotals = getControlTotals(state);

  const players = state.players.map((player) => {
    const controlBonus = getControlBonus(state, { playerId: player.id }, 0);
    const control = (controlTotals[player.id] ?? 0) + controlBonus;
    const total = player.vp.permanent + control;
    return {
      ...player,
      vp: {
        ...player.vp,
        control,
        total
      }
    };
  });

  let winnerPlayerId: PlayerID | null = null;
  const eligibleWinners = players.filter(
    (player) =>
      player.vp.total >= state.config.VP_TO_WIN && capitalIsSafe(state, player.id)
  );

  if (eligibleWinners.length > 0) {
    winnerPlayerId = resolveTiebreak(eligibleWinners);
  } else if (state.round >= state.config.ROUNDS_MAX) {
    winnerPlayerId = resolveTiebreak(players);
  }

  return {
    ...state,
    players,
    winnerPlayerId
  };
};

export const applyCleanup = (state: GameState): GameState => {
  const players = state.players.map((player) => ({
    ...player,
    deck: {
      ...player.deck,
      discardPile: [...player.deck.discardPile, ...player.deck.hand],
      hand: []
    },
    doneThisRound: false
  }));

  let nextState: GameState = {
    ...state,
    players
  };

  const roundEndContext: RoundEndContext = { round: state.round };
  nextState = runModifierEvents(
    nextState,
    nextState.modifiers,
    (hooks) => hooks.onRoundEnd,
    roundEndContext
  );

  const bridges = Object.fromEntries(
    Object.entries(nextState.board.bridges).filter(([, bridge]) => !bridge.temporary)
  );

  const modifiers = expireEndOfRoundModifiers(nextState).modifiers;

  return {
    ...nextState,
    board: {
      ...nextState.board,
      bridges
    },
    modifiers,
    market: {
      ...nextState.market,
      currentRow: [],
      rowIndexResolving: 0,
      passPot: 0,
      bids: Object.fromEntries(nextState.players.map((player) => [player.id, null])),
      playersOut: Object.fromEntries(nextState.players.map((player) => [player.id, false])),
      rollOff: null
    }
  };
};

export const applyAgeUpdate = (state: GameState): GameState => {
  const upcomingAge = state.config.ageByRound[state.round + 1];
  if (!upcomingAge) {
    return state;
  }

  return {
    ...state,
    market: {
      ...state.market,
      age: upcomingAge
    }
  };
};

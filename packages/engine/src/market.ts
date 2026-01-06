import { shuffle } from "@bridgefront/shared";

import { MARKET_DECKS_BY_AGE } from "./content/market-decks";
import type { Age, CardDefId, GameState, MarketRowCard } from "./types";

const AGE_ORDER: Age[] = ["I", "II", "III"];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getNextAge = (age: Age): Age | null => {
  const index = AGE_ORDER.indexOf(age);
  if (index < 0 || index >= AGE_ORDER.length - 1) {
    return null;
  }
  return AGE_ORDER[index + 1];
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

const toRowCards = (age: Age, cardIds: CardDefId[]): MarketRowCard[] =>
  cardIds.map((cardId) => ({ cardId, age, revealed: true }));

const createBids = (state: GameState) =>
  Object.fromEntries(state.players.map((player) => [player.id, null]));

const createPlayersOut = (state: GameState) =>
  Object.fromEntries(state.players.map((player) => [player.id, false]));

export const initializeMarketDecks = (state: GameState): GameState => {
  let nextState = state;
  const marketDecks = { I: [], II: [], III: [] } as Record<Age, CardDefId[]>;

  for (const age of AGE_ORDER) {
    const baseDeck = MARKET_DECKS_BY_AGE[age] ?? [];
    const { value, next } = shuffle(nextState.rngState, baseDeck);
    marketDecks[age] = value;
    nextState = { ...nextState, rngState: next };
  }

  return { ...nextState, marketDecks };
};

export const prepareMarketRow = (state: GameState): GameState => {
  if (state.market.currentRow.length > 0) {
    return state;
  }

  const playerCount = state.players.length;
  if (playerCount <= 0) {
    return state;
  }

  const currentAge = state.market.age;
  const nextAge = getNextAge(currentAge);
  const previewTarget = clamp(
    state.config.marketPreviewByRound[state.round] ?? 0,
    0,
    playerCount
  );

  let currentDeck = state.marketDecks[currentAge] ?? [];
  let nextDeck = nextAge ? state.marketDecks[nextAge] ?? [] : [];
  let previewCount = previewTarget;
  if (!nextAge || nextDeck.length === 0) {
    previewCount = 0;
  }

  const currentTarget = Math.max(0, playerCount - previewCount);

  let { drawn: nextDrawn, remaining: nextRemaining } = takeFromDeck(
    nextDeck,
    previewCount
  );
  let { drawn: currentDrawn, remaining: currentRemaining } = takeFromDeck(
    currentDeck,
    currentTarget
  );

  let remainingSlots = playerCount - (nextDrawn.length + currentDrawn.length);
  if (remainingSlots > 0) {
    const fillCurrent = takeFromDeck(currentRemaining, remainingSlots);
    currentDrawn = [...currentDrawn, ...fillCurrent.drawn];
    currentRemaining = fillCurrent.remaining;
    remainingSlots = playerCount - (nextDrawn.length + currentDrawn.length);
  }
  if (remainingSlots > 0 && nextAge) {
    const fillNext = takeFromDeck(nextRemaining, remainingSlots);
    nextDrawn = [...nextDrawn, ...fillNext.drawn];
    nextRemaining = fillNext.remaining;
  }

  const rowCards: MarketRowCard[] = [
    ...toRowCards(currentAge, currentDrawn),
    ...toRowCards(nextAge ?? currentAge, nextDrawn)
  ];
  const { value: shuffledRow, next } = shuffle(state.rngState, rowCards);

  return {
    ...state,
    rngState: next,
    market: {
      ...state.market,
      currentRow: shuffledRow,
      rowIndexResolving: 0,
      passPot: 0,
      bids: createBids(state),
      playersOut: createPlayersOut(state)
    },
    marketDecks: {
      ...state.marketDecks,
      [currentAge]: currentRemaining,
      ...(nextAge ? { [nextAge]: nextRemaining } : {})
    }
  };
};

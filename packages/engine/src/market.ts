import { randInt, rollDie, shuffle } from "@bridgefront/shared";

import { MARKET_DECKS_BY_AGE } from "./content/market-decks";
import { POWER_DECKS_BY_AGE } from "./content/power-decks";
import type { Age, Bid, BlockState, CardDefId, GameState, MarketRowCard, PlayerID } from "./types";
import { createCardInstance, insertCardIntoDrawPileRandom } from "./cards";
import { emit } from "./events";

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

const getEligibleMarketPlayers = (state: GameState): PlayerID[] =>
  state.players
    .filter((player) => !state.market.playersOut[player.id])
    .map((player) => player.id);

const isInteger = (value: number) => Number.isFinite(value) && Number.isInteger(value);

const isBidValid = (bid: Bid, availableGold: number): boolean => {
  if (!isInteger(bid.amount)) {
    return false;
  }
  if (bid.kind === "buy") {
    return bid.amount >= 1 && bid.amount <= availableGold;
  }
  return bid.amount >= 0 && bid.amount <= availableGold;
};

type BidEntry = {
  playerId: PlayerID;
  bid: Bid;
};

type RollOffRound = Record<PlayerID, number>;

type RollOffResult = {
  winnerId: PlayerID;
  rounds: RollOffRound[];
  rngState: GameState["rngState"];
};

const resolveRollOff = (state: GameState, playerIds: PlayerID[]): RollOffResult => {
  let tied = [...playerIds];
  let rngState = state.rngState;
  const rounds: RollOffRound[] = [];

  while (tied.length > 1) {
    const round: RollOffRound = {};
    for (const playerId of tied) {
      const roll = rollDie(rngState);
      rngState = roll.next;
      round[playerId] = roll.value;
    }
    rounds.push(round);
    const lowest = Math.min(...Object.values(round));
    tied = Object.entries(round)
      .filter(([, value]) => value === lowest)
      .map(([playerId]) => playerId);
  }

  return {
    winnerId: tied[0],
    rounds,
    rngState
  };
};

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

export const initializePowerDecks = (state: GameState): GameState => {
  let rngState = state.rngState;
  const powerDecks = { I: [], II: [], III: [] } as Record<Age, CardDefId[]>;

  for (const age of AGE_ORDER) {
    const baseDeck = POWER_DECKS_BY_AGE[age] ?? [];
    const { value, next } = shuffle(rngState, baseDeck);
    powerDecks[age] = value;
    rngState = next;
  }

  return { ...state, powerDecks };
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

export const createMarketBidBlock = (state: GameState): BlockState | null => {
  const cardIndex = state.market.rowIndexResolving;
  const currentCard = state.market.currentRow[cardIndex];
  if (!currentCard) {
    return null;
  }

  const eligible = getEligibleMarketPlayers(state);
  if (eligible.length === 0) {
    return null;
  }

  return {
    type: "market.bidsForCard",
    waitingFor: eligible,
    payload: {
      cardIndex
    }
  };
};

export const applyMarketBid = (
  state: GameState,
  bid: Bid,
  playerId: PlayerID
): GameState => {
  if (state.phase !== "round.market") {
    return state;
  }

  const block = state.blocks;
  if (!block || block.type !== "market.bidsForCard") {
    return state;
  }

  if (block.payload.cardIndex !== state.market.rowIndexResolving) {
    return state;
  }

  if (!block.waitingFor.includes(playerId)) {
    return state;
  }

  if (state.market.playersOut[playerId]) {
    return state;
  }

  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return state;
  }

  if (!isBidValid(bid, player.resources.gold)) {
    return state;
  }

  if (state.market.bids[playerId]) {
    return state;
  }

  return {
    ...state,
    market: {
      ...state.market,
      bids: {
        ...state.market.bids,
        [playerId]: bid
      }
    },
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId)
    }
  };
};

export const resolveMarketBids = (state: GameState): GameState => {
  const cardIndex = state.market.rowIndexResolving;
  const currentCard = state.market.currentRow[cardIndex];
  if (!currentCard) {
    return state;
  }

  const eligiblePlayerIds = getEligibleMarketPlayers(state);
  if (eligiblePlayerIds.length === 0) {
    return {
      ...state,
      market: {
        ...state.market,
        rowIndexResolving: state.market.currentRow.length,
        bids: createBids(state),
        passPot: 0
      }
    };
  }

  const bidEntries: BidEntry[] = eligiblePlayerIds.map((playerId) => {
    const bid = state.market.bids[playerId];
    return {
      playerId,
      bid: bid ?? { kind: "pass", amount: 0 }
    };
  });

  const buyBids = bidEntries.filter((entry) => entry.bid.kind === "buy" && entry.bid.amount > 0);
  const baseMarket = {
    ...state.market,
    rowIndexResolving: cardIndex + 1,
    bids: createBids(state),
    passPot: 0
  };

  if (buyBids.length > 0) {
    const highest = Math.max(...buyBids.map((entry) => entry.bid.amount));
    const topBids = buyBids.filter((entry) => entry.bid.amount === highest);
    let winnerId = topBids[0].playerId;
    let rngState = state.rngState;
    let rollOffRounds: RollOffRound[] = [];

    if (topBids.length > 1) {
      const rollOff = resolveRollOff(state, topBids.map((entry) => entry.playerId));
      winnerId = rollOff.winnerId;
      rngState = rollOff.rngState;
      rollOffRounds = rollOff.rounds;
    }

    const players = state.players.map((player) =>
      player.id === winnerId
        ? {
            ...player,
            resources: {
              ...player.resources,
              gold: player.resources.gold - highest
            }
          }
        : player
    );

    let nextState: GameState = {
      ...state,
      rngState,
      players,
      market: {
        ...baseMarket,
        playersOut: {
          ...state.market.playersOut,
          [winnerId]: true
        }
      }
    };

    const created = createCardInstance(nextState, currentCard.cardId);
    nextState = insertCardIntoDrawPileRandom(created.state, winnerId, created.instanceId);
    nextState = emit(nextState, {
      type: "market.buy",
      payload: {
        playerId: winnerId,
        cardId: currentCard.cardId,
        amount: highest,
        cardIndex,
        rollOff: rollOffRounds.length > 0 ? rollOffRounds : undefined
      }
    });

    return nextState;
  }

  const passBids = bidEntries.map((entry) => ({
    playerId: entry.playerId,
    amount: entry.bid.amount
  }));
  const passBidByPlayer = Object.fromEntries(
    passBids.map((entry) => [entry.playerId, entry.amount])
  ) as Record<PlayerID, number>;
  const lowest = Math.min(...passBids.map((entry) => entry.amount));
  const eligibleWinners = passBids
    .filter((entry) => entry.amount === lowest)
    .map((entry) => entry.playerId);

  let rngState = state.rngState;
  let winnerId = eligibleWinners[0];
  if (eligibleWinners.length > 1) {
    const roll = randInt(rngState, 0, eligibleWinners.length - 1);
    rngState = roll.next;
    winnerId = eligibleWinners[roll.value];
  }

  const passPot = Object.values(passBidByPlayer).reduce((total, amount) => total + amount, 0);
  const players = state.players.map((player) => {
    const bidAmount = passBidByPlayer[player.id] ?? 0;
    let gold = player.resources.gold;
    if (bidAmount > 0) {
      gold -= bidAmount;
    }
    if (player.id === winnerId && passPot > 0) {
      gold += passPot;
    }
    return {
      ...player,
      resources: {
        ...player.resources,
        gold
      }
    };
  });

  let nextState: GameState = {
    ...state,
    rngState,
    players,
    market: {
      ...baseMarket,
      playersOut: {
        ...state.market.playersOut,
        [winnerId]: true
      }
    }
  };

  const created = createCardInstance(nextState, currentCard.cardId);
  nextState = insertCardIntoDrawPileRandom(created.state, winnerId, created.instanceId);
  nextState = emit(nextState, {
    type: "market.pass",
    payload: {
      playerId: winnerId,
      cardId: currentCard.cardId,
      passPot,
      cardIndex
    }
  });

  return nextState;
};

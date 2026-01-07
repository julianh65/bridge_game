import { randInt, shuffle } from "@bridgefront/shared";

import type { CardDefId, CardInstanceID, GameState, PlayerID } from "./types";
import { getCardDef } from "./content/cards";

const getPlayer = (state: GameState, playerId: PlayerID) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`player not found: ${playerId}`);
  }
  return player;
};

const updatePlayerDeck = (
  state: GameState,
  playerId: PlayerID,
  deckUpdate: Partial<GameState["players"][number]["deck"]>
): GameState => {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, deck: { ...player.deck, ...deckUpdate } } : player
    )
  };
};

const addPermanentVp = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            vp: {
              ...player.vp,
              permanent: player.vp.permanent + amount
            }
          }
        : player
    )
  };
};

export const createCardInstances = (
  state: GameState,
  defIds: CardDefId[]
): { state: GameState; instanceIds: CardInstanceID[] } => {
  let nextIndex = Object.keys(state.cardsByInstanceId).length + 1;
  const instanceIds: CardInstanceID[] = [];
  const cardsByInstanceId = { ...state.cardsByInstanceId };

  for (const defId of defIds) {
    const instanceId = `ci_${nextIndex}`;
    nextIndex += 1;
    cardsByInstanceId[instanceId] = { id: instanceId, defId };
    instanceIds.push(instanceId);
  }

  return {
    state: { ...state, cardsByInstanceId },
    instanceIds
  };
};

export const createCardInstance = (
  state: GameState,
  defId: CardDefId
): { state: GameState; instanceId: CardInstanceID } => {
  const { state: nextState, instanceIds } = createCardInstances(state, [defId]);
  return { state: nextState, instanceId: instanceIds[0] };
};

export const shuffleCardIds = (
  state: GameState,
  cardIds: CardInstanceID[]
): { state: GameState; cardIds: CardInstanceID[] } => {
  const { value, next } = shuffle(state.rngState, cardIds);
  return { state: { ...state, rngState: next }, cardIds: value };
};

export const takeTopCards = (
  state: GameState,
  playerId: PlayerID,
  count: number
): { state: GameState; cards: CardInstanceID[] } => {
  if (count <= 0) {
    return { state, cards: [] };
  }

  let nextState = state;
  const cards: CardInstanceID[] = [];

  for (let i = 0; i < count; i += 1) {
    let player = getPlayer(nextState, playerId);
    let { drawPile, discardPile } = player.deck;

    if (drawPile.length === 0) {
      if (discardPile.length === 0) {
        break;
      }
      const shuffled = shuffleCardIds(nextState, discardPile);
      nextState = updatePlayerDeck(shuffled.state, playerId, {
        drawPile: shuffled.cardIds,
        discardPile: []
      });
      player = getPlayer(nextState, playerId);
      ({ drawPile } = player.deck);
    }

    if (drawPile.length === 0) {
      break;
    }

    const [top, ...rest] = drawPile;
    cards.push(top);
    nextState = updatePlayerDeck(nextState, playerId, { drawPile: rest });
  }

  return { state: nextState, cards };
};

export const insertCardIntoDrawPileRandom = (
  state: GameState,
  playerId: PlayerID,
  instanceId: CardInstanceID
): GameState => {
  const player = getPlayer(state, playerId);
  const { value: insertIndex, next } = randInt(
    state.rngState,
    0,
    player.deck.drawPile.length
  );
  const drawPile = player.deck.drawPile.slice();
  drawPile.splice(insertIndex, 0, instanceId);

  let nextState = updatePlayerDeck({ ...state, rngState: next }, playerId, { drawPile });
  const defId = state.cardsByInstanceId[instanceId]?.defId;
  const cardDef = defId ? getCardDef(defId) : undefined;
  if (cardDef?.type === "Victory") {
    nextState = addPermanentVp(nextState, playerId, 1);
  }
  return nextState;
};

export const addCardToHandWithOverflow = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  const player = getPlayer(state, playerId);
  if (player.deck.hand.length >= state.config.HAND_LIMIT) {
    return updatePlayerDeck(state, playerId, {
      discardPile: [...player.deck.discardPile, cardInstanceId]
    });
  }

  return updatePlayerDeck(state, playerId, {
    hand: [...player.deck.hand, cardInstanceId]
  });
};

export const drawCards = (
  state: GameState,
  playerId: PlayerID,
  count: number
): GameState => {
  if (count <= 0) {
    return state;
  }

  let nextState = state;
  for (let i = 0; i < count; i += 1) {
    let player = getPlayer(nextState, playerId);
    let { drawPile, discardPile, hand } = player.deck;

    if (drawPile.length === 0) {
      if (discardPile.length === 0) {
        return nextState;
      }
      const shuffled = shuffleCardIds(nextState, discardPile);
      nextState = updatePlayerDeck(shuffled.state, playerId, {
        drawPile: shuffled.cardIds,
        discardPile: []
      });
      player = getPlayer(nextState, playerId);
      ({ drawPile, discardPile, hand } = player.deck);
    }

    if (drawPile.length === 0) {
      return nextState;
    }

    const [top, ...rest] = drawPile;
    if (hand.length >= nextState.config.HAND_LIMIT) {
      discardPile = [...discardPile, top];
    } else {
      hand = [...hand, top];
    }

    nextState = updatePlayerDeck(nextState, playerId, {
      drawPile: rest,
      discardPile,
      hand
    });
  }

  return nextState;
};

export const drawToHandSize = (
  state: GameState,
  playerId: PlayerID,
  targetHandSize: number
): GameState => {
  const player = getPlayer(state, playerId);
  const needed = Math.max(0, targetHandSize - player.deck.hand.length);
  return drawCards(state, playerId, needed);
};

export const removeCardFromHand = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }

  const hand = player.deck.hand.filter((id) => id !== cardInstanceId);
  return updatePlayerDeck(state, playerId, { hand });
};

export const topdeckCardFromHand = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }

  const hand = player.deck.hand.filter((id) => id !== cardInstanceId);
  return updatePlayerDeck(state, playerId, {
    hand,
    drawPile: [cardInstanceId, ...player.deck.drawPile]
  });
};

export const scrapCardFromHand = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }

  const hand = player.deck.hand.filter((id) => id !== cardInstanceId);
  return updatePlayerDeck(state, playerId, {
    hand,
    scrapped: [...player.deck.scrapped, cardInstanceId]
  });
};

export const addCardToDiscardPile = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  const player = getPlayer(state, playerId);
  return updatePlayerDeck(state, playerId, {
    discardPile: [...player.deck.discardPile, cardInstanceId]
  });
};

export const addCardToBurned = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, burned: [...player.burned, cardInstanceId] } : player
    )
  };
};

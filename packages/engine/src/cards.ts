import { randInt, shuffle } from "@bridgefront/shared";

import type {
  CardDefId,
  CardDrawContext,
  CardInstanceID,
  GameState,
  PlayerID
} from "./types";
import { getCardDef } from "./content/cards";
import type { EffectSpec } from "./content/cards";
import { runModifierEvents } from "./modifiers";
import { incrementCardScalingCounter, incrementCardsDiscardedThisRound } from "./player-flags";

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

const adjustGold = (state: GameState, playerId: PlayerID, delta: number): GameState => {
  if (!Number.isFinite(delta) || delta === 0) {
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
              gold: Math.max(0, player.resources.gold + delta)
            }
          }
        : player
    )
  };
};

const applyCardDrawEffects = (
  state: GameState,
  playerId: PlayerID,
  effects?: EffectSpec[]
): GameState => {
  if (!effects || effects.length === 0) {
    return state;
  }

  let nextState = state;
  for (const effect of effects) {
    switch (effect.kind) {
      case "gainGold": {
        const amount = typeof effect.amount === "number" ? Math.floor(effect.amount) : 0;
        if (amount > 0) {
          nextState = adjustGold(nextState, playerId, amount);
        }
        break;
      }
      case "loseGold": {
        const amount = typeof effect.amount === "number" ? Math.floor(effect.amount) : 0;
        if (amount > 0) {
          nextState = adjustGold(nextState, playerId, -amount);
        }
        break;
      }
      default:
        break;
    }
  }
  return nextState;
};

const applyCardDrawTriggers = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID,
  destination: CardDrawContext["destination"]
): GameState => {
  const instance = state.cardsByInstanceId[cardInstanceId];
  if (!instance) {
    return state;
  }

  const context: CardDrawContext = {
    playerId,
    cardInstanceId,
    cardDefId: instance.defId,
    destination
  };

  let nextState = runModifierEvents(state, state.modifiers, (hooks) => hooks.onCardDraw, context);
  const cardDef = getCardDef(instance.defId);
  nextState = applyCardDrawEffects(nextState, playerId, cardDef?.onDraw);
  return nextState;
};

const applyCardDiscardEffects = (
  state: GameState,
  playerId: PlayerID,
  cardDefId: CardDefId,
  effects?: EffectSpec[]
): GameState => {
  if (!effects || effects.length === 0) {
    return state;
  }
  let nextState = state;
  for (const effect of effects) {
    switch (effect.kind) {
      case "incrementCardCounter": {
        const key = typeof effect.key === "string" ? effect.key : cardDefId;
        if (!key) {
          break;
        }
        const max =
          typeof effect.max === "number" && Number.isFinite(effect.max)
            ? Math.max(0, Math.floor(effect.max))
            : undefined;
        nextState = incrementCardScalingCounter(nextState, playerId, key, 1, max);
        break;
      }
      default:
        break;
    }
  }
  return nextState;
};

export const applyCardDiscardTriggers = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID
): GameState => {
  const instance = state.cardsByInstanceId[cardInstanceId];
  if (!instance) {
    return state;
  }
  const cardDef = getCardDef(instance.defId);
  return applyCardDiscardEffects(state, playerId, instance.defId, cardDef?.onDiscard);
};

type DiscardOptions = {
  countAsDiscard?: boolean;
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
    const victoryPoints = cardDef.victoryPoints ?? 1;
    if (victoryPoints !== 0) {
      nextState = addPermanentVp(nextState, playerId, victoryPoints);
    }
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
    const nextState = addCardToDiscardPile(state, playerId, cardInstanceId, {
      countAsDiscard: true
    });
    return applyCardDrawTriggers(nextState, playerId, cardInstanceId, "discard");
  }

  const nextState = updatePlayerDeck(state, playerId, {
    hand: [...player.deck.hand, cardInstanceId]
  });
  return applyCardDrawTriggers(nextState, playerId, cardInstanceId, "hand");
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
      nextState = updatePlayerDeck(nextState, playerId, {
        drawPile: rest,
        discardPile,
        hand
      });
      nextState = addCardToDiscardPile(nextState, playerId, top, { countAsDiscard: true });
      nextState = applyCardDrawTriggers(nextState, playerId, top, "discard");
      player = getPlayer(nextState, playerId);
      ({ drawPile, discardPile, hand } = player.deck);
      continue;
    }

    hand = [...hand, top];

    nextState = updatePlayerDeck(nextState, playerId, {
      drawPile: rest,
      discardPile,
      hand
    });
    nextState = applyCardDrawTriggers(nextState, playerId, top, "hand");
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

export const discardCardFromHand = (
  state: GameState,
  playerId: PlayerID,
  cardInstanceId: CardInstanceID,
  options: DiscardOptions = { countAsDiscard: true }
): GameState => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }

  let nextState = removeCardFromHand(state, playerId, cardInstanceId);
  nextState = addCardToDiscardPile(nextState, playerId, cardInstanceId, options);
  return nextState;
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
  cardInstanceId: CardInstanceID,
  options: DiscardOptions = {}
): GameState => {
  const player = getPlayer(state, playerId);
  let nextState = updatePlayerDeck(state, playerId, {
    discardPile: [...player.deck.discardPile, cardInstanceId]
  });
  nextState = applyCardDiscardTriggers(nextState, playerId, cardInstanceId);
  if (options.countAsDiscard) {
    return incrementCardsDiscardedThisRound(nextState, playerId);
  }
  return nextState;
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

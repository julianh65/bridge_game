import { randInt } from "@bridgefront/shared";

import { getCardDef } from "./content/cards";
import type { EffectSpec } from "./content/cards/types";
import type { Age, CardPlayTargets, GameState, PlayerID, TileType } from "./types";
import {
  addCardToBurned,
  addCardToDiscardPile,
  addCardToHandWithOverflow,
  createCardInstances,
  discardCardFromHand,
  drawCards,
  removeCardFromHand,
  takeTopCards,
  topdeckCardFromHand
} from "./cards";
import { emit } from "./events";
import { getCardInstanceTargets } from "./card-effects-targets";

const addGold = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
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

const addMana = (state: GameState, playerId: PlayerID, amount: number): GameState => {
  if (!Number.isFinite(amount) || amount <= 0) {
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
              mana: player.resources.mana + amount
            }
          }
        : player
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

const grantVictoryOnGain = (state: GameState, playerId: PlayerID, cardDefId: string): GameState => {
  const cardDef = getCardDef(cardDefId);
  if (!cardDef || cardDef.type !== "Victory") {
    return state;
  }
  const victoryPoints = cardDef.victoryPoints ?? 1;
  if (!Number.isFinite(victoryPoints) || victoryPoints <= 0) {
    return state;
  }
  return addPermanentVp(state, playerId, Math.floor(victoryPoints));
};

const isAge = (value: unknown): value is Age =>
  value === "I" || value === "II" || value === "III";

const playerOccupiesTile = (
  state: GameState,
  playerId: PlayerID,
  tileType: TileType
): boolean => {
  return Object.values(state.board.hexes).some(
    (hex) => hex.tile === tileType && (hex.occupants[playerId]?.length ?? 0) > 0
  );
};

const playerOccupiesEnemyCapital = (state: GameState, playerId: PlayerID): boolean => {
  return Object.values(state.board.hexes).some((hex) => {
    if (hex.tile !== "capital") {
      return false;
    }
    if (!hex.ownerPlayerId || hex.ownerPlayerId === playerId) {
      return false;
    }
    return (hex.occupants[playerId]?.length ?? 0) > 0;
  });
};

export const resolveEconomyEffect = (
  state: GameState,
  playerId: PlayerID,
  effect: EffectSpec,
  targets: CardPlayTargets
): GameState | null => {
  let nextState = state;

  switch (effect.kind) {
    case "gainGold": {
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      return addGold(nextState, playerId, amount);
    }
    case "gainGoldIfEnemyCapital": {
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      if (amount <= 0) {
        return nextState;
      }
      if (!playerOccupiesEnemyCapital(nextState, playerId)) {
        return nextState;
      }
      return addGold(nextState, playerId, amount);
    }
    case "gainMana": {
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      return addMana(nextState, playerId, amount);
    }
    case "gainManaIfTile": {
      const tile = typeof effect.tile === "string" ? effect.tile : null;
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      if (!tile || amount <= 0) {
        return nextState;
      }
      if (playerOccupiesTile(nextState, playerId, tile as TileType)) {
        return addMana(nextState, playerId, amount);
      }
      return nextState;
    }
    case "drawCards": {
      const count = typeof effect.count === "number" ? effect.count : 0;
      return drawCards(nextState, playerId, count);
    }
    case "discardFromHand": {
      const count = typeof effect.count === "number" ? effect.count : 1;
      if (count <= 0) {
        return nextState;
      }
      const targetIds = getCardInstanceTargets(targets ?? null);
      if (targetIds.length === 0) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player) {
        return nextState;
      }
      const uniqueTargets = [...new Set(targetIds)];
      const validTargets = uniqueTargets.filter((id) => player.deck.hand.includes(id));
      if (validTargets.length < count) {
        return nextState;
      }
      for (const cardInstanceId of validTargets.slice(0, count)) {
        nextState = discardCardFromHand(nextState, playerId, cardInstanceId, {
          countAsDiscard: true
        });
      }
      return nextState;
    }
    case "burnFromHand": {
      const count = typeof effect.count === "number" ? effect.count : 1;
      if (count <= 0) {
        return nextState;
      }
      const targetIds = getCardInstanceTargets(targets ?? null);
      if (targetIds.length === 0) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player) {
        return nextState;
      }
      const uniqueTargets = [...new Set(targetIds)];
      const validTargets = uniqueTargets.filter((id) => player.deck.hand.includes(id));
      if (validTargets.length < count) {
        return nextState;
      }
      for (const cardInstanceId of validTargets.slice(0, count)) {
        const removed = removeCardFromHand(nextState, playerId, cardInstanceId);
        nextState = addCardToBurned(removed, playerId, cardInstanceId);
      }
      return nextState;
    }
    case "drawCardsOtherPlayers": {
      const count = typeof effect.count === "number" ? effect.count : 0;
      if (count <= 0) {
        return nextState;
      }
      for (const player of nextState.players) {
        if (player.id === playerId) {
          continue;
        }
        nextState = drawCards(nextState, player.id, count);
      }
      return nextState;
    }
    case "rollGold": {
      const sides = Number.isFinite(effect.sides) ? Math.max(1, Math.floor(effect.sides)) : 6;
      const highMin =
        Number.isFinite(effect.highMin) && Number(effect.highMin) >= 1
          ? Math.floor(effect.highMin)
          : 5;
      const lowGain = typeof effect.lowGain === "number" ? effect.lowGain : 0;
      const highGain = typeof effect.highGain === "number" ? effect.highGain : 0;
      if (sides <= 0 || (lowGain <= 0 && highGain <= 0)) {
        return nextState;
      }
      const threshold = Math.min(highMin, sides);
      const roll = randInt(nextState.rngState, 1, sides);
      nextState = { ...nextState, rngState: roll.next };
      const amount = roll.value >= threshold ? highGain : lowGain;
      const sourceCardId =
        typeof effect.sourceCardId === "string" ? effect.sourceCardId : null;
      nextState = emit(nextState, {
        type: "card.rollGold",
        payload: {
          playerId,
          cardId: sourceCardId ?? undefined,
          roll: roll.value,
          sides,
          amount,
          threshold,
          lowGain,
          highGain
        }
      });
      if (amount > 0) {
        nextState = addGold(nextState, playerId, amount);
      }
      return nextState;
    }
    case "drawCardsIfTile": {
      const tile = typeof effect.tile === "string" ? effect.tile : null;
      const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
      if (!tile || count <= 0) {
        return nextState;
      }
      if (playerOccupiesTile(nextState, playerId, tile as TileType)) {
        nextState = drawCards(nextState, playerId, count);
      }
      return nextState;
    }
    case "drawCardsIfHandEmpty": {
      const count = typeof effect.count === "number" ? effect.count : 0;
      if (count <= 0) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player) {
        return nextState;
      }
      if (player.deck.hand.length > 0) {
        return nextState;
      }
      return drawCards(nextState, playerId, count);
    }
    case "topdeckFromHand": {
      const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 1;
      if (count <= 0) {
        return nextState;
      }
      const targetIds = getCardInstanceTargets(targets ?? null);
      if (targetIds.length === 0) {
        return nextState;
      }
      const player = nextState.players.find((entry) => entry.id === playerId);
      if (!player) {
        return nextState;
      }
      const validTargets = targetIds.filter((id) => player.deck.hand.includes(id));
      if (validTargets.length === 0) {
        return nextState;
      }
      for (const cardInstanceId of validTargets.slice(0, count)) {
        nextState = topdeckCardFromHand(nextState, playerId, cardInstanceId);
      }
      return nextState;
    }
    case "scoutReport": {
      const lookCount = Math.max(0, Number(effect.lookCount) || 0);
      const keepCount = Math.max(0, Number(effect.keepCount) || 0);
      if (lookCount <= 0) {
        return nextState;
      }
      const taken = takeTopCards(nextState, playerId, lookCount);
      nextState = taken.state;
      const maxKeep = Math.min(keepCount, taken.cards.length);
      if (maxKeep <= 0) {
        for (const cardId of taken.cards) {
          nextState = addCardToDiscardPile(nextState, playerId, cardId, {
            countAsDiscard: true
          });
        }
        return nextState;
      }
      if (maxKeep >= taken.cards.length || nextState.blocks) {
        const keep = taken.cards.slice(0, maxKeep);
        const discard = taken.cards.filter((cardId) => !keep.includes(cardId));
        for (const cardId of keep) {
          nextState = addCardToHandWithOverflow(nextState, playerId, cardId);
        }
        for (const cardId of discard) {
          nextState = addCardToDiscardPile(nextState, playerId, cardId, {
            countAsDiscard: true
          });
        }
        return nextState;
      }
      return {
        ...nextState,
        blocks: {
          type: "action.scoutReport",
          waitingFor: [playerId],
          payload: {
            playerId,
            offers: taken.cards,
            keepCount: maxKeep,
            chosen: null
          }
        }
      };
    }
    case "prospecting": {
      const baseGold = typeof effect.baseGold === "number" ? effect.baseGold : 0;
      const bonusIfMine = typeof effect.bonusIfMine === "number" ? effect.bonusIfMine : 0;
      const amount =
        baseGold +
        (bonusIfMine > 0 && playerOccupiesTile(nextState, playerId, "mine")
          ? bonusIfMine
          : 0);
      return addGold(nextState, playerId, amount);
    }
    case "gainMarketCards": {
      const age = isAge(effect.age) ? effect.age : null;
      if (!age) {
        return nextState;
      }
      const count =
        typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 1;
      if (count <= 0) {
        return nextState;
      }
      const deck = nextState.marketDecks[age] ?? [];
      if (deck.length === 0) {
        return nextState;
      }
      const drawCount = Math.min(count, deck.length);
      const drawn = deck.slice(0, drawCount);
      const remaining = deck.slice(drawCount);
      const created = createCardInstances(nextState, drawn);
      nextState = created.state;
      nextState = {
        ...nextState,
        marketDecks: {
          ...nextState.marketDecks,
          [age]: remaining
        }
      };
      for (const cardId of created.instanceIds) {
        nextState = addCardToHandWithOverflow(nextState, playerId, cardId);
        const defId = nextState.cardsByInstanceId[cardId]?.defId;
        if (defId) {
          nextState = grantVictoryOnGain(nextState, playerId, defId);
        }
      }
      return nextState;
    }
    default:
      return null;
  }
};

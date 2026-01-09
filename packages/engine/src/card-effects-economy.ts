import { randInt } from "@bridgefront/shared";

import { getCardDef } from "./content/cards";
import type { EffectSpec } from "./content/cards/types";
import type {
  Age,
  CardInstanceID,
  CardInstanceOverrides,
  CardPlayTargets,
  GameState,
  PlayerID,
  TileType
} from "./types";
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
import { getCardInstanceTargets, getPlayerIdTarget } from "./card-effects-targets";

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

const normalizeCardInstanceOverrides = (value: unknown): CardInstanceOverrides | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const overrides: CardInstanceOverrides = {};
  const rawCost = record.cost;
  if (rawCost && typeof rawCost === "object") {
    const cost = rawCost as Record<string, unknown>;
    const mana = cost.mana;
    const gold = cost.gold;
    const normalizedMana =
      typeof mana === "number" && Number.isFinite(mana) ? Math.max(0, Math.floor(mana)) : null;
    const normalizedGold =
      typeof gold === "number" && Number.isFinite(gold) ? Math.max(0, Math.floor(gold)) : null;
    if (normalizedMana !== null || normalizedGold !== null) {
      const normalizedCost: CardInstanceOverrides["cost"] = {};
      if (normalizedMana !== null) {
        normalizedCost.mana = normalizedMana;
      }
      if (normalizedGold !== null) {
        normalizedCost.gold = normalizedGold;
      }
      overrides.cost = normalizedCost;
    }
  }
  if (typeof record.initiative === "number" && Number.isFinite(record.initiative)) {
    overrides.initiative = Math.max(0, Math.floor(record.initiative));
  }
  if (typeof record.burn === "boolean") {
    overrides.burn = record.burn;
  }
  if (typeof record.name === "string") {
    overrides.name = record.name;
  }
  if (typeof record.rulesText === "string") {
    overrides.rulesText = record.rulesText;
  }
  if (Array.isArray(record.tags)) {
    const tags = record.tags.filter((tag) => typeof tag === "string");
    if (tags.length > 0) {
      overrides.tags = tags;
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : null;
};

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

const isDrawPileEmpty = (state: GameState, playerId: PlayerID): boolean => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return false;
  }
  return player.deck.drawPile.length === 0;
};

const drawCardsWithIds = (
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
    const taken = takeTopCards(nextState, playerId, 1);
    nextState = taken.state;
    const cardId = taken.cards[0];
    if (!cardId) {
      break;
    }
    cards.push(cardId);
    nextState = addCardToHandWithOverflow(nextState, playerId, cardId);
  }
  return { state: nextState, cards };
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
    case "stealGold": {
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      if (amount <= 0) {
        return nextState;
      }
      const targetPlayerId = getPlayerIdTarget(targets ?? null);
      if (!targetPlayerId || targetPlayerId === playerId) {
        return nextState;
      }
      const target = nextState.players.find((entry) => entry.id === targetPlayerId);
      if (!target) {
        return nextState;
      }
      const stealAmount = Math.min(target.resources.gold, Math.floor(amount));
      if (stealAmount <= 0) {
        return nextState;
      }
      nextState = adjustGold(nextState, targetPlayerId, -stealAmount);
      return adjustGold(nextState, playerId, stealAmount);
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
    case "drawCardsIfDrawPileEmpty": {
      const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
      if (count <= 0) {
        return nextState;
      }
      if (!isDrawPileEmpty(nextState, playerId)) {
        return nextState;
      }
      return drawCards(nextState, playerId, count);
    }
    case "gainManaIfDrawPileEmpty": {
      const amount =
        typeof effect.amount === "number" ? Math.max(0, Math.floor(effect.amount)) : 0;
      if (amount <= 0) {
        return nextState;
      }
      if (!isDrawPileEmpty(nextState, playerId)) {
        return nextState;
      }
      return addMana(nextState, playerId, amount);
    }
    case "spellcaster": {
      const firstDraw = drawCardsWithIds(nextState, playerId, 1);
      nextState = firstDraw.state;
      const cardId = firstDraw.cards[0];
      if (!cardId) {
        return nextState;
      }
      const defId = nextState.cardsByInstanceId[cardId]?.defId;
      const cardDef = defId ? getCardDef(defId) : null;
      if (cardDef?.type !== "Spell") {
        return nextState;
      }
      const extraDraw = drawCardsWithIds(nextState, playerId, 2);
      return extraDraw.state;
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
      let rngState = nextState.rngState;
      const remaining = deck.slice();
      const drawn: typeof deck = [];
      for (let i = 0; i < drawCount; i += 1) {
        const roll = randInt(rngState, 0, remaining.length - 1);
        rngState = roll.next;
        const [picked] = remaining.splice(roll.value, 1);
        if (picked) {
          drawn.push(picked);
        }
      }
      nextState = { ...nextState, rngState };
      const overrides = normalizeCardInstanceOverrides(effect.overrides);
      const overrideList = overrides
        ? drawn.map(() => ({
            ...overrides,
            cost: overrides.cost ? { ...overrides.cost } : undefined,
            tags: overrides.tags ? [...overrides.tags] : undefined
          }))
        : undefined;
      const created = createCardInstances(nextState, drawn, overrideList);
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

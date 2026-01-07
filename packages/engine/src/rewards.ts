import type { ChampionKillContext, GameState, PlayerID } from "./types";
import { getChampionKillBonusGold } from "./modifiers";

const MARK_FOR_COIN_CARD_ID = "faction.veil.marked_for_coin";

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

const applyMarkedForCoinRewards = (
  state: GameState,
  context: ChampionKillContext
): GameState => {
  if (context.killedChampions.length === 0) {
    return state;
  }

  const killedIds = new Set(context.killedChampions.map((champion) => champion.id));
  const bonusByPlayer: Record<PlayerID, number> = {} as Record<PlayerID, number>;
  const removed = new Set<string>();

  for (const modifier of state.modifiers) {
    if (modifier.source.type !== "card" || modifier.source.sourceId !== MARK_FOR_COIN_CARD_ID) {
      continue;
    }
    const ownerId = modifier.ownerPlayerId;
    if (!ownerId) {
      continue;
    }
    const markedId = modifier.data?.markedUnitId;
    if (typeof markedId !== "string" || !killedIds.has(markedId)) {
      continue;
    }
    const bonusRaw = modifier.data?.bonusGold;
    const bonus = typeof bonusRaw === "number" ? Math.max(0, bonusRaw) : 0;
    if (bonus <= 0) {
      removed.add(modifier.id);
      continue;
    }
    removed.add(modifier.id);
    bonusByPlayer[ownerId] = (bonusByPlayer[ownerId] ?? 0) + bonus;
  }

  let nextState = state;
  if (removed.size > 0) {
    nextState = {
      ...nextState,
      modifiers: nextState.modifiers.filter((modifier) => !removed.has(modifier.id))
    };
  }

  for (const [playerId, amount] of Object.entries(bonusByPlayer)) {
    if (amount > 0) {
      nextState = addGold(nextState, playerId, amount);
    }
  }

  return nextState;
};

export const applyChampionKillRewards = (
  state: GameState,
  context: ChampionKillContext
): GameState => {
  if (context.killedChampions.length === 0) {
    return state;
  }

  let nextState = state;
  if (context.killerPlayerId !== context.victimPlayerId) {
    const bonus = getChampionKillBonusGold(nextState, context, 0);
    const total = context.bounty + bonus;
    if (total > 0) {
      nextState = addGold(nextState, context.killerPlayerId, total);
    }
  }

  return applyMarkedForCoinRewards(nextState, context);
};

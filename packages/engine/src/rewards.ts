import type { ChampionKillContext, GameState, PlayerID } from "./types";
import { getChampionKillBonusGold, getChampionKillStealGold } from "./modifiers";

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

const transferGold = (
  state: GameState,
  fromPlayerId: PlayerID,
  toPlayerId: PlayerID,
  amount: number
): GameState => {
  if (amount <= 0 || fromPlayerId === toPlayerId) {
    return state;
  }

  let changed = false;
  const nextPlayers = state.players.map((player) => {
    if (player.id === fromPlayerId) {
      if (player.resources.gold === 0) {
        return player;
      }
      const nextGold = Math.max(0, player.resources.gold - amount);
      if (nextGold === player.resources.gold) {
        return player;
      }
      changed = true;
      return {
        ...player,
        resources: {
          ...player.resources,
          gold: nextGold
        }
      };
    }
    if (player.id === toPlayerId) {
      changed = true;
      return {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + amount
        }
      };
    }
    return player;
  });

  return changed ? { ...state, players: nextPlayers } : state;
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
    const markedId = modifier.attachedUnitId ?? modifier.data?.markedUnitId;
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
    const steal = getChampionKillStealGold(nextState, context, 0);
    const total = context.bounty + bonus;
    if (total > 0) {
      nextState = addGold(nextState, context.killerPlayerId, total);
    }
    if (steal > 0) {
      const victim = nextState.players.find((player) => player.id === context.victimPlayerId);
      const available = victim?.resources.gold ?? 0;
      const stealAmount = Math.min(steal, available);
      if (stealAmount > 0) {
        nextState = transferGold(
          nextState,
          context.victimPlayerId,
          context.killerPlayerId,
          stealAmount
        );
      }
    }
  }

  return applyMarkedForCoinRewards(nextState, context);
};

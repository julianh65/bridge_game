import type { CardDef } from "./content/cards";

import type { CardPlayTargets, GameState, Modifier, PlayerID } from "./types";

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

const playerOccupiesCenter = (state: GameState, playerId: PlayerID): boolean => {
  for (const hex of Object.values(state.board.hexes)) {
    if (hex.tile !== "center") {
      continue;
    }
    const units = hex.occupants[playerId];
    if (units && units.length > 0) {
      return true;
    }
  }
  return false;
};

export const resolveVictoryEffect = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef,
  effect: Record<string, unknown>,
  _targets: CardPlayTargets | null
): GameState | null => {
  if (effect.kind !== "centerVpOnRoundEnd") {
    return null;
  }

  const amountRaw = effect.amount;
  const amount = typeof amountRaw === "number" ? Math.max(0, Math.floor(amountRaw)) : 0;
  if (amount <= 0) {
    return state;
  }

  const modifierId = `card.${card.id}.${playerId}.${state.revision}.center_vp`;
  const modifier: Modifier = {
    id: modifierId,
    source: { type: "card", sourceId: card.id },
    ownerPlayerId: playerId,
    duration: { type: "endOfRound" },
    hooks: {
      onRoundEnd: ({ state: nextState, modifier: activeModifier }) => {
        const ownerId = activeModifier.ownerPlayerId;
        if (!ownerId) {
          return nextState;
        }
        if (!playerOccupiesCenter(nextState, ownerId)) {
          return nextState;
        }
        return addPermanentVp(nextState, ownerId, amount);
      }
    }
  };

  return { ...state, modifiers: [...state.modifiers, modifier] };
};

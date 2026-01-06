import type { CardDef } from "./content/cards";
import type { CardPlayTargets, GameState, PlayerID } from "./types";
import { drawCards } from "./cards";

const SUPPORTED_TARGET_KINDS = new Set(["none"]);
const SUPPORTED_EFFECTS = new Set(["gainGold", "drawCards"]);

export const isCardPlayable = (card: CardDef, targets?: CardPlayTargets): boolean => {
  if (!SUPPORTED_TARGET_KINDS.has(card.targetSpec.kind)) {
    return false;
  }

  if (card.targetSpec.kind === "none" && targets != null) {
    return false;
  }

  if (!card.effects || card.effects.length === 0) {
    return false;
  }

  return card.effects.every((effect) => SUPPORTED_EFFECTS.has(effect.kind));
};

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

export const resolveCardEffects = (
  state: GameState,
  playerId: PlayerID,
  card: CardDef
): GameState => {
  let nextState = state;

  for (const effect of card.effects ?? []) {
    switch (effect.kind) {
      case "gainGold": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = addGold(nextState, playerId, amount);
        break;
      }
      case "drawCards": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        nextState = drawCards(nextState, playerId, count);
        break;
      }
      default:
        break;
    }
  }

  return nextState;
};

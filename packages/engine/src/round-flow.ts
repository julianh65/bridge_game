import type { GameState, PlayerID } from "./types";
import { getPlayerIdsOnHex, hasEnemyUnits } from "./board";
import { drawToHandSize } from "./cards";

export const applyRoundReset = (state: GameState): GameState => {
  const nextRound = state.round + 1;
  const playerCount = state.players.length;
  let nextState: GameState = {
    ...state,
    round: nextRound,
    leadSeatIndex: playerCount > 0 ? (nextRound - 1) % playerCount : 0,
    players: state.players.map((player) => ({
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold + state.config.BASE_INCOME,
        mana: state.config.MAX_MANA
      },
      doneThisRound: false
    }))
  };

  for (const player of nextState.players) {
    nextState = drawToHandSize(nextState, player.id, 6);
  }

  return {
    ...nextState,
    phase: "round.market"
  };
};

export const applyCollection = (state: GameState): GameState => {
  const goldGains: Record<PlayerID, number> = {};

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.tile !== "mine") {
      continue;
    }
    if (!hex.mineValue || hex.mineValue <= 0) {
      continue;
    }
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const playerId = occupants[0];
    goldGains[playerId] = (goldGains[playerId] ?? 0) + hex.mineValue;
  }

  if (Object.keys(goldGains).length === 0) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      const gain = goldGains[player.id] ?? 0;
      if (gain <= 0) {
        return player;
      }
      return {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + gain
        }
      };
    })
  };
};

type ControlTotals = Record<PlayerID, number>;

const addControl = (totals: ControlTotals, playerId: PlayerID, amount: number) => {
  if (amount <= 0) {
    return totals;
  }
  return {
    ...totals,
    [playerId]: (totals[playerId] ?? 0) + amount
  };
};

const resolveTiebreak = (players: GameState["players"]): PlayerID | null => {
  if (players.length === 0) {
    return null;
  }

  const sorted = [...players].sort((a, b) => {
    if (a.vp.total !== b.vp.total) {
      return b.vp.total - a.vp.total;
    }
    if (a.vp.permanent !== b.vp.permanent) {
      return b.vp.permanent - a.vp.permanent;
    }
    if (a.resources.gold !== b.resources.gold) {
      return b.resources.gold - a.resources.gold;
    }
    return a.seatIndex - b.seatIndex;
  });

  return sorted[0]?.id ?? null;
};

const capitalIsSafe = (state: GameState, playerId: PlayerID): boolean => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return false;
  }
  const capital = state.board.hexes[player.capitalHex];
  if (!capital) {
    return false;
  }
  return !hasEnemyUnits(capital, playerId);
};

export const applyScoring = (state: GameState): GameState => {
  let controlTotals: ControlTotals = {};

  for (const hex of Object.values(state.board.hexes)) {
    if (hex.tile !== "center" && hex.tile !== "forge" && hex.tile !== "capital") {
      continue;
    }
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const occupant = occupants[0];
    if (hex.tile === "center") {
      controlTotals = addControl(controlTotals, occupant, 1);
      continue;
    }
    if (hex.tile === "forge") {
      controlTotals = addControl(controlTotals, occupant, 1);
      continue;
    }
    if (hex.tile === "capital" && hex.ownerPlayerId && hex.ownerPlayerId !== occupant) {
      controlTotals = addControl(controlTotals, occupant, 1);
    }
  }

  const players = state.players.map((player) => {
    const control = controlTotals[player.id] ?? 0;
    const total = player.vp.permanent + control;
    return {
      ...player,
      vp: {
        ...player.vp,
        control,
        total
      }
    };
  });

  let winnerPlayerId: PlayerID | null = null;
  const eligibleWinners = players.filter(
    (player) =>
      player.vp.total >= state.config.VP_TO_WIN && capitalIsSafe(state, player.id)
  );

  if (eligibleWinners.length > 0) {
    winnerPlayerId = resolveTiebreak(eligibleWinners);
  } else if (state.round >= state.config.ROUNDS_MAX) {
    winnerPlayerId = resolveTiebreak(players);
  }

  return {
    ...state,
    players,
    winnerPlayerId
  };
};

export const applyCleanup = (state: GameState): GameState => {
  const players = state.players.map((player) => ({
    ...player,
    deck: {
      ...player.deck,
      discardPile: [...player.deck.discardPile, ...player.deck.hand],
      hand: []
    },
    doneThisRound: false
  }));

  const bridges = Object.fromEntries(
    Object.entries(state.board.bridges).filter(([, bridge]) => !bridge.temporary)
  );

  const modifiers = state.modifiers.filter((modifier) => modifier.duration.type !== "endOfRound");

  return {
    ...state,
    players,
    board: {
      ...state.board,
      bridges
    },
    modifiers,
    market: {
      ...state.market,
      currentRow: [],
      rowIndexResolving: 0,
      passPot: 0,
      bids: Object.fromEntries(players.map((player) => [player.id, null])),
      playersOut: Object.fromEntries(players.map((player) => [player.id, false]))
    }
  };
};

export const applyAgeUpdate = (state: GameState): GameState => {
  const upcomingAge = state.config.ageByRound[state.round + 1];
  if (!upcomingAge) {
    return state;
  }

  return {
    ...state,
    market: {
      ...state.market,
      age: upcomingAge
    }
  };
};

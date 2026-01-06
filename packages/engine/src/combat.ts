import { compareHexKeys, randInt, rollDie } from "@bridgefront/shared";

import type {
  ChampionUnitState,
  GameState,
  HexKey,
  PlayerID,
  UnitID,
  UnitState
} from "./types";
import { getPlayerIdsOnHex, isContestedHex } from "./board";
import { emit } from "./events";

const FORCE_HIT_FACES = 2;
const MAX_STALE_COMBAT_ROUNDS = 20;

type HitRollResult = {
  hits: number;
  nextState: GameState["rngState"];
};

type HitAssignmentResult = {
  hitsByUnit: Record<UnitID, number>;
  nextState: GameState["rngState"];
};

type HitResolution = {
  removedUnitIds: UnitID[];
  updatedChampions: Record<UnitID, ChampionUnitState>;
  bounty: number;
};

type CombatantSummary = {
  forces: number;
  champions: number;
  total: number;
};

type CombatEndReason = "eliminated" | "noHits" | "stale";

const rollHitsForUnits = (
  unitIds: UnitID[],
  units: Record<UnitID, UnitState>,
  rngState: GameState["rngState"]
): HitRollResult => {
  let hits = 0;
  let nextState = rngState;

  for (const unitId of unitIds) {
    const unit = units[unitId];
    if (!unit) {
      continue;
    }

    if (unit.kind === "force") {
      const roll = rollDie(nextState);
      nextState = roll.next;
      if (roll.value <= FORCE_HIT_FACES) {
        hits += 1;
      }
      continue;
    }

    for (let i = 0; i < unit.attackDice; i += 1) {
      const roll = rollDie(nextState);
      nextState = roll.next;
      if (roll.value <= unit.hitFaces) {
        hits += 1;
      }
    }
  }

  return { hits, nextState };
};

const assignHits = (
  unitIds: UnitID[],
  hits: number,
  rngState: GameState["rngState"]
): HitAssignmentResult => {
  const hitsByUnit: Record<UnitID, number> = {};
  let nextState = rngState;

  if (hits <= 0 || unitIds.length === 0) {
    return { hitsByUnit, nextState };
  }

  for (let i = 0; i < hits; i += 1) {
    const roll = randInt(nextState, 0, unitIds.length - 1);
    nextState = roll.next;
    const targetId = unitIds[roll.value];
    hitsByUnit[targetId] = (hitsByUnit[targetId] ?? 0) + 1;
  }

  return { hitsByUnit, nextState };
};

const resolveHits = (
  unitIds: UnitID[],
  hitsByUnit: Record<UnitID, number>,
  units: Record<UnitID, UnitState>
): HitResolution => {
  const removedUnitIds: UnitID[] = [];
  const updatedChampions: Record<UnitID, ChampionUnitState> = {};
  let bounty = 0;

  for (const unitId of unitIds) {
    const hits = hitsByUnit[unitId] ?? 0;
    if (hits <= 0) {
      continue;
    }
    const unit = units[unitId];
    if (!unit) {
      continue;
    }

    if (unit.kind === "force") {
      removedUnitIds.push(unitId);
      continue;
    }

    const nextHp = unit.hp - hits;
    if (nextHp <= 0) {
      removedUnitIds.push(unitId);
      bounty += unit.bounty;
      continue;
    }

    updatedChampions[unitId] = {
      ...unit,
      hp: nextHp
    };
  }

  return { removedUnitIds, updatedChampions, bounty };
};

const unitCanHit = (unit?: UnitState): boolean => {
  if (!unit) {
    return false;
  }
  if (unit.kind === "force") {
    return true;
  }
  return unit.attackDice > 0 && unit.hitFaces > 0;
};

const applyBounty = (state: GameState, playerId: PlayerID, amount: number): GameState => {
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

const summarizeUnits = (
  unitIds: UnitID[],
  units: Record<UnitID, UnitState>
): CombatantSummary => {
  let forces = 0;
  let champions = 0;

  for (const unitId of unitIds) {
    const unit = units[unitId];
    if (!unit) {
      continue;
    }
    if (unit.kind === "force") {
      forces += 1;
    } else {
      champions += 1;
    }
  }

  return { forces, champions, total: forces + champions };
};

export const resolveBattleAtHex = (state: GameState, hexKey: HexKey): GameState => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return state;
  }

  const participants = getPlayerIdsOnHex(hex);
  if (participants.length !== 2) {
    return state;
  }

  const initialAttackers = hex.occupants[participants[0]] ?? [];
  const initialDefenders = hex.occupants[participants[1]] ?? [];
  let nextState = emit(state, {
    type: "combat.start",
    payload: {
      hexKey,
      attackers: {
        playerId: participants[0],
        ...summarizeUnits(initialAttackers, state.board.units)
      },
      defenders: {
        playerId: participants[1],
        ...summarizeUnits(initialDefenders, state.board.units)
      }
    }
  });
  let nextBoard = nextState.board;
  let nextUnits = nextState.board.units;
  let rngState = nextState.rngState;
  let staleRounds = 0;
  let endReason: CombatEndReason = "eliminated";

  while (true) {
    const currentHex = nextBoard.hexes[hexKey];
    if (!currentHex) {
      return nextState;
    }

    const attackers = currentHex.occupants[participants[0]] ?? [];
    const defenders = currentHex.occupants[participants[1]] ?? [];
    if (attackers.length === 0 || defenders.length === 0) {
      endReason = "eliminated";
      break;
    }
    const attackersCanHit = attackers.some((unitId) => unitCanHit(nextUnits[unitId]));
    const defendersCanHit = defenders.some((unitId) => unitCanHit(nextUnits[unitId]));
    if (!attackersCanHit && !defendersCanHit) {
      endReason = "noHits";
      break;
    }

    const attackerRoll = rollHitsForUnits(attackers, nextUnits, rngState);
    rngState = attackerRoll.nextState;
    const defenderRoll = rollHitsForUnits(defenders, nextUnits, rngState);
    rngState = defenderRoll.nextState;

    if (attackerRoll.hits + defenderRoll.hits === 0) {
      staleRounds += 1;
      if (staleRounds >= MAX_STALE_COMBAT_ROUNDS) {
        endReason = "stale";
        break;
      }
      continue;
    }
    staleRounds = 0;

    const assignedToDefenders = assignHits(defenders, attackerRoll.hits, rngState);
    rngState = assignedToDefenders.nextState;
    const assignedToAttackers = assignHits(attackers, defenderRoll.hits, rngState);
    rngState = assignedToAttackers.nextState;

    const attackerHits = resolveHits(attackers, assignedToAttackers.hitsByUnit, nextUnits);
    const defenderHits = resolveHits(defenders, assignedToDefenders.hitsByUnit, nextUnits);

    const removedSet = new Set<UnitID>([
      ...attackerHits.removedUnitIds,
      ...defenderHits.removedUnitIds
    ]);

    const updatedUnits: Record<UnitID, UnitState> = { ...nextUnits };
    for (const unitId of removedSet) {
      delete updatedUnits[unitId];
    }
    for (const [unitId, champion] of Object.entries(attackerHits.updatedChampions)) {
      updatedUnits[unitId] = champion;
    }
    for (const [unitId, champion] of Object.entries(defenderHits.updatedChampions)) {
      updatedUnits[unitId] = champion;
    }

    const updatedHex = {
      ...currentHex,
      occupants: {
        ...currentHex.occupants,
        [participants[0]]: attackers.filter((unitId) => !removedSet.has(unitId)),
        [participants[1]]: defenders.filter((unitId) => !removedSet.has(unitId))
      }
    };

    nextBoard = {
      ...nextBoard,
      units: updatedUnits,
      hexes: {
        ...nextBoard.hexes,
        [hexKey]: updatedHex
      }
    };
    nextUnits = updatedUnits;
    nextState = {
      ...nextState,
      board: nextBoard,
      rngState
    };

    if (defenderHits.bounty > 0) {
      nextState = applyBounty(nextState, participants[0], defenderHits.bounty);
    }
    if (attackerHits.bounty > 0) {
      nextState = applyBounty(nextState, participants[1], attackerHits.bounty);
    }

    nextBoard = nextState.board;
    nextUnits = nextState.board.units;
  }

  const finalHex = nextBoard.hexes[hexKey];
  const finalAttackers = finalHex?.occupants[participants[0]] ?? [];
  const finalDefenders = finalHex?.occupants[participants[1]] ?? [];
  const winnerPlayerId =
    finalAttackers.length > 0 && finalDefenders.length === 0
      ? participants[0]
      : finalDefenders.length > 0 && finalAttackers.length === 0
        ? participants[1]
        : null;

  nextState = emit(nextState, {
    type: "combat.end",
    payload: {
      hexKey,
      reason: endReason,
      winnerPlayerId,
      attackers: {
        playerId: participants[0],
        ...summarizeUnits(finalAttackers, nextUnits)
      },
      defenders: {
        playerId: participants[1],
        ...summarizeUnits(finalDefenders, nextUnits)
      }
    }
  });

  return {
    ...nextState,
    rngState
  };
};

export const resolveImmediateBattles = (state: GameState): GameState => {
  const contested = Object.values(state.board.hexes)
    .filter((hex) => hex.tile !== "capital" && isContestedHex(hex))
    .map((hex) => hex.key)
    .sort(compareHexKeys);

  let nextState = state;
  for (const hexKey of contested) {
    nextState = resolveBattleAtHex(nextState, hexKey);
  }

  return nextState;
};

export const resolveSieges = (state: GameState): GameState => {
  const seatIndexByPlayer = new Map<PlayerID, number>();
  for (const player of state.players) {
    seatIndexByPlayer.set(player.id, player.seatIndex);
  }

  const contestedCapitals = Object.values(state.board.hexes)
    .filter((hex) => hex.tile === "capital" && isContestedHex(hex) && hex.ownerPlayerId)
    .map((hex) => ({
      key: hex.key,
      defenderId: hex.ownerPlayerId as PlayerID
    }))
    .filter((entry) => seatIndexByPlayer.has(entry.defenderId))
    .sort((a, b) => {
      const seatA = seatIndexByPlayer.get(a.defenderId) ?? 0;
      const seatB = seatIndexByPlayer.get(b.defenderId) ?? 0;
      if (seatA !== seatB) {
        return seatA - seatB;
      }
      return compareHexKeys(a.key, b.key);
    });

  let nextState = state;
  for (const entry of contestedCapitals) {
    nextState = resolveBattleAtHex(nextState, entry.key);
  }

  return nextState;
};

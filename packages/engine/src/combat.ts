import { compareHexKeys, randInt, rollDie } from "@bridgefront/shared";

import type {
  ChampionUnitState,
  CombatAssignmentContext,
  CombatContext,
  CombatEndContext,
  CombatEndReason,
  CombatRoundContext,
  CombatSide,
  CombatUnitContext,
  GameState,
  HexKey,
  HitAssignmentPolicy,
  PlayerID,
  UnitID,
  UnitState
} from "./types";
import { getPlayerIdsOnHex, isContestedHex } from "./board";
import { emit } from "./events";
import {
  applyModifierQuery,
  expireEndOfBattleModifiers,
  getCombatModifiers,
  runModifierEvents
} from "./modifiers";
import { applyChampionDeathEffects, removeChampionModifiers } from "./champions";
import { applyChampionKillRewards } from "./rewards";

const FORCE_HIT_FACES = 2;
const MAX_STALE_COMBAT_ROUNDS = 20;

type HitRollResult = {
  hits: number;
  nextState: GameState["rngState"];
  rolls: DiceRoll[];
};

type HitAssignmentResult = {
  hitsByUnit: Record<UnitID, number>;
  nextState: GameState["rngState"];
  bodyguardUsed?: boolean;
};

type DiceRoll = {
  value: number;
  isHit: boolean;
};

type HitAssignmentSummary = {
  forces: number;
  champions: Array<{
    unitId: UnitID;
    cardDefId: string;
    hits: number;
    hp: number;
    maxHp: number;
  }>;
};

type HitResolution = {
  removedUnitIds: UnitID[];
  updatedChampions: Record<UnitID, ChampionUnitState>;
  bounty: number;
  killedChampions: ChampionUnitState[];
};

type CombatantSummary = {
  forces: number;
  champions: number;
  total: number;
};

const getForceHitFaces = (
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatUnitContext
): number => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getForceHitFaces,
    context,
    FORCE_HIT_FACES
  );
};

const getChampionAttackDice = (
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatUnitContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getChampionAttackDice,
    context,
    base
  );
};

const getChampionHitFaces = (
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatUnitContext,
  base: number
): number => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getChampionHitFaces,
    context,
    base
  );
};

const getHitAssignmentPolicy = (
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatAssignmentContext
): HitAssignmentPolicy => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getHitAssignmentPolicy,
    context,
    "random"
  );
};

const getUnitCombatProfile = (
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatContext,
  side: CombatSide,
  unitId: UnitID,
  unit: UnitState
): { attackDice: number; hitFaces: number } => {
  const unitContext: CombatUnitContext = {
    ...context,
    side,
    unitId,
    unit
  };

  if (unit.kind === "force") {
    return {
      attackDice: 1,
      hitFaces: getForceHitFaces(state, modifiers, unitContext)
    };
  }

  return {
    attackDice: getChampionAttackDice(state, modifiers, unitContext, unit.attackDice),
    hitFaces: getChampionHitFaces(state, modifiers, unitContext, unit.hitFaces)
  };
};

const unitCanHit = (
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatContext,
  side: CombatSide,
  unitId: UnitID,
  unit?: UnitState
): boolean => {
  if (!unit) {
    return false;
  }
  const { attackDice, hitFaces } = getUnitCombatProfile(
    state,
    modifiers,
    context,
    side,
    unitId,
    unit
  );
  return attackDice > 0 && hitFaces > 0;
};

const rollHitsForUnits = (
  unitIds: UnitID[],
  units: Record<UnitID, UnitState>,
  state: GameState,
  modifiers: GameState["modifiers"],
  context: CombatContext,
  side: CombatSide,
  rngState: GameState["rngState"]
): HitRollResult => {
  let hits = 0;
  let nextState = rngState;
  const rolls: DiceRoll[] = [];

  for (const unitId of unitIds) {
    const unit = units[unitId];
    if (!unit) {
      continue;
    }

    const { attackDice, hitFaces } = getUnitCombatProfile(
      state,
      modifiers,
      context,
      side,
      unitId,
      unit
    );
    if (attackDice <= 0 || hitFaces <= 0) {
      continue;
    }

    for (let i = 0; i < attackDice; i += 1) {
      const roll = rollDie(nextState);
      nextState = roll.next;
      const isHit = roll.value <= hitFaces;
      rolls.push({ value: roll.value, isHit });
      if (isHit) {
        hits += 1;
      }
    }
  }

  return { hits, nextState, rolls };
};

const assignHits = (
  unitIds: UnitID[],
  hits: number,
  policy: HitAssignmentPolicy,
  units: Record<UnitID, UnitState>,
  rngState: GameState["rngState"],
  bodyguardUsed = false
): HitAssignmentResult => {
  const hitsByUnit: Record<UnitID, number> = {};
  let nextState = rngState;

  if (hits <= 0 || unitIds.length === 0) {
    return { hitsByUnit, nextState };
  }

  const pickRandomTarget = (candidates: UnitID[]): UnitID | null => {
    if (candidates.length === 0) {
      return null;
    }
    const roll = randInt(nextState, 0, candidates.length - 1);
    nextState = roll.next;
    return candidates[roll.value] ?? null;
  };

  if (policy === "random") {
    for (let i = 0; i < hits; i += 1) {
      const targetId = pickRandomTarget(unitIds);
      if (!targetId) {
        break;
      }
      hitsByUnit[targetId] = (hitsByUnit[targetId] ?? 0) + 1;
    }
    return { hitsByUnit, nextState };
  }

  if (policy === "bodyguard") {
    let used = bodyguardUsed;
    const forceUnitIds = unitIds.filter((unitId) => units[unitId]?.kind === "force");
    for (let i = 0; i < hits; i += 1) {
      const targetId = pickRandomTarget(unitIds);
      if (!targetId) {
        break;
      }
      const targetUnit = units[targetId];
      if (!used && targetUnit?.kind === "champion" && forceUnitIds.length > 0) {
        const redirectId = pickRandomTarget(forceUnitIds);
        if (redirectId) {
          hitsByUnit[redirectId] = (hitsByUnit[redirectId] ?? 0) + 1;
          used = true;
          continue;
        }
      }
      hitsByUnit[targetId] = (hitsByUnit[targetId] ?? 0) + 1;
    }
    return { hitsByUnit, nextState, bodyguardUsed: used };
  }

  const isForce = (unitId: UnitID): boolean => units[unitId]?.kind === "force";
  const preferred =
    policy === "forcesFirst"
      ? unitIds.filter((unitId) => isForce(unitId))
      : unitIds.filter((unitId) => !isForce(unitId));
  const fallback =
    policy === "forcesFirst"
      ? unitIds.filter((unitId) => !isForce(unitId))
      : unitIds.filter((unitId) => isForce(unitId));

  for (let i = 0; i < hits; i += 1) {
    const targetId = pickRandomTarget(preferred.length > 0 ? preferred : fallback);
    if (!targetId) {
      break;
    }
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
  const killedChampions: ChampionUnitState[] = [];

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
      killedChampions.push(unit);
      continue;
    }

    updatedChampions[unitId] = {
      ...unit,
      hp: nextHp
    };
  }

  return { removedUnitIds, updatedChampions, bounty, killedChampions };
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

const createEmptyHitSummary = (): HitAssignmentSummary => ({
  forces: 0,
  champions: []
});

const summarizeHitAssignments = (
  hitsByUnit: Record<UnitID, number>,
  units: Record<UnitID, UnitState>
): HitAssignmentSummary => {
  let forces = 0;
  const champions: HitAssignmentSummary["champions"] = [];

  for (const [unitId, hits] of Object.entries(hitsByUnit)) {
    if (hits <= 0) {
      continue;
    }
    const unit = units[unitId];
    if (!unit) {
      continue;
    }
    if (unit.kind === "force") {
      forces += hits;
      continue;
    }
    champions.push({
      unitId,
      cardDefId: unit.cardDefId,
      hits,
      hp: unit.hp,
      maxHp: unit.maxHp
    });
  }

  return { forces, champions };
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
  let battleRound = 0;
  let bodyguardUsed: Record<CombatSide, boolean> = {
    attackers: false,
    defenders: false
  };

  while (true) {
    const currentHex = nextBoard.hexes[hexKey];
    if (!currentHex) {
      return nextState;
    }

    let attackers = currentHex.occupants[participants[0]] ?? [];
    let defenders = currentHex.occupants[participants[1]] ?? [];
    if (attackers.length === 0 || defenders.length === 0) {
      endReason = "eliminated";
      break;
    }

    battleRound += 1;
    const contextBase: CombatContext = {
      hexKey,
      attackerPlayerId: participants[0],
      defenderPlayerId: participants[1],
      round: battleRound
    };
    let modifiers = getCombatModifiers(nextState, hexKey);

    const roundContext: CombatRoundContext = {
      ...contextBase,
      attackers,
      defenders
    };
    nextState = runModifierEvents(
      nextState,
      modifiers,
      (hooks) => hooks.beforeCombatRound,
      roundContext
    );
    nextBoard = nextState.board;
    nextUnits = nextState.board.units;
    rngState = nextState.rngState;

    const afterRoundHex = nextBoard.hexes[hexKey];
    if (!afterRoundHex) {
      return nextState;
    }
    attackers = afterRoundHex.occupants[participants[0]] ?? [];
    defenders = afterRoundHex.occupants[participants[1]] ?? [];
    if (attackers.length === 0 || defenders.length === 0) {
      endReason = "eliminated";
      break;
    }

    modifiers = getCombatModifiers(nextState, hexKey);

    const attackersCanHit = attackers.some((unitId) =>
      unitCanHit(nextState, modifiers, contextBase, "attackers", unitId, nextUnits[unitId])
    );
    const defendersCanHit = defenders.some((unitId) =>
      unitCanHit(nextState, modifiers, contextBase, "defenders", unitId, nextUnits[unitId])
    );
    if (!attackersCanHit && !defendersCanHit) {
      endReason = "noHits";
      break;
    }

    const attackerRoll = rollHitsForUnits(
      attackers,
      nextUnits,
      nextState,
      modifiers,
      contextBase,
      "attackers",
      rngState
    );
    rngState = attackerRoll.nextState;
    const defenderRoll = rollHitsForUnits(
      defenders,
      nextUnits,
      nextState,
      modifiers,
      contextBase,
      "defenders",
      rngState
    );
    rngState = defenderRoll.nextState;

    const roundPayloadBase = {
      hexKey,
      round: battleRound,
      attackers: {
        playerId: participants[0],
        dice: attackerRoll.rolls,
        hits: attackerRoll.hits
      },
      defenders: {
        playerId: participants[1],
        dice: defenderRoll.rolls,
        hits: defenderRoll.hits
      }
    };

    if (attackerRoll.hits + defenderRoll.hits === 0) {
      staleRounds += 1;
      nextState = emit(nextState, {
        type: "combat.round",
        payload: {
          ...roundPayloadBase,
          hitsToAttackers: createEmptyHitSummary(),
          hitsToDefenders: createEmptyHitSummary()
        }
      });
      if (staleRounds >= MAX_STALE_COMBAT_ROUNDS) {
        endReason = "stale";
        break;
      }
      continue;
    }
    staleRounds = 0;

    const defenderAssignmentContext: CombatAssignmentContext = {
      ...contextBase,
      targetSide: "defenders",
      targetUnitIds: defenders,
      hits: attackerRoll.hits
    };
    const defenderPolicy = getHitAssignmentPolicy(
      nextState,
      modifiers,
      defenderAssignmentContext
    );
    const assignedToDefenders = assignHits(
      defenders,
      attackerRoll.hits,
      defenderPolicy,
      nextUnits,
      rngState,
      bodyguardUsed.defenders
    );
    rngState = assignedToDefenders.nextState;
    bodyguardUsed.defenders =
      assignedToDefenders.bodyguardUsed ?? bodyguardUsed.defenders;
    const attackerAssignmentContext: CombatAssignmentContext = {
      ...contextBase,
      targetSide: "attackers",
      targetUnitIds: attackers,
      hits: defenderRoll.hits
    };
    const attackerPolicy = getHitAssignmentPolicy(
      nextState,
      modifiers,
      attackerAssignmentContext
    );
    const assignedToAttackers = assignHits(
      attackers,
      defenderRoll.hits,
      attackerPolicy,
      nextUnits,
      rngState,
      bodyguardUsed.attackers
    );
    rngState = assignedToAttackers.nextState;
    bodyguardUsed.attackers =
      assignedToAttackers.bodyguardUsed ?? bodyguardUsed.attackers;

    nextState = emit(nextState, {
      type: "combat.round",
      payload: {
        ...roundPayloadBase,
        hitsToDefenders: summarizeHitAssignments(
          assignedToDefenders.hitsByUnit,
          nextUnits
        ),
        hitsToAttackers: summarizeHitAssignments(
          assignedToAttackers.hitsByUnit,
          nextUnits
        )
      }
    });

    const attackerHits = resolveHits(attackers, assignedToAttackers.hitsByUnit, nextUnits);
    const defenderHits = resolveHits(defenders, assignedToDefenders.hitsByUnit, nextUnits);

    const removedSet = new Set<UnitID>([
      ...attackerHits.removedUnitIds,
      ...defenderHits.removedUnitIds
    ]);
    const removedChampionIds = [
      ...attackerHits.killedChampions.map((unit) => unit.id),
      ...defenderHits.killedChampions.map((unit) => unit.id)
    ];
    const uniqueChampionIds = [...new Set(removedChampionIds)];

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
    if (uniqueChampionIds.length > 0) {
      nextState = removeChampionModifiers(nextState, uniqueChampionIds);
    }

    const killedChampions = [
      ...defenderHits.killedChampions,
      ...attackerHits.killedChampions
    ];
    if (killedChampions.length > 0) {
      nextState = applyChampionDeathEffects(nextState, killedChampions);
    }

    if (defenderHits.killedChampions.length > 0) {
      nextState = applyChampionKillRewards(nextState, {
        killerPlayerId: participants[0],
        victimPlayerId: participants[1],
        killedChampions: defenderHits.killedChampions,
        bounty: defenderHits.bounty,
        hexKey,
        source: "battle"
      });
    }
    if (attackerHits.killedChampions.length > 0) {
      nextState = applyChampionKillRewards(nextState, {
        killerPlayerId: participants[1],
        victimPlayerId: participants[0],
        killedChampions: attackerHits.killedChampions,
        bounty: attackerHits.bounty,
        hexKey,
        source: "battle"
      });
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

  const endContext: CombatEndContext = {
    hexKey,
    attackerPlayerId: participants[0],
    defenderPlayerId: participants[1],
    round: battleRound,
    reason: endReason,
    winnerPlayerId,
    attackers: finalAttackers,
    defenders: finalDefenders
  };

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

  nextState = runModifierEvents(
    nextState,
    getCombatModifiers(nextState, hexKey),
    (hooks) => hooks.afterBattle,
    endContext
  );

  return expireEndOfBattleModifiers(nextState, hexKey);
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

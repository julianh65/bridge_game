import { compareHexKeys, parseEdgeKey, randInt, rollDie } from "@bridgefront/shared";

import type {
  ChampionUnitState,
  BlockState,
  CombatAssignmentContext,
  CombatContext,
  CombatEndContext,
  CombatEndReason,
  CombatRoundContext,
  CombatSide,
  CombatSideSummary,
  CombatRetreatSelection,
  EdgeKey,
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
import {
  consumeChampionAbilityUse,
  GRAND_STRATEGIST_CHAMPION_ID,
  TACTICAL_HAND_KEY,
  applyGoldArmorToDamage,
  applyChampionDeathEffects,
  removeChampionModifiers
} from "./champions";
import { applyChampionKillRewards } from "./rewards";
import { moveStack } from "./units";

const FORCE_HIT_FACES = 2;
const MAX_STALE_COMBAT_ROUNDS = 20;
const TACTICAL_HAND_HITS = 3;

type HitRollResult = {
  hits: number;
  nextState: GameState["rngState"];
  rolls: DiceRoll[];
  unitRolls: CombatUnitRoll[];
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

type CombatUnitRoll = {
  unitId: UnitID;
  kind: UnitState["kind"];
  cardDefId?: string;
  hp?: number;
  maxHp?: number;
  attackDice: number;
  hitFaces: number;
  dice: DiceRoll[];
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
  const unitRolls: CombatUnitRoll[] = [];

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
    const unitRoll: CombatUnitRoll = {
      unitId,
      kind: unit.kind,
      attackDice,
      hitFaces,
      dice: []
    };
    if (unit.kind === "champion") {
      unitRoll.cardDefId = unit.cardDefId;
      unitRoll.hp = unit.hp;
      unitRoll.maxHp = unit.maxHp;
    }
    if (attackDice <= 0 || hitFaces <= 0) {
      unitRolls.push(unitRoll);
      continue;
    }

    for (let i = 0; i < attackDice; i += 1) {
      const roll = rollDie(nextState);
      nextState = roll.next;
      const isHit = roll.value <= hitFaces;
      const entry = { value: roll.value, isHit };
      rolls.push(entry);
      unitRoll.dice.push(entry);
      if (isHit) {
        hits += 1;
      }
    }
    unitRolls.push(unitRoll);
  }

  return { hits, nextState, rolls, unitRolls };
};

const findTacticalHandSource = (
  state: GameState,
  hexKey: HexKey,
  ownerPlayerId: PlayerID
): UnitID | null => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return null;
  }
  const occupantIds = hex.occupants[ownerPlayerId] ?? [];
  for (const unitId of occupantIds) {
    const unit = state.board.units[unitId];
    if (
      unit?.kind === "champion" &&
      unit.cardDefId === GRAND_STRATEGIST_CHAMPION_ID &&
      (unit.abilityUses[TACTICAL_HAND_KEY]?.remaining ?? 0) > 0
    ) {
      return unitId;
    }
  }
  return null;
};

const hasBodyguardModifier = (
  modifiers: GameState["modifiers"],
  targetUnitIds: UnitID[],
  units: Record<UnitID, UnitState>
): boolean => {
  if (targetUnitIds.length === 0) {
    return false;
  }
  const hasForce = targetUnitIds.some((unitId) => units[unitId]?.kind === "force");
  if (!hasForce) {
    return false;
  }
  return modifiers.some((modifier) => {
    if (modifier.data?.bodyguard !== true) {
      return false;
    }
    const unitId = modifier.data?.unitId;
    return typeof unitId === "string" && targetUnitIds.includes(unitId);
  });
};

const assignHits = (
  unitIds: UnitID[],
  hits: number,
  policy: HitAssignmentPolicy,
  units: Record<UnitID, UnitState>,
  rngState: GameState["rngState"],
  bodyguardUsed = false,
  bodyguardActive = policy === "bodyguard"
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

  if (policy === "tacticalHand" || policy === "focusFire") {
    let used = bodyguardUsed;
    const forceUnitIds = unitIds.filter((unitId) => units[unitId]?.kind === "force");
    const championRemaining = new Map<UnitID, number>();
    for (const unitId of unitIds) {
      const unit = units[unitId];
      if (unit?.kind === "champion") {
        championRemaining.set(unitId, unit.hp);
      }
    }
    const forceTargets = forceUnitIds.slice().sort();

    const pickManualTarget = (): UnitID | null => {
      let bestChampion: UnitID | null = null;
      let bestHp = Number.POSITIVE_INFINITY;
      for (const [unitId, remaining] of championRemaining.entries()) {
        if (remaining <= 0) {
          continue;
        }
        if (remaining < bestHp || (remaining === bestHp && unitId < (bestChampion ?? ""))) {
          bestChampion = unitId;
          bestHp = remaining;
        }
      }
      if (bestChampion) {
        return bestChampion;
      }
      return forceTargets[0] ?? null;
    };

    let assignedManual = 0;
    const manualLimit = policy === "tacticalHand" ? TACTICAL_HAND_HITS : hits;
    const manualHits = Math.min(manualLimit, hits);
    for (let i = 0; i < manualHits; i += 1) {
      const targetId = pickManualTarget();
      if (!targetId) {
        break;
      }
      const targetUnit = units[targetId];
      if (
        bodyguardActive &&
        !used &&
        targetUnit?.kind === "champion" &&
        forceUnitIds.length > 0
      ) {
        const redirectId = pickRandomTarget(forceUnitIds);
        if (redirectId) {
          hitsByUnit[redirectId] = (hitsByUnit[redirectId] ?? 0) + 1;
          used = true;
          assignedManual += 1;
          continue;
        }
      }

      hitsByUnit[targetId] = (hitsByUnit[targetId] ?? 0) + 1;
      assignedManual += 1;
      if (targetUnit?.kind === "champion") {
        const remaining = (championRemaining.get(targetId) ?? 0) - 1;
        championRemaining.set(targetId, remaining);
      } else if (targetUnit?.kind === "force") {
        const index = forceTargets.indexOf(targetId);
        if (index >= 0) {
          forceTargets.splice(index, 1);
        }
      }
    }

    const remainingHits = hits - assignedManual;
    for (let i = 0; i < remainingHits; i += 1) {
      const targetId = pickRandomTarget(unitIds);
      if (!targetId) {
        break;
      }
      const targetUnit = units[targetId];
      if (
        bodyguardActive &&
        !used &&
        targetUnit?.kind === "champion" &&
        forceUnitIds.length > 0
      ) {
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

const applyGoldArmorToHits = (
  state: GameState,
  hitsByUnit: Record<UnitID, number>
): { state: GameState; hitsByUnit: Record<UnitID, number> } => {
  let nextState = state;
  const nextHits: Record<UnitID, number> = { ...hitsByUnit };

  for (const [unitId, hits] of Object.entries(hitsByUnit)) {
    if (hits <= 0) {
      continue;
    }
    const unit = nextState.board.units[unitId];
    if (!unit || unit.kind !== "champion") {
      continue;
    }
    const result = applyGoldArmorToDamage(nextState, unitId, hits);
    nextState = result.state;
    if (result.remainingDamage !== hits) {
      nextHits[unitId] = result.remainingDamage;
    }
  }

  return { state: nextState, hitsByUnit: nextHits };
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

const buildSideSummary = (
  playerId: PlayerID,
  unitIds: UnitID[],
  units: Record<UnitID, UnitState>
): CombatSideSummary => {
  return {
    playerId,
    ...summarizeUnits(unitIds, units)
  };
};

const getRetreatDestination = (hexKey: HexKey, edgeKey: EdgeKey): HexKey | null => {
  try {
    const [from, to] = parseEdgeKey(edgeKey);
    if (from === hexKey) {
      return to;
    }
    if (to === hexKey) {
      return from;
    }
  } catch {
    return null;
  }
  return null;
};

const canRetreatToHex = (state: GameState, playerId: PlayerID, hexKey: HexKey): boolean => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return false;
  }
  return getPlayerIdsOnHex(hex).length === 0;
};

const getRetreatEdgesForPlayer = (
  state: GameState,
  hexKey: HexKey,
  playerId: PlayerID
): EdgeKey[] => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || player.resources.mana < 1) {
    return [];
  }

  const edges: EdgeKey[] = [];
  for (const bridge of Object.values(state.board.bridges)) {
    if (bridge.locked) {
      continue;
    }
    if (bridge.from !== hexKey && bridge.to !== hexKey) {
      continue;
    }
    const destination = bridge.from === hexKey ? bridge.to : bridge.from;
    if (!canRetreatToHex(state, playerId, destination)) {
      continue;
    }
    edges.push(bridge.key);
  }

  return edges;
};

const applyRetreatMoves = (
  state: GameState,
  hexKey: HexKey,
  plans: Array<{ playerId: PlayerID; destination: HexKey }>
): GameState => {
  let nextState = state;

  for (const plan of plans) {
    const hex = nextState.board.hexes[hexKey];
    if (!hex) {
      continue;
    }
    const occupants = hex.occupants[plan.playerId] ?? [];
    if (occupants.length === 0) {
      continue;
    }
    nextState = {
      ...nextState,
      board: moveStack(nextState.board, plan.playerId, hexKey, plan.destination)
    };
  }

  return nextState;
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

export const createCombatRetreatBlock = (
  state: GameState,
  hexKey: HexKey
): BlockState | null => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return null;
  }

  const participants = getPlayerIdsOnHex(hex);
  if (participants.length !== 2) {
    return null;
  }

  const attackersId = participants[0];
  const defendersId = participants[1];
  const availableEdges: Record<PlayerID, EdgeKey[]> = {
    [attackersId]: getRetreatEdgesForPlayer(state, hexKey, attackersId),
    [defendersId]: getRetreatEdgesForPlayer(state, hexKey, defendersId)
  };
  const eligiblePlayerIds = participants.filter(
    (playerId) => (availableEdges[playerId] ?? []).length > 0
  );
  if (eligiblePlayerIds.length === 0) {
    return null;
  }

  const choices = Object.fromEntries(
    participants.map((playerId) => [playerId, null])
  ) as Record<PlayerID, CombatRetreatSelection>;

  return {
    type: "combat.retreat",
    waitingFor: eligiblePlayerIds,
    payload: {
      hexKey,
      attackers: buildSideSummary(
        attackersId,
        hex.occupants[attackersId] ?? [],
        state.board.units
      ),
      defenders: buildSideSummary(
        defendersId,
        hex.occupants[defendersId] ?? [],
        state.board.units
      ),
      eligiblePlayerIds,
      availableEdges,
      choices
    }
  };
};

export const resolveBattleAtHex = (
  state: GameState,
  hexKey: HexKey,
  retreatChoices?: Record<PlayerID, EdgeKey>
): GameState => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return state;
  }

  const participants = getPlayerIdsOnHex(hex);
  if (participants.length !== 2) {
    return state;
  }

  const retreatPlans: Array<{ playerId: PlayerID; destination: HexKey }> = [];
  if (retreatChoices) {
    for (const playerId of participants) {
      const edgeKey = retreatChoices[playerId];
      if (!edgeKey) {
        continue;
      }
      const bridge = state.board.bridges[edgeKey];
      if (!bridge || bridge.locked) {
        continue;
      }
      const destination = getRetreatDestination(hexKey, edgeKey);
      if (!destination || !canRetreatToHex(state, playerId, destination)) {
        continue;
      }
      const player = state.players.find((entry) => entry.id === playerId);
      if (!player || player.resources.mana < 1) {
        continue;
      }
      retreatPlans.push({ playerId, destination });
    }
  }

  let nextState: GameState = state;
  if (retreatPlans.length > 0) {
    const retreating = new Set(retreatPlans.map((plan) => plan.playerId));
    nextState = {
      ...nextState,
      players: nextState.players.map((player) =>
        retreating.has(player.id)
          ? {
              ...player,
              resources: {
                ...player.resources,
                mana: Math.max(0, player.resources.mana - 1)
              }
            }
          : player
      )
    };
  }

  const initialAttackers = hex.occupants[participants[0]] ?? [];
  const initialDefenders = hex.occupants[participants[1]] ?? [];
  nextState = emit(nextState, {
    type: "combat.start",
    payload: {
      hexKey,
      attackers: {
        playerId: participants[0],
        ...summarizeUnits(initialAttackers, nextState.board.units)
      },
      defenders: {
        playerId: participants[1],
        ...summarizeUnits(initialDefenders, nextState.board.units)
      }
    }
  });
  let nextBoard = nextState.board;
  let nextUnits = nextState.board.units;
  let rngState = nextState.rngState;
  let staleRounds = 0;
  let endReason: CombatEndReason = "eliminated";
  let battleRound = 0;
  const retreatAfterRound = retreatPlans.length > 0;
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
      if (!retreatAfterRound) {
        endReason = "noHits";
        break;
      }
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
        hits: attackerRoll.hits,
        units: attackerRoll.unitRolls
      },
      defenders: {
        playerId: participants[1],
        dice: defenderRoll.rolls,
        hits: defenderRoll.hits,
        units: defenderRoll.unitRolls
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
      nextState = {
        ...nextState,
        rngState
      };
      if (retreatAfterRound) {
        nextState = applyRetreatMoves(nextState, hexKey, retreatPlans);
        nextBoard = nextState.board;
        nextUnits = nextState.board.units;
        endReason = "retreated";
        break;
      }
      if (staleRounds >= MAX_STALE_COMBAT_ROUNDS) {
        endReason = "stale";
        break;
      }
      continue;
    }
    staleRounds = 0;

    const defenderTacticalSource =
      attackerRoll.hits > 0
        ? findTacticalHandSource(nextState, hexKey, participants[0])
        : null;
    const attackerTacticalSource =
      defenderRoll.hits > 0
        ? findTacticalHandSource(nextState, hexKey, participants[1])
        : null;

    const defenderAssignmentContext: CombatAssignmentContext = {
      ...contextBase,
      targetSide: "defenders",
      targetUnitIds: defenders,
      hits: attackerRoll.hits
    };
    const defenderBasePolicy = getHitAssignmentPolicy(
      nextState,
      modifiers,
      defenderAssignmentContext
    );
    const defenderPolicy = defenderTacticalSource ? "tacticalHand" : defenderBasePolicy;
    const defenderBodyguardActive =
      defenderBasePolicy === "bodyguard" ||
      hasBodyguardModifier(modifiers, defenders, nextUnits);
    const assignedToDefenders = assignHits(
      defenders,
      attackerRoll.hits,
      defenderPolicy,
      nextUnits,
      rngState,
      bodyguardUsed.defenders,
      defenderBodyguardActive
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
    const attackerBasePolicy = getHitAssignmentPolicy(
      nextState,
      modifiers,
      attackerAssignmentContext
    );
    const attackerPolicy = attackerTacticalSource ? "tacticalHand" : attackerBasePolicy;
    const attackerBodyguardActive =
      attackerBasePolicy === "bodyguard" ||
      hasBodyguardModifier(modifiers, attackers, nextUnits);
    const assignedToAttackers = assignHits(
      attackers,
      defenderRoll.hits,
      attackerPolicy,
      nextUnits,
      rngState,
      bodyguardUsed.attackers,
      attackerBodyguardActive
    );
    rngState = assignedToAttackers.nextState;
    bodyguardUsed.attackers =
      assignedToAttackers.bodyguardUsed ?? bodyguardUsed.attackers;

    if (defenderTacticalSource) {
      nextState = consumeChampionAbilityUse(
        nextState,
        defenderTacticalSource,
        TACTICAL_HAND_KEY
      );
      nextUnits = nextState.board.units;
    }
    if (attackerTacticalSource) {
      nextState = consumeChampionAbilityUse(
        nextState,
        attackerTacticalSource,
        TACTICAL_HAND_KEY
      );
      nextUnits = nextState.board.units;
    }

    const defenderArmor = applyGoldArmorToHits(nextState, assignedToDefenders.hitsByUnit);
    nextState = defenderArmor.state;
    const defenderHitsByUnit = defenderArmor.hitsByUnit;
    const attackerArmor = applyGoldArmorToHits(nextState, assignedToAttackers.hitsByUnit);
    nextState = attackerArmor.state;
    const attackerHitsByUnit = attackerArmor.hitsByUnit;

    nextState = emit(nextState, {
      type: "combat.round",
      payload: {
        ...roundPayloadBase,
        hitsToDefenders: summarizeHitAssignments(
          defenderHitsByUnit,
          nextUnits
        ),
        hitsToAttackers: summarizeHitAssignments(
          attackerHitsByUnit,
          nextUnits
        )
      }
    });

    const attackerHits = resolveHits(attackers, attackerHitsByUnit, nextUnits);
    const defenderHits = resolveHits(defenders, defenderHitsByUnit, nextUnits);

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

    const postRoundHex = nextBoard.hexes[hexKey];
    const remainingAttackers = postRoundHex?.occupants[participants[0]] ?? [];
    const remainingDefenders = postRoundHex?.occupants[participants[1]] ?? [];
    if (remainingAttackers.length === 0 || remainingDefenders.length === 0) {
      endReason = "eliminated";
      break;
    }

    if (retreatAfterRound) {
      nextState = applyRetreatMoves(nextState, hexKey, retreatPlans);
      nextBoard = nextState.board;
      nextUnits = nextState.board.units;
      endReason = "retreated";
      break;
    }
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

export const applyCombatRetreatChoice = (
  state: GameState,
  playerId: PlayerID,
  payload: { hexKey: HexKey; edgeKey: EdgeKey | null }
): GameState => {
  const block = state.blocks;
  if (!block || block.type !== "combat.retreat") {
    return state;
  }
  if (block.payload.hexKey !== payload.hexKey) {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (!block.payload.eligiblePlayerIds.includes(playerId)) {
    return state;
  }

  let choice: CombatRetreatSelection = "stay";
  if (payload.edgeKey) {
    const options = block.payload.availableEdges[playerId] ?? [];
    if (!options.includes(payload.edgeKey)) {
      return state;
    }
    choice = payload.edgeKey;
  }

  return {
    ...state,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        choices: {
          ...block.payload.choices,
          [playerId]: choice
        }
      }
    }
  };
};

export const resolveCombatRetreatBlock = (
  state: GameState,
  block: Extract<BlockState, { type: "combat.retreat" }>
): GameState => {
  const retreatChoices: Record<PlayerID, EdgeKey> = {};
  for (const [playerId, choice] of Object.entries(block.payload.choices)) {
    if (!choice || choice === "stay") {
      continue;
    }
    retreatChoices[playerId] = choice;
  }

  return resolveBattleAtHex(state, block.payload.hexKey, retreatChoices);
};

export const resolveImmediateBattles = (state: GameState): GameState => {
  if (state.blocks?.type === "combat.retreat") {
    return state;
  }

  const contested = Object.values(state.board.hexes)
    .filter((hex) => hex.tile !== "capital" && isContestedHex(hex))
    .map((hex) => hex.key)
    .sort(compareHexKeys);

  let nextState = state;
  for (const hexKey of contested) {
    const block = createCombatRetreatBlock(nextState, hexKey);
    if (block) {
      return {
        ...nextState,
        blocks: block
      };
    }
    nextState = resolveBattleAtHex(nextState, hexKey);
  }

  return nextState;
};

export const resolveSieges = (state: GameState): GameState => {
  if (state.blocks?.type === "combat.retreat") {
    return state;
  }

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
    const block = createCombatRetreatBlock(nextState, entry.key);
    if (block) {
      return {
        ...nextState,
        blocks: block
      };
    }
    nextState = resolveBattleAtHex(nextState, entry.key);
  }

  return nextState;
};

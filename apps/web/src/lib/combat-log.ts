import type { GameEvent } from "@bridgefront/engine";

type DiceRoll = {
  value: number;
  isHit: boolean;
};

export type CombatUnitRoll = {
  unitId: string;
  kind: "force" | "champion";
  cardDefId?: string;
  hp?: number;
  maxHp?: number;
  attackDice: number;
  hitFaces: number;
  dice: DiceRoll[];
};

type HitChampionSummary = {
  unitId: string;
  cardDefId: string;
  hits: number;
  hp: number;
  maxHp: number;
};

export type HitAssignmentSummary = {
  forces: number;
  champions: HitChampionSummary[];
};

export type CombatSideRoll = {
  playerId: string;
  dice: DiceRoll[];
  hits: number;
  units?: CombatUnitRoll[];
};

export type CombatRoundData = {
  hexKey: string;
  round: number;
  attackers: CombatSideRoll;
  defenders: CombatSideRoll;
  hitsToAttackers: HitAssignmentSummary;
  hitsToDefenders: HitAssignmentSummary;
};

export type CombatSideSummary = {
  playerId: string;
  forces: number;
  champions: number;
  total: number;
};

export type CombatStartData = {
  hexKey: string;
  attackers: CombatSideSummary;
  defenders: CombatSideSummary;
};

export type CombatEndData = {
  hexKey: string;
  reason: string | null;
  winnerPlayerId: string | null;
  attackers: CombatSideSummary;
  defenders: CombatSideSummary;
};

export type CombatSequence = {
  id: string;
  startIndex: number;
  endIndex: number;
  start: CombatStartData;
  rounds: CombatRoundData[];
  end: CombatEndData;
};

const readString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

const readNumber = (value: unknown): number | null => {
  return typeof value === "number" ? value : null;
};

const readBoolean = (value: unknown): boolean | null => {
  return typeof value === "boolean" ? value : null;
};

const readUnitKind = (value: unknown): CombatUnitRoll["kind"] | null => {
  if (value === "force" || value === "champion") {
    return value;
  }
  return null;
};

const readRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readArray = (value: unknown): unknown[] | null => {
  return Array.isArray(value) ? value : null;
};

const parseDiceRolls = (value: unknown): DiceRoll[] => {
  const entries = readArray(value);
  if (!entries) {
    return [];
  }
  const rolls: DiceRoll[] = [];
  for (const entry of entries) {
    const record = readRecord(entry);
    const rollValue = readNumber(record?.value);
    const isHit = readBoolean(record?.isHit);
    if (rollValue === null || isHit === null) {
      continue;
    }
    rolls.push({ value: rollValue, isHit });
  }
  return rolls;
};

const parseUnitRolls = (value: unknown): CombatUnitRoll[] => {
  const entries = readArray(value);
  if (!entries) {
    return [];
  }
  const units: CombatUnitRoll[] = [];
  for (const entry of entries) {
    const record = readRecord(entry);
    const unitId = readString(record?.unitId);
    const kind = readUnitKind(record?.kind);
    if (!unitId || !kind) {
      continue;
    }
    const attackDice = readNumber(record?.attackDice) ?? 0;
    const hitFaces = readNumber(record?.hitFaces) ?? 0;
    const dice = parseDiceRolls(record?.dice);
    const unit: CombatUnitRoll = {
      unitId,
      kind,
      attackDice,
      hitFaces,
      dice
    };
    if (kind === "champion") {
      const cardDefId = readString(record?.cardDefId);
      const hp = readNumber(record?.hp);
      const maxHp = readNumber(record?.maxHp);
      if (cardDefId) {
        unit.cardDefId = cardDefId;
      }
      if (hp !== null) {
        unit.hp = hp;
      }
      if (maxHp !== null) {
        unit.maxHp = maxHp;
      }
    }
    units.push(unit);
  }
  return units;
};

const parseSideSummary = (value: unknown): CombatSideSummary | null => {
  const record = readRecord(value);
  const playerId = readString(record?.playerId);
  if (!playerId) {
    return null;
  }
  const forces = readNumber(record?.forces) ?? 0;
  const champions = readNumber(record?.champions) ?? 0;
  const total = readNumber(record?.total) ?? forces + champions;
  return {
    playerId,
    forces,
    champions,
    total
  };
};

const parseSideRoll = (value: unknown): CombatSideRoll | null => {
  const record = readRecord(value);
  const playerId = readString(record?.playerId);
  if (!playerId) {
    return null;
  }
  const hits = readNumber(record?.hits) ?? 0;
  const dice = parseDiceRolls(record?.dice);
  const units = parseUnitRolls(record?.units);
  return {
    playerId,
    hits,
    dice,
    units: units.length > 0 ? units : undefined
  };
};

const parseHitSummary = (value: unknown): HitAssignmentSummary => {
  const record = readRecord(value);
  const forces = readNumber(record?.forces) ?? 0;
  const champions: HitChampionSummary[] = [];
  const entries = readArray(record?.champions) ?? [];
  for (const entry of entries) {
    const item = readRecord(entry);
    const unitId = readString(item?.unitId);
    const cardDefId = readString(item?.cardDefId);
    const hits = readNumber(item?.hits);
    const hp = readNumber(item?.hp);
    const maxHp = readNumber(item?.maxHp);
    if (!unitId || !cardDefId || hits === null || hp === null || maxHp === null) {
      continue;
    }
    champions.push({
      unitId,
      cardDefId,
      hits,
      hp,
      maxHp
    });
  }
  return { forces, champions };
};

const parseCombatStart = (event: GameEvent): CombatStartData | null => {
  const payload = event.payload ?? {};
  const hexKey = readString(payload.hexKey) ?? null;
  if (!hexKey) {
    return null;
  }
  const attackers = parseSideSummary(payload.attackers);
  const defenders = parseSideSummary(payload.defenders);
  if (!attackers || !defenders) {
    return null;
  }
  return { hexKey, attackers, defenders };
};

const parseCombatEnd = (event: GameEvent): CombatEndData | null => {
  const payload = event.payload ?? {};
  const hexKey = readString(payload.hexKey) ?? null;
  if (!hexKey) {
    return null;
  }
  const attackers = parseSideSummary(payload.attackers);
  const defenders = parseSideSummary(payload.defenders);
  if (!attackers || !defenders) {
    return null;
  }
  const reason = readString(payload.reason);
  const winnerPlayerId = readString(payload.winnerPlayerId);
  return { hexKey, attackers, defenders, reason, winnerPlayerId };
};

const parseCombatRound = (event: GameEvent): CombatRoundData | null => {
  const payload = event.payload ?? {};
  const hexKey = readString(payload.hexKey) ?? null;
  const round = readNumber(payload.round);
  if (!hexKey || round === null) {
    return null;
  }
  const attackers = parseSideRoll(payload.attackers);
  const defenders = parseSideRoll(payload.defenders);
  if (!attackers || !defenders) {
    return null;
  }
  const hitsToAttackers = parseHitSummary(payload.hitsToAttackers);
  const hitsToDefenders = parseHitSummary(payload.hitsToDefenders);
  return {
    hexKey,
    round,
    attackers,
    defenders,
    hitsToAttackers,
    hitsToDefenders
  };
};

export const extractCombatSequences = (logs: GameEvent[]): CombatSequence[] => {
  const sequences: CombatSequence[] = [];
  let current: {
    startIndex: number;
    start: CombatStartData;
    rounds: CombatRoundData[];
  } | null = null;

  logs.forEach((entry, index) => {
    if (entry.type === "combat.start") {
      const start = parseCombatStart(entry);
      if (!start) {
        current = null;
        return;
      }
      current = {
        startIndex: index,
        start,
        rounds: []
      };
      return;
    }

    if (entry.type === "combat.round") {
      if (!current) {
        return;
      }
      const round = parseCombatRound(entry);
      if (round) {
        current.rounds.push(round);
      }
      return;
    }

    if (entry.type === "combat.end") {
      if (!current) {
        return;
      }
      const end = parseCombatEnd(entry);
      if (!end) {
        current = null;
        return;
      }
      sequences.push({
        id: `${current.start.hexKey}-${current.startIndex}`,
        startIndex: current.startIndex,
        endIndex: index,
        start: current.start,
        rounds: current.rounds,
        end
      });
      current = null;
    }
  });

  return sequences;
};

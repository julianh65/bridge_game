import type { BoardState, CardDefId, HexKey, PlayerID, UnitID } from "./types";

const normalizeForceCount = (forceCount?: number): number | null => {
  if (typeof forceCount !== "number" || !Number.isFinite(forceCount)) {
    return null;
  }
  const normalized = Math.floor(forceCount);
  return normalized > 0 ? normalized : null;
};

const getForceUnitsAtHex = (
  board: BoardState,
  playerId: PlayerID,
  hexKey: HexKey
): UnitID[] => {
  const hex = board.hexes[hexKey];
  if (!hex) {
    return [];
  }
  const occupants = hex.occupants[playerId] ?? [];
  const forceUnits: UnitID[] = [];
  for (const unitId of occupants) {
    if (board.units[unitId]?.kind === "force") {
      forceUnits.push(unitId);
    }
  }
  return forceUnits;
};

export const selectMovingUnits = (
  board: BoardState,
  playerId: PlayerID,
  from: HexKey,
  forceCount?: number
): UnitID[] => {
  const fromHex = board.hexes[from];
  if (!fromHex) {
    return [];
  }
  const occupants = fromHex.occupants[playerId] ?? [];
  if (forceCount === undefined || forceCount === null) {
    return occupants;
  }
  const normalized = normalizeForceCount(forceCount);
  if (normalized === null) {
    return [];
  }
  const forceUnits = getForceUnitsAtHex(board, playerId, from);
  if (forceUnits.length < normalized) {
    return [];
  }
  return forceUnits.slice(0, normalized);
};

type ChampionDeployment = {
  cardDefId: CardDefId;
  hp: number;
  attackDice: number;
  hitFaces: number;
  bounty: number;
};

export const addForcesToHex = (
  board: BoardState,
  playerId: PlayerID,
  hexKey: HexKey,
  count: number
): BoardState => {
  if (count <= 0) {
    return board;
  }

  const hex = board.hexes[hexKey];
  if (!hex) {
    throw new Error("hex does not exist");
  }

  // Scan existing force ids to avoid collisions when units are removed.
  let maxForceIndex = 0;
  for (const unitId of Object.keys(board.units)) {
    if (!unitId.startsWith("u_")) {
      continue;
    }
    const parsed = Number(unitId.slice(2));
    if (Number.isInteger(parsed) && parsed > maxForceIndex) {
      maxForceIndex = parsed;
    }
  }
  let nextIndex = maxForceIndex + 1;
  const units = { ...board.units };
  const newUnitIds: UnitID[] = [];

  for (let i = 0; i < count; i += 1) {
    const unitId = `u_${nextIndex}`;
    nextIndex += 1;
    units[unitId] = {
      id: unitId,
      ownerPlayerId: playerId,
      kind: "force",
      hex: hexKey
    };
    newUnitIds.push(unitId);
  }

  return {
    ...board,
    units,
    hexes: {
      ...board.hexes,
      [hexKey]: {
        ...hex,
        occupants: {
          ...hex.occupants,
          [playerId]: [...(hex.occupants[playerId] ?? []), ...newUnitIds]
        }
      }
    }
  };
};

export const countPlayerChampions = (board: BoardState, playerId: PlayerID): number => {
  return Object.values(board.units).filter(
    (unit) => unit.kind === "champion" && unit.ownerPlayerId === playerId
  ).length;
};

export const addChampionToHex = (
  board: BoardState,
  playerId: PlayerID,
  hexKey: HexKey,
  champion: ChampionDeployment
): { board: BoardState; unitId: UnitID } => {
  const hex = board.hexes[hexKey];
  if (!hex) {
    throw new Error("hex does not exist");
  }

  let maxChampionIndex = 0;
  for (const unitId of Object.keys(board.units)) {
    if (!unitId.startsWith("c_")) {
      continue;
    }
    const parsed = Number(unitId.slice(2));
    if (Number.isInteger(parsed) && parsed > maxChampionIndex) {
      maxChampionIndex = parsed;
    }
  }
  const unitId = `c_${maxChampionIndex + 1}`;

  return {
    board: {
      ...board,
      units: {
        ...board.units,
        [unitId]: {
          id: unitId,
          ownerPlayerId: playerId,
          kind: "champion",
          hex: hexKey,
          cardDefId: champion.cardDefId,
          hp: champion.hp,
          maxHp: champion.hp,
          attackDice: champion.attackDice,
          hitFaces: champion.hitFaces,
          bounty: champion.bounty,
          abilityUses: {}
        }
      },
      hexes: {
        ...board.hexes,
        [hexKey]: {
          ...hex,
          occupants: {
            ...hex.occupants,
            [playerId]: [...(hex.occupants[playerId] ?? []), unitId]
          }
        }
      }
    },
    unitId
  };
};

export const moveUnitToHex = (
  board: BoardState,
  unitId: UnitID,
  to: HexKey
): BoardState => {
  const unit = board.units[unitId];
  if (!unit) {
    return board;
  }
  if (unit.hex === to) {
    return board;
  }
  const fromHex = board.hexes[unit.hex];
  const toHex = board.hexes[to];
  if (!fromHex || !toHex) {
    return board;
  }

  const fromUnits = fromHex.occupants[unit.ownerPlayerId] ?? [];
  const nextFromUnits = fromUnits.filter((entry) => entry !== unitId);
  const toUnits = toHex.occupants[unit.ownerPlayerId] ?? [];
  const nextToUnits = toUnits.includes(unitId) ? toUnits : [...toUnits, unitId];

  return {
    ...board,
    units: {
      ...board.units,
      [unitId]: {
        ...unit,
        hex: to
      }
    },
    hexes: {
      ...board.hexes,
      [unit.hex]: {
        ...fromHex,
        occupants: {
          ...fromHex.occupants,
          [unit.ownerPlayerId]: nextFromUnits
        }
      },
      [to]: {
        ...toHex,
        occupants: {
          ...toHex.occupants,
          [unit.ownerPlayerId]: nextToUnits
        }
      }
    }
  };
};

export const moveStack = (
  board: BoardState,
  playerId: PlayerID,
  from: HexKey,
  to: HexKey,
  forceCount?: number
): BoardState => {
  if (from === to) {
    return board;
  }

  const fromHex = board.hexes[from];
  const toHex = board.hexes[to];
  if (!fromHex || !toHex) {
    return board;
  }

  const movingUnits = selectMovingUnits(board, playerId, from, forceCount);
  if (movingUnits.length === 0) {
    return board;
  }

  const movingSet = new Set(movingUnits);
  const fromUnits = fromHex.occupants[playerId] ?? [];
  const remainingUnits = fromUnits.filter((unitId) => !movingSet.has(unitId));
  const toUnits = [...(toHex.occupants[playerId] ?? []), ...movingUnits];

  const units = { ...board.units };
  for (const unitId of movingUnits) {
    const unit = units[unitId];
    if (!unit) {
      continue;
    }
    units[unitId] = {
      ...unit,
      hex: to
    };
  }

  return {
    ...board,
    units,
    hexes: {
      ...board.hexes,
      [from]: {
        ...fromHex,
        occupants: {
          ...fromHex.occupants,
          [playerId]: remainingUnits
        }
      },
      [to]: {
        ...toHex,
        occupants: {
          ...toHex.occupants,
          [playerId]: toUnits
        }
      }
    }
  };
};

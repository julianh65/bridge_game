import type { BoardState, HexKey, PlayerID, UnitID } from "./types";

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

  let nextIndex = Object.keys(board.units).length + 1;
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

export const moveStack = (
  board: BoardState,
  playerId: PlayerID,
  from: HexKey,
  to: HexKey
): BoardState => {
  if (from === to) {
    return board;
  }

  const fromHex = board.hexes[from];
  const toHex = board.hexes[to];
  if (!fromHex || !toHex) {
    return board;
  }

  const movingUnits = fromHex.occupants[playerId] ?? [];
  if (movingUnits.length === 0) {
    return board;
  }

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
          [playerId]: []
        }
      },
      [to]: {
        ...toHex,
        occupants: {
          ...toHex.occupants,
          [playerId]: [...(toHex.occupants[playerId] ?? []), ...movingUnits]
        }
      }
    }
  };
};

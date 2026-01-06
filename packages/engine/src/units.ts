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

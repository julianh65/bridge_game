import { canonicalEdgeKey } from "@bridgefront/shared";

import type { BoardState, HexKey, HexState, PlayerID } from "./types";

export const getHex = (board: BoardState, key: HexKey): HexState | undefined => {
  return board.hexes[key];
};

export const getPlayerIdsOnHex = (hex: HexState): PlayerID[] => {
  return Object.entries(hex.occupants)
    .filter(([, unitIds]) => unitIds.length > 0)
    .map(([playerId]) => playerId);
};

export const getCenterHexKey = (board: BoardState): HexKey | null => {
  for (const hex of Object.values(board.hexes)) {
    if (hex.tile === "center") {
      return hex.key;
    }
  }
  return null;
};

export const countPlayersOnHex = (hex: HexState): number => {
  return getPlayerIdsOnHex(hex).length;
};

export const isOccupiedByPlayer = (hex: HexState, playerId: PlayerID): boolean => {
  return (hex.occupants[playerId]?.length ?? 0) > 0;
};

export const hasEnemyUnits = (hex: HexState, playerId: PlayerID): boolean => {
  return getPlayerIdsOnHex(hex).some((occupantId) => occupantId !== playerId);
};

export const isContestedHex = (hex: HexState): boolean => {
  return countPlayersOnHex(hex) === 2;
};

export const wouldExceedTwoPlayers = (hex: HexState, enteringPlayerId: PlayerID): boolean => {
  const occupants = new Set(getPlayerIdsOnHex(hex));
  occupants.add(enteringPlayerId);
  return occupants.size > 2;
};

export const hasBridge = (board: BoardState, from: HexKey, to: HexKey): boolean => {
  const edgeKey = canonicalEdgeKey(from, to);
  return Boolean(board.bridges[edgeKey]);
};

export const getBridgeKey = (from: HexKey, to: HexKey): string => {
  return canonicalEdgeKey(from, to);
};

import { generateHexKeys, toHexKey } from "@bridgefront/shared";

import type { BoardState, HexKey, HexState, TileType } from "./types";

const createHexState = (key: HexKey, tile: TileType): HexState => ({
  key,
  tile,
  occupants: {}
});

export const createBaseBoard = (radius: number): BoardState => {
  const hexes: Record<HexKey, HexState> = {};
  for (const key of generateHexKeys(radius)) {
    const tile: TileType = key === "0,0" ? "center" : "normal";
    hexes[key] = createHexState(key, tile);
  }

  return {
    radius,
    hexes,
    bridges: {},
    units: {}
  };
};

export const getCapitalSlots = (playerCount: number, radius: number): HexKey[] => {
  if (!Number.isInteger(playerCount)) {
    throw new Error("playerCount must be an integer");
  }
  if (playerCount < 2 || playerCount > 6) {
    throw new Error("playerCount must be between 2 and 6");
  }
  if (!Number.isInteger(radius) || radius <= 0) {
    throw new Error("radius must be a positive integer");
  }

  if (playerCount === 5) {
    if (radius !== 5) {
      throw new Error("5-player capital slots require radius 5");
    }
    return [
      toHexKey(-5, 0),
      toHexKey(-4, 5),
      toHexKey(2, 2),
      toHexKey(5, -3),
      toHexKey(1, -5)
    ];
  }

  const corners = [
    toHexKey(radius, 0),
    toHexKey(0, radius),
    toHexKey(-radius, radius),
    toHexKey(-radius, 0),
    toHexKey(0, -radius),
    toHexKey(radius, -radius)
  ];

  switch (playerCount) {
    case 2:
      return [corners[0], corners[3]];
    case 3:
      return [corners[0], corners[2], corners[4]];
    case 4:
      return [corners[0], corners[1], corners[3], corners[4]];
    case 6:
      return corners;
    default:
      throw new Error("unsupported player count");
  }
};

import {
  DEFAULT_CONFIG,
  createBaseBoard,
  getCapitalSlots,
  placeSpecialTiles,
  type BoardState
} from "@bridgefront/engine";
import { createRngState, parseHexKey } from "@bridgefront/shared";

import { axialToPixel } from "./hex-geometry";

export type HexRender = {
  key: string;
  x: number;
  y: number;
  tile: string;
  mineValue?: number;
};

export type BoardPreview = {
  seedValue: number;
  radius: number;
  board: ReturnType<typeof createBaseBoard>;
  hexRender: HexRender[];
  capitals: string[];
  forgeKeys: string[];
  homeMineKeys: string[];
  mineKeys: string[];
};

export const buildHexRender = (board: BoardState): HexRender[] => {
  return Object.values(board.hexes).map((hex) => {
    const { q, r } = parseHexKey(hex.key);
    const { x, y } = axialToPixel(q, r);
    return {
      key: hex.key,
      x,
      y,
      tile: hex.tile,
      mineValue: hex.mineValue
    };
  });
};

const normalizeSeed = (seedInput: string) => {
  const parsed = Number.parseInt(seedInput, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildBoardPreview = (playerCount: number, seedInput: string): BoardPreview => {
  const seedValue = normalizeSeed(seedInput);
  const radius = DEFAULT_CONFIG.boardRadiusByPlayerCount[playerCount] ?? 0;
  const board = createBaseBoard(radius);
  const capitals = getCapitalSlots(
    playerCount,
    radius,
    DEFAULT_CONFIG.capitalSlotsByPlayerCount
  );
  const hexes = { ...board.hexes };
  for (const key of capitals) {
    hexes[key] = { ...hexes[key], tile: "capital" };
  }

  const boardWithCapitals = { ...board, hexes };
  const { board: placedBoard, forgeKeys, homeMineKeys, mineKeys } = placeSpecialTiles(
    boardWithCapitals,
    createRngState(seedValue),
    {
      capitalHexes: capitals,
      forgeCount: DEFAULT_CONFIG.tileCountsByPlayerCount[playerCount].forges,
      mineCount: DEFAULT_CONFIG.tileCountsByPlayerCount[playerCount].mines,
      rules: DEFAULT_CONFIG.boardGenerationRules
    }
  );

  const hexRender = buildHexRender(placedBoard);

  return {
    seedValue,
    radius,
    board: placedBoard,
    hexRender,
    capitals,
    forgeKeys,
    homeMineKeys,
    mineKeys
  };
};

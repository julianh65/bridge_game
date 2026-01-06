import {
  axialDistance,
  compareHexKeys,
  generateHexKeys,
  parseHexKey,
  randInt,
  shuffle,
  toHexKey,
  type RNGState
} from "@bridgefront/shared";

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

type SpecialTilePlacementResult = {
  board: BoardState;
  rngState: RNGState;
  forgeKeys: HexKey[];
  homeMineKeys: HexKey[];
  mineKeys: HexKey[];
};

type SpecialTilePlacementOptions = {
  capitalHexes: HexKey[];
  forgeCount: number;
  mineCount: number;
  maxAttempts?: number;
  topK?: number;
};

const CENTER_KEY = "0,0";
const DEFAULT_MAX_ATTEMPTS = 50;
const DEFAULT_TOP_K = 5;

const cloneBoard = (board: BoardState): BoardState => {
  const hexes: Record<HexKey, HexState> = {};
  for (const [key, hex] of Object.entries(board.hexes)) {
    hexes[key] = {
      ...hex,
      occupants: { ...hex.occupants }
    };
  }

  return {
    ...board,
    hexes,
    bridges: { ...board.bridges },
    units: { ...board.units }
  };
};

const distanceBetweenKeys = (a: HexKey, b: HexKey): number => {
  return axialDistance(parseHexKey(a), parseHexKey(b));
};

const minDistanceToSet = (key: HexKey, others: HexKey[]): number => {
  if (others.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  let min = Number.POSITIVE_INFINITY;
  for (const other of others) {
    const dist = distanceBetweenKeys(key, other);
    if (dist < min) {
      min = dist;
    }
  }
  return min;
};

const isEligibleForSpecialTile = (key: HexKey, board: BoardState, capitalSet: Set<HexKey>): boolean => {
  const hex = board.hexes[key];
  if (!hex) {
    return false;
  }
  if (hex.tile !== "normal") {
    return false;
  }
  if (key === CENTER_KEY || capitalSet.has(key)) {
    return false;
  }

  for (const capital of capitalSet) {
    if (distanceBetweenKeys(key, capital) < 2) {
      return false;
    }
  }

  return true;
};

const scoreCandidate = (candidate: HexKey, sameTypeKeys: HexKey[], capitalHexes: HexKey[]): number => {
  const minSameType = minDistanceToSet(candidate, sameTypeKeys);
  const minToCapital = minDistanceToSet(candidate, capitalHexes);
  const sameTypeScore = Number.isFinite(minSameType) ? minSameType * 10 : 1000;
  const capitalScore = Number.isFinite(minToCapital) ? minToCapital : 0;
  return sameTypeScore + capitalScore;
};

const chooseCandidate = (
  rngState: RNGState,
  candidates: HexKey[],
  sameTypeKeys: HexKey[],
  capitalHexes: HexKey[],
  topK: number
): { key: HexKey; rngState: RNGState } => {
  const ranked = candidates
    .map((key) => ({
      key,
      score: scoreCandidate(key, sameTypeKeys, capitalHexes)
    }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return compareHexKeys(a.key, b.key);
    });

  const limit = Math.min(topK, ranked.length);
  const { value: index, next } = randInt(rngState, 0, limit - 1);
  return { key: ranked[index].key, rngState: next };
};

const rollMineValue = (rngState: RNGState): { value: number; rngState: RNGState } => {
  const { value: roll, next } = randInt(rngState, 1, 100);
  if (roll <= 50) {
    return { value: 4, rngState: next };
  }
  if (roll <= 80) {
    return { value: 5, rngState: next };
  }
  return { value: 6, rngState: next };
};

export const placeSpecialTiles = (
  board: BoardState,
  rngState: RNGState,
  options: SpecialTilePlacementOptions
): SpecialTilePlacementResult => {
  const {
    capitalHexes,
    forgeCount,
    mineCount,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    topK = DEFAULT_TOP_K
  } = options;

  if (!Number.isInteger(forgeCount) || forgeCount < 0) {
    throw new Error("forgeCount must be a non-negative integer");
  }
  if (!Number.isInteger(mineCount) || mineCount < 0) {
    throw new Error("mineCount must be a non-negative integer");
  }
  if (mineCount < capitalHexes.length) {
    throw new Error("mineCount must be >= number of capitals");
  }

  const capitalSet = new Set(capitalHexes);
  for (const capital of capitalHexes) {
    if (!board.hexes[capital]) {
      throw new Error(`capital hex ${capital} not on board`);
    }
  }

  let state = rngState;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const working = cloneBoard(board);
    const forgeKeys: HexKey[] = [];
    const homeMineKeys: HexKey[] = [];
    const mineKeys: HexKey[] = [];

    const eligibleKeys = Object.keys(working.hexes)
      .filter((key) => isEligibleForSpecialTile(key, working, capitalSet))
      .sort(compareHexKeys);

    const forgeCandidates = eligibleKeys.filter((key) => {
      const dist = distanceBetweenKeys(key, CENTER_KEY);
      return dist === 2 || dist === 3;
    });

    let placementFailed = false;
    let rng = state;

    for (let i = 0; i < forgeCount; i += 1) {
      const remaining = forgeCandidates.filter(
        (key) => isEligibleForSpecialTile(key, working, capitalSet)
      );
      if (remaining.length === 0) {
        placementFailed = true;
        break;
      }
      const choice = chooseCandidate(rng, remaining, forgeKeys, capitalHexes, topK);
      rng = choice.rngState;
      forgeKeys.push(choice.key);
      working.hexes[choice.key] = {
        ...working.hexes[choice.key],
        tile: "forge"
      };
    }

    if (placementFailed) {
      state = rng;
      continue;
    }

    const { value: capitalOrder, next: shuffledState } = shuffle(rng, capitalHexes);
    rng = shuffledState;

    for (const capital of capitalOrder) {
      const candidates = eligibleKeys.filter((key) => {
        if (!isEligibleForSpecialTile(key, working, capitalSet)) {
          return false;
        }
        if (distanceBetweenKeys(key, capital) !== 2) {
          return false;
        }
        for (const other of capitalHexes) {
          if (other !== capital && distanceBetweenKeys(key, other) < 2) {
            return false;
          }
        }
        return true;
      });

      if (candidates.length === 0) {
        placementFailed = true;
        break;
      }

      const choice = chooseCandidate(rng, candidates, homeMineKeys, capitalHexes, topK);
      rng = choice.rngState;
      homeMineKeys.push(choice.key);
      working.hexes[choice.key] = {
        ...working.hexes[choice.key],
        tile: "mine"
      };
    }

    if (placementFailed) {
      state = rng;
      continue;
    }

    const remainingMineCount = mineCount - homeMineKeys.length;
    for (let i = 0; i < remainingMineCount; i += 1) {
      const candidates = eligibleKeys.filter((key) => {
        if (!isEligibleForSpecialTile(key, working, capitalSet)) {
          return false;
        }
        return distanceBetweenKeys(key, CENTER_KEY) === 2;
      });

      if (candidates.length === 0) {
        placementFailed = true;
        break;
      }

      const choice = chooseCandidate(
        rng,
        candidates,
        [...homeMineKeys, ...mineKeys],
        capitalHexes,
        topK
      );
      rng = choice.rngState;
      mineKeys.push(choice.key);
      working.hexes[choice.key] = {
        ...working.hexes[choice.key],
        tile: "mine"
      };
    }

    if (placementFailed) {
      state = rng;
      continue;
    }

    const allMines = [...homeMineKeys, ...mineKeys];
    for (const mine of allMines) {
      const roll = rollMineValue(rng);
      rng = roll.rngState;
      working.hexes[mine] = {
        ...working.hexes[mine],
        mineValue: roll.value
      };
    }

    return {
      board: working,
      rngState: rng,
      forgeKeys,
      homeMineKeys,
      mineKeys: allMines
    };
  }

  throw new Error("Failed to place special tiles within maxAttempts");
};

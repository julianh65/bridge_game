import {
  axialDistance,
  canonicalEdgeKey,
  compareHexKeys,
  generateHexKeys,
  neighborHexKeys,
  parseHexKey,
  randInt,
  shuffle,
  toHexKey,
  type RNGState
} from "@bridgefront/shared";

import type {
  BoardGenerationRules,
  BoardState,
  EdgeKey,
  HexKey,
  HexState,
  TileType
} from "./types";

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

export const getCapitalSlots = (
  playerCount: number,
  radius: number,
  capitalSlotsByPlayerCount?: Record<number, HexKey[]>
): HexKey[] => {
  if (!Number.isInteger(playerCount)) {
    throw new Error("playerCount must be an integer");
  }
  if (playerCount < 2 || playerCount > 6) {
    throw new Error("playerCount must be between 2 and 6");
  }
  if (!Number.isInteger(radius) || radius <= 0) {
    throw new Error("radius must be a positive integer");
  }

  const override = capitalSlotsByPlayerCount?.[playerCount];
  if (override && override.length > 0) {
    if (override.length !== playerCount) {
      throw new Error("capital slot override length must match player count");
    }
    const unique = new Set(override);
    if (unique.size !== override.length) {
      throw new Error("capital slot override contains duplicates");
    }
    for (const key of override) {
      const dist = axialDistance(parseHexKey(key), { q: 0, r: 0 });
      if (dist > radius) {
        throw new Error(`capital slot ${key} is outside board radius`);
      }
    }
    return [...override];
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
    case 5:
      return corners.slice(0, 5);
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
  rules: BoardGenerationRules;
};

type RandomBridgePlacementOptions = {
  capitalHexes: HexKey[];
  count: number;
  rules: BoardGenerationRules;
};

type RandomBridgePlacementResult = {
  board: BoardState;
  rngState: RNGState;
  edgeKeys: EdgeKey[];
};

type EdgeCandidate = {
  key: EdgeKey;
  from: HexKey;
  to: HexKey;
};

const CENTER_KEY = "0,0";
const CAPITAL_BALANCE_WEIGHT = 4;
const GLOBAL_SPREAD_WEIGHT = 3;
const BRIDGE_SPECIAL_WEIGHT = 4;
const BRIDGE_SPREAD_WEIGHT = 3;
const EDGE_DISTANCE_WEIGHT = 2;

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

const minDistanceToSetForEdge = (edge: EdgeCandidate, others: HexKey[]): number => {
  return Math.min(minDistanceToSet(edge.from, others), minDistanceToSet(edge.to, others));
};

const listSpecialHexKeys = (board: BoardState): HexKey[] => {
  return Object.values(board.hexes)
    .filter((hex) => hex.tile !== "normal")
    .map((hex) => hex.key);
};

const listBridgeAnchorKeys = (bridges: BoardState["bridges"]): HexKey[] => {
  const anchors = new Set<HexKey>();
  for (const bridge of Object.values(bridges)) {
    anchors.add(bridge.from);
    anchors.add(bridge.to);
  }
  return [...anchors];
};

const scoreBridgeCandidate = (
  edge: EdgeCandidate,
  specialKeys: HexKey[],
  bridgeAnchors: HexKey[]
): number => {
  const specialDistance = minDistanceToSetForEdge(edge, specialKeys);
  const bridgeDistance = minDistanceToSetForEdge(edge, bridgeAnchors);
  const specialScore = Number.isFinite(specialDistance)
    ? specialDistance * BRIDGE_SPECIAL_WEIGHT
    : 0;
  const bridgeScore = Number.isFinite(bridgeDistance)
    ? bridgeDistance * BRIDGE_SPREAD_WEIGHT
    : 0;
  return specialScore + bridgeScore;
};

const closestCapitalIndex = (key: HexKey, capitalHexes: HexKey[]): number => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < capitalHexes.length; i += 1) {
    const dist = distanceBetweenKeys(key, capitalHexes[i]);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
      continue;
    }
    if (dist === bestDistance) {
      if (compareHexKeys(capitalHexes[i], capitalHexes[bestIndex]) < 0) {
        bestIndex = i;
      }
    }
  }
  return bestIndex;
};

const countByClosestCapital = (keys: HexKey[], capitalHexes: HexKey[]): number[] => {
  const counts = Array.from({ length: capitalHexes.length }, () => 0);
  for (const key of keys) {
    const index = closestCapitalIndex(key, capitalHexes);
    counts[index] += 1;
  }
  return counts;
};

const respectsMinDistance = (key: HexKey, others: HexKey[], minDistance: number): boolean => {
  if (minDistance <= 0) {
    return true;
  }
  for (const other of others) {
    if (distanceBetweenKeys(key, other) < minDistance) {
      return false;
    }
  }
  return true;
};

const isEligibleForSpecialTile = (
  key: HexKey,
  board: BoardState,
  capitalSet: Set<HexKey>,
  rules: BoardGenerationRules
): boolean => {
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
    if (distanceBetweenKeys(key, capital) < rules.minDistanceFromCapital) {
      return false;
    }
  }

  return true;
};

const scoreCandidate = (
  candidate: HexKey,
  sameTypeKeys: HexKey[],
  capitalHexes: HexKey[],
  boardRadius: number,
  capitalCounts?: number[],
  allSpecialKeys: HexKey[] = []
): number => {
  const minSameType = minDistanceToSet(candidate, sameTypeKeys);
  const minAnySpecial = minDistanceToSet(candidate, allSpecialKeys);
  const minToCapital = minDistanceToSet(candidate, capitalHexes);
  const edgeDistance = Math.max(0, boardRadius - distanceBetweenKeys(candidate, CENTER_KEY));
  const sameTypeScore = Number.isFinite(minSameType) ? minSameType * 10 : 1000;
  const spreadScore = Number.isFinite(minAnySpecial) ? minAnySpecial * GLOBAL_SPREAD_WEIGHT : 0;
  const capitalScore = Number.isFinite(minToCapital) ? minToCapital : 0;
  const edgeScore = edgeDistance * EDGE_DISTANCE_WEIGHT;
  const balancePenalty =
    capitalCounts && capitalCounts.length > 0
      ? capitalCounts[closestCapitalIndex(candidate, capitalHexes)] * CAPITAL_BALANCE_WEIGHT
      : 0;
  return sameTypeScore + spreadScore + capitalScore + edgeScore - balancePenalty;
};

const chooseCandidate = (
  rngState: RNGState,
  candidates: HexKey[],
  sameTypeKeys: HexKey[],
  capitalHexes: HexKey[],
  boardRadius: number,
  topK: number,
  allSpecialKeys?: HexKey[]
): { key: HexKey; rngState: RNGState } => {
  const capitalCounts = countByClosestCapital(sameTypeKeys, capitalHexes);
  const ranked = candidates
    .map((key) => ({
      key,
      score: scoreCandidate(
        key,
        sameTypeKeys,
        capitalHexes,
        boardRadius,
        capitalCounts,
        allSpecialKeys ?? sameTypeKeys
      )
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

const validateRules = (rules: BoardGenerationRules) => {
  const ensureNonNegativeInt = (value: number, label: string) => {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer`);
    }
  };

  const ensurePositiveInt = (value: number, label: string) => {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive integer`);
    }
  };

  ensureNonNegativeInt(rules.minDistanceFromCapital, "minDistanceFromCapital");
  ensureNonNegativeInt(rules.homeMineDistanceFromCapital, "homeMineDistanceFromCapital");
  ensureNonNegativeInt(
    rules.homeMineMinDistanceFromOtherCapitals,
    "homeMineMinDistanceFromOtherCapitals"
  );
  ensureNonNegativeInt(rules.minForgeSpacing, "minForgeSpacing");
  ensureNonNegativeInt(rules.minMineSpacing, "minMineSpacing");
  ensurePositiveInt(rules.maxAttempts, "maxAttempts");
  ensurePositiveInt(rules.topK, "topK");

  if (rules.forgeDistanceFromCenter.length === 0) {
    throw new Error("forgeDistanceFromCenter must not be empty");
  }
  if (rules.mineDistanceFromCenter.length === 0) {
    throw new Error("mineDistanceFromCenter must not be empty");
  }

  for (const distance of rules.forgeDistanceFromCenter) {
    ensureNonNegativeInt(distance, "forgeDistanceFromCenter entry");
  }
  for (const distance of rules.mineDistanceFromCenter) {
    ensureNonNegativeInt(distance, "mineDistanceFromCenter entry");
  }

  if (rules.mineValueWeights.length === 0) {
    throw new Error("mineValueWeights must not be empty");
  }
  for (const weight of rules.mineValueWeights) {
    ensureNonNegativeInt(weight.value, "mineValueWeights value");
    ensurePositiveInt(weight.weight, "mineValueWeights weight");
  }
};

const rollMineValue = (
  rngState: RNGState,
  weights: BoardGenerationRules["mineValueWeights"]
): { value: number; rngState: RNGState } => {
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("mineValueWeights must include a positive total weight");
  }

  const { value: roll, next } = randInt(rngState, 1, totalWeight);
  let running = 0;
  for (const entry of weights) {
    running += entry.weight;
    if (roll <= running) {
      return { value: entry.value, rngState: next };
    }
  }

  return { value: weights[weights.length - 1].value, rngState: next };
};

export const placeSpecialTiles = (
  board: BoardState,
  rngState: RNGState,
  options: SpecialTilePlacementOptions
): SpecialTilePlacementResult => {
  const { capitalHexes, forgeCount, mineCount, rules } = options;
  validateRules(rules);
  const { maxAttempts, topK } = rules;

  if (!Number.isInteger(forgeCount) || forgeCount < 0) {
    throw new Error("forgeCount must be a non-negative integer");
  }
  if (!Number.isInteger(mineCount) || mineCount < 0) {
    throw new Error("mineCount must be a non-negative integer");
  }
  const homeMineTargetCount = Math.min(mineCount, capitalHexes.length);

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
      .filter((key) => isEligibleForSpecialTile(key, working, capitalSet, rules))
      .sort(compareHexKeys);

    let placementFailed = false;
    let rng = state;

    for (let i = 0; i < forgeCount; i += 1) {
      let remaining = eligibleKeys.filter((key) => {
        if (!isEligibleForSpecialTile(key, working, capitalSet, rules)) {
          return false;
        }
        const dist = distanceBetweenKeys(key, CENTER_KEY);
        if (!rules.forgeDistanceFromCenter.includes(dist)) {
          return false;
        }
        return respectsMinDistance(key, forgeKeys, rules.minForgeSpacing);
      });
      if (remaining.length === 0) {
        // Fall back to any eligible distance if preferred center distances are impossible.
        remaining = eligibleKeys.filter((key) => {
          if (!isEligibleForSpecialTile(key, working, capitalSet, rules)) {
            return false;
          }
          return respectsMinDistance(key, forgeKeys, rules.minForgeSpacing);
        });
      }
      if (remaining.length === 0) {
        placementFailed = true;
        break;
      }
      const choice = chooseCandidate(
        rng,
        remaining,
        forgeKeys,
        capitalHexes,
        board.radius,
        topK,
        forgeKeys
      );
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

    const homeMineTargets = capitalOrder.slice(0, homeMineTargetCount);
    for (const capital of homeMineTargets) {
      const candidates = eligibleKeys.filter((key) => {
        if (!isEligibleForSpecialTile(key, working, capitalSet, rules)) {
          return false;
        }
        if (distanceBetweenKeys(key, capital) !== rules.homeMineDistanceFromCapital) {
          return false;
        }
        for (const other of capitalHexes) {
          if (
            other !== capital &&
            distanceBetweenKeys(key, other) < rules.homeMineMinDistanceFromOtherCapitals
          ) {
            return false;
          }
        }
        return respectsMinDistance(key, homeMineKeys, rules.minMineSpacing);
      });

      if (candidates.length === 0) {
        placementFailed = true;
        break;
      }

      const choice = chooseCandidate(
        rng,
        candidates,
        homeMineKeys,
        capitalHexes,
        board.radius,
        topK,
        [...forgeKeys, ...homeMineKeys]
      );
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
        if (!isEligibleForSpecialTile(key, working, capitalSet, rules)) {
          return false;
        }
        const dist = distanceBetweenKeys(key, CENTER_KEY);
        if (!rules.mineDistanceFromCenter.includes(dist)) {
          return false;
        }
        return respectsMinDistance(key, [...homeMineKeys, ...mineKeys], rules.minMineSpacing);
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
        board.radius,
        topK,
        [...forgeKeys, ...homeMineKeys, ...mineKeys]
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
      const roll = rollMineValue(rng, rules.mineValueWeights);
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

export const placeRandomBridges = (
  board: BoardState,
  rngState: RNGState,
  options: RandomBridgePlacementOptions
): RandomBridgePlacementResult => {
  const { capitalHexes, count, rules } = options;
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("random bridge count must be a non-negative integer");
  }

  const capitalSet = new Set(capitalHexes);
  for (const capital of capitalHexes) {
    if (!board.hexes[capital]) {
      throw new Error(`capital hex ${capital} not on board`);
    }
  }

  if (count === 0) {
    return { board, rngState, edgeKeys: [] };
  }

  const seenEdges = new Set<EdgeKey>();
  const candidates: EdgeCandidate[] = [];
  for (const key of Object.keys(board.hexes)) {
    const from = key as HexKey;
    for (const neighbor of neighborHexKeys(from)) {
      if (!board.hexes[neighbor]) {
        continue;
      }
      if (from === CENTER_KEY || neighbor === CENTER_KEY) {
        continue;
      }
      if (capitalSet.has(from) || capitalSet.has(neighbor)) {
        continue;
      }
      const edgeKey = canonicalEdgeKey(from, neighbor);
      if (seenEdges.has(edgeKey) || board.bridges[edgeKey]) {
        continue;
      }
      seenEdges.add(edgeKey);
      candidates.push({ key: edgeKey, from, to: neighbor });
    }
  }

  const emptyCandidates = candidates.filter((edge) => {
    const fromHex = board.hexes[edge.from];
    const toHex = board.hexes[edge.to];
    return fromHex?.tile === "normal" && toHex?.tile === "normal";
  });
  const candidatePool = emptyCandidates.length >= count ? emptyCandidates : candidates;

  if (count > candidatePool.length) {
    throw new Error("random bridge count exceeds available edges");
  }

  const specialKeys = listSpecialHexKeys(board);
  const baseAnchors = listBridgeAnchorKeys(board.bridges);
  const anchorKeys = new Set(baseAnchors);
  let next = rngState;
  let remaining = [...candidatePool];
  const selected: EdgeCandidate[] = [];
  const topK = Math.max(1, rules.topK);

  for (let i = 0; i < count; i += 1) {
    const anchorList = Array.from(anchorKeys);
    const ranked = remaining
      .map((edge) => ({
        edge,
        score: scoreBridgeCandidate(edge, specialKeys, anchorList)
      }))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return a.edge.key.localeCompare(b.edge.key);
      });
    const limit = Math.min(topK, ranked.length);
    const { value: index, next: nextRng } = randInt(next, 0, limit - 1);
    const chosen = ranked[index].edge;
    next = nextRng;
    selected.push(chosen);
    anchorKeys.add(chosen.from);
    anchorKeys.add(chosen.to);
    remaining = remaining.filter((edge) => edge.key !== chosen.key);
  }

  const bridges = { ...board.bridges };
  for (const edge of selected) {
    bridges[edge.key] = {
      key: edge.key,
      from: edge.from,
      to: edge.to
    };
  }

  return {
    board: { ...board, bridges },
    rngState: next,
    edgeKeys: selected.map((edge) => edge.key)
  };
};

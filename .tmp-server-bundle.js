// packages/engine/src/config.ts
var DEFAULT_CONFIG = {
  MAX_MANA: 6,
  START_GOLD: 4,
  BASE_INCOME: 1,
  HAND_LIMIT: 10,
  CHAMPION_LIMIT: 4,
  ROUNDS_MAX: 10,
  VP_TO_WIN: 10,
  ACTION_REVEAL_DURATION_MS: 2400,
  ACTION_REVEAL_HIGHLIGHT_PAUSE_MS: 1200,
  MARKET_ROLLOFF_DURATION_MS: 1500,
  COMBAT_ROLL_LOCK_MS: 650,
  COMBAT_ROLL_ASSIGN_MS: 1300,
  COMBAT_ROLL_DONE_MS: 1900,
  COMBAT_AUTO_CLOSE_MS: 2200,
  basicActionFactionOrder: ["bastion", "veil", "aerial", "prospect", "cipher", "gatewright"],
  boardRadiusByPlayerCount: {
    2: 3,
    3: 4,
    4: 4,
    5: 4,
    6: 4
  },
  tileCountsByPlayerCount: {
    2: { mines: 3, forges: 1, center: 1, randomBridges: 7 },
    3: { mines: 4, forges: 2, center: 1, randomBridges: 7 },
    4: { mines: 5, forges: 2, center: 1, randomBridges: 10 },
    5: { mines: 6, forges: 2, center: 1, randomBridges: 10 },
    6: { mines: 7, forges: 3, center: 1, randomBridges: 10 }
  },
  capitalSlotsByPlayerCount: {
    2: ["3,0", "-3,0"],
    3: ["4,0", "-4,4", "0,-4"],
    4: ["4,-1", "-1,4", "-4,1", "1,-4"],
    5: ["-2,4", "-4,1", "1,-4", "2,2", "4,-2"],
    6: ["4,0", "0,4", "-4,4", "-4,0", "0,-4", "4,-4"]
  },
  boardGenerationRules: {
    minDistanceFromCapital: 2,
    forgeDistanceFromCenter: [2, 3],
    mineDistanceFromCenter: [2],
    homeMineDistanceFromCapital: 2,
    homeMineMinDistanceFromOtherCapitals: 2,
    minForgeSpacing: 0,
    minMineSpacing: 0,
    maxAttempts: 50,
    topK: 5,
    mineValueWeights: [
      { value: 3, weight: 25 },
      { value: 4, weight: 35 },
      { value: 5, weight: 25 },
      { value: 6, weight: 10 },
      { value: 7, weight: 5 }
    ]
  },
  ageByRound: {
    1: "I",
    2: "I",
    3: "I",
    4: "II",
    5: "II",
    6: "II",
    7: "II",
    8: "III",
    9: "III",
    10: "III"
  },
  marketPreviewByRound: {
    1: 0,
    2: 1,
    3: 1,
    4: 0,
    5: 1,
    6: 2,
    7: 2,
    8: 0,
    9: 0,
    10: 0
  },
  freeStartingCardPool: [
    "age1.quick_march",
    "age1.prospecting",
    "age1.trade_caravan",
    "age1.temporary_bridge",
    "age1.patch_up",
    "age1.quick_study"
  ]
};

// packages/shared/src/hex.ts
var DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];
var assertInteger = (value, label) => {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
};
var toHexKey = (q, r) => {
  assertInteger(q, "q");
  assertInteger(r, "r");
  return `${q},${r}`;
};
var parseHexKey = (key) => {
  const parts = key.split(",");
  if (parts.length !== 2) {
    throw new Error("HexKey must be in the form q,r");
  }
  const q = Number(parts[0]);
  const r = Number(parts[1]);
  if (!Number.isInteger(q) || !Number.isInteger(r)) {
    throw new Error("HexKey coordinates must be integers");
  }
  return { q, r };
};
var addAxial = (a, b) => ({
  q: a.q + b.q,
  r: a.r + b.r
});
var axialDistance = (a, b) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
var areAdjacent = (a, b) => {
  return axialDistance(a, b) === 1;
};
var axialNeighbors = (coord) => {
  return DIRS.map((dir) => addAxial(coord, dir));
};
var neighborHexKeys = (key) => {
  const coord = parseHexKey(key);
  return axialNeighbors(coord).map((neighbor) => toHexKey(neighbor.q, neighbor.r));
};
var generateAxialCoords = (radius) => {
  assertInteger(radius, "radius");
  if (radius < 0) {
    throw new Error("radius must be >= 0");
  }
  const coords = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      coords.push({ q, r });
    }
  }
  return coords;
};
var generateHexKeys = (radius) => {
  return generateAxialCoords(radius).map((coord) => toHexKey(coord.q, coord.r));
};
var compareHexKeys = (a, b) => {
  const ac = parseHexKey(a);
  const bc = parseHexKey(b);
  if (ac.q !== bc.q) {
    return ac.q - bc.q;
  }
  return ac.r - bc.r;
};
var canonicalEdgeKey = (a, b) => {
  if (a === b) {
    throw new Error("Edge endpoints must be distinct");
  }
  const [first, second] = compareHexKeys(a, b) <= 0 ? [a, b] : [b, a];
  return `${first}|${second}`;
};
var parseEdgeKey = (edge) => {
  const parts = edge.split("|");
  if (parts.length !== 2) {
    throw new Error("EdgeKey must be in the form hexA|hexB");
  }
  return [parts[0], parts[1]];
};

// packages/shared/src/rng.ts
var UINT32_RANGE = 4294967296;
function createRngState(seed) {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error("seed must be a finite integer");
  }
  return { state: seed >>> 0 };
}
function nextUint32(rng) {
  const nextState = rng.state + 1831565813 >>> 0;
  let t = nextState;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  const value = (t ^ t >>> 14) >>> 0;
  return { value, next: { state: nextState } };
}
function randInt(rng, min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error("randInt bounds must be integers");
  }
  if (max < min) {
    throw new Error("randInt max must be >= min");
  }
  const range = max - min + 1;
  if (range <= 0 || range > UINT32_RANGE) {
    throw new Error("randInt range out of bounds");
  }
  const threshold = UINT32_RANGE - UINT32_RANGE % range;
  let state = rng;
  while (true) {
    const { value, next } = nextUint32(state);
    if (value < threshold) {
      return { value: min + value % range, next };
    }
    state = next;
  }
}
function rollDie(rng, sides = 6) {
  if (!Number.isInteger(sides) || sides <= 0) {
    throw new Error("rollDie sides must be a positive integer");
  }
  return randInt(rng, 1, sides);
}
function shuffle(rng, items) {
  const result = items.slice();
  let state = rng;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const { value: j, next } = randInt(state, 0, i);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
    state = next;
  }
  return { value: result, next: state };
}

// packages/engine/src/board-generation.ts
var createHexState = (key, tile) => ({
  key,
  tile,
  occupants: {}
});
var createBaseBoard = (radius) => {
  const hexes = {};
  for (const key of generateHexKeys(radius)) {
    const tile = key === "0,0" ? "center" : "normal";
    hexes[key] = createHexState(key, tile);
  }
  return {
    radius,
    hexes,
    bridges: {},
    units: {}
  };
};
var getCapitalSlots = (playerCount, radius, capitalSlotsByPlayerCount) => {
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
var CENTER_KEY = "0,0";
var CAPITAL_BALANCE_WEIGHT = 4;
var GLOBAL_SPREAD_WEIGHT = 3;
var BRIDGE_SPECIAL_WEIGHT = 4;
var BRIDGE_SPREAD_WEIGHT = 3;
var cloneBoard = (board) => {
  const hexes = {};
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
var distanceBetweenKeys = (a, b) => {
  return axialDistance(parseHexKey(a), parseHexKey(b));
};
var minDistanceToSet = (key, others) => {
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
var minDistanceToSetForEdge = (edge, others) => {
  return Math.min(minDistanceToSet(edge.from, others), minDistanceToSet(edge.to, others));
};
var listSpecialHexKeys = (board) => {
  return Object.values(board.hexes).filter((hex) => hex.tile !== "normal").map((hex) => hex.key);
};
var listBridgeAnchorKeys = (bridges) => {
  const anchors = /* @__PURE__ */ new Set();
  for (const bridge of Object.values(bridges)) {
    anchors.add(bridge.from);
    anchors.add(bridge.to);
  }
  return [...anchors];
};
var scoreBridgeCandidate = (edge, specialKeys, bridgeAnchors) => {
  const specialDistance = minDistanceToSetForEdge(edge, specialKeys);
  const bridgeDistance = minDistanceToSetForEdge(edge, bridgeAnchors);
  const specialScore = Number.isFinite(specialDistance) ? specialDistance * BRIDGE_SPECIAL_WEIGHT : 0;
  const bridgeScore = Number.isFinite(bridgeDistance) ? bridgeDistance * BRIDGE_SPREAD_WEIGHT : 0;
  return specialScore + bridgeScore;
};
var closestCapitalIndex = (key, capitalHexes) => {
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
var countByClosestCapital = (keys, capitalHexes) => {
  const counts = Array.from({ length: capitalHexes.length }, () => 0);
  for (const key of keys) {
    const index = closestCapitalIndex(key, capitalHexes);
    counts[index] += 1;
  }
  return counts;
};
var respectsMinDistance = (key, others, minDistance) => {
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
var isEligibleForSpecialTile = (key, board, capitalSet, rules) => {
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
var scoreCandidate = (candidate, sameTypeKeys, capitalHexes, capitalCounts, allSpecialKeys = []) => {
  const minSameType = minDistanceToSet(candidate, sameTypeKeys);
  const minAnySpecial = minDistanceToSet(candidate, allSpecialKeys);
  const minToCapital = minDistanceToSet(candidate, capitalHexes);
  const sameTypeScore = Number.isFinite(minSameType) ? minSameType * 10 : 1e3;
  const spreadScore = Number.isFinite(minAnySpecial) ? minAnySpecial * GLOBAL_SPREAD_WEIGHT : 0;
  const capitalScore = Number.isFinite(minToCapital) ? minToCapital : 0;
  const balancePenalty = capitalCounts && capitalCounts.length > 0 ? capitalCounts[closestCapitalIndex(candidate, capitalHexes)] * CAPITAL_BALANCE_WEIGHT : 0;
  return sameTypeScore + spreadScore + capitalScore - balancePenalty;
};
var chooseCandidate = (rngState, candidates, sameTypeKeys, capitalHexes, topK, allSpecialKeys) => {
  const capitalCounts = countByClosestCapital(sameTypeKeys, capitalHexes);
  const ranked = candidates.map((key) => ({
    key,
    score: scoreCandidate(
      key,
      sameTypeKeys,
      capitalHexes,
      capitalCounts,
      allSpecialKeys ?? sameTypeKeys
    )
  })).sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return compareHexKeys(a.key, b.key);
  });
  const limit = Math.min(topK, ranked.length);
  const { value: index, next } = randInt(rngState, 0, limit - 1);
  return { key: ranked[index].key, rngState: next };
};
var validateRules = (rules) => {
  const ensureNonNegativeInt = (value, label) => {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer`);
    }
  };
  const ensurePositiveInt = (value, label) => {
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
var rollMineValue = (rngState, weights) => {
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
var placeSpecialTiles = (board, rngState, options) => {
  const { capitalHexes, forgeCount, mineCount, rules } = options;
  validateRules(rules);
  const { maxAttempts, topK } = rules;
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
    const forgeKeys = [];
    const homeMineKeys = [];
    const mineKeys = [];
    const eligibleKeys = Object.keys(working.hexes).filter((key) => isEligibleForSpecialTile(key, working, capitalSet, rules)).sort(compareHexKeys);
    let placementFailed = false;
    let rng = state;
    for (let i = 0; i < forgeCount; i += 1) {
      const remaining = eligibleKeys.filter((key) => {
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
        placementFailed = true;
        break;
      }
      const choice = chooseCandidate(rng, remaining, forgeKeys, capitalHexes, topK, forgeKeys);
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
        if (!isEligibleForSpecialTile(key, working, capitalSet, rules)) {
          return false;
        }
        if (distanceBetweenKeys(key, capital) !== rules.homeMineDistanceFromCapital) {
          return false;
        }
        for (const other of capitalHexes) {
          if (other !== capital && distanceBetweenKeys(key, other) < rules.homeMineMinDistanceFromOtherCapitals) {
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
var placeRandomBridges = (board, rngState, options) => {
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
  const seenEdges = /* @__PURE__ */ new Set();
  const candidates = [];
  for (const key of Object.keys(board.hexes)) {
    const from = key;
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
  const selected = [];
  const topK = Math.max(1, rules.topK);
  for (let i = 0; i < count; i += 1) {
    const anchorList = Array.from(anchorKeys);
    const ranked = remaining.map((edge) => ({
      edge,
      score: scoreBridgeCandidate(edge, specialKeys, anchorList)
    })).sort((a, b) => {
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

// packages/engine/src/content/cards/age1.ts
var QUICK_MARCH = {
  id: "age1.quick_march",
  name: "Quick March",
  rulesText: "Move 1 stack up to 2 hexes along Bridges.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 2 }]
};
var ROLL_OUT = {
  id: "age1.roll_out",
  name: "Roll Out",
  rulesText: "Move up to 2 different stacks up to 1 hex along Bridges each.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 1,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 1 }]
};
var FLANK_STEP = {
  id: "age1.flank_step",
  name: "Flank Step",
  rulesText: "Move 1 stack 1 hex ignoring Bridges.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "stack",
    owner: "self",
    maxDistance: 1,
    requiresBridge: false
  },
  effects: [{ kind: "moveStack", maxDistance: 1, requiresBridge: false }]
};
var EMERGENCY_EVAC = {
  id: "age1.emergency_evac",
  name: "Emergency Evac",
  rulesText: "Move 1 friendly Champion to your Capital. Heal it 1 HP.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "evacuateChampion" }, { kind: "healChampion", amount: 1 }]
};
var COLUMN_ADVANCE = {
  id: "age1.column_advance",
  name: "Column Advance",
  rulesText: "Move 1 stack up to 3 hexes along Bridges; must stop if it enters any occupied hex.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 3,
    requiresBridge: true,
    stopOnOccupied: true
  },
  effects: [{ kind: "moveStack", maxDistance: 3, stopOnOccupied: true }]
};
var PROSPECTING = {
  id: "age1.prospecting",
  name: "Prospecting",
  rulesText: "Gain +2 gold. If you occupy a Mine, gain +3 gold instead.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 2, bonusIfMine: 1 }]
};
var TRADE_CARAVAN = {
  id: "age1.trade_caravan",
  name: "Trade Caravan",
  rulesText: "Gain +3 gold.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 3 }]
};
var RECRUIT_DETACHMENT = {
  id: "age1.recruit_detachment",
  name: "Recruit Detachment",
  rulesText: "Deploy 4 Forces to your Capital, OR 2 Forces to a hex you occupy.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2, gold: 1 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [
      { kind: "capital" },
      { kind: "occupiedHex", owner: "self" }
    ]
  },
  effects: [{ kind: "recruit", capitalCount: 4, occupiedCount: 2 }]
};
var PAID_VOLUNTEERS = {
  id: "age1.paid_volunteers",
  name: "Paid Volunteers",
  rulesText: "Deploy 4 Forces to your Capital.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1, gold: 2 },
  initiative: 65,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 4 }]
};
var ESCORT_DETAIL = {
  id: "age1.escort_detail",
  name: "Escort Detail",
  rulesText: "Deploy 2 Forces to a friendly Champion's hex.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1, gold: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "deployForces", count: 2 }]
};
var NATIONAL_SERVICE = {
  id: "age1.national_service",
  name: "National Service",
  rulesText: "Deploy 1 Force to your Capital.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 0, gold: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 1 }]
};
var FRONTIER_CLAIM = {
  id: "age1.frontier_claim",
  name: "Frontier Claim",
  rulesText: "Deploy 4 Forces to an empty hex within distance 1 of your Capital (ignoring Bridges).",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2, gold: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    maxDistanceFromCapital: 1,
    requiresEmpty: true,
    allowCapital: false
  },
  effects: [{ kind: "deployForces", count: 4 }]
};
var SCAVENGERS_MARKET = {
  id: "age1.scavengers_market",
  name: "Scavenger's Market",
  rulesText: "Gain +1 gold. Draw 1 card.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "gainGold", amount: 1 },
    { kind: "drawCards", count: 1 }
  ]
};
var TEMPORARY_BRIDGE = {
  id: "age1.temporary_bridge",
  name: "Temporary Bridge",
  rulesText: "Build 1 Bridge between any two adjacent hexes (no occupancy requirement). Destroy it in Cleanup.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: {
    kind: "edge",
    anywhere: true
  },
  effects: [{ kind: "buildBridge", temporary: true }]
};
var SABOTAGE_BRIDGE = {
  id: "age1.sabotage_bridge",
  name: "Sabotage Bridge",
  rulesText: "Destroy a Bridge adjacent to a hex you occupy.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 65,
  burn: false,
  targetSpec: {
    kind: "edge"
  },
  effects: [{ kind: "destroyBridge" }]
};
var BRIDGE_TRAP = {
  id: "age1.bridge_trap",
  name: "Bridge Trap",
  rulesText: "Choose a Bridge adjacent to a hex you occupy. The first enemy stack to cross it this round loses 1 Force (random).",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "edge"
  },
  effects: [{ kind: "trapBridge" }]
};
var TUNNEL_NETWORK = {
  id: "age1.tunnel_network",
  name: "Tunnel Network",
  rulesText: "Your Capital is considered connected to the center by a Bridge until end of round. Burn.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 80,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "linkCapitalToCenter" }]
};
var PATCH_UP = {
  id: "age1.patch_up",
  name: "Patch Up",
  rulesText: "Heal a friendly Champion anywhere 2. If it is in your Capital, heal 4 instead.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "patchUp", baseHeal: 2, capitalBonus: 2 }]
};
var BATTLE_CRY = {
  id: "age1.battle_cry",
  name: "Battle Cry",
  rulesText: "Until end of round, the first battle you fight: each of your Champions in that battle rolls +1 die in combat round 1.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "battleCry" }]
};
var SMOKE_SCREEN = {
  id: "age1.smoke_screen",
  name: "Smoke Screen",
  rulesText: "Until end of round, the first battle you fight: enemy Forces hit on 1 only in combat round 1.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "smokeScreen" }]
};
var QUICK_STUDY = {
  id: "age1.quick_study",
  name: "Quick Study",
  rulesText: "Draw 2 cards.",
  type: "Order",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 25,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 2 }]
};
var MAKE_A_PLAY = {
  id: "age1.make_a_play",
  name: "Make a Play",
  rulesText: "Gain 1 mana. Burn.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 0 },
  initiative: 70,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMana", amount: 1 }]
};
var PAID_LOGISTICS = {
  id: "age1.paid_logistics",
  name: "Paid Logistics",
  rulesText: "Gain 1 mana. Burn.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 0, gold: 6 },
  initiative: 70,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMana", amount: 1 }]
};
var SMALL_HANDS = {
  id: "age1.small_hands",
  name: "Small Hands",
  rulesText: "If this is the last card in your hand, draw 3 cards.",
  type: "Spell",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCardsIfHandEmpty", count: 3 }]
};
var SUPPLY_LEDGER = {
  id: "age1.supply_ledger",
  name: "Supply Ledger",
  rulesText: "When played: Gain +1 gold.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 1 }]
};
var PATROL_RECORD = {
  id: "age1.patrol_record",
  name: "Patrol Record",
  rulesText: "When played: Draw 1 card.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 1 }]
};
var BANNER_CLAIM = {
  id: "age1.banner_claim",
  name: "Banner Claim",
  rulesText: "When played: Move 1 Force you control 1 hex along a Bridge.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "stack",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 1, forceCount: 1 }]
};
var SKIRMISHER_CAPTAIN = {
  id: "champion.age1.skirmisher_captain",
  name: "Skirmisher Captain",
  rulesText: "On deploy: Deploy 1 Force to its hex.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 65,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 3,
    bounty: 2,
    goldCostByChampionCount: [0, 2, 4]
  }
};
var BRIDGE_RUNNER = {
  id: "champion.age1.bridge_runner",
  name: "Bridge Runner",
  rulesText: "Pathfinder: may move to adjacent hexes without Bridges.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 3,
    attackDice: 3,
    hitFaces: 2,
    bounty: 2,
    goldCostByChampionCount: [0, 2, 4]
  }
};
var INSPIRING_GEEZER = {
  id: "champion.age1.inspiring_geezer",
  name: "Inspiring Geezer",
  rulesText: "All friendly forces in this hex hit on 1-3.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 2,
    attackDice: 1,
    hitFaces: 2,
    bounty: 2,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var FIELD_SURGEON = {
  id: "champion.age1.field_surgeon",
  name: "Field Surgeon",
  rulesText: "Stitchwork (1/round): Heal a friendly Champion in this hex 2.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 2,
    bounty: 2,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var BRUTE = {
  id: "champion.age1.brute",
  name: "Brute",
  rulesText: "If there is no enemy Champion in this hex, roll 2 extra dice (total 3) that hit on 1-3.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 1,
    hitFaces: 3,
    bounty: 2,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var BOUNTY_HUNTER = {
  id: "champion.age1.bounty_hunter",
  name: "Bounty Hunter",
  rulesText: "Contract Pay: When an enemy Champion dies in a battle this Champion is in, gain +1 gold.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 2 },
  initiative: 75,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 3,
    bounty: 2,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var SERGEANT = {
  id: "champion.age1.sergeant",
  name: "Sergeant",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 3,
    attackDice: 1,
    hitFaces: 3,
    bounty: 1,
    goldCostByChampionCount: [1, 1, 1]
  }
};
var TRAITOR = {
  id: "champion.age1.traitor",
  name: "Traitor",
  rulesText: "Upon death: set the owner's mana to 0.",
  type: "Champion",
  deck: "age1",
  tags: ["market", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 3,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 2, 5]
  }
};
var AGE1_CARDS = [
  QUICK_MARCH,
  ROLL_OUT,
  FLANK_STEP,
  EMERGENCY_EVAC,
  COLUMN_ADVANCE,
  PROSPECTING,
  TRADE_CARAVAN,
  RECRUIT_DETACHMENT,
  PAID_VOLUNTEERS,
  ESCORT_DETAIL,
  NATIONAL_SERVICE,
  FRONTIER_CLAIM,
  SCAVENGERS_MARKET,
  TEMPORARY_BRIDGE,
  SABOTAGE_BRIDGE,
  BRIDGE_TRAP,
  TUNNEL_NETWORK,
  PATCH_UP,
  BATTLE_CRY,
  SMOKE_SCREEN,
  QUICK_STUDY,
  MAKE_A_PLAY,
  PAID_LOGISTICS,
  SMALL_HANDS,
  SUPPLY_LEDGER,
  PATROL_RECORD,
  BANNER_CLAIM,
  SKIRMISHER_CAPTAIN,
  BRIDGE_RUNNER,
  INSPIRING_GEEZER,
  FIELD_SURGEON,
  BRUTE,
  BOUNTY_HUNTER,
  SERGEANT,
  TRAITOR
];

// packages/engine/src/content/cards/age2.ts
var TRIPLE_MARCH = {
  id: "age2.triple_march",
  name: "Triple March",
  rulesText: "Move 1 stack up to 3 along Bridges.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 3,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 3 }]
};
var COORDINATED_ADVANCE = {
  id: "age2.coordinated_advance",
  name: "Coordinated Advance",
  rulesText: "Move 2 stacks up to 2 along Bridges each.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 2,
    minPaths: 2,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 2 }]
};
var BREAKTHROUGH_LINE = {
  id: "age2.breakthrough_line",
  name: "Breakthrough Line",
  rulesText: "Move 1 stack up to 2 along Bridges. If it wins a battle this round, draw 2 at Cleanup.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "battleWinDraw", drawCount: 2 }, { kind: "moveStack", maxDistance: 2 }]
};
var SET_TO_SKIRMISH = {
  id: "age2.set_to_skirmish",
  name: "Set to Skirmish",
  rulesText: "Select a hex. If a battle happens there with your forces this round, they retreat to a random empty adjacent hex (or die if none are empty).",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    allowEmpty: true
  },
  effects: [{ kind: "setToSkirmish" }]
};
var BATTALION_CONTRACT = {
  id: "age2.battalion_contract",
  name: "Battalion Contract",
  rulesText: "Deploy 10 Forces to your Capital.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 3, gold: 2 },
  initiative: 80,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 10 }]
};
var RALLY_WHERE_YOU_STAND = {
  id: "age2.rally_where_you_stand",
  name: "Rally Where You Stand",
  rulesText: "Deploy 3 Forces to a friendly Champion's hex.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1, gold: 3 },
  initiative: 50,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "deployForces", count: 3 }]
};
var FORWARD_BARRACKS = {
  id: "age2.forward_barracks",
  name: "Forward Barracks",
  rulesText: "Deploy 4 Forces to a Mine/Forge you occupy or your Capital.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1, gold: 2 },
  initiative: 65,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [
      { kind: "capital" },
      { kind: "occupiedHex", tile: "mine" },
      { kind: "occupiedHex", tile: "forge" }
    ]
  },
  effects: [{ kind: "recruit", capitalCount: 4, occupiedCount: 4 }]
};
var CONSCRIPTION_DRIVE = {
  id: "age2.conscription_drive",
  name: "Conscription Drive",
  rulesText: "Deploy 4 Forces to your Capital, then discard 1 card.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1, gold: 1 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [
    { kind: "recruit", capitalCount: 4 },
    { kind: "discardFromHand", count: 1 }
  ]
};
var MINER_ARMY = {
  id: "age2.miner_army",
  name: "Miner Army",
  rulesText: "Deploy 2 Forces into all Mines you occupy.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1, gold: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "deployForcesOnMines", count: 2 }]
};
var FOCUS_FIRE = {
  id: "age2.focus_fire",
  name: "Focus Fire",
  rulesText: "In your next battle this round, you assign hits you deal instead of random.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "focusFire" }]
};
var SLOW = {
  id: "age2.slow",
  name: "Slow",
  rulesText: "Selected champion rolls only 1 die in their next battle.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "enemy"
  },
  effects: [{ kind: "slow" }]
};
var WARD = {
  id: "age2.ward",
  name: "Ward",
  rulesText: "Choose a friendly Champion. It can't be targeted by enemy cards this round.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "ward" }]
};
var FRENZY = {
  id: "age2.frenzy",
  name: "Frenzy",
  rulesText: "Friendly Champion rolls +2 dice this round; it takes 2 damage immediately.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "frenzy", diceBonus: 2, damage: 2 }]
};
var REPAIR_ORDERS = {
  id: "age2.repair_orders",
  name: "Repair Orders",
  rulesText: "All your champions heal 1.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "healChampions", amount: 1 }]
};
var GOLD_PLATED_ARMOR = {
  id: "age2.gold_plated_armor",
  name: "Gold Plated Armor",
  rulesText: "Choose a friendly Champion. This round, each time it would take 1 damage, lose 2 gold and prevent that damage.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "goldPlatedArmor", costPerDamage: 2 }]
};
var MORTAR_SHOT = {
  id: "age2.mortar_shot",
  name: "Mortar Shot",
  rulesText: "Target a hex within distance 2 of your forces. 50% chance it hits that hex, otherwise it hits an adjacent hex. Destroy 4 forces and deal 2 damage to any champions in the hit hex.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 300,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    allowEmpty: true
  },
  effects: [{ kind: "mortarShot", maxDistance: 2, forceLoss: 4, damage: 2 }]
};
var CHAMPION_RECALL = {
  id: "age2.champion_recall",
  name: "Champion Recall",
  rulesText: "Recall a friendly Champion to your hand.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "recallChampion" }]
};
var BURN_THE_BRIDGES = {
  id: "age2.burn_the_bridges",
  name: "Burn the Bridges",
  rulesText: "Move 1 stack up to 1 along Bridges. After moving destroy every bridge connected to the hex you selected. Burn.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: true,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [
    { kind: "moveStack", maxDistance: 1 },
    { kind: "destroyConnectedBridges" }
  ]
};
var WAR_TAXES = {
  id: "age2.war_taxes",
  name: "War Taxes",
  rulesText: "Gain +4 gold.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 4 }]
};
var SMUGGLING_RING = {
  id: "age2.smuggling_ring",
  name: "Smuggling Ring",
  rulesText: "Gain +2 gold. If you occupy an enemy Capital right now, gain +3 more.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "gainGold", amount: 2 },
    { kind: "gainGoldIfEnemyCapital", amount: 3 }
  ]
};
var REFINED_INGOTS = {
  id: "age2.refined_ingots",
  name: "Refined Ingots",
  rulesText: "Gain +2 gold. If you occupy a Mine, gain +4 gold instead.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 2, bonusIfMine: 2 }]
};
var GUILD_FAVOR = {
  id: "age2.guild_favor",
  name: "Guild Favor",
  rulesText: "Gain +4 gold and draw 1.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 40,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "gainGold", amount: 4 },
    { kind: "drawCards", count: 1 }
  ]
};
var INSIGHT = {
  id: "age2.insight",
  name: "Insight",
  rulesText: "Draw 2. Burn.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 0 },
  initiative: 60,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 2 }]
};
var CLEAN_CUTS = {
  id: "age2.clean_cuts",
  name: "Clean Cuts",
  rulesText: "Burn 1 card from your hand. Draw 1.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "burnFromHand", count: 1 },
    { kind: "drawCards", count: 1 }
  ]
};
var STALL = {
  id: "age2.stall",
  name: "Stall",
  rulesText: "Do nothing.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 0 },
  initiative: 50,
  burn: false,
  targetSpec: { kind: "none" },
  effects: []
};
var INTERRUPT = {
  id: "age2.interrupt",
  name: "Interrupt",
  rulesText: "Draw 2 cards. All other players draw 1 card.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 2 },
    { kind: "drawCardsOtherPlayers", count: 1 }
  ]
};
var BRIDGE_LOCKDOWN = {
  id: "age2.bridge_lockdown",
  name: "Bridge Lockdown",
  rulesText: "Choose a Bridge adjacent to a hex you occupy; it can't be crossed this round.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 40,
  burn: false,
  targetSpec: { kind: "edge" },
  effects: [{ kind: "lockBridge" }]
};
var BRIDGE_NETWORK = {
  id: "age2.bridge_network",
  name: "Bridge Network",
  rulesText: "Build 3 Bridges, each touching a hex you occupy.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "multiEdge",
    minEdges: 3,
    maxEdges: 3
  },
  effects: [{ kind: "buildBridge" }]
};
var WORMHOLE_LINK = {
  id: "age2.wormhole_link",
  name: "Wormhole Link",
  rulesText: "Choose 2 hexes within distance 3 of your Champions; treat them as adjacent until end of round.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 80,
  burn: true,
  targetSpec: {
    kind: "hexPair",
    maxDistanceFromFriendlyChampion: 3
  },
  effects: [{ kind: "linkHexes" }]
};
var BRIDGE_PIVOT = {
  id: "age2.bridge_pivot",
  name: "Bridge Pivot",
  rulesText: "Choose a hex, destroy one bridge connected to that hex and place a new bridge connected to that hex.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 80,
  burn: false,
  targetSpec: {
    kind: "multiEdge",
    minEdges: 2,
    maxEdges: 2
  },
  effects: [{ kind: "bridgePivot" }]
};
var DEEP_SHAFT_RIG = {
  id: "age2.deep_shaft_rig",
  name: "Deep Shaft Rig",
  rulesText: "Choose a Mine you occupy. Increase its Mine Value by +1 (max 7). Then deploy 1 Force onto that Mine.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2, gold: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    tile: "mine"
  },
  effects: [
    { kind: "increaseMineValue", amount: 1, maxValue: 7 },
    { kind: "deployForces", count: 1 }
  ]
};
var WAR_PROFITEERS = {
  id: "age2.war_profiteers",
  name: "Dice: War Profiteers",
  rulesText: "Roll 1 die. 1-4: Gain 1 gold. 5-6: Gain 6 gold.",
  type: "Order",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 45,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "rollGold", sides: 6, highMin: 5, lowGain: 1, highGain: 6 }]
};
var ENCIRCLEMENT = {
  id: "age2.encirclement",
  name: "Encirclement",
  rulesText: "Choose an enemy-occupied hex. If you occupy at least three adjacent hexes, destroy up to 6 enemy Forces there.",
  type: "Spell",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "enemy"
  },
  effects: [{ kind: "encirclement", minAdjacent: 3, maxForces: 6 }]
};
var STRATEGIC_TRIUMPH = {
  id: "age2.strategic_triumph",
  name: "Strategic Triumph",
  rulesText: "Gain +2 gold.",
  type: "Victory",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 2 }],
  victoryPoints: 1
};
var CENTER_DISPATCH = {
  id: "age2.center_dispatch",
  name: "Center Dispatch",
  rulesText: "Draw 2 if you occupy Center; otherwise draw 1.",
  type: "Victory",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 1 },
    { kind: "drawCardsIfTile", tile: "center", count: 1 }
  ],
  victoryPoints: 1
};
var BANNER_OF_RESOLVE = {
  id: "age2.banner_of_resolve",
  name: "Banner of Resolve",
  rulesText: "Deploy 1 Force to your Capital.",
  type: "Victory",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 1 }],
  victoryPoints: 1
};
var BIG_VP_GAINER = {
  id: "age2.big_vp_gainer",
  name: "Big VP Gainer",
  rulesText: "Gives +2 VP. When drawn: lose 1 gold.",
  type: "Victory",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 1 },
  initiative: 75,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [],
  onDraw: [{ kind: "loseGold", amount: 1 }],
  victoryPoints: 2
};
var JET_STRIKER = {
  id: "champion.age2.jet_striker",
  name: "Jet Striker",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 3,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var GUERILLA_NATIVE_MERCENARY = {
  id: "champion.age2.guerilla_native_mercenary",
  name: "Guerilla Native Mercenary",
  rulesText: "Can be deployed to any unoccupied hex on the board (in addition to being able to be deployed to anywhere you occupy).",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    allowEmpty: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var TAX_REAVER = {
  id: "champion.age2.tax_reaver",
  name: "Tax Reaver",
  rulesText: "Extort: When it kills a Champion, take up to 2 gold from that player (if possible).",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var SIEGE_ENGINEER = {
  id: "champion.age2.siege_engineer",
  name: "Siege Engineer",
  rulesText: "On deploy: destroy 1 Bridge adjacent to its hex.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var DUELIST_EXEMPLAR = {
  id: "champion.age2.duelist_exemplar",
  name: "Duelist Exemplar",
  rulesText: "If any enemy Champion is in its battle, roll +1 die each combat round.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  }
};
var LONE_WOLF = {
  id: "champion.age2.lone_wolf",
  name: "Lone Wolf",
  rulesText: "If there are no friendly Forces, roll 3 extra dice.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 75,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 1,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var RELIABLE_VETERAN = {
  id: "champion.age2.reliable_veteran",
  name: "Reliable Veteran",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 65,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 1,
    hitFaces: 5,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var CAPTURER = {
  id: "champion.age2.capturer",
  name: "Capturer",
  rulesText: "When this Champion wins a battle, deploy 1 Force to the hex it occupies.",
  type: "Champion",
  deck: "age2",
  tags: ["market", "age2"],
  cost: { mana: 2 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 3,
    bounty: 0,
    goldCostByChampionCount: [1, 2, 5]
  }
};
var AGE2_CARDS = [
  TRIPLE_MARCH,
  COORDINATED_ADVANCE,
  BREAKTHROUGH_LINE,
  SET_TO_SKIRMISH,
  BATTALION_CONTRACT,
  RALLY_WHERE_YOU_STAND,
  FORWARD_BARRACKS,
  CONSCRIPTION_DRIVE,
  MINER_ARMY,
  FOCUS_FIRE,
  SLOW,
  WARD,
  FRENZY,
  REPAIR_ORDERS,
  GOLD_PLATED_ARMOR,
  MORTAR_SHOT,
  CHAMPION_RECALL,
  BURN_THE_BRIDGES,
  WAR_TAXES,
  SMUGGLING_RING,
  REFINED_INGOTS,
  GUILD_FAVOR,
  INSIGHT,
  CLEAN_CUTS,
  STALL,
  INTERRUPT,
  BRIDGE_LOCKDOWN,
  BRIDGE_NETWORK,
  WORMHOLE_LINK,
  BRIDGE_PIVOT,
  DEEP_SHAFT_RIG,
  WAR_PROFITEERS,
  ENCIRCLEMENT,
  STRATEGIC_TRIUMPH,
  CENTER_DISPATCH,
  BANNER_OF_RESOLVE,
  BIG_VP_GAINER,
  JET_STRIKER,
  GUERILLA_NATIVE_MERCENARY,
  TAX_REAVER,
  SIEGE_ENGINEER,
  DUELIST_EXEMPLAR,
  LONE_WOLF,
  RELIABLE_VETERAN,
  CAPTURER
];

// packages/engine/src/content/cards/age3.ts
var GRAND_MANEUVER = {
  id: "age3.grand_maneuver",
  name: "Grand Maneuver",
  rulesText: "Move up to 2 different stacks up to 3 hexes along Bridges each.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "multiPath",
    owner: "self",
    maxDistance: 3,
    maxPaths: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStacks", maxDistance: 3 }]
};
var GHOST_STEP = {
  id: "age3.ghost_step",
  name: "Ghost Step",
  rulesText: "Move 1 stack up to 2 hexes ignoring Bridges. Burn.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 30,
  burn: true,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: false
  },
  effects: [{ kind: "moveStack", maxDistance: 2, requiresBridge: false }]
};
var FINAL_PUSH = {
  id: "age3.final_push",
  name: "Final Push",
  rulesText: "Move 1 stack up to 1 along Bridges. If it wins a battle this round, draw 2 at Cleanup.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [{ kind: "battleWinDraw", drawCount: 2 }, { kind: "moveStack", maxDistance: 1 }]
};
var DEEP_RESERVES = {
  id: "age3.deep_reserves",
  name: "Deep Reserves",
  rulesText: "Deploy 8 Forces to your Capital.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2, gold: 2 },
  initiative: 80,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 8 }]
};
var ENDLESS_CONSCRIPTION = {
  id: "age3.endless_conscription",
  name: "Endless Conscription",
  rulesText: "Deploy X Forces to your Capital, where X is the number of cards in your hand.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2, gold: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruitByHandSize" }]
};
var FORWARD_LEGION = {
  id: "age3.forward_legion",
  name: "Forward Legion",
  rulesText: "Deploy 5 Forces to a hex you occupy.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1, gold: 3 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "deployForces", count: 5 }]
};
var ROYAL_MINT = {
  id: "age3.royal_mint",
  name: "Royal Mint",
  rulesText: "Gain 5 gold.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 65,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 5 }]
};
var TOME_OF_ORDERS = {
  id: "age3.tome_of_orders",
  name: "Tome of Orders",
  rulesText: "Draw 2 cards. Then you may put 1 card from your hand on top of your draw pile.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 2 },
    { kind: "topdeckFromHand", count: 1 }
  ]
};
var LAST_LECTURE = {
  id: "age3.last_lecture",
  name: "Last Lecture",
  rulesText: "Draw 5 cards. Burn.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 80,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 5 }]
};
var MASTER_PLAN = {
  id: "age3.master_plan",
  name: "Master Plan",
  rulesText: "Draw 4, discard 2.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 4 },
    { kind: "discardFromHand", count: 2 }
  ]
};
var PERFECT_CYCLE = {
  id: "age3.perfect_cycle",
  name: "Perfect Cycle",
  rulesText: "Draw 1, burn 1.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 45,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "drawCards", count: 1 },
    { kind: "burnFromHand", count: 1 }
  ]
};
var EXECUTION_ORDER = {
  id: "age3.execution_order",
  name: "Execution Order",
  rulesText: "Deal 3 damage to an enemy Champion within 2 hexes of your Champion.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "enemy",
    requiresFriendlyChampion: true,
    maxDistance: 2
  },
  effects: [{ kind: "dealChampionDamage", amount: 3 }]
};
var WORMHOLE_GATE = {
  id: "age3.wormhole_gate",
  name: "Wormhole Gate",
  rulesText: "Choose 2 hexes anywhere on the board; treat them as adjacent this round. Burn.",
  type: "Spell",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hexPair",
    allowSame: false
  },
  effects: [{ kind: "linkHexes" }]
};
var RUIN_THE_SPAN = {
  id: "age3.ruin_the_span",
  name: "Ruin the Span",
  rulesText: "Destroy 2 Bridges anywhere.",
  type: "Order",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "multiEdge",
    anywhere: true,
    minEdges: 2,
    maxEdges: 2
  },
  effects: [{ kind: "destroyBridge" }]
};
var CONQUEST_RECORD = {
  id: "age3.conquest_record",
  name: "Conquest Record",
  rulesText: "When played: Gain 3 gold.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 3 }]
};
var FINAL_OATH = {
  id: "age3.final_oath",
  name: "Final Oath",
  rulesText: "When played: Heal a friendly Champion anywhere 2.",
  type: "Victory",
  victoryPoints: 1,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "healChampion", amount: 2 }]
};
var MONUMENT_PLAN = {
  id: "age3.monument_plan",
  name: "Monument Plan",
  rulesText: "Gives +2 VP. When played: Discard 1 card.",
  type: "Victory",
  victoryPoints: 2,
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "discardFromHand", count: 1 }]
};
var LOGISTICS_OFFICER = {
  id: "champion.age3.logistics_officer",
  name: "Logistics Officer",
  rulesText: "You may deploy to this Champion as if it were your Capital.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var TITAN_VANGUARD = {
  id: "champion.age3.titan_vanguard",
  name: "Titan Vanguard",
  rulesText: "No special ability.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 10,
    attackDice: 2,
    hitFaces: 3,
    bounty: 5,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var CENTER_BANNERMAN = {
  id: "champion.age3.center_bannerman",
  name: "Center Bannerman",
  rulesText: "Worth 1 VP while occupying the Center.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 3,
    attackDice: 2,
    hitFaces: 2,
    bounty: 5,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var BLOOD_BANKER = {
  id: "champion.age3.blood_banker",
  name: "Blood Banker",
  rulesText: "Blood Ledger (1/round): First time a Champion dies in this hex, gain +2 gold.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 7,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var STORMCALLER = {
  id: "champion.age3.stormcaller",
  name: "Stormcaller",
  rulesText: "Tempest (1/round): deal 1 damage to every enemy Champion in adjacent hexes.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 45,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 8,
    attackDice: 3,
    hitFaces: 2,
    bounty: 4,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var GRAND_STRATEGIST = {
  id: "champion.age3.grand_strategist",
  name: "Grand Strategist",
  rulesText: "Tactical Hand (1/round): in a battle it\u2019s in, you may assign 3 of your hits.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 2 },
  initiative: 25,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var CAPITAL_BREAKER = {
  id: "champion.age3.capital_breaker",
  name: "Capital Breaker",
  rulesText: "Breach: In Capital sieges this round, your Forces in that siege hit on 1\u20133 in combat round 1.",
  type: "Champion",
  deck: "age3",
  tags: ["market", "age3"],
  cost: { mana: 3 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 8,
    attackDice: 3,
    hitFaces: 3,
    bounty: 4,
    goldCostByChampionCount: [2, 4, 6]
  }
};
var AGE3_CARDS = [
  GRAND_MANEUVER,
  GHOST_STEP,
  FINAL_PUSH,
  DEEP_RESERVES,
  ENDLESS_CONSCRIPTION,
  FORWARD_LEGION,
  ROYAL_MINT,
  TOME_OF_ORDERS,
  LAST_LECTURE,
  MASTER_PLAN,
  PERFECT_CYCLE,
  EXECUTION_ORDER,
  WORMHOLE_GATE,
  RUIN_THE_SPAN,
  CONQUEST_RECORD,
  FINAL_OATH,
  MONUMENT_PLAN,
  LOGISTICS_OFFICER,
  TITAN_VANGUARD,
  CENTER_BANNERMAN,
  BLOOD_BANKER,
  STORMCALLER,
  GRAND_STRATEGIST,
  CAPITAL_BREAKER
];

// packages/engine/src/content/cards/faction.ts
var HOLD_THE_LINE = {
  id: "faction.bastion.hold_the_line",
  name: "Hold the Line",
  rulesText: "Choose a hex you occupy. Until end of round, when you defend in that hex, your Forces hit on 1-3.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "holdTheLine" }],
  factionId: "bastion"
};
var MARKED_FOR_COIN = {
  id: "faction.veil.marked_for_coin",
  name: "Marked for Coin",
  rulesText: "Mark an enemy Champion within distance 2 of one of your Champions. If it dies before end of round, gain +4 gold.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 35,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "enemy",
    maxDistance: 2,
    requiresFriendlyChampion: true
  },
  effects: [{ kind: "markForCoin", bounty: 4 }],
  factionId: "veil"
};
var AIR_DROP = {
  id: "faction.aerial.air_drop",
  name: "Air Drop",
  rulesText: "Deploy 3 Forces into any non-Capital hex within distance 1 of one of your Champions (ignores Bridges).",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2, gold: 1 },
  initiative: 30,
  burn: false,
  targetSpec: {
    kind: "hex",
    owner: "any",
    maxDistanceFromFriendlyChampion: 1,
    allowCapital: false,
    ignoresBridges: true
  },
  effects: [{ kind: "deployForces", count: 3, ignoresBridges: true }],
  factionId: "aerial"
};
var RICH_VEINS = {
  id: "faction.prospect.rich_veins",
  name: "Rich Veins",
  rulesText: "If you occupy a Mine, increase its value permanently by 1 (max 7).",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 45,
  burn: false,
  targetSpec: {
    kind: "hex",
    tile: "mine",
    owner: "self",
    occupied: true
  },
  effects: [{ kind: "increaseMineValue", amount: 1, maxValue: 7 }],
  factionId: "prospect"
};
var PERFECT_RECALL = {
  id: "faction.cipher.perfect_recall",
  name: "Perfect Recall",
  rulesText: "Draw 1 card. Then you may put 1 card from your hand on top of your draw pile.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 25,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 1 }, { kind: "topdeckFromHand", count: 1 }],
  factionId: "cipher"
};
var BRIDGEBORN_PATH = {
  id: "faction.gatewright.bridgeborn_path",
  name: "Bridgeborn Path",
  rulesText: "Build 1 Bridge anywhere on the board.",
  type: "Spell",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 1 },
  initiative: 50,
  burn: false,
  targetSpec: {
    kind: "edge",
    anywhere: true
  },
  effects: [{ kind: "buildBridge" }],
  factionId: "gatewright"
};
var IRONCLAD_WARDEN = {
  id: "champion.bastion.ironclad_warden",
  name: "Ironclad Warden",
  rulesText: "Bodyguard: the first hit that would be assigned to a friendly Champion is assigned to a friendly Force instead (if any).",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 70,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 6,
    attackDice: 2,
    hitFaces: 2,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "bastion"
};
var SHADEBLADE = {
  id: "champion.veil.shadeblade",
  name: "Shadeblade",
  rulesText: "Assassin's Edge (1/round): before combat round 1 of a battle Shadeblade is in, deal 1 damage to an enemy Champion in that hex.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 55,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 3,
    attackDice: 5,
    hitFaces: 1,
    bounty: 3,
    goldCostByChampionCount: [0, 2, 4]
  },
  factionId: "veil"
};
var SKYSTRIKER_ACE = {
  id: "champion.aerial.skystriker_ace",
  name: "Skystriker Ace",
  rulesText: "Flight: may move to adjacent hexes without Bridges.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 4,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [0, 2, 4]
  },
  factionId: "aerial"
};
var MINE_OVERSEER = {
  id: "champion.prospect.mine_overseer",
  name: "Mine Overseer",
  rulesText: "Extraction: while on a Mine you occupy, that Mine gives +1 gold at Collection.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 65,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 2,
    bounty: 4,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "prospect"
};
var ARCHIVIST_PRIME = {
  id: "champion.cipher.archivist_prime",
  name: "Archivist Prime",
  rulesText: "Gain +1 attack die for each card you have played this round.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 60,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "cipher"
};
var WORMHOLE_ARTIFICER = {
  id: "champion.gatewright.wormhole_artificer",
  name: "Wormhole Artificer",
  rulesText: "If moving alone, may move +1 hex.",
  type: "Champion",
  deck: "starter",
  tags: ["starter", "faction"],
  cost: { mana: 2 },
  initiative: 65,
  burn: true,
  targetSpec: {
    kind: "hex",
    owner: "self",
    occupied: true
  },
  champion: {
    hp: 5,
    attackDice: 2,
    hitFaces: 3,
    bounty: 3,
    goldCostByChampionCount: [1, 3, 5]
  },
  factionId: "gatewright"
};
var FACTION_SPELLS = [
  HOLD_THE_LINE,
  MARKED_FOR_COIN,
  AIR_DROP,
  RICH_VEINS,
  PERFECT_RECALL,
  BRIDGEBORN_PATH
];
var FACTION_CHAMPIONS = [
  IRONCLAD_WARDEN,
  SHADEBLADE,
  SKYSTRIKER_ACE,
  MINE_OVERSEER,
  ARCHIVIST_PRIME,
  WORMHOLE_ARTIFICER
];
var FACTION_CARDS = [...FACTION_SPELLS, ...FACTION_CHAMPIONS];

// packages/engine/src/content/cards/power.ts
var COMMAND_SURGE = {
  id: "power.age1.command_surge",
  name: "Command Surge",
  rulesText: "Gain +2 mana. Burn.",
  type: "Spell",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 0 },
  initiative: 10,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainMana", amount: 2 }]
};
var INSTANT_BRIDGE_NET = {
  id: "power.age1.instant_bridge_net",
  name: "Instant Bridge Net",
  rulesText: "Build 3 Bridges, each touching a hex you occupy. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 35,
  burn: true,
  targetSpec: {
    kind: "multiEdge",
    minEdges: 3,
    maxEdges: 3
  },
  effects: [{ kind: "buildBridge" }]
};
var SECRET_PLANS = {
  id: "power.age1.secret_plans",
  name: "Secret Plans",
  rulesText: "Draw 2. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 0 },
  initiative: 15,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "drawCards", count: 2 }]
};
var EMERGENCY_PAY = {
  id: "power.age1.emergency_pay",
  name: "Emergency Pay",
  rulesText: "Gain +5 gold. Burn.",
  type: "Order",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 50,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 5 }]
};
var SHOCK_DRILL = {
  id: "power.age1.shock_drill",
  name: "Shock Drill",
  rulesText: "In your next battle this round, your Forces hit on 1\u20135 in combat round 1. Burn.",
  type: "Spell",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 45,
  burn: true,
  targetSpec: { kind: "none" },
  effects: [{ kind: "shockDrill" }]
};
var BRIDGE_DEED = {
  id: "power.age1.bridge_deed",
  name: "Bridge Deed",
  rulesText: "When played: Build 1 Bridge. Then you may move 1 stack 1 hex along a Bridge.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "edge",
    requiresOccupiedEndpoint: true
  },
  effects: [{ kind: "buildBridge" }, { kind: "moveStack", maxDistance: 1 }],
  victoryPoints: 1
};
var MINE_CHARTER = {
  id: "power.age1.mine_charter",
  name: "Mine Charter",
  rulesText: "When played: Gain +1 gold; if you occupy a Mine, gain +2 instead.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "prospecting", baseGold: 1, bonusIfMine: 1 }],
  victoryPoints: 1
};
var FORGE_SKETCH = {
  id: "power.age1.forge_sketch",
  name: "Forge Sketch",
  rulesText: "When played: You may discard 1 card; if you do, draw 2.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 30,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [
    { kind: "discardFromHand", count: 1 },
    { kind: "drawCards", count: 2 }
  ],
  victoryPoints: 1
};
var CENTER_WRIT = {
  id: "power.age1.center_writ",
  name: "Center Writ",
  rulesText: "When played: If you occupy Center, gain +1 mana.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 25,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainManaIfTile", tile: "center", amount: 1 }],
  victoryPoints: 1
};
var OATHSTONE = {
  id: "power.age1.oathstone",
  name: "Oathstone",
  rulesText: "When played: Heal a friendly Champion in your hex 2.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 70,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "self"
  },
  effects: [{ kind: "healChampion", amount: 2 }],
  victoryPoints: 1
};
var BANNER_OF_SPARKS = {
  id: "power.age1.banner_of_sparks",
  name: "Banner of Sparks",
  rulesText: "When played: Deploy 3 Forces to your Capital.",
  type: "Victory",
  deck: "power",
  tags: ["power", "age1"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [{ kind: "capital" }]
  },
  effects: [{ kind: "recruit", capitalCount: 3 }],
  victoryPoints: 1
};
var AGE1_POWER_CARDS = [
  COMMAND_SURGE,
  INSTANT_BRIDGE_NET,
  SECRET_PLANS,
  EMERGENCY_PAY,
  SHOCK_DRILL,
  BRIDGE_DEED,
  MINE_CHARTER,
  FORGE_SKETCH,
  CENTER_WRIT,
  OATHSTONE,
  BANNER_OF_SPARKS
];
var POWER_CARDS = [...AGE1_POWER_CARDS];

// packages/engine/src/content/cards/starter.ts
var createStarterVariant = (base, id, initiative) => ({
  ...base,
  id,
  initiative
});
var RECRUIT = {
  id: "starter.recruit",
  name: "Recruit",
  rulesText: "Deploy either 2 Forces into your Capital or 1 Force into a hex you occupy.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1, gold: 1 },
  initiative: 40,
  burn: false,
  targetSpec: {
    kind: "choice",
    options: [
      { kind: "capital" },
      { kind: "occupiedHex", owner: "self" }
    ]
  },
  effects: [{ kind: "recruit" }]
};
var MARCH_ORDERS = {
  id: "starter.march_orders",
  name: "March Orders",
  rulesText: "Move 1 stack up to 2 hexes along Bridges.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 100,
  burn: false,
  targetSpec: {
    kind: "path",
    owner: "self",
    maxDistance: 2,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 2 }]
};
var SUPPLY_CACHE = {
  id: "starter.supply_cache",
  name: "Supply Cache",
  rulesText: "Gain +2 gold.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 55,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "gainGold", amount: 2 }]
};
var FIELD_MEDIC = {
  id: "starter.field_medic",
  name: "Field Medic",
  rulesText: "Heal any Champion 2 HP.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 60,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "any"
  },
  effects: [{ kind: "healChampion", amount: 2 }]
};
var SCOUT_REPORT = {
  id: "starter.scout_report",
  name: "Scout Report",
  rulesText: "Look at the top 3 cards of your draw pile. Put 1 into hand, discard 2.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 220,
  burn: false,
  targetSpec: { kind: "none" },
  effects: [{ kind: "scoutReport", lookCount: 3, keepCount: 1 }]
};
var SCOUT_REPORT_VEIL = createStarterVariant(
  SCOUT_REPORT,
  "starter.scout_report.veil",
  215
);
var SCOUT_REPORT_AERIAL = createStarterVariant(
  SCOUT_REPORT,
  "starter.scout_report.aerial",
  200
);
var SCOUT_REPORT_PROSPECT = createStarterVariant(
  SCOUT_REPORT,
  "starter.scout_report.prospect",
  218
);
var SCOUT_REPORT_CIPHER = createStarterVariant(
  SCOUT_REPORT,
  "starter.scout_report.cipher",
  217
);
var SCOUT_REPORT_GATEWRIGHT = createStarterVariant(
  SCOUT_REPORT,
  "starter.scout_report.gatewright",
  210
);
var BRIDGE_CREW = {
  id: "starter.bridge_crew",
  name: "Bridge Crew",
  rulesText: "Build 1 Bridge between adjacent hexes where at least one endpoint is a hex you occupy. Then you may move 1 stack 1 hex.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 90,
  burn: false,
  targetSpec: {
    kind: "edge",
    requiresOccupiedEndpoint: true
  },
  effects: [{ kind: "buildBridge" }, { kind: "moveStack", maxDistance: 1 }]
};
var QUICK_MOVE = {
  id: "starter.quick_move",
  name: "Quick Move",
  rulesText: "Move 1 Force you control 1 hex along Bridges.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 120,
  burn: false,
  targetSpec: {
    kind: "stack",
    owner: "self",
    maxDistance: 1,
    requiresBridge: true
  },
  effects: [{ kind: "moveStack", maxDistance: 1, forceCount: 1 }]
};
var QUICK_MOVE_VEIL = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.veil",
  115
);
var QUICK_MOVE_AERIAL = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.aerial",
  100
);
var QUICK_MOVE_PROSPECT = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.prospect",
  118
);
var QUICK_MOVE_CIPHER = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.cipher",
  117
);
var QUICK_MOVE_GATEWRIGHT = createStarterVariant(
  QUICK_MOVE,
  "starter.quick_move.gatewright",
  110
);
var ZAP = {
  id: "starter.zap",
  name: "Zap",
  rulesText: "Deal 1 damage to any Champion.",
  type: "Order",
  deck: "starter",
  tags: ["starter"],
  cost: { mana: 1 },
  initiative: 220,
  burn: false,
  targetSpec: {
    kind: "champion",
    owner: "any"
  },
  effects: [{ kind: "dealChampionDamage", amount: 1 }]
};
var ZAP_VEIL = createStarterVariant(ZAP, "starter.zap.veil", 215);
var ZAP_AERIAL = createStarterVariant(ZAP, "starter.zap.aerial", 200);
var ZAP_PROSPECT = createStarterVariant(ZAP, "starter.zap.prospect", 218);
var ZAP_CIPHER = createStarterVariant(ZAP, "starter.zap.cipher", 217);
var ZAP_GATEWRIGHT = createStarterVariant(
  ZAP,
  "starter.zap.gatewright",
  210
);
var STARTER_CARDS = [
  RECRUIT,
  MARCH_ORDERS,
  SUPPLY_CACHE,
  FIELD_MEDIC,
  SCOUT_REPORT,
  SCOUT_REPORT_VEIL,
  SCOUT_REPORT_AERIAL,
  SCOUT_REPORT_PROSPECT,
  SCOUT_REPORT_CIPHER,
  SCOUT_REPORT_GATEWRIGHT,
  BRIDGE_CREW,
  QUICK_MOVE,
  QUICK_MOVE_VEIL,
  QUICK_MOVE_AERIAL,
  QUICK_MOVE_PROSPECT,
  QUICK_MOVE_CIPHER,
  QUICK_MOVE_GATEWRIGHT,
  ZAP,
  ZAP_VEIL,
  ZAP_AERIAL,
  ZAP_PROSPECT,
  ZAP_CIPHER,
  ZAP_GATEWRIGHT
];

// packages/engine/src/content/cards/index.ts
var addDerivedTags = (card) => {
  const tags = [...card.tags];
  const addTag = (tag, condition) => {
    if (condition && !tags.includes(tag)) {
      tags.push(tag);
    }
  };
  addTag("burn", card.burn);
  addTag("champion", card.type === "Champion");
  addTag("victory", card.type === "Victory");
  addTag("power", card.deck === "power");
  if (tags.length === card.tags.length) {
    return card;
  }
  return { ...card, tags };
};
var CARD_DEFS = [
  ...STARTER_CARDS,
  ...FACTION_CARDS,
  ...AGE1_CARDS,
  ...AGE2_CARDS,
  ...AGE3_CARDS,
  ...POWER_CARDS
].map(addDerivedTags);
var CARD_DEFS_BY_ID = CARD_DEFS.reduce(
  (acc, card) => {
    acc[card.id] = card;
    return acc;
  },
  {}
);
var getCardDef = (id) => {
  return CARD_DEFS_BY_ID[id];
};

// packages/engine/src/content/market-decks.ts
var toIds = (cards) => cards.map((card) => card.id);
var AGE1_MARKET_DECK = toIds(AGE1_CARDS);
var AGE2_MARKET_DECK = toIds(AGE2_CARDS);
var AGE3_MARKET_DECK = toIds(AGE3_CARDS);
var MARKET_DECKS_BY_AGE = {
  I: AGE1_MARKET_DECK,
  II: AGE2_MARKET_DECK,
  III: AGE3_MARKET_DECK
};

// packages/engine/src/content/power-decks.ts
var clone = (deck) => deck.slice();
var AGE1_POWER_DECK = [
  "power.age1.command_surge",
  "power.age1.instant_bridge_net",
  "power.age1.secret_plans",
  "power.age1.emergency_pay",
  "power.age1.shock_drill",
  "power.age1.bridge_deed",
  "power.age1.mine_charter",
  "power.age1.forge_sketch",
  "power.age1.center_writ",
  "power.age1.oathstone",
  "power.age1.banner_of_sparks"
];
var AGE2_POWER_DECK = clone(AGE2_MARKET_DECK);
var AGE3_POWER_DECK = clone(AGE3_MARKET_DECK);
var POWER_DECKS_BY_AGE = {
  I: AGE1_POWER_DECK,
  II: AGE2_POWER_DECK,
  III: AGE3_POWER_DECK
};

// packages/engine/src/content/starter-decks.ts
var COMMON_STARTER_DECK = [
  "starter.recruit",
  "starter.recruit",
  "starter.march_orders",
  "starter.supply_cache",
  "starter.field_medic",
  "starter.scout_report",
  "starter.bridge_crew",
  "starter.quick_move",
  "starter.zap"
];
var DEFAULT_FACTION_ID = "bastion";
var QUICK_MOVE_ID = "starter.quick_move";
var ZAP_ID = "starter.zap";
var SCOUT_REPORT_ID = "starter.scout_report";
var applyStarterOverrides = (overrides) => COMMON_STARTER_DECK.map((cardId) => overrides[cardId] ?? cardId);
var FACTION_STARTER_DECKS = {
  bastion: [...COMMON_STARTER_DECK],
  veil: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.veil",
    [ZAP_ID]: "starter.zap.veil",
    [SCOUT_REPORT_ID]: "starter.scout_report.veil"
  }),
  aerial: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.aerial",
    [ZAP_ID]: "starter.zap.aerial",
    [SCOUT_REPORT_ID]: "starter.scout_report.aerial"
  }),
  prospect: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.prospect",
    [ZAP_ID]: "starter.zap.prospect",
    [SCOUT_REPORT_ID]: "starter.scout_report.prospect"
  }),
  cipher: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.cipher",
    [ZAP_ID]: "starter.zap.cipher",
    [SCOUT_REPORT_ID]: "starter.scout_report.cipher"
  }),
  gatewright: applyStarterOverrides({
    [QUICK_MOVE_ID]: "starter.quick_move.gatewright",
    [ZAP_ID]: "starter.zap.gatewright",
    [SCOUT_REPORT_ID]: "starter.scout_report.gatewright"
  })
};
var FACTION_STARTER_SPELLS = {
  bastion: "faction.bastion.hold_the_line",
  veil: "faction.veil.marked_for_coin",
  aerial: "faction.aerial.air_drop",
  prospect: "faction.prospect.rich_veins",
  cipher: "faction.cipher.perfect_recall",
  gatewright: "faction.gatewright.bridgeborn_path"
};
var FACTION_STARTER_CHAMPIONS = {
  bastion: "champion.bastion.ironclad_warden",
  veil: "champion.veil.shadeblade",
  aerial: "champion.aerial.skystriker_ace",
  prospect: "champion.prospect.mine_overseer",
  cipher: "champion.cipher.archivist_prime",
  gatewright: "champion.gatewright.wormhole_artificer"
};
var resolveStarterFactionCards = (factionId) => {
  const hasFaction = Boolean(FACTION_STARTER_SPELLS[factionId]) && Boolean(FACTION_STARTER_CHAMPIONS[factionId]);
  const resolvedFaction = hasFaction ? factionId : DEFAULT_FACTION_ID;
  return {
    factionId: resolvedFaction,
    starterSpellId: FACTION_STARTER_SPELLS[resolvedFaction],
    championId: FACTION_STARTER_CHAMPIONS[resolvedFaction],
    deck: FACTION_STARTER_DECKS[resolvedFaction] ?? COMMON_STARTER_DECK
  };
};

// packages/engine/src/board.ts
var getPlayerIdsOnHex = (hex) => {
  return Object.entries(hex.occupants).filter(([, unitIds]) => unitIds.length > 0).map(([playerId]) => playerId);
};
var getCenterHexKey = (board) => {
  for (const hex of Object.values(board.hexes)) {
    if (hex.tile === "center") {
      return hex.key;
    }
  }
  return null;
};
var countPlayersOnHex = (hex) => {
  return getPlayerIdsOnHex(hex).length;
};
var isOccupiedByPlayer = (hex, playerId) => {
  return (hex.occupants[playerId]?.length ?? 0) > 0;
};
var hasEnemyUnits = (hex, playerId) => {
  return getPlayerIdsOnHex(hex).some((occupantId) => occupantId !== playerId);
};
var isContestedHex = (hex) => {
  return countPlayersOnHex(hex) === 2;
};
var wouldExceedTwoPlayers = (hex, enteringPlayerId) => {
  const occupants = new Set(getPlayerIdsOnHex(hex));
  occupants.add(enteringPlayerId);
  return occupants.size > 2;
};
var hasBridge = (board, from, to) => {
  const edgeKey = canonicalEdgeKey(from, to);
  return Boolean(board.bridges[edgeKey]);
};
var getBridgeKey = (from, to) => {
  return canonicalEdgeKey(from, to);
};

// packages/engine/src/modifiers.ts
var getHooks = (modifier) => {
  if (!modifier.hooks) {
    return null;
  }
  return modifier.hooks;
};
var isModifierActive = (modifier) => {
  if (modifier.duration.type === "uses") {
    return modifier.duration.remaining > 0;
  }
  return true;
};
var consumeModifierUse = (state, modifierId) => {
  const index = state.modifiers.findIndex((modifier2) => modifier2.id === modifierId);
  if (index < 0) {
    return state;
  }
  const modifier = state.modifiers[index];
  if (modifier.duration.type !== "uses") {
    return state;
  }
  const remaining = modifier.duration.remaining - 1;
  const nextModifiers = [...state.modifiers];
  if (remaining <= 0) {
    nextModifiers.splice(index, 1);
  } else {
    nextModifiers[index] = {
      ...modifier,
      duration: { type: "uses", remaining }
    };
  }
  return { ...state, modifiers: nextModifiers };
};
var filterActiveModifiers = (modifiers) => {
  return modifiers.filter((modifier) => isModifierActive(modifier));
};
var getCombatModifiers = (state, hexKey) => {
  return state.modifiers.filter((modifier) => {
    if (modifier.attachedHex && modifier.attachedHex !== hexKey) {
      return false;
    }
    if (modifier.attachedEdge) {
      return false;
    }
    return true;
  });
};
var expireEndOfRoundModifiers = (state) => {
  const modifiers = filterActiveModifiers(
    state.modifiers.filter((modifier) => modifier.duration.type !== "endOfRound")
  );
  return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
};
var expireEndOfBattleModifiers = (state, hexKey) => {
  const modifiers = filterActiveModifiers(
    state.modifiers.filter((modifier) => {
      if (modifier.duration.type !== "endOfBattle") {
        return true;
      }
      if (!modifier.attachedHex) {
        return false;
      }
      return modifier.attachedHex !== hexKey;
    })
  );
  return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
};
var applyModifierQuery = (state, modifiers, getHook, context, base) => {
  let value = base;
  for (const modifier of modifiers) {
    if (!isModifierActive(modifier)) {
      continue;
    }
    const hooks = getHooks(modifier);
    if (!hooks) {
      continue;
    }
    const hook = getHook(hooks);
    if (!hook) {
      continue;
    }
    value = hook({ ...context, modifier, state }, value);
  }
  return value;
};
var getMoveRequiresBridge = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMoveRequiresBridge,
    context,
    base
  );
};
var getMoveAdjacency = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMoveAdjacency,
    context,
    base
  );
};
var getMoveMaxDistance = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMoveMaxDistance,
    context,
    base
  );
};
var getDeployForcesCount = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getDeployForcesCount,
    context,
    base
  );
};
var getChampionKillBonusGold = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getChampionKillBonusGold,
    context,
    base
  );
};
var getChampionKillStealGold = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getChampionKillStealGold,
    context,
    base
  );
};
var getCardChoiceCount = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getCardChoiceCount,
    context,
    base
  );
};
var getControlValue = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getControlValue,
    context,
    base
  );
};
var getControlBonus = (state, context, base) => {
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getControlBonus,
    context,
    base
  );
};
var runModifierEvents = (state, modifiers, getHook, context) => {
  let nextState = state;
  for (const modifier of modifiers) {
    if (!isModifierActive(modifier)) {
      continue;
    }
    const hooks = getHooks(modifier);
    if (!hooks) {
      continue;
    }
    const hook = getHook(hooks);
    if (!hook) {
      continue;
    }
    nextState = hook({ ...context, modifier, state: nextState });
    nextState = consumeModifierUse(nextState, modifier.id);
  }
  return nextState;
};
var runMoveEvents = (state, context) => {
  return runModifierEvents(state, state.modifiers, (hooks) => hooks.onMove, context);
};

// packages/engine/src/player-flags.ts
var MOVED_THIS_ROUND_FLAG = "movedThisRound";
var CARDS_PLAYED_THIS_ROUND_FLAG = "cardsPlayedThisRound";
var CARDS_DISCARDED_THIS_ROUND_FLAG = "cardsDiscardedThisRound";
var readCardsPlayedThisRound = (player) => {
  const raw = player.flags[CARDS_PLAYED_THIS_ROUND_FLAG];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.floor(raw));
};
var readCardsDiscardedThisRound = (player) => {
  const raw = player.flags[CARDS_DISCARDED_THIS_ROUND_FLAG];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.floor(raw));
};
var hasPlayerMovedThisRound = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  return Boolean(player?.flags[MOVED_THIS_ROUND_FLAG]);
};
var markPlayerMovedThisRound = (state, playerId) => {
  const index = state.players.findIndex((entry) => entry.id === playerId);
  if (index < 0) {
    return state;
  }
  const player = state.players[index];
  if (player.flags[MOVED_THIS_ROUND_FLAG] === true) {
    return state;
  }
  const nextPlayers = [...state.players];
  nextPlayers[index] = {
    ...player,
    flags: {
      ...player.flags,
      [MOVED_THIS_ROUND_FLAG]: true
    }
  };
  return {
    ...state,
    players: nextPlayers
  };
};
var getCardsPlayedThisRound = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  return player ? readCardsPlayedThisRound(player) : 0;
};
var incrementCardsPlayedThisRound = (state, playerId, amount = 1) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const index = state.players.findIndex((entry) => entry.id === playerId);
  if (index < 0) {
    return state;
  }
  const player = state.players[index];
  const nextCount = readCardsPlayedThisRound(player) + Math.floor(amount);
  if (player.flags[CARDS_PLAYED_THIS_ROUND_FLAG] === nextCount) {
    return state;
  }
  const nextPlayers = [...state.players];
  nextPlayers[index] = {
    ...player,
    flags: {
      ...player.flags,
      [CARDS_PLAYED_THIS_ROUND_FLAG]: nextCount
    }
  };
  return {
    ...state,
    players: nextPlayers
  };
};
var incrementCardsDiscardedThisRound = (state, playerId, amount = 1) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const index = state.players.findIndex((entry) => entry.id === playerId);
  if (index < 0) {
    return state;
  }
  const player = state.players[index];
  const nextCount = readCardsDiscardedThisRound(player) + Math.floor(amount);
  if (player.flags[CARDS_DISCARDED_THIS_ROUND_FLAG] === nextCount) {
    return state;
  }
  const nextPlayers = [...state.players];
  nextPlayers[index] = {
    ...player,
    flags: {
      ...player.flags,
      [CARDS_DISCARDED_THIS_ROUND_FLAG]: nextCount
    }
  };
  return {
    ...state,
    players: nextPlayers
  };
};

// packages/engine/src/cards.ts
var getPlayer = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`player not found: ${playerId}`);
  }
  return player;
};
var updatePlayerDeck = (state, playerId, deckUpdate) => {
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? { ...player, deck: { ...player.deck, ...deckUpdate } } : player
    )
  };
};
var addPermanentVp = (state, playerId, amount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? {
        ...player,
        vp: {
          ...player.vp,
          permanent: player.vp.permanent + amount
        }
      } : player
    )
  };
};
var adjustGold = (state, playerId, delta) => {
  if (!Number.isFinite(delta) || delta === 0) {
    return state;
  }
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? {
        ...player,
        resources: {
          ...player.resources,
          gold: Math.max(0, player.resources.gold + delta)
        }
      } : player
    )
  };
};
var applyCardDrawEffects = (state, playerId, effects) => {
  if (!effects || effects.length === 0) {
    return state;
  }
  let nextState = state;
  for (const effect of effects) {
    switch (effect.kind) {
      case "gainGold": {
        const amount = typeof effect.amount === "number" ? Math.floor(effect.amount) : 0;
        if (amount > 0) {
          nextState = adjustGold(nextState, playerId, amount);
        }
        break;
      }
      case "loseGold": {
        const amount = typeof effect.amount === "number" ? Math.floor(effect.amount) : 0;
        if (amount > 0) {
          nextState = adjustGold(nextState, playerId, -amount);
        }
        break;
      }
      default:
        break;
    }
  }
  return nextState;
};
var applyCardDrawTriggers = (state, playerId, cardInstanceId, destination) => {
  const instance = state.cardsByInstanceId[cardInstanceId];
  if (!instance) {
    return state;
  }
  const context = {
    playerId,
    cardInstanceId,
    cardDefId: instance.defId,
    destination
  };
  let nextState = runModifierEvents(state, state.modifiers, (hooks) => hooks.onCardDraw, context);
  const cardDef = getCardDef(instance.defId);
  nextState = applyCardDrawEffects(nextState, playerId, cardDef?.onDraw);
  return nextState;
};
var createCardInstances = (state, defIds) => {
  let nextIndex = Object.keys(state.cardsByInstanceId).length + 1;
  const instanceIds = [];
  const cardsByInstanceId = { ...state.cardsByInstanceId };
  for (const defId of defIds) {
    const instanceId = `ci_${nextIndex}`;
    nextIndex += 1;
    cardsByInstanceId[instanceId] = { id: instanceId, defId };
    instanceIds.push(instanceId);
  }
  return {
    state: { ...state, cardsByInstanceId },
    instanceIds
  };
};
var createCardInstance = (state, defId) => {
  const { state: nextState, instanceIds } = createCardInstances(state, [defId]);
  return { state: nextState, instanceId: instanceIds[0] };
};
var shuffleCardIds = (state, cardIds) => {
  const { value, next } = shuffle(state.rngState, cardIds);
  return { state: { ...state, rngState: next }, cardIds: value };
};
var takeTopCards = (state, playerId, count) => {
  if (count <= 0) {
    return { state, cards: [] };
  }
  let nextState = state;
  const cards = [];
  for (let i = 0; i < count; i += 1) {
    let player = getPlayer(nextState, playerId);
    let { drawPile, discardPile } = player.deck;
    if (drawPile.length === 0) {
      if (discardPile.length === 0) {
        break;
      }
      const shuffled = shuffleCardIds(nextState, discardPile);
      nextState = updatePlayerDeck(shuffled.state, playerId, {
        drawPile: shuffled.cardIds,
        discardPile: []
      });
      player = getPlayer(nextState, playerId);
      ({ drawPile } = player.deck);
    }
    if (drawPile.length === 0) {
      break;
    }
    const [top, ...rest] = drawPile;
    cards.push(top);
    nextState = updatePlayerDeck(nextState, playerId, { drawPile: rest });
  }
  return { state: nextState, cards };
};
var insertCardIntoDrawPileRandom = (state, playerId, instanceId) => {
  const player = getPlayer(state, playerId);
  const { value: insertIndex, next } = randInt(
    state.rngState,
    0,
    player.deck.drawPile.length
  );
  const drawPile = player.deck.drawPile.slice();
  drawPile.splice(insertIndex, 0, instanceId);
  let nextState = updatePlayerDeck({ ...state, rngState: next }, playerId, { drawPile });
  const defId = state.cardsByInstanceId[instanceId]?.defId;
  const cardDef = defId ? getCardDef(defId) : void 0;
  if (cardDef?.type === "Victory") {
    const victoryPoints = cardDef.victoryPoints ?? 1;
    if (victoryPoints !== 0) {
      nextState = addPermanentVp(nextState, playerId, victoryPoints);
    }
  }
  return nextState;
};
var addCardToHandWithOverflow = (state, playerId, cardInstanceId) => {
  const player = getPlayer(state, playerId);
  if (player.deck.hand.length >= state.config.HAND_LIMIT) {
    const nextState2 = addCardToDiscardPile(state, playerId, cardInstanceId, {
      countAsDiscard: true
    });
    return applyCardDrawTriggers(nextState2, playerId, cardInstanceId, "discard");
  }
  const nextState = updatePlayerDeck(state, playerId, {
    hand: [...player.deck.hand, cardInstanceId]
  });
  return applyCardDrawTriggers(nextState, playerId, cardInstanceId, "hand");
};
var drawCards = (state, playerId, count) => {
  if (count <= 0) {
    return state;
  }
  let nextState = state;
  for (let i = 0; i < count; i += 1) {
    let player = getPlayer(nextState, playerId);
    let { drawPile, discardPile, hand } = player.deck;
    if (drawPile.length === 0) {
      if (discardPile.length === 0) {
        return nextState;
      }
      const shuffled = shuffleCardIds(nextState, discardPile);
      nextState = updatePlayerDeck(shuffled.state, playerId, {
        drawPile: shuffled.cardIds,
        discardPile: []
      });
      player = getPlayer(nextState, playerId);
      ({ drawPile, discardPile, hand } = player.deck);
    }
    if (drawPile.length === 0) {
      return nextState;
    }
    const [top, ...rest] = drawPile;
    if (hand.length >= nextState.config.HAND_LIMIT) {
      nextState = updatePlayerDeck(nextState, playerId, {
        drawPile: rest,
        discardPile,
        hand
      });
      nextState = addCardToDiscardPile(nextState, playerId, top, { countAsDiscard: true });
      nextState = applyCardDrawTriggers(nextState, playerId, top, "discard");
      player = getPlayer(nextState, playerId);
      ({ drawPile, discardPile, hand } = player.deck);
      continue;
    }
    hand = [...hand, top];
    nextState = updatePlayerDeck(nextState, playerId, {
      drawPile: rest,
      discardPile,
      hand
    });
    nextState = applyCardDrawTriggers(nextState, playerId, top, "hand");
  }
  return nextState;
};
var drawToHandSize = (state, playerId, targetHandSize) => {
  const player = getPlayer(state, playerId);
  const needed = Math.max(0, targetHandSize - player.deck.hand.length);
  return drawCards(state, playerId, needed);
};
var removeCardFromHand = (state, playerId, cardInstanceId) => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }
  const hand = player.deck.hand.filter((id) => id !== cardInstanceId);
  return updatePlayerDeck(state, playerId, { hand });
};
var discardCardFromHand = (state, playerId, cardInstanceId, options = { countAsDiscard: true }) => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }
  let nextState = removeCardFromHand(state, playerId, cardInstanceId);
  nextState = addCardToDiscardPile(nextState, playerId, cardInstanceId, options);
  return nextState;
};
var topdeckCardFromHand = (state, playerId, cardInstanceId) => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }
  const hand = player.deck.hand.filter((id) => id !== cardInstanceId);
  return updatePlayerDeck(state, playerId, {
    hand,
    drawPile: [cardInstanceId, ...player.deck.drawPile]
  });
};
var scrapCardFromHand = (state, playerId, cardInstanceId) => {
  const player = getPlayer(state, playerId);
  if (!player.deck.hand.includes(cardInstanceId)) {
    return state;
  }
  const hand = player.deck.hand.filter((id) => id !== cardInstanceId);
  return updatePlayerDeck(state, playerId, {
    hand,
    scrapped: [...player.deck.scrapped, cardInstanceId]
  });
};
var addCardToDiscardPile = (state, playerId, cardInstanceId, options = {}) => {
  const player = getPlayer(state, playerId);
  const nextState = updatePlayerDeck(state, playerId, {
    discardPile: [...player.deck.discardPile, cardInstanceId]
  });
  if (options.countAsDiscard) {
    return incrementCardsDiscardedThisRound(nextState, playerId);
  }
  return nextState;
};
var addCardToBurned = (state, playerId, cardInstanceId) => {
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? { ...player, burned: [...player.burned, cardInstanceId] } : player
    )
  };
};

// packages/engine/src/events.ts
var MAX_LOGS = 200;
var emit = (state, event) => {
  const logs = [...state.logs, event];
  if (logs.length <= MAX_LOGS) {
    return { ...state, logs };
  }
  return { ...state, logs: logs.slice(logs.length - MAX_LOGS) };
};

// packages/engine/src/faction-passives.ts
var buildModifierId = (factionId, playerId, key) => `faction.${factionId}.${playerId}.${key}`;
var createBastionShieldWallModifier = (playerId) => ({
  id: buildModifierId("bastion", playerId, "shield_wall"),
  source: { type: "faction", sourceId: "bastion" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getForceHitFaces: ({ modifier, unit, defenderPlayerId, round }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (defenderPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (round !== 1) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});
var createBastionHomeGuardModifier = (playerId) => ({
  id: buildModifierId("bastion", playerId, "home_guard"),
  source: { type: "faction", sourceId: "bastion" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getDeployForcesCount: ({ modifier, playerId: deployerId, hexKey, state }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== deployerId) {
        return current;
      }
      if (current <= 0) {
        return current;
      }
      const player = state.players.find((entry) => entry.id === deployerId);
      if (!player?.capitalHex || player.capitalHex !== hexKey) {
        return current;
      }
      return current + 1;
    }
  }
});
var createProspectOreCutModifier = (playerId) => ({
  id: buildModifierId("prospect", playerId, "ore_cut"),
  source: { type: "faction", sourceId: "prospect" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getMineGoldValue: ({ modifier, playerId: collectingPlayerId, mineValue }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== collectingPlayerId) {
        return current;
      }
      return current + 1;
    }
  }
});
var createProspectMineMilitiaModifier = (playerId) => ({
  id: buildModifierId("prospect", playerId, "mine_militia"),
  source: { type: "faction", sourceId: "prospect" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getForceHitFaces: ({ modifier, unit, defenderPlayerId, hexKey, state }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (defenderPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || hex.tile !== "mine") {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});
var createProspectDeepTunnelsModifier = (playerId) => ({
  id: buildModifierId("prospect", playerId, "deep_tunnels"),
  source: { type: "faction", sourceId: "prospect" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getMoveAdjacency: ({ modifier, playerId: movingPlayerId, from, to, state }, current) => {
      if (current) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
        return current;
      }
      const fromHex = state.board.hexes[from];
      const toHex = state.board.hexes[to];
      if (!fromHex || !toHex) {
        return current;
      }
      if (fromHex.tile !== "mine" || toHex.tile !== "mine") {
        return current;
      }
      if (!isOccupiedByPlayer(fromHex, movingPlayerId)) {
        return current;
      }
      if (!isOccupiedByPlayer(toHex, movingPlayerId)) {
        return current;
      }
      return true;
    }
  }
});
var createAerialTailwindModifier = (playerId) => ({
  id: buildModifierId("aerial", playerId, "tailwind"),
  source: { type: "faction", sourceId: "aerial" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getMoveMaxDistance: ({ modifier, playerId: movingPlayerId, state }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
        return current;
      }
      if (current <= 0) {
        return current;
      }
      if (hasPlayerMovedThisRound(state, movingPlayerId)) {
        return current;
      }
      return current + 1;
    }
  }
});
var createAerialWingsModifier = (playerId) => ({
  id: buildModifierId("aerial", playerId, "wings"),
  source: { type: "faction", sourceId: "aerial" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" }
});
var createCipherExpandedChoiceModifier = (playerId) => ({
  id: buildModifierId("cipher", playerId, "expanded_choice"),
  source: { type: "faction", sourceId: "cipher" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getCardChoiceCount: ({ modifier, playerId: choosingPlayerId }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== choosingPlayerId) {
        return current;
      }
      if (current <= 0) {
        return current;
      }
      return current + 1;
    }
  }
});
var createCipherQuietStudyModifier = (playerId) => ({
  id: buildModifierId("cipher", playerId, "quiet_study"),
  source: { type: "faction", sourceId: "cipher" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" }
});
var createVeilCleanExitModifier = (playerId) => ({
  id: buildModifierId("veil", playerId, "clean_exit"),
  source: { type: "faction", sourceId: "veil" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    afterBattle: ({ state, modifier, attackers, defenders }) => {
      const ownerId = modifier.ownerPlayerId;
      if (!ownerId) {
        return state;
      }
      const unitIds = /* @__PURE__ */ new Set([...attackers, ...defenders]);
      if (unitIds.size === 0) {
        return state;
      }
      let updatedUnits = null;
      for (const unitId of unitIds) {
        const unit = state.board.units[unitId];
        if (!unit || unit.kind !== "champion") {
          continue;
        }
        if (unit.ownerPlayerId !== ownerId) {
          continue;
        }
        const nextHp = Math.min(unit.maxHp, unit.hp + 1);
        if (nextHp === unit.hp) {
          continue;
        }
        if (!updatedUnits) {
          updatedUnits = { ...state.board.units };
        }
        updatedUnits[unitId] = {
          ...unit,
          hp: nextHp
        };
      }
      if (!updatedUnits) {
        return state;
      }
      return {
        ...state,
        board: {
          ...state.board,
          units: updatedUnits
        }
      };
    }
  }
});
var createVeilContractsModifier = (playerId) => ({
  id: buildModifierId("veil", playerId, "contracts"),
  source: { type: "faction", sourceId: "veil" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getChampionKillBonusGold: ({ modifier, killerPlayerId, killedChampions }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== killerPlayerId) {
        return current;
      }
      if (killedChampions.length === 0) {
        return current;
      }
      return current + killedChampions.length * 2;
    }
  }
});
var createGatewrightCapitalAssaultModifier = (playerId) => ({
  id: buildModifierId("gatewright", playerId, "capital_assault"),
  source: { type: "faction", sourceId: "gatewright" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getForceHitFaces: ({ modifier, unit, hexKey, state }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || hex.tile !== "capital") {
        return current;
      }
      if (!hex.ownerPlayerId || hex.ownerPlayerId === unit.ownerPlayerId) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});
var createGatewrightCapitalVpBonusModifier = (playerId) => ({
  id: buildModifierId("gatewright", playerId, "capital_vp_bonus"),
  source: { type: "faction", sourceId: "gatewright" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    getControlValue: ({ modifier, playerId: occupantId, hexKey, tile, state }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== occupantId) {
        return current;
      }
      if (tile !== "capital") {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || !hex.ownerPlayerId || hex.ownerPlayerId === occupantId) {
        return current;
      }
      return Math.max(current, 2);
    }
  }
});
var createGatewrightExtortionistsModifier = (playerId) => ({
  id: buildModifierId("gatewright", playerId, "extortionists"),
  source: { type: "faction", sourceId: "gatewright" },
  ownerPlayerId: playerId,
  duration: { type: "permanent" },
  hooks: {
    afterBattle: ({ state, modifier, winnerPlayerId, attackerPlayerId, defenderPlayerId }) => {
      const ownerId = modifier.ownerPlayerId;
      if (!ownerId || winnerPlayerId !== ownerId) {
        return state;
      }
      const loserId = winnerPlayerId === attackerPlayerId ? defenderPlayerId : attackerPlayerId;
      const loser = state.players.find((player) => player.id === loserId);
      if (!loser) {
        return state;
      }
      const steal = Math.min(2, loser.resources.gold);
      if (steal <= 0) {
        return state;
      }
      const nextPlayers = state.players.map((player) => {
        if (player.id === loserId) {
          return {
            ...player,
            resources: {
              ...player.resources,
              gold: player.resources.gold - steal
            }
          };
        }
        if (player.id === ownerId) {
          return {
            ...player,
            resources: {
              ...player.resources,
              gold: player.resources.gold + steal
            }
          };
        }
        return player;
      });
      return {
        ...state,
        players: nextPlayers
      };
    }
  }
});
var createFactionModifiers = (factionId, playerId) => {
  switch (factionId) {
    case "bastion":
      return [
        createBastionShieldWallModifier(playerId),
        createBastionHomeGuardModifier(playerId)
      ];
    case "veil":
      return [createVeilCleanExitModifier(playerId), createVeilContractsModifier(playerId)];
    case "prospect":
      return [
        createProspectOreCutModifier(playerId),
        createProspectMineMilitiaModifier(playerId),
        createProspectDeepTunnelsModifier(playerId)
      ];
    case "aerial":
      return [createAerialTailwindModifier(playerId), createAerialWingsModifier(playerId)];
    case "cipher":
      return [
        createCipherExpandedChoiceModifier(playerId),
        createCipherQuietStudyModifier(playerId)
      ];
    case "gatewright":
      return [
        createGatewrightCapitalAssaultModifier(playerId),
        createGatewrightCapitalVpBonusModifier(playerId),
        createGatewrightExtortionistsModifier(playerId)
      ];
    default:
      return [];
  }
};
var hasAerialWings = (state, playerId) => {
  const targetId = buildModifierId("aerial", playerId, "wings");
  return state.modifiers.some((modifier) => modifier.id === targetId);
};
var hasCipherQuietStudy = (state, playerId) => {
  const targetId = buildModifierId("cipher", playerId, "quiet_study");
  return state.modifiers.some((modifier) => modifier.id === targetId);
};
var addFactionModifiers = (state, playerId, factionId) => {
  const modifiers = createFactionModifiers(factionId, playerId);
  if (modifiers.length === 0) {
    return state;
  }
  const existing = new Set(state.modifiers.map((modifier) => modifier.id));
  const nextModifiers = [...state.modifiers];
  for (const modifier of modifiers) {
    if (!existing.has(modifier.id)) {
      nextModifiers.push(modifier);
    }
  }
  if (nextModifiers.length === state.modifiers.length) {
    return state;
  }
  return { ...state, modifiers: nextModifiers };
};

// packages/engine/src/units.ts
var normalizeForceCount = (forceCount, options) => {
  if (typeof forceCount !== "number" || !Number.isFinite(forceCount)) {
    return null;
  }
  const normalized = Math.floor(forceCount);
  if (normalized > 0) {
    return normalized;
  }
  if (options?.allowZero && normalized === 0) {
    return 0;
  }
  return null;
};
var getForceUnitsAtHex = (board, playerId, hexKey) => {
  const hex = board.hexes[hexKey];
  if (!hex) {
    return [];
  }
  const occupants = hex.occupants[playerId] ?? [];
  const forceUnits = [];
  for (const unitId of occupants) {
    if (board.units[unitId]?.kind === "force") {
      forceUnits.push(unitId);
    }
  }
  return forceUnits;
};
var getChampionUnitsAtHex = (board, playerId, hexKey) => {
  const hex = board.hexes[hexKey];
  if (!hex) {
    return [];
  }
  const occupants = hex.occupants[playerId] ?? [];
  const championUnits = [];
  for (const unitId of occupants) {
    if (board.units[unitId]?.kind === "champion") {
      championUnits.push(unitId);
    }
  }
  return championUnits;
};
var selectMovingUnits = (board, playerId, from, forceCount, includeChampions) => {
  const fromHex = board.hexes[from];
  if (!fromHex) {
    return [];
  }
  const occupants = fromHex.occupants[playerId] ?? [];
  const include = typeof includeChampions === "boolean" ? includeChampions : forceCount == null;
  if (forceCount === void 0 || forceCount === null) {
    return include ? occupants : getForceUnitsAtHex(board, playerId, from);
  }
  const normalized = normalizeForceCount(forceCount, { allowZero: include });
  if (normalized === null) {
    return [];
  }
  const forceUnits = getForceUnitsAtHex(board, playerId, from);
  if (forceUnits.length < normalized) {
    return [];
  }
  const selectedForces = forceUnits.slice(0, normalized);
  if (!include) {
    return selectedForces;
  }
  const championUnits = getChampionUnitsAtHex(board, playerId, from);
  return [...selectedForces, ...championUnits];
};
var addForcesToHex = (board, playerId, hexKey, count) => {
  if (count <= 0) {
    return board;
  }
  const hex = board.hexes[hexKey];
  if (!hex) {
    throw new Error("hex does not exist");
  }
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
  const newUnitIds = [];
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
          [playerId]: [...hex.occupants[playerId] ?? [], ...newUnitIds]
        }
      }
    }
  };
};
var countPlayerChampions = (board, playerId) => {
  return Object.values(board.units).filter(
    (unit) => unit.kind === "champion" && unit.ownerPlayerId === playerId
  ).length;
};
var addChampionToHex = (board, playerId, hexKey, champion) => {
  const hex = board.hexes[hexKey];
  if (!hex) {
    throw new Error("hex does not exist");
  }
  let maxChampionIndex = 0;
  for (const unitId2 of Object.keys(board.units)) {
    if (!unitId2.startsWith("c_")) {
      continue;
    }
    const parsed = Number(unitId2.slice(2));
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
            [playerId]: [...hex.occupants[playerId] ?? [], unitId]
          }
        }
      }
    },
    unitId
  };
};
var moveUnitToHex = (board, unitId, to) => {
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
var moveStack = (board, playerId, from, to, forceCount, includeChampions) => {
  if (from === to) {
    return board;
  }
  const fromHex = board.hexes[from];
  const toHex = board.hexes[to];
  if (!fromHex || !toHex) {
    return board;
  }
  const movingUnits = selectMovingUnits(
    board,
    playerId,
    from,
    forceCount,
    includeChampions
  );
  if (movingUnits.length === 0) {
    return board;
  }
  const movingSet = new Set(movingUnits);
  const fromUnits = fromHex.occupants[playerId] ?? [];
  const remainingUnits = fromUnits.filter((unitId) => !movingSet.has(unitId));
  const toUnits = [...toHex.occupants[playerId] ?? [], ...movingUnits];
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

// packages/engine/src/setup-flow.ts
var withUpdatedPlayer = (state, playerId, update) => {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? update(player) : player)
  };
};
var getCapitalDraftWaitingFor = (players, choices) => {
  return players.map((player) => player.id).filter((playerId) => !choices[playerId]);
};
var getStartingBridgeWaitingFor = (players, remaining) => {
  return players.map((player) => player.id).filter((playerId) => (remaining[playerId] ?? 0) > 0);
};
var getFreeStartingCardWaitingFor = (players, chosen) => {
  return players.map((player) => player.id).filter((playerId) => !chosen[playerId]);
};
var createCapitalDraftBlock = (players, availableSlots) => ({
  type: "setup.capitalDraft",
  waitingFor: players.map((player) => player.id),
  payload: {
    availableSlots,
    choices: Object.fromEntries(players.map((player) => [player.id, null]))
  }
});
var createDeckPreviewBlock = () => ({
  type: "setup.deckPreview",
  waitingFor: [],
  payload: {}
});
var createStartingBridgesBlock = (players) => ({
  type: "setup.startingBridges",
  waitingFor: players.map((player) => player.id),
  payload: {
    remaining: Object.fromEntries(players.map((player) => [player.id, 2])),
    selectedEdges: Object.fromEntries(players.map((player) => [player.id, []]))
  }
});
var createFreeStartingCardBlock = (state) => {
  const pool = state.config.freeStartingCardPool;
  const baseOfferCount = 3;
  const offerCounts = state.players.map((player) => {
    const rawCount = getCardChoiceCount(
      state,
      { playerId: player.id, kind: "freeStartingCard", baseCount: baseOfferCount },
      baseOfferCount
    );
    const normalized = Number.isFinite(rawCount) ? Math.floor(rawCount) : baseOfferCount;
    return {
      playerId: player.id,
      count: Math.max(baseOfferCount, normalized)
    };
  });
  const maxOfferCount = offerCounts.reduce(
    (max, entry) => Math.max(max, entry.count),
    baseOfferCount
  );
  if (pool.length < maxOfferCount) {
    throw new Error(`freeStartingCardPool must contain at least ${maxOfferCount} cards`);
  }
  let rngState = state.rngState;
  const deck = [];
  const minCards = offerCounts.reduce((total, entry) => total + entry.count, 0);
  while (deck.length < minCards) {
    deck.push(...pool);
  }
  const { value: shuffledDeck, next: shuffledState } = shuffle(rngState, deck);
  rngState = shuffledState;
  const offers = {};
  let remainingDeck = shuffledDeck.slice();
  for (const entry of offerCounts) {
    const offer = remainingDeck.slice(0, entry.count);
    if (offer.length < entry.count) {
      throw new Error("freeStartingCardPool must have enough cards for all players");
    }
    offers[entry.playerId] = offer;
    remainingDeck = remainingDeck.slice(entry.count);
  }
  return {
    state: { ...state, rngState },
    block: {
      type: "setup.freeStartingCardPick",
      waitingFor: state.players.map((player) => player.id),
      payload: {
        offers,
        chosen: Object.fromEntries(state.players.map((player) => [player.id, null])),
        remainingDeck
      }
    }
  };
};
var initializeStartingAssets = (state) => {
  let nextState = state;
  const playerIds = state.players.map((player) => player.id);
  for (const playerId of playerIds) {
    const player = nextState.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error(`player not found: ${playerId}`);
    }
    if (!player.capitalHex) {
      throw new Error("player has no capital to place starting forces");
    }
    nextState = {
      ...nextState,
      board: addForcesToHex(nextState.board, playerId, player.capitalHex, 4)
    };
    const starter = resolveStarterFactionCards(player.factionId);
    let workingState = nextState;
    if (starter.factionId !== player.factionId) {
      workingState = withUpdatedPlayer(workingState, playerId, (entry) => ({
        ...entry,
        factionId: starter.factionId
      }));
    }
    workingState = addFactionModifiers(workingState, playerId, starter.factionId);
    const { state: withDeckCards, instanceIds: deckInstances } = createCardInstances(
      workingState,
      [...starter.deck, starter.starterSpellId]
    );
    const { state: withChampion, instanceIds: championInstances } = createCardInstances(
      withDeckCards,
      [starter.championId]
    );
    const championInstanceId = championInstances[0];
    const shuffled = shuffleCardIds(withChampion, deckInstances);
    let updatedState = withUpdatedPlayer(shuffled.state, playerId, (entry) => ({
      ...entry,
      deck: {
        drawPile: shuffled.cardIds,
        discardPile: [],
        hand: [championInstanceId],
        scrapped: []
      }
    }));
    updatedState = drawToHandSize(updatedState, playerId, 6);
    nextState = updatedState;
  }
  return nextState;
};
var finalizeCapitalDraft = (state) => {
  const capitalHexes = state.players.map((player) => {
    if (!player.capitalHex) {
      throw new Error("player missing capital after draft");
    }
    return player.capitalHex;
  });
  const uniqueCapitals = new Set(capitalHexes);
  if (uniqueCapitals.size !== capitalHexes.length) {
    throw new Error("capital draft resulted in duplicate capitals");
  }
  const tileCounts = state.config.tileCountsByPlayerCount[state.players.length];
  if (!tileCounts) {
    throw new Error("missing tile counts for player count");
  }
  const placement = placeSpecialTiles(state.board, state.rngState, {
    capitalHexes,
    forgeCount: tileCounts.forges,
    mineCount: tileCounts.mines,
    rules: state.config.boardGenerationRules
  });
  const bridged = placeRandomBridges(placement.board, placement.rngState, {
    capitalHexes,
    count: tileCounts.randomBridges,
    rules: state.config.boardGenerationRules
  });
  const nextState = {
    ...state,
    board: bridged.board,
    rngState: bridged.rngState
  };
  return initializeStartingAssets(nextState);
};
var finalizeStartingBridges = (state) => {
  const block = state.blocks;
  if (!block || block.type !== "setup.startingBridges") {
    return state;
  }
  const selectedEdges = block.payload.selectedEdges;
  const existing = new Set(Object.keys(state.board.bridges));
  const nextBridges = { ...state.board.bridges };
  const events = [];
  for (const player of state.players) {
    const edges = selectedEdges[player.id] ?? [];
    for (const edgeKey of edges) {
      const [rawA, rawB] = parseEdgeKey(edgeKey);
      const canonical = getBridgeKey(rawA, rawB);
      const alreadyExists = existing.has(canonical);
      if (!alreadyExists) {
        existing.add(canonical);
        nextBridges[canonical] = {
          key: canonical,
          from: rawA,
          to: rawB,
          ownerPlayerId: player.id
        };
      }
      events.push({
        type: "setup.startingBridgePlaced",
        payload: { playerId: player.id, edgeKey: canonical, alreadyExists }
      });
    }
  }
  let nextState = {
    ...state,
    board: {
      ...state.board,
      bridges: nextBridges
    }
  };
  for (const event of events) {
    nextState = emit(nextState, event);
  }
  return nextState;
};
var finalizeFreeStartingCardPick = (state) => {
  const block = state.blocks;
  if (!block || block.type !== "setup.freeStartingCardPick") {
    return state;
  }
  let nextState = state;
  let remainingDeck = [...block.payload.remainingDeck];
  for (const player of state.players) {
    const chosen = block.payload.chosen[player.id];
    if (!chosen) {
      throw new Error("player missing free starting card choice");
    }
    const offers = block.payload.offers[player.id] ?? [];
    const unchosen = offers.filter((cardId) => cardId !== chosen);
    if (unchosen.length > 0) {
      const { value: returnedCards, next } = shuffle(nextState.rngState, unchosen);
      remainingDeck = [...remainingDeck, ...returnedCards];
      nextState = { ...nextState, rngState: next };
    }
    const { state: stateWithCard, instanceId } = createCardInstance(nextState, chosen);
    nextState = insertCardIntoDrawPileRandom(stateWithCard, player.id, instanceId);
  }
  return {
    ...nextState,
    blocks: {
      ...block,
      payload: {
        ...block.payload,
        remainingDeck
      }
    }
  };
};
var applySetupChoice = (state, choice, playerId) => {
  const block = state.blocks;
  if (!block) {
    throw new Error("no active block to accept setup choice");
  }
  if (block.type === "setup.capitalDraft") {
    if (choice.kind === "unlockCapital") {
      const pickedHex = block.payload.choices[playerId];
      if (!pickedHex) {
        throw new Error("player has no capital to unlock");
      }
      const hex2 = state.board.hexes[pickedHex];
      if (!hex2) {
        throw new Error("capital hex does not exist");
      }
      const updatedBoard2 = {
        ...state.board,
        hexes: {
          ...state.board.hexes,
          [pickedHex]: {
            ...hex2,
            tile: hex2.tile === "capital" ? "normal" : hex2.tile,
            ownerPlayerId: void 0
          }
        }
      };
      const updatedState2 = withUpdatedPlayer(state, playerId, (player) => ({
        ...player,
        capitalHex: void 0
      }));
      const updatedChoices2 = { ...block.payload.choices, [playerId]: null };
      const nextState2 = {
        ...updatedState2,
        board: updatedBoard2,
        blocks: {
          ...block,
          waitingFor: getCapitalDraftWaitingFor(state.players, updatedChoices2),
          payload: {
            ...block.payload,
            choices: updatedChoices2
          }
        }
      };
      return emit(nextState2, {
        type: "setup.capitalUnlocked",
        payload: { playerId, hexKey: pickedHex }
      });
    }
    if (choice.kind !== "pickCapital") {
      throw new Error("expected pickCapital during capital draft");
    }
    if (block.payload.choices[playerId]) {
      throw new Error("player already locked a capital");
    }
    const hexKey = choice.hexKey;
    if (!block.payload.availableSlots.includes(hexKey)) {
      throw new Error("invalid capital slot");
    }
    if (Object.values(block.payload.choices).includes(hexKey)) {
      throw new Error("capital slot already taken");
    }
    const hex = state.board.hexes[hexKey];
    if (!hex) {
      throw new Error("capital hex does not exist");
    }
    if (hex.tile === "capital") {
      throw new Error("hex already marked as capital");
    }
    const updatedBoard = {
      ...state.board,
      hexes: {
        ...state.board.hexes,
        [hexKey]: {
          ...hex,
          tile: "capital",
          ownerPlayerId: playerId
        }
      }
    };
    const updatedState = withUpdatedPlayer(state, playerId, (player) => {
      if (player.capitalHex) {
        throw new Error("player already has a capital");
      }
      return { ...player, capitalHex: hexKey };
    });
    const updatedChoices = { ...block.payload.choices, [playerId]: hexKey };
    const nextState = {
      ...updatedState,
      board: updatedBoard,
      blocks: {
        ...block,
        waitingFor: getCapitalDraftWaitingFor(state.players, updatedChoices),
        payload: {
          ...block.payload,
          choices: updatedChoices
        }
      }
    };
    return emit(nextState, {
      type: "setup.capitalPicked",
      payload: { playerId, hexKey }
    });
  }
  if (block.type === "setup.startingBridges") {
    if (choice.kind === "removeStartingBridge") {
      const [rawA2, rawB2] = parseEdgeKey(choice.edgeKey);
      const edgeKey2 = getBridgeKey(rawA2, rawB2);
      const selected = block.payload.selectedEdges[playerId] ?? [];
      if (!selected.includes(edgeKey2)) {
        throw new Error("starting bridge not selected by player");
      }
      const nextSelected2 = {
        ...block.payload.selectedEdges,
        [playerId]: selected.filter((edge) => edge !== edgeKey2)
      };
      const nextRemaining2 = {
        ...block.payload.remaining,
        [playerId]: Math.min(2, (block.payload.remaining[playerId] ?? 0) + 1)
      };
      return {
        ...state,
        blocks: {
          ...block,
          waitingFor: getStartingBridgeWaitingFor(state.players, nextRemaining2),
          payload: {
            remaining: nextRemaining2,
            selectedEdges: nextSelected2
          }
        }
      };
    }
    if (choice.kind !== "placeStartingBridge") {
      throw new Error("expected placeStartingBridge during starting bridge placement");
    }
    if (!block.waitingFor.includes(playerId)) {
      throw new Error("player has already placed starting bridges");
    }
    const remaining = block.payload.remaining[playerId];
    if (!remaining || remaining <= 0) {
      throw new Error("no remaining starting bridges to place");
    }
    const [rawA, rawB] = parseEdgeKey(choice.edgeKey);
    const edgeKey = getBridgeKey(rawA, rawB);
    if (!state.board.hexes[rawA] || !state.board.hexes[rawB]) {
      throw new Error("bridge endpoints must be on the board");
    }
    const dist = axialDistance(parseHexKey(rawA), parseHexKey(rawB));
    if (dist !== 1) {
      throw new Error("bridge endpoints must be adjacent");
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      throw new Error("player has no capital to anchor starting bridge");
    }
    const capitalCoord = parseHexKey(player.capitalHex);
    const withinRange = axialDistance(capitalCoord, parseHexKey(rawA)) <= 2 || axialDistance(capitalCoord, parseHexKey(rawB)) <= 2;
    if (!withinRange) {
      throw new Error("starting bridge must touch within distance 2 of capital");
    }
    if (block.payload.selectedEdges[playerId].includes(edgeKey)) {
      throw new Error("starting bridge already selected by player");
    }
    const nextRemaining = {
      ...block.payload.remaining,
      [playerId]: remaining - 1
    };
    const nextSelected = {
      ...block.payload.selectedEdges,
      [playerId]: [...block.payload.selectedEdges[playerId], edgeKey]
    };
    const nextState = {
      ...state,
      blocks: {
        ...block,
        waitingFor: getStartingBridgeWaitingFor(state.players, nextRemaining),
        payload: {
          remaining: nextRemaining,
          selectedEdges: nextSelected
        }
      }
    };
    return nextState;
  }
  if (block.type === "setup.freeStartingCardPick") {
    if (choice.kind === "unpickFreeStartingCard") {
      if (!block.payload.chosen[playerId]) {
        throw new Error("player has no free starting card to unpick");
      }
      const nextChosen2 = { ...block.payload.chosen, [playerId]: null };
      return {
        ...state,
        blocks: {
          ...block,
          waitingFor: getFreeStartingCardWaitingFor(state.players, nextChosen2),
          payload: {
            ...block.payload,
            chosen: nextChosen2
          }
        }
      };
    }
    if (choice.kind !== "pickFreeStartingCard") {
      throw new Error("expected pickFreeStartingCard during free starting card pick");
    }
    const offers = block.payload.offers[playerId];
    if (!offers || !offers.includes(choice.cardId)) {
      throw new Error("card is not in player's offer");
    }
    const alreadyChosen = block.payload.chosen[playerId] ?? null;
    if (!block.waitingFor.includes(playerId) && !alreadyChosen) {
      throw new Error("player already picked a free starting card");
    }
    if (alreadyChosen === choice.cardId) {
      return state;
    }
    const nextChosen = {
      ...block.payload.chosen,
      [playerId]: choice.cardId
    };
    const nextState = {
      ...state,
      blocks: {
        ...block,
        waitingFor: getFreeStartingCardWaitingFor(state.players, nextChosen),
        payload: {
          ...block.payload,
          chosen: nextChosen
        }
      }
    };
    return emit(nextState, {
      type: "setup.freeStartingCardPicked",
      payload: { playerId, cardId: choice.cardId }
    });
  }
  return state;
};

// packages/engine/src/rewards.ts
var MARK_FOR_COIN_CARD_ID = "faction.veil.marked_for_coin";
var addGold = (state, playerId, amount) => {
  if (amount <= 0) {
    return state;
  }
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + amount
        }
      } : player
    )
  };
};
var transferGold = (state, fromPlayerId, toPlayerId, amount) => {
  if (amount <= 0 || fromPlayerId === toPlayerId) {
    return state;
  }
  let changed = false;
  const nextPlayers = state.players.map((player) => {
    if (player.id === fromPlayerId) {
      if (player.resources.gold === 0) {
        return player;
      }
      const nextGold = Math.max(0, player.resources.gold - amount);
      if (nextGold === player.resources.gold) {
        return player;
      }
      changed = true;
      return {
        ...player,
        resources: {
          ...player.resources,
          gold: nextGold
        }
      };
    }
    if (player.id === toPlayerId) {
      changed = true;
      return {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + amount
        }
      };
    }
    return player;
  });
  return changed ? { ...state, players: nextPlayers } : state;
};
var applyMarkedForCoinRewards = (state, context) => {
  if (context.killedChampions.length === 0) {
    return state;
  }
  const killedIds = new Set(context.killedChampions.map((champion) => champion.id));
  const bonusByPlayer = {};
  const removed = /* @__PURE__ */ new Set();
  for (const modifier of state.modifiers) {
    if (modifier.source.type !== "card" || modifier.source.sourceId !== MARK_FOR_COIN_CARD_ID) {
      continue;
    }
    const ownerId = modifier.ownerPlayerId;
    if (!ownerId) {
      continue;
    }
    const markedId = modifier.attachedUnitId ?? modifier.data?.markedUnitId;
    if (typeof markedId !== "string" || !killedIds.has(markedId)) {
      continue;
    }
    const bonusRaw = modifier.data?.bonusGold;
    const bonus = typeof bonusRaw === "number" ? Math.max(0, bonusRaw) : 0;
    if (bonus <= 0) {
      removed.add(modifier.id);
      continue;
    }
    removed.add(modifier.id);
    bonusByPlayer[ownerId] = (bonusByPlayer[ownerId] ?? 0) + bonus;
  }
  let nextState = state;
  if (removed.size > 0) {
    nextState = {
      ...nextState,
      modifiers: nextState.modifiers.filter((modifier) => !removed.has(modifier.id))
    };
  }
  for (const [playerId, amount] of Object.entries(bonusByPlayer)) {
    if (amount > 0) {
      nextState = addGold(nextState, playerId, amount);
    }
  }
  return nextState;
};
var applyChampionKillRewards = (state, context) => {
  if (context.killedChampions.length === 0) {
    return state;
  }
  let nextState = state;
  if (context.killerPlayerId !== context.victimPlayerId) {
    const bonus = getChampionKillBonusGold(nextState, context, 0);
    const steal = getChampionKillStealGold(nextState, context, 0);
    const total = context.bounty + bonus;
    if (total > 0) {
      nextState = addGold(nextState, context.killerPlayerId, total);
    }
    if (steal > 0) {
      const victim = nextState.players.find((player) => player.id === context.victimPlayerId);
      const available = victim?.resources.gold ?? 0;
      const stealAmount = Math.min(steal, available);
      if (stealAmount > 0) {
        nextState = transferGold(
          nextState,
          context.victimPlayerId,
          context.killerPlayerId,
          stealAmount
        );
      }
    }
  }
  return applyMarkedForCoinRewards(nextState, context);
};

// packages/engine/src/champions.ts
var BODYGUARD_CHAMPION_ID = "champion.bastion.ironclad_warden";
var ASSASSINS_EDGE_CHAMPION_ID = "champion.veil.shadeblade";
var FLIGHT_CHAMPION_ID = "champion.aerial.skystriker_ace";
var ARCHIVIST_PRIME_CHAMPION_ID = "champion.cipher.archivist_prime";
var WORMHOLE_ARTIFICER_CHAMPION_ID = "champion.gatewright.wormhole_artificer";
var SKIRMISHER_CAPTAIN_CHAMPION_ID = "champion.age1.skirmisher_captain";
var BRIDGE_RUNNER_CHAMPION_ID = "champion.age1.bridge_runner";
var INSPIRING_GEEZER_CHAMPION_ID = "champion.age1.inspiring_geezer";
var FIELD_SURGEON_CHAMPION_ID = "champion.age1.field_surgeon";
var BRUTE_CHAMPION_ID = "champion.age1.brute";
var BOUNTY_HUNTER_CHAMPION_ID = "champion.age1.bounty_hunter";
var TRAITOR_CHAMPION_ID = "champion.age1.traitor";
var DUELIST_EXEMPLAR_CHAMPION_ID = "champion.age2.duelist_exemplar";
var LONE_WOLF_CHAMPION_ID = "champion.age2.lone_wolf";
var RELIABLE_VETERAN_CHAMPION_ID = "champion.age2.reliable_veteran";
var SIEGE_ENGINEER_CHAMPION_ID = "champion.age2.siege_engineer";
var CAPTURER_CHAMPION_ID = "champion.age2.capturer";
var TAX_REAVER_CHAMPION_ID = "champion.age2.tax_reaver";
var BLOOD_BANKER_CHAMPION_ID = "champion.age3.blood_banker";
var STORMCALLER_CHAMPION_ID = "champion.age3.stormcaller";
var GRAND_STRATEGIST_CHAMPION_ID = "champion.age3.grand_strategist";
var CAPITAL_BREAKER_CHAMPION_ID = "champion.age3.capital_breaker";
var BANNERMAN_CHAMPION_ID = "champion.power.bannerman";
var CENTER_BANNERMAN_CHAMPION_ID = "champion.age3.center_bannerman";
var ASSASSINS_EDGE_KEY = "assassins_edge";
var STITCHWORK_KEY = "stitchwork";
var BLOOD_LEDGER_KEY = "blood_ledger";
var TEMPEST_KEY = "tempest";
var TACTICAL_HAND_KEY = "tactical_hand";
var BRIDGE_BYPASS_CHAMPION_IDS = /* @__PURE__ */ new Set([FLIGHT_CHAMPION_ID, BRIDGE_RUNNER_CHAMPION_ID]);
var PER_ROUND_ABILITY_USES = {
  [ASSASSINS_EDGE_CHAMPION_ID]: {
    [ASSASSINS_EDGE_KEY]: 1
  },
  [FIELD_SURGEON_CHAMPION_ID]: {
    [STITCHWORK_KEY]: 1
  },
  [BLOOD_BANKER_CHAMPION_ID]: {
    [BLOOD_LEDGER_KEY]: 1
  },
  [STORMCALLER_CHAMPION_ID]: {
    [TEMPEST_KEY]: 1
  },
  [GRAND_STRATEGIST_CHAMPION_ID]: {
    [TACTICAL_HAND_KEY]: 1
  }
};
var buildChampionModifierId = (unitId, key) => `champion.${unitId}.${key}`;
var getModifierUnitId = (modifier) => {
  const unitId = modifier.data?.unitId;
  return typeof unitId === "string" && unitId.length > 0 ? unitId : null;
};
var getPerRoundAbilityUses = (cardDefId) => {
  return PER_ROUND_ABILITY_USES[cardDefId] ?? null;
};
var buildAbilityUses = (cardDefId) => {
  const perRound = getPerRoundAbilityUses(cardDefId);
  if (!perRound) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(perRound).map(([key, count]) => [key, { remaining: count }])
  );
};
var setChampionAbilityUses = (state, unitId, abilityUses) => {
  if (Object.keys(abilityUses).length === 0) {
    return state;
  }
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  return {
    ...state,
    board: {
      ...state.board,
      units: {
        ...state.board.units,
        [unitId]: {
          ...unit,
          abilityUses: {
            ...unit.abilityUses,
            ...abilityUses
          }
        }
      }
    }
  };
};
var getChampionAbilityRemaining = (unit, key) => {
  if (unit.kind !== "champion") {
    return 0;
  }
  const current = unit.abilityUses[key]?.remaining;
  if (typeof current === "number") {
    return current;
  }
  const perRound = getPerRoundAbilityUses(unit.cardDefId)?.[key];
  return typeof perRound === "number" ? perRound : 0;
};
var canChampionUseAbility = (unit, key) => getChampionAbilityRemaining(unit, key) > 0;
var consumeChampionAbilityUse = (state, unitId, key) => {
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  const remaining = getChampionAbilityRemaining(unit, key);
  if (remaining <= 0) {
    return state;
  }
  return setChampionAbilityUses(state, unitId, {
    [key]: { remaining: remaining - 1 }
  });
};
var createBodyguardModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "bodyguard"),
  source: { type: "champion", sourceId: BODYGUARD_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId, bodyguard: true },
  hooks: {
    getHitAssignmentPolicy: ({ modifier, targetUnitIds, state }, current) => {
      if (current === "bodyguard") {
        return current;
      }
      const guardId = getModifierUnitId(modifier);
      if (!guardId) {
        return current;
      }
      if (!targetUnitIds.includes(guardId)) {
        return current;
      }
      const hasForce = targetUnitIds.some(
        (targetId) => state.board.units[targetId]?.kind === "force"
      );
      if (!hasForce) {
        return current;
      }
      return "bodyguard";
    }
  }
});
var createAssassinsEdgeModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "assassins_edge"),
  source: { type: "champion", sourceId: ASSASSINS_EDGE_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    beforeCombatRound: ({ state, modifier, round, attackers, defenders }) => {
      if (round !== 1) {
        return state;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (!canChampionUseAbility(sourceUnit, ASSASSINS_EDGE_KEY)) {
        return state;
      }
      const onAttackers = attackers.includes(sourceUnitId);
      const onDefenders = defenders.includes(sourceUnitId);
      if (!onAttackers && !onDefenders) {
        return state;
      }
      const enemyUnitIds = (onAttackers ? defenders : attackers).filter((enemyId) => {
        const unit = state.board.units[enemyId];
        return unit?.kind === "champion";
      });
      if (enemyUnitIds.length === 0) {
        return state;
      }
      const pick = randInt(state.rngState, 0, enemyUnitIds.length - 1);
      const targetId = enemyUnitIds[pick.value] ?? enemyUnitIds[0];
      let nextState = {
        ...state,
        rngState: pick.next
      };
      nextState = consumeChampionAbilityUse(nextState, sourceUnitId, ASSASSINS_EDGE_KEY);
      return dealChampionDamage(nextState, sourceUnit.ownerPlayerId, targetId, 1);
    }
  }
});
var createBridgeBypassModifier = (unitId, ownerPlayerId, sourceId) => ({
  id: buildChampionModifierId(unitId, "bridge_bypass"),
  source: { type: "champion", sourceId },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getMoveRequiresBridge: ({ modifier, movingUnitIds, state }, current) => {
      if (!current) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      if (!movingUnitIds.includes(sourceUnitId)) {
        return current;
      }
      if (movingUnitIds.length === 0) {
        return current;
      }
      const movingUnits = movingUnitIds.map((id) => state.board.units[id]).filter(Boolean);
      if (movingUnits.some((unit) => unit?.kind !== "champion")) {
        return current;
      }
      if (movingUnits.some(
        (unit) => unit?.kind === "champion" && !BRIDGE_BYPASS_CHAMPION_IDS.has(unit.cardDefId)
      )) {
        return current;
      }
      return false;
    }
  }
});
var createArchivistPrimeModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "archivist_prime"),
  source: { type: "champion", sourceId: ARCHIVIST_PRIME_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const bonus = getCardsPlayedThisRound(state, unit.ownerPlayerId);
      return bonus > 0 ? current + bonus : current;
    }
  }
});
var createWormholeArtificerModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "wormhole_artificer"),
  source: { type: "champion", sourceId: WORMHOLE_ARTIFICER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getMoveMaxDistance: ({ modifier, movingUnitIds }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      if (movingUnitIds.length !== 1 || movingUnitIds[0] !== sourceUnitId) {
        return current;
      }
      return current + 1;
    }
  }
});
var createInspiringGeezerModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "inspiring_geezer"),
  source: { type: "champion", sourceId: INSPIRING_GEEZER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getForceHitFaces: ({ modifier, unit, hexKey, state }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});
var createFieldSurgeonModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "stitchwork"),
  source: { type: "champion", sourceId: FIELD_SURGEON_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    afterBattle: ({ state, modifier, hexKey }) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (sourceUnit.hex !== hexKey) {
        return state;
      }
      if (!canChampionUseAbility(sourceUnit, STITCHWORK_KEY)) {
        return state;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return state;
      }
      const candidateIds = (hex.occupants[sourceUnit.ownerPlayerId] ?? []).map((unitId2) => {
        const unit = state.board.units[unitId2];
        if (!unit || unit.kind !== "champion") {
          return null;
        }
        const missing = unit.maxHp - unit.hp;
        if (missing <= 0) {
          return null;
        }
        return { unitId: unitId2, missing };
      }).filter((entry) => Boolean(entry));
      if (candidateIds.length === 0) {
        return state;
      }
      candidateIds.sort((a, b) => {
        if (a.missing !== b.missing) {
          return b.missing - a.missing;
        }
        return a.unitId.localeCompare(b.unitId);
      });
      const targetId = candidateIds[0]?.unitId;
      if (!targetId) {
        return state;
      }
      let nextState = consumeChampionAbilityUse(state, sourceUnitId, STITCHWORK_KEY);
      nextState = healChampion(nextState, targetId, 2);
      return nextState;
    }
  }
});
var createBruteModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "brute"),
  source: { type: "champion", sourceId: BRUTE_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, hexKey, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return current;
      }
      for (const [playerId, unitIds] of Object.entries(hex.occupants)) {
        if (playerId === unit.ownerPlayerId) {
          continue;
        }
        for (const occupantId of unitIds ?? []) {
          if (state.board.units[occupantId]?.kind === "champion") {
            return current;
          }
        }
      }
      return current + 2;
    }
  }
});
var createDuelistExemplarModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "duelist_exemplar"),
  source: { type: "champion", sourceId: DUELIST_EXEMPLAR_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, hexKey, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return current;
      }
      for (const [playerId, unitIds] of Object.entries(hex.occupants)) {
        if (playerId === unit.ownerPlayerId) {
          continue;
        }
        for (const occupantId of unitIds ?? []) {
          if (state.board.units[occupantId]?.kind === "champion") {
            return current + 1;
          }
        }
      }
      return current;
    }
  }
});
var createLoneWolfModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "lone_wolf"),
  source: { type: "champion", sourceId: LONE_WOLF_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionAttackDice: ({ modifier, unitId: contextUnitId, unit, hexKey, state }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex) {
        return current;
      }
      const friendly = hex.occupants[unit.ownerPlayerId] ?? [];
      const hasFriendlyForces = friendly.some(
        (unitId2) => state.board.units[unitId2]?.kind === "force"
      );
      if (hasFriendlyForces) {
        return current;
      }
      return current + 3;
    }
  }
});
var createReliableVeteranModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "reliable_veteran"),
  source: { type: "champion", sourceId: RELIABLE_VETERAN_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionHitFaces: ({ modifier, unitId: contextUnitId, unit }, current) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId || sourceUnitId !== contextUnitId) {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      return Math.max(current, 5);
    }
  }
});
var createBountyHunterModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "bounty_hunter"),
  source: { type: "champion", sourceId: BOUNTY_HUNTER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionKillBonusGold: ({ modifier, state, killerPlayerId, hexKey, source, killedChampions }, current) => {
      if (source !== "battle") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== killerPlayerId) {
        return current;
      }
      if (killedChampions.length === 0) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      return current + killedChampions.length;
    }
  }
});
var createTaxReaverModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "tax_reaver"),
  source: { type: "champion", sourceId: TAX_REAVER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getChampionKillStealGold: ({ modifier, state, killerPlayerId, hexKey, source, killedChampions }, current) => {
      if (source !== "battle") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== killerPlayerId) {
        return current;
      }
      if (killedChampions.length === 0) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      return current + killedChampions.length * 2;
    }
  }
});
var createCapturerModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "capturer"),
  source: { type: "champion", sourceId: CAPTURER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    afterBattle: ({ state, modifier, winnerPlayerId, hexKey, attackers, defenders }) => {
      const ownerId = modifier.ownerPlayerId;
      if (!ownerId || winnerPlayerId !== ownerId) {
        return state;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (sourceUnit.hex !== hexKey) {
        return state;
      }
      if (![...attackers, ...defenders].includes(sourceUnitId)) {
        return state;
      }
      return {
        ...state,
        board: addForcesToHex(state.board, ownerId, hexKey, 1)
      };
    }
  }
});
var createStormcallerModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "stormcaller"),
  source: { type: "champion", sourceId: STORMCALLER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    beforeCombatRound: ({ state, modifier, attackers, defenders }) => {
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return state;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return state;
      }
      if (!canChampionUseAbility(sourceUnit, TEMPEST_KEY)) {
        return state;
      }
      if (![...attackers, ...defenders].includes(sourceUnitId)) {
        return state;
      }
      const neighborKeys = neighborHexKeys(sourceUnit.hex).filter(
        (key) => Boolean(state.board.hexes[key])
      );
      if (neighborKeys.length === 0) {
        return state;
      }
      const targetIds = [];
      for (const hexKey of neighborKeys) {
        const hex = state.board.hexes[hexKey];
        if (!hex) {
          continue;
        }
        for (const [playerId, unitIds] of Object.entries(hex.occupants)) {
          if (playerId === sourceUnit.ownerPlayerId) {
            continue;
          }
          for (const targetId of unitIds ?? []) {
            const unit = state.board.units[targetId];
            if (unit?.kind === "champion") {
              targetIds.push(targetId);
            }
          }
        }
      }
      if (targetIds.length === 0) {
        return state;
      }
      let nextState = consumeChampionAbilityUse(state, sourceUnitId, TEMPEST_KEY);
      for (const targetId of targetIds) {
        nextState = dealChampionDamage(nextState, sourceUnit.ownerPlayerId, targetId, 1);
      }
      return nextState;
    }
  }
});
var createCapitalBreakerModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "capital_breaker"),
  source: { type: "champion", sourceId: CAPITAL_BREAKER_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getForceHitFaces: ({ modifier, unit, hexKey, state, round }, current) => {
      if (unit.kind !== "force") {
        return current;
      }
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
        return current;
      }
      if (round !== 1) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      if (sourceUnit.hex !== hexKey) {
        return current;
      }
      const hex = state.board.hexes[hexKey];
      if (!hex || hex.tile !== "capital") {
        return current;
      }
      if (!hex.ownerPlayerId || hex.ownerPlayerId === unit.ownerPlayerId) {
        return current;
      }
      return Math.max(current, 3);
    }
  }
});
var createBannermanModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "bannerman"),
  source: { type: "champion", sourceId: BANNERMAN_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getControlBonus: ({ modifier, state, playerId }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== playerId) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      return current + 1;
    }
  }
});
var createCenterBannermanModifier = (unitId, ownerPlayerId) => ({
  id: buildChampionModifierId(unitId, "center_bannerman"),
  source: { type: "champion", sourceId: CENTER_BANNERMAN_CHAMPION_ID },
  ownerPlayerId,
  duration: { type: "permanent" },
  data: { unitId },
  hooks: {
    getControlBonus: ({ modifier, state, playerId }, current) => {
      if (modifier.ownerPlayerId && modifier.ownerPlayerId !== playerId) {
        return current;
      }
      const sourceUnitId = getModifierUnitId(modifier);
      if (!sourceUnitId) {
        return current;
      }
      const sourceUnit = state.board.units[sourceUnitId];
      if (!sourceUnit || sourceUnit.kind !== "champion") {
        return current;
      }
      const hex = state.board.hexes[sourceUnit.hex];
      if (!hex || hex.tile !== "center") {
        return current;
      }
      return current + 1;
    }
  }
});
var createChampionModifiers = (unitId, cardDefId, ownerPlayerId) => {
  switch (cardDefId) {
    case BODYGUARD_CHAMPION_ID:
      return [createBodyguardModifier(unitId, ownerPlayerId)];
    case ASSASSINS_EDGE_CHAMPION_ID:
      return [createAssassinsEdgeModifier(unitId, ownerPlayerId)];
    case FLIGHT_CHAMPION_ID:
      return [createBridgeBypassModifier(unitId, ownerPlayerId, cardDefId)];
    case ARCHIVIST_PRIME_CHAMPION_ID:
      return [createArchivistPrimeModifier(unitId, ownerPlayerId)];
    case WORMHOLE_ARTIFICER_CHAMPION_ID:
      return [createWormholeArtificerModifier(unitId, ownerPlayerId)];
    case BRIDGE_RUNNER_CHAMPION_ID:
      return [createBridgeBypassModifier(unitId, ownerPlayerId, cardDefId)];
    case INSPIRING_GEEZER_CHAMPION_ID:
      return [createInspiringGeezerModifier(unitId, ownerPlayerId)];
    case FIELD_SURGEON_CHAMPION_ID:
      return [createFieldSurgeonModifier(unitId, ownerPlayerId)];
    case BRUTE_CHAMPION_ID:
      return [createBruteModifier(unitId, ownerPlayerId)];
    case DUELIST_EXEMPLAR_CHAMPION_ID:
      return [createDuelistExemplarModifier(unitId, ownerPlayerId)];
    case LONE_WOLF_CHAMPION_ID:
      return [createLoneWolfModifier(unitId, ownerPlayerId)];
    case RELIABLE_VETERAN_CHAMPION_ID:
      return [createReliableVeteranModifier(unitId, ownerPlayerId)];
    case BOUNTY_HUNTER_CHAMPION_ID:
      return [createBountyHunterModifier(unitId, ownerPlayerId)];
    case TAX_REAVER_CHAMPION_ID:
      return [createTaxReaverModifier(unitId, ownerPlayerId)];
    case CAPTURER_CHAMPION_ID:
      return [createCapturerModifier(unitId, ownerPlayerId)];
    case STORMCALLER_CHAMPION_ID:
      return [createStormcallerModifier(unitId, ownerPlayerId)];
    case CAPITAL_BREAKER_CHAMPION_ID:
      return [createCapitalBreakerModifier(unitId, ownerPlayerId)];
    case BANNERMAN_CHAMPION_ID:
      return [createBannermanModifier(unitId, ownerPlayerId)];
    case CENTER_BANNERMAN_CHAMPION_ID:
      return [createCenterBannermanModifier(unitId, ownerPlayerId)];
    default:
      return [];
  }
};
var getDeployForcesOnChampionDeploy = (cardDefId) => {
  switch (cardDefId) {
    case SKIRMISHER_CAPTAIN_CHAMPION_ID:
      return 1;
    default:
      return 0;
  }
};
var getAdjacentBridgeKeys = (state, hexKey) => {
  const neighbors = neighborHexKeys(hexKey).filter((key) => Boolean(state.board.hexes[key]));
  const bridgeKeys = [];
  for (const neighbor of neighbors) {
    const edgeKey = getBridgeKey(hexKey, neighbor);
    if (state.board.bridges[edgeKey]) {
      bridgeKeys.push(edgeKey);
    }
  }
  return bridgeKeys;
};
var destroyAdjacentBridgeOnDeploy = (state, unitId, cardDefId) => {
  if (cardDefId !== SIEGE_ENGINEER_CHAMPION_ID) {
    return state;
  }
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  const bridgeKeys = getAdjacentBridgeKeys(state, unit.hex);
  if (bridgeKeys.length === 0) {
    return state;
  }
  const pick = randInt(state.rngState, 0, bridgeKeys.length - 1);
  const edgeKey = bridgeKeys[pick.value] ?? bridgeKeys[0];
  if (!edgeKey || !state.board.bridges[edgeKey]) {
    return { ...state, rngState: pick.next };
  }
  const { [edgeKey]: _removed, ...bridges } = state.board.bridges;
  return {
    ...state,
    rngState: pick.next,
    board: {
      ...state.board,
      bridges
    }
  };
};
var applyChampionOnDeploy = (state, unitId, cardDefId, ownerPlayerId) => {
  let nextState = state;
  const forceCount = getDeployForcesOnChampionDeploy(cardDefId);
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return nextState;
  }
  if (forceCount > 0) {
    nextState = {
      ...nextState,
      board: addForcesToHex(nextState.board, ownerPlayerId, unit.hex, forceCount)
    };
  }
  return destroyAdjacentBridgeOnDeploy(nextState, unitId, cardDefId);
};
var applyChampionDeployment = (state, unitId, cardDefId, ownerPlayerId) => {
  let nextState = setChampionAbilityUses(state, unitId, buildAbilityUses(cardDefId));
  const modifiers = createChampionModifiers(unitId, cardDefId, ownerPlayerId);
  if (modifiers.length === 0) {
    return applyChampionOnDeploy(nextState, unitId, cardDefId, ownerPlayerId);
  }
  const existing = new Set(nextState.modifiers.map((modifier) => modifier.id));
  const nextModifiers = [...nextState.modifiers];
  for (const modifier of modifiers) {
    if (!existing.has(modifier.id)) {
      nextModifiers.push(modifier);
    }
  }
  if (nextModifiers.length === nextState.modifiers.length) {
    return applyChampionOnDeploy(nextState, unitId, cardDefId, ownerPlayerId);
  }
  nextState = { ...nextState, modifiers: nextModifiers };
  return applyChampionOnDeploy(nextState, unitId, cardDefId, ownerPlayerId);
};
var refreshChampionAbilityUsesForRound = (state) => {
  let changed = false;
  const nextUnits = { ...state.board.units };
  for (const [unitId, unit] of Object.entries(state.board.units)) {
    if (unit.kind !== "champion") {
      continue;
    }
    const resetCounts = getPerRoundAbilityUses(unit.cardDefId);
    if (!resetCounts) {
      continue;
    }
    const nextUses = { ...unit.abilityUses };
    let unitChanged = false;
    for (const [key, count] of Object.entries(resetCounts)) {
      if (nextUses[key]?.remaining !== count) {
        nextUses[key] = { remaining: count };
        unitChanged = true;
      }
    }
    if (unitChanged) {
      nextUnits[unitId] = { ...unit, abilityUses: nextUses };
      changed = true;
    }
  }
  if (!changed) {
    return state;
  }
  return {
    ...state,
    board: {
      ...state.board,
      units: nextUnits
    }
  };
};
var removeChampionModifiers = (state, unitIds) => {
  if (unitIds.length === 0) {
    return state;
  }
  const idSet = new Set(unitIds);
  const nextModifiers = state.modifiers.filter((modifier) => {
    if (modifier.source.type !== "champion") {
      return true;
    }
    const modifierUnitId = getModifierUnitId(modifier);
    if (!modifierUnitId) {
      return true;
    }
    return !idSet.has(modifierUnitId);
  });
  if (nextModifiers.length === state.modifiers.length) {
    return state;
  }
  return { ...state, modifiers: nextModifiers };
};
var setPlayerMana = (state, playerId, mana) => {
  let changed = false;
  const players = state.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }
    if (player.resources.mana === mana) {
      return player;
    }
    changed = true;
    return {
      ...player,
      resources: {
        ...player.resources,
        mana
      }
    };
  });
  return changed ? { ...state, players } : state;
};
var addGold2 = (state, playerId, amount) => {
  if (amount <= 0) {
    return state;
  }
  let changed = false;
  const players = state.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }
    changed = true;
    return {
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold + amount
      }
    };
  });
  return changed ? { ...state, players } : state;
};
var spendGold = (state, playerId, amount) => {
  if (amount <= 0) {
    return state;
  }
  let changed = false;
  const players = state.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }
    const nextGold = Math.max(0, player.resources.gold - amount);
    if (nextGold === player.resources.gold) {
      return player;
    }
    changed = true;
    return {
      ...player,
      resources: {
        ...player.resources,
        gold: nextGold
      }
    };
  });
  return changed ? { ...state, players } : state;
};
var isModifierActive2 = (modifier) => {
  if (modifier.duration.type === "uses") {
    return modifier.duration.remaining > 0;
  }
  return true;
};
var applyGoldArmorToDamage = (state, unitId, damage) => {
  if (!Number.isFinite(damage) || damage <= 0) {
    return { state, remainingDamage: damage };
  }
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return { state, remainingDamage: damage };
  }
  let costPerDamage = null;
  for (const modifier of state.modifiers) {
    if (!isModifierActive2(modifier)) {
      continue;
    }
    if (modifier.attachedUnitId !== unitId) {
      continue;
    }
    const raw = modifier.data?.goldArmor;
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const record = raw;
    const cost = typeof record.costPerDamage === "number" ? record.costPerDamage : 2;
    if (!Number.isFinite(cost) || cost <= 0) {
      continue;
    }
    costPerDamage = cost;
    break;
  }
  if (costPerDamage === null) {
    return { state, remainingDamage: damage };
  }
  const player = state.players.find((entry) => entry.id === unit.ownerPlayerId);
  if (!player) {
    return { state, remainingDamage: damage };
  }
  const maxPrevent = Math.floor(player.resources.gold / costPerDamage);
  if (maxPrevent <= 0) {
    return { state, remainingDamage: damage };
  }
  const prevented = Math.min(damage, maxPrevent);
  const remainingDamage = damage - prevented;
  const nextState = spendGold(state, unit.ownerPlayerId, prevented * costPerDamage);
  return { state: nextState, remainingDamage };
};
var applyChampionDeathEffects = (state, killedChampions) => {
  if (killedChampions.length === 0) {
    return state;
  }
  let nextState = state;
  for (const champion of killedChampions) {
    if (champion.cardDefId !== TRAITOR_CHAMPION_ID) {
      continue;
    }
    nextState = setPlayerMana(nextState, champion.ownerPlayerId, 0);
  }
  for (const champion of killedChampions) {
    const hex = nextState.board.hexes[champion.hex];
    if (!hex) {
      continue;
    }
    const occupantGroups = Object.values(hex.occupants);
    for (const unitIds of occupantGroups) {
      for (const unitId of unitIds ?? []) {
        const unit = nextState.board.units[unitId];
        if (!unit || unit.kind !== "champion") {
          continue;
        }
        if (unit.cardDefId !== BLOOD_BANKER_CHAMPION_ID) {
          continue;
        }
        if (!canChampionUseAbility(unit, BLOOD_LEDGER_KEY)) {
          continue;
        }
        nextState = consumeChampionAbilityUse(nextState, unitId, BLOOD_LEDGER_KEY);
        nextState = addGold2(nextState, unit.ownerPlayerId, 2);
      }
    }
  }
  return nextState;
};
var healChampion = (state, unitId, amount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  const nextHp = Math.min(unit.maxHp, unit.hp + amount);
  if (nextHp === unit.hp) {
    return state;
  }
  return {
    ...state,
    board: {
      ...state.board,
      units: {
        ...state.board.units,
        [unitId]: {
          ...unit,
          hp: nextHp
        }
      }
    }
  };
};
var dealChampionDamage = (state, sourcePlayerId, unitId, amount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const initialUnit = state.board.units[unitId];
  if (!initialUnit || initialUnit.kind !== "champion") {
    return state;
  }
  const armored = applyGoldArmorToDamage(state, unitId, amount);
  if (armored.remainingDamage <= 0) {
    return armored.state;
  }
  const unit = armored.state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return armored.state;
  }
  const nextHp = unit.hp - armored.remainingDamage;
  if (nextHp > 0) {
    return {
      ...armored.state,
      board: {
        ...armored.state.board,
        units: {
          ...armored.state.board.units,
          [unitId]: {
            ...unit,
            hp: nextHp
          }
        }
      }
    };
  }
  const units = { ...armored.state.board.units };
  delete units[unitId];
  let nextState = {
    ...armored.state,
    board: {
      ...armored.state.board,
      units
    }
  };
  const hex = armored.state.board.hexes[unit.hex];
  if (hex) {
    const updatedHex = {
      ...hex,
      occupants: {
        ...hex.occupants,
        [unit.ownerPlayerId]: (hex.occupants[unit.ownerPlayerId] ?? []).filter(
          (id) => id !== unitId
        )
      }
    };
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        hexes: {
          ...nextState.board.hexes,
          [unit.hex]: updatedHex
        }
      }
    };
  }
  nextState = removeChampionModifiers(nextState, [unitId]);
  nextState = applyChampionDeathEffects(nextState, [unit]);
  if (unit.ownerPlayerId !== sourcePlayerId) {
    nextState = applyChampionKillRewards(nextState, {
      killerPlayerId: sourcePlayerId,
      victimPlayerId: unit.ownerPlayerId,
      killedChampions: [unit],
      bounty: unit.bounty,
      hexKey: unit.hex,
      source: "effect"
    });
  }
  return nextState;
};

// packages/engine/src/round-flow.ts
var MINE_OVERSEER_CHAMPION_ID = "champion.prospect.mine_overseer";
var QUIET_STUDY_MAX_DISCARD = 2;
var applyRoundReset = (state) => {
  const nextRound = state.round + 1;
  const playerCount = state.players.length;
  let nextState = {
    ...state,
    round: nextRound,
    leadSeatIndex: playerCount > 0 ? (nextRound - 1) % playerCount : 0,
    players: state.players.map((player) => ({
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold + state.config.BASE_INCOME,
        mana: state.config.MAX_MANA
      },
      doneThisRound: false,
      flags: {
        ...player.flags,
        [MOVED_THIS_ROUND_FLAG]: false,
        [CARDS_PLAYED_THIS_ROUND_FLAG]: 0,
        [CARDS_DISCARDED_THIS_ROUND_FLAG]: 0
      }
    }))
  };
  nextState = refreshChampionAbilityUsesForRound(nextState);
  for (const player of nextState.players) {
    nextState = drawToHandSize(nextState, player.id, 6);
  }
  return {
    ...nextState,
    phase: "round.market"
  };
};
var createQuietStudyBlock = (state) => {
  const quietStudyPlayers = state.players.filter((player) => hasCipherQuietStudy(state, player.id)).map((player) => player.id);
  if (quietStudyPlayers.length === 0) {
    return null;
  }
  return {
    type: "round.quietStudy",
    waitingFor: quietStudyPlayers,
    payload: {
      maxDiscard: QUIET_STUDY_MAX_DISCARD,
      choices: Object.fromEntries(quietStudyPlayers.map((playerId) => [playerId, null]))
    }
  };
};
var isQuietStudyChoiceValid = (state, playerId, cardInstanceIds, maxDiscard) => {
  if (cardInstanceIds.length > maxDiscard) {
    return false;
  }
  const uniqueIds = new Set(cardInstanceIds);
  if (uniqueIds.size !== cardInstanceIds.length) {
    return false;
  }
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return false;
  }
  return cardInstanceIds.every((id) => player.deck.hand.includes(id));
};
var applyQuietStudyChoice = (state, cardInstanceIds, playerId) => {
  if (state.phase !== "round.study") {
    return state;
  }
  const block = state.blocks;
  if (!block || block.type !== "round.quietStudy") {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (block.payload.choices[playerId]) {
    return state;
  }
  if (!isQuietStudyChoiceValid(state, playerId, cardInstanceIds, block.payload.maxDiscard)) {
    return state;
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
          [playerId]: cardInstanceIds
        }
      }
    }
  };
};
var resolveQuietStudyChoices = (state) => {
  const block = state.blocks;
  if (!block || block.type !== "round.quietStudy") {
    return state;
  }
  let nextState = state;
  for (const player of state.players) {
    const selected = block.payload.choices[player.id] ?? [];
    if (selected.length === 0) {
      continue;
    }
    for (const cardInstanceId of selected) {
      nextState = discardCardFromHand(nextState, player.id, cardInstanceId, {
        countAsDiscard: true
      });
    }
    nextState = drawToHandSize(nextState, player.id, 6);
  }
  return nextState;
};
var takeFromDeck = (deck, count) => {
  if (count <= 0 || deck.length === 0) {
    return { drawn: [], remaining: deck };
  }
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
};
var getSeatOrderedPlayers = (players) => {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
};
var getPromptKey = (kind, hexKey) => `${kind}:${hexKey}`;
var getPlayer2 = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`player not found: ${playerId}`);
  }
  return player;
};
var addGold3 = (state, playerId, amount) => {
  if (amount <= 0) {
    return state;
  }
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + amount
        }
      } : player
    )
  };
};
var hasMineOverseer = (state, playerId, hexKey) => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return false;
  }
  const unitIds = hex.occupants[playerId] ?? [];
  return unitIds.some((unitId) => {
    const unit = state.board.units[unitId];
    return unit?.kind === "champion" && unit.cardDefId === MINE_OVERSEER_CHAMPION_ID;
  });
};
var getMineGoldValue = (state, playerId, hexKey, mineValue) => {
  const baseValue = mineValue + (hasMineOverseer(state, playerId, hexKey) ? 1 : 0);
  return applyModifierQuery(
    state,
    state.modifiers,
    (hooks) => hooks.getMineGoldValue,
    { playerId, hexKey, mineValue },
    baseValue
  );
};
var getChoiceCount = (state, playerId, kind, baseCount) => {
  const rawCount = getCardChoiceCount(
    state,
    { playerId, kind, baseCount },
    baseCount
  );
  const normalized = Number.isFinite(rawCount) ? Math.floor(rawCount) : baseCount;
  return Math.max(baseCount, normalized);
};
var returnToBottomRandom = (state, deck, cardIds) => {
  if (cardIds.length === 0) {
    return { state, deck };
  }
  if (cardIds.length === 1) {
    return { state, deck: [...deck, ...cardIds] };
  }
  const { value, next } = shuffle(state.rngState, cardIds);
  return { state: { ...state, rngState: next }, deck: [...deck, ...value] };
};
var buildCollectionPrompts = (state) => {
  const prompts = Object.fromEntries(
    state.players.map((player) => [player.id, []])
  );
  const specialHexes = Object.values(state.board.hexes).filter((hex) => hex.tile === "forge" || hex.tile === "center").sort((a, b) => a.key.localeCompare(b.key));
  for (const hex of specialHexes) {
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const playerId = occupants[0];
    if (!prompts[playerId]) {
      continue;
    }
    if (hex.tile === "forge") {
      prompts[playerId].push({
        kind: "forge",
        hexKey: hex.key,
        revealed: []
      });
    } else if (hex.tile === "center") {
      prompts[playerId].push({
        kind: "center",
        hexKey: hex.key,
        revealed: []
      });
    }
  }
  return prompts;
};
var applyMineGoldCollection = (state) => {
  const mineHexes = Object.values(state.board.hexes).filter((hex) => hex.tile === "mine").sort((a, b) => a.key.localeCompare(b.key));
  let nextState = state;
  for (const hex of mineHexes) {
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const playerId = occupants[0];
    const mineGold = getMineGoldValue(nextState, playerId, hex.key, hex.mineValue ?? 0);
    nextState = addGold3(nextState, playerId, mineGold);
  }
  return nextState;
};
var createCollectionBlock = (state) => {
  const stateWithMineGold = applyMineGoldCollection(state);
  const promptsByPlayer = buildCollectionPrompts(stateWithMineGold);
  const playersInSeatOrder = getSeatOrderedPlayers(stateWithMineGold.players);
  const currentAge = stateWithMineGold.market.age;
  let marketDeck = stateWithMineGold.marketDecks[currentAge] ?? [];
  let powerDeck = stateWithMineGold.powerDecks[currentAge] ?? [];
  const nextPrompts = { ...promptsByPlayer };
  for (const player of playersInSeatOrder) {
    const prompts = promptsByPlayer[player.id] ?? [];
    if (prompts.length === 0) {
      continue;
    }
    const resolved = [];
    for (const prompt of prompts) {
      let drawn = [];
      if (prompt.kind === "forge") {
        const drawCount = getChoiceCount(stateWithMineGold, player.id, "forgeDraft", 3);
        const draw = takeFromDeck(marketDeck, drawCount);
        drawn = draw.drawn;
        marketDeck = draw.remaining;
      } else if (prompt.kind === "center") {
        const drawCount = getChoiceCount(stateWithMineGold, player.id, "centerPick", 2);
        const draw = takeFromDeck(powerDeck, drawCount);
        drawn = draw.drawn;
        powerDeck = draw.remaining;
      }
      if (prompt.kind === "center" && drawn.length === 0) {
        continue;
      }
      resolved.push({ ...prompt, revealed: drawn });
    }
    nextPrompts[player.id] = resolved;
  }
  const waitingFor = playersInSeatOrder.filter((player) => (nextPrompts[player.id] ?? []).length > 0).map((player) => player.id);
  if (waitingFor.length === 0) {
    return {
      state: {
        ...stateWithMineGold,
        marketDecks: {
          ...stateWithMineGold.marketDecks,
          [currentAge]: marketDeck
        },
        powerDecks: {
          ...stateWithMineGold.powerDecks,
          [currentAge]: powerDeck
        }
      },
      block: null
    };
  }
  const nextState = {
    ...stateWithMineGold,
    marketDecks: {
      ...stateWithMineGold.marketDecks,
      [currentAge]: marketDeck
    },
    powerDecks: {
      ...stateWithMineGold.powerDecks,
      [currentAge]: powerDeck
    }
  };
  return {
    state: nextState,
    block: {
      type: "collection.choices",
      waitingFor,
      payload: {
        prompts: nextPrompts,
        choices: Object.fromEntries(
          stateWithMineGold.players.map((player) => [player.id, null])
        )
      }
    }
  };
};
var isCollectionChoiceValid = (state, playerId, prompt, choice) => {
  if (prompt.kind !== choice.kind || prompt.hexKey !== choice.hexKey) {
    return false;
  }
  if (choice.kind === "forge") {
    if (choice.choice === "reforge") {
      const player = getPlayer2(state, playerId);
      return player.deck.hand.includes(choice.scrapCardId);
    }
    return prompt.revealed.includes(choice.cardId);
  }
  if (choice.kind === "center") {
    return prompt.revealed.includes(choice.cardId);
  }
  return false;
};
var areCollectionChoicesValid = (state, playerId, prompts, choices) => {
  if (choices.length !== prompts.length) {
    return false;
  }
  const promptMap = new Map(
    prompts.map((prompt) => [getPromptKey(prompt.kind, prompt.hexKey), prompt])
  );
  const seen = /* @__PURE__ */ new Set();
  for (const choice of choices) {
    const key = getPromptKey(choice.kind, choice.hexKey);
    if (seen.has(key)) {
      return false;
    }
    const prompt = promptMap.get(key);
    if (!prompt) {
      return false;
    }
    if (!isCollectionChoiceValid(state, playerId, prompt, choice)) {
      return false;
    }
    seen.add(key);
  }
  return seen.size === prompts.length;
};
var applyCollectionChoice = (state, choices, playerId) => {
  if (state.phase !== "round.collection") {
    return state;
  }
  const block = state.blocks;
  if (!block || block.type !== "collection.choices") {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (block.payload.choices[playerId]) {
    return state;
  }
  const prompts = block.payload.prompts[playerId] ?? [];
  if (prompts.length === 0) {
    return state;
  }
  if (!areCollectionChoicesValid(state, playerId, prompts, choices)) {
    return state;
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
          [playerId]: choices
        }
      }
    }
  };
};
var resolveCollectionChoices = (state) => {
  const block = state.blocks;
  if (!block || block.type !== "collection.choices") {
    return state;
  }
  const currentAge = state.market.age;
  let marketDeck = state.marketDecks[currentAge] ?? [];
  let powerDeck = state.powerDecks[currentAge] ?? [];
  let nextState = state;
  const playersInSeatOrder = getSeatOrderedPlayers(state.players);
  for (const player of playersInSeatOrder) {
    const prompts = block.payload.prompts[player.id] ?? [];
    const choices = block.payload.choices[player.id] ?? [];
    if (prompts.length === 0) {
      continue;
    }
    const choiceMap = new Map(
      choices.map((choice) => [getPromptKey(choice.kind, choice.hexKey), choice])
    );
    for (const prompt of prompts) {
      const choice = choiceMap.get(getPromptKey(prompt.kind, prompt.hexKey));
      if (!choice) {
        continue;
      }
      if (choice.kind === "forge") {
        if (choice.choice === "reforge") {
          nextState = scrapCardFromHand(nextState, player.id, choice.scrapCardId);
          const returned = returnToBottomRandom(nextState, marketDeck, prompt.revealed);
          nextState = returned.state;
          marketDeck = returned.deck;
        } else if (prompt.revealed.includes(choice.cardId)) {
          const leftovers = prompt.revealed.filter((cardId) => cardId !== choice.cardId);
          const returned = returnToBottomRandom(nextState, marketDeck, leftovers);
          nextState = returned.state;
          marketDeck = returned.deck;
          const created = createCardInstance(nextState, choice.cardId);
          nextState = insertCardIntoDrawPileRandom(
            created.state,
            player.id,
            created.instanceId
          );
        }
      } else if (choice.kind === "center") {
        if (prompt.revealed.includes(choice.cardId)) {
          const leftovers = prompt.revealed.filter((cardId) => cardId !== choice.cardId);
          const returned = returnToBottomRandom(nextState, powerDeck, leftovers);
          nextState = returned.state;
          powerDeck = returned.deck;
          const created = createCardInstance(nextState, choice.cardId);
          nextState = insertCardIntoDrawPileRandom(
            created.state,
            player.id,
            created.instanceId
          );
        }
      }
    }
  }
  return {
    ...nextState,
    marketDecks: {
      ...nextState.marketDecks,
      [currentAge]: marketDeck
    },
    powerDecks: {
      ...nextState.powerDecks,
      [currentAge]: powerDeck
    }
  };
};
var addControl = (totals, playerId, amount) => {
  if (amount <= 0) {
    return totals;
  }
  return {
    ...totals,
    [playerId]: (totals[playerId] ?? 0) + amount
  };
};
var getControlTotals = (state) => {
  let controlTotals = {};
  for (const hex of Object.values(state.board.hexes)) {
    if (hex.tile !== "center" && hex.tile !== "forge" && hex.tile !== "capital") {
      continue;
    }
    const occupants = getPlayerIdsOnHex(hex);
    if (occupants.length !== 1) {
      continue;
    }
    const occupant = occupants[0];
    let baseControl = 0;
    if (hex.tile === "center" || hex.tile === "forge") {
      baseControl = 1;
    } else if (hex.tile === "capital" && hex.ownerPlayerId && hex.ownerPlayerId !== occupant) {
      baseControl = 1;
    }
    if (baseControl <= 0) {
      continue;
    }
    const adjusted = getControlValue(
      state,
      { playerId: occupant, hexKey: hex.key, tile: hex.tile, baseValue: baseControl },
      baseControl
    );
    controlTotals = addControl(controlTotals, occupant, adjusted);
  }
  return controlTotals;
};
var resolveTiebreak = (players) => {
  if (players.length === 0) {
    return null;
  }
  const sorted = [...players].sort((a, b) => {
    if (a.vp.total !== b.vp.total) {
      return b.vp.total - a.vp.total;
    }
    if (a.vp.permanent !== b.vp.permanent) {
      return b.vp.permanent - a.vp.permanent;
    }
    if (a.resources.gold !== b.resources.gold) {
      return b.resources.gold - a.resources.gold;
    }
    return a.seatIndex - b.seatIndex;
  });
  return sorted[0]?.id ?? null;
};
var capitalIsSafe = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return false;
  }
  const capital = state.board.hexes[player.capitalHex];
  if (!capital) {
    return false;
  }
  return !hasEnemyUnits(capital, playerId);
};
var applyScoring = (state) => {
  const controlTotals = getControlTotals(state);
  const players = state.players.map((player) => {
    const controlBonus = getControlBonus(state, { playerId: player.id }, 0);
    const control = (controlTotals[player.id] ?? 0) + controlBonus;
    const total = player.vp.permanent + control;
    return {
      ...player,
      vp: {
        ...player.vp,
        control,
        total
      }
    };
  });
  let winnerPlayerId = null;
  const eligibleWinners = players.filter(
    (player) => player.vp.total >= state.config.VP_TO_WIN && capitalIsSafe(state, player.id)
  );
  if (eligibleWinners.length > 0) {
    winnerPlayerId = resolveTiebreak(eligibleWinners);
  } else if (state.round >= state.config.ROUNDS_MAX) {
    winnerPlayerId = resolveTiebreak(players);
  }
  return {
    ...state,
    players,
    winnerPlayerId
  };
};
var applyCleanup = (state) => {
  const players = state.players.map((player) => ({
    ...player,
    deck: {
      ...player.deck,
      discardPile: [...player.deck.discardPile, ...player.deck.hand],
      hand: []
    },
    doneThisRound: false
  }));
  let nextState = {
    ...state,
    players
  };
  const roundEndContext = { round: state.round };
  nextState = runModifierEvents(
    nextState,
    nextState.modifiers,
    (hooks) => hooks.onRoundEnd,
    roundEndContext
  );
  const bridges = Object.fromEntries(
    Object.entries(nextState.board.bridges).filter(([, bridge]) => !bridge.temporary)
  );
  const modifiers = expireEndOfRoundModifiers(nextState).modifiers;
  return {
    ...nextState,
    board: {
      ...nextState.board,
      bridges
    },
    modifiers,
    market: {
      ...nextState.market,
      currentRow: [],
      rowIndexResolving: 0,
      passPot: 0,
      bids: Object.fromEntries(nextState.players.map((player) => [player.id, null])),
      playersOut: Object.fromEntries(nextState.players.map((player) => [player.id, false])),
      rollOff: null
    }
  };
};
var applyAgeUpdate = (state) => {
  const upcomingAge = state.config.ageByRound[state.round + 1];
  if (!upcomingAge) {
    return state;
  }
  return {
    ...state,
    market: {
      ...state.market,
      age: upcomingAge
    }
  };
};

// packages/engine/src/deploy-utils.ts
var LOGISTICS_OFFICER_CHAMPION_ID = "champion.age3.logistics_officer";
var getCapitalHexKey = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    return null;
  }
  if (!state.board.hexes[player.capitalHex]) {
    return null;
  }
  return player.capitalHex;
};
var getAerialCenterHexKey = (state, playerId) => {
  if (!hasAerialWings(state, playerId)) {
    return null;
  }
  const centerHexKey = getCenterHexKey(state.board);
  if (!centerHexKey) {
    return null;
  }
  const centerHex = state.board.hexes[centerHexKey];
  if (!centerHex) {
    return null;
  }
  if (!isOccupiedByPlayer(centerHex, playerId)) {
    return null;
  }
  return centerHexKey;
};
var getLogisticsOfficerHexKeys = (state, playerId) => {
  const hexKeys = /* @__PURE__ */ new Set();
  for (const unit of Object.values(state.board.units)) {
    if (unit.kind !== "champion") {
      continue;
    }
    if (unit.ownerPlayerId !== playerId) {
      continue;
    }
    if (unit.cardDefId !== LOGISTICS_OFFICER_CHAMPION_ID) {
      continue;
    }
    if (state.board.hexes[unit.hex]) {
      hexKeys.add(unit.hex);
    }
  }
  return [...hexKeys];
};
var isDeployable = (state, playerId, hexKey) => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return false;
  }
  return !wouldExceedTwoPlayers(hex, playerId);
};
var resolveCapitalDeployHex = (state, playerId, preferredHex) => {
  const capitalHexKey = getCapitalHexKey(state, playerId);
  const centerHexKey = getAerialCenterHexKey(state, playerId);
  const candidates = [];
  if (capitalHexKey) {
    candidates.push(capitalHexKey);
  }
  if (centerHexKey && centerHexKey !== capitalHexKey) {
    candidates.push(centerHexKey);
  }
  for (const hexKey of getLogisticsOfficerHexKeys(state, playerId)) {
    if (!candidates.includes(hexKey)) {
      candidates.push(hexKey);
    }
  }
  if (preferredHex) {
    if (!candidates.includes(preferredHex)) {
      return null;
    }
    return isDeployable(state, playerId, preferredHex) ? preferredHex : null;
  }
  for (const hexKey of candidates) {
    if (isDeployable(state, playerId, hexKey)) {
      return hexKey;
    }
  }
  return null;
};

// packages/engine/src/card-effects.ts
var SUPPORTED_TARGET_KINDS = /* @__PURE__ */ new Set([
  "none",
  "edge",
  "multiEdge",
  "stack",
  "path",
  "multiPath",
  "champion",
  "choice",
  "hex",
  "hexPair"
]);
var SUPPORTED_EFFECTS = /* @__PURE__ */ new Set([
  "gainGold",
  "gainMana",
  "gainManaIfTile",
  "drawCards",
  "drawCardsOtherPlayers",
  "rollGold",
  "drawCardsIfTile",
  "drawCardsIfHandEmpty",
  "discardFromHand",
  "burnFromHand",
  "scoutReport",
  "prospecting",
  "gainGoldIfEnemyCapital",
  "buildBridge",
  "moveStack",
  "moveStacks",
  "deployForces",
  "recruitByHandSize",
  "deployForcesOnMines",
  "increaseMineValue",
  "healChampion",
  "healChampions",
  "dealChampionDamage",
  "goldPlatedArmor",
  "patchUp",
  "recruit",
  "holdTheLine",
  "markForCoin",
  "topdeckFromHand",
  "ward",
  "immunityField",
  "lockBridge",
  "trapBridge",
  "destroyBridge",
  "bridgePivot",
  "battleWinDraw",
  "destroyConnectedBridges",
  "linkHexes",
  "linkCapitalToCenter",
  "battleCry",
  "smokeScreen",
  "frenzy",
  "shockDrill",
  "focusFire",
  "encirclement",
  "mortarShot",
  "setToSkirmish",
  "evacuateChampion",
  "recallChampion"
]);
var getTargetRecord = (targets) => {
  if (!targets || typeof targets !== "object") {
    return null;
  }
  return targets;
};
var getForceCountTarget = (targets) => {
  const record = getTargetRecord(targets);
  const forceCount = record?.forceCount;
  return typeof forceCount === "number" && Number.isFinite(forceCount) ? forceCount : null;
};
var getBooleanTarget = (targets, key) => {
  const record = getTargetRecord(targets);
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
};
var getMoveStackForceCount = (card, effect, targets) => {
  const targetCount = getForceCountTarget(targets ?? null);
  if (targetCount !== null) {
    return targetCount;
  }
  const effectCount = effect?.forceCount;
  if (typeof effectCount === "number") {
    return effectCount;
  }
  const specCount = card.targetSpec?.forceCount;
  if (typeof specCount === "number") {
    return specCount;
  }
  return void 0;
};
var getMoveStackIncludeChampions = (card, effect, targets) => {
  const targetInclude = getBooleanTarget(targets ?? null, "includeChampions");
  if (targetInclude !== null) {
    return targetInclude;
  }
  const effectInclude = effect?.includeChampions;
  if (typeof effectInclude === "boolean") {
    return effectInclude;
  }
  const specInclude = card.targetSpec?.includeChampions;
  if (typeof specInclude === "boolean") {
    return specInclude;
  }
  return void 0;
};
var getEdgeKeyTarget = (targets) => {
  const record = getTargetRecord(targets);
  const edgeKey = record?.edgeKey;
  return typeof edgeKey === "string" && edgeKey.length > 0 ? edgeKey : null;
};
var getEdgeKeyTargets = (targets) => {
  const record = getTargetRecord(targets);
  const raw = record?.edgeKeys ?? record?.edges ?? record?.edgeKey;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return raw.length > 0 ? [raw] : null;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const edges = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.length === 0) {
      return null;
    }
    edges.push(entry);
  }
  return edges;
};
var getHexKeyTarget = (targets) => {
  const record = getTargetRecord(targets);
  const hexKey = record?.hexKey;
  return typeof hexKey === "string" && hexKey.length > 0 ? hexKey : null;
};
var getPathTarget = (targets) => {
  const record = getTargetRecord(targets);
  const path = record?.path;
  if (!Array.isArray(path) || path.length < 2) {
    return null;
  }
  if (!path.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return null;
  }
  return path;
};
var getStackTarget = (targets) => {
  const record = getTargetRecord(targets);
  const from = record?.from;
  const to = record?.to;
  if (typeof from !== "string" || typeof to !== "string") {
    return null;
  }
  if (from.length === 0 || to.length === 0) {
    return null;
  }
  return { from, to };
};
var getMovePathTarget = (targets) => {
  const path = getPathTarget(targets);
  if (path) {
    return path;
  }
  const stack = getStackTarget(targets);
  if (!stack) {
    return null;
  }
  return [stack.from, stack.to];
};
var normalizePath = (value) => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  if (!value.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return null;
  }
  return value;
};
var getMultiPathTargets = (targets) => {
  const record = getTargetRecord(targets);
  const raw = record?.paths ?? record?.path;
  if (!raw) {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  if (raw.every((entry) => typeof entry === "string")) {
    const single = normalizePath(raw);
    return single ? [single] : null;
  }
  const paths = [];
  for (const entry of raw) {
    const path = normalizePath(entry);
    if (!path) {
      return null;
    }
    paths.push(path);
  }
  return paths.length > 0 ? paths : null;
};
var getChoiceTarget = (targets) => {
  const record = getTargetRecord(targets);
  const choice = record?.choice ?? record?.kind;
  if (choice === "capital") {
    const hexKey = record?.hexKey;
    if (typeof hexKey === "string" && hexKey.length > 0) {
      return { kind: "capital", hexKey };
    }
    return { kind: "capital" };
  }
  if (choice === "occupiedHex") {
    const hexKey = record?.hexKey;
    if (typeof hexKey !== "string" || hexKey.length === 0) {
      return null;
    }
    return { kind: "occupiedHex", hexKey };
  }
  return null;
};
var getChampionTargetId = (targets) => {
  const record = getTargetRecord(targets);
  const unitId = record?.unitId ?? record?.championId;
  return typeof unitId === "string" && unitId.length > 0 ? unitId : null;
};
var getCardInstanceTargets = (targets) => {
  const record = getTargetRecord(targets);
  const ids = record?.cardInstanceIds;
  if (Array.isArray(ids)) {
    return ids.filter((entry) => typeof entry === "string" && entry.length > 0);
  }
  const id = record?.cardInstanceId;
  return typeof id === "string" && id.length > 0 ? [id] : [];
};
var isWithinDistance = (from, to, maxDistance) => {
  if (!Number.isFinite(maxDistance) || maxDistance < 0) {
    return false;
  }
  try {
    return axialDistance(parseHexKey(from), parseHexKey(to)) <= maxDistance;
  } catch {
    return false;
  }
};
var hasFriendlyChampionWithinRange = (state, playerId, targetHex, maxDistance) => {
  return Object.values(state.board.units).some(
    (unit) => unit.kind === "champion" && unit.ownerPlayerId === playerId && isWithinDistance(unit.hex, targetHex, maxDistance)
  );
};
var hasFriendlyForceWithinRange = (state, playerId, targetHex, maxDistance) => {
  return Object.values(state.board.units).some(
    (unit) => unit.kind === "force" && unit.ownerPlayerId === playerId && isWithinDistance(unit.hex, targetHex, maxDistance)
  );
};
var isModifierActive3 = (modifier) => {
  if (modifier.duration.type === "uses") {
    return modifier.duration.remaining > 0;
  }
  return true;
};
var removeModifierById = (state, modifierId) => {
  const nextModifiers = state.modifiers.filter((modifier) => modifier.id !== modifierId);
  return nextModifiers.length === state.modifiers.length ? state : { ...state, modifiers: nextModifiers };
};
var getTargetingGuard = (modifier) => {
  if (!isModifierActive3(modifier)) {
    return null;
  }
  const raw = modifier.data?.targeting;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw;
  const blockEnemyCards = record.blockEnemyCards === true;
  const blockEnemySpells = record.blockEnemySpells === true;
  if (!blockEnemyCards && !blockEnemySpells) {
    return null;
  }
  const scope = record.scope === "ownerChampions" ? "ownerChampions" : "attachedUnit";
  return { blockEnemyCards, blockEnemySpells, scope };
};
var guardAppliesToChampion = (modifier, guard, unitId, unitOwnerId) => {
  if (guard.scope === "ownerChampions") {
    return modifier.ownerPlayerId === unitOwnerId;
  }
  return modifier.attachedUnitId === unitId;
};
var isChampionTargetableByCard = (state, playerId, card, unit) => {
  if (playerId === unit.ownerPlayerId) {
    return true;
  }
  const isSpell = card.type === "Spell";
  for (const modifier of state.modifiers) {
    const guard = getTargetingGuard(modifier);
    if (!guard) {
      continue;
    }
    if (!guardAppliesToChampion(modifier, guard, unit.id, unit.ownerPlayerId)) {
      continue;
    }
    if (guard.blockEnemyCards) {
      return false;
    }
    if (guard.blockEnemySpells && isSpell) {
      return false;
    }
  }
  return true;
};
var getChampionTarget = (state, playerId, targetSpec, targets, card) => {
  const unitId = getChampionTargetId(targets);
  if (!unitId) {
    return null;
  }
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return null;
  }
  if (!state.board.hexes[unit.hex]) {
    return null;
  }
  const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
  if (owner !== "self" && owner !== "enemy" && owner !== "any") {
    return null;
  }
  if (owner === "self" && unit.ownerPlayerId !== playerId) {
    return null;
  }
  if (owner === "enemy" && unit.ownerPlayerId === playerId) {
    return null;
  }
  if (targetSpec.requiresFriendlyChampion === true) {
    const maxDistance = typeof targetSpec.maxDistance === "number" ? targetSpec.maxDistance : NaN;
    if (!hasFriendlyChampionWithinRange(state, playerId, unit.hex, maxDistance)) {
      return null;
    }
  }
  if (card && !isChampionTargetableByCard(state, playerId, card, unit)) {
    return null;
  }
  return { unitId, unit };
};
var resolveHexTarget = (state, playerId, targetSpec, hexKey) => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return null;
  }
  const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "any";
  if (owner !== "self" && owner !== "enemy" && owner !== "any") {
    return null;
  }
  const allowEmpty = targetSpec.allowEmpty === true;
  const requiresEmpty = targetSpec.requiresEmpty === true;
  const isEmpty = countPlayersOnHex(hex) === 0;
  if (owner === "self" && !isOccupiedByPlayer(hex, playerId)) {
    if (!(allowEmpty || requiresEmpty) || !isEmpty) {
      return null;
    }
  }
  if (owner === "enemy" && !hasEnemyUnits(hex, playerId)) {
    return null;
  }
  const requiresOccupied = targetSpec.occupied === true;
  if (requiresOccupied && isEmpty) {
    return null;
  }
  const tile = typeof targetSpec.tile === "string" ? targetSpec.tile : null;
  if (tile && hex.tile !== tile) {
    return null;
  }
  if (targetSpec.allowCapital === false && hex.tile === "capital") {
    return null;
  }
  if (requiresEmpty && !isEmpty) {
    return null;
  }
  const maxDistanceFromCapital = typeof targetSpec.maxDistanceFromCapital === "number" ? targetSpec.maxDistanceFromCapital : NaN;
  if (Number.isFinite(maxDistanceFromCapital)) {
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      return null;
    }
    if (!state.board.hexes[player.capitalHex]) {
      return null;
    }
    if (!isWithinDistance(player.capitalHex, hexKey, maxDistanceFromCapital)) {
      return null;
    }
  }
  const maxDistance = typeof targetSpec.maxDistanceFromFriendlyChampion === "number" ? targetSpec.maxDistanceFromFriendlyChampion : NaN;
  if (Number.isFinite(maxDistance)) {
    if (!hasFriendlyChampionWithinRange(state, playerId, hexKey, maxDistance)) {
      return null;
    }
  }
  return { hexKey, hex };
};
var getHexTarget = (state, playerId, targetSpec, targets) => {
  const hexKey = getHexKeyTarget(targets);
  if (!hexKey) {
    return null;
  }
  return resolveHexTarget(state, playerId, targetSpec, hexKey);
};
var getHexPairTarget = (state, playerId, targetSpec, targets) => {
  const record = getTargetRecord(targets);
  const explicitKeys = Array.isArray(record?.hexKeys) ? record?.hexKeys : null;
  const rawKeys = explicitKeys && explicitKeys.length > 0 ? explicitKeys : typeof record?.from === "string" && typeof record?.to === "string" ? [record.from, record.to] : null;
  if (!rawKeys || rawKeys.length !== 2) {
    return null;
  }
  const [rawFrom, rawTo] = rawKeys;
  if (typeof rawFrom !== "string" || typeof rawTo !== "string") {
    return null;
  }
  if (rawFrom.length === 0 || rawTo.length === 0) {
    return null;
  }
  const allowSame = targetSpec.allowSame === true;
  if (!allowSame && rawFrom === rawTo) {
    return null;
  }
  const fromTarget = resolveHexTarget(state, playerId, targetSpec, rawFrom);
  if (!fromTarget) {
    return null;
  }
  const toTarget = resolveHexTarget(state, playerId, targetSpec, rawTo);
  if (!toTarget) {
    return null;
  }
  return { from: fromTarget.hexKey, to: toTarget.hexKey };
};
var addHexLinkModifier = (state, playerId, cardId, from, to) => {
  if (from === to) {
    return state;
  }
  const modifierId = `card.${cardId}.${playerId}.${state.revision}.${from}.${to}.link`;
  return {
    ...state,
    modifiers: [
      ...state.modifiers,
      {
        id: modifierId,
        source: { type: "card", sourceId: cardId },
        ownerPlayerId: playerId,
        duration: { type: "endOfRound" },
        data: { link: { from, to } },
        hooks: {
          getMoveAdjacency: ({ modifier, playerId: movingPlayerId, from: from2, to: to2 }, current) => {
            if (current) {
              return true;
            }
            if (modifier.ownerPlayerId && modifier.ownerPlayerId !== movingPlayerId) {
              return current;
            }
            const link = modifier.data?.link;
            if (!link?.from || !link?.to) {
              return current;
            }
            if (link.from === from2 && link.to === to2) {
              return true;
            }
            if (link.from === to2 && link.to === from2) {
              return true;
            }
            return current;
          }
        }
      }
    ]
  };
};
var getBuildBridgePlan = (state, playerId, targetSpec, targets) => {
  const edgeKey = getEdgeKeyTarget(targets);
  if (!edgeKey) {
    return null;
  }
  let rawA;
  let rawB;
  try {
    [rawA, rawB] = parseEdgeKey(edgeKey);
  } catch {
    return null;
  }
  const fromHex = state.board.hexes[rawA];
  const toHex = state.board.hexes[rawB];
  if (!fromHex || !toHex) {
    return null;
  }
  try {
    if (!areAdjacent(parseHexKey(rawA), parseHexKey(rawB))) {
      return null;
    }
  } catch {
    return null;
  }
  const canonicalKey = getBridgeKey(rawA, rawB);
  if (state.board.bridges[canonicalKey]) {
    return null;
  }
  const allowAnywhere = targetSpec.anywhere === true;
  const requiresOccupiedEndpoint = allowAnywhere ? false : targetSpec.requiresOccupiedEndpoint !== false;
  if (requiresOccupiedEndpoint && !isOccupiedByPlayer(fromHex, playerId) && !isOccupiedByPlayer(toHex, playerId)) {
    return null;
  }
  return { from: rawA, to: rawB, key: canonicalKey };
};
var getBuildBridgePlans = (state, playerId, targetSpec, targets) => {
  const edgeKeys = getEdgeKeyTargets(targets);
  if (!edgeKeys || edgeKeys.length === 0) {
    return null;
  }
  const plans = [];
  const seen = /* @__PURE__ */ new Set();
  for (const edgeKey of edgeKeys) {
    const plan = getBuildBridgePlan(state, playerId, targetSpec, { edgeKey });
    if (!plan || seen.has(plan.key)) {
      return null;
    }
    seen.add(plan.key);
    plans.push(plan);
  }
  return plans;
};
var getExistingBridgePlan = (state, playerId, targetSpec, targets) => {
  const edgeKey = getEdgeKeyTarget(targets);
  if (!edgeKey) {
    return null;
  }
  let rawA;
  let rawB;
  try {
    [rawA, rawB] = parseEdgeKey(edgeKey);
  } catch {
    return null;
  }
  const fromHex = state.board.hexes[rawA];
  const toHex = state.board.hexes[rawB];
  if (!fromHex || !toHex) {
    return null;
  }
  try {
    if (!areAdjacent(parseHexKey(rawA), parseHexKey(rawB))) {
      return null;
    }
  } catch {
    return null;
  }
  const canonicalKey = getBridgeKey(rawA, rawB);
  if (!state.board.bridges[canonicalKey]) {
    return null;
  }
  const allowAnywhere = targetSpec.anywhere === true;
  const requiresOccupiedEndpoint = allowAnywhere ? false : targetSpec.requiresOccupiedEndpoint !== false;
  if (requiresOccupiedEndpoint && !isOccupiedByPlayer(fromHex, playerId) && !isOccupiedByPlayer(toHex, playerId)) {
    return null;
  }
  return { from: rawA, to: rawB, key: canonicalKey };
};
var getExistingBridgePlans = (state, playerId, targetSpec, targets) => {
  const edgeKeys = getEdgeKeyTargets(targets);
  if (!edgeKeys || edgeKeys.length === 0) {
    return null;
  }
  const plans = [];
  const seen = /* @__PURE__ */ new Set();
  for (const edgeKey of edgeKeys) {
    const plan = getExistingBridgePlan(state, playerId, targetSpec, { edgeKey });
    if (!plan || seen.has(plan.key)) {
      return null;
    }
    seen.add(plan.key);
    plans.push(plan);
  }
  return plans;
};
var getBridgePivotPlans = (state, playerId, targetSpec, targets) => {
  const edgeKeys = getEdgeKeyTargets(targets);
  if (!edgeKeys || edgeKeys.length === 0) {
    return null;
  }
  const minEdges = typeof targetSpec.minEdges === "number" ? Math.max(0, Math.floor(targetSpec.minEdges)) : 2;
  const maxEdges = typeof targetSpec.maxEdges === "number" ? Math.max(0, Math.floor(targetSpec.maxEdges)) : 2;
  if (edgeKeys.length < minEdges || edgeKeys.length > maxEdges) {
    return null;
  }
  let existing = null;
  let build = null;
  for (const edgeKey of edgeKeys) {
    let rawA;
    let rawB;
    try {
      [rawA, rawB] = parseEdgeKey(edgeKey);
    } catch {
      return null;
    }
    const canonicalKey = getBridgeKey(rawA, rawB);
    if (state.board.bridges[canonicalKey]) {
      const plan = getExistingBridgePlan(state, playerId, targetSpec, { edgeKey });
      if (!plan || existing) {
        return null;
      }
      existing = plan;
    } else {
      const plan = getBuildBridgePlan(state, playerId, targetSpec, { edgeKey });
      if (!plan || build) {
        return null;
      }
      build = plan;
    }
  }
  if (!existing || !build) {
    return null;
  }
  const sharedHex = existing.from === build.from || existing.from === build.to ? existing.from : existing.to === build.from || existing.to === build.to ? existing.to : null;
  if (!sharedHex) {
    return null;
  }
  const allowAnywhere = targetSpec.anywhere === true;
  if (!allowAnywhere) {
    const shared = state.board.hexes[sharedHex];
    if (!shared || !isOccupiedByPlayer(shared, playerId)) {
      return null;
    }
  }
  return { existing, build, sharedHex };
};
var validateMovePath = (state, playerId, path, options) => {
  if (path.length < 2) {
    return null;
  }
  for (const hexKey of path) {
    if (!state.board.hexes[hexKey]) {
      return null;
    }
  }
  const fromHex = state.board.hexes[path[0]];
  if (!fromHex) {
    return null;
  }
  const providedUnits = Array.isArray(options.movingUnitIds) && options.movingUnitIds.length > 0 ? options.movingUnitIds : null;
  const movingUnitIds = providedUnits ? providedUnits : selectMovingUnits(
    state.board,
    playerId,
    path[0],
    options.forceCount,
    options.includeChampions
  );
  if (providedUnits) {
    const occupantSet = new Set(fromHex.occupants[playerId] ?? []);
    if (!providedUnits.every((unitId) => occupantSet.has(unitId))) {
      return null;
    }
  }
  if (options.requireStartOccupied && movingUnitIds.length === 0) {
    return null;
  }
  let maxDistance = options.maxDistance;
  if (typeof maxDistance === "number") {
    maxDistance = getMoveMaxDistance(
      state,
      {
        playerId,
        from: path[0],
        to: path[path.length - 1],
        path,
        movingUnitIds
      },
      maxDistance
    );
    if (maxDistance <= 0 || path.length - 1 > maxDistance) {
      return null;
    }
  }
  const requiresBridge = getMoveRequiresBridge(
    state,
    {
      playerId,
      from: path[0],
      to: path[path.length - 1],
      path,
      movingUnitIds
    },
    options.requiresBridge
  );
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    let baseAdjacent = false;
    try {
      baseAdjacent = areAdjacent(parseHexKey(from), parseHexKey(to));
    } catch {
      return null;
    }
    const isAdjacent = getMoveAdjacency(
      state,
      { playerId, from, to, path, movingUnitIds },
      baseAdjacent
    );
    if (!isAdjacent) {
      return null;
    }
    if (requiresBridge && baseAdjacent && !hasBridge(state.board, from, to)) {
      return null;
    }
    if (index < path.length - 2) {
      const hex = state.board.hexes[to];
      if (hex && hasEnemyUnits(hex, playerId)) {
        return null;
      }
      if (hex && options.stopOnOccupied && countPlayersOnHex(hex) > 0) {
        return null;
      }
    }
  }
  const destination = state.board.hexes[path[path.length - 1]];
  if (destination && wouldExceedTwoPlayers(destination, playerId)) {
    return null;
  }
  return path;
};
var moveUnits = (state, playerId, unitIds, from, to) => {
  if (unitIds.length === 0 || from === to) {
    return state;
  }
  const fromHex = state.board.hexes[from];
  const toHex = state.board.hexes[to];
  if (!fromHex || !toHex) {
    return state;
  }
  const movingSet = new Set(unitIds);
  const fromUnits = fromHex.occupants[playerId] ?? [];
  const movingUnits = fromUnits.filter((unitId) => movingSet.has(unitId));
  if (movingUnits.length === 0) {
    return state;
  }
  const remainingUnits = fromUnits.filter((unitId) => !movingSet.has(unitId));
  const toUnits = [...toHex.occupants[playerId] ?? [], ...movingUnits];
  const units = { ...state.board.units };
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
    ...state,
    board: {
      ...state.board,
      units,
      hexes: {
        ...state.board.hexes,
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
    }
  };
};
var removeForcesFromHex = (state, playerId, hexKey, unitIds, count) => {
  if (!Number.isFinite(count) || count <= 0) {
    return state;
  }
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return state;
  }
  const occupants = hex.occupants[playerId] ?? [];
  if (occupants.length === 0) {
    return state;
  }
  const occupantSet = new Set(occupants);
  const eligible = unitIds.filter((unitId) => {
    if (!occupantSet.has(unitId)) {
      return false;
    }
    const unit = state.board.units[unitId];
    return unit?.kind === "force" && unit.ownerPlayerId === playerId;
  });
  if (eligible.length === 0) {
    return state;
  }
  const removeCount = Math.min(Math.floor(count), eligible.length);
  const removeIds = new Set(eligible.slice(0, removeCount));
  const nextUnits = { ...state.board.units };
  for (const unitId of removeIds) {
    delete nextUnits[unitId];
  }
  const nextOccupants = occupants.filter((unitId) => !removeIds.has(unitId));
  return {
    ...state,
    board: {
      ...state.board,
      units: nextUnits,
      hexes: {
        ...state.board.hexes,
        [hexKey]: {
          ...hex,
          occupants: {
            ...hex.occupants,
            [playerId]: nextOccupants
          }
        }
      }
    }
  };
};
var removeChampionFromBoard = (state, unitId) => {
  const unit = state.board.units[unitId];
  if (!unit || unit.kind !== "champion") {
    return state;
  }
  const hex = state.board.hexes[unit.hex];
  const nextUnits = { ...state.board.units };
  delete nextUnits[unitId];
  let nextState = {
    ...state,
    board: {
      ...state.board,
      units: nextUnits
    }
  };
  if (hex) {
    const occupants = (hex.occupants[unit.ownerPlayerId] ?? []).filter(
      (entry) => entry !== unitId
    );
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        hexes: {
          ...nextState.board.hexes,
          [unit.hex]: {
            ...hex,
            occupants: {
              ...hex.occupants,
              [unit.ownerPlayerId]: occupants
            }
          }
        }
      }
    };
  }
  nextState = removeChampionModifiers(nextState, [unitId]);
  const nextModifiers = nextState.modifiers.filter(
    (modifier) => modifier.attachedUnitId !== unitId
  );
  return nextModifiers.length === nextState.modifiers.length ? nextState : { ...nextState, modifiers: nextModifiers };
};
var moveUnitsAlongPath = (state, playerId, path, forceCount, includeChampions) => {
  const movingUnitIds = selectMovingUnits(
    state.board,
    playerId,
    path[0],
    forceCount,
    includeChampions
  );
  if (movingUnitIds.length === 0) {
    return state;
  }
  let nextState = state;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    nextState = moveUnits(nextState, playerId, movingUnitIds, from, to);
    nextState = runMoveEvents(nextState, { playerId, from, to, path, movingUnitIds });
  }
  return nextState;
};
var moveUnitIdsAlongPath = (state, playerId, path, movingUnitIds) => {
  if (movingUnitIds.length === 0) {
    return state;
  }
  let nextState = state;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    nextState = moveUnits(nextState, playerId, movingUnitIds, from, to);
    nextState = runMoveEvents(nextState, { playerId, from, to, path, movingUnitIds });
  }
  return nextState;
};
var isCardPlayable = (state, playerId, card, targets) => {
  if (!SUPPORTED_TARGET_KINDS.has(card.targetSpec.kind)) {
    return false;
  }
  const hasEffects = Array.isArray(card.effects) && card.effects.length > 0;
  const isChampionCard = card.type === "Champion";
  if (!isChampionCard && !hasEffects) {
    return false;
  }
  if (hasEffects && !card.effects?.every((effect) => SUPPORTED_EFFECTS.has(effect.kind))) {
    return false;
  }
  if (isChampionCard) {
    if (!card.champion) {
      return false;
    }
    if (countPlayerChampions(state.board, playerId) >= state.config.CHAMPION_LIMIT) {
      return false;
    }
  }
  if (card.targetSpec.kind === "none") {
    const getHandEffectCount = (kind, defaultCount) => {
      const effect = card.effects?.find((entry) => entry.kind === kind);
      if (!effect) {
        return 0;
      }
      const rawCount = typeof effect.count === "number" ? effect.count : defaultCount;
      return Math.max(0, Math.floor(rawCount));
    };
    const discardCount = getHandEffectCount("discardFromHand", 1);
    const burnCount = getHandEffectCount("burnFromHand", 1);
    const topdeckCount = getHandEffectCount("topdeckFromHand", 1);
    if (targets == null) {
      if (discardCount > 0 || burnCount > 0) {
        return false;
      }
      return true;
    }
    if (discardCount === 0 && burnCount === 0 && topdeckCount === 0) {
      return false;
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) {
      return false;
    }
    const targetIds = getCardInstanceTargets(targets);
    if (targetIds.length === 0) {
      return false;
    }
    const uniqueIds = new Set(targetIds);
    if (uniqueIds.size !== targetIds.length) {
      return false;
    }
    if (!targetIds.every((id) => player.deck.hand.includes(id))) {
      return false;
    }
    const requiredCount = Math.max(discardCount, burnCount);
    if (requiredCount > 0) {
      return targetIds.length === requiredCount;
    }
    return targetIds.length <= topdeckCount;
  }
  if (card.targetSpec.kind === "hex") {
    const target = getHexTarget(
      state,
      playerId,
      card.targetSpec,
      targets ?? null
    );
    if (!target) {
      return false;
    }
    const mortarEffect = card.effects?.find(
      (effect) => effect.kind === "mortarShot"
    );
    if (mortarEffect) {
      const maxDistance = typeof mortarEffect.maxDistance === "number" ? mortarEffect.maxDistance : 2;
      if (!hasFriendlyForceWithinRange(state, playerId, target.hexKey, maxDistance)) {
        return false;
      }
    }
    if (card.effects?.some((effect) => effect.kind === "deployForces")) {
      return !wouldExceedTwoPlayers(target.hex, playerId);
    }
    return true;
  }
  if (card.targetSpec.kind === "hexPair") {
    return Boolean(
      getHexPairTarget(state, playerId, card.targetSpec, targets ?? null)
    );
  }
  if (card.targetSpec.kind === "edge") {
    const hasBuildBridge = card.effects?.some((effect) => effect.kind === "buildBridge") ?? false;
    const hasExistingBridgeEffect = card.effects?.some(
      (effect) => effect.kind === "lockBridge" || effect.kind === "trapBridge" || effect.kind === "destroyBridge"
    ) ?? false;
    const plan = hasBuildBridge ? getBuildBridgePlan(state, playerId, card.targetSpec, targets ?? null) : hasExistingBridgeEffect ? getExistingBridgePlan(state, playerId, card.targetSpec, targets ?? null) : getBuildBridgePlan(state, playerId, card.targetSpec, targets ?? null);
    if (!plan) {
      return false;
    }
    if (!hasBuildBridge) {
      return true;
    }
    const movePath = getMovePathTarget(targets ?? null);
    if (!movePath) {
      return true;
    }
    const moveEffect = card.effects?.find(
      (effect) => effect.kind === "moveStack"
    );
    if (!moveEffect) {
      return true;
    }
    const maxDistance = typeof moveEffect.maxDistance === "number" ? moveEffect.maxDistance : typeof card.targetSpec.maxDistance === "number" ? card.targetSpec.maxDistance : void 0;
    const requiresBridge = moveEffect.requiresBridge === false ? false : card.targetSpec.requiresBridge !== false;
    const forceCount = getMoveStackForceCount(card, moveEffect, targets ?? null);
    const stopOnOccupied = moveEffect.stopOnOccupied === true || card.targetSpec?.stopOnOccupied === true;
    let moveState = state;
    if (card.effects?.some((effect) => effect.kind === "buildBridge")) {
      moveState = {
        ...state,
        board: {
          ...state.board,
          bridges: {
            ...state.board.bridges,
            [plan.key]: {
              key: plan.key,
              from: plan.from,
              to: plan.to
            }
          }
        }
      };
    }
    return Boolean(
      validateMovePath(moveState, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        forceCount,
        stopOnOccupied
      })
    );
  }
  if (card.targetSpec.kind === "multiEdge") {
    const targetSpec = card.targetSpec;
    const edgeKeys = getEdgeKeyTargets(targets ?? null);
    if (!edgeKeys || edgeKeys.length === 0) {
      return false;
    }
    const minEdges = typeof targetSpec.minEdges === "number" ? Math.max(0, Math.floor(targetSpec.minEdges)) : 1;
    const maxEdges = typeof targetSpec.maxEdges === "number" ? Math.max(0, Math.floor(targetSpec.maxEdges)) : Number.POSITIVE_INFINITY;
    if (edgeKeys.length < minEdges || edgeKeys.length > maxEdges) {
      return false;
    }
    const hasBridgePivot = card.effects?.some((effect) => effect.kind === "bridgePivot") ?? false;
    if (hasBridgePivot) {
      return Boolean(getBridgePivotPlans(state, playerId, targetSpec, targets ?? null));
    }
    const hasBuildBridge = card.effects?.some((effect) => effect.kind === "buildBridge") ?? false;
    const hasExistingBridgeEffect = card.effects?.some(
      (effect) => effect.kind === "lockBridge" || effect.kind === "trapBridge" || effect.kind === "destroyBridge"
    ) ?? false;
    const planResolver = hasBuildBridge ? getBuildBridgePlan : hasExistingBridgeEffect ? getExistingBridgePlan : getBuildBridgePlan;
    const seen = /* @__PURE__ */ new Set();
    for (const edgeKey of edgeKeys) {
      const plan = planResolver(state, playerId, targetSpec, { edgeKey });
      if (!plan || seen.has(plan.key)) {
        return false;
      }
      seen.add(plan.key);
    }
    return true;
  }
  if (card.targetSpec.kind === "multiPath") {
    const targetSpec = card.targetSpec;
    const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
    if (owner !== "self") {
      return false;
    }
    const paths = getMultiPathTargets(targets ?? null);
    if (!paths || paths.length === 0) {
      return false;
    }
    const minPaths = typeof targetSpec.minPaths === "number" ? Math.max(0, Math.floor(targetSpec.minPaths)) : 1;
    const maxPaths = typeof targetSpec.maxPaths === "number" ? Math.max(0, Math.floor(targetSpec.maxPaths)) : Number.POSITIVE_INFINITY;
    if (paths.length < minPaths || paths.length > maxPaths) {
      return false;
    }
    const moveEffect = card.effects?.find(
      (effect) => effect.kind === "moveStacks"
    );
    const maxDistance = typeof moveEffect?.maxDistance === "number" ? moveEffect.maxDistance : typeof targetSpec.maxDistance === "number" ? targetSpec.maxDistance : void 0;
    const requiresBridge = moveEffect?.requiresBridge === false ? false : targetSpec.requiresBridge !== false;
    const stopOnOccupied = moveEffect?.stopOnOccupied === true || targetSpec.stopOnOccupied === true;
    const seenStarts = /* @__PURE__ */ new Set();
    let moveState = state;
    for (const path of paths) {
      const start = path[0];
      if (seenStarts.has(start)) {
        return false;
      }
      seenStarts.add(start);
      if (!validateMovePath(moveState, playerId, path, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        stopOnOccupied
      })) {
        return false;
      }
      moveState = markPlayerMovedThisRound(moveState, playerId);
    }
    return true;
  }
  if (card.targetSpec.kind === "stack" || card.targetSpec.kind === "path") {
    const owner = typeof card.targetSpec.owner === "string" ? card.targetSpec.owner : "self";
    if (owner !== "self") {
      return false;
    }
    const movePath = getMovePathTarget(targets ?? null);
    if (!movePath) {
      return false;
    }
    const maxDistance = typeof card.targetSpec.maxDistance === "number" ? card.targetSpec.maxDistance : void 0;
    const requiresBridge = card.targetSpec.requiresBridge !== false;
    const moveEffect = card.effects?.find(
      (effect) => effect.kind === "moveStack"
    );
    const forceCount = getMoveStackForceCount(card, moveEffect, targets ?? null);
    const stopOnOccupied = moveEffect?.stopOnOccupied === true || card.targetSpec.stopOnOccupied === true;
    return Boolean(
      validateMovePath(state, playerId, movePath, {
        maxDistance,
        requiresBridge,
        requireStartOccupied: true,
        forceCount,
        stopOnOccupied
      })
    );
  }
  if (card.targetSpec.kind === "champion") {
    const target = getChampionTarget(
      state,
      playerId,
      card.targetSpec,
      targets ?? null,
      card
    );
    if (!target) {
      return false;
    }
    const needsCapital = card.effects?.some(
      (effect) => effect.kind === "evacuateChampion"
    );
    if (!needsCapital) {
      return true;
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player?.capitalHex) {
      return false;
    }
    const capitalHex = state.board.hexes[player.capitalHex];
    if (!capitalHex) {
      return false;
    }
    return !wouldExceedTwoPlayers(capitalHex, playerId);
  }
  if (card.targetSpec.kind === "choice") {
    const choice = getChoiceTarget(targets ?? null);
    if (!choice) {
      return false;
    }
    const options = Array.isArray(card.targetSpec.options) ? card.targetSpec.options : [];
    const matchingOptions = options.filter((option) => option.kind === choice.kind);
    if (matchingOptions.length === 0) {
      return false;
    }
    if (choice.kind === "capital") {
      return Boolean(resolveCapitalDeployHex(state, playerId, choice.hexKey ?? null));
    }
    if (choice.kind === "occupiedHex") {
      const hex = state.board.hexes[choice.hexKey];
      if (!hex) {
        return false;
      }
      if (!isOccupiedByPlayer(hex, playerId)) {
        return false;
      }
      const tileAllowed = matchingOptions.some((option) => {
        const tile = typeof option.tile === "string" ? option.tile : null;
        return !tile || tile === hex.tile;
      });
      if (!tileAllowed) {
        return false;
      }
      return !wouldExceedTwoPlayers(hex, playerId);
    }
  }
  return false;
};
var addGold4 = (state, playerId, amount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? {
        ...player,
        resources: {
          ...player.resources,
          gold: player.resources.gold + amount
        }
      } : player
    )
  };
};
var addMana = (state, playerId, amount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  return {
    ...state,
    players: state.players.map(
      (player) => player.id === playerId ? {
        ...player,
        resources: {
          ...player.resources,
          mana: player.resources.mana + amount
        }
      } : player
    )
  };
};
var playerOccupiesTile = (state, playerId, tileType) => {
  return Object.values(state.board.hexes).some(
    (hex) => hex.tile === tileType && (hex.occupants[playerId]?.length ?? 0) > 0
  );
};
var playerOccupiesEnemyCapital = (state, playerId) => {
  return Object.values(state.board.hexes).some((hex) => {
    if (hex.tile !== "capital") {
      return false;
    }
    if (!hex.ownerPlayerId || hex.ownerPlayerId === playerId) {
      return false;
    }
    return (hex.occupants[playerId]?.length ?? 0) > 0;
  });
};
var resolveCardEffects = (state, playerId, card, targets) => {
  let nextState = state;
  if (card.type === "Champion" && card.champion) {
    const target = getHexTarget(
      nextState,
      playerId,
      card.targetSpec,
      targets ?? null
    );
    if (target) {
      const deployed = addChampionToHex(nextState.board, playerId, target.hexKey, {
        cardDefId: card.id,
        hp: card.champion.hp,
        attackDice: card.champion.attackDice,
        hitFaces: card.champion.hitFaces,
        bounty: card.champion.bounty
      });
      nextState = {
        ...nextState,
        board: deployed.board
      };
      nextState = applyChampionDeployment(nextState, deployed.unitId, card.id, playerId);
    }
  }
  for (const effect of card.effects ?? []) {
    switch (effect.kind) {
      case "gainGold": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = addGold4(nextState, playerId, amount);
        break;
      }
      case "gainGoldIfEnemyCapital": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        if (amount <= 0) {
          break;
        }
        if (!playerOccupiesEnemyCapital(nextState, playerId)) {
          break;
        }
        nextState = addGold4(nextState, playerId, amount);
        break;
      }
      case "gainMana": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = addMana(nextState, playerId, amount);
        break;
      }
      case "gainManaIfTile": {
        const tile = typeof effect.tile === "string" ? effect.tile : null;
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        if (!tile || amount <= 0) {
          break;
        }
        if (playerOccupiesTile(nextState, playerId, tile)) {
          nextState = addMana(nextState, playerId, amount);
        }
        break;
      }
      case "drawCards": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        nextState = drawCards(nextState, playerId, count);
        break;
      }
      case "discardFromHand": {
        const count = typeof effect.count === "number" ? effect.count : 1;
        if (count <= 0) {
          break;
        }
        const targetIds = getCardInstanceTargets(targets ?? null);
        if (targetIds.length === 0) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        const uniqueTargets = [...new Set(targetIds)];
        const validTargets = uniqueTargets.filter((id) => player.deck.hand.includes(id));
        if (validTargets.length < count) {
          break;
        }
        for (const cardInstanceId of validTargets.slice(0, count)) {
          nextState = discardCardFromHand(nextState, playerId, cardInstanceId, {
            countAsDiscard: true
          });
        }
        break;
      }
      case "burnFromHand": {
        const count = typeof effect.count === "number" ? effect.count : 1;
        if (count <= 0) {
          break;
        }
        const targetIds = getCardInstanceTargets(targets ?? null);
        if (targetIds.length === 0) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        const uniqueTargets = [...new Set(targetIds)];
        const validTargets = uniqueTargets.filter((id) => player.deck.hand.includes(id));
        if (validTargets.length < count) {
          break;
        }
        for (const cardInstanceId of validTargets.slice(0, count)) {
          const removed = removeCardFromHand(nextState, playerId, cardInstanceId);
          nextState = addCardToBurned(removed, playerId, cardInstanceId);
        }
        break;
      }
      case "drawCardsOtherPlayers": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        if (count <= 0) {
          break;
        }
        for (const player of nextState.players) {
          if (player.id === playerId) {
            continue;
          }
          nextState = drawCards(nextState, player.id, count);
        }
        break;
      }
      case "rollGold": {
        const sides = Number.isFinite(effect.sides) ? Math.max(1, Math.floor(effect.sides)) : 6;
        const highMin = Number.isFinite(effect.highMin) && Number(effect.highMin) >= 1 ? Math.floor(effect.highMin) : 5;
        const lowGain = typeof effect.lowGain === "number" ? effect.lowGain : 0;
        const highGain = typeof effect.highGain === "number" ? effect.highGain : 0;
        if (sides <= 0 || lowGain <= 0 && highGain <= 0) {
          break;
        }
        const threshold = Math.min(highMin, sides);
        const roll = randInt(nextState.rngState, 1, sides);
        nextState = { ...nextState, rngState: roll.next };
        const amount = roll.value >= threshold ? highGain : lowGain;
        if (amount > 0) {
          nextState = addGold4(nextState, playerId, amount);
        }
        break;
      }
      case "drawCardsIfTile": {
        const tile = typeof effect.tile === "string" ? effect.tile : null;
        const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
        if (!tile || count <= 0) {
          break;
        }
        if (playerOccupiesTile(nextState, playerId, tile)) {
          nextState = drawCards(nextState, playerId, count);
        }
        break;
      }
      case "drawCardsIfHandEmpty": {
        const count = typeof effect.count === "number" ? effect.count : 0;
        if (count <= 0) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        if (player.deck.hand.length > 0) {
          break;
        }
        nextState = drawCards(nextState, playerId, count);
        break;
      }
      case "topdeckFromHand": {
        const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 1;
        if (count <= 0) {
          break;
        }
        const targetIds = getCardInstanceTargets(targets ?? null);
        if (targetIds.length === 0) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        const validTargets = targetIds.filter((id) => player.deck.hand.includes(id));
        if (validTargets.length === 0) {
          break;
        }
        for (const cardInstanceId of validTargets.slice(0, count)) {
          nextState = topdeckCardFromHand(nextState, playerId, cardInstanceId);
        }
        break;
      }
      case "scoutReport": {
        const lookCount = Math.max(0, Number(effect.lookCount) || 0);
        const keepCount = Math.max(0, Number(effect.keepCount) || 0);
        if (lookCount <= 0) {
          break;
        }
        const taken = takeTopCards(nextState, playerId, lookCount);
        nextState = taken.state;
        const maxKeep = Math.min(keepCount, taken.cards.length);
        if (maxKeep <= 0) {
          for (const cardId of taken.cards) {
            nextState = addCardToDiscardPile(nextState, playerId, cardId, {
              countAsDiscard: true
            });
          }
          break;
        }
        if (maxKeep >= taken.cards.length || nextState.blocks) {
          const keep = taken.cards.slice(0, maxKeep);
          const discard = taken.cards.filter((cardId) => !keep.includes(cardId));
          for (const cardId of keep) {
            nextState = addCardToHandWithOverflow(nextState, playerId, cardId);
          }
          for (const cardId of discard) {
            nextState = addCardToDiscardPile(nextState, playerId, cardId, {
              countAsDiscard: true
            });
          }
          break;
        }
        nextState = {
          ...nextState,
          blocks: {
            type: "action.scoutReport",
            waitingFor: [playerId],
            payload: {
              playerId,
              offers: taken.cards,
              keepCount: maxKeep,
              chosen: null
            }
          }
        };
        break;
      }
      case "prospecting": {
        const baseGold = typeof effect.baseGold === "number" ? effect.baseGold : 0;
        const bonusIfMine = typeof effect.bonusIfMine === "number" ? effect.bonusIfMine : 0;
        const amount = baseGold + (bonusIfMine > 0 && playerOccupiesTile(nextState, playerId, "mine") ? bonusIfMine : 0);
        nextState = addGold4(nextState, playerId, amount);
        break;
      }
      case "recruit": {
        const choice = getChoiceTarget(targets ?? null);
        if (!choice) {
          break;
        }
        const options = Array.isArray(card.targetSpec.options) ? card.targetSpec.options : [];
        const capitalCountRaw = typeof effect.capitalCount === "number" ? effect.capitalCount : 2;
        const occupiedCountRaw = typeof effect.occupiedCount === "number" ? effect.occupiedCount : 1;
        const capitalCount = Math.max(0, Math.floor(capitalCountRaw));
        const occupiedCount = Math.max(0, Math.floor(occupiedCountRaw));
        if (choice.kind === "capital") {
          if (!options.some((option) => option.kind === "capital")) {
            break;
          }
          const deployHex = resolveCapitalDeployHex(nextState, playerId, choice.hexKey ?? null);
          if (!deployHex) {
            break;
          }
          const baseCount = capitalCount;
          const count = getDeployForcesCount(
            nextState,
            { playerId, hexKey: deployHex, baseCount },
            baseCount
          );
          nextState = {
            ...nextState,
            board: addForcesToHex(nextState.board, playerId, deployHex, count)
          };
          break;
        }
        if (choice.kind === "occupiedHex") {
          const hex = nextState.board.hexes[choice.hexKey];
          if (!hex) {
            break;
          }
          if (!isOccupiedByPlayer(hex, playerId)) {
            break;
          }
          const tileAllowed = options.some((option) => {
            if (option.kind !== "occupiedHex") {
              return false;
            }
            const tile = typeof option.tile === "string" ? option.tile : null;
            return !tile || tile === hex.tile;
          });
          if (!tileAllowed) {
            break;
          }
          if (wouldExceedTwoPlayers(hex, playerId)) {
            break;
          }
          const baseCount = occupiedCount;
          const count = getDeployForcesCount(
            nextState,
            { playerId, hexKey: choice.hexKey, baseCount },
            baseCount
          );
          nextState = {
            ...nextState,
            board: addForcesToHex(nextState.board, playerId, choice.hexKey, count)
          };
        }
        break;
      }
      case "recruitByHandSize": {
        const choice = getChoiceTarget(targets ?? null);
        if (!choice || choice.kind !== "capital") {
          break;
        }
        const options = Array.isArray(card.targetSpec.options) ? card.targetSpec.options : [];
        if (!options.some((option) => option.kind === "capital")) {
          break;
        }
        const deployHex = resolveCapitalDeployHex(nextState, playerId, choice.hexKey ?? null);
        if (!deployHex) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        const baseCount = Math.max(0, Math.floor(player.deck.hand.length));
        const count = getDeployForcesCount(
          nextState,
          { playerId, hexKey: deployHex, baseCount },
          baseCount
        );
        if (count <= 0) {
          break;
        }
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, deployHex, count)
        };
        break;
      }
      case "deployForces": {
        let targetHexKey = null;
        if (card.targetSpec.kind === "champion") {
          const target = getChampionTarget(
            nextState,
            playerId,
            card.targetSpec,
            targets ?? null,
            card
          );
          if (!target) {
            break;
          }
          targetHexKey = target.unit.hex;
        } else {
          const target = getHexTarget(
            nextState,
            playerId,
            card.targetSpec,
            targets ?? null
          );
          if (!target) {
            break;
          }
          targetHexKey = target.hexKey;
        }
        if (!targetHexKey) {
          break;
        }
        const targetHex = nextState.board.hexes[targetHexKey];
        if (!targetHex) {
          break;
        }
        if (wouldExceedTwoPlayers(targetHex, playerId)) {
          break;
        }
        const baseCount = typeof effect.count === "number" ? effect.count : 0;
        if (baseCount <= 0) {
          break;
        }
        const count = getDeployForcesCount(
          nextState,
          { playerId, hexKey: targetHexKey, baseCount },
          baseCount
        );
        if (count <= 0) {
          break;
        }
        nextState = {
          ...nextState,
          board: addForcesToHex(nextState.board, playerId, targetHexKey, count)
        };
        break;
      }
      case "deployForcesOnMines": {
        const count = typeof effect.count === "number" ? Math.max(0, Math.floor(effect.count)) : 0;
        if (count <= 0) {
          break;
        }
        for (const hex of Object.values(nextState.board.hexes)) {
          if (hex.tile !== "mine") {
            continue;
          }
          if (!isOccupiedByPlayer(hex, playerId)) {
            continue;
          }
          nextState = {
            ...nextState,
            board: addForcesToHex(nextState.board, playerId, hex.key, count)
          };
        }
        break;
      }
      case "evacuateChampion": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player?.capitalHex) {
          break;
        }
        const capitalHex = nextState.board.hexes[player.capitalHex];
        if (!capitalHex) {
          break;
        }
        if (wouldExceedTwoPlayers(capitalHex, playerId)) {
          break;
        }
        nextState = {
          ...nextState,
          board: moveUnitToHex(nextState.board, target.unitId, player.capitalHex)
        };
        break;
      }
      case "recallChampion": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const cardDefId = target.unit.cardDefId;
        nextState = removeChampionFromBoard(nextState, target.unitId);
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player) {
          break;
        }
        let recalledInstanceId = null;
        for (const instanceId of player.burned) {
          const defId = nextState.cardsByInstanceId[instanceId]?.defId;
          if (defId === cardDefId) {
            recalledInstanceId = instanceId;
            break;
          }
        }
        if (recalledInstanceId) {
          nextState = {
            ...nextState,
            players: nextState.players.map(
              (entry) => entry.id === playerId ? {
                ...entry,
                burned: entry.burned.filter((id) => id !== recalledInstanceId)
              } : entry
            )
          };
        } else {
          const created = createCardInstance(nextState, cardDefId);
          nextState = created.state;
          recalledInstanceId = created.instanceId;
        }
        if (recalledInstanceId) {
          nextState = addCardToHandWithOverflow(nextState, playerId, recalledInstanceId);
        }
        break;
      }
      case "increaseMineValue": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const current = target.hex.mineValue;
        if (typeof current !== "number") {
          break;
        }
        const amount = typeof effect.amount === "number" ? effect.amount : NaN;
        if (!Number.isFinite(amount) || amount <= 0) {
          break;
        }
        const maxValue = typeof effect.maxValue === "number" ? effect.maxValue : Number.POSITIVE_INFINITY;
        const nextValue = Math.min(current + amount, maxValue);
        if (nextValue === current) {
          break;
        }
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            hexes: {
              ...nextState.board.hexes,
              [target.hexKey]: {
                ...target.hex,
                mineValue: nextValue
              }
            }
          }
        };
        break;
      }
      case "healChampion": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = healChampion(nextState, target.unitId, amount);
        break;
      }
      case "healChampions": {
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        if (amount <= 0) {
          break;
        }
        const unitIds = Object.keys(nextState.board.units);
        for (const unitId of unitIds) {
          const unit = nextState.board.units[unitId];
          if (!unit || unit.kind !== "champion") {
            continue;
          }
          if (unit.ownerPlayerId !== playerId) {
            continue;
          }
          nextState = healChampion(nextState, unitId, amount);
        }
        break;
      }
      case "dealChampionDamage": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const amount = typeof effect.amount === "number" ? effect.amount : 0;
        nextState = dealChampionDamage(nextState, playerId, target.unitId, amount);
        break;
      }
      case "encirclement": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const minAdjacent = typeof effect.minAdjacent === "number" ? Math.max(0, Math.floor(effect.minAdjacent)) : 3;
        const maxForces = typeof effect.maxForces === "number" ? Math.max(0, Math.floor(effect.maxForces)) : 6;
        if (maxForces <= 0) {
          break;
        }
        const neighbors = neighborHexKeys(target.hexKey).filter(
          (hexKey) => Boolean(nextState.board.hexes[hexKey])
        );
        const adjacentCount = neighbors.reduce((count, hexKey) => {
          const hex2 = nextState.board.hexes[hexKey];
          if (!hex2) {
            return count;
          }
          return isOccupiedByPlayer(hex2, playerId) ? count + 1 : count;
        }, 0);
        if (adjacentCount < minAdjacent) {
          break;
        }
        const hex = nextState.board.hexes[target.hexKey];
        if (!hex) {
          break;
        }
        const enemyEntry = Object.entries(hex.occupants).find(
          ([occupantId, units]) => occupantId !== playerId && units.length > 0
        );
        if (!enemyEntry) {
          break;
        }
        const [enemyId, unitIds] = enemyEntry;
        const enemyForces = unitIds.filter(
          (unitId) => nextState.board.units[unitId]?.kind === "force"
        );
        if (enemyForces.length === 0) {
          break;
        }
        const removeCount = Math.min(maxForces, enemyForces.length);
        nextState = removeForcesFromHex(nextState, enemyId, target.hexKey, unitIds, removeCount);
        break;
      }
      case "mortarShot": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const maxDistance = typeof effect.maxDistance === "number" ? effect.maxDistance : 2;
        if (!hasFriendlyForceWithinRange(nextState, playerId, target.hexKey, maxDistance)) {
          break;
        }
        const neighbors = neighborHexKeys(target.hexKey).filter(
          (hexKey) => Boolean(nextState.board.hexes[hexKey])
        );
        const roll = randInt(nextState.rngState, 0, 99);
        nextState = { ...nextState, rngState: roll.next };
        let strikeHexKey = target.hexKey;
        if (neighbors.length > 0 && roll.value >= 50) {
          const pick = randInt(nextState.rngState, 0, neighbors.length - 1);
          nextState = { ...nextState, rngState: pick.next };
          strikeHexKey = neighbors[pick.value] ?? neighbors[0];
        }
        const forceLoss = typeof effect.forceLoss === "number" ? effect.forceLoss : 4;
        let remainingLoss = Math.max(0, Math.floor(forceLoss));
        for (const player of nextState.players) {
          if (remainingLoss <= 0) {
            break;
          }
          const hex = nextState.board.hexes[strikeHexKey];
          if (!hex) {
            break;
          }
          const occupants = hex.occupants[player.id] ?? [];
          const available = occupants.filter(
            (unitId) => nextState.board.units[unitId]?.kind === "force"
          ).length;
          if (available <= 0) {
            continue;
          }
          const removeCount = Math.min(remainingLoss, available);
          nextState = removeForcesFromHex(
            nextState,
            player.id,
            strikeHexKey,
            occupants,
            removeCount
          );
          remainingLoss -= removeCount;
        }
        const damage = typeof effect.damage === "number" ? effect.damage : 2;
        if (damage > 0) {
          for (const unit of Object.values(nextState.board.units)) {
            if (unit.kind !== "champion") {
              continue;
            }
            if (unit.hex !== strikeHexKey) {
              continue;
            }
            nextState = dealChampionDamage(nextState, playerId, unit.id, damage);
          }
        }
        break;
      }
      case "patchUp": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const baseHeal = typeof effect.baseHeal === "number" ? effect.baseHeal : 0;
        const capitalBonus = typeof effect.capitalBonus === "number" ? effect.capitalBonus : 0;
        let amount = baseHeal;
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (player?.capitalHex && target.unit.hex === player.capitalHex) {
          amount += capitalBonus;
        }
        nextState = healChampion(nextState, target.unitId, amount);
        break;
      }
      case "holdTheLine": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.hexKey}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedHex: target.hexKey,
              duration: { type: "endOfRound" },
              hooks: {
                getForceHitFaces: ({ modifier, unit, defenderPlayerId }, current) => {
                  if (unit.kind !== "force") {
                    return current;
                  }
                  if (modifier.ownerPlayerId && modifier.ownerPlayerId !== unit.ownerPlayerId) {
                    return current;
                  }
                  if (defenderPlayerId !== unit.ownerPlayerId) {
                    return current;
                  }
                  return Math.max(current, 3);
                }
              }
            }
          ]
        };
        break;
      }
      case "markForCoin": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const bounty = typeof effect.bounty === "number" ? Math.max(0, effect.bounty) : 0;
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              data: {
                markedUnitId: target.unitId,
                bonusGold: bounty
              }
            }
          ]
        };
        break;
      }
      case "ward": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              data: {
                targeting: {
                  blockEnemyCards: true,
                  scope: "attachedUnit"
                }
              }
            }
          ]
        };
        break;
      }
      case "immunityField": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              data: {
                targeting: {
                  blockEnemySpells: true,
                  scope: "ownerChampions"
                }
              }
            }
          ]
        };
        break;
      }
      case "goldPlatedArmor": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const costPerDamage = typeof effect.costPerDamage === "number" ? effect.costPerDamage : 2;
        if (!Number.isFinite(costPerDamage) || costPerDamage <= 0) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.gold_armor`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              data: {
                goldArmor: {
                  costPerDamage
                }
              }
            }
          ]
        };
        break;
      }
      case "battleCry": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.battle_cry`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state: state2,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state2;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state2;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state2;
                  }
                  const tempModifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getChampionAttackDice: ({ unit, round: round2 }, current) => {
                        if (round2 !== 1 || unit.kind !== "champion") {
                          return current;
                        }
                        if (unit.ownerPlayerId !== ownerId) {
                          return current;
                        }
                        return current + 1;
                      }
                    }
                  };
                  const cleaned = removeModifierById(state2, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "smokeScreen": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.smoke_screen`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state: state2,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state2;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state2;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state2;
                  }
                  const tempModifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getForceHitFaces: ({ unit, round: round2 }, current) => {
                        if (round2 !== 1 || unit.kind !== "force") {
                          return current;
                        }
                        if (unit.ownerPlayerId === ownerId) {
                          return current;
                        }
                        return Math.min(current, 1);
                      }
                    }
                  };
                  const cleaned = removeModifierById(state2, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "shockDrill": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.shock_drill`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state: state2,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state2;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state2;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state2;
                  }
                  const tempModifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getForceHitFaces: ({ unit, round: round2 }, current) => {
                        if (round2 !== 1 || unit.kind !== "force") {
                          return current;
                        }
                        if (unit.ownerPlayerId !== ownerId) {
                          return current;
                        }
                        return Math.max(current, 5);
                      }
                    }
                  };
                  const cleaned = removeModifierById(state2, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "frenzy": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const diceBonus = typeof effect.diceBonus === "number" ? effect.diceBonus : 0;
        const damage = typeof effect.damage === "number" ? effect.damage : 0;
        nextState = dealChampionDamage(nextState, playerId, target.unitId, damage);
        const updated = nextState.board.units[target.unitId];
        if (!updated || updated.kind !== "champion") {
          break;
        }
        if (diceBonus <= 0) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.frenzy`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              hooks: {
                getChampionAttackDice: ({ unit }, current) => {
                  if (unit.kind !== "champion") {
                    return current;
                  }
                  if (unit.id !== target.unitId) {
                    return current;
                  }
                  return current + diceBonus;
                }
              }
            }
          ]
        };
        break;
      }
      case "slow": {
        const target = getChampionTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null,
          card
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.unitId}.slow`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedUnitId: target.unitId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({ state: state2, modifier, hexKey }) => {
                  const unitId = modifier.attachedUnitId;
                  if (!unitId) {
                    return state2;
                  }
                  const unit = state2.board.units[unitId];
                  if (!unit || unit.kind !== "champion") {
                    return state2;
                  }
                  if (unit.hex !== hexKey) {
                    return state2;
                  }
                  const tempModifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: modifier.ownerPlayerId,
                    attachedUnitId: unitId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getChampionAttackDice: ({ unit: unit2 }, current) => {
                        if (unit2.kind !== "champion" || unit2.id !== unitId) {
                          return current;
                        }
                        return Math.min(current, 1);
                      }
                    }
                  };
                  const cleaned = removeModifierById(state2, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "focusFire": {
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.focus_fire`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({
                  state: state2,
                  modifier,
                  hexKey,
                  round,
                  attackerPlayerId,
                  defenderPlayerId
                }) => {
                  if (round !== 1) {
                    return state2;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state2;
                  }
                  if (ownerId !== attackerPlayerId && ownerId !== defenderPlayerId) {
                    return state2;
                  }
                  const tempModifier = {
                    id: `${modifier.id}.battle`,
                    source: { type: "card", sourceId: card.id },
                    ownerPlayerId: ownerId,
                    attachedHex: hexKey,
                    duration: { type: "endOfBattle" },
                    hooks: {
                      getHitAssignmentPolicy: ({ targetSide, attackerPlayerId: attackerPlayerId2, defenderPlayerId: defenderPlayerId2 }, current) => {
                        if (ownerId === attackerPlayerId2 && targetSide === "defenders") {
                          return "focusFire";
                        }
                        if (ownerId === defenderPlayerId2 && targetSide === "attackers") {
                          return "focusFire";
                        }
                        return current;
                      }
                    }
                  };
                  const cleaned = removeModifierById(state2, modifier.id);
                  return { ...cleaned, modifiers: [...cleaned.modifiers, tempModifier] };
                }
              }
            }
          ]
        };
        break;
      }
      case "battleWinDraw": {
        const drawCountRaw = typeof effect.drawCount === "number" ? effect.drawCount : 0;
        const drawCount = Math.max(0, Math.floor(drawCountRaw));
        if (drawCount <= 0) {
          break;
        }
        const movePath = getMovePathTarget(targets ?? null);
        if (!movePath) {
          break;
        }
        const moveEffect = card.effects?.find(
          (entry) => entry.kind === "moveStack"
        );
        const forceCount = getMoveStackForceCount(card, moveEffect, targets ?? null);
        const movingUnitIds = selectMovingUnits(
          nextState.board,
          playerId,
          movePath[0],
          forceCount
        );
        if (movingUnitIds.length === 0) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.battle_win_draw`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              duration: { type: "endOfRound" },
              data: { trackedUnitIds: movingUnitIds, drawCount },
              hooks: {
                afterBattle: ({
                  state: state2,
                  modifier,
                  winnerPlayerId,
                  attackerPlayerId,
                  defenderPlayerId,
                  attackers,
                  defenders
                }) => {
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId || winnerPlayerId !== ownerId) {
                    return state2;
                  }
                  const trackedRaw = modifier.data?.trackedUnitIds;
                  if (!Array.isArray(trackedRaw) || trackedRaw.length === 0) {
                    return state2;
                  }
                  const tracked = trackedRaw.filter((id) => typeof id === "string");
                  const survivors = winnerPlayerId === attackerPlayerId ? attackers : winnerPlayerId === defenderPlayerId ? defenders : [];
                  if (tracked.length === 0 || survivors.length === 0 || !tracked.some((id) => survivors.includes(id))) {
                    return state2;
                  }
                  const countRaw = typeof modifier.data?.drawCount === "number" ? modifier.data.drawCount : 0;
                  const count = Math.max(0, Math.floor(countRaw));
                  if (count <= 0) {
                    return state2;
                  }
                  const cleaned = removeModifierById(state2, modifier.id);
                  return {
                    ...cleaned,
                    modifiers: [
                      ...cleaned.modifiers,
                      {
                        id: `${modifier.id}.cleanup`,
                        source: modifier.source,
                        ownerPlayerId: ownerId,
                        duration: { type: "uses", remaining: 1 },
                        hooks: {
                          onRoundEnd: ({ state: state3 }) => drawCards(state3, ownerId, count)
                        }
                      }
                    ]
                  };
                }
              }
            }
          ]
        };
        break;
      }
      case "setToSkirmish": {
        const target = getHexTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!target) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${target.hexKey}.skirmish`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedHex: target.hexKey,
              duration: { type: "endOfRound" },
              hooks: {
                beforeCombatRound: ({ state: state2, modifier, hexKey, round }) => {
                  if (round !== 1) {
                    return state2;
                  }
                  const ownerId = modifier.ownerPlayerId;
                  if (!ownerId) {
                    return state2;
                  }
                  const hex = state2.board.hexes[hexKey];
                  if (!hex) {
                    return state2;
                  }
                  const ownerUnits = hex.occupants[ownerId] ?? [];
                  if (ownerUnits.length === 0) {
                    return state2;
                  }
                  const candidates = neighborHexKeys(hexKey).filter((neighbor) => {
                    const neighborHex = state2.board.hexes[neighbor];
                    if (!neighborHex) {
                      return false;
                    }
                    return countPlayersOnHex(neighborHex) === 0;
                  });
                  if (candidates.length === 0) {
                    let nextState3 = state2;
                    const forceCount = ownerUnits.filter(
                      (unitId) => state2.board.units[unitId]?.kind === "force"
                    ).length;
                    if (forceCount > 0) {
                      nextState3 = removeForcesFromHex(
                        nextState3,
                        ownerId,
                        hexKey,
                        ownerUnits,
                        forceCount
                      );
                    }
                    for (const unitId of ownerUnits) {
                      const unit = nextState3.board.units[unitId];
                      if (!unit || unit.kind !== "champion") {
                        continue;
                      }
                      nextState3 = dealChampionDamage(
                        nextState3,
                        ownerId,
                        unitId,
                        unit.hp
                      );
                    }
                    return nextState3;
                  }
                  const roll = randInt(state2.rngState, 0, candidates.length - 1);
                  const retreatHex = candidates[roll.value] ?? candidates[0];
                  let nextState2 = {
                    ...state2,
                    rngState: roll.next
                  };
                  nextState2 = moveUnits(nextState2, ownerId, ownerUnits, hexKey, retreatHex);
                  return nextState2;
                }
              }
            }
          ]
        };
        break;
      }
      case "buildBridge": {
        const isTemporary = effect.temporary === true;
        if (card.targetSpec.kind === "multiEdge") {
          const plans = getBuildBridgePlans(
            nextState,
            playerId,
            card.targetSpec,
            targets ?? null
          );
          if (!plans || plans.length === 0) {
            break;
          }
          const bridges = { ...nextState.board.bridges };
          for (const plan2 of plans) {
            bridges[plan2.key] = {
              key: plan2.key,
              from: plan2.from,
              to: plan2.to,
              ownerPlayerId: playerId,
              temporary: isTemporary ? true : void 0
            };
          }
          nextState = {
            ...nextState,
            board: {
              ...nextState.board,
              bridges
            }
          };
          break;
        }
        const plan = getBuildBridgePlan(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!plan) {
          break;
        }
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges: {
              ...nextState.board.bridges,
              [plan.key]: {
                key: plan.key,
                from: plan.from,
                to: plan.to,
                ownerPlayerId: playerId,
                temporary: isTemporary ? true : void 0
              }
            }
          }
        };
        break;
      }
      case "lockBridge": {
        const plan = getExistingBridgePlan(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!plan) {
          break;
        }
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${plan.key}.lock`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedEdge: plan.key,
              duration: { type: "endOfRound" },
              hooks: {
                getMoveAdjacency: ({ modifier, from, to }, current) => {
                  if (!modifier.attachedEdge) {
                    return current;
                  }
                  return getBridgeKey(from, to) === modifier.attachedEdge ? false : current;
                }
              }
            }
          ]
        };
        break;
      }
      case "trapBridge": {
        const plan = getExistingBridgePlan(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!plan) {
          break;
        }
        const lossValue = typeof effect.forceLoss === "number" ? effect.forceLoss : typeof effect.loss === "number" ? effect.loss : 1;
        const loss = Number.isFinite(lossValue) ? Math.max(1, Math.floor(lossValue)) : 1;
        const modifierId = `card.${card.id}.${playerId}.${nextState.revision}.${plan.key}.trap`;
        nextState = {
          ...nextState,
          modifiers: [
            ...nextState.modifiers,
            {
              id: modifierId,
              source: { type: "card", sourceId: card.id },
              ownerPlayerId: playerId,
              attachedEdge: plan.key,
              duration: { type: "endOfRound" },
              hooks: {
                onMove: ({ state: state2, modifier, playerId: movingPlayerId, from, to, movingUnitIds }) => {
                  if (!modifier.attachedEdge) {
                    return state2;
                  }
                  if (modifier.ownerPlayerId && modifier.ownerPlayerId === movingPlayerId) {
                    return state2;
                  }
                  if (getBridgeKey(from, to) !== modifier.attachedEdge) {
                    return state2;
                  }
                  const nextState2 = removeForcesFromHex(
                    state2,
                    movingPlayerId,
                    to,
                    movingUnitIds,
                    loss
                  );
                  if (nextState2 === state2) {
                    return state2;
                  }
                  const nextModifiers = nextState2.modifiers.filter(
                    (entry) => entry.id !== modifier.id
                  );
                  return nextModifiers.length === nextState2.modifiers.length ? nextState2 : { ...nextState2, modifiers: nextModifiers };
                }
              }
            }
          ]
        };
        break;
      }
      case "destroyBridge": {
        const targetSpec = card.targetSpec;
        if (card.targetSpec.kind === "multiEdge") {
          const plans = getExistingBridgePlans(nextState, playerId, targetSpec, targets ?? null);
          if (!plans || plans.length === 0) {
            break;
          }
          const bridges2 = { ...nextState.board.bridges };
          for (const plan2 of plans) {
            delete bridges2[plan2.key];
          }
          nextState = {
            ...nextState,
            board: {
              ...nextState.board,
              bridges: bridges2
            }
          };
          break;
        }
        const plan = getExistingBridgePlan(nextState, playerId, targetSpec, targets ?? null);
        if (!plan) {
          break;
        }
        const { [plan.key]: _removed, ...bridges } = nextState.board.bridges;
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges
          }
        };
        break;
      }
      case "bridgePivot": {
        const targetSpec = card.targetSpec;
        const plans = getBridgePivotPlans(nextState, playerId, targetSpec, targets ?? null);
        if (!plans) {
          break;
        }
        const bridges = { ...nextState.board.bridges };
        delete bridges[plans.existing.key];
        bridges[plans.build.key] = {
          key: plans.build.key,
          from: plans.build.from,
          to: plans.build.to,
          ownerPlayerId: playerId
        };
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges
          }
        };
        break;
      }
      case "destroyConnectedBridges": {
        const movePath = targets ? getMovePathTarget(targets) : null;
        const targetHex = movePath ? movePath[movePath.length - 1] : getHexKeyTarget(targets ?? null);
        if (!targetHex) {
          break;
        }
        const bridges = Object.fromEntries(
          Object.entries(nextState.board.bridges).filter(
            ([, bridge]) => bridge.from !== targetHex && bridge.to !== targetHex
          )
        );
        nextState = {
          ...nextState,
          board: {
            ...nextState.board,
            bridges
          }
        };
        break;
      }
      case "linkHexes": {
        const link = getHexPairTarget(
          nextState,
          playerId,
          card.targetSpec,
          targets ?? null
        );
        if (!link) {
          break;
        }
        nextState = addHexLinkModifier(nextState, playerId, card.id, link.from, link.to);
        break;
      }
      case "linkCapitalToCenter": {
        const player = nextState.players.find((entry) => entry.id === playerId);
        if (!player?.capitalHex) {
          break;
        }
        const centerHexKey = getCenterHexKey(nextState.board);
        if (!centerHexKey) {
          break;
        }
        nextState = addHexLinkModifier(
          nextState,
          playerId,
          card.id,
          player.capitalHex,
          centerHexKey
        );
        break;
      }
      case "moveStacks": {
        const paths = getMultiPathTargets(targets ?? null);
        if (!paths || paths.length === 0) {
          break;
        }
        const targetSpec = card.targetSpec;
        const owner = typeof targetSpec.owner === "string" ? targetSpec.owner : "self";
        if (owner !== "self") {
          break;
        }
        const minPaths = typeof targetSpec.minPaths === "number" ? Math.max(0, Math.floor(targetSpec.minPaths)) : 1;
        const maxPaths = typeof targetSpec.maxPaths === "number" ? Math.max(0, Math.floor(targetSpec.maxPaths)) : Number.POSITIVE_INFINITY;
        if (paths.length < minPaths || paths.length > maxPaths) {
          break;
        }
        const maxDistance = typeof effect.maxDistance === "number" ? effect.maxDistance : typeof targetSpec.maxDistance === "number" ? targetSpec.maxDistance : void 0;
        const requiresBridge = effect.requiresBridge === false ? false : targetSpec.requiresBridge !== false;
        const stopOnOccupied = effect.stopOnOccupied === true || targetSpec.stopOnOccupied === true;
        const seenStarts = /* @__PURE__ */ new Set();
        const movePlans = [];
        let validationState = nextState;
        const snapshotBoard = nextState.board;
        for (const path of paths) {
          const start = path[0];
          if (seenStarts.has(start)) {
            movePlans.length = 0;
            break;
          }
          seenStarts.add(start);
          const unitIds = selectMovingUnits(snapshotBoard, playerId, start);
          if (unitIds.length === 0) {
            movePlans.length = 0;
            break;
          }
          const validPath = validateMovePath(validationState, playerId, path, {
            maxDistance,
            requiresBridge,
            requireStartOccupied: true,
            movingUnitIds: unitIds,
            stopOnOccupied
          });
          if (!validPath) {
            movePlans.length = 0;
            break;
          }
          movePlans.push({ path: validPath, unitIds });
          validationState = markPlayerMovedThisRound(validationState, playerId);
        }
        if (movePlans.length === 0) {
          break;
        }
        for (const plan of movePlans) {
          nextState = moveUnitIdsAlongPath(nextState, playerId, plan.path, plan.unitIds);
          nextState = markPlayerMovedThisRound(nextState, playerId);
        }
        break;
      }
      case "moveStack": {
        const movePath = getMovePathTarget(targets ?? null);
        if (!movePath) {
          break;
        }
        const maxDistance = typeof effect.maxDistance === "number" ? effect.maxDistance : typeof card.targetSpec.maxDistance === "number" ? card.targetSpec.maxDistance : void 0;
        const requiresBridge = effect.requiresBridge === false ? false : card.targetSpec.requiresBridge !== false;
        const stopOnOccupied = effect.stopOnOccupied === true || card.targetSpec?.stopOnOccupied === true;
        const forceCount = getMoveStackForceCount(card, effect, targets ?? null);
        const includeChampions = getMoveStackIncludeChampions(card, effect, targets ?? null);
        const validPath = validateMovePath(nextState, playerId, movePath, {
          maxDistance,
          requiresBridge,
          requireStartOccupied: true,
          forceCount,
          includeChampions,
          stopOnOccupied
        });
        if (!validPath) {
          break;
        }
        nextState = moveUnitsAlongPath(
          nextState,
          playerId,
          validPath,
          forceCount,
          includeChampions
        );
        nextState = markPlayerMovedThisRound(nextState, playerId);
        break;
      }
      default:
        break;
    }
  }
  return nextState;
};
var isScoutReportChoiceValid = (state, block, playerId, cardInstanceIds) => {
  if (block.payload.playerId !== playerId) {
    return false;
  }
  const maxKeep = Math.min(block.payload.keepCount, block.payload.offers.length);
  if (cardInstanceIds.length > maxKeep) {
    return false;
  }
  const unique = new Set(cardInstanceIds);
  if (unique.size !== cardInstanceIds.length) {
    return false;
  }
  const offerSet = new Set(block.payload.offers);
  if (!cardInstanceIds.every((id) => offerSet.has(id))) {
    return false;
  }
  const player = state.players.find((entry) => entry.id === playerId);
  return Boolean(player);
};
var resolveScoutReportSelection = (block) => {
  const offers = block.payload.offers;
  const maxKeep = Math.min(block.payload.keepCount, offers.length);
  if (maxKeep <= 0) {
    return [];
  }
  const rawChosen = block.payload.chosen ?? [];
  const offerSet = new Set(offers);
  const filtered = rawChosen.filter((id) => offerSet.has(id));
  const unique = Array.from(new Set(filtered)).slice(0, maxKeep);
  if (unique.length > 0) {
    return unique;
  }
  return offers.slice(0, maxKeep);
};
var applyScoutReportChoice = (state, cardInstanceIds, playerId) => {
  const block = state.blocks;
  if (!block || block.type !== "action.scoutReport") {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (block.payload.chosen) {
    return state;
  }
  if (!isScoutReportChoiceValid(state, block, playerId, cardInstanceIds)) {
    return state;
  }
  return {
    ...state,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        chosen: cardInstanceIds
      }
    }
  };
};
var resolveScoutReportBlock = (state, block) => {
  const selected = resolveScoutReportSelection(block);
  const selectedSet = new Set(selected);
  let nextState = state;
  for (const cardId of selected) {
    nextState = addCardToHandWithOverflow(nextState, block.payload.playerId, cardId);
  }
  for (const cardId of block.payload.offers) {
    if (selectedSet.has(cardId)) {
      continue;
    }
    nextState = addCardToDiscardPile(nextState, block.payload.playerId, cardId, {
      countAsDiscard: true
    });
  }
  return nextState;
};

// packages/engine/src/combat.ts
var FORCE_HIT_FACES = 2;
var MAX_STALE_COMBAT_ROUNDS = 20;
var TACTICAL_HAND_HITS = 3;
var getForceHitFaces = (state, modifiers, context) => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getForceHitFaces,
    context,
    FORCE_HIT_FACES
  );
};
var getChampionAttackDice = (state, modifiers, context, base) => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getChampionAttackDice,
    context,
    base
  );
};
var getChampionHitFaces = (state, modifiers, context, base) => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getChampionHitFaces,
    context,
    base
  );
};
var getHitAssignmentPolicy = (state, modifiers, context) => {
  return applyModifierQuery(
    state,
    modifiers,
    (hooks) => hooks.getHitAssignmentPolicy,
    context,
    "random"
  );
};
var getUnitCombatProfile = (state, modifiers, context, side, unitId, unit) => {
  const unitContext = {
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
var unitCanHit = (state, modifiers, context, side, unitId, unit) => {
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
var rollHitsForUnits = (unitIds, units, state, modifiers, context, side, rngState) => {
  let hits = 0;
  let nextState = rngState;
  const rolls = [];
  const unitRolls = [];
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
    const unitRoll = {
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
var findTacticalHandSource = (state, hexKey, ownerPlayerId) => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return null;
  }
  const occupantIds = hex.occupants[ownerPlayerId] ?? [];
  for (const unitId of occupantIds) {
    const unit = state.board.units[unitId];
    if (unit?.kind === "champion" && unit.cardDefId === GRAND_STRATEGIST_CHAMPION_ID && (unit.abilityUses[TACTICAL_HAND_KEY]?.remaining ?? 0) > 0) {
      return unitId;
    }
  }
  return null;
};
var hasBodyguardModifier = (modifiers, targetUnitIds, units) => {
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
var assignHits = (unitIds, hits, policy, units, rngState, bodyguardUsed = false, bodyguardActive = policy === "bodyguard") => {
  const hitsByUnit = {};
  let nextState = rngState;
  if (hits <= 0 || unitIds.length === 0) {
    return { hitsByUnit, nextState };
  }
  const pickRandomTarget = (candidates) => {
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
    const championRemaining = /* @__PURE__ */ new Map();
    for (const unitId of unitIds) {
      const unit = units[unitId];
      if (unit?.kind === "champion") {
        championRemaining.set(unitId, unit.hp);
      }
    }
    const forceTargets = forceUnitIds.slice().sort();
    const pickManualTarget = () => {
      let bestChampion = null;
      let bestHp = Number.POSITIVE_INFINITY;
      for (const [unitId, remaining] of championRemaining.entries()) {
        if (remaining <= 0) {
          continue;
        }
        if (remaining < bestHp || remaining === bestHp && unitId < (bestChampion ?? "")) {
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
      if (bodyguardActive && !used && targetUnit?.kind === "champion" && forceUnitIds.length > 0) {
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
      if (bodyguardActive && !used && targetUnit?.kind === "champion" && forceUnitIds.length > 0) {
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
  const isForce = (unitId) => units[unitId]?.kind === "force";
  const preferred = policy === "forcesFirst" ? unitIds.filter((unitId) => isForce(unitId)) : unitIds.filter((unitId) => !isForce(unitId));
  const fallback = policy === "forcesFirst" ? unitIds.filter((unitId) => !isForce(unitId)) : unitIds.filter((unitId) => isForce(unitId));
  for (let i = 0; i < hits; i += 1) {
    const targetId = pickRandomTarget(preferred.length > 0 ? preferred : fallback);
    if (!targetId) {
      break;
    }
    hitsByUnit[targetId] = (hitsByUnit[targetId] ?? 0) + 1;
  }
  return { hitsByUnit, nextState };
};
var resolveHits = (unitIds, hitsByUnit, units) => {
  const removedUnitIds = [];
  const updatedChampions = {};
  let bounty = 0;
  const killedChampions = [];
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
var applyGoldArmorToHits = (state, hitsByUnit) => {
  let nextState = state;
  const nextHits = { ...hitsByUnit };
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
var summarizeUnits = (unitIds, units) => {
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
var buildSideSummary = (playerId, unitIds, units) => {
  return {
    playerId,
    ...summarizeUnits(unitIds, units)
  };
};
var getRetreatDestination = (hexKey, edgeKey) => {
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
var canRetreatToHex = (state, playerId, hexKey) => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return false;
  }
  const occupants = getPlayerIdsOnHex(hex);
  if (occupants.length < 2) {
    return true;
  }
  return occupants.includes(playerId);
};
var getRetreatEdgesForPlayer = (state, hexKey, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || player.resources.mana < 1) {
    return [];
  }
  const edges = [];
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
var applyRetreatMoves = (state, hexKey, plans) => {
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
var createEmptyHitSummary = () => ({
  forces: 0,
  champions: []
});
var summarizeHitAssignments = (hitsByUnit, units) => {
  let forces = 0;
  const champions = [];
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
var createCombatRetreatBlock = (state, hexKey) => {
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
  const availableEdges = {
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
  );
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
var resolveBattleAtHex = (state, hexKey, retreatChoices) => {
  const hex = state.board.hexes[hexKey];
  if (!hex) {
    return state;
  }
  const participants = getPlayerIdsOnHex(hex);
  if (participants.length !== 2) {
    return state;
  }
  const retreatPlans = [];
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
  let nextState = state;
  if (retreatPlans.length > 0) {
    const retreating = new Set(retreatPlans.map((plan) => plan.playerId));
    nextState = {
      ...nextState,
      players: nextState.players.map(
        (player) => retreating.has(player.id) ? {
          ...player,
          resources: {
            ...player.resources,
            mana: Math.max(0, player.resources.mana - 1)
          }
        } : player
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
  let endReason = "eliminated";
  let battleRound = 0;
  const retreatAfterRound = retreatPlans.length > 0;
  let bodyguardUsed = {
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
    const contextBase = {
      hexKey,
      attackerPlayerId: participants[0],
      defenderPlayerId: participants[1],
      round: battleRound
    };
    let modifiers = getCombatModifiers(nextState, hexKey);
    const roundContext = {
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
    const attackersCanHit = attackers.some(
      (unitId) => unitCanHit(nextState, modifiers, contextBase, "attackers", unitId, nextUnits[unitId])
    );
    const defendersCanHit = defenders.some(
      (unitId) => unitCanHit(nextState, modifiers, contextBase, "defenders", unitId, nextUnits[unitId])
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
    const defenderTacticalSource = attackerRoll.hits > 0 ? findTacticalHandSource(nextState, hexKey, participants[0]) : null;
    const attackerTacticalSource = defenderRoll.hits > 0 ? findTacticalHandSource(nextState, hexKey, participants[1]) : null;
    const defenderAssignmentContext = {
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
    const defenderBodyguardActive = defenderBasePolicy === "bodyguard" || hasBodyguardModifier(modifiers, defenders, nextUnits);
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
    bodyguardUsed.defenders = assignedToDefenders.bodyguardUsed ?? bodyguardUsed.defenders;
    const attackerAssignmentContext = {
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
    const attackerBodyguardActive = attackerBasePolicy === "bodyguard" || hasBodyguardModifier(modifiers, attackers, nextUnits);
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
    bodyguardUsed.attackers = assignedToAttackers.bodyguardUsed ?? bodyguardUsed.attackers;
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
    const removedSet = /* @__PURE__ */ new Set([
      ...attackerHits.removedUnitIds,
      ...defenderHits.removedUnitIds
    ]);
    const removedChampionIds = [
      ...attackerHits.killedChampions.map((unit) => unit.id),
      ...defenderHits.killedChampions.map((unit) => unit.id)
    ];
    const uniqueChampionIds = [...new Set(removedChampionIds)];
    const updatedUnits = { ...nextUnits };
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
  const winnerPlayerId = finalAttackers.length > 0 && finalDefenders.length === 0 ? participants[0] : finalDefenders.length > 0 && finalAttackers.length === 0 ? participants[1] : null;
  const endContext = {
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
var applyCombatRetreatChoice = (state, playerId, payload) => {
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
  let choice = "stay";
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
var resolveCombatRetreatBlock = (state, block) => {
  const retreatChoices = {};
  for (const [playerId, choice] of Object.entries(block.payload.choices)) {
    if (!choice || choice === "stay") {
      continue;
    }
    retreatChoices[playerId] = choice;
  }
  return resolveBattleAtHex(state, block.payload.hexKey, retreatChoices);
};
var resolveImmediateBattles = (state) => {
  if (state.blocks?.type === "combat.retreat") {
    return state;
  }
  const contested = Object.values(state.board.hexes).filter((hex) => hex.tile !== "capital" && isContestedHex(hex)).map((hex) => hex.key).sort(compareHexKeys);
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
var resolveSieges = (state) => {
  if (state.blocks?.type === "combat.retreat") {
    return state;
  }
  const seatIndexByPlayer = /* @__PURE__ */ new Map();
  for (const player of state.players) {
    seatIndexByPlayer.set(player.id, player.seatIndex);
  }
  const contestedCapitals = Object.values(state.board.hexes).filter((hex) => hex.tile === "capital" && isContestedHex(hex) && hex.ownerPlayerId).map((hex) => ({
    key: hex.key,
    defenderId: hex.ownerPlayerId
  })).filter((entry) => seatIndexByPlayer.has(entry.defenderId)).sort((a, b) => {
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

// packages/engine/src/action-flow.ts
var BASIC_ACTION_MANA_COST = 1;
var REINFORCE_GOLD_COST = 1;
var getCardDefinition = (state, cardInstanceId) => {
  const instance = state.cardsByInstanceId[cardInstanceId];
  if (!instance) {
    return null;
  }
  return getCardDef(instance.defId) ?? null;
};
var getChampionGoldCost = (card, championCount) => {
  if (card.type !== "Champion" || !card.champion) {
    return 0;
  }
  const costs = card.champion.goldCostByChampionCount;
  if (!Array.isArray(costs) || costs.length === 0) {
    return 0;
  }
  const index = Math.min(Math.max(0, championCount), costs.length - 1);
  const cost = Number(costs[index]);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
};
var getDeclarationCost = (state, playerId, declaration) => {
  if (declaration.kind === "card") {
    const card = getCardDefinition(state, declaration.cardInstanceId);
    if (!card) {
      return { mana: 0, gold: 0 };
    }
    const championGold = card.type === "Champion" ? getChampionGoldCost(card, countPlayerChampions(state.board, playerId)) : 0;
    return { mana: card.cost.mana, gold: (card.cost.gold ?? 0) + championGold };
  }
  if (declaration.kind === "basic") {
    if (declaration.action.kind === "capitalReinforce") {
      return { mana: BASIC_ACTION_MANA_COST, gold: REINFORCE_GOLD_COST };
    }
    return { mana: BASIC_ACTION_MANA_COST, gold: 0 };
  }
  return { mana: 0, gold: 0 };
};
var getBuildBridgePlan2 = (state, playerId, edgeKey) => {
  let rawA;
  let rawB;
  try {
    [rawA, rawB] = parseEdgeKey(edgeKey);
  } catch {
    return null;
  }
  const fromHex = state.board.hexes[rawA];
  const toHex = state.board.hexes[rawB];
  if (!fromHex || !toHex) {
    return null;
  }
  try {
    if (!areAdjacent(parseHexKey(rawA), parseHexKey(rawB))) {
      return null;
    }
  } catch {
    return null;
  }
  if (!isOccupiedByPlayer(fromHex, playerId) && !isOccupiedByPlayer(toHex, playerId)) {
    return null;
  }
  const canonicalKey = getBridgeKey(rawA, rawB);
  if (state.board.bridges[canonicalKey]) {
    return null;
  }
  return { from: rawA, to: rawB, key: canonicalKey };
};
var canMarch = (state, playerId, from, to, forceCount, includeChampions) => {
  const fromHex = state.board.hexes[from];
  const toHex = state.board.hexes[to];
  if (!fromHex || !toHex) {
    return false;
  }
  if (!isOccupiedByPlayer(fromHex, playerId)) {
    return false;
  }
  const options = { maxDistance: 1, requiresBridge: true, requireStartOccupied: true };
  if (validateMovePath(state, playerId, [from, to], {
    ...options,
    forceCount,
    includeChampions
  })) {
    return true;
  }
  let neighbors;
  try {
    neighbors = neighborHexKeys(from);
  } catch {
    return false;
  }
  for (const mid of neighbors) {
    if (!state.board.hexes[mid]) {
      continue;
    }
    try {
      if (!areAdjacent(parseHexKey(mid), parseHexKey(to))) {
        continue;
      }
    } catch {
      continue;
    }
    if (validateMovePath(state, playerId, [from, mid, to], {
      ...options,
      forceCount,
      includeChampions
    })) {
      return true;
    }
  }
  return false;
};
var getCapitalReinforceHex = (state, playerId, preferredHex) => resolveCapitalDeployHex(state, playerId, preferredHex ?? null);
var isBasicActionValid = (state, playerId, action) => {
  switch (action.kind) {
    case "buildBridge":
      return Boolean(getBuildBridgePlan2(state, playerId, action.edgeKey));
    case "march":
      return canMarch(
        state,
        playerId,
        action.from,
        action.to,
        action.forceCount,
        action.includeChampions
      );
    case "capitalReinforce":
      return Boolean(getCapitalReinforceHex(state, playerId, action.hexKey));
    default: {
      const _exhaustive = action;
      return _exhaustive;
    }
  }
};
var isCardDeclarationValid = (state, player, declaration) => {
  const card = getCardDefinition(state, declaration.cardInstanceId);
  if (!card) {
    return false;
  }
  if (!player.deck.hand.includes(declaration.cardInstanceId)) {
    return false;
  }
  return isCardPlayable(state, player.id, card, declaration.targets);
};
var isDeclarationValid = (state, player, declaration) => {
  if (declaration.kind === "done") {
    return true;
  }
  if (declaration.kind === "basic") {
    return isBasicActionValid(state, player.id, declaration.action);
  }
  if (declaration.kind === "card") {
    return isCardDeclarationValid(state, player, declaration);
  }
  return false;
};
var getLeadOrderedPlayers = (players, leadSeatIndex) => {
  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const leadIndex = ordered.findIndex((player) => player.seatIndex === leadSeatIndex);
  if (leadIndex <= 0) {
    return ordered;
  }
  return [...ordered.slice(leadIndex), ...ordered.slice(0, leadIndex)];
};
var getBasicActionOrderedPlayers = (state, leadOrderedPlayers) => {
  const factionOrder = state.config.basicActionFactionOrder;
  if (!Array.isArray(factionOrder) || factionOrder.length === 0) {
    return leadOrderedPlayers;
  }
  const factionPriority = new Map(
    factionOrder.map((factionId, index) => [factionId, index])
  );
  const leadIndex = new Map(leadOrderedPlayers.map((player, index) => [player.id, index]));
  return [...leadOrderedPlayers].sort((a, b) => {
    const aPriority = factionPriority.get(a.factionId) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = factionPriority.get(b.factionId) ?? Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return (leadIndex.get(a.id) ?? 0) - (leadIndex.get(b.id) ?? 0);
  });
};
var finalizeCardPlay = (state, playerId, cardInstanceId, card) => {
  if (card && (card.burn || card.type === "Champion")) {
    return addCardToBurned(state, playerId, cardInstanceId);
  }
  return addCardToDiscardPile(state, playerId, cardInstanceId);
};
var createActionStepBlock = (state) => {
  const eligible = state.players.filter((player) => player.resources.mana >= 1 && !player.doneThisRound).map((player) => player.id);
  if (eligible.length === 0) {
    return null;
  }
  return {
    type: "actionStep.declarations",
    waitingFor: eligible,
    payload: {
      declarations: Object.fromEntries(eligible.map((playerId) => [playerId, null]))
    }
  };
};
var buildActionResolutionEntries = (state, declarations) => {
  const orderedPlayers = getLeadOrderedPlayers(state.players, state.leadSeatIndex);
  const basicActionOrder = getBasicActionOrderedPlayers(state, orderedPlayers);
  const leadOrderIndex = new Map(
    orderedPlayers.map((player, index) => [player.id, index])
  );
  const cardPlays = [];
  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (declaration?.kind === "card") {
      cardPlays.push({
        player,
        declaration,
        card: getCardDefinition(state, declaration.cardInstanceId)
      });
    }
  }
  const orderedCardPlays = [...cardPlays].sort((a, b) => {
    const aInitiative = a.card?.initiative ?? Number.MAX_SAFE_INTEGER;
    const bInitiative = b.card?.initiative ?? Number.MAX_SAFE_INTEGER;
    if (aInitiative !== bInitiative) {
      return aInitiative - bInitiative;
    }
    return (leadOrderIndex.get(a.player.id) ?? 0) - (leadOrderIndex.get(b.player.id) ?? 0);
  });
  const entries = [];
  for (const entry of orderedCardPlays) {
    entries.push({
      kind: "card",
      playerId: entry.player.id,
      cardInstanceId: entry.declaration.cardInstanceId,
      targets: entry.declaration.targets ?? null
    });
  }
  for (const player of basicActionOrder) {
    const declaration = declarations[player.id];
    if (declaration?.kind === "basic") {
      entries.push({ kind: "basic", playerId: player.id, action: declaration.action });
    }
  }
  for (const player of orderedPlayers) {
    const declaration = declarations[player.id];
    if (declaration?.kind === "done") {
      entries.push({ kind: "done", playerId: player.id });
    }
  }
  return entries;
};
var createActionResolutionState = (state, declarations) => {
  return {
    entries: buildActionResolutionEntries(state, declarations),
    index: 0
  };
};
var applyActionDeclaration = (state, declaration, playerId) => {
  if (state.phase !== "round.action") {
    return state;
  }
  const block = state.blocks;
  if (!block || block.type !== "actionStep.declarations") {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (block.payload.declarations[playerId]) {
    return state;
  }
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return state;
  }
  if (!isDeclarationValid(state, player, declaration)) {
    return state;
  }
  const cost = getDeclarationCost(state, playerId, declaration);
  if (player.resources.mana < cost.mana || player.resources.gold < cost.gold) {
    return state;
  }
  const nextPlayers = state.players.map(
    (entry) => entry.id === playerId ? {
      ...entry,
      resources: {
        gold: entry.resources.gold - cost.gold,
        mana: entry.resources.mana - cost.mana
      }
    } : entry
  );
  let nextState = {
    ...state,
    players: nextPlayers,
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId),
      payload: {
        ...block.payload,
        declarations: {
          ...block.payload.declarations,
          [playerId]: declaration
        }
      }
    }
  };
  if (declaration.kind === "card") {
    nextState = removeCardFromHand(nextState, playerId, declaration.cardInstanceId);
    nextState = incrementCardsPlayedThisRound(nextState, playerId);
  }
  return nextState;
};
var resolveBasicAction = (state, playerId, action) => {
  switch (action.kind) {
    case "buildBridge":
      return resolveBuildBridge(state, playerId, action.edgeKey);
    case "march":
      return resolveMarch(
        state,
        playerId,
        action.from,
        action.to,
        action.forceCount,
        action.includeChampions
      );
    case "capitalReinforce":
      return resolveCapitalReinforce(state, playerId, action.hexKey);
    default: {
      const _exhaustive = action;
      return state;
    }
  }
};
function resolveActionEntry(state, entry) {
  if (entry.kind === "card") {
    const card = getCardDefinition(state, entry.cardInstanceId);
    const cardId = card?.id ?? "unknown";
    let nextState2 = emit(state, {
      type: `action.card.${cardId}`,
      payload: {
        playerId: entry.playerId,
        cardId,
        targets: entry.targets ?? null
      }
    });
    if (card) {
      nextState2 = resolveCardEffects(nextState2, entry.playerId, card, entry.targets ?? null);
    }
    nextState2 = finalizeCardPlay(nextState2, entry.playerId, entry.cardInstanceId, card);
    return resolveImmediateBattles(nextState2);
  }
  if (entry.kind === "basic") {
    let nextState2 = emit(state, {
      type: `action.basic.${entry.action.kind}`,
      payload: { playerId: entry.playerId, action: entry.action }
    });
    nextState2 = resolveBasicAction(nextState2, entry.playerId, entry.action);
    return resolveImmediateBattles(nextState2);
  }
  let nextState = emit(state, {
    type: "action.done",
    payload: { playerId: entry.playerId }
  });
  nextState = {
    ...nextState,
    players: nextState.players.map(
      (player) => player.id === entry.playerId ? { ...player, doneThisRound: true } : player
    )
  };
  return nextState;
}
var resolveNextActionEntry = (state) => {
  const pending = state.actionResolution;
  if (!pending) {
    return state;
  }
  const entry = pending.entries[pending.index];
  if (!entry) {
    return {
      ...state,
      actionResolution: void 0
    };
  }
  const nextState = resolveActionEntry(state, entry);
  const nextIndex = pending.index + 1;
  if (nextIndex >= pending.entries.length) {
    return {
      ...nextState,
      actionResolution: void 0
    };
  }
  return {
    ...nextState,
    actionResolution: {
      entries: pending.entries,
      index: nextIndex
    }
  };
};
var resolveBuildBridge = (state, playerId, edgeKey) => {
  const plan = getBuildBridgePlan2(state, playerId, edgeKey);
  if (!plan) {
    return state;
  }
  return {
    ...state,
    board: {
      ...state.board,
      bridges: {
        ...state.board.bridges,
        [plan.key]: {
          key: plan.key,
          from: plan.from,
          to: plan.to,
          ownerPlayerId: playerId
        }
      }
    }
  };
};
var resolveMarch = (state, playerId, from, to, forceCount, includeChampions) => {
  if (!canMarch(state, playerId, from, to, forceCount, includeChampions)) {
    return state;
  }
  const movingUnitIds = selectMovingUnits(
    state.board,
    playerId,
    from,
    forceCount,
    includeChampions
  );
  if (movingUnitIds.length === 0) {
    return state;
  }
  let nextState = {
    ...state,
    board: moveStack(state.board, playerId, from, to, forceCount, includeChampions)
  };
  nextState = runMoveEvents(nextState, { playerId, from, to, path: [from, to], movingUnitIds });
  return markPlayerMovedThisRound(nextState, playerId);
};
var resolveCapitalReinforce = (state, playerId, preferredHex) => {
  const capitalHex = getCapitalReinforceHex(state, playerId, preferredHex);
  if (!capitalHex) {
    return state;
  }
  const baseCount = 1;
  const count = getDeployForcesCount(state, { playerId, hexKey: capitalHex, baseCount }, baseCount);
  return {
    ...state,
    board: addForcesToHex(state.board, playerId, capitalHex, count)
  };
};

// packages/engine/src/market.ts
var AGE_ORDER = ["I", "II", "III"];
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
var getNextAge = (age) => {
  const index = AGE_ORDER.indexOf(age);
  if (index < 0 || index >= AGE_ORDER.length - 1) {
    return null;
  }
  return AGE_ORDER[index + 1];
};
var takeFromDeck2 = (deck, count) => {
  if (count <= 0 || deck.length === 0) {
    return { drawn: [], remaining: deck };
  }
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
};
var toRowCards = (age, cardIds) => cardIds.map((cardId) => ({ cardId, age, revealed: true }));
var createBids = (state) => Object.fromEntries(state.players.map((player) => [player.id, null]));
var createPlayersOut = (state) => Object.fromEntries(state.players.map((player) => [player.id, false]));
var getEligibleMarketPlayers = (state) => state.players.filter((player) => !state.market.playersOut[player.id]).map((player) => player.id);
var isInteger = (value) => Number.isFinite(value) && Number.isInteger(value);
var isBidValid = (bid, availableGold) => {
  if (!isInteger(bid.amount)) {
    return false;
  }
  if (bid.kind === "buy") {
    return bid.amount >= 1 && bid.amount <= availableGold;
  }
  return bid.amount >= 0 && bid.amount <= availableGold;
};
var createPendingRolls = (playerIds) => Object.fromEntries(playerIds.map((playerId) => [playerId, null]));
var createRollOffKey = (state, cardIndex) => state.round * 100 + cardIndex;
var createMarketRollOffState = ({
  state,
  cardIndex,
  kind,
  bidAmount,
  passBids,
  eligiblePlayerIds
}) => ({
  key: createRollOffKey(state, cardIndex),
  cardIndex,
  kind,
  bidAmount,
  passBids,
  eligiblePlayerIds,
  rounds: [],
  currentRolls: createPendingRolls(eligiblePlayerIds)
});
var createMarketRollOffBlock = (rollOff) => ({
  type: "market.rollOff",
  waitingFor: [...rollOff.eligiblePlayerIds],
  payload: {
    cardIndex: rollOff.cardIndex
  }
});
var initializeMarketDecks = (state) => {
  let nextState = state;
  const marketDecks = { I: [], II: [], III: [] };
  for (const age of AGE_ORDER) {
    const baseDeck = MARKET_DECKS_BY_AGE[age] ?? [];
    const { value, next } = shuffle(nextState.rngState, baseDeck);
    marketDecks[age] = value;
    nextState = { ...nextState, rngState: next };
  }
  return { ...nextState, marketDecks };
};
var initializePowerDecks = (state) => {
  let rngState = state.rngState;
  const powerDecks = { I: [], II: [], III: [] };
  for (const age of AGE_ORDER) {
    const baseDeck = POWER_DECKS_BY_AGE[age] ?? [];
    const { value, next } = shuffle(rngState, baseDeck);
    powerDecks[age] = value;
    rngState = next;
  }
  return { ...state, powerDecks };
};
var prepareMarketRow = (state) => {
  if (state.market.currentRow.length > 0) {
    return state;
  }
  const playerCount = state.players.length;
  if (playerCount <= 0) {
    return state;
  }
  const currentAge = state.market.age;
  const nextAge = getNextAge(currentAge);
  const previewTarget = clamp(
    state.config.marketPreviewByRound[state.round] ?? 0,
    0,
    playerCount
  );
  let currentDeck = state.marketDecks[currentAge] ?? [];
  let nextDeck = nextAge ? state.marketDecks[nextAge] ?? [] : [];
  let previewCount = previewTarget;
  if (!nextAge || nextDeck.length === 0) {
    previewCount = 0;
  }
  const currentTarget = Math.max(0, playerCount - previewCount);
  let { drawn: nextDrawn, remaining: nextRemaining } = takeFromDeck2(
    nextDeck,
    previewCount
  );
  let { drawn: currentDrawn, remaining: currentRemaining } = takeFromDeck2(
    currentDeck,
    currentTarget
  );
  let remainingSlots = playerCount - (nextDrawn.length + currentDrawn.length);
  if (remainingSlots > 0) {
    const fillCurrent = takeFromDeck2(currentRemaining, remainingSlots);
    currentDrawn = [...currentDrawn, ...fillCurrent.drawn];
    currentRemaining = fillCurrent.remaining;
    remainingSlots = playerCount - (nextDrawn.length + currentDrawn.length);
  }
  if (remainingSlots > 0 && nextAge) {
    const fillNext = takeFromDeck2(nextRemaining, remainingSlots);
    nextDrawn = [...nextDrawn, ...fillNext.drawn];
    nextRemaining = fillNext.remaining;
  }
  const rowCards = [
    ...toRowCards(currentAge, currentDrawn),
    ...toRowCards(nextAge ?? currentAge, nextDrawn)
  ];
  const { value: shuffledRow, next } = shuffle(state.rngState, rowCards);
  const nextState = {
    ...state,
    rngState: next,
    market: {
      ...state.market,
      currentRow: shuffledRow,
      rowIndexResolving: 0,
      passPot: 0,
      bids: createBids(state),
      playersOut: createPlayersOut(state),
      rollOff: null
    },
    marketDecks: {
      ...state.marketDecks,
      [currentAge]: currentRemaining,
      ...nextAge ? { [nextAge]: nextRemaining } : {}
    }
  };
  return emit(nextState, {
    type: "market.reveal",
    payload: {
      row: shuffledRow.map((card) => ({ cardId: card.cardId, age: card.age }))
    }
  });
};
var createMarketBidBlock = (state) => {
  const cardIndex = state.market.rowIndexResolving;
  const currentCard = state.market.currentRow[cardIndex];
  if (!currentCard) {
    return null;
  }
  if (state.market.rollOff) {
    return null;
  }
  const eligible = getEligibleMarketPlayers(state);
  if (eligible.length === 0) {
    return null;
  }
  return {
    type: "market.bidsForCard",
    waitingFor: eligible,
    payload: {
      cardIndex
    }
  };
};
var applyMarketBid = (state, bid, playerId) => {
  if (state.phase !== "round.market") {
    return state;
  }
  const block = state.blocks;
  if (!block || block.type !== "market.bidsForCard") {
    return state;
  }
  if (block.payload.cardIndex !== state.market.rowIndexResolving) {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (state.market.playersOut[playerId]) {
    return state;
  }
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return state;
  }
  if (!isBidValid(bid, player.resources.gold)) {
    return state;
  }
  if (state.market.bids[playerId]) {
    return state;
  }
  return {
    ...state,
    market: {
      ...state.market,
      bids: {
        ...state.market.bids,
        [playerId]: bid
      }
    },
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId)
    }
  };
};
var applyMarketRollOff = (state, playerId) => {
  if (state.phase !== "round.market") {
    return state;
  }
  const block = state.blocks;
  if (!block || block.type !== "market.rollOff") {
    return state;
  }
  const rollOff = state.market.rollOff;
  if (!rollOff) {
    return state;
  }
  if (!block.waitingFor.includes(playerId)) {
    return state;
  }
  if (!rollOff.eligiblePlayerIds.includes(playerId)) {
    return state;
  }
  if (typeof rollOff.currentRolls[playerId] === "number") {
    return state;
  }
  const roll = rollDie(state.rngState);
  return {
    ...state,
    rngState: roll.next,
    market: {
      ...state.market,
      rollOff: {
        ...rollOff,
        currentRolls: {
          ...rollOff.currentRolls,
          [playerId]: roll.value
        }
      }
    },
    blocks: {
      ...block,
      waitingFor: block.waitingFor.filter((id) => id !== playerId)
    }
  };
};
var applyMarketBuyWinner = ({
  state,
  winnerId,
  amount,
  cardIndex,
  rollOffRounds
}) => {
  const currentCard = state.market.currentRow[cardIndex];
  if (!currentCard) {
    return state;
  }
  const players = state.players.map(
    (player) => player.id === winnerId ? {
      ...player,
      resources: {
        ...player.resources,
        gold: player.resources.gold - amount
      }
    } : player
  );
  let nextState = {
    ...state,
    players,
    market: {
      ...state.market,
      rowIndexResolving: cardIndex + 1,
      bids: createBids(state),
      passPot: 0,
      playersOut: {
        ...state.market.playersOut,
        [winnerId]: true
      },
      rollOff: null
    }
  };
  const created = createCardInstance(nextState, currentCard.cardId);
  nextState = insertCardIntoDrawPileRandom(created.state, winnerId, created.instanceId);
  return emit(nextState, {
    type: "market.buy",
    payload: {
      playerId: winnerId,
      cardId: currentCard.cardId,
      amount,
      cardIndex,
      rollOff: rollOffRounds.length > 0 ? rollOffRounds : void 0
    }
  });
};
var applyMarketPassWinner = ({
  state,
  winnerId,
  passBids,
  cardIndex,
  rollOffRounds
}) => {
  const currentCard = state.market.currentRow[cardIndex];
  if (!currentCard) {
    return state;
  }
  const passPot = Object.values(passBids).reduce((total, amount) => total + amount, 0);
  const players = state.players.map((player) => {
    const bidAmount = passBids[player.id] ?? 0;
    let gold = player.resources.gold;
    if (bidAmount > 0) {
      gold -= bidAmount;
    }
    if (player.id === winnerId && passPot > 0) {
      gold += passPot;
    }
    return {
      ...player,
      resources: {
        ...player.resources,
        gold
      }
    };
  });
  let nextState = {
    ...state,
    players,
    market: {
      ...state.market,
      rowIndexResolving: cardIndex + 1,
      bids: createBids(state),
      passPot: 0,
      playersOut: {
        ...state.market.playersOut,
        [winnerId]: true
      },
      rollOff: null
    }
  };
  const created = createCardInstance(nextState, currentCard.cardId);
  nextState = insertCardIntoDrawPileRandom(created.state, winnerId, created.instanceId);
  return emit(nextState, {
    type: "market.pass",
    payload: {
      playerId: winnerId,
      cardId: currentCard.cardId,
      passPot,
      cardIndex,
      rollOff: rollOffRounds.length > 0 ? rollOffRounds : void 0
    }
  });
};
var resolveMarketRollOff = (state) => {
  const rollOff = state.market.rollOff;
  if (!rollOff) {
    return state;
  }
  const roundValues = {};
  for (const playerId of rollOff.eligiblePlayerIds) {
    const value = rollOff.currentRolls[playerId];
    if (typeof value !== "number") {
      return state;
    }
    roundValues[playerId] = value;
  }
  const rounds = [...rollOff.rounds, roundValues];
  const lowest = Math.min(...Object.values(roundValues));
  const tied = rollOff.eligiblePlayerIds.filter((playerId) => roundValues[playerId] === lowest);
  if (tied.length > 1) {
    const nextRollOff = {
      ...rollOff,
      rounds,
      eligiblePlayerIds: tied,
      currentRolls: createPendingRolls(tied)
    };
    return {
      ...state,
      market: {
        ...state.market,
        rollOff: nextRollOff
      },
      blocks: createMarketRollOffBlock(nextRollOff)
    };
  }
  const winnerId = tied[0];
  if (rollOff.kind === "buy") {
    if (typeof rollOff.bidAmount !== "number") {
      return state;
    }
    return {
      ...applyMarketBuyWinner({
        state,
        winnerId,
        amount: rollOff.bidAmount,
        cardIndex: rollOff.cardIndex,
        rollOffRounds: rounds
      }),
      blocks: void 0
    };
  }
  return {
    ...applyMarketPassWinner({
      state,
      winnerId,
      passBids: rollOff.passBids ?? {},
      cardIndex: rollOff.cardIndex,
      rollOffRounds: rounds
    }),
    blocks: void 0
  };
};
var resolveMarketBids = (state) => {
  const cardIndex = state.market.rowIndexResolving;
  const currentCard = state.market.currentRow[cardIndex];
  if (!currentCard) {
    return state;
  }
  const eligiblePlayerIds = getEligibleMarketPlayers(state);
  if (eligiblePlayerIds.length === 0) {
    return {
      ...state,
      market: {
        ...state.market,
        rowIndexResolving: state.market.currentRow.length,
        bids: createBids(state),
        passPot: 0,
        rollOff: null
      }
    };
  }
  const bidEntries = eligiblePlayerIds.map((playerId) => {
    const bid = state.market.bids[playerId];
    return {
      playerId,
      bid: bid ?? { kind: "pass", amount: 0 }
    };
  });
  const buyBids = bidEntries.filter((entry) => entry.bid.kind === "buy" && entry.bid.amount > 0);
  if (buyBids.length > 0) {
    const highest = Math.max(...buyBids.map((entry) => entry.bid.amount));
    const topBids = buyBids.filter((entry) => entry.bid.amount === highest);
    if (topBids.length > 1) {
      const rollOff = createMarketRollOffState({
        state,
        cardIndex,
        kind: "buy",
        bidAmount: highest,
        eligiblePlayerIds: topBids.map((entry) => entry.playerId)
      });
      return {
        ...state,
        market: {
          ...state.market,
          rollOff
        },
        blocks: createMarketRollOffBlock(rollOff)
      };
    }
    return applyMarketBuyWinner({
      state,
      winnerId: topBids[0].playerId,
      amount: highest,
      cardIndex,
      rollOffRounds: []
    });
  }
  const passBids = bidEntries.map((entry) => ({
    playerId: entry.playerId,
    amount: entry.bid.amount
  }));
  const passBidByPlayer = Object.fromEntries(
    passBids.map((entry) => [entry.playerId, entry.amount])
  );
  const lowest = Math.min(...passBids.map((entry) => entry.amount));
  const eligibleWinners = passBids.filter((entry) => entry.amount === lowest).map((entry) => entry.playerId);
  if (eligibleWinners.length > 1) {
    const rollOff = createMarketRollOffState({
      state,
      cardIndex,
      kind: "pass",
      bidAmount: null,
      passBids: passBidByPlayer,
      eligiblePlayerIds: eligibleWinners
    });
    return {
      ...state,
      market: {
        ...state.market,
        rollOff
      },
      blocks: createMarketRollOffBlock(rollOff)
    };
  }
  return applyMarketPassWinner({
    state,
    winnerId: eligibleWinners[0],
    passBids: passBidByPlayer,
    cardIndex,
    rollOffRounds: []
  });
};

// packages/engine/src/engine.ts
var createPlayerState = (player, seatIndex, startingGold) => {
  return {
    id: player.id,
    name: player.name,
    seatIndex,
    factionId: player.factionId ?? "unassigned",
    capitalHex: void 0,
    resources: { gold: startingGold, mana: 0 },
    vp: { permanent: 0, control: 0, total: 0 },
    doneThisRound: false,
    deck: {
      drawPile: [],
      discardPile: [],
      hand: [],
      scrapped: []
    },
    burned: [],
    flags: {},
    visibility: { connected: true }
  };
};
var getHostPlayerId = (state) => {
  return state.players.find((player) => player.seatIndex === 0)?.id ?? null;
};
var requestSetupAdvance = (state, playerId) => {
  if (state.phase !== "setup") {
    throw new Error("setup advance is only available during setup");
  }
  const hostPlayerId = getHostPlayerId(state);
  if (!hostPlayerId || hostPlayerId !== playerId) {
    throw new Error("only the host can advance setup");
  }
  if (!state.blocks) {
    throw new Error("no setup block to advance");
  }
  if (state.blocks.waitingFor.length > 0) {
    throw new Error("setup cannot advance until all players are ready");
  }
  return {
    ...state,
    setup: {
      ...state.setup,
      advanceRequested: true
    }
  };
};
var normalizeSeed = (seed) => {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new Error("seed must be a finite number");
    }
    return seed >>> 0;
  }
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
var enterPhase = (state, phase) => {
  return emit(
    { ...state, phase, blocks: void 0 },
    { type: `phase.${phase}`, payload: { round: state.round } }
  );
};
var createNewGame = (config = DEFAULT_CONFIG, seed, lobbyPlayers) => {
  const playerCount = lobbyPlayers.length;
  const players = lobbyPlayers.map(
    (player, seatIndex) => createPlayerState(player, seatIndex, config.START_GOLD)
  );
  const radius = config.boardRadiusByPlayerCount[playerCount] ?? 0;
  const board = createBaseBoard(radius);
  const capitalSlots = getCapitalSlots(playerCount, radius, config.capitalSlotsByPlayerCount);
  let state = {
    config,
    seed,
    rngState: createRngState(normalizeSeed(seed)),
    revision: 0,
    createdAt: Date.now(),
    players,
    round: 0,
    leadSeatIndex: 0,
    phase: "setup",
    setup: { advanceRequested: false },
    board,
    market: {
      age: "I",
      currentRow: [],
      rowIndexResolving: 0,
      passPot: 0,
      bids: Object.fromEntries(players.map((player) => [player.id, null])),
      playersOut: Object.fromEntries(players.map((player) => [player.id, false])),
      rollOff: null
    },
    marketDecks: { I: [], II: [], III: [] },
    powerDecks: { I: [], II: [], III: [] },
    logs: [],
    modifiers: [],
    blocks: createDeckPreviewBlock(),
    cardsByInstanceId: {},
    winnerPlayerId: null
  };
  state = initializeMarketDecks(state);
  state = initializePowerDecks(state);
  return state;
};
var applyCommand = (state, _command, _playerId) => {
  if (_command.type === "SubmitSetupChoice") {
    return applySetupChoice(state, _command.payload, _playerId);
  }
  if (_command.type === "AdvanceSetup") {
    return requestSetupAdvance(state, _playerId);
  }
  if (_command.type === "SubmitQuietStudy") {
    return applyQuietStudyChoice(state, _command.payload.cardInstanceIds, _playerId);
  }
  if (_command.type === "SubmitScoutReportChoice") {
    return applyScoutReportChoice(state, _command.payload.cardInstanceIds, _playerId);
  }
  if (_command.type === "SubmitAction") {
    return applyActionDeclaration(state, _command.payload, _playerId);
  }
  if (_command.type === "SubmitMarketBid") {
    return applyMarketBid(state, _command.payload, _playerId);
  }
  if (_command.type === "SubmitMarketRollOff") {
    return applyMarketRollOff(state, _playerId);
  }
  if (_command.type === "SubmitCollectionChoices") {
    return applyCollectionChoice(state, _command.payload, _playerId);
  }
  if (_command.type === "SubmitCombatRetreat") {
    return applyCombatRetreatChoice(state, _playerId, _command.payload);
  }
  return state;
};
var runUntilBlocked = (state) => {
  let nextState = state;
  while (true) {
    if (nextState.winnerPlayerId) {
      return nextState;
    }
    if (nextState.blocks?.type === "combat.retreat") {
      if (nextState.blocks.waitingFor.length > 0) {
        return nextState;
      }
      nextState = resolveCombatRetreatBlock(nextState, nextState.blocks);
      nextState = {
        ...nextState,
        blocks: void 0
      };
      continue;
    }
    if (nextState.blocks?.type === "action.scoutReport") {
      if (nextState.blocks.waitingFor.length > 0) {
        return nextState;
      }
      nextState = resolveScoutReportBlock(nextState, nextState.blocks);
      nextState = {
        ...nextState,
        blocks: void 0
      };
      continue;
    }
    if (nextState.blocks?.type === "market.rollOff") {
      if (nextState.blocks.waitingFor.length > 0) {
        return nextState;
      }
      nextState = resolveMarketRollOff(nextState);
      if (nextState.blocks?.type === "market.rollOff") {
        return nextState;
      }
      continue;
    }
    if (nextState.phase === "round.reset") {
      const resetState = applyRoundReset(nextState);
      nextState = resetState.phase !== nextState.phase ? enterPhase(resetState, resetState.phase) : resetState;
      continue;
    }
    if (nextState.phase === "round.study") {
      if (!nextState.blocks) {
        const block = createQuietStudyBlock(nextState);
        if (!block) {
          nextState = enterPhase(nextState, "round.action");
          continue;
        }
        nextState = {
          ...nextState,
          blocks: block
        };
        if (block.waitingFor.length > 0) {
          return nextState;
        }
      }
      if (nextState.blocks.type === "round.quietStudy") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveQuietStudyChoices(nextState);
        nextState = {
          ...nextState,
          blocks: void 0
        };
        nextState = enterPhase(nextState, "round.market");
        continue;
      }
      return nextState;
    }
    if (nextState.phase === "round.market") {
      nextState = prepareMarketRow(nextState);
      if (!nextState.blocks) {
        const block = createMarketBidBlock(nextState);
        if (!block) {
          const quietStudyBlock = createQuietStudyBlock(nextState);
          if (quietStudyBlock) {
            nextState = enterPhase(nextState, "round.study");
            continue;
          }
          nextState = enterPhase(nextState, "round.action");
          continue;
        }
        nextState = {
          ...nextState,
          blocks: block
        };
        continue;
      }
      if (nextState.blocks.type === "market.bidsForCard") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveMarketBids(nextState);
        if (nextState.blocks?.type === "market.rollOff") {
          return nextState;
        }
        nextState = {
          ...nextState,
          blocks: void 0
        };
        continue;
      }
      return nextState;
    }
    if (nextState.phase === "round.action") {
      if (nextState.actionResolution) {
        nextState = resolveNextActionEntry(nextState);
        if (nextState.blocks?.type === "combat.retreat") {
          return nextState;
        }
        continue;
      }
      if (!nextState.blocks) {
        const block = createActionStepBlock(nextState);
        if (!block) {
          nextState = enterPhase(nextState, "round.sieges");
          continue;
        }
        nextState = {
          ...nextState,
          blocks: block
        };
        continue;
      }
      if (nextState.blocks.type === "actionStep.declarations") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = {
          ...nextState,
          blocks: void 0,
          actionResolution: createActionResolutionState(
            nextState,
            nextState.blocks.payload.declarations
          )
        };
        continue;
      }
      return nextState;
    }
    if (nextState.phase === "round.sieges") {
      nextState = resolveSieges(nextState);
      if (nextState.blocks?.type === "combat.retreat") {
        return nextState;
      }
      nextState = enterPhase(nextState, "round.collection");
      continue;
    }
    if (nextState.phase === "round.collection") {
      if (!nextState.blocks) {
        const collection = createCollectionBlock(nextState);
        if (!collection.block) {
          nextState = enterPhase(collection.state, "round.scoring");
          continue;
        }
        nextState = {
          ...collection.state,
          blocks: collection.block
        };
        continue;
      }
      if (nextState.blocks.type === "collection.choices") {
        if (nextState.blocks.waitingFor.length > 0) {
          return nextState;
        }
        nextState = resolveCollectionChoices(nextState);
        nextState = {
          ...nextState,
          blocks: void 0
        };
        nextState = enterPhase(nextState, "round.scoring");
        continue;
      }
      return nextState;
    }
    if (nextState.phase === "round.scoring") {
      nextState = applyScoring(nextState);
      if (nextState.winnerPlayerId) {
        return nextState;
      }
      nextState = enterPhase(nextState, "round.cleanup");
      continue;
    }
    if (nextState.phase === "round.cleanup") {
      nextState = applyCleanup(nextState);
      nextState = enterPhase(nextState, "round.ageUpdate");
      continue;
    }
    if (nextState.phase === "round.ageUpdate") {
      nextState = applyAgeUpdate(nextState);
      nextState = enterPhase(nextState, "round.reset");
      continue;
    }
    if (nextState.phase !== "setup") {
      return nextState;
    }
    if (!nextState.blocks) {
      return {
        ...nextState,
        blocks: createDeckPreviewBlock()
      };
    }
    if (nextState.blocks.waitingFor.length > 0) {
      return nextState;
    }
    if (!nextState.setup.advanceRequested) {
      return nextState;
    }
    const advanceReadyState = {
      ...nextState,
      setup: {
        ...nextState.setup,
        advanceRequested: false
      }
    };
    if (advanceReadyState.blocks.type === "setup.deckPreview") {
      const capitalSlots = getCapitalSlots(
        advanceReadyState.players.length,
        advanceReadyState.board.radius,
        advanceReadyState.config.capitalSlotsByPlayerCount
      );
      nextState = {
        ...advanceReadyState,
        blocks: createCapitalDraftBlock(advanceReadyState.players, capitalSlots)
      };
      continue;
    }
    if (advanceReadyState.blocks.type === "setup.capitalDraft") {
      const setupState = finalizeCapitalDraft(advanceReadyState);
      nextState = {
        ...setupState,
        blocks: createStartingBridgesBlock(setupState.players)
      };
      continue;
    }
    if (advanceReadyState.blocks.type === "setup.startingBridges") {
      const revealed = finalizeStartingBridges(advanceReadyState);
      const { state: updatedState, block } = createFreeStartingCardBlock(revealed);
      nextState = {
        ...updatedState,
        blocks: block
      };
      continue;
    }
    if (advanceReadyState.blocks.type === "setup.freeStartingCardPick") {
      const finalized = finalizeFreeStartingCardPick(advanceReadyState);
      nextState = enterPhase(finalized, "round.reset");
      continue;
    }
    return nextState;
  }
};

// packages/engine/src/view.ts
var isSetupBlock = (block) => block.type === "setup.deckPreview" || block.type === "setup.capitalDraft" || block.type === "setup.startingBridges" || block.type === "setup.freeStartingCardPick";
var buildSetupPublicView = (block) => {
  if (block.type === "setup.deckPreview") {
    return {
      type: block.type,
      waitingForPlayerIds: block.waitingFor
    };
  }
  if (block.type === "setup.capitalDraft") {
    return {
      type: block.type,
      waitingForPlayerIds: block.waitingFor,
      availableSlots: block.payload.availableSlots,
      choices: block.payload.choices
    };
  }
  if (block.type === "setup.startingBridges") {
    return {
      type: block.type,
      waitingForPlayerIds: block.waitingFor,
      remaining: block.payload.remaining
    };
  }
  const chosen = Object.fromEntries(
    Object.entries(block.payload.chosen).map(([playerId, cardId]) => [playerId, Boolean(cardId)])
  );
  return {
    type: block.type,
    waitingForPlayerIds: block.waitingFor,
    chosen
  };
};
var buildSetupPrivateView = (block, playerId) => {
  if (block.type === "setup.startingBridges") {
    return {
      type: block.type,
      remaining: block.payload.remaining[playerId] ?? 0,
      selectedEdges: block.payload.selectedEdges[playerId] ?? []
    };
  }
  if (block.type !== "setup.freeStartingCardPick") {
    return null;
  }
  return {
    type: block.type,
    offers: block.payload.offers[playerId] ?? [],
    chosen: block.payload.chosen[playerId] ?? null
  };
};
var buildSetupStatusView = (state) => {
  if (state.phase !== "setup") {
    return null;
  }
  const setupBlock = state.blocks && isSetupBlock(state.blocks) ? state.blocks : null;
  const waitingForPlayerIds = setupBlock?.waitingFor ?? [];
  const hostPlayerId = state.players.find((player) => player.seatIndex === 0)?.id ?? null;
  const lockedByPlayerId = Object.fromEntries(
    state.players.map((player) => [player.id, !waitingForPlayerIds.includes(player.id)])
  );
  return {
    phase: setupBlock ? setupBlock.type : "setup.lobby",
    hostPlayerId,
    lockedByPlayerId,
    waitingForPlayerIds,
    canAdvance: Boolean(setupBlock && waitingForPlayerIds.length === 0)
  };
};
var buildCombatRetreatView = (block) => {
  return {
    hexKey: block.payload.hexKey,
    attackers: block.payload.attackers,
    defenders: block.payload.defenders,
    waitingForPlayerIds: block.waitingFor,
    eligiblePlayerIds: block.payload.eligiblePlayerIds,
    availableEdges: block.payload.availableEdges,
    choices: block.payload.choices
  };
};
var mapCardInstances = (state, instanceIds) => {
  return instanceIds.map(
    (instanceId) => state.cardsByInstanceId[instanceId] ?? { id: instanceId, defId: "unknown" }
  );
};
var toModifierView = (modifier) => {
  const { hooks, ...rest } = modifier;
  return rest;
};
var buildView = (state, viewerPlayerId) => {
  const viewer = state.players.find((player) => player.id === viewerPlayerId) ?? null;
  const controlTotals = viewer ? getControlTotals(state) : null;
  const viewerVp = viewer && controlTotals ? (() => {
    const baseControl = controlTotals[viewer.id] ?? 0;
    const controlBonus = getControlBonus(state, { playerId: viewer.id }, 0);
    const control = baseControl + controlBonus;
    return {
      ...viewer.vp,
      control,
      total: viewer.vp.permanent + control
    };
  })() : null;
  const actionStep = state.blocks?.type === "actionStep.declarations" ? {
    eligiblePlayerIds: Object.keys(state.blocks.payload.declarations),
    waitingForPlayerIds: state.blocks.waitingFor
  } : null;
  const setupPublic = state.phase === "setup" && state.blocks && isSetupBlock(state.blocks) ? buildSetupPublicView(state.blocks) : null;
  const setupPrivate = viewer && state.phase === "setup" && state.blocks && isSetupBlock(state.blocks) ? buildSetupPrivateView(state.blocks, viewer.id) : null;
  const collectionPublic = state.phase === "round.collection" && state.blocks?.type === "collection.choices" ? { waitingForPlayerIds: state.blocks.waitingFor } : null;
  const collectionPrivate = viewer && state.phase === "round.collection" && state.blocks?.type === "collection.choices" ? {
    prompts: state.blocks.payload.prompts[viewer.id] ?? [],
    choices: state.blocks.payload.choices[viewer.id] ?? null
  } : null;
  const quietStudyPublic = state.phase === "round.study" && state.blocks?.type === "round.quietStudy" ? { waitingForPlayerIds: state.blocks.waitingFor } : null;
  const quietStudyPrivate = viewer && state.phase === "round.study" && state.blocks?.type === "round.quietStudy" ? {
    maxDiscard: state.blocks.payload.maxDiscard,
    selected: state.blocks.payload.choices[viewer.id] ?? null,
    isWaiting: state.blocks.waitingFor.includes(viewer.id)
  } : null;
  const scoutReportPrivate = viewer && state.blocks?.type === "action.scoutReport" && state.blocks.payload.playerId === viewer.id ? {
    offers: mapCardInstances(state, state.blocks.payload.offers),
    keepCount: state.blocks.payload.keepCount,
    selected: state.blocks.payload.chosen ?? null,
    isWaiting: state.blocks.waitingFor.includes(viewer.id)
  } : null;
  const setupStatus = buildSetupStatusView(state);
  const combatPublic = state.blocks?.type === "combat.retreat" ? buildCombatRetreatView(state.blocks) : null;
  return {
    public: {
      config: state.config,
      seed: state.seed,
      round: state.round,
      phase: state.phase,
      board: state.board,
      modifiers: state.modifiers.map(toModifierView),
      market: state.market,
      logs: state.logs,
      players: state.players.map((player) => ({
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        factionId: player.factionId,
        resources: player.resources,
        handCount: player.deck.hand.length,
        vp: state.winnerPlayerId ? player.vp : null,
        doneThisRound: player.doneThisRound,
        connected: player.visibility.connected
      })),
      actionStep,
      combat: combatPublic,
      setup: setupPublic,
      setupStatus,
      collection: collectionPublic,
      quietStudy: quietStudyPublic,
      winnerPlayerId: state.winnerPlayerId
    },
    private: viewer ? {
      playerId: viewer.id,
      hand: viewer.deck.hand,
      handCards: mapCardInstances(state, viewer.deck.hand),
      deckCounts: {
        drawPile: viewer.deck.drawPile.length,
        discardPile: viewer.deck.discardPile.length,
        scrapped: viewer.deck.scrapped.length,
        burned: viewer.burned.length
      },
      deckCards: {
        drawPile: mapCardInstances(state, viewer.deck.drawPile),
        discardPile: mapCardInstances(state, viewer.deck.discardPile),
        scrapped: mapCardInstances(state, viewer.deck.scrapped),
        burned: mapCardInstances(state, viewer.burned)
      },
      vp: viewerVp,
      setup: setupPrivate,
      collection: collectionPrivate,
      quietStudy: quietStudyPrivate,
      scoutReport: scoutReportPrivate
    } : null
  };
};

// apps/server/src/server.ts
var MIN_PLAYERS = 2;
var MAX_PLAYERS = 6;
var MAX_COMBAT_SYNC = 12;
var COMBAT_ROLL_DONE_MS = DEFAULT_CONFIG.COMBAT_ROLL_DONE_MS;
var FACTION_IDS = /* @__PURE__ */ new Set([
  "bastion",
  "veil",
  "aerial",
  "prospect",
  "cipher",
  "gatewright"
]);
var HEX_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];
var parseHexKey2 = (key) => {
  const parts = key.split(",");
  if (parts.length !== 2) {
    throw new Error("hex key must be in the form q,r");
  }
  const q = Number(parts[0]);
  const r = Number(parts[1]);
  if (!Number.isInteger(q) || !Number.isInteger(r)) {
    throw new Error("hex key coordinates must be integers");
  }
  return { q, r };
};
var toHexKey2 = (coord) => `${coord.q},${coord.r}`;
var axialDistance2 = (a, b) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
var neighborHexKeys2 = (key) => {
  const coord = parseHexKey2(key);
  return HEX_DIRS.map((dir) => toHexKey2({ q: coord.q + dir.q, r: coord.r + dir.r }));
};
var pickCapitalSlot = (block) => {
  const taken = new Set(
    Object.values(block.payload.choices).filter((hexKey) => Boolean(hexKey))
  );
  const available = block.payload.availableSlots.find((hexKey) => !taken.has(hexKey));
  if (!available) {
    throw new Error("no available capital slots");
  }
  return available;
};
var getStartingBridgeOptions = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    throw new Error("player has no capital for starting bridges");
  }
  const capitalCoord = parseHexKey2(player.capitalHex);
  const candidates = /* @__PURE__ */ new Set();
  for (const hexKey of Object.keys(state.board.hexes)) {
    const coord = parseHexKey2(hexKey);
    if (axialDistance2(coord, capitalCoord) > 2) {
      continue;
    }
    for (const neighborKey of neighborHexKeys2(hexKey)) {
      if (!state.board.hexes[neighborKey]) {
        continue;
      }
      candidates.add(getBridgeKey(hexKey, neighborKey));
    }
  }
  return Array.from(candidates).sort();
};
var pickStartingBridge = (state, block, playerId) => {
  const placed = new Set(block.payload.selectedEdges[playerId] ?? []);
  const options = getStartingBridgeOptions(state, playerId);
  const edgeKey = options.find((candidate) => !placed.has(candidate));
  if (!edgeKey) {
    throw new Error("no available starting bridge edges");
  }
  return edgeKey;
};
var pickFreeStartingCard = (block, playerId) => {
  const offers = block.payload.offers[playerId];
  if (!offers || offers.length === 0) {
    throw new Error("no free starting card offer available");
  }
  return offers[0];
};
var buildAutoSetupChoice = (state) => {
  const block = state.blocks;
  if (!block || block.type === "actionStep.declarations") {
    throw new Error("no setup block available");
  }
  const playerId = block.waitingFor[0];
  if (!playerId) {
    throw new Error("no player awaiting setup choice");
  }
  if (block.type === "setup.capitalDraft") {
    return {
      playerId,
      choice: { kind: "pickCapital", hexKey: pickCapitalSlot(block) }
    };
  }
  if (block.type === "setup.startingBridges") {
    return {
      playerId,
      choice: {
        kind: "placeStartingBridge",
        edgeKey: pickStartingBridge(state, block, playerId)
      }
    };
  }
  if (block.type === "setup.freeStartingCardPick") {
    return {
      playerId,
      choice: {
        kind: "pickFreeStartingCard",
        cardId: pickFreeStartingCard(block, playerId)
      }
    };
  }
  throw new Error("unsupported setup block");
};
var runAutoSetup = (state) => {
  let nextState = runUntilBlocked(state);
  for (let step = 0; step < 200; step += 1) {
    if (nextState.phase !== "setup") {
      return nextState;
    }
    if (!nextState.blocks || nextState.blocks.waitingFor.length === 0) {
      if (nextState.blocks && nextState.blocks.waitingFor.length === 0) {
        const hostId = nextState.players.find((player) => player.seatIndex === 0)?.id;
        if (!hostId) {
          throw new Error("no host available to advance setup");
        }
        nextState = applyCommand(nextState, { type: "AdvanceSetup" }, hostId);
      }
      nextState = runUntilBlocked(nextState);
      continue;
    }
    const { playerId, choice } = buildAutoSetupChoice(nextState);
    nextState = applyCommand(
      nextState,
      { type: "SubmitSetupChoice", payload: choice },
      playerId
    );
    nextState = runUntilBlocked(nextState);
  }
  throw new Error("auto-setup exceeded step limit");
};
var buildDebugCollectionChoices = (state, playerId, prompts) => {
  const player = state.players.find((entry) => entry.id === playerId);
  const hand = player?.deck.hand ?? [];
  const choices = prompts.map((prompt) => {
    if (prompt.kind === "forge") {
      if (hand.length > 0) {
        return {
          kind: "forge",
          hexKey: prompt.hexKey,
          choice: "reforge",
          scrapCardId: hand[0]
        };
      }
      if (prompt.revealed.length > 0) {
        return {
          kind: "forge",
          hexKey: prompt.hexKey,
          choice: "draft",
          cardId: prompt.revealed[0]
        };
      }
      return null;
    }
    if (prompt.revealed.length > 0) {
      return {
        kind: "center",
        hexKey: prompt.hexKey,
        cardId: prompt.revealed[0]
      };
    }
    return null;
  });
  if (choices.some((choice) => choice === null)) {
    return null;
  }
  return choices;
};
var resolveDebugBlock = (state) => {
  const block = state.blocks;
  if (!block) {
    return state;
  }
  if (block.type.startsWith("setup.")) {
    return runAutoSetup(state);
  }
  if (block.type === "actionStep.declarations") {
    let nextState = state;
    for (const playerId of block.waitingFor) {
      nextState = applyCommand(
        nextState,
        { type: "SubmitAction", payload: { kind: "done" } },
        playerId
      );
    }
    return nextState;
  }
  if (block.type === "market.bidsForCard") {
    let nextState = state;
    for (const playerId of block.waitingFor) {
      nextState = applyCommand(
        nextState,
        { type: "SubmitMarketBid", payload: { kind: "pass", amount: 0 } },
        playerId
      );
    }
    return nextState;
  }
  if (block.type === "market.rollOff") {
    let nextState = state;
    for (const playerId of block.waitingFor) {
      nextState = applyCommand(nextState, { type: "SubmitMarketRollOff" }, playerId);
    }
    return nextState;
  }
  if (block.type === "collection.choices") {
    let nextState = state;
    for (const playerId of block.waitingFor) {
      const prompts = block.payload.prompts[playerId] ?? [];
      const choices = buildDebugCollectionChoices(nextState, playerId, prompts);
      if (!choices) {
        continue;
      }
      nextState = applyCommand(
        nextState,
        { type: "SubmitCollectionChoices", payload: choices },
        playerId
      );
    }
    return nextState;
  }
  return state;
};
var advanceToNextPhaseDebug = (state) => {
  const startPhase = state.phase;
  let nextState = state;
  for (let step = 0; step < 100; step += 1) {
    nextState = runUntilBlocked(nextState);
    if (nextState.phase !== startPhase) {
      return nextState;
    }
    if (!nextState.blocks) {
      return nextState;
    }
    const resolved = resolveDebugBlock(nextState);
    if (resolved === nextState) {
      return nextState;
    }
    nextState = resolved;
  }
  return nextState;
};
var parsePatchPath = (path) => {
  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "");
  const parts = normalized.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  return parts.map((part) => /^\d+$/.test(part) ? Number(part) : part);
};
var setValueAtPath = (current, tokens, value) => {
  if (tokens.length === 0) {
    return value;
  }
  const [head, ...rest] = tokens;
  const key = String(head);
  const nextCurrent = current && typeof current === "object" ? current[key] : void 0;
  const nextValue = setValueAtPath(nextCurrent, rest, value);
  const shouldUseArray = Array.isArray(current) || !current && typeof head === "number";
  if (shouldUseArray) {
    const copy = Array.isArray(current) ? [...current] : [];
    if (typeof head === "number") {
      copy[head] = nextValue;
      return copy;
    }
    copy[key] = nextValue;
    return copy;
  }
  const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  return {
    ...base,
    [key]: nextValue
  };
};
var applyStatePatch = (state, path, value) => {
  const tokens = parsePatchPath(path);
  if (!tokens) {
    return null;
  }
  const nextState = setValueAtPath(state, tokens, value);
  if (!nextState || typeof nextState !== "object") {
    return null;
  }
  return nextState;
};
var readRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
};
var readString = (value) => {
  return typeof value === "string" ? value : null;
};
var buildCombatSequenceId = (hexKey, startIndex) => `${hexKey}-${startIndex}`;
var safeParseMessage = (message) => {
  try {
    const parsed = JSON.parse(message);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.type === "join" || parsed.type === "command" || parsed.type === "lobbyCommand" || parsed.type === "debugCommand" || parsed.type === "combatCommand") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};
var createRejoinToken = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
var Server = class {
  constructor(room) {
    this.room = room;
    this.lobbyPlayers = [];
    this.state = null;
    this.lastLogCount = 0;
    this.rejoinTokens = /* @__PURE__ */ new Map();
    this.playerConnections = /* @__PURE__ */ new Map();
    this.combatSyncById = /* @__PURE__ */ new Map();
    this.combatSyncOrder = [];
  }
  send(connection, payload) {
    connection.send(JSON.stringify(payload));
  }
  sendError(connection, message) {
    this.send(connection, { type: "error", message });
  }
  resetCombatSync() {
    this.combatSyncById.clear();
    this.combatSyncOrder = [];
  }
  getCombatSyncSnapshot() {
    return Object.fromEntries(this.combatSyncById.entries());
  }
  trackCombatEvents(events, startIndex) {
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (event.type !== "combat.start") {
        continue;
      }
      const payload = readRecord(event.payload) ?? {};
      const hexKey = readString(payload.hexKey);
      const attackers = readRecord(payload.attackers);
      const defenders = readRecord(payload.defenders);
      const attackerId = readString(attackers?.playerId);
      const defenderId = readString(defenders?.playerId);
      if (!hexKey || !attackerId || !defenderId) {
        continue;
      }
      const sequenceId = buildCombatSequenceId(hexKey, startIndex + index);
      if (this.combatSyncById.has(sequenceId)) {
        continue;
      }
      const playerIds = [attackerId, defenderId];
      const readyByPlayerId = Object.fromEntries(
        playerIds.map((playerId) => [playerId, false])
      );
      const sync = {
        sequenceId,
        playerIds,
        roundIndex: 0,
        readyByPlayerId,
        phaseStartAt: null,
        stage: "idle"
      };
      this.combatSyncById.set(sequenceId, sync);
      this.combatSyncOrder.push(sequenceId);
      if (this.combatSyncOrder.length > MAX_COMBAT_SYNC) {
        const removed = this.combatSyncOrder.shift();
        if (removed) {
          this.combatSyncById.delete(removed);
        }
      }
    }
  }
  getConnectionState(connection) {
    const state = connection.state;
    if (!state || !state.playerId) {
      return null;
    }
    return state;
  }
  setConnectionState(connection, state) {
    connection.setState(state);
  }
  markPlayerConnected(playerId, connected) {
    if (!this.state) {
      return;
    }
    const player = this.state.players.find((entry) => entry.id === playerId);
    if (!player || player.visibility.connected === connected) {
      return;
    }
    this.state = {
      ...this.state,
      players: this.state.players.map(
        (entry) => entry.id === playerId ? { ...entry, visibility: { ...entry.visibility, connected } } : entry
      )
    };
    this.bumpRevision();
  }
  bumpRevision() {
    if (!this.state) {
      return;
    }
    this.state = {
      ...this.state,
      revision: this.state.revision + 1
    };
  }
  createMapSeed() {
    return Math.floor(Math.random() * 4294967295);
  }
  isDebugAllowed() {
    const env = this.room.env;
    const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV;
    return nodeEnv !== "production";
  }
  getHostPlayerId() {
    if (this.state) {
      return this.state.players.find((player) => player.seatIndex === 0)?.id ?? null;
    }
    return this.lobbyPlayers[0]?.id ?? null;
  }
  collectEvents() {
    if (!this.state) {
      return [];
    }
    const logs = this.state.logs;
    const logsShrunk = logs.length < this.lastLogCount;
    const startIndex = logsShrunk ? 0 : this.lastLogCount;
    let events = [];
    if (this.lastLogCount === 0 || logsShrunk) {
      events = logs;
    } else {
      events = logs.slice(this.lastLogCount);
    }
    this.lastLogCount = logs.length;
    if (logsShrunk) {
      this.resetCombatSync();
    }
    if (events.length > 0) {
      this.trackCombatEvents(events, startIndex);
    }
    return events;
  }
  broadcastUpdate(events = []) {
    if (!this.state) {
      return;
    }
    const serverTime = Date.now();
    const combatSync = this.getCombatSyncSnapshot();
    for (const connection of this.room.getConnections()) {
      const meta = this.getConnectionState(connection);
      const viewerId = meta && !meta.spectator ? meta.playerId : null;
      const view = buildView(this.state, viewerId);
      this.send(connection, {
        type: "update",
        revision: this.state.revision,
        events,
        view,
        serverTime,
        combatSync
      });
    }
  }
  getLobbySnapshot() {
    const players = this.lobbyPlayers.map((player, index) => ({
      id: player.id,
      name: player.name,
      seatIndex: index,
      connected: (this.playerConnections.get(player.id) ?? 0) > 0,
      factionId: player.factionId ?? null
    }));
    return {
      players,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS
    };
  }
  broadcastLobby() {
    if (this.state) {
      return;
    }
    const lobby = this.getLobbySnapshot();
    for (const connection of this.room.getConnections()) {
      this.send(connection, { type: "lobby", lobby });
    }
  }
  syncLobbySeatIndices() {
    const seatIndexById = new Map(
      this.lobbyPlayers.map((player, index) => [player.id, index])
    );
    for (const connection of this.room.getConnections()) {
      const meta = this.getConnectionState(connection);
      if (!meta || meta.spectator) {
        continue;
      }
      const seatIndex = seatIndexById.get(meta.playerId);
      if (seatIndex === void 0 || meta.seatIndex === seatIndex) {
        continue;
      }
      this.setConnectionState(connection, { ...meta, seatIndex });
    }
  }
  pruneDisconnectedLobbyPlayers() {
    if (this.state) {
      return;
    }
    const activeIds = new Set(
      this.lobbyPlayers.filter((player) => (this.playerConnections.get(player.id) ?? 0) > 0).map((player) => player.id)
    );
    if (activeIds.size === this.lobbyPlayers.length) {
      return;
    }
    const removedIds = new Set(
      this.lobbyPlayers.filter((player) => !activeIds.has(player.id)).map((player) => player.id)
    );
    this.lobbyPlayers = this.lobbyPlayers.filter((player) => activeIds.has(player.id));
    for (const [token, playerId] of this.rejoinTokens.entries()) {
      if (removedIds.has(playerId)) {
        this.rejoinTokens.delete(token);
      }
    }
    this.syncLobbySeatIndices();
  }
  removeLobbyPlayer(playerId) {
    if (this.state) {
      return;
    }
    if ((this.playerConnections.get(playerId) ?? 0) > 0) {
      return;
    }
    if (!this.lobbyPlayers.some((player) => player.id === playerId)) {
      return;
    }
    this.lobbyPlayers = this.lobbyPlayers.filter((player) => player.id !== playerId);
    for (const [token, tokenPlayerId] of this.rejoinTokens.entries()) {
      if (tokenPlayerId === playerId) {
        this.rejoinTokens.delete(token);
      }
    }
    this.syncLobbySeatIndices();
  }
  nextPlayerId() {
    const used = new Set(this.lobbyPlayers.map((player) => player.id));
    let index = 1;
    while (used.has(`p${index}`)) {
      index += 1;
    }
    return `p${index}`;
  }
  startGameFromLobby() {
    if (this.state) {
      return;
    }
    if (this.lobbyPlayers.length < MIN_PLAYERS) {
      return;
    }
    const seed = this.createMapSeed();
    let nextState = runUntilBlocked(createNewGame(DEFAULT_CONFIG, seed, this.lobbyPlayers));
    nextState = {
      ...nextState,
      players: nextState.players.map((player) => ({
        ...player,
        visibility: {
          connected: (this.playerConnections.get(player.id) ?? 0) > 0
        }
      }))
    };
    this.state = nextState;
    this.bumpRevision();
    this.lastLogCount = this.state.logs.length;
    this.resetCombatSync();
  }
  registerPlayerConnection(playerId) {
    const count = (this.playerConnections.get(playerId) ?? 0) + 1;
    this.playerConnections.set(playerId, count);
    if (count === 1) {
      this.markPlayerConnected(playerId, true);
      if (!this.state) {
        this.broadcastLobby();
      }
    }
  }
  unregisterPlayerConnection(playerId) {
    const count = (this.playerConnections.get(playerId) ?? 0) - 1;
    if (count > 0) {
      this.playerConnections.set(playerId, count);
      return;
    }
    this.playerConnections.delete(playerId);
    this.markPlayerConnected(playerId, false);
    if (!this.state) {
      this.broadcastLobby();
    }
  }
  handleJoin(message, connection) {
    if (this.getConnectionState(connection)) {
      this.sendError(connection, "connection already joined");
      return;
    }
    const requestedToken = message.rejoinToken;
    const allowSpectator = Boolean(message.asSpectator);
    if (requestedToken && this.rejoinTokens.has(requestedToken)) {
      const playerId2 = this.rejoinTokens.get(requestedToken);
      const seatIndex2 = this.state ? this.state.players.findIndex((player) => player.id === playerId2) : this.lobbyPlayers.findIndex((player) => player.id === playerId2);
      if (seatIndex2 === -1) {
        this.sendError(connection, "rejoin token is no longer valid");
        return;
      }
      this.setConnectionState(connection, {
        playerId: playerId2,
        seatIndex: seatIndex2,
        spectator: false,
        rejoinToken: requestedToken
      });
      this.registerPlayerConnection(playerId2);
      const view2 = this.state ? buildView(this.state, playerId2) : null;
      this.send(connection, {
        type: "welcome",
        playerId: playerId2,
        seatIndex: seatIndex2,
        rejoinToken: requestedToken,
        view: view2
      });
      if (this.state) {
        this.broadcastUpdate();
      } else {
        this.broadcastLobby();
      }
      return;
    }
    if (this.state) {
      if (allowSpectator) {
        this.setConnectionState(connection, {
          playerId: `spectator:${connection.id}`,
          seatIndex: null,
          spectator: true
        });
        const view2 = buildView(this.state, null);
        this.send(connection, {
          type: "welcome",
          playerId: `spectator:${connection.id}`,
          seatIndex: null,
          rejoinToken: null,
          view: view2
        });
        return;
      }
      this.sendError(connection, "game already started; join as spectator or use a rejoin token");
      return;
    }
    this.pruneDisconnectedLobbyPlayers();
    if (this.lobbyPlayers.length >= MAX_PLAYERS) {
      this.sendError(connection, "lobby is full");
      return;
    }
    const seatIndex = this.lobbyPlayers.length;
    const playerId = this.nextPlayerId();
    const name = typeof message.name === "string" && message.name.trim().length > 0 ? message.name.trim() : `Player ${seatIndex + 1}`;
    this.lobbyPlayers.push({ id: playerId, name });
    const token = createRejoinToken();
    this.rejoinTokens.set(token, playerId);
    this.setConnectionState(connection, {
      playerId,
      seatIndex,
      spectator: false,
      rejoinToken: token
    });
    this.registerPlayerConnection(playerId);
    const view = this.state ? buildView(this.state, playerId) : null;
    this.send(connection, {
      type: "welcome",
      playerId,
      seatIndex,
      rejoinToken: token,
      view,
      serverTime: Date.now(),
      combatSync: this.getCombatSyncSnapshot()
    });
    if (this.state) {
      this.broadcastUpdate();
    } else {
      this.broadcastLobby();
    }
  }
  handleCommand(message, connection) {
    if (!this.state) {
      this.sendError(connection, "game has not started");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot send commands");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    try {
      const applied = applyCommand(this.state, message.command, message.playerId);
      const advanced = runUntilBlocked(applied);
      this.state = {
        ...advanced,
        revision: this.state.revision + 1
      };
      const events = this.collectEvents();
      this.broadcastUpdate(events);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "command rejected";
      this.sendError(connection, reason);
    }
  }
  handleCombatCommand(message, connection) {
    if (!this.state) {
      this.sendError(connection, "game has not started");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot send combat commands");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const sequenceId = typeof message.sequenceId === "string" ? message.sequenceId.trim() : "";
    const roundIndex = typeof message.roundIndex === "number" && Number.isFinite(message.roundIndex) ? message.roundIndex : -1;
    if (!sequenceId || roundIndex < 0) {
      this.sendError(connection, "invalid combat command");
      return;
    }
    const sync = this.combatSyncById.get(sequenceId);
    if (!sync) {
      this.sendError(connection, "combat sequence not found");
      return;
    }
    if (!sync.playerIds.includes(meta.playerId)) {
      this.sendError(connection, "player not in this combat");
      return;
    }
    const now = Date.now();
    const rollDoneMs = this.state.config.COMBAT_ROLL_DONE_MS ?? COMBAT_ROLL_DONE_MS;
    const stage = sync.stage ?? "idle";
    if (roundIndex < sync.roundIndex) {
      this.sendError(connection, "combat round already resolved");
      return;
    }
    if (roundIndex > sync.roundIndex + 1) {
      this.sendError(connection, "combat round out of range");
      return;
    }
    const rollElapsed = stage === "rolling" && sync.phaseStartAt ? now - sync.phaseStartAt : null;
    const rollDone = rollElapsed !== null && rollElapsed >= rollDoneMs;
    if (roundIndex > sync.roundIndex) {
      if (stage !== "assigned") {
        this.sendError(connection, "combat round is still resolving");
        return;
      }
      sync.roundIndex = roundIndex;
      sync.stage = "idle";
      sync.phaseStartAt = null;
      sync.readyByPlayerId = Object.fromEntries(
        sync.playerIds.map((playerId) => [playerId, false])
      );
    } else if (stage === "idle") {
      sync.readyByPlayerId[meta.playerId] = true;
      const allReady = sync.playerIds.every(
        (playerId) => sync.readyByPlayerId[playerId]
      );
      if (allReady) {
        sync.stage = "rolling";
        sync.phaseStartAt = now;
        sync.readyByPlayerId = Object.fromEntries(
          sync.playerIds.map((playerId) => [playerId, false])
        );
      }
    } else if (stage === "rolling") {
      if (!rollDone) {
        this.sendError(connection, "combat round is still resolving");
        return;
      }
      sync.readyByPlayerId[meta.playerId] = true;
      const allReady = sync.playerIds.every(
        (playerId) => sync.readyByPlayerId[playerId]
      );
      if (allReady) {
        sync.stage = "assigned";
        sync.phaseStartAt = null;
        sync.readyByPlayerId = Object.fromEntries(
          sync.playerIds.map((playerId) => [playerId, false])
        );
      }
    } else {
      sync.readyByPlayerId[meta.playerId] = true;
      const allReady = sync.playerIds.every(
        (playerId) => sync.readyByPlayerId[playerId]
      );
      if (allReady) {
        sync.roundIndex += 1;
        sync.stage = "idle";
        sync.phaseStartAt = null;
        sync.readyByPlayerId = Object.fromEntries(
          sync.playerIds.map((playerId) => [playerId, false])
        );
      }
    }
    this.combatSyncById.set(sequenceId, sync);
    this.broadcastUpdate();
  }
  handleLobbyCommand(message, connection) {
    if (message.command === "startGame") {
      this.handleStartGame(message, connection);
      return;
    }
    if (message.command === "autoSetup") {
      this.handleAutoSetup(message, connection);
      return;
    }
    if (message.command === "pickFaction") {
      this.handlePickFaction(message, connection);
      return;
    }
    if (message.command === "rerollMap") {
      this.handleRerollMap(message, connection);
      return;
    }
    if (message.command === "rollDice") {
      this.handleRollDice(message, connection);
    }
  }
  handleDebugCommand(message, connection) {
    if (!this.isDebugAllowed()) {
      this.sendError(connection, "debug commands are disabled");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot send debug commands");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const hostId = this.getHostPlayerId();
    if (!hostId || hostId !== meta.playerId) {
      this.sendError(connection, "only the host can use debug commands");
      return;
    }
    if (message.command === "state") {
      if (!this.state) {
        this.sendError(connection, "game has not started");
        return;
      }
      this.send(connection, { type: "debugState", state: this.state });
      return;
    }
    if (message.command === "advancePhase") {
      if (!this.state) {
        this.sendError(connection, "game has not started");
        return;
      }
      const nextState = advanceToNextPhaseDebug(this.state);
      this.state = {
        ...nextState,
        revision: this.state.revision + 1
      };
      const events = this.collectEvents();
      this.broadcastUpdate(events);
      return;
    }
    if (message.command === "patchState") {
      if (!this.state) {
        this.sendError(connection, "game has not started");
        return;
      }
      const path = typeof message.path === "string" ? message.path.trim() : "";
      if (!path) {
        this.sendError(connection, "patchState requires a non-empty path");
        return;
      }
      const nextState = applyStatePatch(this.state, path, message.value);
      if (!nextState) {
        this.sendError(connection, "patchState could not apply path");
        return;
      }
      this.state = {
        ...nextState,
        revision: this.state.revision + 1
      };
      const events = this.collectEvents();
      this.broadcastUpdate(events);
      return;
    }
    if (message.command === "resetGame") {
      const lobbyPlayers = this.state ? [...this.state.players].sort((a, b) => a.seatIndex - b.seatIndex).map((player) => ({ id: player.id, name: player.name, factionId: player.factionId })) : [...this.lobbyPlayers];
      if (lobbyPlayers.length < MIN_PLAYERS) {
        this.sendError(connection, `need at least ${MIN_PLAYERS} players to reset`);
        return;
      }
      const seed = typeof message.seed === "number" && Number.isFinite(message.seed) ? message.seed : this.createMapSeed();
      const config = this.state?.config ?? DEFAULT_CONFIG;
      let nextState = runUntilBlocked(createNewGame(config, seed, lobbyPlayers));
      nextState = {
        ...nextState,
        players: nextState.players.map((player) => ({
          ...player,
          visibility: {
            connected: (this.playerConnections.get(player.id) ?? 0) > 0
          }
        }))
      };
      const nextRevision = (this.state?.revision ?? 0) + 1;
      this.state = { ...nextState, revision: nextRevision };
      this.lastLogCount = this.state.logs.length;
      this.resetCombatSync();
      this.broadcastUpdate();
      return;
    }
  }
  handleStartGame(message, connection) {
    if (this.state) {
      this.sendError(connection, "game already started");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot start the game");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const hostId = this.lobbyPlayers[0]?.id ?? null;
    if (!hostId || hostId !== meta.playerId) {
      this.sendError(connection, "only the host can start the game");
      return;
    }
    if (this.lobbyPlayers.length < MIN_PLAYERS) {
      this.sendError(connection, `need at least ${MIN_PLAYERS} players to start`);
      return;
    }
    if (this.lobbyPlayers.some((player) => !player.factionId)) {
      this.sendError(connection, "all players must pick a faction before starting");
      return;
    }
    const uniqueFactions = /* @__PURE__ */ new Set();
    for (const player of this.lobbyPlayers) {
      if (!player.factionId) {
        continue;
      }
      if (uniqueFactions.has(player.factionId)) {
        this.sendError(connection, "factions must be unique before starting");
        return;
      }
      uniqueFactions.add(player.factionId);
    }
    this.startGameFromLobby();
    if (!this.state) {
      this.sendError(connection, "failed to start game");
      return;
    }
    this.broadcastUpdate();
  }
  handlePickFaction(message, connection) {
    if (this.state) {
      this.sendError(connection, "game already started");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot pick a faction");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const rawFactionId = typeof message.factionId === "string" ? message.factionId.trim() : "";
    if (!rawFactionId) {
      this.sendError(connection, "missing faction id");
      return;
    }
    const normalized = rawFactionId.toLowerCase();
    if (!FACTION_IDS.has(normalized)) {
      this.sendError(connection, "unknown faction id");
      return;
    }
    const player = this.lobbyPlayers.find((entry) => entry.id === meta.playerId);
    if (!player) {
      this.sendError(connection, "player not found in lobby");
      return;
    }
    const claimedBy = this.lobbyPlayers.find(
      (entry) => entry.factionId === normalized && entry.id !== meta.playerId
    );
    if (claimedBy) {
      this.sendError(connection, `faction already claimed by ${claimedBy.name}`);
      return;
    }
    player.factionId = normalized;
    this.broadcastLobby();
  }
  handleAutoSetup(message, connection) {
    if (!this.state) {
      this.sendError(connection, "game has not started");
      return;
    }
    if (this.state.phase !== "setup") {
      this.sendError(connection, "auto-setup is only available during setup");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot run auto-setup");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const hostId = this.state.players.find((player) => player.seatIndex === 0)?.id;
    if (!hostId || hostId !== meta.playerId) {
      this.sendError(connection, "only the host can run auto-setup");
      return;
    }
    try {
      const nextState = runAutoSetup(this.state);
      this.state = {
        ...nextState,
        revision: this.state.revision + 1
      };
      const events = this.collectEvents();
      this.broadcastUpdate(events);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "auto-setup failed";
      this.sendError(connection, reason);
    }
  }
  handleRollDice(message, connection) {
    if (!this.state) {
      this.sendError(connection, "game has not started");
      return;
    }
    if (this.state.phase !== "setup") {
      this.sendError(connection, "dice rolls are only available during the lobby");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot roll the dice");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const roll = Math.floor(Math.random() * 6) + 1;
    const nextState = emit(this.state, {
      type: "lobby.diceRolled",
      payload: { playerId: meta.playerId, roll, sides: 6 }
    });
    this.state = {
      ...nextState,
      revision: this.state.revision + 1
    };
    const events = this.collectEvents();
    this.broadcastUpdate(events);
  }
  handleRerollMap(message, connection) {
    if (!this.state) {
      this.sendError(connection, "game has not started");
      return;
    }
    if (this.state.phase !== "setup") {
      this.sendError(connection, "map reroll is only available during setup");
      return;
    }
    const block = this.state.blocks;
    if (!block || block.type !== "setup.capitalDraft") {
      this.sendError(connection, "map reroll is only available before capital draft starts");
      return;
    }
    if (this.state.players.some((player) => player.capitalHex) || Object.values(block.payload.choices).some(Boolean)) {
      this.sendError(connection, "map reroll is locked after a capital is picked");
      return;
    }
    const meta = this.getConnectionState(connection);
    if (!meta || meta.spectator) {
      this.sendError(connection, "spectators cannot reroll the map");
      return;
    }
    if (message.playerId !== meta.playerId) {
      this.sendError(connection, "player id does not match connection");
      return;
    }
    const hostId = this.state.players.find((player) => player.seatIndex === 0)?.id;
    if (!hostId || hostId !== meta.playerId) {
      this.sendError(connection, "only the host can reroll the map");
      return;
    }
    const lobbyPlayers = [...this.state.players].sort((a, b) => a.seatIndex - b.seatIndex).map((player) => ({ id: player.id, name: player.name, factionId: player.factionId }));
    const seed = this.createMapSeed();
    let nextState = runUntilBlocked(
      createNewGame(this.state.config ?? DEFAULT_CONFIG, seed, lobbyPlayers)
    );
    nextState = {
      ...nextState,
      players: nextState.players.map((player) => ({
        ...player,
        visibility: {
          connected: (this.playerConnections.get(player.id) ?? 0) > 0
        }
      }))
    };
    const nextRevision = this.state.revision + 1;
    this.state = { ...nextState, revision: nextRevision };
    this.lastLogCount = this.state.logs.length;
    this.resetCombatSync();
    this.broadcastUpdate();
  }
  onConnect(connection) {
    this.send(connection, {
      type: "connected",
      roomId: this.room.id
    });
  }
  onMessage(message, sender) {
    if (typeof message !== "string") {
      this.sendError(sender, "unsupported message payload");
      return;
    }
    const parsed = safeParseMessage(message);
    if (!parsed) {
      this.sendError(sender, "invalid message");
      return;
    }
    if (parsed.type === "join") {
      this.handleJoin(parsed, sender);
      return;
    }
    if (parsed.type === "command") {
      this.handleCommand(parsed, sender);
      return;
    }
    if (parsed.type === "lobbyCommand") {
      this.handleLobbyCommand(parsed, sender);
      return;
    }
    if (parsed.type === "debugCommand") {
      this.handleDebugCommand(parsed, sender);
      return;
    }
    if (parsed.type === "combatCommand") {
      this.handleCombatCommand(parsed, sender);
      return;
    }
  }
  onClose(connection) {
    const meta = this.getConnectionState(connection);
    if (meta && !meta.spectator) {
      this.unregisterPlayerConnection(meta.playerId);
      if (this.state) {
        this.broadcastUpdate();
        return;
      }
      this.removeLobbyPlayer(meta.playerId);
      this.broadcastLobby();
    }
  }
};
export {
  Server as default
};
//# sourceMappingURL=.tmp-server-bundle.js.map

import type { GameConfig } from "./types";

export const DEFAULT_CONFIG: GameConfig = {
  MAX_MANA: 5,
  START_GOLD: 4,
  BASE_INCOME: 1,
  HAND_LIMIT: 10,
  CHAMPION_LIMIT: 4,
  ROUNDS_MAX: 10,
  VP_TO_WIN: 8,
  boardRadiusByPlayerCount: {
    2: 3,
    3: 3,
    4: 4,
    5: 4,
    6: 4
  },
  tileCountsByPlayerCount: {
    2: { mines: 3, forges: 1, center: 1 },
    3: { mines: 4, forges: 2, center: 1 },
    4: { mines: 5, forges: 2, center: 1 },
    5: { mines: 6, forges: 3, center: 1 },
    6: { mines: 7, forges: 3, center: 1 }
  },
  capitalSlotsByPlayerCount: {
    2: ["3,0", "-3,0"],
    3: ["3,0", "-3,3", "0,-3"],
    4: ["4,0", "0,4", "-4,0", "0,-4"],
    5: ["4,0", "0,4", "-4,4", "-4,0", "0,-4"],
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
      { value: 4, weight: 50 },
      { value: 5, weight: 30 },
      { value: 6, weight: 20 }
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
    "age1.placeholder.a",
    "age1.placeholder.b",
    "age1.placeholder.c",
    "age1.placeholder.d",
    "age1.placeholder.e",
    "age1.placeholder.f"
  ]
};

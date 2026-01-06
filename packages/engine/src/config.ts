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
    2: 4,
    3: 4,
    4: 5,
    5: 5,
    6: 5
  },
  tileCountsByPlayerCount: {
    2: { mines: 3, forges: 1, center: 1 },
    3: { mines: 4, forges: 2, center: 1 },
    4: { mines: 5, forges: 2, center: 1 },
    5: { mines: 6, forges: 3, center: 1 },
    6: { mines: 7, forges: 3, center: 1 }
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
  }
};

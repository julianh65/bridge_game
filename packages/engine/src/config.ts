import type { GameConfig } from "./types";

export const DEFAULT_CONFIG: GameConfig = {
  MAX_MANA: 6,
  START_GOLD: 4,
  BASE_INCOME: 0,
  HAND_LIMIT: 10,
  HAND_DRAW_SIZE: 7,
  CHAMPION_LIMIT: 3,
  ROUNDS_MAX: 10,
  VP_TO_WIN: 6,
  ACTION_REVEAL_DURATION_MS: 2500,
  ACTION_REVEAL_HIGHLIGHT_PAUSE_MS: 1500,
  MARKET_ROLLOFF_DURATION_MS: 1500,
  COMBAT_ROLL_LOCK_MS: 800,
  COMBAT_ROLL_ASSIGN_MS: 1300,
  COMBAT_ROLL_DONE_MS: 1900,
  COMBAT_AUTO_CLOSE_MS: 2200,
  basicActionFactionOrder: ["aerial", "veil", "cipher", "prospect", "gatewright", "bastion"],
  boardRadiusByPlayerCount: {
    2: 2,
    3: 2,
    4: 3,
    5: 3,
    6: 3
  },
  tileCountsByPlayerCount: {
    2: { mines: 2, forges: 1, center: 1, randomBridges: 5 },
    3: { mines: 2, forges: 1, center: 1, randomBridges: 5 },
    4: { mines: 3, forges: 2, center: 1, randomBridges: 8 },
    5: { mines: 4, forges: 2, center: 1, randomBridges: 8 },
    6: { mines: 5, forges: 3, center: 1, randomBridges: 8 }
  },
  capitalSlotsByPlayerCount: {
    2: ["2,0", "-2,0"],
    3: ["2,0", "-2,2", "0,-2"],
    4: ["3,-1", "-1,3", "-3,1", "1,-3"],
    5: [
      "3,0",
      "-1,3",
      "-3,2",
      "-2,-1",
      "2,-3"
    ],    6: ["3,0", "0,3", "-3,3", "-3,0", "0,-3", "3,-3"]
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
    4: "I",
    5: "II",
    6: "II",
    7: "II",
    8: "II",
    9: "III",
    10: "III",
    11: "III",
    12: "III"
  },
  marketPreviewByRound: {
    1: 0,
    2: 1,
    3: 1,
    4: 1,
    5: 0,
    6: 1,
    7: 1,
    8: 1,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
  },
  freeStartingCardEnabled: true,
  freeStartingCardPool: [
    "age1.quick_march",
    "age1.prospecting",
    "age1.trade_caravan",
    "age1.temporary_bridge",
    "age1.patch_up",
    "age1.quick_study",
    "age1.flank_step",
    "age1.salvage_wager",
    "age1.spoils_of_war",
    "age1.scavengers_market",
    "age1.rapid_span",
    "age1.bridge_trap",
    "age1.cycle_notes",
    "age1.scout_report"
  ]
};

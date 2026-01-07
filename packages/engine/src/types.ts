import type { RNGState } from "@bridgefront/shared";

export type PlayerID = string;
export type CardDefId = string;
export type CardInstanceID = string;
export type UnitID = string;
export type HexKey = string;
export type EdgeKey = string;

export type Phase =
  | "setup"
  | "round.reset"
  | "round.study"
  | "round.market"
  | "round.action"
  | "round.sieges"
  | "round.collection"
  | "round.scoring"
  | "round.cleanup"
  | "round.ageUpdate";

export type PhaseState = Phase;

export type Age = "I" | "II" | "III";

export type TileCounts = {
  mines: number;
  forges: number;
  center: number;
};

export type MineValueWeight = {
  value: number;
  weight: number;
};

export type BoardGenerationRules = {
  minDistanceFromCapital: number;
  forgeDistanceFromCenter: number[];
  mineDistanceFromCenter: number[];
  homeMineDistanceFromCapital: number;
  homeMineMinDistanceFromOtherCapitals: number;
  minForgeSpacing: number;
  minMineSpacing: number;
  maxAttempts: number;
  topK: number;
  mineValueWeights: MineValueWeight[];
};

export type GameConfig = {
  MAX_MANA: number;
  START_GOLD: number;
  BASE_INCOME: number;
  HAND_LIMIT: number;
  CHAMPION_LIMIT: number;
  ROUNDS_MAX: number;
  VP_TO_WIN: number;
  ACTION_REVEAL_DURATION_MS: number;
  MARKET_ROLLOFF_DURATION_MS: number;
  boardRadiusByPlayerCount: Record<number, number>;
  tileCountsByPlayerCount: Record<number, TileCounts>;
  capitalSlotsByPlayerCount: Record<number, HexKey[]>;
  boardGenerationRules: BoardGenerationRules;
  ageByRound: Record<number, Age>;
  marketPreviewByRound: Record<number, number>;
  freeStartingCardPool: CardDefId[];
};

export type ResourceState = {
  gold: number;
  mana: number;
};

export type PlayerState = {
  id: PlayerID;
  name: string;
  seatIndex: number;
  factionId: string;
  capitalHex?: HexKey;
  resources: ResourceState;
  vp: { permanent: number; control: number; total: number };
  doneThisRound: boolean;
  deck: DeckState;
  burned: CardInstanceID[];
  flags: Record<string, unknown>;
  visibility: { connected: boolean };
};

export type DeckState = {
  drawPile: CardInstanceID[];
  discardPile: CardInstanceID[];
  hand: CardInstanceID[];
  scrapped: CardInstanceID[];
};

export type TileType = "normal" | "capital" | "center" | "mine" | "forge";

export type HexState = {
  key: HexKey;
  tile: TileType;
  ownerPlayerId?: PlayerID;
  mineValue?: number;
  occupants: Record<string, UnitID[]>;
};

export type ForceUnitState = {
  id: UnitID;
  ownerPlayerId: PlayerID;
  kind: "force";
  hex: HexKey;
};

export type ChampionUnitState = {
  id: UnitID;
  ownerPlayerId: PlayerID;
  kind: "champion";
  hex: HexKey;
  cardDefId: CardDefId;
  hp: number;
  maxHp: number;
  attackDice: number;
  hitFaces: number;
  bounty: number;
  abilityUses: Record<string, UseCounter>;
};

export type UnitState = ForceUnitState | ChampionUnitState;

export type BridgeState = {
  key: EdgeKey;
  from: HexKey;
  to: HexKey;
  ownerPlayerId?: PlayerID;
  temporary?: boolean;
  locked?: boolean;
};

export type BoardState = {
  radius: number;
  hexes: Record<HexKey, HexState>;
  bridges: Record<EdgeKey, BridgeState>;
  units: Record<UnitID, UnitState>;
};

export type MarketRowCard = {
  cardId: CardDefId;
  age: Age;
  revealed: boolean;
};

export type Bid = {
  kind: "buy" | "pass";
  amount: number;
};

export type MarketState = {
  age: Age;
  currentRow: MarketRowCard[];
  rowIndexResolving: number;
  passPot: number;
  bids: Record<PlayerID, Bid | null>;
  playersOut: Record<PlayerID, boolean>;
};

export type MarketDeckState = Record<Age, CardDefId[]>;
export type PowerDeckState = Record<Age, CardDefId[]>;

export type Duration =
  | { type: "permanent" }
  | { type: "endOfRound" }
  | { type: "endOfBattle" }
  | { type: "uses"; remaining: number };

export type CombatSide = "attackers" | "defenders";

export type HitAssignmentPolicy = "random" | "forcesFirst" | "championsFirst" | "bodyguard";

export type CombatEndReason = "eliminated" | "noHits" | "stale";

export type CombatContext = {
  hexKey: HexKey;
  attackerPlayerId: PlayerID;
  defenderPlayerId: PlayerID;
  round: number;
};

export type CombatUnitContext = CombatContext & {
  side: CombatSide;
  unitId: UnitID;
  unit: UnitState;
};

export type CombatAssignmentContext = CombatContext & {
  targetSide: CombatSide;
  targetUnitIds: UnitID[];
  hits: number;
};

export type CombatRoundContext = CombatContext & {
  attackers: UnitID[];
  defenders: UnitID[];
};

export type CombatEndContext = CombatContext & {
  reason: CombatEndReason;
  winnerPlayerId: PlayerID | null;
  attackers: UnitID[];
  defenders: UnitID[];
};

export type ChampionKillContext = {
  killerPlayerId: PlayerID;
  victimPlayerId: PlayerID;
  killedChampions: ChampionUnitState[];
  bounty: number;
  hexKey: HexKey;
  source: "battle" | "effect";
};

export type MoveContext = {
  playerId: PlayerID;
  from: HexKey;
  to: HexKey;
  path: HexKey[];
  movingUnitIds: UnitID[];
};

export type DeployForcesContext = {
  playerId: PlayerID;
  hexKey: HexKey;
  baseCount: number;
};

export type MineGoldContext = {
  playerId: PlayerID;
  hexKey: HexKey;
  mineValue: number;
};

export type CardChoiceContext = {
  playerId: PlayerID;
  kind: "freeStartingCard" | "mineDraft" | "forgeDraft" | "centerPick";
  baseCount: number;
};

export type CardDrawContext = {
  playerId: PlayerID;
  cardInstanceId: CardInstanceID;
  cardDefId: CardDefId;
  destination: "hand" | "discard";
};

export type ControlValueContext = {
  playerId: PlayerID;
  hexKey: HexKey;
  tile: TileType;
  baseValue: number;
};

export type RoundEndContext = {
  round: number;
};

export type ModifierQueryHook<TContext, TValue> = (
  ctx: TContext & { modifier: Modifier; state: GameState },
  current: TValue
) => TValue;

export type ModifierEventHook<TContext> = (
  ctx: TContext & { modifier: Modifier; state: GameState }
) => GameState;

export type ModifierHooks = {
  getForceHitFaces?: ModifierQueryHook<CombatUnitContext, number>;
  getChampionAttackDice?: ModifierQueryHook<CombatUnitContext, number>;
  getChampionHitFaces?: ModifierQueryHook<CombatUnitContext, number>;
  getHitAssignmentPolicy?: ModifierQueryHook<CombatAssignmentContext, HitAssignmentPolicy>;
  getMoveAdjacency?: ModifierQueryHook<MoveContext, boolean>;
  getMoveRequiresBridge?: ModifierQueryHook<MoveContext, boolean>;
  getMoveMaxDistance?: ModifierQueryHook<MoveContext, number>;
  getDeployForcesCount?: ModifierQueryHook<DeployForcesContext, number>;
  getMineGoldValue?: ModifierQueryHook<MineGoldContext, number>;
  getCardChoiceCount?: ModifierQueryHook<CardChoiceContext, number>;
  getControlValue?: ModifierQueryHook<ControlValueContext, number>;
  getChampionKillBonusGold?: ModifierQueryHook<ChampionKillContext, number>;
  onCardDraw?: ModifierEventHook<CardDrawContext>;
  beforeCombatRound?: ModifierEventHook<CombatRoundContext>;
  afterBattle?: ModifierEventHook<CombatEndContext>;
  onRoundEnd?: ModifierEventHook<RoundEndContext>;
};

export type HookSpec = ModifierHooks;

export type Modifier = {
  id: string;
  source: { type: "faction" | "card" | "champion"; sourceId: string };
  ownerPlayerId?: PlayerID;
  attachedUnitId?: UnitID;
  attachedHex?: HexKey;
  attachedEdge?: EdgeKey;
  duration: Duration;
  data?: Record<string, unknown>;
  hooks?: HookSpec;
};

export type BlockState = {
  type: "setup.capitalDraft";
  waitingFor: PlayerID[];
  payload: {
    availableSlots: HexKey[];
    choices: Record<PlayerID, HexKey | null>;
  };
} | {
  type: "setup.startingBridges";
  waitingFor: PlayerID[];
  payload: {
    remaining: Record<PlayerID, number>;
    placedEdges: Record<PlayerID, EdgeKey[]>;
  };
} | {
  type: "setup.freeStartingCardPick";
  waitingFor: PlayerID[];
  payload: {
    offers: Record<PlayerID, CardDefId[]>;
    chosen: Record<PlayerID, CardDefId | null>;
    remainingDeck: CardDefId[];
  };
} | {
  type: "round.quietStudy";
  waitingFor: PlayerID[];
  payload: {
    maxDiscard: number;
    choices: Record<PlayerID, CardInstanceID[] | null>;
  };
} | {
  type: "market.bidsForCard";
  waitingFor: PlayerID[];
  payload: {
    cardIndex: number;
  };
} | {
  type: "collection.choices";
  waitingFor: PlayerID[];
  payload: {
    prompts: Record<PlayerID, CollectionPrompt[]>;
    choices: Record<PlayerID, CollectionChoice[] | null>;
  };
} | {
  type: "actionStep.declarations";
  waitingFor: PlayerID[];
  payload: {
    declarations: Record<PlayerID, ActionDeclaration | null>;
  };
};

export type GameEvent = {
  type: string;
  payload?: Record<string, unknown>;
  createdAt?: number;
};

export type CardInstance = {
  id: CardInstanceID;
  defId: CardDefId;
};

export type GameState = {
  config: GameConfig;
  seed: number | string;
  rngState: RNGState;
  revision: number;
  createdAt: number;
  players: PlayerState[];
  round: number;
  leadSeatIndex: number;
  phase: PhaseState;
  board: BoardState;
  market: MarketState;
  marketDecks: MarketDeckState;
  powerDecks: PowerDeckState;
  logs: GameEvent[];
  modifiers: Modifier[];
  blocks?: BlockState;
  cardsByInstanceId: Record<CardInstanceID, CardInstance>;
  winnerPlayerId: PlayerID | null;
};

export type LobbyPlayer = {
  id: PlayerID;
  name: string;
  factionId?: string;
};

export type SetupChoice =
  | { kind: "pickCapital"; hexKey: HexKey }
  | { kind: "placeStartingBridge"; edgeKey: EdgeKey }
  | { kind: "pickFreeStartingCard"; cardId: CardDefId };

export type BasicAction =
  | { kind: "buildBridge"; edgeKey: EdgeKey }
  | { kind: "march"; from: HexKey; to: HexKey; forceCount?: number }
  | { kind: "capitalReinforce"; hexKey?: HexKey };

export type CardPlayTargets = Record<string, unknown> | null;

export type CardPlayDeclaration = {
  kind: "card";
  cardInstanceId: CardInstanceID;
  targets?: CardPlayTargets;
};

export type ActionDeclaration =
  | { kind: "basic"; action: BasicAction }
  | CardPlayDeclaration
  | { kind: "done" };

export type Command = {
  type: "SubmitSetupChoice";
  payload: SetupChoice;
} | {
  type: "SubmitQuietStudy";
  payload: { cardInstanceIds: CardInstanceID[] };
} | {
  type: "SubmitAction";
  payload: ActionDeclaration;
} | {
  type: "SubmitMarketBid";
  payload: Bid;
} | {
  type: "SubmitCollectionChoices";
  payload: CollectionChoice[];
};

export type PlayerPublicView = {
  id: PlayerID;
  name: string;
  seatIndex: number;
  factionId: string;
  resources: ResourceState;
  handCount: number;
  vp: PlayerState["vp"] | null;
  doneThisRound: boolean;
  connected: boolean;
};

export type PlayerPrivateView = {
  playerId: PlayerID;
  hand: CardInstanceID[];
  handCards: CardInstance[];
  deckCounts: {
    drawPile: number;
    discardPile: number;
    scrapped: number;
  };
  deckCards: {
    drawPile: CardInstance[];
    discardPile: CardInstance[];
  scrapped: CardInstance[];
  };
  vp: { permanent: number; control: number; total: number };
  setup: SetupPrivateView | null;
  collection: CollectionPrivateView | null;
  quietStudy: QuietStudyPrivateView | null;
};

export type ActionStepPublicView = {
  eligiblePlayerIds: PlayerID[];
  waitingForPlayerIds: PlayerID[];
};

export type CollectionPrompt =
  | {
      kind: "mine";
      hexKey: HexKey;
      mineValue: number;
      revealed: CardDefId[];
    }
  | {
      kind: "forge";
      hexKey: HexKey;
      revealed: CardDefId[];
    }
  | {
      kind: "center";
      hexKey: HexKey;
      revealed: CardDefId[];
    };

export type CollectionChoice =
  | {
      kind: "mine";
      hexKey: HexKey;
      choice: "gold" | "draft";
      gainCard?: boolean;
      cardId?: CardDefId;
    }
  | {
      kind: "forge";
      hexKey: HexKey;
      choice: "reforge";
      scrapCardId: CardInstanceID;
    }
  | {
      kind: "forge";
      hexKey: HexKey;
      choice: "draft";
      cardId: CardDefId;
    }
  | {
      kind: "center";
      hexKey: HexKey;
      cardId: CardDefId;
    };

export type CollectionPublicView = {
  waitingForPlayerIds: PlayerID[];
};

export type CollectionPrivateView = {
  prompts: CollectionPrompt[];
  choices: CollectionChoice[] | null;
};

export type QuietStudyPublicView = {
  waitingForPlayerIds: PlayerID[];
};

export type QuietStudyPrivateView = {
  maxDiscard: number;
  selected: CardInstanceID[] | null;
  isWaiting: boolean;
};

export type SetupPublicView =
  | {
      type: "setup.capitalDraft";
      waitingForPlayerIds: PlayerID[];
      availableSlots: HexKey[];
      choices: Record<PlayerID, HexKey | null>;
    }
  | {
      type: "setup.startingBridges";
      waitingForPlayerIds: PlayerID[];
      remaining: Record<PlayerID, number>;
      placedEdges: Record<PlayerID, EdgeKey[]>;
    }
  | {
      type: "setup.freeStartingCardPick";
      waitingForPlayerIds: PlayerID[];
      chosen: Record<PlayerID, boolean>;
    }
  | null;

export type SetupPrivateView =
  | {
      type: "setup.freeStartingCardPick";
      offers: CardDefId[];
      chosen: CardDefId | null;
    }
  | null;

export type GameView = {
  public: {
    config: GameConfig;
    seed: GameState["seed"];
    round: number;
    phase: PhaseState;
    board: BoardState;
    market: MarketState;
    logs: GameEvent[];
    players: PlayerPublicView[];
    actionStep: ActionStepPublicView | null;
    setup: SetupPublicView | null;
    collection: CollectionPublicView | null;
    quietStudy: QuietStudyPublicView | null;
    winnerPlayerId: PlayerID | null;
  };
  private: PlayerPrivateView | null;
};

export type UseCounter = {
  remaining: number;
};

export type PlayerID = string;
export type CardDefId = string;
export type CardInstanceID = string;
export type UnitID = string;
export type HexKey = string;
export type EdgeKey = string;

export type Phase =
  | "setup"
  | "round.reset"
  | "round.market"
  | "round.action"
  | "round.sieges"
  | "round.collection"
  | "round.scoring"
  | "round.cleanup"
  | "round.ageUpdate";

export type PhaseState = Phase;

export type Age = "I" | "II" | "III";

export type RNGState = {
  seed: number;
  position: number;
};

export type TileCounts = {
  mines: number;
  forges: number;
  center: number;
};

export type GameConfig = {
  MAX_MANA: number;
  START_GOLD: number;
  BASE_INCOME: number;
  HAND_LIMIT: number;
  CHAMPION_LIMIT: number;
  ROUNDS_MAX: number;
  VP_TO_WIN: number;
  boardRadiusByPlayerCount: Record<number, number>;
  tileCountsByPlayerCount: Record<number, TileCounts>;
  ageByRound: Record<number, Age>;
  marketPreviewByRound: Record<number, number>;
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
  resources: ResourceState;
  vp: { permanent: number };
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

export type Duration =
  | { type: "permanent" }
  | { type: "endOfRound" }
  | { type: "endOfBattle" }
  | { type: "uses"; remaining: number };

export type HookSpec = Record<string, unknown>;

export type Modifier = {
  id: string;
  source: { type: "faction" | "card" | "champion"; sourceId: string };
  ownerPlayerId?: PlayerID;
  attachedHex?: HexKey;
  attachedEdge?: EdgeKey;
  duration: Duration;
  data?: Record<string, unknown>;
  hooks?: HookSpec;
};

export type BlockState = {
  type: string;
  waitingFor: PlayerID[];
  payload?: Record<string, unknown>;
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
  logs: GameEvent[];
  modifiers: Modifier[];
  blocks?: BlockState;
  cardsByInstanceId: Record<CardInstanceID, CardInstance>;
};

export type LobbyPlayer = {
  id: PlayerID;
  name: string;
};

export type Command = {
  type: string;
  payload?: Record<string, unknown>;
};

export type PlayerPublicView = {
  id: PlayerID;
  name: string;
  seatIndex: number;
  resources: ResourceState;
  doneThisRound: boolean;
  connected: boolean;
};

export type PlayerPrivateView = {
  playerId: PlayerID;
  hand: CardInstanceID[];
  deckCounts: {
    drawPile: number;
    discardPile: number;
    scrapped: number;
  };
  vp: { permanent: number };
};

export type GameView = {
  public: {
    round: number;
    phase: PhaseState;
    board: BoardState;
    market: MarketState;
    logs: GameEvent[];
    players: PlayerPublicView[];
  };
  private: PlayerPrivateView | null;
};

export type UseCounter = {
  remaining: number;
};

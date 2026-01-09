export { DEFAULT_CONFIG } from "./config";
export {
  createBaseBoard,
  getCapitalSlots,
  placeRandomBridges,
  placeSpecialTiles
} from "./board-generation";
export { CARD_DEFS, CARD_DEFS_BY_ID, applyCardInstanceOverrides } from "./content/cards";
export type { CardDef, CardDeck, CardType } from "./content/cards";
export { MARKET_DECKS_BY_AGE } from "./content/market-decks";
export { POWER_DECKS_BY_AGE } from "./content/power-decks";
export { resolveStarterFactionCards } from "./content/starter-decks";
export {
  countPlayersOnHex,
  getBridgeKey,
  getHex,
  getPlayerIdsOnHex,
  hasBridge,
  hasEnemyUnits,
  isContestedHex,
  isOccupiedByPlayer,
  wouldExceedTwoPlayers
} from "./board";
export {
  applyCommand,
  createNewGame,
  runUntilBlocked
} from "./engine";
export { buildView } from "./view";
export { applyRoundReset } from "./round-flow";
export { emit } from "./events";
export { resolveBattleAtHex } from "./combat";
export { applyChampionDeployment } from "./champions";
export { addChampionToHex, addForcesToHex } from "./units";
export {
  applyScoutReportChoice,
  isCardPlayable,
  resolveCardEffects,
  resolveScoutReportBlock,
  validateMovePath
} from "./card-effects";
export type {
  Age,
  ActionDeclaration,
  BasicAction,
  Bid,
  BoardGenerationRules,
  BlockState,
  BoardState,
  CardDefId,
  CardInstance,
  CardInstanceID,
  CardInstanceOverrides,
  Command,
  CollectionChoice,
  CollectionPrivateView,
  CollectionPrompt,
  CollectionPublicView,
  DeckState,
  GameConfig,
  GameEvent,
  GameState,
  GameView,
  HexKey,
  LobbyPlayer,
  MineValueWeight,
  MarketRowCard,
  MarketState,
  Modifier,
  ModifierView,
  Phase,
  PhaseState,
  PlayerID,
  PlayerState,
  ResourceState,
  SetupChoice,
  SetupConfigUpdate,
  SetupPhase,
  SetupPrivateView,
  SetupPublicView,
  SetupState,
  SetupStatusView,
  TileType,
  UnitID,
  UnitState
} from "./types";

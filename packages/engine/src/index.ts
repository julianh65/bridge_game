export { DEFAULT_CONFIG } from "./config";
export { createBaseBoard, getCapitalSlots, placeSpecialTiles } from "./board-generation";
export { CARD_DEFS } from "./content/cards";
export type { CardDef, CardDeck, CardType } from "./content/cards";
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
  buildView,
  createNewGame,
  runUntilBlocked
} from "./engine";
export { applyRoundReset } from "./round-flow";
export { emit } from "./events";
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
  Command,
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
  Phase,
  PhaseState,
  PlayerID,
  PlayerState,
  ResourceState,
  SetupChoice,
  TileType,
  UnitID,
  UnitState
} from "./types";

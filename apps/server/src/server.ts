import type * as Party from "partykit/server";
import {
  applyCommand,
  buildView,
  createNewGame,
  DEFAULT_CONFIG,
  emit,
  getBridgeKey,
  runUntilBlocked
} from "@bridgefront/engine";
import type {
  BlockState,
  CollectionChoice,
  CollectionPrompt,
  Command,
  GameEvent,
  GameState,
  LobbyPlayer,
  PlayerID,
  SetupChoice
} from "@bridgefront/engine";

type ConnectionState = {
  playerId: PlayerID;
  seatIndex: number | null;
  spectator: boolean;
  rejoinToken?: string;
};

type JoinMessage = {
  type: "join";
  name?: string;
  rejoinToken?: string;
  asSpectator?: boolean;
};

type CommandMessage = {
  type: "command";
  playerId: PlayerID;
  clientSeq?: number;
  command: Command;
};

type LobbyCommandMessage = {
  type: "lobbyCommand";
  playerId: PlayerID;
  command: "rerollMap" | "rollDice" | "startGame" | "autoSetup" | "pickFaction";
  factionId?: string;
};

type DebugCommandMessage = {
  type: "debugCommand";
  playerId: PlayerID;
  command: "state" | "advancePhase" | "resetGame" | "patchState";
  seed?: number;
  path?: string;
  value?: unknown;
};

type CombatCommandMessage = {
  type: "combatCommand";
  playerId: PlayerID;
  command: "roll";
  sequenceId: string;
  roundIndex: number;
};

type ClientMessage =
  | JoinMessage
  | CommandMessage
  | LobbyCommandMessage
  | DebugCommandMessage
  | CombatCommandMessage;

type LobbyPlayerView = {
  id: PlayerID;
  name: string;
  seatIndex: number;
  connected: boolean;
  factionId: string | null;
};

type LobbySnapshot = {
  players: LobbyPlayerView[];
  minPlayers: number;
  maxPlayers: number;
};

type CombatSyncState = {
  sequenceId: string;
  playerIds: PlayerID[];
  roundIndex: number;
  readyByPlayerId: Record<PlayerID, boolean>;
  phaseStartAt: number | null;
  stage: "idle" | "rolling" | "assigned";
};

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const MAX_COMBAT_SYNC = 12;
const COMBAT_ROLL_DONE_MS = DEFAULT_CONFIG.COMBAT_ROLL_DONE_MS;
const FACTION_IDS = new Set([
  "bastion",
  "veil",
  "aerial",
  "prospect",
  "cipher",
  "gatewright"
]);

type AxialCoord = {
  q: number;
  r: number;
};

const HEX_DIRS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

const parseHexKey = (key: string): AxialCoord => {
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

const toHexKey = (coord: AxialCoord): string => `${coord.q},${coord.r}`;

const axialDistance = (a: AxialCoord, b: AxialCoord): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

const neighborHexKeys = (key: string): string[] => {
  const coord = parseHexKey(key);
  return HEX_DIRS.map((dir) => toHexKey({ q: coord.q + dir.q, r: coord.r + dir.r }));
};

const pickCapitalSlot = (block: Extract<BlockState, { type: "setup.capitalDraft" }>): string => {
  const taken = new Set(
    Object.values(block.payload.choices).filter((hexKey): hexKey is string => Boolean(hexKey))
  );
  const available = block.payload.availableSlots.find((hexKey) => !taken.has(hexKey));
  if (!available) {
    throw new Error("no available capital slots");
  }
  return available;
};

const getStartingBridgeOptions = (state: GameState, playerId: PlayerID): string[] => {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player?.capitalHex) {
    throw new Error("player has no capital for starting bridges");
  }
  const capitalCoord = parseHexKey(player.capitalHex);
  const candidates = new Set<string>();

  for (const hexKey of Object.keys(state.board.hexes)) {
    const coord = parseHexKey(hexKey);
    if (axialDistance(coord, capitalCoord) > 2) {
      continue;
    }
    for (const neighborKey of neighborHexKeys(hexKey)) {
      if (!state.board.hexes[neighborKey]) {
        continue;
      }
      candidates.add(getBridgeKey(hexKey, neighborKey));
    }
  }

  return Array.from(candidates).sort();
};

const pickStartingBridge = (
  state: GameState,
  block: Extract<BlockState, { type: "setup.startingBridges" }>,
  playerId: PlayerID
): string => {
  const placed = new Set(block.payload.selectedEdges[playerId] ?? []);
  const options = getStartingBridgeOptions(state, playerId);
  const edgeKey = options.find((candidate) => !placed.has(candidate));
  if (!edgeKey) {
    throw new Error("no available starting bridge edges");
  }
  return edgeKey;
};

const pickFreeStartingCard = (
  block: Extract<BlockState, { type: "setup.freeStartingCardPick" }>,
  playerId: PlayerID
): string => {
  const offers = block.payload.offers[playerId];
  if (!offers || offers.length === 0) {
    throw new Error("no free starting card offer available");
  }
  return offers[0];
};

const buildAutoSetupChoice = (
  state: GameState
): { playerId: PlayerID; choice: SetupChoice } => {
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

const runAutoSetup = (state: GameState): GameState => {
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

const buildDebugCollectionChoices = (
  state: GameState,
  playerId: PlayerID,
  prompts: CollectionPrompt[]
): CollectionChoice[] | null => {
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

  return choices as CollectionChoice[];
};

const resolveDebugBlock = (state: GameState): GameState => {
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

const advanceToNextPhaseDebug = (state: GameState): GameState => {
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

type PatchPathToken = string | number;

const parsePatchPath = (path: string): PatchPathToken[] | null => {
  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "");
  const parts = normalized.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  return parts.map((part) => (/^\d+$/.test(part) ? Number(part) : part));
};

const setValueAtPath = (
  current: unknown,
  tokens: PatchPathToken[],
  value: unknown
): unknown => {
  if (tokens.length === 0) {
    return value;
  }
  const [head, ...rest] = tokens;
  const key = String(head);
  const nextCurrent =
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
  const nextValue = setValueAtPath(nextCurrent, rest, value);
  const shouldUseArray = Array.isArray(current) || (!current && typeof head === "number");

  if (shouldUseArray) {
    const copy = Array.isArray(current) ? [...current] : [];
    if (typeof head === "number") {
      copy[head] = nextValue;
      return copy;
    }
    (copy as unknown as Record<string, unknown>)[key] = nextValue;
    return copy;
  }

  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return {
    ...base,
    [key]: nextValue
  };
};

const applyStatePatch = (
  state: GameState,
  path: string,
  value: unknown
): GameState | null => {
  const tokens = parsePatchPath(path);
  if (!tokens) {
    return null;
  }
  const nextState = setValueAtPath(state, tokens, value);
  if (!nextState || typeof nextState !== "object") {
    return null;
  }
  return nextState as GameState;
};

const readRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

const buildCombatSequenceId = (hexKey: string, startIndex: number) =>
  `${hexKey}-${startIndex}`;

const safeParseMessage = (message: string): ClientMessage | null => {
  try {
    const parsed = JSON.parse(message);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (
      parsed.type === "join" ||
      parsed.type === "command" ||
      parsed.type === "lobbyCommand" ||
      parsed.type === "debugCommand" ||
      parsed.type === "combatCommand"
    ) {
      return parsed as ClientMessage;
    }
  } catch {
    return null;
  }
  return null;
};

const createRejoinToken = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export default class Server implements Party.Server {
  private lobbyPlayers: LobbyPlayer[] = [];
  private state: GameState | null = null;
  private lastLogCount = 0;
  private rejoinTokens = new Map<string, PlayerID>();
  private playerConnections = new Map<PlayerID, number>();
  private combatSyncById = new Map<string, CombatSyncState>();
  private combatSyncOrder: string[] = [];

  constructor(readonly room: Party.Room) {}

  private send(connection: Party.Connection, payload: Record<string, unknown>) {
    connection.send(JSON.stringify(payload));
  }

  private sendError(connection: Party.Connection, message: string) {
    this.send(connection, { type: "error", message });
  }

  private resetCombatSync(): void {
    this.combatSyncById.clear();
    this.combatSyncOrder = [];
  }

  private getCombatSyncSnapshot(): Record<string, CombatSyncState> {
    return Object.fromEntries(this.combatSyncById.entries());
  }

  private trackCombatEvents(events: GameEvent[], startIndex: number): void {
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
      const sync: CombatSyncState = {
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

  private getConnectionState(connection: Party.Connection): ConnectionState | null {
    const state = connection.state as ConnectionState | undefined;
    if (!state || !state.playerId) {
      return null;
    }
    return state;
  }

  private setConnectionState(connection: Party.Connection, state: ConnectionState) {
    connection.setState(state);
  }

  private markPlayerConnected(playerId: PlayerID, connected: boolean): void {
    if (!this.state) {
      return;
    }
    const player = this.state.players.find((entry) => entry.id === playerId);
    if (!player || player.visibility.connected === connected) {
      return;
    }
    this.state = {
      ...this.state,
      players: this.state.players.map((entry) =>
        entry.id === playerId
          ? { ...entry, visibility: { ...entry.visibility, connected } }
          : entry
      )
    };
    this.bumpRevision();
  }

  private bumpRevision(): void {
    if (!this.state) {
      return;
    }
    this.state = {
      ...this.state,
      revision: this.state.revision + 1
    };
  }

  private createMapSeed(): number {
    return Math.floor(Math.random() * 0xffffffff);
  }

  private isDebugAllowed(): boolean {
    const env = this.room.env as Record<string, string> | undefined;
    const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV;
    return nodeEnv !== "production";
  }

  private getHostPlayerId(): PlayerID | null {
    if (this.state) {
      return this.state.players.find((player) => player.seatIndex === 0)?.id ?? null;
    }
    return this.lobbyPlayers[0]?.id ?? null;
  }

  private collectEvents(): GameEvent[] {
    if (!this.state) {
      return [];
    }
    const logs = this.state.logs;
    const logsShrunk = logs.length < this.lastLogCount;
    const startIndex = logsShrunk ? 0 : this.lastLogCount;
    let events: GameEvent[] = [];
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

  private broadcastUpdate(events: GameEvent[] = []): void {
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

  private getLobbySnapshot(): LobbySnapshot {
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

  private broadcastLobby(): void {
    if (this.state) {
      return;
    }
    const lobby = this.getLobbySnapshot();
    for (const connection of this.room.getConnections()) {
      this.send(connection, { type: "lobby", lobby });
    }
  }

  private syncLobbySeatIndices(): void {
    const seatIndexById = new Map(
      this.lobbyPlayers.map((player, index) => [player.id, index])
    );
    for (const connection of this.room.getConnections()) {
      const meta = this.getConnectionState(connection);
      if (!meta || meta.spectator) {
        continue;
      }
      const seatIndex = seatIndexById.get(meta.playerId);
      if (seatIndex === undefined || meta.seatIndex === seatIndex) {
        continue;
      }
      this.setConnectionState(connection, { ...meta, seatIndex });
    }
  }

  private pruneDisconnectedLobbyPlayers(): void {
    if (this.state) {
      return;
    }
    const activeIds = new Set(
      this.lobbyPlayers
        .filter((player) => (this.playerConnections.get(player.id) ?? 0) > 0)
        .map((player) => player.id)
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

  private removeLobbyPlayer(playerId: PlayerID): void {
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

  private nextPlayerId(): PlayerID {
    const used = new Set(this.lobbyPlayers.map((player) => player.id));
    let index = 1;
    while (used.has(`p${index}`)) {
      index += 1;
    }
    return `p${index}`;
  }

  private startGameFromLobby(): void {
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

  private registerPlayerConnection(playerId: PlayerID): void {
    const count = (this.playerConnections.get(playerId) ?? 0) + 1;
    this.playerConnections.set(playerId, count);
    if (count === 1) {
      this.markPlayerConnected(playerId, true);
      if (!this.state) {
        this.broadcastLobby();
      }
    }
  }

  private unregisterPlayerConnection(playerId: PlayerID): void {
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

  private handleJoin(message: JoinMessage, connection: Party.Connection): void {
    if (this.getConnectionState(connection)) {
      this.sendError(connection, "connection already joined");
      return;
    }

    const requestedToken = message.rejoinToken;
    const allowSpectator = Boolean(message.asSpectator);

    if (requestedToken && this.rejoinTokens.has(requestedToken)) {
      const playerId = this.rejoinTokens.get(requestedToken) as PlayerID;
      const seatIndex = this.state
        ? this.state.players.findIndex((player) => player.id === playerId)
        : this.lobbyPlayers.findIndex((player) => player.id === playerId);
      if (seatIndex === -1) {
        this.sendError(connection, "rejoin token is no longer valid");
        return;
      }
      this.setConnectionState(connection, {
        playerId,
        seatIndex,
        spectator: false,
        rejoinToken: requestedToken
      });
      this.registerPlayerConnection(playerId);
      const view = this.state ? buildView(this.state, playerId) : null;
      this.send(connection, {
        type: "welcome",
        playerId,
        seatIndex,
        rejoinToken: requestedToken,
        view
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
        const view = buildView(this.state, null);
        this.send(connection, {
          type: "welcome",
          playerId: `spectator:${connection.id}`,
          seatIndex: null,
          rejoinToken: null,
          view
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
    const name =
      typeof message.name === "string" && message.name.trim().length > 0
        ? message.name.trim()
        : `Player ${seatIndex + 1}`;
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

  private handleCommand(message: CommandMessage, connection: Party.Connection): void {
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

  private handleCombatCommand(
    message: CombatCommandMessage,
    connection: Party.Connection
  ): void {
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

    const sequenceId =
      typeof message.sequenceId === "string" ? message.sequenceId.trim() : "";
    const roundIndex =
      typeof message.roundIndex === "number" && Number.isFinite(message.roundIndex)
        ? message.roundIndex
        : -1;
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

    const rollElapsed =
      stage === "rolling" && sync.phaseStartAt ? now - sync.phaseStartAt : null;
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

  private handleLobbyCommand(
    message: LobbyCommandMessage,
    connection: Party.Connection
  ): void {
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

  private handleDebugCommand(
    message: DebugCommandMessage,
    connection: Party.Connection
  ): void {
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
      const lobbyPlayers = this.state
        ? [...this.state.players]
            .sort((a, b) => a.seatIndex - b.seatIndex)
            .map((player) => ({ id: player.id, name: player.name, factionId: player.factionId }))
        : [...this.lobbyPlayers];
      if (lobbyPlayers.length < MIN_PLAYERS) {
        this.sendError(connection, `need at least ${MIN_PLAYERS} players to reset`);
        return;
      }
      const seed =
        typeof message.seed === "number" && Number.isFinite(message.seed)
          ? message.seed
          : this.createMapSeed();
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

  private handleStartGame(
    message: LobbyCommandMessage,
    connection: Party.Connection
  ): void {
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
    const uniqueFactions = new Set<string>();
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

  private handlePickFaction(
    message: LobbyCommandMessage,
    connection: Party.Connection
  ): void {
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
    const rawFactionId =
      typeof message.factionId === "string" ? message.factionId.trim() : "";
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

  private handleAutoSetup(
    message: LobbyCommandMessage,
    connection: Party.Connection
  ): void {
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

  private handleRollDice(
    message: LobbyCommandMessage,
    connection: Party.Connection
  ): void {
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

  private handleRerollMap(
    message: LobbyCommandMessage,
    connection: Party.Connection
  ): void {
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
    if (
      this.state.players.some((player) => player.capitalHex) ||
      Object.values(block.payload.choices).some(Boolean)
    ) {
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

    const lobbyPlayers = [...this.state.players]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((player) => ({ id: player.id, name: player.name, factionId: player.factionId }));
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

  onConnect(connection: Party.Connection) {
    this.send(connection, {
      type: "connected",
      roomId: this.room.id
    });
  }

  onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
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

  onClose(connection: Party.Connection) {
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
}

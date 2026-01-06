import type * as Party from "partykit/server";
import {
  applyCommand,
  buildView,
  createNewGame,
  DEFAULT_CONFIG,
  runUntilBlocked
} from "@bridgefront/engine";
import type {
  Command,
  GameEvent,
  GameState,
  LobbyPlayer,
  PlayerID
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

type ClientMessage = JoinMessage | CommandMessage;

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const safeParseMessage = (message: string): ClientMessage | null => {
  try {
    const parsed = JSON.parse(message);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.type === "join" || parsed.type === "command") {
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

  constructor(readonly room: Party.Room) {}

  private send(connection: Party.Connection, payload: Record<string, unknown>) {
    connection.send(JSON.stringify(payload));
  }

  private sendError(connection: Party.Connection, message: string) {
    this.send(connection, { type: "error", message });
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

  private collectEvents(): GameEvent[] {
    if (!this.state) {
      return [];
    }
    const logs = this.state.logs;
    if (this.lastLogCount === 0) {
      this.lastLogCount = logs.length;
      return logs;
    }
    if (logs.length < this.lastLogCount) {
      this.lastLogCount = logs.length;
      return logs;
    }
    const events = logs.slice(this.lastLogCount);
    this.lastLogCount = logs.length;
    return events;
  }

  private broadcastUpdate(events: GameEvent[] = []): void {
    if (!this.state) {
      return;
    }
    for (const connection of this.room.getConnections()) {
      const meta = this.getConnectionState(connection);
      const viewerId = meta && !meta.spectator ? meta.playerId : null;
      const view = buildView(this.state, viewerId);
      this.send(connection, {
        type: "update",
        revision: this.state.revision,
        events,
        view
      });
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

  private maybeStartGame(): void {
    if (this.state) {
      return;
    }
    const activePlayers = this.lobbyPlayers.filter(
      (player) => (this.playerConnections.get(player.id) ?? 0) > 0
    );
    if (activePlayers.length < MIN_PLAYERS) {
      return;
    }
    if (activePlayers.length !== this.lobbyPlayers.length) {
      const activeIds = new Set(activePlayers.map((player) => player.id));
      for (const [token, playerId] of this.rejoinTokens.entries()) {
        if (!activeIds.has(playerId)) {
          this.rejoinTokens.delete(token);
        }
      }
      this.lobbyPlayers = activePlayers;
      this.syncLobbySeatIndices();
    }
    const seed = this.room.id;
    const created = createNewGame(DEFAULT_CONFIG, seed, this.lobbyPlayers);
    this.state = runUntilBlocked(created);
    this.bumpRevision();
    this.lastLogCount = this.state.logs.length;
  }

  private registerPlayerConnection(playerId: PlayerID): void {
    const count = (this.playerConnections.get(playerId) ?? 0) + 1;
    this.playerConnections.set(playerId, count);
    if (count === 1) {
      this.markPlayerConnected(playerId, true);
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

    if (this.lobbyPlayers.length >= MAX_PLAYERS) {
      this.sendError(connection, "lobby is full");
      return;
    }

    const seatIndex = this.lobbyPlayers.length;
    const playerId = `p${seatIndex + 1}`;
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
    this.maybeStartGame();
    const view = this.state ? buildView(this.state, playerId) : null;
    this.send(connection, {
      type: "welcome",
      playerId,
      seatIndex,
      rejoinToken: token,
      view
    });
    if (this.state) {
      this.broadcastUpdate();
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
    }
  }

  onClose(connection: Party.Connection) {
    const meta = this.getConnectionState(connection);
    if (meta && !meta.spectator) {
      this.unregisterPlayerConnection(meta.playerId);
      if (this.state) {
        this.broadcastUpdate();
      }
    }
  }
}

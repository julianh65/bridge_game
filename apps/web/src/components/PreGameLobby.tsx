import type { PlayerID } from "@bridgefront/engine";

import { RoomCodeCopy } from "./RoomCodeCopy";
import type { LobbyView, RoomConnectionStatus } from "../lib/room-client";

type PreGameLobbyProps = {
  lobby: LobbyView;
  playerId: PlayerID | null;
  roomId: string;
  status: RoomConnectionStatus;
  onStartGame: () => void;
  onLeave: () => void;
};

export const PreGameLobby = ({
  lobby,
  playerId,
  roomId,
  status,
  onStartGame,
  onLeave
}: PreGameLobbyProps) => {
  const connectedCount = lobby.players.filter((player) => player.connected).length;
  const hostId = lobby.players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(playerId && hostId === playerId);
  const canStart =
    isHost && status === "connected" && connectedCount >= lobby.minPlayers;
  const statusLabel = status === "connected" ? "Live" : status === "error" ? "Error" : "Waiting";
  const statusClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";

  return (
    <section className="lobby">
      <header className="lobby__header">
        <div>
          <p className="eyebrow">Room Lobby</p>
          <h1>Room {roomId}</h1>
          <p className="subhead">Host starts the game once everyone has joined.</p>
        </div>
        <div className="lobby__status">
          <div className="lobby__status-pills">
            <span className="status-pill">
              {connectedCount}/{lobby.maxPlayers} connected
            </span>
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          </div>
          <RoomCodeCopy roomId={roomId} />
        </div>
      </header>

      <div className="lobby__grid">
        <section className="panel">
          <h2>Seats</h2>
          <ul className="seat-list">
            {lobby.players.map((player) => (
              <li key={player.id} className={`seat ${player.connected ? "is-ready" : ""}`}>
                <div className="seat__info">
                  <span className="seat__name">
                    {player.name}
                    {player.seatIndex === 0 ? (
                      <span className="chip chip--host">Host</span>
                    ) : null}
                    {player.id === playerId ? <span className="chip chip--local">You</span> : null}
                  </span>
                  <span className="seat__meta">Seat {player.seatIndex}</span>
                </div>
                <div className="seat__status">
                  <span
                    className={`status-pill ${
                      player.connected ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.connected ? "Connected" : "Offline"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Host Controls</h2>
          <p className="muted">Start the game when at least {lobby.minPlayers} players are ready.</p>
          <div className="lobby__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onStartGame}
              disabled={!canStart}
            >
              Start Game
            </button>
          </div>
          {!isHost ? (
            <p className="muted">Waiting for the host to start.</p>
          ) : connectedCount < lobby.minPlayers ? (
            <p className="muted">Need {lobby.minPlayers} connected players to start.</p>
          ) : null}
        </section>
      </div>

      <div className="lobby__actions">
        <button type="button" className="btn btn-secondary" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </section>
  );
};

import { useMemo, useState } from "react";

type LobbyPlayer = {
  id: string;
  name: string;
  seatIndex: number;
  ready: boolean;
  isHost?: boolean;
};

const LOCAL_PLAYER_ID = "p1";

const initialPlayers: LobbyPlayer[] = [
  { id: "p1", name: "Player 1", seatIndex: 1, ready: false, isHost: true },
  { id: "p2", name: "Player 2", seatIndex: 2, ready: false },
  { id: "p3", name: "Player 3", seatIndex: 3, ready: false }
];

const placeholderFactions = [
  "Bastion",
  "Veil",
  "Aerial",
  "Prospect",
  "Cipher",
  "Gatewright"
];

type LobbyProps = {
  onStart: () => void;
};

export const Lobby = ({ onStart }: LobbyProps) => {
  const [players, setPlayers] = useState(initialPlayers);

  const readyCount = useMemo(() => players.filter((player) => player.ready).length, [players]);
  const allReady = readyCount === players.length;
  const localReady = players.find((player) => player.id === LOCAL_PLAYER_ID)?.ready ?? false;

  const toggleReady = (playerId: string) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, ready: !player.ready } : player
      )
    );
  };

  return (
    <section className="lobby">
      <header className="lobby__header">
        <div>
          <p className="eyebrow">Bridgefront Lobby</p>
          <h1>Pre-game Check-In</h1>
          <p className="subhead">
            Factions and settings are placeholders for now. Ready up to unlock the start button.
          </p>
        </div>
        <div className="lobby__status">
          <span className="status-pill">
            {readyCount}/{players.length} ready
          </span>
        </div>
      </header>

      <div className="lobby__grid">
        <section className="panel">
          <h2>Seats</h2>
          <ul className="seat-list">
            {players.map((player) => (
              <li key={player.id} className={`seat ${player.ready ? "is-ready" : ""}`}>
                <div className="seat__info">
                  <span className="seat__name">{player.name}</span>
                  <span className="seat__meta">Seat {player.seatIndex}</span>
                </div>
                <div className="seat__status">
                  {player.isHost ? <span className="chip chip--host">Host</span> : null}
                  {player.id === LOCAL_PLAYER_ID ? (
                    <span className="chip chip--local">You</span>
                  ) : null}
                  <span
                    className={`status-pill ${
                      player.ready ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.ready ? "Ready" : "Waiting"}
                  </span>
                  <button
                    type="button"
                    className="seat__toggle"
                    onClick={() => toggleReady(player.id)}
                  >
                    Toggle
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Factions (placeholder)</h2>
          <p className="muted">
            Faction picks will live here once the deck/champion data is wired in.
          </p>
          <div className="faction-grid">
            {placeholderFactions.map((name) => (
              <div key={name} className="faction-card">
                <span>{name}</span>
                <span className="faction-card__tag">Locked</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Settings (placeholder)</h2>
          <p className="muted">Room rules, map seed, and draft settings will be configured here.</p>
          <div className="settings-grid">
            <div className="settings-row">
              <span className="settings-label">Map seed</span>
              <span className="settings-value">Auto</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Draft type</span>
              <span className="settings-value">Standard</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Age preview</span>
              <span className="settings-value">Default</span>
            </div>
          </div>
        </section>
      </div>

      <div className="lobby__actions">
        <button type="button" className="btn btn-secondary" onClick={() => toggleReady(LOCAL_PLAYER_ID)}>
          {localReady ? "Unready" : "Ready Up"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!allReady}
          onClick={onStart}
        >
          Start Game
        </button>
      </div>
    </section>
  );
};

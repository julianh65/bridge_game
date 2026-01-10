import { useMemo, useState } from "react";

import { getDefaultPartyHost, getRejoinToken } from "../lib/room-client";

export type RoomJoinParams = {
  roomId: string;
  name: string;
  host?: string;
  party?: string;
};

type HomeProps = {
  onJoin: (params: RoomJoinParams) => void;
};

const nameStorageKey = "bridgefront:playerName";
const lastRoomStorageKey = "bridgefront:lastRoomId";

const loadStoredName = () => {
  try {
    return window.localStorage.getItem(nameStorageKey) ?? "";
  } catch {
    return "";
  }
};

const storeName = (name: string) => {
  try {
    window.localStorage.setItem(nameStorageKey, name);
  } catch {
    // Ignore storage failures.
  }
};

const loadLastRoomId = () => {
  try {
    return window.localStorage.getItem(lastRoomStorageKey) ?? "";
  } catch {
    return "";
  }
};

const storeLastRoomId = (roomId: string) => {
  try {
    window.localStorage.setItem(lastRoomStorageKey, roomId);
  } catch {
    // Ignore storage failures.
  }
};

const generateRoomCode = () => {
  const seed = Math.random().toString(36).slice(2, 8);
  return `room-${seed}`;
};

export const Home = ({ onJoin }: HomeProps) => {
  const defaultHost = useMemo(() => getDefaultPartyHost(), []);
  const [name, setName] = useState(loadStoredName);
  const [roomId, setRoomId] = useState("");
  const [host, setHost] = useState(defaultHost);
  const [error, setError] = useState<string | null>(null);
  const [lastRoomId, setLastRoomId] = useState(loadLastRoomId);

  const submit = (nextRoomId?: string) => {
    const trimmedName = name.trim();
    const trimmedRoom = (nextRoomId ?? roomId).trim();
    const trimmedHost = host.trim();

    if (!trimmedName) {
      setError("Enter a player name to continue.");
      return;
    }
    if (!trimmedRoom) {
      setError("Enter a room code to continue.");
      return;
    }

    setError(null);
    storeName(trimmedName);
    storeLastRoomId(trimmedRoom);
    setLastRoomId(trimmedRoom);
    onJoin({
      roomId: trimmedRoom,
      name: trimmedName,
      host: trimmedHost || undefined
    });
  };

  const handleCreate = () => {
    const newRoom = generateRoomCode();
    setRoomId(newRoom);
    submit(newRoom);
  };

  const rejoinToken = lastRoomId ? getRejoinToken(lastRoomId) : null;
  const canRejoin = Boolean(lastRoomId && rejoinToken);
  const handleRejoin = () => {
    if (!lastRoomId) {
      return;
    }
    setRoomId(lastRoomId);
    submit(lastRoomId);
  };

  return (
    <section className="home">
      <header className="home__hero">
        <div className="home__hero-copy">
          <p className="eyebrow">Bridgefront Alpha (1.0.2)</p>
          <h1>Enter the War Table</h1>
          <p className="subhead">
            Create a room for friends or join an existing command to sync the battlefield.
          </p>
          <div className="home__hero-meta">
            <div className="home__hero-meta-item">
              <span className="home__hero-meta-label">Players</span>
              <span className="home__hero-meta-value">2-6 commanders</span>
            </div>
            <div className="home__hero-meta-item">
              <span className="home__hero-meta-label">Session</span>
              <span className="home__hero-meta-value">45-90 minutes</span>
            </div>
          </div>
        </div>

        <section className="panel home__hero-card">
          <h2>Room Details</h2>
          <div className="home__form">
            <label className="field">
              <span>Player name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Commander"
              />
            </label>
            <label className="field">
              <span>Room code</span>
              <input
                type="text"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="room-xxxxxx"
              />
            </label>
            <label className="field">
              <span>Server host</span>
              <input
                type="text"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="localhost:1999"
              />
            </label>
          </div>

          <div className="home__actions">
            <button
              type="button"
              className="btn btn-secondary"
              data-sfx="soft"
              onClick={handleCreate}
            >
              Create Room
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-sfx="click"
              onClick={() => submit()}
            >
              Join Room
            </button>
          </div>
          {canRejoin ? (
            <div className="home__actions">
              <button
                type="button"
                className="btn btn-secondary"
                data-sfx="soft"
                onClick={handleRejoin}
              >
                Rejoin {lastRoomId}
              </button>
            </div>
          ) : null}
        </section>
      </header>

      {error ? (
        <section className="panel error">
          <h2>Check your info</h2>
          <p>{error}</p>
        </section>
      ) : null}

      <div className="home__grid">
        <section className="panel home__panel home__panel--signal">
          <h2>Rules & Tutorial</h2>
          <p className="muted">
            A quickstart guide and full rules walkthrough will live here soon.
          </p>
          <div className="home__tips">
            <div>
              <span className="label">Quickstart</span>
              <span className="value">Coming soon</span>
            </div>
            <div>
              <span className="label">Full rules</span>
              <span className="value">PDF + in-app</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

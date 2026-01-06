import { useMemo, useState } from "react";

import { DebugBoard } from "./components/DebugBoard";
import { GameScreen } from "./components/GameScreen";
import { Home, type RoomJoinParams } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { useRoom } from "./lib/room-client";

type AppView = "play" | "debug";

const statusLabels: Record<string, string> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Connected",
  closed: "Disconnected",
  error: "Error"
};

export default function App() {
  const [view, setView] = useState<AppView>("play");
  const [roomConfig, setRoomConfig] = useState<RoomJoinParams | null>(null);
  const room = useRoom(roomConfig);

  const statusLabel = statusLabels[room.status] ?? "Unknown";
  const statusClass = useMemo(() => {
    if (room.status === "connected") {
      return "status-pill--ready";
    }
    if (room.status === "error") {
      return "status-pill--error";
    }
    return "status-pill--waiting";
  }, [room.status]);

  const handleLeave = () => {
    room.disconnect();
    setRoomConfig(null);
  };

  const showLobby = room.view?.public.phase === "setup";
  const showGame = Boolean(room.view && room.view.public.phase !== "setup");

  return (
    <main className="app">
      <nav className="app__nav">
        <div className="app__nav-left">
          <span className="app__nav-label">Bridgefront</span>
          {view === "play" && roomConfig ? (
            <>
              <span className="status-pill">Room {roomConfig.roomId}</span>
              <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
            </>
          ) : null}
        </div>
        <div className="view-toggle">
          <button
            type="button"
            className={view === "play" ? "is-active" : ""}
            onClick={() => setView("play")}
          >
            Play
          </button>
          <button
            type="button"
            className={view === "debug" ? "is-active" : ""}
            onClick={() => setView("debug")}
          >
            Board Debug
          </button>
        </div>
      </nav>

      {view === "debug" ? <DebugBoard /> : null}

      {view === "play" && !roomConfig ? <Home onJoin={setRoomConfig} /> : null}

      {view === "play" && roomConfig && room.status === "error" ? (
        <section className="panel error">
          <h2>Connection failed</h2>
          <p>{room.error ?? "Unable to connect to the PartyKit server."}</p>
          <button type="button" className="btn btn-secondary" onClick={handleLeave}>
            Back to Home
          </button>
        </section>
      ) : null}

      {view === "play" && roomConfig && !room.view && room.status === "connecting" ? (
        <section className="panel">
          <h2>Connecting to room</h2>
          <p className="muted">Waiting for the server to accept the connection.</p>
        </section>
      ) : null}

      {view === "play" && roomConfig && !room.view && room.status === "connected" ? (
        <section className="panel">
          <h2>Waiting for players</h2>
          <p className="muted">The game will start once at least 2 players have joined.</p>
        </section>
      ) : null}

      {view === "play" && roomConfig && !room.view && room.status === "closed" ? (
        <section className="panel">
          <h2>Disconnected</h2>
          <p className="muted">The connection closed. You can rejoin the room.</p>
          <button type="button" className="btn btn-secondary" onClick={handleLeave}>
            Back to Home
          </button>
        </section>
      ) : null}

      {view === "play" && room.view && showLobby ? (
        <Lobby
          view={room.view}
          playerId={room.playerId}
          roomId={roomConfig.roomId}
          status={room.status}
          onLeave={handleLeave}
        />
      ) : null}

      {view === "play" && room.view && showGame ? (
        <GameScreen
          view={room.view}
          playerId={room.playerId}
          roomId={roomConfig.roomId}
          status={room.status}
          onLeave={handleLeave}
        />
      ) : null}
    </main>
  );
}

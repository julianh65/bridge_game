import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { CardsBrowser } from "./components/CardsBrowser";
import { DeckViewer } from "./components/DeckViewer";
import { DebugBoard } from "./components/DebugBoard";
import { GameScreen } from "./components/GameScreen";
import { Home, type RoomJoinParams } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { LobbyDice } from "./components/LobbyDice";
import { PreGameLobby } from "./components/PreGameLobby";
import { RoomDebugPanel } from "./components/RoomDebugPanel";
import { RoomCodeCopy } from "./components/RoomCodeCopy";
import { useRoom } from "./lib/room-client";
import { armSfx, getSfxForTarget, playSfx } from "./lib/sfx";

type AppView = "play" | "debug" | "cards" | "deck";

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
  const lastStatusRef = useRef(room.status);

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

  useEffect(() => {
    if (room.status === "error" && lastStatusRef.current !== "error") {
      playSfx("error");
    }
    lastStatusRef.current = room.status;
  }, [room.status]);

  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    armSfx();
    const sfx = getSfxForTarget(event.target);
    if (sfx) {
      playSfx(sfx);
    }
  };

  const showLobby = room.view?.public.phase === "setup";
  const showGame = Boolean(room.view && room.view.public.phase !== "setup");
  const isGameLayout = view === "play" && showGame;
  const showPreGameLobby = Boolean(room.lobby && !room.view);

  return (
    <main
      className={`app ${isGameLayout ? "app--game" : ""}`}
      onPointerDownCapture={handlePointerDownCapture}
    >
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
          <button
            type="button"
            className={view === "cards" ? "is-active" : ""}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
          <button
            type="button"
            className={view === "deck" ? "is-active" : ""}
            onClick={() => setView("deck")}
          >
            Deck
          </button>
        </div>
      </nav>

      {view === "debug" ? (
        <>
          <DebugBoard />
          <RoomDebugPanel room={room} />
        </>
      ) : null}
      {view === "cards" ? <CardsBrowser /> : null}
      {view === "deck" ? (
        <DeckViewer
          view={room.view}
          playerId={room.playerId}
          roomId={roomConfig?.roomId ?? null}
          status={room.status}
        />
      ) : null}

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
          <RoomCodeCopy roomId={roomConfig.roomId} label="Share room code" />
        </section>
      ) : null}

      {view === "play" &&
      roomConfig &&
      !room.view &&
      room.status === "connected" &&
      !showPreGameLobby ? (
        <section className="panel">
          <h2>Waiting for players</h2>
          <p className="muted">Waiting for the lobby to initialize.</p>
          <RoomCodeCopy roomId={roomConfig.roomId} label="Share room code" />
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

      {view === "play" && roomConfig && showPreGameLobby ? (
        <PreGameLobby
          lobby={room.lobby!}
          playerId={room.playerId}
          roomId={roomConfig.roomId}
          status={room.status}
          onStartGame={() => room.sendLobbyCommand("startGame")}
          onPickFaction={(factionId) =>
            room.sendLobbyCommand({ command: "pickFaction", factionId })
          }
          onLeave={handleLeave}
        />
      ) : null}

      {view === "play" && room.view && showLobby ? (
        <>
          <LobbyDice
            view={room.view}
            playerId={room.playerId}
            status={room.status}
            onRoll={() => room.sendLobbyCommand("rollDice")}
          />
          <Lobby
            view={room.view}
            playerId={room.playerId}
            roomId={roomConfig.roomId}
            status={room.status}
            onRerollMap={() => room.sendLobbyCommand("rerollMap")}
            onSubmitSetupChoice={(choice) =>
              room.sendCommand({ type: "SubmitSetupChoice", payload: choice })
            }
            onAutoSetup={() => room.sendLobbyCommand("autoSetup")}
            onLeave={handleLeave}
          />
        </>
      ) : null}

      {view === "play" && room.view && showGame ? (
        <GameScreen
          view={room.view}
          playerId={room.playerId}
          roomId={roomConfig.roomId}
          status={room.status}
          onSubmitAction={(declaration) =>
            room.sendCommand({ type: "SubmitAction", payload: declaration })
          }
          onSubmitMarketBid={(bid) =>
            room.sendCommand({ type: "SubmitMarketBid", payload: bid })
          }
          onSubmitCollectionChoices={(choices) =>
            room.sendCommand({ type: "SubmitCollectionChoices", payload: choices })
          }
          onSubmitQuietStudy={(cardInstanceIds) =>
            room.sendCommand({ type: "SubmitQuietStudy", payload: { cardInstanceIds } })
          }
          onResetGame={() => room.sendDebugCommand({ command: "resetGame" })}
          onLeave={handleLeave}
        />
      ) : null}
    </main>
  );
}

import { useMemo, useRef, useState } from "react";

import type { GameView } from "@bridgefront/engine";

import { BoardView } from "./BoardView";
import { buildBoardPreview } from "../lib/board-preview";
import type { RoomConnectionStatus } from "../lib/room-client";

const placeholderFactions = [
  "Bastion",
  "Veil",
  "Aerial",
  "Prospect",
  "Cipher",
  "Gatewright"
];

type LobbyProps = {
  view: GameView;
  playerId: string | null;
  roomId: string;
  status: RoomConnectionStatus;
  onRerollMap: () => void;
  onLeave: () => void;
};

export const Lobby = ({
  view,
  playerId,
  roomId,
  status,
  onRerollMap,
  onLeave
}: LobbyProps) => {
  const players = view.public.players;
  const connectedCount = players.filter((player) => player.connected).length;
  const statusLabel = status === "connected" ? "Live" : status === "error" ? "Error" : "Waiting";
  const statusClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimeoutRef = useRef<number | null>(null);
  const roomInputRef = useRef<HTMLInputElement | null>(null);
  const hostId = players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(playerId && hostId === playerId);
  const canReroll = isHost && status === "connected";
  const mapPreview = useMemo(() => {
    return buildBoardPreview(players.length, String(view.public.seed ?? 0));
  }, [players.length, view.public.seed]);

  const scheduleCopyReset = () => {
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
    }, 2000);
  };

  const fallbackCopyRoom = () => {
    const input = roomInputRef.current;
    if (!input) {
      return false;
    }
    input.focus();
    input.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  };

  const handleCopyRoom = async () => {
    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(roomId);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      success = fallbackCopyRoom();
    }
    setCopyStatus(success ? "copied" : "failed");
    scheduleCopyReset();
  };

  return (
    <section className="lobby">
      <header className="lobby__header">
        <div>
          <p className="eyebrow">Room Lobby</p>
          <h1>Room {roomId}</h1>
          <p className="subhead">
            Players will draft capitals and place starting bridges once the server begins setup.
          </p>
        </div>
        <div className="lobby__status">
          <div className="lobby__status-pills">
            <span className="status-pill">
              {connectedCount}/{players.length} connected
            </span>
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="lobby__room">
            <span className="lobby__room-label">Room code</span>
            <div className="room-copy">
              <input
                ref={roomInputRef}
                type="text"
                value={roomId}
                readOnly
                aria-label="Room code"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button type="button" className="btn btn-secondary" onClick={handleCopyRoom}>
                {copyStatus === "copied" ? "Copied" : "Copy"}
              </button>
            </div>
            {copyStatus === "copied" ? (
              <span className="room-copy__status room-copy__status--ok">
                Copied to clipboard
              </span>
            ) : copyStatus === "failed" ? (
              <span className="room-copy__status room-copy__status--error">
                Copy failed
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="lobby__grid">
        <section className="panel">
          <h2>Seats</h2>
          <ul className="seat-list">
            {players.map((player) => (
              <li key={player.id} className={`seat ${player.connected ? "is-ready" : ""}`}>
                <div className="seat__info">
                  <span className="seat__name">{player.name}</span>
                  <span className="seat__meta">Seat {player.seatIndex}</span>
                </div>
                <div className="seat__status">
                  {player.id === playerId ? <span className="chip chip--local">You</span> : null}
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

        <section className="panel">
          <h2>Map Preview</h2>
          <p className="muted">Current map layout for this room.</p>
          <BoardView
            hexes={mapPreview.hexRender}
            board={mapPreview.board}
            showCoords={false}
            showTags
            showMineValues={false}
            className="board-svg board-svg--game"
          />
          {isHost ? (
            <div className="lobby__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onRerollMap}
                disabled={!canReroll}
              >
                Reroll Map
              </button>
            </div>
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

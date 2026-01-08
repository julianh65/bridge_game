import { useMemo } from "react";

import type { GameView, SetupChoice } from "@bridgefront/engine";

import { BoardView } from "./BoardView";
import { RoomCodeCopy } from "./RoomCodeCopy";
import { SetupCapitalDraft } from "./SetupCapitalDraft";
import { SetupFreeStartingCardPick } from "./SetupFreeStartingCardPick";
import { SetupStartingBridges } from "./SetupStartingBridges";
import { buildBoardPreview } from "../lib/board-preview";
import { getFactionName } from "../lib/factions";
import type { RoomConnectionStatus } from "../lib/room-client";

type LobbyProps = {
  view: GameView;
  playerId: string | null;
  roomId: string;
  status: RoomConnectionStatus;
  onRerollMap: () => void;
  onSubmitSetupChoice: (choice: SetupChoice) => void;
  onAutoSetup: () => void;
  onLeave: () => void;
};

export const Lobby = ({
  view,
  playerId,
  roomId,
  status,
  onRerollMap,
  onSubmitSetupChoice,
  onAutoSetup,
  onAdvanceSetup,
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
  const hostId = players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(playerId && hostId === playerId);
  const canReroll = isHost && status === "connected";
  const canAutoSetup = isHost && status === "connected";
  const setupStatus = view.public.setupStatus;
  const canAdvanceSetup = Boolean(setupStatus?.canAdvance) && isHost && status === "connected";
  const autoSetupHint = (() => {
    if (status !== "connected") {
      return "Connect to use auto-setup.";
    }
    if (!isHost) {
      return "Only the host can run auto-setup.";
    }
    return "Auto-setup is a dev shortcut for playtesting.";
  })();
  const mapPreview = useMemo(() => {
    return buildBoardPreview(players.length, String(view.public.seed ?? 0));
  }, [players.length, view.public.seed]);
  const capitalLabels = useMemo(() => {
    return Object.fromEntries(
      mapPreview.capitals.map((slot, index) => [slot, String(index + 1)])
    );
  }, [mapPreview.capitals]);

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
          <RoomCodeCopy roomId={roomId} />
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
          <h2>Factions</h2>
          <p className="muted">Chosen in the pre-game lobby.</p>
          <div className="settings-grid">
            {players.map((player) => {
              const factionSymbol = getFactionSymbol(player.factionId);
              return (
                <div key={player.id} className="settings-row">
                  <span className="settings-label">{player.name}</span>
                  <span className="settings-value">
                    <span className="faction-inline">
                      {factionSymbol ? (
                        <span className="faction-symbol faction-symbol--small" aria-hidden="true">
                          {factionSymbol}
                        </span>
                      ) : null}
                      {getFactionName(player.factionId)}
                    </span>
                  </span>
                </div>
              );
            })}
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
          <div className="lobby__map-preview">
            <BoardView
              hexes={mapPreview.hexRender}
              board={mapPreview.board}
              showCoords={false}
              showTags
              showMineValues={false}
              labelByHex={capitalLabels}
              className="board-svg"
            />
          </div>
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

        <section className="panel setup-tools">
          <h2>Setup Tools</h2>
          <p className="muted">Host-only shortcuts for testing setup.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAutoSetup}
            disabled={!canAutoSetup}
          >
            Auto-setup
          </button>
          <p className="muted">{autoSetupHint}</p>
        </section>

        {isHost && setupStatus ? (
          <section className="panel setup-advance">
            <h2>Advance Setup</h2>
            <p className="muted">
              Host advances to the next setup step once everyone locks their picks.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAdvanceSetup}
              disabled={!canAdvanceSetup}
            >
              Advance Setup
            </button>
            <p className="muted">
              {canAdvanceSetup ? "Ready to advance." : "Waiting for all players to lock in."}
            </p>
          </section>
        ) : null}

        <SetupCapitalDraft
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />

        <SetupStartingBridges
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />

        <SetupFreeStartingCardPick
          view={view}
          playerId={playerId}
          status={status}
          onSubmitChoice={onSubmitSetupChoice}
        />
      </div>

      <div className="lobby__actions">
        <button type="button" className="btn btn-secondary" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </section>
  );
};

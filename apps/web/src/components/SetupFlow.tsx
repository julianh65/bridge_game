import { useMemo } from "react";

import type { GameView, PlayerID, SetupChoice } from "@bridgefront/engine";

import { BoardView } from "./BoardView";
import { FactionSymbol } from "./FactionSymbol";
import { RoomCodeCopy } from "./RoomCodeCopy";
import { SetupCapitalDraft } from "./SetupCapitalDraft";
import { SetupFreeStartingCardPick } from "./SetupFreeStartingCardPick";
import { SetupStartingBridges } from "./SetupStartingBridges";
import { buildBoardPreview } from "../lib/board-preview";
import { getFactionName } from "../lib/factions";
import type { RoomConnectionStatus } from "../lib/room-client";

type SetupFlowProps = {
  view: GameView;
  playerId: PlayerID | null;
  roomId: string;
  status: RoomConnectionStatus;
  onRerollMap: () => void;
  onSubmitSetupChoice: (choice: SetupChoice) => void;
  onAutoSetup: () => void;
  onAdvanceSetup: () => void;
  onLeave: () => void;
};

export const SetupFlow = ({
  view,
  playerId,
  roomId,
  status,
  onRerollMap,
  onSubmitSetupChoice,
  onAutoSetup,
  onAdvanceSetup,
  onLeave
}: SetupFlowProps) => {
  const players = view.public.players;
  const setup = view.public.setup;
  const setupStatus = view.public.setupStatus;
  const connectedCount = players.filter((player) => player.connected).length;
  const statusLabel = status === "connected" ? "Live" : status === "error" ? "Error" : "Waiting";
  const statusClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";
  const hostId =
    setupStatus?.hostPlayerId ?? players.find((player) => player.seatIndex === 0)?.id ?? null;
  const isHost = Boolean(playerId && hostId === playerId);
  const canReroll = isHost && status === "connected";
  const canAutoSetup = isHost && status === "connected";
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
  const advanceHint = canAdvanceSetup
    ? "Advance to the next setup phase."
    : "Waiting for all players to lock in.";

  let phaseLabel = "Setup Lobby";
  let phaseSubtitle = "Waiting for the host to start setup.";
  if (setup?.type === "setup.capitalDraft") {
    phaseLabel = "Capital Draft";
    phaseSubtitle = "Select a capital slot and lock it in before moving on.";
  } else if (setup?.type === "setup.startingBridges") {
    phaseLabel = "Starting Bridges";
    phaseSubtitle = "Secretly select two bridges near your capital.";
  } else if (setup?.type === "setup.freeStartingCardPick") {
    phaseLabel = "Free Starting Card";
    phaseSubtitle = "Choose one bonus card to add to your starting deck.";
  }

  const mapPreview = useMemo(() => {
    return buildBoardPreview(players.length, String(view.public.seed ?? 0));
  }, [players.length, view.public.seed]);
  const capitalLabels = useMemo(() => {
    return Object.fromEntries(
      mapPreview.capitals.map((slot, index) => [slot, String(index + 1)])
    );
  }, [mapPreview.capitals]);
  const showMapPreview = setup?.type === "setup.capitalDraft";

  return (
    <section className="lobby setup-flow">
      <header className="lobby__header">
        <div>
          <p className="eyebrow">Setup Phase</p>
          <h1>{phaseLabel}</h1>
          <p className="subhead">{phaseSubtitle}</p>
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

      {isHost ? (
        <div className="setup-flow__host-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAdvanceSetup}
            disabled={!canAdvanceSetup}
            title={advanceHint}
          >
            Advance Setup
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAutoSetup}
            disabled={!canAutoSetup}
            title={autoSetupHint}
          >
            Auto-setup
          </button>
        </div>
      ) : null}

      <div className="lobby__grid">
        {showMapPreview ? (
          <section className="panel">
            <h2>Map Preview</h2>
            <p className="muted">Capital slots are labeled on the board.</p>
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

        <section className="panel setup-flow__players">
          <h2>Players</h2>
          <ul className="seat-list">
            {players.map((player) => (
              <li key={player.id} className={`seat ${player.connected ? "is-ready" : ""}`}>
                <div className="seat__info">
                  <span className="seat__name">
                    {player.name}
                    {player.seatIndex === 0 ? <span className="chip chip--host">Host</span> : null}
                    {player.id === playerId ? <span className="chip chip--local">You</span> : null}
                  </span>
                  <span className="seat__meta">Seat {player.seatIndex}</span>
                  <span className="seat__meta">
                    <span className="faction-inline">
                      <FactionSymbol
                        factionId={player.factionId}
                        className="faction-symbol--small"
                      />
                      {getFactionName(player.factionId)}
                    </span>
                  </span>
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
      </div>

      <div className="lobby__actions">
        <button type="button" className="btn btn-secondary" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </section>
  );
};

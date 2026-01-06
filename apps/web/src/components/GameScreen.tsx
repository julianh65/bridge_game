import { useMemo } from "react";

import type { ActionDeclaration, GameView } from "@bridgefront/engine";

import { ActionPanel } from "./ActionPanel";
import { BoardView } from "./BoardView";
import { MarketPanel } from "./MarketPanel";
import { buildHexRender } from "../lib/board-preview";
import type { RoomConnectionStatus } from "../lib/room-client";

type GameScreenProps = {
  view: GameView;
  playerId: string | null;
  roomId: string;
  status: RoomConnectionStatus;
  onSubmitAction: (declaration: ActionDeclaration) => void;
  onLeave: () => void;
};

export const GameScreen = ({
  view,
  playerId,
  roomId,
  status,
  onSubmitAction,
  onLeave
}: GameScreenProps) => {
  const hexRender = useMemo(() => buildHexRender(view.public.board), [view.public.board]);
  const localPlayer = view.public.players.find((player) => player.id === playerId);
  const handCount = view.private?.hand.length ?? 0;
  const deckCounts = view.private?.deckCounts ?? null;
  const phaseLabel = view.public.phase.replace("round.", "").replace(".", " ");
  const connectionLabel = status === "connected" ? "Live" : "Waiting";
  const connectionClass =
    status === "connected"
      ? "status-pill--ready"
      : status === "error"
        ? "status-pill--error"
        : "status-pill--waiting";

  return (
    <section className="game-screen">
      <header className="game-screen__header">
        <div>
          <p className="eyebrow">Bridgefront</p>
          <h1>
            Room {roomId} · Round {view.public.round} · {phaseLabel}
          </h1>
          <p className="subhead">Live room state from the PartyKit server.</p>
        </div>
        <div className="game-screen__meta">
          <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
          <span className="status-pill">Players: {view.public.players.length}</span>
          {view.public.winnerPlayerId ? (
            <span className="status-pill status-pill--winner">
              Winner: {view.public.winnerPlayerId}
            </span>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onLeave}>
            Leave Room
          </button>
        </div>
      </header>

      <div className="game-screen__layout">
        <section className="panel game-board">
          <div className="game-board__placeholder">
            <h2>Board</h2>
            <p className="muted">Shared board state.</p>
            <div className="legend legend--compact">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>
            <BoardView
              hexes={hexRender}
              board={view.public.board}
              showCoords={false}
              showTags
              showMineValues={false}
              className="board-svg board-svg--game"
            />
          </div>
        </section>

        <aside className="panel game-sidebar">
          <h2>Player Panel</h2>

          <div className="sidebar-section">
            <h3>Resources</h3>
            <div className="resource-row">
              <span>Gold</span>
              <strong>{localPlayer?.resources.gold ?? 0}</strong>
            </div>
            <div className="resource-row">
              <span>Mana</span>
              <strong>{localPlayer?.resources.mana ?? 0}</strong>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Hand</h3>
            {!view.private ? (
              <div className="hand-empty">Spectators do not have a hand.</div>
            ) : handCount === 0 ? (
              <div className="hand-empty">No cards yet.</div>
            ) : (
              <>
                <div className="hand-meta">{handCount} cards in hand</div>
                <ul className="card-list">
                  {view.private.hand.map((cardId) => (
                    <li key={cardId} className="card-tag">
                      {cardId}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {deckCounts ? (
              <div className="deck-counts">
                <div className="resource-row">
                  <span>Draw</span>
                  <strong>{deckCounts.drawPile}</strong>
                </div>
                <div className="resource-row">
                  <span>Discard</span>
                  <strong>{deckCounts.discardPile}</strong>
                </div>
                <div className="resource-row">
                  <span>Scrapped</span>
                  <strong>{deckCounts.scrapped}</strong>
                </div>
              </div>
            ) : null}
            {view.private?.vp ? (
              <div className="hand-empty">
                VP: {view.private.vp.total} (control {view.private.vp.control})
              </div>
            ) : null}
          </div>

          <div className="sidebar-section">
            <h3>Actions</h3>
            <ActionPanel
              phase={view.public.phase}
              player={localPlayer ?? null}
              status={status}
              onSubmit={onSubmitAction}
            />
          </div>

          <MarketPanel market={view.public.market} />

          <div className="sidebar-section">
            <h3>Log</h3>
            {view.public.logs.length === 0 ? (
              <div className="log-empty">Waiting for events.</div>
            ) : (
              <ul className="log-list">
                {view.public.logs.map((entry, index) => (
                  <li key={`${entry.type}-${index}`}>{entry.type}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="sidebar-section">
            <h3>Players</h3>
            <ul className="player-list">
              {view.public.players.map((player) => (
                <li key={player.id} className="player-row">
                  <div>
                    <span className="player-name">{player.name}</span>
                    <span className="player-meta">Seat {player.seatIndex}</span>
                  </div>
                  <span
                    className={`status-pill ${
                      player.connected ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.connected ? "On" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
};

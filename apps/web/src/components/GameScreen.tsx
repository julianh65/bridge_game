import { useMemo } from "react";

import { BoardView } from "./BoardView";
import { buildSampleGame } from "../lib/sample-game";

export const GameScreen = () => {
  const sample = useMemo(() => buildSampleGame(3, "42"), []);
  const { state } = sample;
  const leadPlayer = state.players.find((player) => player.seatIndex === state.leadSeatIndex);
  const activePlayer = state.players[0];
  const handCount = activePlayer?.deck.hand.length ?? 0;
  const phaseLabel = state.phase.replace("round.", "").replace(".", " ");

  return (
    <section className="game-screen">
      <header className="game-screen__header">
        <div>
          <p className="eyebrow">Bridgefront Game</p>
          <h1>
            Round {state.round} · {phaseLabel}
          </h1>
          <p className="subhead">Sample engine state (auto-setup for UI preview).</p>
        </div>
        <div className="game-screen__meta">
          {leadPlayer ? (
            <span className="status-pill status-pill--ready">Lead: {leadPlayer.name}</span>
          ) : null}
          <span className="status-pill">Players: {state.players.length}</span>
          {state.winnerPlayerId ? (
            <span className="status-pill status-pill--winner">
              Winner: {state.winnerPlayerId}
            </span>
          ) : null}
        </div>
      </header>

      <div className="game-screen__layout">
        <section className="panel game-board">
          <div className="game-board__placeholder">
            <h2>Board</h2>
            <p className="muted">Sample board (seed 42, 3 players).</p>
            <div className="legend legend--compact">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>
            <BoardView
              hexes={sample.hexRender}
              board={state.board}
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
              <strong>{activePlayer?.resources.gold ?? 0}</strong>
            </div>
            <div className="resource-row">
              <span>Mana</span>
              <strong>{activePlayer?.resources.mana ?? 0}</strong>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Hand</h3>
            <div className="hand-empty">
              {handCount > 0 ? `${handCount} cards in hand.` : "No cards yet."}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Actions</h3>
            <button type="button" className="btn btn-secondary" disabled>
              Choose Action
            </button>
          </div>

          <div className="sidebar-section">
            <h3>Log</h3>
            {state.logs.length === 0 ? (
              <div className="log-empty">Waiting for events.</div>
            ) : (
              <ul className="log-list">
                {state.logs.map((entry, index) => (
                  <li key={`${entry.type}-${index}`}>{entry.type}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

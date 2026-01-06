import { useMemo } from "react";

import { BoardView } from "./BoardView";
import { buildBoardPreview } from "../lib/board-preview";

export const GameScreen = () => {
  const preview = useMemo(() => buildBoardPreview(3, "42"), []);

  return (
    <section className="game-screen">
      <header className="game-screen__header">
        <div>
          <p className="eyebrow">Bridgefront Game</p>
          <h1>Round 1 · Action Phase</h1>
          <p className="subhead">Live engine state will replace these placeholders.</p>
        </div>
        <div className="game-screen__meta">
          <span className="status-pill status-pill--ready">Lead: Player 1</span>
          <span className="status-pill">Players: 3</span>
        </div>
      </header>

      <div className="game-screen__layout">
        <section className="panel game-board">
          <div className="game-board__placeholder">
            <h2>Board</h2>
            <p className="muted">Preview board (seed 42, 3 players).</p>
            <div className="legend legend--compact">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>
            <BoardView
              hexes={preview.hexRender}
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
              <strong>0</strong>
            </div>
            <div className="resource-row">
              <span>Mana</span>
              <strong>0</strong>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Hand</h3>
            <div className="hand-empty">No cards yet.</div>
          </div>

          <div className="sidebar-section">
            <h3>Actions</h3>
            <button type="button" className="btn btn-secondary" disabled>
              Choose Action
            </button>
          </div>

          <div className="sidebar-section">
            <h3>Log</h3>
            <div className="log-empty">Waiting for events.</div>
          </div>
        </aside>
      </div>
    </section>
  );
};

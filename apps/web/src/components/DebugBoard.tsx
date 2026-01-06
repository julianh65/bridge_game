import { useMemo, useState } from "react";

import { BoardView } from "./BoardView";
import { buildBoardPreview } from "../lib/board-preview";

export const DebugBoard = () => {
  const [playerCount, setPlayerCount] = useState(2);
  const [seedInput, setSeedInput] = useState("42");

  const { debug, error } = useMemo(() => {
    try {
      return { debug: buildBoardPreview(playerCount, seedInput), error: null };
    } catch (err) {
      return {
        debug: null,
        error: err instanceof Error ? err.message : "Unknown error"
      };
    }
  }, [playerCount, seedInput]);

  return (
    <section className="debug-board">
      <header className="app__header">
        <div>
          <p className="eyebrow">Bridgefront Debug</p>
          <h1>Board Inspector</h1>
          <p className="subhead">Seeded placement for capitals, forges, and mines.</p>
        </div>
        <div className="controls">
          <label>
            Players
            <select
              value={playerCount}
              onChange={(event) => setPlayerCount(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed
            <input
              type="number"
              value={seedInput}
              onChange={(event) => setSeedInput(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => setSeedInput(String(Math.floor(Math.random() * 1_000_000)))}
          >
            Randomize
          </button>
        </div>
      </header>

      {error ? (
        <section className="panel error">
          <h2>Board generation failed</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {debug ? (
        <div className="layout">
          <section className="panel summary">
            <h2>Summary</h2>
            <div className="stat-grid">
              <div>
                <span className="label">Seed</span>
                <span className="value">{debug.seedValue}</span>
              </div>
              <div>
                <span className="label">Radius</span>
                <span className="value">{debug.radius}</span>
              </div>
              <div>
                <span className="label">Hexes</span>
                <span className="value">{Object.keys(debug.board.hexes).length}</span>
              </div>
              <div>
                <span className="label">Forges</span>
                <span className="value">{debug.forgeKeys.length}</span>
              </div>
              <div>
                <span className="label">Mines</span>
                <span className="value">{debug.mineKeys.length}</span>
              </div>
              <div>
                <span className="label">Home Mines</span>
                <span className="value">{debug.homeMineKeys.length}</span>
              </div>
            </div>

            <div className="list-block">
              <h3>Capitals</h3>
              <ul>
                {debug.capitals.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>

            <div className="list-block">
              <h3>Forges</h3>
              <ul>
                {debug.forgeKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>

            <div className="list-block">
              <h3>Mines</h3>
              <ul>
                {debug.mineKeys.map((key) => (
                  <li key={key}>
                    {key}
                    {debug.board.hexes[key].mineValue ? (
                      <span className="chip">V{debug.board.hexes[key].mineValue}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel board">
            <div className="legend">
              <div className="legend__item legend__item--capital">Capital</div>
              <div className="legend__item legend__item--forge">Forge</div>
              <div className="legend__item legend__item--mine">Mine</div>
              <div className="legend__item legend__item--center">Center</div>
            </div>

            <BoardView hexes={debug.hexRender} showCoords showTags showMineValues />
          </section>
        </div>
      ) : null}
    </section>
  );
};

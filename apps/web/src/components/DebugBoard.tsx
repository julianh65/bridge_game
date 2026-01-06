import { useMemo, useState } from "react";

import {
  DEFAULT_CONFIG,
  createBaseBoard,
  getCapitalSlots,
  placeSpecialTiles
} from "@bridgefront/engine";
import { createRngState, parseHexKey } from "@bridgefront/shared";

const HEX_SIZE = 26;
const SQRT_3 = Math.sqrt(3);

type HexRender = {
  key: string;
  x: number;
  y: number;
  tile: string;
  mineValue?: number;
};

const hexPoints = (x: number, y: number, size: number) => {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(`${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`);
  }
  return points.join(" ");
};

const buildBoard = (playerCount: number, seedInput: string) => {
  const seed = Number.parseInt(seedInput, 10);
  const seedValue = Number.isFinite(seed) ? seed : 0;
  const radius = DEFAULT_CONFIG.boardRadiusByPlayerCount[playerCount] ?? 0;
  const board = createBaseBoard(radius);
  const capitals = getCapitalSlots(
    playerCount,
    radius,
    DEFAULT_CONFIG.capitalSlotsByPlayerCount
  );
  const hexes = { ...board.hexes };
  for (const key of capitals) {
    hexes[key] = { ...hexes[key], tile: "capital" };
  }

  const boardWithCapitals = { ...board, hexes };
  const { board: placedBoard, forgeKeys, homeMineKeys, mineKeys } = placeSpecialTiles(
    boardWithCapitals,
    createRngState(seedValue),
    {
      capitalHexes: capitals,
      forgeCount: DEFAULT_CONFIG.tileCountsByPlayerCount[playerCount].forges,
      mineCount: DEFAULT_CONFIG.tileCountsByPlayerCount[playerCount].mines,
      rules: DEFAULT_CONFIG.boardGenerationRules
    }
  );

  const hexRender: HexRender[] = Object.values(placedBoard.hexes).map((hex) => {
    const { q, r } = parseHexKey(hex.key);
    const x = HEX_SIZE * SQRT_3 * (q + r / 2);
    const y = HEX_SIZE * 1.5 * r;
    return {
      key: hex.key,
      x,
      y,
      tile: hex.tile,
      mineValue: hex.mineValue
    };
  });

  return {
    seedValue,
    radius,
    board: placedBoard,
    hexRender,
    capitals,
    forgeKeys,
    homeMineKeys,
    mineKeys
  };
};

const boundsForHexes = (hexes: HexRender[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const hex of hexes) {
    minX = Math.min(minX, hex.x);
    maxX = Math.max(maxX, hex.x);
    minY = Math.min(minY, hex.y);
    maxY = Math.max(maxY, hex.y);
  }

  const padding = HEX_SIZE * 1.2;
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };
};

const tileTag = (tile: string) => {
  switch (tile) {
    case "capital":
      return "CAP";
    case "forge":
      return "FORGE";
    case "mine":
      return "MINE";
    case "center":
      return "CTR";
    default:
      return "";
  }
};

export const DebugBoard = () => {
  const [playerCount, setPlayerCount] = useState(2);
  const [seedInput, setSeedInput] = useState("42");

  const { debug, error } = useMemo(() => {
    try {
      return { debug: buildBoard(playerCount, seedInput), error: null };
    } catch (err) {
      return {
        debug: null,
        error: err instanceof Error ? err.message : "Unknown error"
      };
    }
  }, [playerCount, seedInput]);

  const viewBox = debug ? boundsForHexes(debug.hexRender) : null;

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

            <svg viewBox={`${viewBox?.minX ?? 0} ${viewBox?.minY ?? 0} ${viewBox?.width ?? 0} ${viewBox?.height ?? 0}`}>
              {debug.hexRender.map((hex) => {
                const tag = tileTag(hex.tile);
                const coordsY = tag ? hex.y + 8 : hex.y;
                const valueY = tag ? hex.y + 20 : hex.y + 12;

                return (
                  <g key={hex.key}>
                    <polygon
                      className={`hex hex--${hex.tile}`}
                      points={hexPoints(hex.x, hex.y, HEX_SIZE)}
                    />
                    {tag ? (
                      <text x={hex.x} y={hex.y - 6} className="hex__tag">
                        {tag}
                      </text>
                    ) : null}
                    <text
                      x={hex.x}
                      y={coordsY}
                      className={tag ? "hex__coords" : "hex__label"}
                    >
                      {hex.key}
                    </text>
                    {hex.tile === "mine" && hex.mineValue ? (
                      <text x={hex.x} y={valueY} className="hex__value">
                        {hex.mineValue}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </section>
        </div>
      ) : null}
    </section>
  );
};

import { useState } from "react";

import { DebugBoard } from "./components/DebugBoard";
import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";

type AppView = "lobby" | "debug" | "game";

export default function App() {
  const [view, setView] = useState<AppView>("lobby");

  return (
    <main className="app">
      <nav className="app__nav">
        <span className="app__nav-label">Views</span>
        <div className="view-toggle">
          <button
            type="button"
            className={view === "lobby" ? "is-active" : ""}
            onClick={() => setView("lobby")}
          >
            Lobby
          </button>
          <button
            type="button"
            className={view === "game" ? "is-active" : ""}
            onClick={() => setView("game")}
          >
            Game
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

      {view === "lobby" ? <Lobby onStart={() => setView("game")} /> : null}
      {view === "game" ? <GameScreen /> : null}
      {view === "debug" ? <DebugBoard /> : null}
    </main>
  );
}

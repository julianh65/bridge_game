import { useState } from "react";

import { DebugBoard } from "./components/DebugBoard";
import { Lobby } from "./components/Lobby";

type AppView = "lobby" | "debug";

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
            className={view === "debug" ? "is-active" : ""}
            onClick={() => setView("debug")}
          >
            Board Debug
          </button>
        </div>
      </nav>

      {view === "lobby" ? <Lobby onStart={() => setView("debug")} /> : <DebugBoard />}
    </main>
  );
}

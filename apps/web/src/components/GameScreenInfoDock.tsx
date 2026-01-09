import type { ReactNode } from "react";

type GameScreenInfoDockProps = {
  isOpen: boolean;
  activeTab: "log" | "effects";
  logCount: number;
  effectsCount: number;
  logContent: ReactNode;
  effectsContent: ReactNode;
  onTabChange: (tab: "log" | "effects") => void;
  onClose: () => void;
};

export const GameScreenInfoDock = ({
  isOpen,
  activeTab,
  logCount,
  effectsCount,
  logContent,
  effectsContent,
  onTabChange,
  onClose
}: GameScreenInfoDockProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="panel game-dock" aria-live="polite">
      <div className="game-dock__header">
        <div className="game-dock__title">
          <span className="game-dock__eyebrow">Table intel</span>
          <strong className="game-dock__label">
            {activeTab === "effects" ? "Active effects" : "Log"}
          </strong>
        </div>
        <div className="game-dock__tabs">
          <button
            type="button"
            className={`btn btn-tertiary ${activeTab === "log" ? "is-active" : ""}`}
            aria-pressed={activeTab === "log"}
            onClick={() => onTabChange("log")}
          >
            Log <span className="dock-count">{logCount}</span>
          </button>
          <button
            type="button"
            className={`btn btn-tertiary ${activeTab === "effects" ? "is-active" : ""}`}
            aria-pressed={activeTab === "effects"}
            onClick={() => onTabChange("effects")}
          >
            Effects <span className="dock-count">{effectsCount}</span>
          </button>
        </div>
        <button
          type="button"
          className="btn btn-tertiary game-dock__close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="game-dock__body">
        {activeTab === "effects" ? effectsContent : logContent}
      </div>
    </section>
  );
};

type GameScreenHeaderProps = {
  isCollapsed: boolean;
  connectionLabel: string;
  connectionClass: string;
  phaseLabel: string;
  round: number;
  roomId: string;
  playerCount: number;
  winnerPlayerId: string | null;
  onToggle: () => void;
};

export const GameScreenHeader = ({
  isCollapsed,
  connectionLabel,
  connectionClass,
  phaseLabel,
  round,
  roomId,
  playerCount,
  winnerPlayerId,
  onToggle
}: GameScreenHeaderProps) => {
  return (
    <header className={`game-screen__header ${isCollapsed ? "is-collapsed" : ""}`}>
      {isCollapsed ? (
        <div className="game-screen__collapsed-bar">
          <div className="game-screen__collapsed-meta">
            <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
            <span className="status-pill status-pill--phase">Phase: {phaseLabel}</span>
            <span className="status-pill">Round {round}</span>
          </div>
          <div className="game-screen__collapsed-actions">
            <button type="button" className="btn btn-tertiary" onClick={onToggle}>
              Show HUD
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="eyebrow">Bridgefront</p>
            <h1>Room {roomId}</h1>
            <p className="subhead">
              Round {round} · Phase {phaseLabel}
            </p>
          </div>
          <div className="game-screen__meta">
            <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
            <span className="status-pill status-pill--phase">Phase: {phaseLabel}</span>
            <span className="status-pill">Round {round}</span>
            <span className="status-pill">Players: {playerCount}</span>
            {winnerPlayerId ? (
              <span className="status-pill status-pill--winner">Winner: {winnerPlayerId}</span>
            ) : null}
            <button type="button" className="btn btn-tertiary" onClick={onToggle}>
              Hide HUD
            </button>
          </div>
        </>
      )}
    </header>
  );
};

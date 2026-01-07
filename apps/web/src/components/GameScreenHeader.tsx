type GameScreenHeaderProps = {
  isCollapsed: boolean;
  connectionLabel: string;
  connectionClass: string;
  phaseLabel: string;
  round: number;
  roomId: string;
  playerCount: number;
  winnerPlayerId: string | null;
  localGold: number | null;
  localVpTotal: number | null;
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
  localGold,
  localVpTotal,
  onToggle
}: GameScreenHeaderProps) => {
  const showConnectionStatus = connectionLabel !== "Live";
  const resourceChips =
    localGold === null && localVpTotal === null ? null : (
      <div className="game-screen__resources">
        {localGold !== null ? (
          <div className="resource-chip resource-chip--gold">
            <span className="resource-chip__icon" aria-hidden="true">
              🟡
            </span>
            <span className="resource-chip__label">Gold</span>
            <strong className="resource-chip__value">{localGold}</strong>
          </div>
        ) : null}
        {localVpTotal !== null ? (
          <div className="resource-chip resource-chip--vp">
            <span className="resource-chip__icon" aria-hidden="true">
              🟢
            </span>
            <span className="resource-chip__label">Victory Points</span>
            <strong className="resource-chip__value">{localVpTotal}</strong>
          </div>
        ) : null}
      </div>
    );
  return (
    <header className={`game-screen__header ${isCollapsed ? "is-collapsed" : ""}`}>
      {isCollapsed ? (
        <div className="game-screen__collapsed-bar">
          <div className="game-screen__collapsed-meta">
            {resourceChips}
            {showConnectionStatus ? (
              <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
            ) : null}
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
            {resourceChips}
            {showConnectionStatus ? (
              <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
            ) : null}
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

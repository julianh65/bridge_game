import type { CSSProperties } from "react";

import type { GameView } from "@bridgefront/engine";

type GameScreenSidebarProps = {
  connectionLabel: string;
  connectionClass: string;
  phaseLabel: string;
  round: number;
  leadPlayerName: string | null;
  players: GameView["public"]["players"];
  actionStep: GameView["public"]["actionStep"];
  actionEligible: Set<string>;
  actionWaiting: Set<string>;
  isInteractivePhase: boolean;
  localResources: { gold: number; mana: number };
  localVpTotal: number | null;
  logCount: number;
  lastLogLabel: string | null;
  isInfoDockOpen: boolean;
  onToggleDock: () => void;
};

export const GameScreenSidebar = ({
  connectionLabel,
  connectionClass,
  phaseLabel,
  round,
  leadPlayerName,
  players,
  actionStep,
  actionEligible,
  actionWaiting,
  isInteractivePhase,
  localResources,
  localVpTotal,
  logCount,
  lastLogLabel,
  isInfoDockOpen,
  onToggleDock
}: GameScreenSidebarProps) => {
  const actionStatusSummary = actionStep
    ? (() => {
        const eligibleCount = actionEligible.size;
        const waitingCount = actionWaiting.size;
        const submittedCount = Math.max(0, eligibleCount - waitingCount);
        const idleCount = Math.max(0, players.length - eligibleCount);
        return { eligibleCount, waitingCount, submittedCount, idleCount };
      })()
    : null;

  const getActionStatusTooltip = (playerId: string): string => {
    if (!actionStep) {
      return `Action: not active (${phaseLabel}).`;
    }
    if (!actionEligible.has(playerId)) {
      return "Action: not eligible this step.";
    }
    return actionWaiting.has(playerId)
      ? "Action: waiting for declaration."
      : "Action: declaration submitted.";
  };

  const getActionStatusBadge = (
    playerId: string
  ): { label: string; className: string } | null => {
    if (!actionStep) {
      return null;
    }
    if (!actionEligible.has(playerId)) {
      return { label: "Idle", className: "status-pill--idle" };
    }
    if (actionWaiting.has(playerId)) {
      return { label: "Waiting", className: "status-pill--waiting" };
    }
    return { label: "Submitted", className: "status-pill--ready" };
  };

  const playerSwatchStyle = (seatIndex: number): CSSProperties => {
    const index = Math.max(0, Math.min(5, Math.floor(seatIndex)));
    return {
      "--player-color": `var(--player-color-${index})`
    } as CSSProperties;
  };

  return (
    <aside className="panel game-sidebar">
      <h2>Command Center</h2>
      <div className="sidebar-section sidebar-section--status">
        <div className="sidebar-section__header">
          <h3>Status</h3>
          <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
        </div>
        <div className="resource-row">
          <span>Round</span>
          <strong>{round}</strong>
        </div>
        <div className="resource-row">
          <span>Phase</span>
          <strong>{phaseLabel}</strong>
        </div>
        <div className="resource-row">
          <span>Lead</span>
          <strong>{leadPlayerName ?? "—"}</strong>
        </div>
        {actionStatusSummary ? (
          <div className="status-summary">
            <span className="status-pill status-pill--waiting">
              Waiting {actionStatusSummary.waitingCount}
            </span>
            <span className="status-pill status-pill--ready">
              Submitted {actionStatusSummary.submittedCount}
            </span>
            {actionStatusSummary.idleCount > 0 ? (
              <span className="status-pill status-pill--idle">
                Idle {actionStatusSummary.idleCount}
              </span>
            ) : null}
          </div>
        ) : null}
        {!isInteractivePhase ? (
          <p className="status-note">Resolving {phaseLabel}. Waiting on the server.</p>
        ) : null}
      </div>

      <div className="sidebar-section">
        <h3>Resources</h3>
        <div className="resource-row">
          <span>🪙 Gold</span>
          <strong>{localResources.gold}</strong>
        </div>
        <div className="resource-row">
          <span>✨ Mana</span>
          <strong>{localResources.mana}</strong>
        </div>
        {localVpTotal !== null ? (
          <div className="resource-row">
            <span>⭐ VP</span>
            <strong>{localVpTotal}</strong>
          </div>
        ) : null}
      </div>

      <div className="sidebar-section sidebar-section--table">
        <div className="sidebar-section__header">
          <h3>Table</h3>
        </div>
        <div className="table-list">
          {players.map((player) => {
            const actionStatus = getActionStatusBadge(player.id);
            const actionStatusClass = actionStatus
              ? ["status-pill", actionStatus.className].filter(Boolean).join(" ")
              : "";
            const rowClassName = [
              "table-row",
              actionStep
                ? actionEligible.has(player.id)
                  ? actionWaiting.has(player.id)
                    ? "table-row--waiting"
                    : "table-row--submitted"
                  : "table-row--idle"
                : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={player.id}
                className={rowClassName}
                title={getActionStatusTooltip(player.id)}
              >
                <div className="table-row__main">
                  <span className="player-swatch" style={playerSwatchStyle(player.seatIndex)} />
                  <div>
                    <span className="player-name">{player.name}</span>
                    <span className="player-meta">Seat {player.seatIndex}</span>
                  </div>
                </div>
                <div className="table-row__stats">
                  <span className="table-stat" title="Gold">
                    🪙 {player.resources.gold}
                  </span>
                  <span className="table-stat" title="Mana">
                    ✨ {player.resources.mana}
                  </span>
                  <span className="table-stat">H {player.handCount}</span>
                </div>
                <div className="table-row__status">
                  <span
                    className={`status-pill ${
                      player.connected ? "status-pill--ready" : "status-pill--waiting"
                    }`}
                  >
                    {player.connected ? "On" : "Off"}
                  </span>
                  {actionStatus ? <span className={actionStatusClass}>{actionStatus.label}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-section sidebar-section--intel">
        <div className="sidebar-section__header">
          <h3>Intel</h3>
          <div className="dock-buttons">
            <button
              type="button"
              className={`btn btn-tertiary ${isInfoDockOpen ? "is-active" : ""}`}
              onClick={onToggleDock}
            >
              Log <span className="dock-count">{logCount}</span>
            </button>
          </div>
        </div>
        <div className="intel-grid">
          <div className="intel-card intel-card--log">
            <span className="intel-label">Latest</span>
            <span className="intel-value intel-snippet">
              {lastLogLabel ?? "No events yet."}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

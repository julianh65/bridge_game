import { useState, type CSSProperties } from "react";

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
  logCount: number;
  lastLogLabel: string | null;
  isInfoDockOpen: boolean;
  onToggleDock: () => void;
  onCollapse: () => void;
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
  logCount,
  lastLogLabel,
  isInfoDockOpen,
  onToggleDock,
  onCollapse
}: GameScreenSidebarProps) => {
  type SectionKey = "status" | "table" | "intel";
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    status: true,
    table: true,
    intel: true
  });

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
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
      <div className="game-sidebar__header">
        <h2>Command Center</h2>
        <button type="button" className="btn btn-tertiary" onClick={onCollapse}>
          Hide
        </button>
      </div>
      <div className="sidebar-section sidebar-section--status">
        <div className="sidebar-section__header">
          <h3>Status</h3>
          <div className="sidebar-section__actions">
            <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
            <button
              type="button"
              className="btn btn-tertiary sidebar-section__toggle"
              onClick={() => toggleSection("status")}
              aria-expanded={openSections.status}
              aria-controls="sidebar-status"
            >
              {openSections.status ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {openSections.status ? (
          <div className="sidebar-section__body" id="sidebar-status">
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
            {!isInteractivePhase ? (
              <p className="status-note">Resolving {phaseLabel}. Waiting on the server.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sidebar-section sidebar-section--table">
        <div className="sidebar-section__header">
          <h3>Table</h3>
          <button
            type="button"
            className="btn btn-tertiary sidebar-section__toggle"
            onClick={() => toggleSection("table")}
            aria-expanded={openSections.table}
            aria-controls="sidebar-table"
          >
            {openSections.table ? "Hide" : "Show"}
          </button>
        </div>
        {openSections.table ? (
          <div className="sidebar-section__body" id="sidebar-table">
            <div className="table-list">
              <div className="table-header" aria-hidden="true">
                <span className="table-header__label table-header__label--name">Player</span>
                <span className="table-header__label" title="Gold">
                  🟡
                </span>
                <span className="table-header__label" title="Mana">
                  🔵
                </span>
                <span className="table-header__label" title="Hand">
                  H
                </span>
                <span className="table-header__label table-header__label--status">Status</span>
              </div>
              {players.map((player) => {
                const actionStatus = getActionStatusBadge(player.id);
                const actionStatusClass = actionStatus
                  ? ["status-pill", "status-pill--compact", actionStatus.className]
                      .filter(Boolean)
                      .join(" ")
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
                    <span className="table-stat" title="Gold">
                      {player.resources.gold}
                    </span>
                    <span className="table-stat" title="Mana">
                      {player.resources.mana}
                    </span>
                    <span className="table-stat" title="Hand">
                      {player.handCount}
                    </span>
                    <div className="table-row__status">
                      {actionStatus ? (
                        <span className={actionStatusClass}>{actionStatus.label}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="sidebar-section sidebar-section--intel">
        <div className="sidebar-section__header">
          <h3>Intel</h3>
          <div className="sidebar-section__actions">
            <div className="dock-buttons">
              <button
                type="button"
                className={`btn btn-tertiary ${isInfoDockOpen ? "is-active" : ""}`}
                onClick={onToggleDock}
              >
                Log <span className="dock-count">{logCount}</span>
              </button>
            </div>
            <button
              type="button"
              className="btn btn-tertiary sidebar-section__toggle"
              onClick={() => toggleSection("intel")}
              aria-expanded={openSections.intel}
              aria-controls="sidebar-intel"
            >
              {openSections.intel ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {openSections.intel ? (
          <div className="sidebar-section__body" id="sidebar-intel">
            <div className="intel-grid">
              <div className="intel-card intel-card--log">
                <span className="intel-label">Latest</span>
                <span className="intel-value intel-snippet">
                  {lastLogLabel ?? "No events yet."}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

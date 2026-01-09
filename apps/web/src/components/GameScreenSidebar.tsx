import { useMemo, useState, type CSSProperties } from "react";

import { CARD_DEFS, type GameView } from "@bridgefront/engine";

import { getFactionName } from "../lib/factions";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type GameScreenSidebarProps = {
  connectionLabel: string;
  connectionClass: string;
  phaseLabel: string;
  round: number;
  leadPlayerName: string | null;
  players: GameView["public"]["players"];
  modifiers: GameView["public"]["modifiers"];
  actionStep: GameView["public"]["actionStep"];
  actionEligible: Set<string>;
  actionWaiting: Set<string>;
  isInteractivePhase: boolean;
  logCount: number;
  lastLogLabel: string | null;
  activeEffectsCount: number;
  isInfoDockOpen: boolean;
  infoDockTab: "log" | "effects";
  onOpenDock: (tab: "log" | "effects") => void;
  onCollapse: () => void;
};

type ModifierView = GameView["public"]["modifiers"][number];

const formatDurationLabel = (duration: ModifierView["duration"]) => {
  switch (duration.type) {
    case "permanent":
      return "Permanent";
    case "endOfRound":
      return "Until round end";
    case "endOfBattle":
      return "Until battle ends";
    case "uses":
      return `${duration.remaining} use${duration.remaining === 1 ? "" : "s"}`;
    default: {
      const _exhaustive: never = duration;
      return String(_exhaustive);
    }
  }
};

const formatSourceLabel = (modifier: ModifierView) => {
  const sourceId = modifier.source.sourceId;
  switch (modifier.source.type) {
    case "faction": {
      const factionName = getFactionName(sourceId);
      return factionName ? `Faction ${factionName}` : `Faction ${sourceId}`;
    }
    case "champion": {
      const name = CARD_DEFS_BY_ID.get(sourceId)?.name ?? sourceId;
      return `Champion ${name}`;
    }
    case "card":
      return CARD_DEFS_BY_ID.get(sourceId)?.name ?? sourceId;
    default: {
      const _exhaustive: never = modifier.source.type;
      return String(_exhaustive);
    }
  }
};

const formatActionDuration = (durationMs: number | null): string => {
  if (durationMs === null || !Number.isFinite(durationMs)) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))}ms`;
  }
  if (durationMs < 60000) {
    const seconds = durationMs / 1000;
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

export const GameScreenSidebar = ({
  connectionLabel,
  connectionClass,
  phaseLabel,
  round,
  leadPlayerName,
  players,
  modifiers,
  actionStep,
  actionEligible,
  actionWaiting,
  isInteractivePhase,
  logCount,
  lastLogLabel,
  activeEffectsCount,
  isInfoDockOpen,
  infoDockTab,
  onOpenDock,
  onCollapse
}: GameScreenSidebarProps) => {
  type SectionKey = "status" | "table" | "intel";
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    status: true,
    table: true,
    intel: true
  });
  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players]
  );
  const activeEffects = useMemo(
    () =>
      modifiers.map((modifier) => {
        const ownerLabel = modifier.ownerPlayerId
          ? playerNameById.get(modifier.ownerPlayerId) ?? modifier.ownerPlayerId
          : null;
        const attachment =
          modifier.attachedHex
            ? `Hex ${modifier.attachedHex}`
            : modifier.attachedEdge
              ? `Edge ${modifier.attachedEdge}`
              : modifier.attachedUnitId
                ? `Unit ${modifier.attachedUnitId}`
                : "Global";
        const durationLabel = formatDurationLabel(modifier.duration);
        const detailParts = [
          ownerLabel ? `Owner ${ownerLabel}` : null,
          attachment,
          durationLabel
        ].filter(Boolean);
        return {
          id: modifier.id,
          label: formatSourceLabel(modifier),
          detail: detailParts.join(" · ")
        };
      }),
    [modifiers, playerNameById]
  );

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
                const timingAverage = formatActionDuration(player.actionTiming.averageMs);
                const timingLast = formatActionDuration(player.actionTiming.lastMs);
                const timingTitle = `Last ${timingLast} · Avg ${timingAverage} · Turns ${player.actionTiming.count}`;
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
                        <span className="player-meta" title={timingTitle}>
                          Seat {player.seatIndex} · Avg {timingAverage}
                        </span>
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
                className={`btn btn-tertiary ${
                  isInfoDockOpen && infoDockTab === "log" ? "is-active" : ""
                }`}
                onClick={() => onOpenDock("log")}
              >
                Log <span className="dock-count">{logCount}</span>
              </button>
              <button
                type="button"
                className={`btn btn-tertiary ${
                  isInfoDockOpen && infoDockTab === "effects" ? "is-active" : ""
                }`}
                onClick={() => onOpenDock("effects")}
              >
                Effects <span className="dock-count">{activeEffectsCount}</span>
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
              <div className="intel-card">
                <span className="intel-label">Active effects</span>
                {activeEffects.length > 0 ? (
                  <ul className="log-list">
                    {activeEffects.map((effect) => (
                      <li key={effect.id}>
                        <span className="intel-value">{effect.label}</span>
                        {effect.detail ? (
                          <span className="player-meta"> {effect.detail}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="intel-value">No active effects.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

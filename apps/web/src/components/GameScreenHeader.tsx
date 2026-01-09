import { useEffect, useRef, useState } from "react";

type GameScreenHeaderProps = {
  isCollapsed: boolean;
  connectionLabel: string;
  connectionClass: string;
  phase: string;
  phaseLabel: string;
  round: number;
  roundsMax: number;
  roomId: string;
  playerCount: number;
  winnerPlayerId: string | null;
  localGold: number | null;
  localVpTotal: number | null;
  onToggle: () => void;
};

const PHASE_TRACKER_STEPS = [
  { key: "round.reset", label: "Reset" },
  { key: "round.study", label: "Study" },
  { key: "round.market", label: "Market" },
  { key: "round.action", label: "Action" },
  { key: "round.sieges", label: "Sieges" },
  { key: "round.collection", label: "Collection" },
  { key: "round.scoring", label: "Scoring" },
  { key: "round.cleanup", label: "Cleanup" },
  { key: "round.ageUpdate", label: "Age" }
];

export const GameScreenHeader = ({
  isCollapsed,
  connectionLabel,
  connectionClass,
  phase,
  phaseLabel,
  round,
  roundsMax,
  roomId,
  playerCount,
  winnerPlayerId,
  localGold,
  localVpTotal,
  onToggle
}: GameScreenHeaderProps) => {
  const [goldPulse, setGoldPulse] = useState(false);
  const [vpPulse, setVpPulse] = useState(false);
  const previousGold = useRef<number | null>(null);
  const previousVp = useRef<number | null>(null);
  const goldPulseTimeout = useRef<number | null>(null);
  const vpPulseTimeout = useRef<number | null>(null);
  const pulseDurationMs = 650;

  useEffect(() => {
    if (localGold === null) {
      previousGold.current = null;
      setGoldPulse(false);
      return;
    }
    const prev = previousGold.current;
    previousGold.current = localGold;
    if (prev === null || localGold <= prev) {
      return;
    }
    setGoldPulse(true);
    if (goldPulseTimeout.current) {
      window.clearTimeout(goldPulseTimeout.current);
    }
    goldPulseTimeout.current = window.setTimeout(() => {
      setGoldPulse(false);
      goldPulseTimeout.current = null;
    }, pulseDurationMs);
  }, [localGold]);

  useEffect(() => {
    if (localVpTotal === null) {
      previousVp.current = null;
      setVpPulse(false);
      return;
    }
    const prev = previousVp.current;
    previousVp.current = localVpTotal;
    if (prev === null || localVpTotal <= prev) {
      return;
    }
    setVpPulse(true);
    if (vpPulseTimeout.current) {
      window.clearTimeout(vpPulseTimeout.current);
    }
    vpPulseTimeout.current = window.setTimeout(() => {
      setVpPulse(false);
      vpPulseTimeout.current = null;
    }, pulseDurationMs);
  }, [localVpTotal]);

  useEffect(() => {
    return () => {
      if (goldPulseTimeout.current) {
        window.clearTimeout(goldPulseTimeout.current);
      }
      if (vpPulseTimeout.current) {
        window.clearTimeout(vpPulseTimeout.current);
      }
    };
  }, []);

  const showConnectionStatus = connectionLabel !== "Live";
  const activePhaseIndex = PHASE_TRACKER_STEPS.findIndex((step) => step.key === phase);
  const roundsLeft = Math.max(0, roundsMax - round + 1);
  const roundsLeftLabel = roundsLeft <= 1 ? "Final round" : `Rounds left: ${roundsLeft}`;
  const resourceChips =
    localGold === null && localVpTotal === null ? null : (
      <div className="game-screen__resources">
        {localGold !== null ? (
          <div
            className={`resource-chip resource-chip--gold${
              goldPulse ? " resource-chip--pulse" : ""
            }`}
          >
            <span className="resource-chip__icon" aria-hidden="true">
              🟡
            </span>
            <span className="resource-chip__label resource-chip__label--full">Gold</span>
            <span className="resource-chip__label resource-chip__label--short">Gold</span>
            <strong className="resource-chip__value">{localGold}</strong>
          </div>
        ) : null}
        {localVpTotal !== null ? (
          <div
            className={`resource-chip resource-chip--vp${
              vpPulse ? " resource-chip--pulse" : ""
            }`}
          >
            <span className="resource-chip__icon" aria-hidden="true">
              🟢
            </span>
            <span className="resource-chip__label resource-chip__label--full">
              Victory Points
            </span>
            <span className="resource-chip__label resource-chip__label--short">VP</span>
            <strong className="resource-chip__value">{localVpTotal}</strong>
          </div>
        ) : null}
      </div>
    );
  const phaseTracker = (
    <div
      className={`phase-tracker ${isCollapsed ? "phase-tracker--compact" : ""}`}
      aria-label="Round phases"
    >
      {PHASE_TRACKER_STEPS.map((step, index) => {
        const isActive = index === activePhaseIndex;
        const isComplete = activePhaseIndex > -1 && index < activePhaseIndex;
        return (
          <div className="phase-tracker__group" key={step.key}>
            <div
              className={`phase-tracker__step${isActive ? " is-active" : ""}${
                isComplete ? " is-complete" : ""
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              {step.label}
            </div>
            {index < PHASE_TRACKER_STEPS.length - 1 ? (
              <span className="phase-tracker__arrow" aria-hidden="true">
                →
              </span>
            ) : null}
          </div>
        );
      })}
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
            {phaseTracker}
            <span className="status-pill">Round {round}</span>
            <span className="status-pill">{roundsLeftLabel}</span>
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
            {phaseTracker}
          </div>
          <div className="game-screen__meta">
            {resourceChips}
            {showConnectionStatus ? (
              <span className={`status-pill ${connectionClass}`}>{connectionLabel}</span>
            ) : null}
            <span className="status-pill status-pill--phase">Phase: {phaseLabel}</span>
            <span className="status-pill">Round {round}</span>
            <span className="status-pill">{roundsLeftLabel}</span>
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

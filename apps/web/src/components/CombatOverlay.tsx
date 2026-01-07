import { useEffect, useState } from "react";

import type { CardDef } from "@bridgefront/engine";

import type {
  CombatSequence,
  CombatSideSummary,
  HitAssignmentSummary
} from "../lib/combat-log";

type CombatOverlayProps = {
  sequence: CombatSequence;
  playersById: Map<string, string>;
  cardDefsById: Map<string, CardDef>;
  onClose: () => void;
};

const formatPlayer = (playerId: string, playersById: Map<string, string>) => {
  return playersById.get(playerId) ?? playerId;
};

const formatSideSummary = (
  side: CombatSideSummary,
  playersById: Map<string, string>
) => {
  return `${formatPlayer(side.playerId, playersById)} (${side.forces}F/${side.champions}C)`;
};

export const CombatOverlay = ({
  sequence,
  playersById,
  cardDefsById,
  onClose
}: CombatOverlayProps) => {
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [freshIndex, setFreshIndex] = useState<number | null>(null);

  useEffect(() => {
    setRevealedRounds(0);
    setFreshIndex(null);
  }, [sequence.id]);

  useEffect(() => {
    if (freshIndex === null) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setFreshIndex(null);
    }, 650);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [freshIndex]);

  const handleRoll = () => {
    if (revealedRounds >= sequence.rounds.length) {
      onClose();
      return;
    }
    setFreshIndex(revealedRounds);
    setRevealedRounds((value) => value + 1);
  };

  const handleSkip = () => {
    onClose();
  };

  const visibleRounds = sequence.rounds.slice(0, revealedRounds);
  const canRoll = revealedRounds < sequence.rounds.length;
  const winnerLabel = sequence.end.winnerPlayerId
    ? formatPlayer(sequence.end.winnerPlayerId, playersById)
    : "No winner";
  const endReason = sequence.end.reason ? `(${sequence.end.reason})` : "";

  const renderHitSummary = (summary: HitAssignmentSummary) => {
    if (summary.forces === 0 && summary.champions.length === 0) {
      return <p className="combat-hits__empty">No hits.</p>;
    }
    return (
      <ul className="combat-hits__list">
        {summary.forces > 0 ? (
          <li className="combat-hits__item">Forces: {summary.forces}</li>
        ) : null}
        {summary.champions.map((champion) => {
          const def = cardDefsById.get(champion.cardDefId);
          const name = def?.name ?? champion.cardDefId;
          return (
            <li key={champion.unitId} className="combat-hits__item">
              {name} -{champion.hits} (HP {champion.hp}/{champion.maxHp})
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="combat-overlay" role="dialog" aria-live="polite" aria-modal="true">
      <div className="combat-overlay__scrim" />
      <div className="combat-overlay__panel">
        <header className="combat-overlay__header">
          <div>
            <p className="combat-overlay__eyebrow">Battle at</p>
            <h2 className="combat-overlay__title">{sequence.start.hexKey}</h2>
          </div>
          <div className="combat-overlay__actions">
            <button type="button" className="btn btn-tertiary" onClick={handleSkip}>
              Skip
            </button>
            <button type="button" className="btn btn-primary" onClick={handleRoll}>
              {canRoll ? "Roll dice" : "Close"}
            </button>
          </div>
        </header>

        <div className="combat-overlay__sides">
          <div className="combat-side">
            <span className="combat-side__role">Attackers</span>
            <strong className="combat-side__name">
              {formatSideSummary(sequence.start.attackers, playersById)}
            </strong>
          </div>
          <div className="combat-side">
            <span className="combat-side__role">Defenders</span>
            <strong className="combat-side__name">
              {formatSideSummary(sequence.start.defenders, playersById)}
            </strong>
          </div>
        </div>

        <div className="combat-overlay__rounds">
          {visibleRounds.length === 0 ? (
            <p className="combat-overlay__hint">Click roll to reveal dice.</p>
          ) : null}
          {visibleRounds.map((round, index) => {
            const isFresh = freshIndex === index;
            return (
              <div
                key={`round-${round.round}`}
                className={`combat-round ${isFresh ? "combat-round--fresh" : ""}`}
              >
                <div className="combat-round__header">
                  <strong>Round {round.round}</strong>
                  <span className="combat-round__meta">{round.hexKey}</span>
                </div>
                <div className="combat-round__grid">
                  <div className="combat-round__roll">
                    <span className="combat-round__label">Attackers roll</span>
                    <div className="combat-dice">
                      {round.attackers.dice.length === 0 ? (
                        <span className="combat-dice__empty">No dice</span>
                      ) : (
                        round.attackers.dice.map((roll, dieIndex) => (
                          <span
                            key={`a-${dieIndex}-${roll.value}`}
                            className={`combat-dice__die ${roll.isHit ? "is-hit" : ""}`}
                          >
                            {roll.value}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="combat-round__hits">
                      Hits: {round.attackers.hits}
                    </span>
                  </div>
                  <div className="combat-round__roll">
                    <span className="combat-round__label">Defenders roll</span>
                    <div className="combat-dice">
                      {round.defenders.dice.length === 0 ? (
                        <span className="combat-dice__empty">No dice</span>
                      ) : (
                        round.defenders.dice.map((roll, dieIndex) => (
                          <span
                            key={`d-${dieIndex}-${roll.value}`}
                            className={`combat-dice__die ${roll.isHit ? "is-hit" : ""}`}
                          >
                            {roll.value}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="combat-round__hits">
                      Hits: {round.defenders.hits}
                    </span>
                  </div>
                  <div className="combat-round__assign">
                    <span className="combat-round__label">Hits to defenders</span>
                    {renderHitSummary(round.hitsToDefenders)}
                  </div>
                  <div className="combat-round__assign">
                    <span className="combat-round__label">Hits to attackers</span>
                    {renderHitSummary(round.hitsToAttackers)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!canRoll ? (
          <div className="combat-overlay__outcome">
            Outcome: {winnerLabel} {endReason}
          </div>
        ) : null}
      </div>
    </section>
  );
};

import { useEffect, useMemo, useRef, useState } from "react";

import type { CardDef, ModifierView } from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";
import type {
  CombatSequence,
  CombatSideSummary,
  CombatUnitRoll,
  HitAssignmentSummary
} from "../lib/combat-log";

type RoundPhase = "rolling" | "locked" | "assigned";

type CombatOverlayProps = {
  sequence: CombatSequence;
  playersById: Map<string, string>;
  playerFactionsById?: Map<string, string | null>;
  cardDefsById: Map<string, CardDef>;
  modifiers?: ModifierView[];
  hexLabel?: string | null;
  isCapitalBattle?: boolean;
  onClose: () => void;
};

const ROLL_LOCK_MS = 650;
const ROLL_ASSIGN_MS = 1300;
const ROLL_DONE_MS = 1900;
const AUTO_CLOSE_MS = 2200;

const formatPlayer = (playerId: string, playersById: Map<string, string>) => {
  return playersById.get(playerId) ?? playerId;
};

const getTotal = (side: CombatSideSummary) => {
  if (typeof side.total === "number") {
    return side.total;
  }
  return side.forces + side.champions;
};

const formatEndReason = (reason: string | null) => {
  if (!reason) {
    return "";
  }
  switch (reason) {
    case "eliminated":
      return "Eliminated";
    case "noHits":
      return "No hits";
    case "stale":
      return "Stalemate";
    default:
      return reason;
  }
};

const formatAbilityName = (abilityId: string) =>
  abilityId.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

const formatModifierLabel = (
  modifier: ModifierView,
  cardDefsById: Map<string, CardDef>
) => {
  if (modifier.source.type === "faction") {
    return `Faction: ${formatAbilityName(modifier.source.sourceId)}`;
  }
  const card = cardDefsById.get(modifier.source.sourceId);
  const name = card?.name ?? modifier.source.sourceId;
  return modifier.source.type === "champion" ? `Champion: ${name}` : name;
};

const getChampionBounty = (cardDefId: string, cardDefsById: Map<string, CardDef>) => {
  return cardDefsById.get(cardDefId)?.champion?.bounty ?? 0;
};

const getSummaryBounty = (
  summary: HitAssignmentSummary,
  cardDefsById: Map<string, CardDef>
) => {
  return summary.champions.reduce((total, champion) => {
    if (champion.hits < champion.hp) {
      return total;
    }
    return total + getChampionBounty(champion.cardDefId, cardDefsById);
  }, 0);
};

const buildBountyTotals = (
  rounds: CombatSequence["rounds"],
  cardDefsById: Map<string, CardDef>
) => {
  const attackersKilled = new Set<string>();
  const defendersKilled = new Set<string>();
  let attackersBounty = 0;
  let defendersBounty = 0;

  rounds.forEach((round) => {
    round.hitsToDefenders.champions.forEach((champion) => {
      if (champion.hits < champion.hp || defendersKilled.has(champion.unitId)) {
        return;
      }
      defendersKilled.add(champion.unitId);
      attackersBounty += getChampionBounty(champion.cardDefId, cardDefsById);
    });
    round.hitsToAttackers.champions.forEach((champion) => {
      if (champion.hits < champion.hp || attackersKilled.has(champion.unitId)) {
        return;
      }
      attackersKilled.add(champion.unitId);
      defendersBounty += getChampionBounty(champion.cardDefId, cardDefsById);
    });
  });

  return { attackersBounty, defendersBounty };
};

const getUnitDisplayName = (
  unit: CombatUnitRoll,
  cardDefsById: Map<string, CardDef>
) => {
  if (unit.kind === "champion") {
    if (unit.cardDefId) {
      return cardDefsById.get(unit.cardDefId)?.name ?? "Champion";
    }
    return "Champion";
  }
  return "Force";
};

const getUnitGlyph = (unit: CombatUnitRoll, cardDefsById: Map<string, CardDef>) => {
  if (unit.kind === "force") {
    return "F";
  }
  const name = getUnitDisplayName(unit, cardDefsById);
  const letters = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return letters.slice(0, 2) || "C";
};

const splitUnitsByKind = (units: CombatUnitRoll[]) => {
  const forces: CombatUnitRoll[] = [];
  const champions: CombatUnitRoll[] = [];
  units.forEach((unit) => {
    if (unit.kind === "champion") {
      champions.push(unit);
    } else {
      forces.push(unit);
    }
  });
  return { forces, champions };
};

export const CombatOverlay = ({
  sequence,
  playersById,
  playerFactionsById,
  cardDefsById,
  modifiers,
  hexLabel,
  isCapitalBattle,
  onClose
}: CombatOverlayProps) => {
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [roundStage, setRoundStage] = useState<
    | {
        index: number;
        phase: RoundPhase;
      }
    | null
  >(null);
  const [autoClosePending, setAutoClosePending] = useState(false);
  const rollTimers = useRef<number[]>([]);
  const autoCloseTimer = useRef<number | null>(null);

  const clearRollTimers = () => {
    rollTimers.current.forEach((timer) => window.clearTimeout(timer));
    rollTimers.current = [];
  };

  const clearAutoCloseTimer = () => {
    if (autoCloseTimer.current) {
      window.clearTimeout(autoCloseTimer.current);
    }
    autoCloseTimer.current = null;
  };

  const clearAutoClose = () => {
    clearAutoCloseTimer();
    setAutoClosePending(false);
  };

  useEffect(() => {
    clearRollTimers();
    clearAutoClose();
    setRevealedRounds(0);
    setRoundStage(null);
  }, [sequence.id]);

  useEffect(() => {
    return () => {
      clearRollTimers();
      clearAutoCloseTimer();
    };
  }, []);

  useEffect(() => {
    const isResolved =
      revealedRounds >= sequence.rounds.length && roundStage === null;
    clearAutoClose();
    if (!isResolved || sequence.rounds.length === 0) {
      return;
    }
    setAutoClosePending(true);
    autoCloseTimer.current = window.setTimeout(() => {
      setAutoClosePending(false);
      onClose();
    }, AUTO_CLOSE_MS);
    return () => {
      clearAutoCloseTimer();
    };
  }, [onClose, revealedRounds, roundStage, sequence.rounds.length]);

  const { attackersBounty, defendersBounty } = useMemo(
    () => buildBountyTotals(sequence.rounds, cardDefsById),
    [sequence.rounds, cardDefsById]
  );

  const activeModifiers = useMemo(() => {
    if (!modifiers) {
      return [];
    }
    return modifiers.filter(
      (modifier) => modifier.attachedHex === sequence.start.hexKey
    );
  }, [modifiers, sequence.start.hexKey]);

  const handleRoll = () => {
    if (roundStage) {
      return;
    }
    if (revealedRounds >= sequence.rounds.length) {
      clearRollTimers();
      clearAutoClose();
      onClose();
      return;
    }
    clearAutoClose();
    const index = revealedRounds;
    setRoundStage({ index, phase: "rolling" });
    clearRollTimers();
    rollTimers.current = [
      window.setTimeout(() => {
        setRoundStage((stage) =>
          stage && stage.index === index
            ? { ...stage, phase: "locked" }
            : stage
        );
      }, ROLL_LOCK_MS),
      window.setTimeout(() => {
        setRoundStage((stage) =>
          stage && stage.index === index
            ? { ...stage, phase: "assigned" }
            : stage
        );
      }, ROLL_ASSIGN_MS),
      window.setTimeout(() => {
        setRoundStage(null);
        setRevealedRounds((value) => value + 1);
      }, ROLL_DONE_MS)
    ];
  };

  const handleSkip = () => {
    clearRollTimers();
    clearAutoClose();
    onClose();
  };

  const isResolving = Boolean(roundStage);
  const canAdvance = revealedRounds < sequence.rounds.length && !isResolving;
  const currentRoundIndex = roundStage
    ? roundStage.index
    : revealedRounds > 0
      ? Math.min(revealedRounds - 1, sequence.rounds.length - 1)
      : null;
  const currentRound =
    currentRoundIndex !== null ? sequence.rounds[currentRoundIndex] : null;
  const isResolved = revealedRounds >= sequence.rounds.length && !roundStage;
  const roundPhase =
    currentRound && roundStage && currentRoundIndex === roundStage.index
      ? roundStage.phase
      : currentRound
        ? "assigned"
        : null;
  const showHits = roundPhase ? roundPhase !== "rolling" : false;
  const showAssignments = roundPhase === "assigned";
  const stageLabel =
    roundPhase === "rolling"
      ? "Rolling"
      : roundPhase === "locked"
        ? "Locked"
        : "Hit assignment";
  const roundBountyAttackers = currentRound
    ? getSummaryBounty(currentRound.hitsToDefenders, cardDefsById)
    : 0;
  const roundBountyDefenders = currentRound
    ? getSummaryBounty(currentRound.hitsToAttackers, cardDefsById)
    : 0;
  const attackersHaveUnits = Boolean(
    currentRound?.attackers.units && currentRound.attackers.units.length > 0
  );
  const defendersHaveUnits = Boolean(
    currentRound?.defenders.units && currentRound.defenders.units.length > 0
  );
  const winnerLabel = sequence.end.winnerPlayerId
    ? formatPlayer(sequence.end.winnerPlayerId, playersById)
    : "No winner";
  const endReason = formatEndReason(sequence.end.reason);
  const displayHexLabel = hexLabel || sequence.start.hexKey;
  const showHexKey = hexLabel && hexLabel !== sequence.start.hexKey;
  const roundCountLabel =
    sequence.rounds.length > 0
      ? `Rounds ${sequence.rounds.length}`
      : "No rounds logged";

  let rollLabel = "Roll dice";
  if (isResolving) {
    rollLabel = roundStage?.phase === "rolling"
      ? "Rolling..."
      : roundStage?.phase === "locked"
        ? "Locking..."
        : "Assigning...";
  } else if (canAdvance) {
    rollLabel = `Roll round ${revealedRounds + 1}`;
  } else {
    rollLabel = "Close";
  }

  const renderHitSummary = (
    summary: HitAssignmentSummary,
    isVisible: boolean
  ) => {
    if (!isVisible) {
      return <p className="combat-hits__pending">Awaiting assignment...</p>;
    }
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
          const bounty = def?.champion?.bounty ?? 0;
          const isKill = champion.hits >= champion.hp;
          const bountyLabel = isKill && bounty > 0 ? `Bounty ${bounty}g` : null;
          return (
            <li
              key={champion.unitId}
              className={`combat-hits__item${isKill ? " is-kill" : ""}`}
            >
              <span className="combat-hits__name">{name}</span>
              <span className="combat-hits__detail">
                Hits {champion.hits}
              </span>
              <span className="combat-hits__detail">
                HP {champion.hp}/{champion.maxHp}
              </span>
              {isKill ? (
                <span className="combat-hits__detail combat-hits__detail--bounty">
                  {bountyLabel ?? "KO"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderDiceFaces = (
    dice: { value: number; isHit: boolean }[],
    phase: RoundPhase
  ) => {
    return dice.map((roll, dieIndex) => (
      <span
        key={`d-${dieIndex}-${roll.value}`}
        className={`combat-dice__die${phase === "rolling" ? " is-rolling" : ""}${
          roll.isHit && phase !== "rolling" ? " is-hit" : ""
        }`}
      >
        {phase === "rolling" ? "?" : roll.value}
      </span>
    ));
  };

  const renderDiceRack = (
    dice: { value: number; isHit: boolean }[],
    phase: RoundPhase,
    className?: string,
    emptyLabel = "No dice",
    emptyClassName?: string
  ) => {
    if (dice.length === 0) {
      return (
        <span
          className={`combat-dice__empty${emptyClassName ? ` ${emptyClassName}` : ""}`}
        >
          {emptyLabel}
        </span>
      );
    }
    return (
      <div className={`combat-dice${className ? ` ${className}` : ""}`}>
        {renderDiceFaces(dice, phase)}
      </div>
    );
  };

  const renderUnitToken = (unit: CombatUnitRoll, phase: RoundPhase) => {
    const name = getUnitDisplayName(unit, cardDefsById);
    const glyph = getUnitGlyph(unit, cardDefsById);
    const hpLabel =
      unit.kind === "champion" && unit.hp !== undefined && unit.maxHp !== undefined
        ? `HP ${unit.hp}/${unit.maxHp}`
        : "HP ?";
    const title = unit.kind === "champion" ? `${name} (${hpLabel})` : name;
    return (
      <div key={unit.unitId} className={`combat-unit combat-unit--${unit.kind}`}>
        <div className="combat-unit__token" title={title}>
          <span className="combat-unit__glyph">{glyph}</span>
        </div>
        {unit.kind === "champion" ? (
          <span className="combat-unit__hp">{hpLabel}</span>
        ) : null}
        <div className="combat-unit__dice">
          {renderDiceRack(
            unit.dice,
            phase,
            "combat-dice--mini",
            "0",
            "combat-dice__empty--mini"
          )}
        </div>
      </div>
    );
  };

  const renderUnitGroup = (
    label: string,
    units: CombatUnitRoll[],
    phase: RoundPhase
  ) => {
    if (units.length === 0) {
      return (
        <div className="combat-unit-group">
          <span className="combat-unit-group__label">{label}</span>
          <span className="combat-unit-group__empty">None</span>
        </div>
      );
    }
    return (
      <div className="combat-unit-group">
        <span className="combat-unit-group__label">{label}</span>
        <div className="combat-unit-group__list">
          {units.map((unit) => renderUnitToken(unit, phase))}
        </div>
      </div>
    );
  };

  const renderUnitBreakdown = (
    units: CombatUnitRoll[] | undefined,
    phase: RoundPhase
  ) => {
    if (!units || units.length === 0) {
      return (
        <span className="combat-units__empty">Unit details unavailable.</span>
      );
    }
    const { forces, champions } = splitUnitsByKind(units);
    return (
      <div className="combat-units">
        {renderUnitGroup("Forces", forces, phase)}
        {renderUnitGroup("Champions", champions, phase)}
      </div>
    );
  };

  const renderSideSummary = (
    label: string,
    sideStart: CombatSideSummary,
    sideEnd: CombatSideSummary,
    bounty: number
  ) => {
    const playerName = formatPlayer(sideStart.playerId, playersById);
    const factionId = playerFactionsById?.get(sideStart.playerId) ?? null;
    const startTotal = getTotal(sideStart);
    const endTotal = getTotal(sideEnd);
    return (
      <div className="combat-summary__side">
        <div className="combat-summary__header">
          <span className="combat-summary__role">{label}</span>
          <div className="combat-summary__player">
            <FactionSymbol
              factionId={factionId}
              className="faction-symbol--mini"
            />
            <strong className="combat-summary__name">{playerName}</strong>
          </div>
        </div>
        <div className="combat-summary__stats">
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Forces</span>
            <span className="combat-summary__value">{sideStart.forces}</span>
            <span className="combat-summary__delta">-&gt; {sideEnd.forces}</span>
          </div>
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Champions</span>
            <span className="combat-summary__value">{sideStart.champions}</span>
            <span className="combat-summary__delta">-&gt; {sideEnd.champions}</span>
          </div>
          <div className="combat-summary__stat">
            <span className="combat-summary__label">Total</span>
            <span className="combat-summary__value">{startTotal}</span>
            <span className="combat-summary__delta">-&gt; {endTotal}</span>
          </div>
        </div>
        <div className="combat-summary__bounty">Bounty earned: {bounty}g</div>
      </div>
    );
  };

  return (
    <section className="combat-overlay" role="dialog" aria-live="polite" aria-modal="true">
      <div className="combat-overlay__scrim" />
      <div className="combat-overlay__panel">
        <header className="combat-overlay__header">
          <div className="combat-overlay__heading">
            <p className="combat-overlay__eyebrow">
              {isCapitalBattle ? "Capital siege" : "Battle at"}
            </p>
            <h2 className="combat-overlay__title">{displayHexLabel}</h2>
            <div className="combat-overlay__meta">
              <span className="combat-overlay__badge">{roundCountLabel}</span>
              {showHexKey ? (
                <span className="combat-overlay__badge">
                  {sequence.start.hexKey}
                </span>
              ) : null}
              {isCapitalBattle ? (
                <span className="combat-overlay__badge combat-overlay__badge--alert">
                  Capital battle
                </span>
              ) : null}
            </div>
          </div>
          <div className="combat-overlay__actions">
            <button
              type="button"
              className="btn btn-tertiary"
              disabled
              title="Retreat selection coming soon"
            >
              Retreat (1 mana)
            </button>
            <button type="button" className="btn btn-tertiary" onClick={handleSkip}>
              Skip
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRoll}
              disabled={isResolving}
            >
              {rollLabel}
            </button>
          </div>
        </header>

        <div className="combat-summary">
          {renderSideSummary(
            "Attackers",
            sequence.start.attackers,
            sequence.end.attackers,
            attackersBounty
          )}
          {renderSideSummary(
            "Defenders",
            sequence.start.defenders,
            sequence.end.defenders,
            defendersBounty
          )}
        </div>

        <div className="combat-overlay__modifiers">
          <span className="combat-overlay__label">Active effects</span>
          <div className="combat-modifiers">
            {activeModifiers.length === 0 ? (
              <span className="combat-modifiers__empty">No active effects logged.</span>
            ) : (
              activeModifiers.map((modifier) => {
                const label = formatModifierLabel(modifier, cardDefsById);
                const owner = modifier.ownerPlayerId
                  ? formatPlayer(modifier.ownerPlayerId, playersById)
                  : null;
                return (
                  <span
                    key={modifier.id}
                    className="combat-modifier"
                    title={owner ? `${label} (${owner})` : label}
                  >
                    {label}
                  </span>
                );
              })
            )}
          </div>
        </div>

        <div className="combat-overlay__rounds">
          {!currentRound ? (
            <p className="combat-overlay__hint">Click roll to reveal dice.</p>
          ) : (
            <div
              key={`round-${currentRound.round}`}
              className={`combat-round combat-round--${roundPhase ?? "assigned"}`}
            >
              <div className="combat-round__header">
                <div>
                  <strong>Round {currentRound.round}</strong>
                  <span className="combat-round__stage">{stageLabel}</span>
                </div>
                <span className="combat-round__meta">{currentRound.hexKey}</span>
              </div>
              <div className="combat-round__sides">
                <div className="combat-round__side">
                  <div className="combat-round__side-header">
                    <span className="combat-round__side-role">Attackers</span>
                    <span className="combat-round__side-name">
                      <FactionSymbol
                        factionId={playerFactionsById?.get(
                          currentRound.attackers.playerId
                        )}
                        className="faction-symbol--mini"
                      />
                      {formatPlayer(currentRound.attackers.playerId, playersById)}
                    </span>
                  </div>
                  {attackersHaveUnits
                    ? renderUnitBreakdown(
                        currentRound.attackers.units,
                        roundPhase ?? "assigned"
                      )
                    : renderDiceRack(currentRound.attackers.dice, roundPhase ?? "assigned")}
                  <div className="combat-round__stats">
                    <span className="combat-round__stat">
                      Dice {currentRound.attackers.dice.length}
                    </span>
                    {showHits ? (
                      <span className="combat-round__stat combat-round__stat--hits">
                        Hits {currentRound.attackers.hits}
                      </span>
                    ) : (
                      <span className="combat-round__stat">Rolling...</span>
                    )}
                  </div>
                </div>
                <div className="combat-round__side">
                  <div className="combat-round__side-header">
                    <span className="combat-round__side-role">Defenders</span>
                    <span className="combat-round__side-name">
                      <FactionSymbol
                        factionId={playerFactionsById?.get(
                          currentRound.defenders.playerId
                        )}
                        className="faction-symbol--mini"
                      />
                      {formatPlayer(currentRound.defenders.playerId, playersById)}
                    </span>
                  </div>
                  {defendersHaveUnits
                    ? renderUnitBreakdown(
                        currentRound.defenders.units,
                        roundPhase ?? "assigned"
                      )
                    : renderDiceRack(currentRound.defenders.dice, roundPhase ?? "assigned")}
                  <div className="combat-round__stats">
                    <span className="combat-round__stat">
                      Dice {currentRound.defenders.dice.length}
                    </span>
                    {showHits ? (
                      <span className="combat-round__stat combat-round__stat--hits">
                        Hits {currentRound.defenders.hits}
                      </span>
                    ) : (
                      <span className="combat-round__stat">Rolling...</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="combat-round__assignments">
                <div className="combat-round__assign">
                  <span className="combat-round__label">Hits to defenders</span>
                  {renderHitSummary(currentRound.hitsToDefenders, showAssignments)}
                  {showAssignments && roundBountyAttackers > 0 ? (
                    <span className="combat-round__bounty">
                      Bounty +{roundBountyAttackers}g
                    </span>
                  ) : null}
                </div>
                <div className="combat-round__assign">
                  <span className="combat-round__label">Hits to attackers</span>
                  {renderHitSummary(currentRound.hitsToAttackers, showAssignments)}
                  {showAssignments && roundBountyDefenders > 0 ? (
                    <span className="combat-round__bounty">
                      Bounty +{roundBountyDefenders}g
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {isResolved ? (
          <div className="combat-overlay__outcome">
            <div className="combat-outcome__result">
              <span className="combat-outcome__label">Outcome</span>
              <strong className="combat-outcome__winner">{winnerLabel}</strong>
              {endReason ? (
                <span className="combat-outcome__reason">{endReason}</span>
              ) : null}
            </div>
            <div className="combat-outcome__bounties">
              <span>Attackers bounty: {attackersBounty}g</span>
              <span>Defenders bounty: {defendersBounty}g</span>
            </div>
            {autoClosePending ? (
              <div className="combat-outcome__auto">Auto-closing...</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};

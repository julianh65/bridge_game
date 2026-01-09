import { useEffect, useMemo, useRef, useState } from "react";

import type { CardDef, GameConfig, ModifierView } from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";
import { getCardArtUrl } from "../lib/card-art";
import type {
  CombatSequence,
  CombatSideSummary,
  CombatUnitRoll,
  HitAssignmentSummary
} from "../lib/combat-log";
import type { CombatSyncState } from "../lib/room-client";

type RoundPhase = "waiting" | "rolling" | "locked" | "assigned";

type CombatTiming = {
  rollLockMs: number;
  rollAssignMs: number;
  rollDoneMs: number;
  autoCloseMs: number;
};

type CombatOverlayProps = {
  sequence: CombatSequence;
  playersById: Map<string, string>;
  playerFactionsById?: Map<string, string | null>;
  cardDefsById: Map<string, CardDef>;
  modifiers?: ModifierView[];
  hexLabel?: string | null;
  isCapitalBattle?: boolean;
  viewerId?: string | null;
  combatSync?: CombatSyncState | null;
  serverTimeOffset?: number | null;
  config?: GameConfig | null;
  onRequestRoll?: (roundIndex: number) => void;
  onClose: () => void;
};

const DEFAULT_COMBAT_TIMING: CombatTiming = {
  rollLockMs: 650,
  rollAssignMs: 1300,
  rollDoneMs: 1900,
  autoCloseMs: 2200
};

const readTimingValue = (value: number | null | undefined, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
};

const getCombatTiming = (config?: GameConfig | null): CombatTiming => {
  const lockMs = readTimingValue(
    config?.COMBAT_ROLL_LOCK_MS,
    DEFAULT_COMBAT_TIMING.rollLockMs
  );
  const assignMs = Math.max(
    lockMs,
    readTimingValue(
      config?.COMBAT_ROLL_ASSIGN_MS,
      DEFAULT_COMBAT_TIMING.rollAssignMs
    )
  );
  const doneMs = Math.max(
    assignMs,
    readTimingValue(
      config?.COMBAT_ROLL_DONE_MS,
      DEFAULT_COMBAT_TIMING.rollDoneMs
    )
  );
  const autoCloseMs = Math.max(
    doneMs,
    readTimingValue(
      config?.COMBAT_AUTO_CLOSE_MS,
      DEFAULT_COMBAT_TIMING.autoCloseMs
    )
  );
  return {
    rollLockMs: lockMs,
    rollAssignMs: assignMs,
    rollDoneMs: doneMs,
    autoCloseMs
  };
};

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

const getNameGlyph = (name: string) => {
  const letters = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return letters.slice(0, 2) || "C";
};

const getUnitGlyph = (unit: CombatUnitRoll, cardDefsById: Map<string, CardDef>) => {
  if (unit.kind === "force") {
    return "F";
  }
  const name = getUnitDisplayName(unit, cardDefsById);
  return getNameGlyph(name);
};

const formatHitFacesLabel = (hitFaces: number) => {
  if (!Number.isFinite(hitFaces)) {
    return "Hit: --";
  }
  const capped = Math.max(0, Math.min(6, Math.floor(hitFaces)));
  if (capped <= 0) {
    return "Hit: --";
  }
  if (capped === 1) {
    return "Hit: 1";
  }
  if (capped >= 6) {
    return "Hit: 1-6";
  }
  return `Hit: 1-${capped}`;
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
  viewerId,
  combatSync,
  serverTimeOffset,
  config,
  onRequestRoll,
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
  const [syncTick, setSyncTick] = useState(0);
  const rollTimers = useRef<number[]>([]);
  const autoCloseTimer = useRef<number | null>(null);
  const { rollLockMs, rollAssignMs, rollDoneMs, autoCloseMs } = useMemo(
    () => getCombatTiming(config),
    [config]
  );

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
    if (!combatSync || combatSync.sequenceId !== sequence.id || !combatSync.phaseStartAt) {
      return undefined;
    }
    let timer: number | null = null;
    const tick = () => {
      setSyncTick((value) => value + 1);
      const elapsed = Date.now() - combatSync.phaseStartAt;
      if (elapsed < rollDoneMs + 120) {
        timer = window.setTimeout(tick, 120);
      }
    };
    tick();
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [combatSync, sequence.id, rollDoneMs]);

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
    if (combatSync && combatSync.sequenceId === sequence.id) {
      if (isResolved) {
        clearRollTimers();
        clearAutoClose();
        onClose();
        return;
      }
      if (onRequestRoll) {
        onRequestRoll(combatSync.roundIndex);
      }
      return;
    }
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
      }, rollLockMs),
      window.setTimeout(() => {
        setRoundStage((stage) =>
          stage && stage.index === index
            ? { ...stage, phase: "assigned" }
            : stage
        );
      }, rollAssignMs),
      window.setTimeout(() => {
        setRoundStage(null);
        setRevealedRounds((value) => value + 1);
      }, rollDoneMs)
    ];
  };

  const syncNow = useMemo(() => {
    if (typeof serverTimeOffset === "number") {
      return Date.now() + serverTimeOffset;
    }
    return Date.now();
  }, [serverTimeOffset, syncTick]);
  const hasSync = Boolean(combatSync && combatSync.sequenceId === sequence.id);
  const syncInfo = hasSync ? combatSync : null;
  const syncStage = syncInfo?.stage ?? "idle";
  const maxRoundIndex = sequence.rounds.length - 1;
  const syncRoundIndexRaw = syncInfo ? syncInfo.roundIndex : null;
  const syncRoundIndex =
    syncInfo && maxRoundIndex >= 0
      ? Math.min(syncRoundIndexRaw ?? 0, maxRoundIndex)
      : null;
  const syncElapsed =
    syncInfo && syncStage === "rolling" && syncInfo.phaseStartAt !== null
      ? Math.max(0, syncNow - syncInfo.phaseStartAt)
      : null;
  const syncPhase =
    syncStage !== "rolling" || syncElapsed === null
      ? syncStage === "assigned"
        ? "assigned"
        : null
      : syncElapsed < rollLockMs
        ? "rolling"
        : "locked";
  const syncRollDone =
    syncStage === "rolling" && syncElapsed !== null && syncElapsed >= rollDoneMs;
  const isResolving = hasSync
    ? syncStage === "rolling" && !syncRollDone
    : Boolean(roundStage);
  const canAdvance = hasSync
    ? Boolean(syncInfo && syncInfo.roundIndex <= sequence.rounds.length) && !isResolving
    : revealedRounds < sequence.rounds.length && !isResolving;
  const currentRoundIndex = hasSync
    ? syncRoundIndex
    : roundStage
      ? roundStage.index
      : revealedRounds > 0
        ? Math.min(revealedRounds - 1, sequence.rounds.length - 1)
        : null;
  const currentRound =
    currentRoundIndex !== null ? sequence.rounds[currentRoundIndex] : null;
  const isResolved = hasSync
    ? Boolean(
        syncStage === "idle" &&
          syncRoundIndexRaw !== null &&
          syncRoundIndexRaw >= sequence.rounds.length
      )
    : revealedRounds >= sequence.rounds.length && !roundStage;
  const roundPhase = hasSync
    ? syncPhase ?? (currentRound ? "waiting" : null)
    : currentRound && roundStage && currentRoundIndex === roundStage.index
      ? roundStage.phase
      : currentRound
        ? "assigned"
        : null;

  useEffect(() => {
    clearAutoClose();
    if (!isResolved || sequence.rounds.length === 0) {
      return;
    }
    setAutoClosePending(true);
    autoCloseTimer.current = window.setTimeout(() => {
      setAutoClosePending(false);
      onClose();
    }, autoCloseMs);
    return () => {
      clearAutoCloseTimer();
    };
  }, [autoCloseMs, onClose, isResolved, sequence.rounds.length]);
  const showHits = roundPhase === "locked" || roundPhase === "assigned";
  const showHitMarkers = roundPhase === "assigned";
  const stageLabel = hasSync
    ? syncStage === "idle"
      ? "Awaiting rolls"
      : syncStage === "rolling"
        ? syncRollDone
          ? "Awaiting hit assignment"
          : syncPhase === "rolling"
            ? "Rolling"
            : "Locked"
        : "Hit assignment"
    : roundPhase === "waiting"
      ? "Awaiting rolls"
      : roundPhase === "rolling"
        ? "Rolling"
        : roundPhase === "locked"
          ? "Locked"
          : "Hit assignment";
  const pendingHitsLabel = hasSync
    ? syncStage === "idle"
      ? "Awaiting roll"
      : syncStage === "rolling"
        ? syncRollDone
          ? "Awaiting assignment"
          : "Rolling..."
        : "Assigning..."
    : roundPhase === "waiting"
      ? "Awaiting roll"
      : "Rolling...";
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

  const syncParticipants = syncInfo?.playerIds ?? [];
  const isLocalParticipant = Boolean(viewerId && syncParticipants.includes(viewerId));
  const rawLocalReady = Boolean(
    viewerId && syncInfo?.readyByPlayerId && syncInfo.readyByPlayerId[viewerId]
  );
  const localReady = rawLocalReady;
  const canRequestRoll =
    Boolean(syncInfo) &&
    isLocalParticipant &&
    !localReady &&
    !isResolved &&
    (syncStage === "idle"
      ? syncInfo.roundIndex < sequence.rounds.length
      : syncStage === "rolling"
        ? syncRollDone
        : syncStage === "assigned");

  let rollLabel = "Roll dice";
  let rollDisabled = false;
  if (hasSync) {
    if (isResolved) {
      rollLabel = "Close";
      rollDisabled = false;
    } else if (!isLocalParticipant) {
      rollLabel = "Spectating";
      rollDisabled = true;
    } else if (localReady) {
      rollLabel = "Waiting for opponent";
      rollDisabled = true;
    } else if (syncStage === "rolling" && !syncRollDone) {
      rollLabel = syncPhase === "rolling" ? "Rolling..." : "Locking...";
      rollDisabled = true;
    } else if (syncStage === "rolling" && syncRollDone) {
      rollLabel = "Assign hits";
      rollDisabled = !canRequestRoll;
    } else if (syncStage === "assigned") {
      rollLabel = "Resolve hits";
      rollDisabled = !canRequestRoll;
    } else if (syncInfo) {
      rollLabel = `Roll round ${syncInfo.roundIndex + 1}`;
      rollDisabled = !canRequestRoll;
    }
  } else if (isResolving) {
    rollLabel =
      roundStage?.phase === "rolling"
        ? "Rolling..."
        : roundStage?.phase === "locked"
          ? "Locking..."
          : "Assigning...";
  } else if (canAdvance) {
    rollLabel = `Roll round ${revealedRounds + 1}`;
  } else {
    rollLabel = "Close";
  }


  const renderDiceFaces = (
    dice: { value: number; isHit: boolean }[],
    phase: RoundPhase
  ) => {
    return dice.map((roll, dieIndex) => (
      <span
        key={`d-${dieIndex}-${roll.value}`}
        className={`combat-dice__die${phase === "rolling" ? " is-rolling" : ""}${
          roll.isHit && phase !== "rolling" && phase !== "waiting" ? " is-hit" : ""
        }`}
      >
        {phase === "rolling" || phase === "waiting" ? "?" : roll.value}
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

  const renderUnitToken = (
    unit: CombatUnitRoll,
    phase: RoundPhase,
    hitCount: number,
    showMarkers: boolean
  ) => {
    const name = getUnitDisplayName(unit, cardDefsById);
    const glyph = getUnitGlyph(unit, cardDefsById);
    const showHit = showMarkers && hitCount > 0;
    const championArtUrl =
      unit.kind === "champion" ? getCardArtUrl(unit.cardDefId) : null;
    const championArtStyle =
      unit.kind === "champion" && championArtUrl
        ? {
            backgroundImage: `linear-gradient(180deg, rgba(24, 16, 10, 0.35), rgba(24, 16, 10, 0.85)), url("${championArtUrl}")`
          }
        : undefined;
    const displayGlyph = showHit && unit.kind === "force" ? "X" : glyph;
    const hpLabel =
      unit.kind === "champion" && unit.hp !== undefined && unit.maxHp !== undefined
        ? `HP ${unit.hp}/${unit.maxHp}`
        : "HP ?";
    const title = unit.kind === "champion" ? `${name} (${hpLabel})` : name;
    const hitLabel = formatHitFacesLabel(unit.hitFaces);
    return (
      <div key={unit.unitId} className={`combat-unit combat-unit--${unit.kind}`}>
        <div className={`combat-unit__token${showHit ? " is-hit" : ""}`} title={title}>
          {championArtStyle ? (
            <span className="combat-unit__art" style={championArtStyle} aria-hidden="true" />
          ) : null}
          <span className="combat-unit__glyph">{displayGlyph}</span>
          {showHit && unit.kind === "champion" ? (
            <span className="combat-unit__hit-marker">
              {`x${hitCount}`}
            </span>
          ) : null}
        </div>
        {unit.kind === "champion" ? (
          <span className="combat-unit__hp">{hpLabel}</span>
        ) : null}
        <span className="combat-unit__hit">{hitLabel}</span>
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
    phase: RoundPhase,
    hitCounts: Map<string, number>,
    showMarkers: boolean
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
          {units.map((unit) =>
            renderUnitToken(
              unit,
              phase,
              hitCounts.get(unit.unitId) ?? 0,
              showMarkers
            )
          )}
        </div>
      </div>
    );
  };

  const renderUnitBreakdown = (
    units: CombatUnitRoll[] | undefined,
    phase: RoundPhase,
    hits: HitAssignmentSummary,
    showMarkers: boolean
  ) => {
    if (!units || units.length === 0) {
      return (
        <span className="combat-units__empty">Unit details unavailable.</span>
      );
    }
    const { forces, champions } = splitUnitsByKind(units);
    const forceHits = Math.max(0, hits.forces);
    const championHits = new Map(
      hits.champions.map((champion) => [champion.unitId, champion.hits])
    );
    const forceHitCounts = new Map<string, number>();
    forces.forEach((unit, index) => {
      if (index < forceHits) {
        forceHitCounts.set(unit.unitId, 1);
      }
    });
    return (
      <div className="combat-units">
        {renderUnitGroup("Forces", forces, phase, forceHitCounts, showMarkers)}
        {renderUnitGroup("Champions", champions, phase, championHits, showMarkers)}
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

  const renderReadyPill = (playerId: string) => {
    if (!syncInfo) {
      return null;
    }
    const ready = Boolean(syncInfo.readyByPlayerId[playerId]);
    if (syncStage === "rolling" && !syncRollDone) {
      return <span className="combat-ready combat-ready--ready">Rolling</span>;
    }
    const label = ready
      ? syncStage === "idle"
        ? "Rolled"
        : "Ready"
      : "Waiting";
    return (
      <span className={`combat-ready${ready ? " combat-ready--ready" : ""}`}>
        {label}
      </span>
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
              className="btn btn-primary"
              onClick={handleRoll}
              disabled={hasSync ? rollDisabled : isResolving}
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
              {showHits ? (
                <div className="combat-round__totals">
                  <div className="combat-round__total">
                    <span className="combat-round__total-label">Attackers hits</span>
                    <strong className="combat-round__total-value">
                      {currentRound.attackers.hits}
                    </strong>
                  </div>
                  <div className="combat-round__total">
                    <span className="combat-round__total-label">Defenders hits</span>
                    <strong className="combat-round__total-value">
                      {currentRound.defenders.hits}
                    </strong>
                  </div>
                </div>
              ) : null}
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
                  {renderReadyPill(currentRound.attackers.playerId)}
                </div>
                  {attackersHaveUnits
                    ? renderUnitBreakdown(
                        currentRound.attackers.units,
                        roundPhase ?? "assigned",
                        currentRound.hitsToAttackers,
                        showHitMarkers
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
                      <span className="combat-round__stat">{pendingHitsLabel}</span>
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
                  {renderReadyPill(currentRound.defenders.playerId)}
                </div>
                  {defendersHaveUnits
                    ? renderUnitBreakdown(
                        currentRound.defenders.units,
                        roundPhase ?? "assigned",
                        currentRound.hitsToDefenders,
                        showHitMarkers
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
                      <span className="combat-round__stat">{pendingHitsLabel}</span>
                    )}
                  </div>
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

import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";

import { CARD_DEFS, type Bid, type GameView, type MarketState } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";
import { FactionSymbol } from "./FactionSymbol";
import { GameCard } from "./GameCard";
import { NumberRoll } from "./NumberRoll";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type MarketWinnerHighlight = {
  cardId: string;
  cardIndex: number | null;
  playerId: string | null;
  playerName: string;
  kind: "buy" | "pass";
  amount: number | null;
  passPot: number | null;
  rollOff: Array<Record<string, number>> | null;
  rollOffKey: number;
};

type MarketPanelProps = {
  market: MarketState;
  players: GameView["public"]["players"];
  phase: GameView["public"]["phase"];
  player: GameView["public"]["players"][number] | null;
  status: RoomConnectionStatus;
  onSubmitBid: (bid: Bid) => void;
  onSubmitRollOff?: () => void;
  winnerHighlight?: MarketWinnerHighlight | null;
  winnerHistory?: Record<number, MarketWinnerHighlight> | null;
  rollDurationMs?: number;
  layout?: "sidebar" | "overlay";
  onClose?: () => void;
};

export const MarketPanel = ({
  market,
  players,
  phase,
  player,
  status,
  onSubmitBid,
  onSubmitRollOff,
  winnerHighlight,
  winnerHistory = null,
  rollDurationMs: rollDurationOverride,
  layout = "sidebar",
  onClose
}: MarketPanelProps) => {
  const isOverlay = layout === "overlay";
  const { age, passPot, currentRow, rowIndexResolving } = market;
  const currentCard = currentRow[rowIndexResolving] ?? null;
  const currentCardDef = currentCard ? CARD_DEFS_BY_ID.get(currentCard.cardId) : null;
  const playerId = player?.id ?? null;
  const playerBid = playerId ? market.bids[playerId] : null;
  const isOut = playerId ? market.playersOut[playerId] : false;
  const gold = player?.resources.gold ?? 0;
  const canBid =
    status === "connected" &&
    phase === "round.market" &&
    Boolean(playerId) &&
    Boolean(currentCard) &&
    !isOut &&
    !playerBid;
  const eligiblePlayerIds = players
    .map((entry) => entry.id)
    .filter((id) => !market.playersOut[id]);
  const shouldRevealBidDetails =
    phase !== "round.market" ||
    !currentCard ||
    eligiblePlayerIds.every((id) => market.bids[id]);
  const playerSeatIndexById = useMemo(
    () => new Map(players.map((entry) => [entry.id, entry.seatIndex])),
    [players]
  );
  const playerFactionById = useMemo(
    () => new Map(players.map((entry) => [entry.id, entry.factionId ?? null])),
    [players]
  );
  const [bidAmount, setBidAmount] = useState(0);
  const [showWinner, setShowWinner] = useState(true);
  const activeRollOff = market.rollOff ?? null;
  const isRollOffActive = Boolean(activeRollOff);
  const rollOffKey = activeRollOff?.key ?? winnerHighlight?.rollOffKey ?? 0;
  const bidEntries = players.map((player) => {
    const bid = market.bids[player.id];
    const isOut = market.playersOut[player.id];
    let status = "Waiting";
    if (isOut) {
      status = "Out";
    } else if (bid) {
      status = shouldRevealBidDetails
        ? bid.kind === "buy"
          ? `Buy ${bid.amount}`
          : "Pass"
        : "Submitted";
    }
    return { id: player.id, name: player.name, status };
  });

  useEffect(() => {
    setBidAmount(0);
  }, [rowIndexResolving, phase, playerId]);

  useEffect(() => {
    setBidAmount((value) => Math.min(value, gold));
  }, [gold]);

  const clampBid = (value: number) => Math.max(0, Math.min(gold, Math.floor(value)));
  const quickBidAmounts = [1, 2, 3, 4];

  const handleBidChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) {
      return;
    }
    setBidAmount(clampBid(nextValue));
  };

  const handleQuickBid = (amount: number) => {
    setBidAmount(clampBid(amount));
  };

  const handleSubmit = (kind: Bid["kind"]) => {
    const amount = clampBid(bidAmount);
    if (kind === "buy" && amount < 1) {
      return;
    }
    onSubmitBid({ kind, amount });
  };

  const bidStatusLabel = playerBid
    ? playerBid.kind === "buy"
      ? `Buy ${playerBid.amount}`
      : `Pass ${playerBid.amount}`
    : null;

  const formatWinnerAnnouncement = (winner: MarketWinnerHighlight) => ({
    title: `${winner.playerName} won`,
    detail:
      winner.kind === "buy"
        ? winner.amount !== null
          ? `Bought for ${winner.amount}g`
          : "Bought"
        : winner.passPot && winner.passPot > 0
          ? `Pass pot ${winner.passPot}g`
          : "Won on pass"
  });

  const isWinnerCard = (index: number, cardId: string) => {
    if (!winnerHighlight) {
      return false;
    }
    if (typeof winnerHighlight.cardIndex === "number") {
      return winnerHighlight.cardIndex === index;
    }
    return winnerHighlight.cardId === cardId;
  };

  const cardOrder = currentRow.map((card, index) => {
    const def = CARD_DEFS_BY_ID.get(card.cardId);
    const isHidden = !card.revealed;
    const isActive = index === rowIndexResolving;
    const isResolved = index < rowIndexResolving;
    const label = isHidden ? "Face down" : def?.name ?? card.cardId;
    const isHighlight = Boolean(winnerHighlight) && isWinnerCard(index, card.cardId);
    const historyWinner =
      winnerHistory && Object.prototype.hasOwnProperty.call(winnerHistory, index)
        ? winnerHistory[index]
        : null;
    const winnerInfo = isHighlight ? (showWinner ? winnerHighlight : null) : historyWinner;
    const isWinner = Boolean(winnerInfo);
    return {
      card,
      def,
      index,
      isHidden,
      isActive,
      isResolved,
      isWinner,
      label,
      winnerInfo
    };
  });
  const showOrderRail = isOverlay && currentRow.length > 0;
  const rollDurationMs = Math.max(0, rollDurationOverride ?? 1000);
  const rollDelayBaseMs = 120;
  const rollRoundGapMs = 260;
  const rollGapMs = 0;
  const rollOffRounds = useMemo(() => {
    const playerNameById = new Map(players.map((entry) => [entry.id, entry.name]));
    const buildRolls = (round: Record<string, number | null>) => {
      const rolls: Array<{ playerId: string; name: string; value: number | null }> = [];
      const seen = new Set<string>();
      for (const player of players) {
        const value = round[player.id];
        if (typeof value === "number" || value === null) {
          rolls.push({ playerId: player.id, name: player.name, value });
          seen.add(player.id);
        }
      }
      for (const [playerId, value] of Object.entries(round)) {
        if (seen.has(playerId) || (typeof value !== "number" && value !== null)) {
          continue;
        }
        rolls.push({
          playerId,
          name: playerNameById.get(playerId) ?? playerId,
          value
        });
      }
      return rolls;
    };

    if (activeRollOff) {
      const rounds = activeRollOff.rounds.map((round, roundIndex) => ({
        roundIndex,
        rolls: buildRolls(round),
        isPending: false
      }));
      const currentRolls = activeRollOff.currentRolls ?? {};
      if (Object.keys(currentRolls).length > 0) {
        rounds.push({
          roundIndex: rounds.length,
          rolls: buildRolls(currentRolls),
          isPending: true
        });
      }
      return rounds.filter((round) => round.rolls.length > 0);
    }

    const rollOff = winnerHighlight?.rollOff;
    if (!rollOff || rollOff.length === 0) {
      return [];
    }

    return rollOff
      .map((round, roundIndex) => {
        if (!round || typeof round !== "object") {
          return null;
        }
        const rolls = buildRolls(round);
        return rolls.length > 0 ? { roundIndex, rolls, isPending: false } : null;
      })
      .filter(
        (
          round
        ): round is {
          roundIndex: number;
          rolls: Array<{ playerId: string; name: string; value: number | null }>;
          isPending: boolean;
        } => Boolean(round)
      );
  }, [activeRollOff, players, winnerHighlight?.rollOff]);

  const rollOffSchedule = useMemo(() => {
    if (rollOffRounds.length === 0) {
      return {
        rounds: [] as Array<{
          roundIndex: number;
          rolls: Array<{ playerId: string; name: string; value: number | null }>;
          isPending: boolean;
          startMs: number;
          endMs: number;
          rollDelays: number[];
        }>,
        nextStartMs: rollDelayBaseMs
      };
    }

    if (isRollOffActive) {
      return {
        rounds: rollOffRounds.map((round) => ({
          ...round,
          startMs: 0,
          endMs: 0,
          rollDelays: round.rolls.map(() => 0)
        })),
        nextStartMs: 0
      };
    }

    return rollOffRounds.reduce(
      (schedule, round) => {
        const lastIndex = Math.max(round.rolls.length - 1, 0);
        const rollDelays = round.rolls.map(
          (_roll, index) => schedule.nextStartMs + index * rollGapMs
        );
        const endMs = schedule.nextStartMs + lastIndex * rollGapMs + rollDurationMs;
        schedule.rounds.push({
          ...round,
          startMs: schedule.nextStartMs,
          endMs,
          rollDelays
        });
        schedule.nextStartMs = endMs + rollRoundGapMs;
        return schedule;
      },
      {
        rounds: [] as Array<{
          roundIndex: number;
          rolls: Array<{ playerId: string; name: string; value: number | null }>;
          isPending: boolean;
          startMs: number;
          endMs: number;
          rollDelays: number[];
        }>,
        nextStartMs: rollDelayBaseMs
      }
    );
  }, [
    isRollOffActive,
    rollDelayBaseMs,
    rollDurationMs,
    rollGapMs,
    rollOffRounds,
    rollRoundGapMs
  ]);
  const showRollOff = rollOffSchedule.rounds.length > 0;
  const rollOffDurationMs =
    rollOffSchedule.rounds.length > 0
      ? rollOffSchedule.rounds[rollOffSchedule.rounds.length - 1]?.endMs ?? 0
      : 0;
  const [visibleRollRounds, setVisibleRollRounds] = useState(
    rollOffSchedule.rounds.length
  );

  useEffect(() => {
    if (!winnerHighlight || !showRollOff) {
      setShowWinner(true);
      return;
    }
    setShowWinner(false);
    const timeout = window.setTimeout(() => {
      setShowWinner(true);
    }, rollOffDurationMs + 200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [winnerHighlight?.rollOffKey, rollOffDurationMs, showRollOff]);

  useEffect(() => {
    if (rollOffSchedule.rounds.length === 0 || isRollOffActive) {
      setVisibleRollRounds(rollOffSchedule.rounds.length);
      return;
    }
    if (!winnerHighlight) {
      setVisibleRollRounds(rollOffSchedule.rounds.length);
      return;
    }

    setVisibleRollRounds(1);
    const timeouts = rollOffSchedule.rounds.slice(1).map((round, index) =>
      window.setTimeout(() => {
        setVisibleRollRounds(index + 2);
      }, round.startMs)
    );

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [isRollOffActive, rollOffSchedule, winnerHighlight?.rollOffKey]);

  let bidHint = "Enter a bid amount to buy or pass.";
  if (status !== "connected") {
    bidHint = "Connect to submit bids.";
  } else if (!playerId) {
    bidHint = "Spectators cannot bid.";
  } else if (phase !== "round.market") {
    bidHint = "Bids are accepted during the market phase.";
  } else if (!currentCard) {
    bidHint = "No market card is available to bid on.";
  } else if (isOut) {
    bidHint = "You are out for this market round.";
  } else if (bidStatusLabel) {
    bidHint = `Bid submitted: ${bidStatusLabel}.`;
  }

  const rowProgressLabel =
    currentRow.length > 0
      ? `Card ${rowIndexResolving + 1} of ${currentRow.length}`
      : "No market cards revealed.";
  const rollOffRoundsToShow = rollOffSchedule.rounds.slice(0, visibleRollRounds);
  const playerSwatchStyle = (seatIndex: number | undefined): CSSProperties | undefined => {
    if (typeof seatIndex !== "number") {
      return undefined;
    }
    const index = Math.max(0, Math.min(5, Math.floor(seatIndex)));
    return {
      "--player-color": `var(--player-color-${index})`
    } as CSSProperties;
  };
  const rollOffHint = isRollOffActive
    ? "Waiting for tied players to roll."
    : "Dice roll tiebreaker resolved for this card.";
  const rollOffPanel = showRollOff ? (
    <div className="market-rolloff-panel">
      <div className="market-bid__header">
        <h4>Roll-off</h4>
        <span className="market-pill">Tie-break</span>
      </div>
      <p className="action-panel__hint">{rollOffHint}</p>
      <div className="market-rolloff market-rolloff--center">
        {rollOffRoundsToShow.map((round) => (
          <div
            key={`rolloff-${rollOffKey}-${round.roundIndex}`}
            className="market-rolloff__round"
          >
            <span className="market-rolloff__label">Round {round.roundIndex + 1}</span>
            <div className="market-rolloff__rolls">
              {round.rolls.map((roll, index) => {
                const rollKey = `${rollOffKey}-${round.roundIndex}-${roll.playerId}`;
                const isLocalRoll = roll.playerId === playerId;
                const rollValue = roll.value;
                const hasValue = typeof rollValue === "number";
                const isWinner = roll.playerId === winnerHighlight?.playerId;
                const delayMs = round.rollDelays[index] ?? round.startMs;
                const effectiveDelayMs = round.isPending ? 0 : delayMs;
                const seatIndex = playerSeatIndexById.get(roll.playerId);
                const swatchStyle = playerSwatchStyle(seatIndex);
                const factionId = playerFactionById.get(roll.playerId);
                const seatLabel = typeof seatIndex === "number" ? `P${seatIndex + 1}` : null;
                const canRoll =
                  isRollOffActive &&
                  isLocalRoll &&
                  !hasValue &&
                  status === "connected" &&
                  Boolean(onSubmitRollOff);
                const rollButtonLabel = isLocalRoll ? "Roll" : "Waiting";
                return (
                  <div
                    key={`roll-${roll.playerId}-${round.roundIndex}`}
                    className={`market-rolloff__entry${isWinner ? " is-winner" : ""}`}
                  >
                    <span className="market-rolloff__name">
                      {swatchStyle ? (
                        <span
                          className="player-swatch"
                          style={swatchStyle}
                          aria-hidden="true"
                        />
                      ) : null}
                      <FactionSymbol
                        factionId={factionId}
                        className="faction-symbol--mini"
                      />
                      <span className="market-rolloff__player">{roll.name}</span>
                      {seatLabel ? (
                        <span className="market-rolloff__seat" aria-hidden="true">
                          {seatLabel}
                        </span>
                      ) : null}
                    </span>
                    {hasValue ? (
                      <NumberRoll
                        value={rollValue}
                        sides={6}
                        durationMs={rollDurationMs}
                        delayMs={effectiveDelayMs}
                        rollKey={`${rollKey}-ready`}
                        className="number-roll--lg"
                        label={`${roll.name} roll`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="market-rolloff__roll-button"
                        disabled={!canRoll}
                        onClick={() => {
                          if (canRoll && onSubmitRollOff) {
                            onSubmitRollOff();
                          }
                        }}
                      >
                        {rollButtonLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;
  const rollOffOverlay = rollOffPanel ? (
    <div className="market-rolloff-overlay" aria-live="polite">
      {rollOffPanel}
    </div>
  ) : null;

  return (
    <section className={`market-panel${isOverlay ? " market-panel--overlay" : ""}`}>
      <header className="market-panel__header">
        <div>
          {isOverlay ? <p className="eyebrow">Market Phase</p> : null}
          <h3 className="market-panel__title">Age {age} Market</h3>
          <p className="market-panel__subhead">{rowProgressLabel}</p>
        </div>
        {isOverlay && onClose ? (
          <button type="button" className="btn btn-tertiary" onClick={onClose}>
            Hide Market
          </button>
        ) : null}
      </header>

      <div className="market-panel__summary">
        <span className="market-pill">Age {age}</span>
        <span className="market-pill">Pass pot {passPot}</span>
        {currentRow.length > 0 ? (
          <span className="market-pill">{rowProgressLabel}</span>
        ) : null}
      </div>

      <div className="market-panel__layout">
        <div className="market-panel__cards">
          {currentRow.length === 0 ? (
            <div className="hand-empty">No market cards revealed.</div>
          ) : (
            <>
              {showOrderRail ? (
                <ol className="market-order" aria-label="Market order">
                  {cardOrder.map((entry) => (
                    <li
                      key={`${entry.card.cardId}-${entry.index}`}
                      className={`market-order__step${
                        entry.isResolved ? " is-resolved" : ""
                      }${entry.isActive ? " is-active" : ""}${
                        entry.isWinner ? " is-winner" : ""
                      }`}
                    >
                      <span className="market-order__index">{entry.index + 1}</span>
                      <span className="market-order__label">{entry.label}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className="market-card-grid">
                {cardOrder.map((entry) => {
                  const winnerAnnouncement = entry.winnerInfo
                    ? formatWinnerAnnouncement(entry.winnerInfo)
                    : null;
                  const winnerOverlay = winnerAnnouncement ? (
                    <div className="game-card__winner" role="status" aria-live="polite">
                      <span className="game-card__winner-title">
                        {winnerAnnouncement.title}
                      </span>
                      <span className="game-card__winner-detail">
                        {winnerAnnouncement.detail}
                      </span>
                    </div>
                  ) : null;

                  return (
                    <GameCard
                      key={`${entry.card.cardId}-${entry.index}`}
                      variant="market"
                      card={entry.def ?? null}
                      cardId={entry.card.cardId}
                      displayName={entry.label}
                      isHidden={entry.isHidden}
                      isActive={entry.isActive}
                      isWinner={entry.isWinner}
                      showId={false}
                      showChampionStats
                      overlay={winnerOverlay}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="market-panel__bids">
          <div className="market-bid">
            <div className="market-bid__header">
              <h4>Bid</h4>
              <span className="market-pill">
                <span aria-hidden="true">🟡</span>
                Gold {gold}
              </span>
            </div>
            {phase === "round.market" && currentCard ? (
              <div className="market-bid__current">
                Bidding on {currentCardDef?.name ?? currentCard.cardId}
              </div>
            ) : (
              <div className="market-bid__current">No card available yet.</div>
            )}
            <p className="action-panel__hint">{bidHint}</p>
            {phase === "round.market" && currentCard && canBid ? (
              <div className="action-panel">
                <label className="action-field">
                  <span>Bid amount</span>
                  <div className="action-field__controls">
                    <input
                      type="number"
                      min={0}
                      max={gold}
                      value={bidAmount}
                      onChange={handleBidChange}
                    />
                  </div>
                  <div className="market-bid__quick">
                    {quickBidAmounts.map((amount) => {
                      const isActive = amount === bidAmount;
                      return (
                        <button
                          key={amount}
                          type="button"
                          className={`btn btn-tertiary${isActive ? " is-active" : ""}`}
                          disabled={amount > gold}
                          aria-pressed={isActive}
                          onClick={() => handleQuickBid(amount)}
                        >
                          {amount}
                        </button>
                      );
                    })}
                  </div>
                </label>
                <div className="action-panel__buttons">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={bidAmount < 1}
                    onClick={() => handleSubmit("buy")}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSubmit("pass")}
                  >
                    Pass
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="market-bid market-bid--status">
            <div className="market-bid__header">
              <h4>Bid status</h4>
            </div>
            {bidEntries.length === 0 ? (
              <div className="hand-empty">No players yet.</div>
            ) : (
              <ul className="market-bid__list">
                {bidEntries.map((entry) => (
                  <li key={entry.id} className="market-bid__row">
                    <span>{entry.name}</span>
                    <span className="market-bid__pill">{entry.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        {rollOffOverlay}
      </div>
    </section>
  );
};

import { useEffect, useState, type ChangeEvent } from "react";

import { CARD_DEFS, type Bid, type GameView, type MarketState } from "@bridgefront/engine";

import type { RoomConnectionStatus } from "../lib/room-client";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type MarketPanelProps = {
  market: MarketState;
  players: Array<{ id: string; name: string }>;
  phase: GameView["public"]["phase"];
  player: GameView["public"]["players"][number] | null;
  status: RoomConnectionStatus;
  onSubmitBid: (bid: Bid) => void;
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
  const [bidAmount, setBidAmount] = useState(0);
  const bidEntries = players.map((player) => {
    const bid = market.bids[player.id];
    const isOut = market.playersOut[player.id];
    let status = "Waiting";
    if (isOut) {
      status = "Out";
    } else if (bid) {
      status = bid.kind === "buy" ? `Buy ${bid.amount}` : "Pass";
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
            <div className="market-card-grid">
              {currentRow.map((card, index) => {
                const isHidden = !card.revealed;
                const isActive = index === rowIndexResolving;
                const def = CARD_DEFS_BY_ID.get(card.cardId);
                const label = isHidden ? "Face down" : def?.name ?? card.cardId;
                const manaCost = def?.cost.mana ?? null;
                const goldCost = def?.cost.gold ?? 0;
                const initiative = def?.initiative ?? null;
                const tags = def?.tags ?? [];
                return (
                  <article
                    key={`${card.cardId}-${index}`}
                    className={`market-card${isHidden ? " is-hidden" : ""}${
                      isActive ? " is-active" : ""
                    }`}
                  >
                    <div className="market-card__art">
                      <span>{isHidden ? "Face down" : "Art"}</span>
                    </div>
                    <div className="market-card__header">
                      <span className="market-card__eyebrow">Card {index + 1}</span>
                      <h4>{label}</h4>
                    </div>
                    <div className="market-card__meta">
                      <span className="market-chip">
                        Init {initiative ?? "?"}
                      </span>
                      <span className="market-chip">
                        Mana {manaCost ?? "?"}
                      </span>
                      {goldCost > 0 ? (
                        <span className="market-chip">Gold {goldCost}</span>
                      ) : null}
                      <span className="market-chip">{def?.type ?? "Card"}</span>
                    </div>
                    {isHidden ? (
                      <p className="market-card__rules market-card__rules--hidden">
                        Unrevealed market card.
                      </p>
                    ) : (
                      <p className="market-card__rules">
                        {def?.rulesText ?? "Rules pending."}
                      </p>
                    )}
                    {!isHidden && tags.length > 0 ? (
                      <div className="market-card__tags">
                        {tags.map((tag) => (
                          <span key={`${card.cardId}-${tag}`} className="card-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="market-panel__bids">
          <div className="market-bid">
            <div className="market-bid__header">
              <h4>Bid</h4>
              <span className="market-pill">Gold {gold}</span>
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
      </div>
    </section>
  );
};

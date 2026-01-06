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
};

export const MarketPanel = ({
  market,
  players,
  phase,
  player,
  status,
  onSubmitBid
}: MarketPanelProps) => {
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

  const handleBidChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) {
      return;
    }
    setBidAmount(clampBid(nextValue));
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

  return (
    <div className="sidebar-section">
      <h3>Market</h3>
      <div className="market-summary">
        <div className="resource-row">
          <span>Age</span>
          <strong>{age}</strong>
        </div>
        <div className="resource-row">
          <span>Pass pot</span>
          <strong>{passPot}</strong>
        </div>
      </div>
      {currentRow.length === 0 ? (
        <div className="hand-empty">No market cards revealed.</div>
      ) : (
        <ol className="card-list card-list--market">
          {currentRow.map((card, index) => {
            const classes = ["card-tag"];
            if (!card.revealed) {
              classes.push("card-tag--hidden");
            }
            if (index === rowIndexResolving) {
              classes.push("card-tag--active");
            }
            const def = CARD_DEFS_BY_ID.get(card.cardId);
            const label = card.revealed ? def?.name ?? card.cardId : "Face down";
            return (
              <li
                key={`${card.cardId}-${index}`}
                className={classes.join(" ")}
                title={card.revealed ? card.cardId : "Face down"}
              >
                {label}
              </li>
            );
          })}
        </ol>
      )}
      {phase === "round.market" && currentCard ? (
        <div className="action-panel">
          <div className="hand-meta">
            Bidding on {currentCardDef?.name ?? currentCard.cardId}
          </div>
          <p className="action-panel__hint">{bidHint}</p>
          {canBid ? (
            <>
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
            </>
          ) : null}
        </div>
      ) : null}
      <div className="hand-meta">Bid status</div>
      {bidEntries.length === 0 ? (
        <div className="hand-empty">No players yet.</div>
      ) : (
        <ul className="card-list card-list--market">
          {bidEntries.map((entry) => (
            <li key={entry.id} className="card-tag">
              {entry.name}: {entry.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

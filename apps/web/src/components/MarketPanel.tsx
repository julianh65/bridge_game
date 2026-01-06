import { CARD_DEFS, type MarketState } from "@bridgefront/engine";

const CARD_DEFS_BY_ID = new Map(CARD_DEFS.map((card) => [card.id, card]));

type MarketPanelProps = {
  market: MarketState;
  players: Array<{ id: string; name: string }>;
};

export const MarketPanel = ({ market, players }: MarketPanelProps) => {
  const { age, passPot, currentRow, rowIndexResolving } = market;
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

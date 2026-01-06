import type { MarketState } from "@bridgefront/engine";

type MarketPanelProps = {
  market: MarketState;
};

export const MarketPanel = ({ market }: MarketPanelProps) => {
  const { age, passPot, currentRow, rowIndexResolving } = market;

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
            return (
              <li key={`${card.cardId}-${index}`} className={classes.join(" ")}>
                {card.revealed ? card.cardId : "Face down"}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

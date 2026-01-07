export type ActionRevealOverlayData = {
  playerName: string;
  cardName: string;
  cardId: string;
  cardType: string | null;
  initiative: number | null;
  costLabel: string | null;
  targetLines: string[];
};

type ActionRevealOverlayProps = {
  reveal: ActionRevealOverlayData;
};

export const ActionRevealOverlay = ({ reveal }: ActionRevealOverlayProps) => {
  const metaParts: string[] = [];
  if (reveal.cardType) {
    metaParts.push(reveal.cardType);
  }
  if (reveal.initiative !== null) {
    metaParts.push(`Init ${reveal.initiative}`);
  }
  if (reveal.costLabel) {
    metaParts.push(reveal.costLabel);
  }
  const metaLine = metaParts.join(" · ");

  return (
    <div className="action-reveal" role="status" aria-live="polite">
      <div className="action-reveal__panel">
        <span className="action-reveal__eyebrow">Action revealed</span>
        <div className="action-reveal__player">{reveal.playerName}</div>
        <div className="action-reveal__card">
          <div className="action-reveal__card-header">
            <strong>{reveal.cardName}</strong>
            <span className="action-reveal__card-id">{reveal.cardId}</span>
          </div>
          {metaLine ? <div className="action-reveal__meta">{metaLine}</div> : null}
          {reveal.targetLines.length > 0 ? (
            <ul className="action-reveal__targets">
              {reveal.targetLines.map((line, index) => (
                <li key={`${reveal.cardId}-${index}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="action-reveal__targets action-reveal__targets--empty">
              No target
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

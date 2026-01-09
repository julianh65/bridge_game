import type { CSSProperties } from "react";

import type { CardDef } from "@bridgefront/engine";

import { GameCard } from "./GameCard";

export type ActionRevealOverlayData = {
  playerName: string;
  cardName: string;
  cardId: string;
  cardDef: CardDef | null;
  cardType: string | null;
  initiative: number | null;
  costLabel: string | null;
  targetLines: string[];
};

type ActionRevealOverlayProps = {
  reveal: ActionRevealOverlayData;
  durationMs: number;
};

export const ActionRevealOverlay = ({ reveal, durationMs }: ActionRevealOverlayProps) => {
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
  const revealStyle = {
    ["--action-reveal-duration" as string]: `${durationMs}ms`
  } as CSSProperties;
  const showCardPreview = Boolean(reveal.cardDef);
  const rulesText = reveal.cardDef?.rulesText ?? null;

  return (
    <div className="action-reveal" role="status" aria-live="polite" style={revealStyle}>
      <div className="action-reveal__panel">
        <span className="action-reveal__eyebrow">Action revealed</span>
        <div className="action-reveal__player">{reveal.playerName}</div>
        <div
          className={`action-reveal__content${
            showCardPreview ? " action-reveal__content--with-card" : ""
          }`}
        >
          {showCardPreview ? (
            <div className="action-reveal__preview">
              <GameCard
                card={reveal.cardDef}
                cardId={reveal.cardId}
                variant="hand"
                showRules={false}
                showTags={false}
                showFaction={false}
                showChampionStats={false}
                showStats={true}
              />
            </div>
          ) : null}
          <div className="action-reveal__card">
            <div className="action-reveal__card-header">
              <strong>{reveal.cardName}</strong>
            </div>
            {metaLine ? <div className="action-reveal__meta">{metaLine}</div> : null}
            {rulesText ? <p className="action-reveal__rules">{rulesText}</p> : null}
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
    </div>
  );
};

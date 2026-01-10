import type { CSSProperties } from "react";

import { NumberRoll } from "./NumberRoll";

export type DiceRollOverlayData = {
  key: string;
  playerName: string;
  cardName: string | null;
  roll: number;
  sides: number;
  amount: number | null;
  cardId?: string | null;
  playerId?: string | null;
};

type DiceRollOverlayProps = {
  reveal: DiceRollOverlayData;
  durationMs: number;
  rollDurationMs?: number;
};

export const DiceRollOverlay = ({
  reveal,
  durationMs,
  rollDurationMs
}: DiceRollOverlayProps) => {
  const revealStyle = {
    ["--dice-reveal-duration" as string]: `${durationMs}ms`
  } as CSSProperties;
  const rollLabel = reveal.cardName ?? "Gold roll";
  const amountLabel = reveal.amount !== null ? `+${reveal.amount}g` : null;
  const animationMs =
    typeof rollDurationMs === "number"
      ? Math.max(0, rollDurationMs)
      : Math.max(300, Math.floor(durationMs * 0.6));

  return (
    <div className="dice-reveal" role="status" aria-live="polite" style={revealStyle}>
      <div className="dice-reveal__panel">
        <span className="dice-reveal__eyebrow">Dice roll</span>
        <div className="dice-reveal__player">{reveal.playerName}</div>
        <div className="dice-reveal__content">
          <div className="dice-reveal__roll">
            <NumberRoll
              value={reveal.roll}
              sides={reveal.sides}
              durationMs={animationMs}
              rollKey={reveal.key}
              className="number-roll--lg dice-reveal__die"
              label={`${rollLabel} roll`}
            />
            <span className="dice-reveal__sides">{`d${reveal.sides}`}</span>
          </div>
          <div className="dice-reveal__meta">
            <span className="dice-reveal__card">{rollLabel}</span>
            {amountLabel ? (
              <span className="dice-reveal__gain">{amountLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

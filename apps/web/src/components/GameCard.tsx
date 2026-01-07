import type { CSSProperties, ElementType, ReactNode } from "react";

import type { CardDef } from "@bridgefront/engine";

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const initiativeChipStyle = (initiative: number) => {
  const clamped = clamp(initiative, 0, 250);
  const t = clamped / 250;
  const hue = 140 - 120 * t;
  const saturation = 72;
  const lightness = 46 - 10 * t;
  const backgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
  const borderColor = `hsl(${hue} ${saturation}% ${Math.max(20, lightness - 14)}%)`;
  const color = lightness > 55 ? "#1f1300" : "#fff7e6";

  return { backgroundColor, borderColor, color };
};

export type GameCardVariant = "grid" | "market" | "hand" | "detail" | "offer";

type GameCardProps = {
  card: CardDef | null;
  cardId: string;
  variant?: GameCardVariant;
  as?: ElementType;
  className?: string;
  eyebrow?: string | null;
  displayName?: string | null;
  showId?: boolean;
  showRules?: boolean;
  showTags?: boolean;
  showChampionStats?: boolean;
  showArt?: boolean;
  showStats?: boolean;
  count?: number | null;
  isHidden?: boolean;
  isActive?: boolean;
  isWinner?: boolean;
  overlay?: ReactNode;
  rulesFallback?: string;
  hiddenRules?: string;
  artLabel?: string;
};

export const GameCard = ({
  card,
  cardId,
  variant = "grid",
  as: Component = "article",
  className,
  eyebrow,
  displayName,
  showId = true,
  showRules = true,
  showTags = true,
  showChampionStats = false,
  showArt = true,
  showStats = true,
  count = null,
  isHidden = false,
  isActive = false,
  isWinner = false,
  overlay,
  rulesFallback = "Rules pending.",
  hiddenRules = "Unrevealed market card.",
  artLabel
}: GameCardProps) => {
  const deck = card?.deck ?? "unknown";
  const type = card?.type ?? "unknown";
  const resolvedEyebrow = eyebrow === undefined ? card?.deck ?? null : eyebrow;
  const name = displayName ?? (isHidden ? "Face down" : card?.name ?? cardId);
  const rulesText = isHidden ? hiddenRules : card?.rulesText ?? rulesFallback;
  const showMeta = showStats && !isHidden && Boolean(card);
  const tags = card?.tags ?? [];

  const statChips: Array<{ label: string; style?: CSSProperties }> = [];
  if (typeof count === "number") {
    statChips.push({ label: `x${count}` });
  }
  if (showMeta && card) {
    statChips.push({ label: card.type });
    statChips.push({
      label: `Init ${card.initiative}`,
      style: initiativeChipStyle(card.initiative)
    });
    statChips.push({ label: `Mana ${card.cost.mana}` });
    if (card.cost.gold) {
      statChips.push({ label: `Gold ${card.cost.gold}` });
    }
    if (card.burn) {
      statChips.push({ label: "Burn" });
    }
  }

  const classes = [
    "game-card",
    `game-card--${variant}`,
    isHidden ? "is-hidden" : "",
    isActive ? "is-active" : "",
    isWinner ? "is-winner" : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} data-deck={deck} data-type={type}>
      {overlay}
      {showArt ? (
        <div className="game-card__art">
          <span>{artLabel ?? (isHidden ? "Face down" : "Art")}</span>
        </div>
      ) : null}
      <div className="game-card__header">
        <div>
          {resolvedEyebrow ? <p className="game-card__eyebrow">{resolvedEyebrow}</p> : null}
          <h3 className="game-card__name">{name}</h3>
          {showId && !isHidden ? <p className="game-card__id">{cardId}</p> : null}
        </div>
        {statChips.length > 0 ? (
          <div className="game-card__stats">
            {statChips.map((chip, index) => (
              <span
                key={`${cardId}-chip-${index}`}
                className="card-tag"
                style={chip.style}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {showRules ? (
        <p
          className={`game-card__rules${isHidden ? " game-card__rules--hidden" : ""}`}
          title={!isHidden ? rulesText : undefined}
        >
          {rulesText}
        </p>
      ) : null}
      {showTags && !isHidden && tags.length > 0 ? (
        <div className="game-card__tags">
          {tags.map((tag) => (
            <span key={`${cardId}-${tag}`} className="card-tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {showChampionStats && !isHidden && card?.champion ? (
        <div className="game-card__champion">
          <span className="card-tag">HP {card.champion.hp}</span>
          <span className="card-tag">Dice {card.champion.attackDice}</span>
          <span className="card-tag">Hits {card.champion.hitFaces}</span>
          <span className="card-tag">Bounty {card.champion.bounty}</span>
        </div>
      ) : null}
    </Component>
  );
};

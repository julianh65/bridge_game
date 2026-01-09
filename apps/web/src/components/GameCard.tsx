import type { ElementType, ReactNode } from "react";

import type { CardDef } from "@bridgefront/engine";

import { FactionSymbol } from "./FactionSymbol";
import { getCardArtUrl } from "../lib/card-art";
import { getFactionName } from "../lib/factions";

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
  showFaction?: boolean;
  showChampionStats?: boolean;
  showArt?: boolean;
  artUrl?: string | null;
  showStats?: boolean;
  count?: number | null;
  isHidden?: boolean;
  isActive?: boolean;
  isWinner?: boolean;
  overlay?: ReactNode;
  rulesFallback?: string;
  hiddenRules?: string;
  artLabel?: string;
  scalingCounters?: Record<string, number> | null;
};

const formatDeckLabel = (deck?: string | null) => {
  if (!deck) {
    return null;
  }
  const normalized = deck.toLowerCase();
  const ageMatch = normalized.match(/^age(\d+)/);
  if (ageMatch) {
    return `Age ${ageMatch[1]}`;
  }
  if (normalized === "starter") {
    return "Starter";
  }
  if (normalized === "power") {
    return "Power";
  }
  return null;
};

const formatTypeLabel = (type?: string | null) => {
  if (!type) {
    return null;
  }
  const normalized = type.replace(/[_-]+/g, " ");
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatChampionGoldCosts = (baseGold: number, values: number[]) =>
  values.map((value) => String(baseGold + value)).join("/");

const boldRuleNumbers = (text: string): ReactNode[] => {
  const parts = text.split(/(\d+)/g);
  return parts.map((part, index) =>
    /^\d+$/.test(part) ? <strong key={`num-${index}`}>{part}</strong> : part
  );
};

type ScalingInfo = {
  label: string;
  value: number;
};

const getScalingInfo = (
  card: CardDef | null,
  scalingCounters: Record<string, number> | null | undefined
): ScalingInfo | null => {
  if (!card || !scalingCounters || !Array.isArray(card.effects)) {
    return null;
  }
  const recruitEffect = card.effects.find(
    (effect) =>
      effect &&
      typeof effect === "object" &&
      "kind" in effect &&
      effect.kind === "recruit" &&
      typeof (effect as { scaleKey?: unknown }).scaleKey === "string"
  ) as
    | {
        scaleKey?: string;
        scaleMax?: number;
        capitalCount?: number;
        occupiedCount?: number;
      }
    | undefined;
  if (!recruitEffect?.scaleKey) {
    return null;
  }
  const baseCountRaw =
    typeof recruitEffect.capitalCount === "number"
      ? recruitEffect.capitalCount
      : typeof recruitEffect.occupiedCount === "number"
      ? recruitEffect.occupiedCount
      : 0;
  const baseCount = Math.max(0, Math.floor(baseCountRaw));
  const counter = scalingCounters[recruitEffect.scaleKey] ?? 0;
  let scaledValue = baseCount + Math.max(0, Math.floor(counter));
  if (typeof recruitEffect.scaleMax === "number" && Number.isFinite(recruitEffect.scaleMax)) {
    scaledValue = Math.min(scaledValue, Math.max(0, Math.floor(recruitEffect.scaleMax)));
  }
  return {
    label: `Deploy ${scaledValue}`,
    value: scaledValue
  };
};

export const GameCard = ({
  card,
  cardId,
  variant = "grid",
  as: Component = "article",
  className,
  eyebrow,
  displayName,
  showId = false,
  showRules = true,
  showTags = false,
  showFaction = false,
  showChampionStats = false,
  showArt = true,
  artUrl = null,
  showStats = true,
  count = null,
  isHidden = false,
  isActive = false,
  isWinner = false,
  overlay,
  rulesFallback = "Rules pending.",
  hiddenRules = "Unrevealed market card.",
  artLabel,
  scalingCounters = null
}: GameCardProps) => {
  const deck = card?.deck ?? "unknown";
  const type = card?.type ?? "unknown";
  const deckLabel = eyebrow === undefined ? formatDeckLabel(deck) : eyebrow;
  const name = displayName ?? (isHidden ? "Face down" : card?.name ?? cardId);
  const typeLabel = !isHidden ? formatTypeLabel(card?.type) : null;
  const rulesText = isHidden ? hiddenRules : card?.rulesText ?? rulesFallback;
  const tags = card?.tags ?? [];
  const isChampion = Boolean(card?.champion);
  const isPower = deck === "power";
  const showUnknown = isHidden || !card;
  const resolvedArtUrl = artUrl ?? getCardArtUrl(cardId);
  const showArtImage = Boolean(resolvedArtUrl) && !isHidden;
  const initiativeLabel = showStats ? (showUnknown ? "?" : `${card?.initiative ?? "?"}`) : null;
  const baseGoldCost = card?.cost.gold ?? 0;
  const championGoldCosts =
    !showUnknown && card?.champion?.goldCostByChampionCount?.length
      ? formatChampionGoldCosts(baseGoldCost, card.champion.goldCostByChampionCount)
      : null;
  const manaLabel = showUnknown ? "?" : `${card?.cost.mana ?? 0}`;
  const goldLabel = showUnknown ? "?" : championGoldCosts ?? `${baseGoldCost}`;
  const artText = artLabel ?? (isHidden ? "Face down" : "Art");
  const showFactionLabel = showFaction && !isHidden && Boolean(card?.factionId);
  const factionName = showFactionLabel ? getFactionName(card?.factionId) : null;
  const victoryPoints =
    !isHidden && card?.type === "Victory" ? card.victoryPoints ?? 1 : null;
  const showBurnBadge = variant === "hand" && !isHidden && Boolean(card?.burn);
  const championScaleLabel =
    showChampionStats && championGoldCosts
      ? `Gold cost ${championGoldCosts} (champions owned)`
      : null;
  const scalingInfo = !isHidden ? getScalingInfo(card, scalingCounters) : null;
  const scalingLabel = scalingInfo?.label ?? null;

  const classes = [
    "game-card",
    `game-card--${variant}`,
    isPower ? "game-card--power" : "",
    isChampion ? "game-card--champion" : "",
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
      {showBurnBadge ? <span className="game-card__burn-badge">Burn</span> : null}
      {initiativeLabel ? (
        <div className="game-card__initiative" aria-label={`Initiative ${initiativeLabel}`}>
          {initiativeLabel}
        </div>
      ) : null}
      {typeof count === "number" ? (
        <div className="game-card__count">x{count}</div>
      ) : null}
      <div className="game-card__header">
        <h3 className="game-card__name">{name}</h3>
        {typeLabel ? <p className="game-card__type">{typeLabel}</p> : null}
        {showId && !isHidden ? <p className="game-card__id">{cardId}</p> : null}
      </div>
      {deckLabel ? <div className="game-card__age">{deckLabel}</div> : null}
      {showFactionLabel ? (
        <div className="game-card__faction">
          <FactionSymbol factionId={card?.factionId} className="faction-symbol--mini" />
          <span>Faction {factionName}</span>
        </div>
      ) : null}
      {showArt ? (
        <div
          className="game-card__art"
          style={
            showArtImage
              ? {
                  backgroundImage: `url(${resolvedArtUrl})`
                }
              : undefined
          }
        >
          {!showArtImage ? <span>{artText}</span> : null}
        </div>
      ) : null}
      {showRules ? (
        <div className="game-card__rules-block">
          <p
            className={`game-card__rules${isHidden ? " game-card__rules--hidden" : ""}`}
            title={!isHidden ? rulesText : undefined}
          >
            {boldRuleNumbers(rulesText)}
          </p>
          {scalingLabel ? <p className="game-card__scale">{scalingLabel}</p> : null}
          {victoryPoints !== null ? (
            <p className="game-card__vp game-card__vp--inline">+{victoryPoints} VP</p>
          ) : null}
        </div>
      ) : null}
      {showChampionStats && !isHidden && card?.champion ? (
        <>
          <div className="game-card__champion">
            <div className="game-card__champion-stat game-card__champion-stat--hp">
              <span className="game-card__champion-label">HP</span>
              <strong>{card.champion.hp}</strong>
            </div>
            <div className="game-card__champion-stat game-card__champion-stat--dice">
              <span className="game-card__champion-label">Dice</span>
              <strong>{card.champion.attackDice}</strong>
            </div>
            <div className="game-card__champion-stat game-card__champion-stat--hits">
              <span className="game-card__champion-label">Hits</span>
              <strong>{card.champion.hitFaces}</strong>
            </div>
            <div className="game-card__champion-stat game-card__champion-stat--bounty">
              <span className="game-card__champion-label">Bounty</span>
              <strong>{card.champion.bounty}</strong>
            </div>
          </div>
          {championScaleLabel ? (
            <div className="game-card__champion-scale">{championScaleLabel}</div>
          ) : null}
        </>
      ) : null}
      {showTags && !isHidden && tags.length > 0 ? (
        <div className="game-card__tags">
          {tags.map((tag) => {
            const normalizedTag = tag.trim().toLowerCase();
            const tagClass =
              normalizedTag === "burn" ? "card-tag card-tag--burn" : "card-tag";
            return (
              <span key={`${cardId}-${tag}`} className={tagClass}>
                {tag}
              </span>
            );
          })}
        </div>
      ) : null}
      {showStats ? (
        <div className="game-card__cost">
          <span className="game-card__cost-chip game-card__cost-chip--mana">
            <span className="game-card__cost-icon" aria-hidden="true">
              🔵
            </span>
            <span className="game-card__cost-number">{manaLabel}</span>
          </span>
          <span className="game-card__cost-chip game-card__cost-chip--gold">
            <span className="game-card__cost-icon" aria-hidden="true">
              🟡
            </span>
            <span className="game-card__cost-number">{goldLabel}</span>
          </span>
        </div>
      ) : null}
    </Component>
  );
};
